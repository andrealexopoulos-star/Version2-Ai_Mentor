"""
MERGE EMISSION LAYER — Integration Signal Emitter

Reads from Merge's normalized data model (CRM, Accounting, Calendar).
Emits canonical observation events into observation_events.

HARD CONSTRAINTS:
- No vendor-specific logic (no HubSpot, Salesforce, Xero references)
- No analysis, summarisation, or escalation
- No UI interaction
- Emit facts only

SIGNALS EMITTED:
  CRM/Sales:
    - deal_stall         (opportunity stage unchanged beyond expected duration)
    - pipeline_decay     (active opportunity count decreasing)
  Communication:
    - response_delay     (response latency exceeds baseline) — via native email
    - thread_silence     (conversation inactive beyond norm) — via native email
  Operations:
    - meeting_cancellation_cluster  (>=2 cancellations in 7 days)
    - meeting_overload   (meetings per day exceed baseline)
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging
import json

logger = logging.getLogger(__name__)

# Default stage duration expectations (days) when no historical data exists
DEFAULT_STAGE_DURATION = 14
# Default pipeline comparison window (days)
PIPELINE_WINDOW_DAYS = 14
# Default response delay threshold (hours)
RESPONSE_DELAY_HOURS = 48
# Thread silence threshold (days)
THREAD_SILENCE_DAYS = 7
# Meeting cancellation cluster threshold
CANCELLATION_CLUSTER_MIN = 2
CANCELLATION_CLUSTER_WINDOW_DAYS = 7
# Meeting overload: weekly baseline multiplier
MEETING_OVERLOAD_MULTIPLIER = 1.5


class MergeEmissionLayer:
    """
    Reads Merge normalized objects.
    Emits observation events.
    Does not analyse. Does not speak to users.
    """

    def __init__(self, supabase_client, merge_client):
        self.supabase = supabase_client
        self.merge = merge_client

    async def run_emission(self, user_id: str, account_id: str) -> Dict[str, Any]:
        """
        Run all emission checks for a user.
        Returns summary of signals emitted (internal use only).
        """
        emitted = []

        # Get Merge account tokens per category
        tokens = await self._get_account_tokens(account_id)

        # CRM / Sales signals
        crm_token = tokens.get("crm")
        if crm_token:
            emitted.extend(await self._emit_crm_signals(user_id, crm_token))

        # Finance / Accounting signals — via Merge accounting
        accounting_token = tokens.get("accounting")
        if accounting_token:
            emitted.extend(await self._emit_accounting_signals(user_id, accounting_token))

        # Communication signals — via native email tables (not Merge)
        emitted.extend(await self._emit_email_signals(user_id))

        # Calendar / Meeting signals — via native calendar tables
        emitted.extend(await self._emit_calendar_signals(user_id))

        logger.info(f"[emission] {len(emitted)} signals emitted for user {user_id}")
        return {
            "signals_emitted": len(emitted),
            "signals": [s.get("signal_name") for s in emitted],
        }

    # ═══════════════════════════════════════════════════════════════
    # CRM / SALES — Merge Opportunity Objects
    # ═══════════════════════════════════════════════════════════════

    async def _emit_crm_signals(self, user_id: str, account_token: str) -> List[Dict]:
        emitted = []

        try:
            data = await self.merge.get_deals(account_token=account_token, page_size=200)
            opportunities = data.get("results", [])
        except Exception as e:
            logger.warning(f"[emission] CRM read failed: {e}")
            return emitted

        if not opportunities:
            return emitted

        now = datetime.now(timezone.utc)

        # ─── DEAL STALL ──────────────────────────────────────────
        for opp in opportunities:
            status = (opp.get("status") or "").upper()
            if status in ("WON", "LOST", "CLOSED"):
                continue

            last_modified = opp.get("last_activity_at") or opp.get("remote_updated_at")
            if not last_modified:
                continue

            try:
                last_dt = datetime.fromisoformat(str(last_modified).replace("Z", "+00:00"))
            except (ValueError, TypeError):
                continue

            days_in_stage = (now - last_dt).days
            if days_in_stage < DEFAULT_STAGE_DURATION:
                continue

            event = self._build_event(
                user_id=user_id,
                source="merge_crm",
                domain="sales",
                event_type="sales",
                signal_name="deal_stall",
                entity={
                    "opportunity_id": opp.get("id"),
                    "name": opp.get("name"),
                    "stage": opp.get("stage"),
                },
                metric={
                    "days_in_stage": days_in_stage,
                    "expected_days": DEFAULT_STAGE_DURATION,
                },
                confidence=min(0.5 + (days_in_stage - DEFAULT_STAGE_DURATION) * 0.02, 0.95),
                severity="warning" if days_in_stage < 28 else "critical",
            )
            emitted.append(await self._persist_event(event))

        # ─── PIPELINE DECAY ──────────────────────────────────────
        active_count = sum(
            1 for o in opportunities
            if (o.get("status") or "").upper() not in ("WON", "LOST", "CLOSED")
        )

        prior_count = await self._get_prior_pipeline_count(user_id)
        if prior_count is not None and active_count < prior_count:
            delta = active_count - prior_count
            event = self._build_event(
                user_id=user_id,
                source="merge_crm",
                domain="sales",
                event_type="sales",
                signal_name="pipeline_decay",
                entity={"snapshot": "pipeline"},
                metric={
                    "deal_count_current": active_count,
                    "deal_count_prior": prior_count,
                    "deal_count_delta": delta,
                    "window_days": PIPELINE_WINDOW_DAYS,
                },
                confidence=min(0.6 + abs(delta) * 0.05, 0.95),
                severity="warning" if abs(delta) <= 3 else "critical",
            )
            emitted.append(await self._persist_event(event))

        # Store current count for next comparison
        await self._store_pipeline_snapshot(user_id, active_count)

        return emitted

    # ═══════════════════════════════════════════════════════════════
    # ACCOUNTING — Merge Invoice / Payment Objects
    # ═══════════════════════════════════════════════════════════════

    async def _emit_accounting_signals(self, user_id: str, account_token: str) -> List[Dict]:
        emitted = []

        try:
            data = await self.merge.get_invoices(account_token=account_token, page_size=200)
            invoices = data.get("results", [])
        except Exception as e:
            logger.warning(f"[emission] Accounting read failed: {e}")
            return emitted

        now = datetime.now(timezone.utc)
        overdue_count = 0
        overdue_total = 0.0

        for inv in invoices:
            status = (inv.get("status") or "").upper()
            if status in ("PAID", "VOIDED"):
                continue

            due_date_str = inv.get("due_date")
            if not due_date_str:
                continue

            try:
                due_dt = datetime.fromisoformat(str(due_date_str).replace("Z", "+00:00"))
            except (ValueError, TypeError):
                continue

            days_overdue = (now - due_dt).days
            if days_overdue <= 0:
                continue

            overdue_count += 1
            amount = float(inv.get("total_amount") or inv.get("amount") or 0)
            overdue_total += amount

        if overdue_count >= 2:
            event = self._build_event(
                user_id=user_id,
                source="merge_accounting",
                domain="finance",
                event_type="finance",
                signal_name="invoices_overdue_cluster",
                entity={"snapshot": "receivables"},
                metric={
                    "overdue_count": overdue_count,
                    "overdue_total": round(overdue_total, 2),
                },
                confidence=min(0.6 + overdue_count * 0.05, 0.95),
                severity="warning" if overdue_count < 5 else "critical",
            )
            emitted.append(await self._persist_event(event))

        # ─── CASH BURN ACCELERATION ──────────────────────────────
        try:
            payments_data = await self.merge.get_payments(account_token=account_token, page_size=200)
            payments = payments_data.get("results", [])

            if len(payments) >= 4:
                mid = len(payments) // 2
                recent_payments = payments[:mid]
                older_payments = payments[mid:]

                recent_total = sum(float(p.get("total_amount") or p.get("amount") or 0) for p in recent_payments)
                older_total = sum(float(p.get("total_amount") or p.get("amount") or 0) for p in older_payments)

                if older_total > 0 and recent_total > older_total * 1.2:
                    event = self._build_event(
                        user_id=user_id,
                        source="merge_accounting",
                        domain="finance",
                        event_type="finance",
                        signal_name="cash_burn_acceleration",
                        entity={"snapshot": "outflows"},
                        metric={
                            "current_burn_rate": round(recent_total, 2),
                            "previous_burn_rate": round(older_total, 2),
                        },
                        confidence=min(0.55 + (recent_total / older_total - 1) * 0.5, 0.9),
                        severity="warning" if recent_total < older_total * 1.5 else "critical",
                    )
                    emitted.append(await self._persist_event(event))
        except Exception as e:
            logger.debug(f"[emission] Cash burn check failed: {e}")

        # ─── MARGIN COMPRESSION ──────────────────────────────────
        try:
            total_revenue = sum(float(inv.get("total_amount") or inv.get("amount") or 0) for inv in invoices)

            # Fetch payments if not already loaded
            margin_payments = []
            try:
                margin_data = await self.merge.get_payments(account_token=account_token, page_size=200)
                margin_payments = margin_data.get("results", [])
            except Exception:
                pass

            total_cost = sum(float(p.get("total_amount") or p.get("amount") or 0) for p in margin_payments)

            if total_revenue > 0 and total_cost > 0:
                current_margin = round((total_revenue - total_cost) / total_revenue, 4)

                # Get prior margin from snapshot
                prior_margin = await self._get_prior_margin(user_id)
                if prior_margin is not None and current_margin < prior_margin * 0.9:
                    event = self._build_event(
                        user_id=user_id,
                        source="merge_accounting",
                        domain="finance",
                        event_type="finance",
                        signal_name="margin_compression",
                        entity={"snapshot": "profitability"},
                        metric={
                            "current_margin": current_margin,
                            "baseline_margin": prior_margin,
                        },
                        confidence=min(0.6 + abs(prior_margin - current_margin) * 2, 0.9),
                        severity="warning",
                    )
                    emitted.append(await self._persist_event(event))

                # Store current margin for next comparison
                await self._store_margin_snapshot(user_id, current_margin)
        except Exception as e:
            logger.debug(f"[emission] Margin compression check failed: {e}")

        return emitted

    # ═══════════════════════════════════════════════════════════════
    # EMAIL / COMMUNICATION — Native Email Tables
    # ═══════════════════════════════════════════════════════════════

    async def _emit_email_signals(self, user_id: str) -> List[Dict]:
        emitted = []
        now = datetime.now(timezone.utc)

        def _parse_dt(value):
            try:
                return datetime.fromisoformat(str(value).replace("Z", "+00:00")) if value else None
            except Exception:
                return None

        def _recipients(raw):
            import json as _json
            if not raw:
                return []
            if isinstance(raw, str):
                try:
                    raw = _json.loads(raw)
                except Exception:
                    return [raw.lower().strip()] if "@" in raw else []
            values = []
            if isinstance(raw, list):
                for item in raw:
                    if isinstance(item, dict):
                        email = str(item.get("email") or item.get("address") or item.get("emailAddress") or "").lower().strip()
                        if email:
                            values.append(email)
                    elif isinstance(item, str):
                        values.append(item.lower().strip())
            return values

        def _normalise_subject(value):
            import re as _re
            subject = str(value or "").lower().strip()
            subject = _re.sub(r"^(re|fw|fwd)\s*:\s*", "", subject)
            return _re.sub(r"\s+", " ", subject)

        sent_result = self.supabase.table("outlook_emails").select(
            "to_recipients, received_date, subject"
        ).eq("user_id", user_id).eq("folder", "sentitems").gte(
            "received_date", (now - timedelta(days=14)).isoformat()
        ).limit(200).execute()
        latest_sent_by_recipient = {}
        latest_sent_by_recipient_subject = {}
        for sent in (sent_result.data or []):
            sent_at = _parse_dt(sent.get("received_date"))
            if not sent_at:
                continue
            sent_subject = _normalise_subject(sent.get("subject"))
            for recipient in _recipients(sent.get("to_recipients")):
                current = latest_sent_by_recipient.get(recipient)
                if current is None or sent_at > current:
                    latest_sent_by_recipient[recipient] = sent_at
                if sent_subject:
                    key = (recipient, sent_subject)
                    current_subject = latest_sent_by_recipient_subject.get(key)
                    if current_subject is None or sent_at > current_subject:
                        latest_sent_by_recipient_subject[key] = sent_at

        # ─── RESPONSE DELAY ──────────────────────────────────────
        try:
            cutoff = (now - timedelta(days=7)).isoformat()
            result = self.supabase.table("outlook_emails").select(
                "from_address, received_date, subject"
            ).eq("user_id", user_id).eq("folder", "inbox").gte(
                "received_date", cutoff
            ).order("received_date", desc=True).limit(200).execute()

            emails = result.data or []
            if emails:
                # Group by sender, find max gap
                senders = {}
                for e in emails:
                    addr = e.get("from_address")
                    if not addr:
                        continue
                    if addr not in senders:
                        senders[addr] = []
                    senders[addr].append(e.get("received_date"))

                for addr, dates in senders.items():
                    if len(dates) < 2:
                        continue
                    sorted_dates = sorted(dates, reverse=True)
                    try:
                        latest = _parse_dt(sorted_dates[0])
                        prev = _parse_dt(sorted_dates[1])
                        if not latest or not prev:
                            continue
                        gap_hours = (latest - prev).total_seconds() / 3600
                    except (ValueError, TypeError, IndexError):
                        continue

                    latest_reply = latest_sent_by_recipient.get(addr)
                    sent_subject_match = None
                    try:
                        latest_email = next((item for item in emails if item.get("from_address") == addr and item.get("received_date") == sorted_dates[0]), None)
                        latest_subject = _normalise_subject((latest_email or {}).get("subject"))
                        if latest_subject:
                            sent_subject_match = latest_sent_by_recipient_subject.get((addr, latest_subject))
                    except Exception:
                        sent_subject_match = None
                    if (latest_reply and latest_reply >= latest) or (sent_subject_match and sent_subject_match >= latest):
                        continue

                    if gap_hours > RESPONSE_DELAY_HOURS:
                        event = self._build_event(
                            user_id=user_id,
                            source="native_email",
                            domain="sales",
                            event_type="communication",
                            signal_name="response_delay",
                            entity={"contact": addr},
                            metric={
                                "gap_hours": round(gap_hours, 1),
                                "threshold_hours": RESPONSE_DELAY_HOURS,
                            },
                            confidence=min(0.5 + (gap_hours - RESPONSE_DELAY_HOURS) / 100, 0.9),
                            severity="warning",
                        )
                        emitted.append(await self._persist_event(event))
                        break  # One signal per emission cycle
        except Exception as e:
            logger.debug(f"[emission] Email response delay check failed: {e}")

        # ─── THREAD SILENCE ──────────────────────────────────────
        try:
            silence_cutoff = (now - timedelta(days=THREAD_SILENCE_DAYS)).isoformat()
            old_cutoff = (now - timedelta(days=THREAD_SILENCE_DAYS + 30)).isoformat()

            # Find contacts who were active 8-37 days ago but silent last 7 days
            active_result = self.supabase.table("outlook_emails").select(
                "from_address"
            ).eq("user_id", user_id).eq("folder", "inbox").gte(
                "received_date", old_cutoff
            ).lt("received_date", silence_cutoff).limit(100).execute()

            active_contacts = set(e.get("from_address") for e in (active_result.data or []) if e.get("from_address"))

            recent_result = self.supabase.table("outlook_emails").select(
                "from_address"
            ).eq("user_id", user_id).eq("folder", "inbox").gte("received_date", silence_cutoff).limit(200).execute()

            recent_contacts = set(e.get("from_address") for e in (recent_result.data or []) if e.get("from_address"))
            recent_contacts.update({recipient for recipient, replied_at in latest_sent_by_recipient.items() if replied_at >= now - timedelta(days=THREAD_SILENCE_DAYS)})

            silent = active_contacts - recent_contacts
            if silent:
                contact = next(iter(silent))
                event = self._build_event(
                    user_id=user_id,
                    source="native_email",
                    domain="sales",
                    event_type="communication",
                    signal_name="thread_silence",
                    entity={"contact": contact},
                    metric={
                        "silent_days": THREAD_SILENCE_DAYS,
                        "previously_active": True,
                    },
                    confidence=0.65,
                    severity="warning",
                )
                emitted.append(await self._persist_event(event))
        except Exception as e:
            logger.debug(f"[emission] Thread silence check failed: {e}")

        return emitted

    # ═══════════════════════════════════════════════════════════════
    # CALENDAR / MEETINGS — Native Calendar Tables
    # ═══════════════════════════════════════════════════════════════

    async def _emit_calendar_signals(self, user_id: str) -> List[Dict]:
        emitted = []
        now = datetime.now(timezone.utc)

        try:
            # Current week events
            week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0)
            week_end = week_start + timedelta(days=7)

            result = self.supabase.table("outlook_calendar_events").select(
                "id, start_time, is_cancelled"
            ).eq("user_id", user_id).gte(
                "start_time", week_start.isoformat()
            ).lt("start_time", week_end.isoformat()).execute()

            events = result.data or []
        except Exception as e:
            logger.debug(f"[emission] Calendar read failed: {e}")
            return emitted

        if not events:
            return emitted

        # ─── MEETING CANCELLATION CLUSTER ────────────────────────
        cancelled = [e for e in events if e.get("is_cancelled")]
        if len(cancelled) >= CANCELLATION_CLUSTER_MIN:
            event = self._build_event(
                user_id=user_id,
                source="native_calendar",
                domain="operations",
                event_type="operations",
                signal_name="meeting_cancellation_cluster",
                entity={"snapshot": "calendar_week"},
                metric={
                    "cancelled_count": len(cancelled),
                    "window_days": CANCELLATION_CLUSTER_WINDOW_DAYS,
                    "threshold": CANCELLATION_CLUSTER_MIN,
                },
                confidence=min(0.55 + len(cancelled) * 0.1, 0.9),
                severity="warning",
            )
            emitted.append(await self._persist_event(event))

        # ─── MEETING OVERLOAD ────────────────────────────────────
        active_events = [e for e in events if not e.get("is_cancelled")]
        current_count = len(active_events)

        # Get 4-week baseline
        try:
            baseline_start = (now - timedelta(days=28)).isoformat()
            baseline_result = self.supabase.table("outlook_calendar_events").select(
                "id", count="exact"
            ).eq("user_id", user_id).gte(
                "start_time", baseline_start
            ).lt("start_time", week_start.isoformat()).execute()

            baseline_total = baseline_result.count if baseline_result.count else 0
            baseline_weekly = round(baseline_total / 4) if baseline_total else 0
        except Exception:
            baseline_weekly = 0

        if baseline_weekly > 0 and current_count >= max(3, int(baseline_weekly * MEETING_OVERLOAD_MULTIPLIER)):
            event = self._build_event(
                user_id=user_id,
                source="native_calendar",
                domain="operations",
                event_type="operations",
                signal_name="meeting_overload",
                entity={"snapshot": "calendar_week"},
                metric={
                    "current_week_count": current_count,
                    "baseline_weekly": baseline_weekly,
                    "multiplier": round(current_count / baseline_weekly, 2) if baseline_weekly else 0,
                },
                confidence=min(0.6 + (current_count - baseline_weekly) * 0.05, 0.9),
                severity="warning" if current_count < baseline_weekly * 2 else "critical",
            )
            emitted.append(await self._persist_event(event))

        # ─── DECISION GAP ────────────────────────────────────────
        # Recurring meetings with no decision artifacts over window
        try:
            window_start = (now - timedelta(days=14)).isoformat()
            recurring_result = self.supabase.table("outlook_calendar_events").select(
                "id, subject, start_time"
            ).eq("user_id", user_id).gte(
                "start_time", window_start
            ).lt("start_time", week_end.isoformat()).execute()

            recurring_events = recurring_result.data or []

            # Group by subject to find recurring meetings
            subject_counts = {}
            for ev in recurring_events:
                subj = (ev.get("subject") or "").strip().lower()
                if subj and len(subj) > 3:
                    subject_counts[subj] = subject_counts.get(subj, 0) + 1

            # Recurring = same subject appears 2+ times in 14 days
            recurring_subjects = {s: c for s, c in subject_counts.items() if c >= 2}
            meetings_without_decision = sum(recurring_subjects.values())

            if meetings_without_decision >= 3:
                event = self._build_event(
                    user_id=user_id,
                    source="native_calendar",
                    domain="operations",
                    event_type="operations",
                    signal_name="decision_gap",
                    entity={"snapshot": "recurring_meetings"},
                    metric={
                        "meetings_without_decision": meetings_without_decision,
                        "window_days": 14,
                        "recurring_subjects": len(recurring_subjects),
                    },
                    confidence=min(0.5 + meetings_without_decision * 0.05, 0.85),
                    severity="warning",
                )
                emitted.append(await self._persist_event(event))
        except Exception as e:
            logger.debug(f"[emission] Decision gap check failed: {e}")

        return emitted
    # ═══════════════════════════════════════════════════════════════

    def _build_event(
        self,
        user_id: str,
        source: str,
        domain: str,
        event_type: str,
        signal_name: str,
        entity: Dict,
        metric: Dict,
        confidence: float,
        severity: str = "info",
    ) -> Dict[str, Any]:
        import hashlib
        # Build deterministic fingerprint from signal identity
        fp_source = f"{user_id}:{source}:{domain}:{signal_name}:{json.dumps(entity, sort_keys=True, default=str)}"
        fingerprint = hashlib.sha256(fp_source.encode()).hexdigest()[:40]
        return {
            "id": str(uuid4()),
            "user_id": user_id,
            "source": source,
            "domain": domain,
            "event_type": event_type,
            "signal_name": signal_name,
            "entity": entity,
            "metric": metric,
            "payload": {**entity, **metric},
            "confidence": min(max(confidence, 0), 1),
            "severity": severity,
            "fingerprint": fingerprint,
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    async def _persist_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Persist observation event. Upserts on (user_id, fingerprint) when fingerprint is set (see add_observation_fingerprint.sql)."""
        try:
            # Remove fingerprint if table doesn't support it
            event_clean = {k: v for k, v in event.items() if v is not None}
            fp = event_clean.get("fingerprint")
            if fp and event_clean.get("user_id"):
                # Omit id so conflict UPDATE does not replace an existing row's primary key
                upsert_row = {k: v for k, v in event_clean.items() if k != "id"}
                try:
                    result = self.supabase.table("observation_events").upsert(
                        upsert_row, on_conflict="user_id,fingerprint"
                    ).execute()
                    if result.data:
                        logger.info(f"[emission] {event['signal_name']} emitted for {event.get('domain','?')}")
                        return result.data[0]
                    return event_clean
                except Exception as up_e:
                    logger.warning(f"[emission] upsert failed, insert fallback: {str(up_e)[:200]}")
            result = self.supabase.table("observation_events").insert(event_clean).execute()
            if result.data:
                logger.info(f"[emission] {event['signal_name']} emitted for {event.get('domain','?')}")
                return result.data[0]
            return event_clean
        except Exception as e:
            err = str(e)
            # If fingerprint column doesn't exist, retry without it
            if "fingerprint" in err or "column" in err:
                try:
                    event_safe = {k: v for k, v in event.items() if k != "fingerprint" and v is not None}
                    result = self.supabase.table("observation_events").insert(event_safe).execute()
                    if result.data:
                        logger.info(f"[emission] {event['signal_name']} emitted (no fingerprint)")
                        return result.data[0]
                except Exception as e2:
                    logger.error(f"[emission] Fallback persist failed: {e2}")
            else:
                logger.error(f"[emission] Persist failed for {event.get('signal_name','?')}: {err[:120]}")
            return event

    async def _get_account_tokens(self, account_id: str) -> Dict[str, str]:
        """Get all Merge account tokens for a workspace, keyed by category."""
        tokens = {}
        try:
            result = self.supabase.table("integration_accounts").select(
                "category, account_token"
            ).eq("account_id", account_id).execute()

            for row in (result.data or []):
                cat = row.get("category")
                token = row.get("account_token")
                if cat and token and token != "connected":
                    tokens[cat] = token
        except Exception as e:
            logger.debug(f"[emission] Token lookup failed: {e}")
        return tokens

    async def _get_prior_pipeline_count(self, user_id: str) -> Optional[int]:
        """Get previously stored pipeline count for comparison."""
        try:
            result = self.supabase.table("observation_events").select(
                "metric"
            ).eq("user_id", user_id).eq(
                "signal_name", "pipeline_snapshot"
            ).order("observed_at", desc=True).limit(1).execute()

            if result.data:
                return result.data[0].get("metric", {}).get("active_count")
            return None
        except Exception:
            return None

    async def _store_pipeline_snapshot(self, user_id: str, active_count: int):
        """Store current pipeline count as a snapshot event."""
        snapshot = self._build_event(
            user_id=user_id,
            source="merge_crm",
            domain="sales",
            event_type="snapshot",
            signal_name="pipeline_snapshot",
            entity={"snapshot": "pipeline"},
            metric={"active_count": active_count},
            confidence=1.0,
            severity="info",
        )
        await self._persist_event(snapshot)

    async def _get_prior_margin(self, user_id: str) -> Optional[float]:
        """Get previously stored margin for comparison."""
        try:
            result = self.supabase.table("observation_events").select(
                "metric"
            ).eq("user_id", user_id).eq(
                "signal_name", "margin_snapshot"
            ).order("observed_at", desc=True).limit(1).execute()

            if result.data:
                return result.data[0].get("metric", {}).get("margin")
            return None
        except Exception:
            return None

    async def _store_margin_snapshot(self, user_id: str, margin: float):
        """Store current margin as a snapshot event."""
        snapshot = self._build_event(
            user_id=user_id,
            source="merge_accounting",
            domain="finance",
            event_type="snapshot",
            signal_name="margin_snapshot",
            entity={"snapshot": "profitability"},
            metric={"margin": margin},
            confidence=1.0,
            severity="info",
        )
        await self._persist_event(snapshot)


# ═══════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════

_emission_layer: Optional[MergeEmissionLayer] = None


def init_emission_layer(supabase_client, merge_client) -> MergeEmissionLayer:
    global _emission_layer
    _emission_layer = MergeEmissionLayer(supabase_client, merge_client)
    logger.info("[emission] Merge Emission Layer initialized")
    return _emission_layer


def get_emission_layer() -> MergeEmissionLayer:
    if _emission_layer is None:
        raise RuntimeError("Emission layer not initialized")
    return _emission_layer
