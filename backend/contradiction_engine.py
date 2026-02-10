"""
CONTRADICTION ENGINE — Misalignment Detection

Detects contradictions between declared intent and observed behaviour.
Contradiction is a fact, not an opinion.

This layer does NOT invent intent.
This layer does NOT infer motivation.
This layer does NOT speak to users.
This layer does NOT escalate directly.

It persists contradictions only when evidence converges.

DETECTION RULES:
  1. PRIORITY MISMATCH — domain is high-priority but position is elevated+ with no intervention
  2. ACTION VS INACTION — escalation repeated, user deferred/ignored, state worsens or stagnates
  3. REPEATED IGNORE — same domain escalated >=3 times without resolution
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)

CONTRADICTION_TYPES = frozenset(["priority_mismatch", "action_inaction", "repeated_ignore"])
ELEVATED_POSITIONS = frozenset(["ELEVATED", "DETERIORATING", "CRITICAL"])


class ContradictionEngine:

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def run_detection(
        self,
        user_id: str,
        positions: Dict[str, Any],
        intelligence_config: Optional[Dict[str, Any]],
        escalations: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Run all contradiction checks for a user.
        Called after Watchtower analysis completes.
        Returns list of contradictions detected (internal use only).
        """
        detected = []

        if not intelligence_config or not intelligence_config.get("domains"):
            return detected

        domains_config = intelligence_config.get("domains", {})
        escalation_by_domain = {e["domain"]: e for e in escalations if e.get("active")}

        for domain, config in domains_config.items():
            if not config.get("enabled"):
                continue

            pos_data = positions.get(domain)
            observed_state = pos_data.get("position") if pos_data else None
            esc = escalation_by_domain.get(domain)

            # 1. PRIORITY MISMATCH
            c = await self._check_priority_mismatch(user_id, domain, config, observed_state, esc)
            if c:
                detected.append(c)

            # 2. ACTION VS INACTION
            c = await self._check_action_inaction(user_id, domain, observed_state, esc)
            if c:
                detected.append(c)

            # 3. REPEATED IGNORE
            c = await self._check_repeated_ignore(user_id, domain, esc)
            if c:
                detected.append(c)

        # Resolve contradictions for domains that recovered to STABLE
        for domain in domains_config:
            pos_data = positions.get(domain)
            if pos_data and pos_data.get("position") == "STABLE":
                await self._resolve_domain(user_id, domain)

        return detected

    async def get_active_contradictions(self, user_id: str) -> List[Dict[str, Any]]:
        """Read active contradictions for Board Room prompt injection."""
        try:
            result = self.supabase.table("contradiction_memory").select("*").eq(
                "user_id", user_id
            ).eq("active", True).order("first_detected_at", desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.debug(f"[contradiction] Read failed: {e}")
            return []

    # ═══════════════════════════════════════════════════════════════
    # DETECTION
    # ═══════════════════════════════════════════════════════════════

    async def _check_priority_mismatch(
        self, user_id: str, domain: str, config: Dict, observed_state: Optional[str], esc: Optional[Dict]
    ) -> Optional[Dict]:
        """
        Domain is enabled and high-priority in intelligence_configuration.
        Watchtower position is ELEVATED or worse.
        No meaningful intervention detected over time window.
        """
        if observed_state not in ELEVATED_POSITIONS:
            return None

        # Check if this is a high-priority domain (threshold <= 0.7 or min_events <= 3)
        threshold = config.get("escalation_threshold", 0.7)
        if threshold > 0.75:
            return None  # Not high-priority enough

        # Check for lack of intervention: escalation exists and user hasn't acknowledged
        if esc and esc.get("last_user_action") == "acknowledged":
            return None  # User has acted

        declared = f"enabled, threshold={threshold}"
        return await self._persist(user_id, domain, declared, observed_state, "priority_mismatch")

    async def _check_action_inaction(
        self, user_id: str, domain: str, observed_state: Optional[str], esc: Optional[Dict]
    ) -> Optional[Dict]:
        """
        Escalation memory shows repeated detections.
        last_user_action = deferred or ignored.
        Observed state worsens or does not recover.
        """
        if not esc:
            return None

        action = esc.get("last_user_action", "unknown")
        if action not in ("deferred", "ignored"):
            return None

        times = esc.get("times_detected", 0)
        if times < 2:
            return None

        if observed_state not in ELEVATED_POSITIONS:
            return None  # Recovered — no contradiction

        declared = f"user action: {action}"
        return await self._persist(user_id, domain, declared, observed_state, "action_inaction")

    async def _check_repeated_ignore(
        self, user_id: str, domain: str, esc: Optional[Dict]
    ) -> Optional[Dict]:
        """
        Same domain escalated >= 3 times without resolution.
        """
        if not esc:
            return None

        times = esc.get("times_detected", 0)
        if times < 3:
            return None

        if not esc.get("active"):
            return None

        observed_state = esc.get("position", "ELEVATED")
        declared = f"escalated {times}x, still active"
        return await self._persist(user_id, domain, declared, observed_state, "repeated_ignore")

    # ═══════════════════════════════════════════════════════════════
    # PERSISTENCE
    # ═══════════════════════════════════════════════════════════════

    async def _persist(
        self, user_id: str, domain: str, declared: str, observed_state: str, contradiction_type: str
    ) -> Optional[Dict]:
        now = datetime.now(timezone.utc).isoformat()
        existing = await self._get_active(user_id, domain, contradiction_type)

        if existing:
            try:
                self.supabase.table("contradiction_memory").update({
                    "observed_state": observed_state,
                    "last_detected_at": now,
                    "times_detected": (existing.get("times_detected") or 0) + 1,
                }).eq("id", existing["id"]).execute()
                logger.info(f"[contradiction] {contradiction_type} incremented for {domain}")
                return existing
            except Exception as e:
                logger.error(f"[contradiction] Update failed: {e}")
                return None
        else:
            record = {
                "id": str(uuid4()),
                "user_id": user_id,
                "domain": domain,
                "declared_priority": declared,
                "observed_state": observed_state,
                "contradiction_type": contradiction_type,
                "first_detected_at": now,
                "last_detected_at": now,
                "times_detected": 1,
                "active": True,
            }
            try:
                result = self.supabase.table("contradiction_memory").insert(record).execute()
                logger.info(f"[contradiction] {contradiction_type} recorded for {domain}")
                return result.data[0] if result.data else record
            except Exception as e:
                logger.error(f"[contradiction] Insert failed: {e}")
                return None

    async def _resolve_domain(self, user_id: str, domain: str):
        """Mark all active contradictions for a domain as resolved."""
        try:
            self.supabase.table("contradiction_memory").update({
                "active": False,
            }).eq("user_id", user_id).eq("domain", domain).eq("active", True).execute()
        except Exception as e:
            logger.debug(f"[contradiction] Resolve failed: {e}")

    async def _get_active(self, user_id: str, domain: str, contradiction_type: str) -> Optional[Dict]:
        try:
            result = self.supabase.table("contradiction_memory").select("*").eq(
                "user_id", user_id
            ).eq("domain", domain).eq("contradiction_type", contradiction_type).eq(
                "active", True
            ).limit(1).execute()
            return result.data[0] if result.data else None
        except Exception:
            return None


# ═══════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════

_engine: Optional[ContradictionEngine] = None


def init_contradiction_engine(supabase_client) -> ContradictionEngine:
    global _engine
    _engine = ContradictionEngine(supabase_client)
    logger.info("[contradiction] Engine initialized")
    return _engine


def get_contradiction_engine() -> ContradictionEngine:
    if _engine is None:
        raise RuntimeError("Contradiction engine not initialized")
    return _engine
