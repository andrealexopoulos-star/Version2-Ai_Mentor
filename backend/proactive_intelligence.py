"""
Proactive Intelligence Engine — Detects conditions warranting user attention BEFORE they ask.

10 detectors scan across email, observation_events, integration_accounts,
cognitive_profiles, and regulatory_signals to surface alerts proactively.

All alerts are upserted to intelligence_actions with source='proactive_engine',
deduplicated via source_id.

SYNC Supabase calls only (supabase-py v2, snake_case API).
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)


class ProactiveIntelligenceEngine:
    """
    Runs 10 detectors that scan for conditions warranting user attention.
    Each detector returns a list of alert dicts with keys:
        source_id, severity, domain, title, description, suggested_action, metadata
    """

    def __init__(self, sb_client):
        self.sb = sb_client

    # ═══════════════════════════════════════════════════════════════
    # PUBLIC API
    # ═══════════════════════════════════════════════════════════════

    def run_full_scan(self, user_id: str) -> list:
        """Run all detectors, upsert results to intelligence_actions table."""
        all_alerts: List[Dict[str, Any]] = []

        detectors = [
            self._detect_client_silence,
            self._detect_deal_stalls,
            self._detect_cash_runway_warning,
            self._detect_data_freshness_decay,
            self._detect_meeting_overload,
            self._detect_contradiction_escalation,
            self._detect_opportunity_window,
            self._detect_counter_narrative,
            self._detect_compliance_deadlines,
            self._detect_revenue_anomaly,
        ]

        for detector in detectors:
            try:
                alerts = detector(user_id)
                if alerts:
                    all_alerts.extend(alerts)
            except Exception as e:
                logger.error(f"[proactive] Detector {detector.__name__} failed for user {user_id}: {e}")

        # Upsert all alerts to intelligence_actions
        upserted = 0
        for alert in all_alerts:
            try:
                row = {
                    "id": str(uuid4()),
                    "user_id": user_id,
                    "source": "proactive_engine",
                    "source_id": alert["source_id"],
                    "domain": alert.get("domain", "general"),
                    "severity": alert.get("severity", "medium"),
                    "title": alert["title"],
                    "description": alert.get("description", ""),
                    "suggested_action": alert.get("suggested_action", ""),
                    "status": "action_required",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                self.sb.table("intelligence_actions").upsert(
                    row, on_conflict="source_id"
                ).execute()
                upserted += 1
            except Exception as e:
                logger.warning(f"[proactive] Failed to upsert alert {alert.get('source_id')}: {e}")

        logger.info(f"[proactive] Scan complete for user {user_id}: {len(all_alerts)} alerts detected, {upserted} upserted")
        return all_alerts

    # ═══════════════════════════════════════════════════════════════
    # DETECTORS
    # ═══════════════════════════════════════════════════════════════

    def _detect_client_silence(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Query detect_client_silence RPC for contacts with 3+ prior emails
        who stopped communicating (>21 days).
        """
        alerts = []
        try:
            result = self.sb.rpc("detect_client_silence", {
                "p_user_id": user_id,
                "p_silence_days": 21,
            }).execute()

            rows = result.data or []
            for row in rows:
                email = row.get("email", "unknown")
                name = row.get("name") or email
                days = row.get("days_silent", 21)
                prior = row.get("prior_emails", 3)

                alerts.append({
                    "source_id": f"proactive_silence_{user_id}_{email}",
                    "severity": "high" if days > 45 else "medium",
                    "domain": "sales",
                    "title": f"Client gone silent: {name}",
                    "description": (
                        f"{name} ({email}) has not emailed in {days} days "
                        f"after {prior} prior emails. This may indicate "
                        f"disengagement or a lost relationship."
                    ),
                    "suggested_action": (
                        f"Reach out to {name} with a personal check-in. "
                        f"Review last conversation context before contacting."
                    ),
                    "metadata": {
                        "email": email,
                        "days_silent": days,
                        "prior_emails": prior,
                    },
                })
        except Exception as e:
            logger.error(f"[proactive] _detect_client_silence failed: {e}")

        return alerts

    def _detect_deal_stalls(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Check observation_events domain=sales for deal_movement.
        If none in 14 days, alert.
        """
        alerts = []
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
            result = self.sb.table("observation_events").select(
                "id, signal_type, detail, created_at"
            ).eq("user_id", user_id).eq("domain", "sales").gte(
                "created_at", cutoff
            ).execute()

            rows = result.data or []
            deal_movements = [r for r in rows if "deal" in (r.get("signal_type") or "").lower()]

            if not deal_movements and rows:
                # There are sales signals but no deal movement -- stall detected
                alerts.append({
                    "source_id": f"proactive_deal_stall_{user_id}",
                    "severity": "high",
                    "domain": "sales",
                    "title": "Sales pipeline stalled — no deal movement in 14 days",
                    "description": (
                        "Your sales domain has signals but no deal movement events "
                        "in the last 14 days. Deals may be stuck in pipeline."
                    ),
                    "suggested_action": (
                        "Review your active deals and identify blockers. "
                        "Follow up with prospects who have gone quiet."
                    ),
                    "metadata": {"total_sales_signals": len(rows), "deal_movements": 0},
                })
            elif not rows:
                # No sales signals at all
                alerts.append({
                    "source_id": f"proactive_deal_stall_{user_id}",
                    "severity": "medium",
                    "domain": "sales",
                    "title": "No sales activity detected in 14 days",
                    "description": (
                        "No sales domain observation events in the last 14 days. "
                        "Pipeline visibility is limited."
                    ),
                    "suggested_action": (
                        "Ensure your CRM integration is connected and syncing. "
                        "Check deal stages and update pipeline status."
                    ),
                    "metadata": {"total_sales_signals": 0, "deal_movements": 0},
                })
        except Exception as e:
            logger.error(f"[proactive] _detect_deal_stalls failed: {e}")

        return alerts

    def _detect_cash_runway_warning(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Check finance domain observation_events for cash signals below threshold.
        """
        alerts = []
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            result = self.sb.table("observation_events").select(
                "id, signal_type, detail, confidence, created_at"
            ).eq("user_id", user_id).eq("domain", "finance").gte(
                "created_at", cutoff
            ).execute()

            rows = result.data or []
            cash_signals = [
                r for r in rows
                if any(kw in (r.get("signal_type") or "").lower()
                       for kw in ("cash", "runway", "burn", "liquidity"))
            ]

            # Look for low-confidence or negative cash signals
            warning_signals = [
                s for s in cash_signals
                if (s.get("confidence") or 0) < 0.5
                or "low" in (s.get("detail") or "").lower()
                or "warning" in (s.get("detail") or "").lower()
                or "decline" in (s.get("detail") or "").lower()
            ]

            if warning_signals:
                alerts.append({
                    "source_id": f"proactive_cash_runway_{user_id}",
                    "severity": "critical" if len(warning_signals) >= 3 else "high",
                    "domain": "finance",
                    "title": "Cash runway warning detected",
                    "description": (
                        f"{len(warning_signals)} cash-related warning signal(s) detected "
                        f"in the last 30 days. Your cash position may need attention."
                    ),
                    "suggested_action": (
                        "Review your cash flow projections immediately. "
                        "Check outstanding receivables and upcoming obligations."
                    ),
                    "metadata": {
                        "warning_count": len(warning_signals),
                        "total_cash_signals": len(cash_signals),
                    },
                })
        except Exception as e:
            logger.error(f"[proactive] _detect_cash_runway_warning failed: {e}")

        return alerts

    def _detect_data_freshness_decay(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Check integration_accounts for last_sync_at > 3 days ago.
        """
        alerts = []
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
            result = self.sb.table("integration_accounts").select(
                "id, provider, category, last_sync_at"
            ).eq("user_id", user_id).execute()

            rows = result.data or []
            stale = []
            for row in rows:
                last_sync = row.get("last_sync_at")
                if not last_sync:
                    stale.append(row)
                    continue
                try:
                    sync_dt = datetime.fromisoformat(str(last_sync).replace("Z", "+00:00"))
                    if sync_dt < datetime.now(timezone.utc) - timedelta(days=3):
                        stale.append(row)
                except (ValueError, TypeError):
                    stale.append(row)

            if stale:
                providers = [r.get("provider", "unknown") for r in stale]
                alerts.append({
                    "source_id": f"proactive_freshness_{user_id}",
                    "severity": "high" if len(stale) >= 3 else "medium",
                    "domain": "operations",
                    "title": f"Data freshness decay: {len(stale)} integration(s) stale",
                    "description": (
                        f"The following integrations have not synced in 3+ days: "
                        f"{', '.join(providers)}. Intelligence quality is degrading."
                    ),
                    "suggested_action": (
                        "Check integration connection status. "
                        "Re-authenticate any expired connections."
                    ),
                    "metadata": {
                        "stale_count": len(stale),
                        "stale_providers": providers,
                    },
                })
        except Exception as e:
            logger.error(f"[proactive] _detect_data_freshness_decay failed: {e}")

        return alerts

    def _detect_meeting_overload(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Check observation_events for upcoming_meeting signals. >6 = alert.
        """
        alerts = []
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            result = self.sb.table("observation_events").select(
                "id, signal_type, detail, created_at"
            ).eq("user_id", user_id).gte("created_at", cutoff).execute()

            rows = result.data or []
            meeting_signals = [
                r for r in rows
                if any(kw in (r.get("signal_type") or "").lower()
                       for kw in ("meeting", "calendar", "event", "appointment"))
            ]

            if len(meeting_signals) > 6:
                alerts.append({
                    "source_id": f"proactive_meeting_overload_{user_id}",
                    "severity": "medium",
                    "domain": "operations",
                    "title": f"Meeting overload: {len(meeting_signals)} meeting signals this week",
                    "description": (
                        f"{len(meeting_signals)} meeting-related signals detected in the "
                        f"last 7 days. This may reduce deep-work time and strategic focus."
                    ),
                    "suggested_action": (
                        "Audit your calendar for meetings that could be emails. "
                        "Block focus time to protect strategic thinking."
                    ),
                    "metadata": {"meeting_count": len(meeting_signals)},
                })
        except Exception as e:
            logger.error(f"[proactive] _detect_meeting_overload failed: {e}")

        return alerts

    def _detect_contradiction_escalation(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Check observation_events for priority_mismatch, action_inaction,
        or repeated_ignore. >=3 in 30 days = alert.
        """
        alerts = []
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            result = self.sb.table("observation_events").select(
                "id, signal_type, domain, detail, created_at"
            ).eq("user_id", user_id).gte("created_at", cutoff).execute()

            rows = result.data or []
            contradiction_keywords = (
                "priority_mismatch", "action_inaction", "repeated_ignore",
                "contradiction", "mismatch", "conflict"
            )
            contradictions = [
                r for r in rows
                if any(kw in (r.get("signal_type") or "").lower()
                       for kw in contradiction_keywords)
            ]

            if len(contradictions) >= 3:
                domains = list({r.get("domain", "general") for r in contradictions})
                alerts.append({
                    "source_id": f"proactive_contradictions_{user_id}",
                    "severity": "high" if len(contradictions) >= 5 else "medium",
                    "domain": domains[0] if len(domains) == 1 else "general",
                    "title": f"Contradiction pattern escalating: {len(contradictions)} signals in 30 days",
                    "description": (
                        f"{len(contradictions)} contradiction signals detected across "
                        f"{', '.join(domains)}. Repeated contradictions degrade decision quality."
                    ),
                    "suggested_action": (
                        "Review flagged contradictions and resolve alignment gaps. "
                        "Check if stated priorities match resource allocation."
                    ),
                    "metadata": {
                        "contradiction_count": len(contradictions),
                        "domains": domains,
                    },
                })
        except Exception as e:
            logger.error(f"[proactive] _detect_contradiction_escalation failed: {e}")

        return alerts

    def _detect_opportunity_window(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Check observation_events with confidence >= 0.7 in last 7 days.
        If 5+ in one domain, alert.
        """
        alerts = []
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            result = self.sb.table("observation_events").select(
                "id, signal_type, domain, confidence, detail, created_at"
            ).eq("user_id", user_id).gte(
                "created_at", cutoff
            ).gte("confidence", 0.7).execute()

            rows = result.data or []

            # Group by domain
            domain_counts: Dict[str, List[Dict]] = {}
            for row in rows:
                d = row.get("domain", "general")
                domain_counts.setdefault(d, []).append(row)

            for domain, signals in domain_counts.items():
                if len(signals) >= 5:
                    alerts.append({
                        "source_id": f"proactive_opportunity_{user_id}_{domain}",
                        "severity": "medium",
                        "domain": domain,
                        "title": f"Opportunity window in {domain}: {len(signals)} high-confidence signals",
                        "description": (
                            f"{len(signals)} high-confidence signals (>=0.7) detected in "
                            f"{domain} over the last 7 days. This concentration suggests "
                            f"a window of opportunity worth acting on."
                        ),
                        "suggested_action": (
                            f"Review the {domain} signals and identify actionable opportunities. "
                            f"Consider allocating resources while the window is open."
                        ),
                        "metadata": {
                            "signal_count": len(signals),
                            "avg_confidence": round(
                                sum(s.get("confidence", 0.7) for s in signals) / len(signals), 2
                            ),
                        },
                    })
        except Exception as e:
            logger.error(f"[proactive] _detect_opportunity_window failed: {e}")

        return alerts

    def _detect_counter_narrative(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Load cognitive_profiles.immutable_reality + recent negative market signals.
        If mismatch between stated reality and market signals, alert.
        """
        alerts = []
        try:
            # Load cognitive profile for immutable reality
            profile_result = self.sb.table("cognitive_profiles").select(
                "immutable_reality"
            ).eq("user_id", user_id).execute()

            profiles = profile_result.data or []
            if not profiles:
                return alerts

            immutable_reality = profiles[0].get("immutable_reality")
            if not immutable_reality:
                return alerts

            # Parse immutable_reality (may be string or dict)
            reality_text = ""
            if isinstance(immutable_reality, str):
                reality_text = immutable_reality.lower()
            elif isinstance(immutable_reality, dict):
                reality_text = str(immutable_reality).lower()
            else:
                return alerts

            # Load recent market domain signals
            cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
            market_result = self.sb.table("observation_events").select(
                "id, signal_type, detail, confidence, created_at"
            ).eq("user_id", user_id).eq("domain", "market").gte(
                "created_at", cutoff
            ).execute()

            market_signals = market_result.data or []
            negative_signals = [
                s for s in market_signals
                if any(kw in (s.get("detail") or "").lower()
                       for kw in ("decline", "loss", "risk", "threat",
                                  "contraction", "downturn", "negative"))
            ]

            # Check for mismatch: positive reality vs negative market
            positive_reality_keywords = (
                "growth", "strong", "expanding", "leading", "thriving",
                "dominant", "stable", "robust"
            )
            reality_is_positive = any(kw in reality_text for kw in positive_reality_keywords)

            if reality_is_positive and len(negative_signals) >= 2:
                alerts.append({
                    "source_id": f"proactive_counter_narrative_{user_id}",
                    "severity": "high",
                    "domain": "market",
                    "title": "Counter-narrative: market signals contradict stated reality",
                    "description": (
                        f"Your stated business reality includes positive indicators, but "
                        f"{len(negative_signals)} negative market signals have been detected "
                        f"in the last 14 days. This mismatch deserves investigation."
                    ),
                    "suggested_action": (
                        "Review recent market signals against your assumptions. "
                        "Consider whether your strategic thesis needs updating."
                    ),
                    "metadata": {
                        "negative_signal_count": len(negative_signals),
                        "total_market_signals": len(market_signals),
                    },
                })
        except Exception as e:
            logger.error(f"[proactive] _detect_counter_narrative failed: {e}")

        return alerts

    def _detect_compliance_deadlines(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Check regulatory_signals with compliance_deadline within 30 days.
        """
        alerts = []
        try:
            today = datetime.now(timezone.utc).date()
            deadline_cutoff = (today + timedelta(days=30)).isoformat()
            today_str = today.isoformat()

            result = self.sb.table("regulatory_signals").select(
                "id, title, severity, compliance_deadline, regulatory_body, action_required, status"
            ).eq("user_id", user_id).gte(
                "compliance_deadline", today_str
            ).lte(
                "compliance_deadline", deadline_cutoff
            ).execute()

            rows = result.data or []
            # Filter out already actioned/dismissed
            active = [r for r in rows if r.get("status") not in ("actioned", "dismissed")]

            for row in active:
                deadline = row.get("compliance_deadline", "unknown")
                reg_title = row.get("title", "Compliance deadline")
                reg_body = row.get("regulatory_body", "")
                reg_severity = row.get("severity", "medium")
                action_req = row.get("action_required", "")

                # Calculate days until deadline
                days_left = 30
                try:
                    dl_date = datetime.strptime(str(deadline), "%Y-%m-%d").date()
                    days_left = (dl_date - today).days
                except (ValueError, TypeError):
                    pass

                alerts.append({
                    "source_id": f"proactive_compliance_{user_id}_{row.get('id', '')}",
                    "severity": "critical" if days_left <= 7 else reg_severity,
                    "domain": "regulatory",
                    "title": f"Compliance deadline approaching: {reg_title}",
                    "description": (
                        f"Deadline: {deadline} ({days_left} days remaining). "
                        f"{'Body: ' + reg_body + '. ' if reg_body else ''}"
                        f"{'Action: ' + action_req if action_req else 'Review compliance requirements.'}"
                    ),
                    "suggested_action": (
                        action_req if action_req
                        else "Review the regulation and ensure compliance before the deadline."
                    ),
                    "metadata": {
                        "deadline": str(deadline),
                        "days_remaining": days_left,
                        "regulatory_body": reg_body,
                        "signal_id": row.get("id"),
                    },
                })
        except Exception as e:
            logger.error(f"[proactive] _detect_compliance_deadlines failed: {e}")

        return alerts

    def _detect_revenue_anomaly(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Compare finance events in last 7 days vs prior 7 days.
        If drop to zero, alert.
        """
        alerts = []
        try:
            now = datetime.now(timezone.utc)
            seven_ago = (now - timedelta(days=7)).isoformat()
            fourteen_ago = (now - timedelta(days=14)).isoformat()

            # Recent 7 days
            recent_result = self.sb.table("observation_events").select(
                "id, signal_type, detail", count="exact"
            ).eq("user_id", user_id).eq("domain", "finance").gte(
                "created_at", seven_ago
            ).execute()

            recent_count = recent_result.count or 0

            # Prior 7 days
            prior_result = self.sb.table("observation_events").select(
                "id, signal_type, detail", count="exact"
            ).eq("user_id", user_id).eq("domain", "finance").gte(
                "created_at", fourteen_ago
            ).lt("created_at", seven_ago).execute()

            prior_count = prior_result.count or 0

            # Revenue-specific signals
            recent_rows = recent_result.data or []
            revenue_signals = [
                r for r in recent_rows
                if any(kw in (r.get("signal_type") or "").lower()
                       for kw in ("revenue", "income", "payment", "invoice"))
            ]

            if prior_count > 0 and recent_count == 0:
                alerts.append({
                    "source_id": f"proactive_revenue_anomaly_{user_id}",
                    "severity": "critical",
                    "domain": "finance",
                    "title": "Revenue anomaly: finance signals dropped to zero",
                    "description": (
                        f"Finance domain had {prior_count} signal(s) in the prior "
                        f"7-day period but zero in the last 7 days. This may indicate "
                        f"a data sync issue or a genuine revenue interruption."
                    ),
                    "suggested_action": (
                        "Verify integration sync status first. If integrations are healthy, "
                        "investigate whether revenue activity has genuinely stopped."
                    ),
                    "metadata": {
                        "prior_count": prior_count,
                        "recent_count": recent_count,
                        "revenue_signals_recent": len(revenue_signals),
                    },
                })
            elif prior_count > 3 and recent_count <= 1 and len(revenue_signals) == 0:
                # Significant drop but not to zero
                alerts.append({
                    "source_id": f"proactive_revenue_anomaly_{user_id}",
                    "severity": "high",
                    "domain": "finance",
                    "title": "Revenue anomaly: significant drop in finance signals",
                    "description": (
                        f"Finance signals dropped from {prior_count} to {recent_count} "
                        f"week-over-week with no revenue-specific signals. "
                        f"Worth investigating."
                    ),
                    "suggested_action": (
                        "Check accounting and payment integrations. "
                        "Review invoice pipeline and expected payments."
                    ),
                    "metadata": {
                        "prior_count": prior_count,
                        "recent_count": recent_count,
                        "revenue_signals_recent": len(revenue_signals),
                    },
                })
        except Exception as e:
            logger.error(f"[proactive] _detect_revenue_anomaly failed: {e}")

        return alerts
