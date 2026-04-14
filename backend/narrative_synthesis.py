"""
NARRATIVE SYNTHESIS ENGINE — Strategic Report Generation

Gathers multi-source intelligence and synthesises it into structured
weekly narratives. Pure data synthesis — no LLM calls.

INPUTS (read-only):
  - observation_events
  - intelligence_actions
  - predictions
  - decision_log
  - cognitive_profiles (delivery_preference)

OUTPUTS (upsert):
  - strategic_narratives
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)

DEFAULT_DELIVERY = {
    "style": "professional",
    "length": "medium",
    "tone": "balanced",
}


class NarrativeSynthesisEngine:
    """
    Generates strategic narrative reports from multi-source intelligence.
    All synthesis is deterministic — no LLM dependency.
    """

    def __init__(self, sb_client):
        self.sb = sb_client

    # ═══════════════════════════════════════════════════════════════
    # PUBLIC API
    # ═══════════════════════════════════════════════════════════════

    def generate_weekly_narrative(self, user_id: str) -> Dict[str, Any]:
        """
        Build a weekly strategic narrative for the user.

        Steps:
          1. Gather context from the last 7 days
          2. Load delivery preference from cognitive_profiles
          3. Synthesise the narrative (pure data, no LLM)
          4. Upsert to strategic_narratives table

        Returns the narrative dict.
        """
        try:
            now = datetime.now(timezone.utc)
            period_end = now
            period_start = now - timedelta(days=7)

            context = self._gather_week_context(
                user_id,
                period_start.isoformat(),
                period_end.isoformat(),
            )
            delivery = self._get_delivery_preference(user_id)
            narrative = self._synthesize_narrative(
                context=context,
                delivery=delivery,
                period_type="weekly",
                period_start=period_start.isoformat(),
                period_end=period_end.isoformat(),
            )

            # Persist
            record = {
                "id": str(uuid4()),
                "user_id": user_id,
                "period_type": "weekly",
                "period_start": period_start.strftime("%Y-%m-%d"),
                "period_end": period_end.strftime("%Y-%m-%d"),
                "narrative": narrative,
                "context_summary": {
                    "completeness": context.get("completeness", 0),
                    "event_count": context.get("event_count", 0),
                    "alert_count": context.get("alert_count", 0),
                    "domains": context.get("domains", []),
                },
                "delivery_preference": delivery,
                "generated_at": now.isoformat(),
            }

            self.sb.table("strategic_narratives").upsert(
                record,
                on_conflict="user_id,period_type,period_start",
            ).execute()

            logger.info(
                "[narrative_synthesis] Weekly narrative generated for user=%s "
                "(%d events, %d alerts, completeness=%.1f)",
                user_id,
                context.get("event_count", 0),
                context.get("alert_count", 0),
                context.get("completeness", 0),
            )
            return narrative

        except Exception as exc:
            logger.error(
                "[narrative_synthesis] generate_weekly_narrative failed: %s", exc
            )
            return {"error": str(exc)}

    # ═══════════════════════════════════════════════════════════════
    # CONTEXT GATHERING
    # ═══════════════════════════════════════════════════════════════

    def _gather_week_context(
        self, user_id: str, start: str, end: str
    ) -> Dict[str, Any]:
        """
        Gather intelligence from four sources, filtered by date range.

        Sources:
          1. observation_events — signals grouped by domain
          2. intelligence_actions — alerts with severity
          3. predictions — latest prediction scores
          4. decision_log — decisions made in the period

        Returns a context dict with aggregated stats.
        """
        events = self._fetch_observation_events(user_id, start, end)
        actions = self._fetch_intelligence_actions(user_id, start, end)
        predictions = self._fetch_predictions(user_id, start, end)
        decisions = self._fetch_decisions(user_id, start, end)

        # Group signals by domain
        domain_signals: Dict[str, List[Dict]] = {}
        for evt in events:
            domain = evt.get("domain") or "unknown"
            if domain not in domain_signals:
                domain_signals[domain] = []
            domain_signals[domain].append(evt)

        domains = sorted(domain_signals.keys())

        # Count alerts
        alert_count = len(actions)
        critical_alerts = sum(
            1 for a in actions if (a.get("severity") or "").lower() == "critical"
        )

        # Completeness: 0-1 based on how many of the 4 sources have data
        sources_with_data = sum([
            1 if events else 0,
            1 if actions else 0,
            1 if predictions else 0,
            1 if decisions else 0,
        ])
        completeness = round(sources_with_data / 4, 2)

        return {
            "events": events,
            "actions": actions,
            "predictions": predictions,
            "decisions": decisions,
            "domain_signals": domain_signals,
            "domains": domains,
            "completeness": completeness,
            "event_count": len(events),
            "alert_count": alert_count,
            "critical_alerts": critical_alerts,
        }

    # ═══════════════════════════════════════════════════════════════
    # DELIVERY PREFERENCE
    # ═══════════════════════════════════════════════════════════════

    def _get_delivery_preference(self, user_id: str) -> Dict[str, str]:
        """
        Load cognitive_profiles.delivery_preference for the user.
        Falls back to professional / medium / balanced.
        """
        try:
            result = (
                self.sb.table("cognitive_profiles")
                .select("delivery_preference")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            rows = result.data or []
            if not rows:
                return dict(DEFAULT_DELIVERY)

            pref = rows[0].get("delivery_preference") or {}
            return {
                "style": pref.get("style", DEFAULT_DELIVERY["style"]),
                "length": pref.get("length", DEFAULT_DELIVERY["length"]),
                "tone": pref.get("tone", DEFAULT_DELIVERY["tone"]),
            }

        except Exception as exc:
            logger.debug(
                "[narrative_synthesis] delivery_preference lookup failed: %s", exc
            )
            return dict(DEFAULT_DELIVERY)

    # ═══════════════════════════════════════════════════════════════
    # NARRATIVE SYNTHESIS (pure data — no LLM)
    # ═══════════════════════════════════════════════════════════════

    def _synthesize_narrative(
        self,
        context: Dict[str, Any],
        delivery: Dict[str, str],
        period_type: str,
        period_start: str,
        period_end: str,
    ) -> Dict[str, Any]:
        """
        Build a structured narrative from context WITHOUT an LLM.

        Sections:
          - executive_summary
          - narrative (multi-sentence, per-domain)
          - key_developments (top 5 signal domains by count)
          - signal_summary ({domain: "N events"})
          - risk_assessment
          - recommended_actions
        """
        domain_signals = context.get("domain_signals", {})
        domains = context.get("domains", [])
        event_count = context.get("event_count", 0)
        alert_count = context.get("alert_count", 0)
        critical_alerts = context.get("critical_alerts", 0)
        completeness = context.get("completeness", 0)
        decisions = context.get("decisions", [])

        # --- Executive summary ---
        domain_list = ", ".join(domains) if domains else "no domains"
        executive_summary = (
            f"{event_count} signals across {domain_list}. "
            f"{critical_alerts} critical alerts."
        )

        # --- Per-domain narrative ---
        narrative_parts = []
        for domain in domains:
            signals = domain_signals.get(domain, [])
            count = len(signals)
            severities = [s.get("severity", "info") for s in signals]
            critical_count = severities.count("critical")
            warning_count = severities.count("warning")

            sentence = f"{domain.capitalize()}: {count} event(s)"
            if critical_count:
                sentence += f" including {critical_count} critical"
            if warning_count:
                sentence += f" and {warning_count} warning(s)"
            sentence += "."
            narrative_parts.append(sentence)

        if decisions:
            narrative_parts.append(
                f"{len(decisions)} decision(s) were logged during this period."
            )

        if not narrative_parts:
            narrative_parts.append("No significant activity recorded this period.")

        narrative_text = " ".join(narrative_parts)

        # --- Key developments (top 5 domains by event count) ---
        sorted_domains = sorted(
            domain_signals.items(), key=lambda x: len(x[1]), reverse=True
        )
        key_developments = [
            {"domain": d, "event_count": len(sigs)}
            for d, sigs in sorted_domains[:5]
        ]

        # --- Signal summary ---
        signal_summary = {
            domain: f"{len(sigs)} events"
            for domain, sigs in domain_signals.items()
        }

        # --- Risk assessment ---
        if critical_alerts > 0:
            overall_risk = "high"
        elif alert_count > 5:
            overall_risk = "medium"
        else:
            overall_risk = "low"

        risk_assessment = {
            "overall": overall_risk,
            "critical_alerts": critical_alerts,
            "total_alerts": alert_count,
        }

        # --- Recommended actions ---
        recommended_actions = []
        if completeness < 0.5:
            recommended_actions.append(
                "Connect more data sources to improve intelligence completeness "
                f"(currently {int(completeness * 100)}%)."
            )
        if critical_alerts > 0:
            recommended_actions.append(
                f"Review {critical_alerts} critical alert(s) immediately."
            )
        if not decisions and event_count > 10:
            recommended_actions.append(
                "Consider logging decisions — high signal volume with no "
                "recorded decisions may indicate untracked choices."
            )
        if not recommended_actions:
            recommended_actions.append("No urgent actions required.")

        return {
            "period_type": period_type,
            "period_start": period_start,
            "period_end": period_end,
            "executive_summary": executive_summary,
            "narrative": narrative_text,
            "key_developments": key_developments,
            "signal_summary": signal_summary,
            "risk_assessment": risk_assessment,
            "recommended_actions": recommended_actions,
            "delivery_style": delivery.get("style", "professional"),
            "completeness": completeness,
        }

    # ═══════════════════════════════════════════════════════════════
    # DATA FETCHERS
    # ═══════════════════════════════════════════════════════════════

    def _fetch_observation_events(
        self, user_id: str, start: str, end: str
    ) -> List[Dict[str, Any]]:
        """Fetch observation_events in the date range."""
        try:
            result = (
                self.sb.table("observation_events")
                .select("id, domain, signal_type, summary, severity, created_at")
                .eq("user_id", user_id)
                .gte("created_at", start)
                .lte("created_at", end)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as exc:
            logger.error(
                "[narrative_synthesis] fetch observation_events failed: %s", exc
            )
            return []

    def _fetch_intelligence_actions(
        self, user_id: str, start: str, end: str
    ) -> List[Dict[str, Any]]:
        """Fetch intelligence_actions (alerts) in the date range."""
        try:
            result = (
                self.sb.table("intelligence_actions")
                .select("id, action_type, severity, summary, created_at")
                .eq("user_id", user_id)
                .gte("created_at", start)
                .lte("created_at", end)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as exc:
            logger.error(
                "[narrative_synthesis] fetch intelligence_actions failed: %s", exc
            )
            return []

    def _fetch_predictions(
        self, user_id: str, start: str, end: str
    ) -> List[Dict[str, Any]]:
        """Fetch predictions in the date range."""
        try:
            result = (
                self.sb.table("predictions")
                .select("id, prediction_type, score, confidence, created_at")
                .eq("user_id", user_id)
                .gte("created_at", start)
                .lte("created_at", end)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as exc:
            logger.error(
                "[narrative_synthesis] fetch predictions failed: %s", exc
            )
            return []

    def _fetch_decisions(
        self, user_id: str, start: str, end: str
    ) -> List[Dict[str, Any]]:
        """Fetch decisions logged in the date range."""
        try:
            result = (
                self.sb.table("decision_log")
                .select("id, title, domain, decision_type, status, created_at")
                .eq("user_id", user_id)
                .gte("created_at", start)
                .lte("created_at", end)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as exc:
            logger.error(
                "[narrative_synthesis] fetch decision_log failed: %s", exc
            )
            return []
