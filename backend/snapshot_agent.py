"""
SNAPSHOT AGENT — Periodic Intelligence Briefings

Summarises inevitability over time.
Does NOT create new intelligence.
Does NOT change Watchtower or Board Room.
Does NOT prompt the user for action.

Generates snapshots ONLY when material change exists.
Silence is the default state.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)


class SnapshotAgent:

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def generate_snapshot(
        self,
        user_id: str,
        snapshot_type: str = "ad_hoc",
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a snapshot if material change exists.
        Returns the snapshot dict, or None if silence is correct.
        """
        positions = await self._load_positions(user_id)
        escalations = await self._load_escalations(user_id)
        contradictions = await self._load_contradictions(user_id)
        last_snapshot = await self._load_last_snapshot(user_id)

        # ─── Material change check ────────────────────────────
        if not self._has_material_change(positions, escalations, contradictions, last_snapshot):
            return None  # Silence is correct

        # ─── Build snapshot ───────────────────────────────────
        domains_state = {}
        open_risks = []
        contradiction_list = []

        for domain, data in positions.items():
            pos = data.get("position", "STABLE")
            domains_state[domain] = {
                "position": pos,
                "confidence": data.get("confidence", 0),
                "detected_at": data.get("detected_at"),
            }

            if pos != "STABLE":
                # Find persistence duration
                esc = next((e for e in escalations if e.get("domain") == domain), None)
                persistence = None
                if esc:
                    first = esc.get("first_detected_at")
                    if first:
                        try:
                            first_dt = datetime.fromisoformat(str(first).replace("Z", "+00:00"))
                            hours = (datetime.now(timezone.utc) - first_dt).total_seconds() / 3600
                            persistence = round(hours)
                        except (ValueError, TypeError):
                            pass

                risk = {
                    "domain": domain,
                    "position": pos,
                    "persistence_hours": persistence,
                    "times_detected": esc.get("times_detected", 1) if esc else 1,
                    "user_action": esc.get("last_user_action", "unknown") if esc else "unknown",
                }
                open_risks.append(risk)

        for c in contradictions:
            contradiction_list.append({
                "domain": c.get("domain"),
                "type": c.get("contradiction_type"),
                "times_detected": c.get("times_detected", 1),
                "first_detected_at": c.get("first_detected_at"),
            })

        summary = self._build_summary(domains_state, open_risks, contradiction_list)

        snapshot = {
            "id": str(uuid4()),
            "user_id": user_id,
            "snapshot_type": snapshot_type,
            "summary": summary,
            "domains": domains_state,
            "open_risks": open_risks,
            "contradictions": contradiction_list,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        await self._persist_snapshot(snapshot)

        # Bridge: auto-generate intelligence actions from snapshot findings
        try:
            from intelligence_bridge import bridge_snapshot_to_actions
            actions_created = await bridge_snapshot_to_actions(self.supabase, user_id, snapshot)
            if actions_created > 0:
                logger.info(f"[snapshot] Bridged {actions_created} actions from snapshot {snapshot['id'][:8]}")
        except Exception as e:
            logger.warning(f"[snapshot] Bridge failed (non-blocking): {e}")

        return snapshot

    async def get_latest_snapshot(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Read the most recent snapshot."""
        return await self._load_last_snapshot(user_id)

    async def get_snapshots(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Read snapshot history."""
        try:
            result = self.supabase.table("intelligence_snapshots").select("*").eq(
                "user_id", user_id
            ).order("generated_at", desc=True).limit(limit).execute()
            return result.data or []
        except Exception:
            return []

    # ═══════════════════════════════════════════════════════════════
    # MATERIAL CHANGE DETECTION
    # ═══════════════════════════════════════════════════════════════

    def _has_material_change(
        self,
        positions: Dict[str, Any],
        escalations: List[Dict[str, Any]],
        contradictions: List[Dict[str, Any]],
        last_snapshot: Optional[Dict[str, Any]],
    ) -> bool:
        # No prior snapshot and something is elevated → material
        if not last_snapshot:
            has_elevated = any(
                d.get("position") != "STABLE" for d in positions.values()
            )
            has_contradictions = len(contradictions) > 0
            return has_elevated or has_contradictions

        prior_domains = last_snapshot.get("domains") or {}
        prior_risks = last_snapshot.get("open_risks") or []
        prior_contradictions = last_snapshot.get("contradictions") or []

        # Position changed in any domain
        for domain, data in positions.items():
            current_pos = data.get("position")
            prior_pos = prior_domains.get(domain, {}).get("position")
            if current_pos != prior_pos:
                return True

        # Escalation count increased
        prior_risk_map = {r.get("domain"): r.get("times_detected", 0) for r in prior_risks}
        for esc in escalations:
            domain = esc.get("domain")
            current_times = esc.get("times_detected", 0)
            prior_times = prior_risk_map.get(domain, 0)
            if current_times > prior_times:
                return True

        # Contradiction count increased
        prior_contra_map = {
            (c.get("domain"), c.get("type")): c.get("times_detected", 0)
            for c in prior_contradictions
        }
        for c in contradictions:
            key = (c.get("domain"), c.get("contradiction_type"))
            current_times = c.get("times_detected", 0)
            prior_times = prior_contra_map.get(key, 0)
            if current_times > prior_times:
                return True

        # Unresolved risk persists (already in prior snapshot, still open)
        for risk in prior_risks:
            domain = risk.get("domain")
            current_pos = positions.get(domain, {}).get("position")
            if current_pos and current_pos != "STABLE":
                # Still open — but only material if it's been long enough
                # Check if prior snapshot is older than 24h
                prior_time = last_snapshot.get("generated_at")
                if prior_time:
                    try:
                        prior_dt = datetime.fromisoformat(str(prior_time).replace("Z", "+00:00"))
                        hours_since = (datetime.now(timezone.utc) - prior_dt).total_seconds() / 3600
                        if hours_since >= 24:
                            return True
                    except (ValueError, TypeError):
                        pass

        return False

    # ═══════════════════════════════════════════════════════════════
    # SUMMARY BUILDER
    # ═══════════════════════════════════════════════════════════════

    def _build_summary(
        self,
        domains: Dict[str, Any],
        open_risks: List[Dict],
        contradictions: List[Dict],
    ) -> str:
        parts = []

        # Dominant positions
        elevated = [r for r in open_risks if r.get("position") != "STABLE"]
        if not elevated:
            return "All domains stable. No material change."

        for r in elevated:
            domain = r["domain"].capitalize()
            pos = r["position"]
            hours = r.get("persistence_hours")
            times = r.get("times_detected", 1)
            action = r.get("user_action", "unknown")

            duration = ""
            if hours is not None:
                if hours < 24:
                    duration = f" for {hours}h"
                else:
                    days = round(hours / 24)
                    duration = f" for {days}d"

            line = f"{domain}: {pos}{duration}."
            if times > 1:
                line += f" Detected {times}x."
            if action in ("deferred", "ignored"):
                line += f" Operator response: {action}."
            parts.append(line)

        # Contradictions
        if contradictions:
            types = set(c.get("type") for c in contradictions)
            parts.append(f"Contradictions active: {', '.join(t for t in types if t)}.")

        # Trajectory
        critical = [r for r in elevated if r["position"] == "CRITICAL"]
        deteriorating = [r for r in elevated if r["position"] == "DETERIORATING"]

        if critical:
            parts.append("Trajectory: critical state requires immediate resolution.")
        elif deteriorating:
            parts.append("Trajectory: deterioration will compound without intervention.")
        else:
            parts.append("Trajectory: elevated state persists.")

        return " ".join(parts)

    # ═══════════════════════════════════════════════════════════════
    # DATA ACCESS
    # ═══════════════════════════════════════════════════════════════

    async def _load_positions(self, user_id: str) -> Dict[str, Any]:
        try:
            from watchtower_engine import get_watchtower_engine
            engine = get_watchtower_engine()
            return await engine.get_positions(user_id)
        except Exception:
            return {}

    async def _load_escalations(self, user_id: str) -> List[Dict[str, Any]]:
        try:
            from escalation_memory import get_escalation_memory
            mem = get_escalation_memory()
            return await mem.get_active_escalations(user_id)
        except Exception:
            return []

    async def _load_contradictions(self, user_id: str) -> List[Dict[str, Any]]:
        try:
            from contradiction_engine import get_contradiction_engine
            ce = get_contradiction_engine()
            return await ce.get_active_contradictions(user_id)
        except Exception:
            return []

    async def _load_last_snapshot(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            result = self.supabase.table("intelligence_snapshots").select("*").eq(
                "user_id", user_id
            ).order("generated_at", desc=True).limit(1).execute()
            return result.data[0] if result.data else None
        except Exception:
            return None

    async def _persist_snapshot(self, snapshot: Dict[str, Any]):
        try:
            self.supabase.table("intelligence_snapshots").insert(snapshot).execute()
            logger.info(f"[snapshot] {snapshot['snapshot_type']} snapshot generated")
        except Exception as e:
            logger.error(f"[snapshot] Persist failed: {e}")


# ═══════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════

_agent: Optional[SnapshotAgent] = None


def init_snapshot_agent(supabase_client) -> SnapshotAgent:
    global _agent
    _agent = SnapshotAgent(supabase_client)
    logger.info("[snapshot] Agent initialized")
    return _agent


def get_snapshot_agent() -> SnapshotAgent:
    if _agent is None:
        raise RuntimeError("Snapshot agent not initialized")
    return _agent
