"""
INTELLIGENCE BASELINE — Configuration Layer

Allows users to explicitly configure what BIQC monitors,
how often it briefs, and how aggressively it escalates.

This is NOT calibration. This is NOT strategy extraction.
This is intelligence configuration.

Does NOT infer preferences.
Does NOT extract configuration from chat.
Does NOT modify Watchtower logic.
"""

from datetime import datetime, timezone
from typing import Dict, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)

DEFAULT_BASELINE = {
    "monitored_domains": {
        "finance": True,
        "sales": True,
        "operations": True,
        "team": False,
        "market": False,
    },
    "financial_signals": {
        "cash_runway": True,
        "invoice_overdue": True,
        "revenue_decline": True,
    },
    "sales_focus": {
        "deal_stall": True,
        "pipeline_decay": True,
        "response_delay": True,
        "thread_silence": True,
    },
    "client_risk_sensitivity": "medium",       # low | medium | high
    "team_risk_sensitivity": "medium",          # low | medium | high
    "external_signals": {
        "competitors": [],
        "regulatory_sensitivity": "low",        # low | medium | high
    },
    "growth_vs_efficiency": "balanced",         # growth | balanced | efficiency
    "time_horizon": "quarterly",                # weekly | monthly | quarterly | annual
    "briefing_frequency": "weekly",             # daily | weekly | fortnightly | monthly
    "briefing_time_of_day": "morning",          # morning | midday | evening
    "alert_tolerance": "moderate",              # silent | moderate | aggressive
    "escalation_thresholds": {
        "finance": 0.70,
        "sales": 0.70,
        "operations": 0.60,
        "team": 0.80,
        "market": 0.80,
    },
    "regions": [],
    "trusted_data_sources": [],
    "blind_spots": [],
    "optimisation_outcomes": [],
}


class IntelligenceBaseline:

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def get_baseline(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Read the user's intelligence baseline."""
        try:
            result = self.supabase.table("intelligence_baseline").select("*").eq(
                "user_id", user_id
            ).order("updated_at", desc=True).limit(1).execute()
            if result.data:
                return result.data[0]
            return None
        except Exception as e:
            logger.debug(f"[baseline] Read failed: {e}")
            return None

    async def save_baseline(self, user_id: str, baseline: Dict[str, Any]) -> Dict[str, Any]:
        """
        Persist baseline on explicit user confirmation.
        Also syncs intelligence_configuration to business_profiles.
        """
        now = datetime.now(timezone.utc).isoformat()
        existing = await self.get_baseline(user_id)

        if existing:
            try:
                self.supabase.table("intelligence_baseline").update({
                    "baseline": baseline,
                    "updated_at": now,
                }).eq("id", existing["id"]).execute()
            except Exception as e:
                logger.error(f"[baseline] Update failed: {e}")
                raise
        else:
            record = {
                "id": str(uuid4()),
                "user_id": user_id,
                "baseline": baseline,
                "created_at": now,
                "updated_at": now,
            }
            try:
                self.supabase.table("intelligence_baseline").insert(record).execute()
            except Exception as e:
                logger.error(f"[baseline] Insert failed: {e}")
                raise

        # Sync to business_profiles.intelligence_configuration
        await self._sync_intelligence_config(user_id, baseline)

        logger.info(f"[baseline] Saved for user {user_id}")
        return baseline

    async def get_defaults(self) -> Dict[str, Any]:
        """Return default baseline structure."""
        return DEFAULT_BASELINE.copy()

    async def _sync_intelligence_config(self, user_id: str, baseline: Dict[str, Any]):
        """
        Translate baseline into intelligence_configuration on business_profiles.
        This drives Watchtower domain activation and thresholds.
        """
        monitored = baseline.get("monitored_domains", {})
        thresholds = baseline.get("escalation_thresholds", {})
        alert_tolerance = baseline.get("alert_tolerance", "moderate")

        # Map alert tolerance to min_events
        min_events_map = {"silent": 5, "moderate": 3, "aggressive": 2}
        min_events = min_events_map.get(alert_tolerance, 3)

        # Map briefing frequency to window hours
        freq = baseline.get("briefing_frequency", "weekly")
        window_map = {"daily": 48, "weekly": 168, "fortnightly": 336, "monthly": 720}
        window_hours = window_map.get(freq, 168)

        domains = {}
        for domain in ["finance", "sales", "operations", "team", "market"]:
            enabled = monitored.get(domain, False)
            threshold = thresholds.get(domain, 0.70)
            domains[domain] = {
                "enabled": enabled,
                "escalation_threshold": threshold,
                "window_hours": window_hours,
                "min_events": min_events,
            }

        config = {"domains": domains}

        try:
            # Upsert to business_profiles
            existing = self.supabase.table("business_profiles").select("id").eq(
                "user_id", user_id
            ).limit(1).execute()

            if existing.data:
                self.supabase.table("business_profiles").update({
                    "intelligence_configuration": config,
                }).eq("user_id", user_id).execute()
            else:
                self.supabase.table("business_profiles").insert({
                    "user_id": user_id,
                    "intelligence_configuration": config,
                }).execute()

            logger.info(f"[baseline] Synced intelligence_configuration for {user_id}")
        except Exception as e:
            logger.error(f"[baseline] Config sync failed: {e}")


# ═══════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════

_baseline: Optional[IntelligenceBaseline] = None


def init_intelligence_baseline(supabase_client) -> IntelligenceBaseline:
    global _baseline
    _baseline = IntelligenceBaseline(supabase_client)
    logger.info("[baseline] Intelligence Baseline initialized")
    return _baseline


def get_intelligence_baseline() -> IntelligenceBaseline:
    if _baseline is None:
        raise RuntimeError("Intelligence baseline not initialized")
    return _baseline
