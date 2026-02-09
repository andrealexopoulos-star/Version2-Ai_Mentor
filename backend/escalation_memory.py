"""
ESCALATION MEMORY — Persistence Layer

Remembers what risks were raised, when, whether acted on or ignored,
and whether the same risk reappeared.

This layer does NOT add intelligence.
This layer does NOT decide severity.
This layer does NOT speak to users.

It persists facts only.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)


class EscalationMemory:

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    # ═══════════════════════════════════════════════════════════════
    # WRITE: Called by Watchtower Engine on position changes
    # ═══════════════════════════════════════════════════════════════

    async def record_escalation(self, user_id: str, domain: str, position: str):
        """
        Called when Watchtower promotes a domain above STABLE.
        Creates or increments an escalation record.
        """
        if position == "STABLE":
            return

        now = datetime.now(timezone.utc).isoformat()
        existing = await self._get_active(user_id, domain)

        if existing:
            try:
                self.supabase.table("escalation_memory").update({
                    "position": position,
                    "last_detected_at": now,
                    "times_detected": (existing.get("times_detected") or 0) + 1,
                }).eq("id", existing["id"]).execute()
            except Exception as e:
                logger.error(f"[escalation_memory] Update failed: {e}")
        else:
            try:
                self.supabase.table("escalation_memory").insert({
                    "id": str(uuid4()),
                    "user_id": user_id,
                    "domain": domain,
                    "position": position,
                    "first_detected_at": now,
                    "last_detected_at": now,
                    "times_detected": 1,
                    "last_user_action": "unknown",
                    "active": True,
                }).execute()
            except Exception as e:
                logger.error(f"[escalation_memory] Insert failed: {e}")

    async def record_recovery(self, user_id: str, domain: str):
        """
        Called when Watchtower reports recovery to STABLE.
        Marks the active escalation as resolved.
        """
        existing = await self._get_active(user_id, domain)
        if not existing:
            return

        now = datetime.now(timezone.utc).isoformat()
        try:
            self.supabase.table("escalation_memory").update({
                "active": False,
                "resolved_at": now,
                "position": "STABLE",
            }).eq("id", existing["id"]).execute()
        except Exception as e:
            logger.error(f"[escalation_memory] Recovery update failed: {e}")

    # ═══════════════════════════════════════════════════════════════
    # WRITE: Called by Board Room when a risk is surfaced
    # ═══════════════════════════════════════════════════════════════

    async def record_exposure(self, user_id: str, domain: str):
        """
        Called when Board Room surfaces a risk to the user.
        Does NOT assume user action.
        """
        existing = await self._get_active(user_id, domain)
        if not existing:
            return

        now = datetime.now(timezone.utc).isoformat()
        try:
            self.supabase.table("escalation_memory").update({
                "last_boardroom_exposed_at": now,
            }).eq("id", existing["id"]).execute()
        except Exception as e:
            logger.error(f"[escalation_memory] Exposure update failed: {e}")

    async def record_user_action(self, user_id: str, domain: str, action: str):
        """
        Called when user explicitly acknowledges or defers in Board Room.
        Valid actions: acknowledged, deferred, ignored
        """
        if action not in ("acknowledged", "deferred", "ignored"):
            return

        existing = await self._get_active(user_id, domain)
        if not existing:
            return

        try:
            self.supabase.table("escalation_memory").update({
                "last_user_action": action,
            }).eq("id", existing["id"]).execute()
        except Exception as e:
            logger.error(f"[escalation_memory] Action update failed: {e}")

    # ═══════════════════════════════════════════════════════════════
    # READ: Called by Board Room prompt builder
    # ═══════════════════════════════════════════════════════════════

    async def get_active_escalations(self, user_id: str) -> List[Dict[str, Any]]:
        """All active escalations for a user."""
        try:
            result = self.supabase.table("escalation_memory").select("*").eq(
                "user_id", user_id
            ).eq("active", True).order("first_detected_at", desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.debug(f"[escalation_memory] Read failed: {e}")
            return []

    async def get_history(self, user_id: str, domain: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Historical escalations (active + resolved)."""
        try:
            query = self.supabase.table("escalation_memory").select("*").eq(
                "user_id", user_id
            ).order("last_detected_at", desc=True).limit(limit)
            if domain:
                query = query.eq("domain", domain)
            result = query.execute()
            return result.data or []
        except Exception as e:
            logger.debug(f"[escalation_memory] History read failed: {e}")
            return []

    # ═══════════════════════════════════════════════════════════════
    # INTERNAL
    # ═══════════════════════════════════════════════════════════════

    async def _get_active(self, user_id: str, domain: str) -> Optional[Dict[str, Any]]:
        try:
            result = self.supabase.table("escalation_memory").select("*").eq(
                "user_id", user_id
            ).eq("domain", domain).eq("active", True).limit(1).execute()
            return result.data[0] if result.data else None
        except Exception:
            return None


# ═══════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════

_memory: Optional[EscalationMemory] = None


def init_escalation_memory(supabase_client) -> EscalationMemory:
    global _memory
    _memory = EscalationMemory(supabase_client)
    logger.info("[escalation_memory] Initialized")
    return _memory


def get_escalation_memory() -> EscalationMemory:
    if _memory is None:
        raise RuntimeError("Escalation memory not initialized")
    return _memory
