"""
WATCHTOWER ENGINE — Continuous Business Intelligence Authority

This module is the execution core of the Watchtower system.
It does NOT speak to users. It does NOT generate conversational output.
It observes, evaluates, and persists positions.

INPUTS (read-only):
  - business_profiles.intelligence_configuration
  - observation_events
  - cognitive_profiles (optional, weighting only)

OUTPUTS (append-only):
  - watchtower_insights (position changes and material findings)

EXECUTION MODES:
  1. Event-driven: triggered when new observation_events arrive
  2. Scheduled: periodic scan for drift, decay, or recovery

In both cases, behaviour is identical.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)

VALID_DOMAINS = frozenset(["finance", "sales", "operations", "team", "market"])
POSITIONS = ["STABLE", "ELEVATED", "DETERIORATING", "CRITICAL"]
SEVERITY_WEIGHTS = {"critical": 3, "warning": 1, "info": 0}


class WatchtowerEngine:
    """
    Continuous Business Intelligence Authority.

    Maintains domain positions based on sustained evidence.
    Silence is the default state. Escalation is rare and justified.
    """

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    # ═══════════════════════════════════════════════════════════════
    # PUBLIC API
    # ═══════════════════════════════════════════════════════════════

    async def run_analysis(self, user_id: str) -> Dict[str, Any]:
        """
        Main entry point. Runs a full analysis cycle for one user.

        1. Load intelligence_configuration
        2. For each enabled domain:
           a. Load observation_events within the configured window
           b. Load current position
           c. Evaluate position based on sustained evidence
           d. If position changed → persist finding
           e. If no change → do nothing
        3. Return summary (internal use only)
        """
        config = await self._load_intelligence_configuration(user_id)
        if not config:
            return {"status": "no_configuration", "domains_evaluated": 0}

        domains_config = config.get("domains", {})
        if not domains_config:
            return {"status": "no_domains_configured", "domains_evaluated": 0}

        cognitive_lens = await self._load_cognitive_lens(user_id)

        results = []
        for domain, domain_config in domains_config.items():
            if domain not in VALID_DOMAINS:
                continue
            if not domain_config.get("enabled", False):
                continue

            outcome = await self._evaluate_domain(
                user_id, domain, domain_config, cognitive_lens
            )
            if outcome:
                results.append(outcome)

        # ─── Contradiction detection (post-analysis) ─────────
        contradictions_found = 0
        try:
            from contradiction_engine import get_contradiction_engine
            from escalation_memory import get_escalation_memory
            ce = get_contradiction_engine()
            mem = get_escalation_memory()
            positions = await self.get_positions(user_id)
            escalations = await mem.get_active_escalations(user_id)
            contradictions = await ce.run_detection(user_id, positions, config, escalations)
            contradictions_found = len(contradictions)
        except RuntimeError:
            pass

        # ─── Pressure calibration (post-contradiction) ────────
        pressure_changes = 0
        try:
            from pressure_calibration import get_pressure_calibration
            pc = get_pressure_calibration()
            active_contras = []
            try:
                active_contras = await ce.get_active_contradictions(user_id)
            except Exception:
                pass
            changes = await pc.run_calibration(
                user_id, positions, escalations, active_contras
            )
            pressure_changes = len(changes)
        except RuntimeError:
            pass

        # ─── Evidence freshness (post-pressure) ──────────────
        freshness_changes = 0
        try:
            from evidence_freshness import get_evidence_freshness
            ef = get_evidence_freshness()
            all_findings = await self.get_findings(user_id, limit=20)
            fchanges = await ef.run_freshness_check(user_id, positions, all_findings)
            freshness_changes = len(fchanges)
        except RuntimeError:
            pass

        return {
            "status": "complete",
            "domains_evaluated": len([d for d in domains_config.values() if d.get("enabled")]),
            "position_changes": len(results),
            "findings": results,
            "contradictions_detected": contradictions_found,
            "pressure_changes": pressure_changes,
            "freshness_changes": freshness_changes,
        }

    async def emit_event(
        self,
        user_id: str,
        domain: str,
        event_type: str,
        payload: Dict[str, Any],
        source: str,
        severity: str = "info",
        observed_at: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Emit an observation event.
        Called by integrations when they detect a factual signal.
        """
        if domain not in VALID_DOMAINS:
            logger.warning(f"[watchtower] Invalid domain: {domain}")
            return None
        if severity not in SEVERITY_WEIGHTS:
            severity = "info"

        event = {
            "id": str(uuid4()),
            "user_id": user_id,
            "domain": domain,
            "event_type": event_type,
            "payload": payload,
            "source": source,
            "severity": severity,
            "observed_at": observed_at or datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            result = self.supabase.table("observation_events").insert(event).execute()
            return result.data[0] if result.data else event
        except Exception as e:
            logger.error(f"[watchtower] Failed to emit event: {e}")
            return None

    async def get_positions(self, user_id: str) -> Dict[str, Any]:
        """
        Read current positions for all domains.
        Returns the most recent position per domain.
        """
        positions = {}
        for domain in VALID_DOMAINS:
            position = await self._get_current_position(user_id, domain)
            if position:
                positions[domain] = position

        return positions

    async def get_findings(
        self, user_id: str, domain: Optional[str] = None, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Read historical findings (watchtower_insights).
        """
        try:
            query = (
                self.supabase.table("watchtower_insights")
                .select("*")
                .eq("user_id", user_id)
                .order("detected_at", desc=True)
                .limit(limit)
            )
            if domain and domain in VALID_DOMAINS:
                query = query.eq("domain", domain)

            result = query.execute()
            return result.data or []
        except Exception as e:
            logger.error(f"[watchtower] Failed to read findings: {e}")
            return []

    # ═══════════════════════════════════════════════════════════════
    # INTERNAL: DOMAIN EVALUATION
    # ═══════════════════════════════════════════════════════════════

    async def _evaluate_domain(
        self,
        user_id: str,
        domain: str,
        domain_config: Dict[str, Any],
        cognitive_lens: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluate a single domain.
        Returns a finding dict if position changed, None if silent.
        """
        window_hours = domain_config.get("window_hours", 168)
        min_events = domain_config.get("min_events", 3)
        escalation_threshold = domain_config.get("escalation_threshold", 0.7)

        events = await self._load_events(user_id, domain, window_hours)
        current = await self._get_current_position(user_id, domain)
        current_position = current.get("position") if current else None

        # ─── Silence detection ────────────────────────────────────
        # If no events and position was elevated+, check for decay/recovery
        if not events:
            if current_position and current_position != "STABLE":
                # Silence where activity was expected.
                # Check how long since last event.
                last_event_age = await self._hours_since_last_event(user_id, domain)
                if last_event_age and last_event_age > window_hours * 2:
                    # Extended silence after prior activity → recovery signal
                    return await self._persist_finding(
                        user_id=user_id,
                        domain=domain,
                        new_position="STABLE",
                        previous_position=current_position,
                        finding=f"Extended silence ({int(last_event_age)}h) following prior {current_position} state. Recovery assumed.",
                        confidence=0.6,
                        source_event_ids=[],
                    )
            # No events, stable or no prior → silence is correct
            return None

        # ─── Minimum event threshold ─────────────────────────────
        if len(events) < min_events:
            # Not enough sustained evidence to form a position
            return None

        # ─── Score calculation (window-based, not event-based) ────
        new_position, confidence, finding = self._compute_position(
            events, domain, current_position, escalation_threshold, cognitive_lens
        )

        # ─── Position change check ────────────────────────────────
        if new_position == current_position:
            return None  # No change. Silence.

        if new_position is None:
            return None

        source_ids = [e.get("id") for e in events if e.get("id")]

        return await self._persist_finding(
            user_id=user_id,
            domain=domain,
            new_position=new_position,
            previous_position=current_position,
            finding=finding,
            confidence=confidence,
            source_event_ids=source_ids[:20],  # cap at 20
        )

    def _compute_position(
        self,
        events: List[Dict[str, Any]],
        domain: str,
        current_position: Optional[str],
        escalation_threshold: float,
        cognitive_lens: Dict[str, Any],
    ) -> tuple:
        """
        Derive position from events using window-based analysis.

        Returns: (position, confidence, finding_text)

        Logic:
        1. Score events by severity within the window
        2. Split window into halves to detect trend
        3. Apply cognitive weighting
        4. Map to position
        """
        total = len(events)
        total_score = sum(SEVERITY_WEIGHTS.get(e.get("severity", "info"), 0) for e in events)

        # ─── Trend analysis: recent half vs older half ────────────
        mid = total // 2
        recent_events = events[:mid] if mid > 0 else events
        older_events = events[mid:] if mid > 0 else []

        recent_score = sum(SEVERITY_WEIGHTS.get(e.get("severity", "info"), 0) for e in recent_events)
        older_score = sum(SEVERITY_WEIGHTS.get(e.get("severity", "info"), 0) for e in older_events)

        if older_score > 0 and recent_score > older_score * 1.3:
            trend = "worsening"
        elif older_score > 0 and recent_score < older_score * 0.7:
            trend = "improving"
        else:
            trend = "stable"

        # ─── Normalize score to 0-1 ──────────────────────────────
        max_possible = total * 3  # all events critical
        intensity = total_score / max_possible if max_possible > 0 else 0

        # ─── Severity distribution ────────────────────────────────
        critical_count = sum(1 for e in events if e.get("severity") == "critical")
        warning_count = sum(1 for e in events if e.get("severity") == "warning")
        critical_ratio = critical_count / total if total > 0 else 0

        # ─── Map to position ─────────────────────────────────────
        if intensity >= 0.75 or critical_ratio >= 0.5:
            raw_position = "CRITICAL"
        elif intensity >= 0.45 or critical_ratio >= 0.25:
            raw_position = "DETERIORATING"
        elif intensity >= 0.15 or warning_count >= 2:
            raw_position = "ELEVATED"
        else:
            raw_position = "STABLE"

        # ─── Apply trend adjustment ──────────────────────────────
        position = raw_position
        if trend == "worsening" and position != "CRITICAL":
            idx = POSITIONS.index(position)
            position = POSITIONS[min(idx + 1, 3)]
        elif trend == "improving" and position != "STABLE":
            idx = POSITIONS.index(position)
            position = POSITIONS[max(idx - 1, 0)]

        # ─── Apply cognitive weighting (optional) ─────────────────
        position = self._apply_cognitive_weight(position, domain, cognitive_lens)

        # ─── Confidence calculation ──────────────────────────────
        # Higher confidence when: more events, consistent signals, clear trend
        event_volume_factor = min(total / 10, 1.0) * 0.4
        consistency_factor = (1.0 - (warning_count / total if total > 0 else 0)) * 0.3
        trend_factor = (0.3 if trend != "stable" else 0.15)
        confidence = round(min(event_volume_factor + consistency_factor + trend_factor, 0.99), 3)

        # ─── Build finding text ──────────────────────────────────
        event_types = {}
        for e in events:
            et = e.get("event_type", "unknown")
            event_types[et] = event_types.get(et, 0) + 1
        top_types = sorted(event_types.items(), key=lambda x: x[1], reverse=True)[:3]
        types_desc = ", ".join(f"{t}({c})" for t, c in top_types)

        finding = (
            f"{domain.capitalize()} position: {position}. "
            f"{total} events over window ({types_desc}). "
            f"Trend: {trend}. "
            f"Critical: {critical_count}, Warning: {warning_count}."
        )

        return position, confidence, finding

    def _apply_cognitive_weight(
        self, position: str, domain: str, cognitive_lens: Dict[str, Any]
    ) -> str:
        """
        Apply cognitive profile weighting to adjust position.
        Behavioural patterns can escalate but never fabricate.
        """
        if not cognitive_lens:
            return position

        behaviour = cognitive_lens.get("behavioural_truth", {})
        reality = cognitive_lens.get("immutable_reality", {})

        escalate = False

        # Finance domain: cashflow-sensitive users escalate faster
        if domain == "finance" and reality.get("cashflow_sensitivity") in ("high", "critical"):
            escalate = True

        # Operations domain: time-scarce users escalate faster
        if domain == "operations" and reality.get("time_scarcity") in ("high", "very_high"):
            escalate = True

        # Team domain: low stress tolerance escalates faster
        if domain == "team" and behaviour.get("stress_tolerance") == "low":
            escalate = True

        if escalate and position != "CRITICAL":
            idx = POSITIONS.index(position)
            return POSITIONS[min(idx + 1, 3)]

        return position

    # ═══════════════════════════════════════════════════════════════
    # INTERNAL: DATA ACCESS
    # ═══════════════════════════════════════════════════════════════

    async def _load_intelligence_configuration(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Load intelligence_configuration from business_profiles."""
        try:
            result = (
                self.supabase.table("business_profiles")
                .select("intelligence_configuration")
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            if result.data:
                config = result.data.get("intelligence_configuration")
                if config and isinstance(config, dict) and config.get("domains"):
                    return config
            return None
        except Exception as e:
            logger.debug(f"[watchtower] No intelligence config for {user_id}: {e}")
            return None

    async def _load_events(
        self, user_id: str, domain: str, window_hours: int
    ) -> List[Dict[str, Any]]:
        """Load observation_events within the time window, ordered newest first."""
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()
        try:
            result = (
                self.supabase.table("observation_events")
                .select("*")
                .eq("user_id", user_id)
                .eq("domain", domain)
                .gte("observed_at", cutoff)
                .order("observed_at", desc=True)
                .limit(500)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"[watchtower] Failed to load events for {domain}: {e}")
            return []

    async def _get_current_position(
        self, user_id: str, domain: str
    ) -> Optional[Dict[str, Any]]:
        """Get the most recent position for a domain."""
        try:
            result = (
                self.supabase.table("watchtower_insights")
                .select("position, detected_at, finding, confidence")
                .eq("user_id", user_id)
                .eq("domain", domain)
                .order("detected_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0]
            return None
        except Exception as e:
            logger.debug(f"[watchtower] No prior position for {domain}: {e}")
            return None

    async def _hours_since_last_event(
        self, user_id: str, domain: str
    ) -> Optional[float]:
        """How many hours since the last observation_event in this domain."""
        try:
            result = (
                self.supabase.table("observation_events")
                .select("observed_at")
                .eq("user_id", user_id)
                .eq("domain", domain)
                .order("observed_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                last = result.data[0].get("observed_at")
                if last:
                    last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
                    delta = datetime.now(timezone.utc) - last_dt
                    return delta.total_seconds() / 3600
            return None
        except Exception:
            return None

    async def _load_cognitive_lens(self, user_id: str) -> Dict[str, Any]:
        """Load cognitive_profiles for behavioural weighting. Optional."""
        try:
            result = (
                self.supabase.table("cognitive_profiles")
                .select("immutable_reality, behavioural_truth")
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            if result.data:
                return {
                    "immutable_reality": result.data.get("immutable_reality") or {},
                    "behavioural_truth": result.data.get("behavioural_truth") or {},
                }
            return {}
        except Exception:
            return {}

    async def _persist_finding(
        self,
        user_id: str,
        domain: str,
        new_position: str,
        previous_position: Optional[str],
        finding: str,
        confidence: float,
        source_event_ids: List[str],
    ) -> Dict[str, Any]:
        """
        Persist a finding to watchtower_insights.
        Append-only. Never overwrite history.
        """
        now = datetime.now(timezone.utc).isoformat()

        insight = {
            "id": str(uuid4()),
            "user_id": user_id,
            "domain": domain,
            "position": new_position,
            "previous_position": previous_position,
            "finding": finding,
            "confidence": confidence,
            "source_event_ids": source_event_ids,
            "detected_at": now,
            "created_at": now,
        }

        try:
            result = self.supabase.table("watchtower_insights").insert(insight).execute()
            logger.info(
                f"[watchtower] {domain}: {previous_position or 'NEW'} → {new_position} "
                f"(confidence: {confidence})"
            )

            # ─── Escalation Memory: record position change ───────
            try:
                from escalation_memory import get_escalation_memory
                mem = get_escalation_memory()
                if new_position == "STABLE":
                    await mem.record_recovery(user_id, domain)
                else:
                    await mem.record_escalation(user_id, domain, new_position)
            except RuntimeError:
                pass  # Memory not initialized — non-fatal

            # ─── Bridge: auto-generate intelligence action ───────
            try:
                from intelligence_bridge import bridge_watchtower_to_actions
                await bridge_watchtower_to_actions(self.supabase, user_id, {
                    "id": insight["id"],
                    "domain": domain,
                    "old_position": previous_position,
                    "new_position": new_position,
                    "reason": finding,
                })
            except Exception as bridge_err:
                logger.warning(f"[watchtower] Bridge failed (non-blocking): {bridge_err}")

            return result.data[0] if result.data else insight
        except Exception as e:
            logger.error(f"[watchtower] Failed to persist finding: {e}")
            return insight


# ═══════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════

_engine: Optional[WatchtowerEngine] = None


def init_watchtower_engine(supabase_client) -> WatchtowerEngine:
    """Initialize the Watchtower engine with a Supabase client."""
    global _engine
    _engine = WatchtowerEngine(supabase_client)
    logger.info("[watchtower] Engine initialized")
    return _engine


def get_watchtower_engine() -> WatchtowerEngine:
    """Get the Watchtower engine instance."""
    if _engine is None:
        raise RuntimeError("Watchtower engine not initialized. Call init_watchtower_engine first.")
    return _engine
