"""
PRESSURE CALIBRATION — Evidence-Based Decision Pressure

Modulates pressure based on persistence and prior inaction.
Pressure is a function of evidence over time, not tone.

Does NOT create intelligence.
Does NOT override Watchtower positions.
Does NOT speak to users.

Pressure must always be earned.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)

PRESSURE_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"]
ELEVATED_POSITIONS = frozenset(["ELEVATED", "DETERIORATING", "CRITICAL"])

# Decision window defaults (days) per pressure level
WINDOW_DEFAULTS = {
    "LOW": None,        # No window at LOW
    "MODERATE": 14,
    "HIGH": 7,
    "CRITICAL": 3,
}


class PressureCalibration:

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def run_calibration(
        self,
        user_id: str,
        positions: Dict[str, Any],
        escalations: List[Dict[str, Any]],
        contradictions: List[Dict[str, Any]],
        calibration: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Run pressure calibration for all domains.
        Called after Watchtower analysis + contradiction detection.
        Returns list of pressure records that changed.
        """
        changed = []
        esc_by_domain = {e["domain"]: e for e in escalations if e.get("active")}
        contra_by_domain = {}
        for c in contradictions:
            d = c.get("domain")
            if d not in contra_by_domain:
                contra_by_domain[d] = []
            contra_by_domain[d].append(c)

        # Evaluate each domain that has a position
        all_domains = set(list(positions.keys()) + list(esc_by_domain.keys()))

        for domain in all_domains:
            pos_data = positions.get(domain)
            observed = pos_data.get("position") if pos_data else None
            esc = esc_by_domain.get(domain)
            contras = contra_by_domain.get(domain, [])

            current = await self._get_active(user_id, domain)

            if observed and observed in ELEVATED_POSITIONS:
                result = await self._apply_pressure(
                    user_id, domain, observed, esc, contras, current, calibration
                )
                if result:
                    changed.append(result)
            elif current and current.get("active"):
                # Position recovered to STABLE → decay
                await self._decay_pressure(current)
                changed.append({"domain": domain, "action": "decayed"})

        return changed

    async def get_active_pressures(self, user_id: str) -> Dict[str, Any]:
        """Read active pressure records keyed by domain."""
        try:
            result = self.supabase.table("decision_pressure").select("*").eq(
                "user_id", user_id
            ).eq("active", True).execute()
            return {r["domain"]: r for r in (result.data or [])}
        except Exception as e:
            logger.debug(f"[pressure] Read failed: {e}")
            return {}

    # ═══════════════════════════════════════════════════════════════
    # PRESSURE APPLICATION
    # ═══════════════════════════════════════════════════════════════

    async def _apply_pressure(
        self,
        user_id: str,
        domain: str,
        observed: str,
        esc: Optional[Dict],
        contras: List[Dict],
        current: Optional[Dict],
        calibration: Optional[Dict],
    ) -> Optional[Dict]:
        now = datetime.now(timezone.utc).isoformat()

        # Calculate target pressure level
        target_level = self._calculate_level(observed, esc, contras, calibration)

        if current:
            current_level = current.get("pressure_level", "LOW")
            current_idx = PRESSURE_LEVELS.index(current_level) if current_level in PRESSURE_LEVELS else 0
            target_idx = PRESSURE_LEVELS.index(target_level)

            # Pressure only increases or stays. Never decreases while position is elevated.
            if target_idx <= current_idx:
                return None  # No change

            # Build evidence basis
            basis = current.get("basis") or {}
            basis = self._append_basis(basis, observed, esc, contras, target_level)

            try:
                self.supabase.table("decision_pressure").update({
                    "pressure_level": target_level,
                    "last_updated_at": now,
                    "basis": basis,
                }).eq("id", current["id"]).execute()
                logger.info(f"[pressure] {domain}: {current_level} → {target_level}")
                return {"domain": domain, "action": "increased", "from": current_level, "to": target_level}
            except Exception as e:
                logger.error(f"[pressure] Update failed: {e}")
                return None
        else:
            # New pressure record
            basis = self._append_basis({}, observed, esc, contras, target_level)

            record = {
                "id": str(uuid4()),
                "user_id": user_id,
                "domain": domain,
                "pressure_level": target_level,
                "first_applied_at": now,
                "last_updated_at": now,
                "basis": basis,
                "active": True,
            }

            try:
                self.supabase.table("decision_pressure").insert(record).execute()
                logger.info(f"[pressure] {domain}: NEW → {target_level}")
                return {"domain": domain, "action": "created", "level": target_level}
            except Exception as e:
                logger.error(f"[pressure] Insert failed: {e}")
                return None

    def _calculate_level(
        self,
        observed: str,
        esc: Optional[Dict],
        contras: List[Dict],
        calibration: Optional[Dict],
    ) -> str:
        score = 0

        # Position contributes base score
        if observed == "ELEVATED":
            score += 1
        elif observed == "DETERIORATING":
            score += 2
        elif observed == "CRITICAL":
            score += 3

        # Escalation persistence
        if esc:
            times = esc.get("times_detected", 0)
            if times >= 5:
                score += 2
            elif times >= 3:
                score += 1

            action = esc.get("last_user_action", "unknown")
            if action == "ignored":
                score += 1
            elif action == "deferred":
                score += 1

        # Contradictions
        for c in contras:
            ctimes = c.get("times_detected", 0)
            if ctimes >= 3:
                score += 2
            elif ctimes >= 1:
                score += 1

        # Calibration adjustment: risk-aggressive users get slightly less pressure
        if calibration:
            op = calibration.get("operator_profile") or {}
            risk = op.get("risk_posture", "").lower()
            if risk in ("aggressive", "high"):
                score = max(score - 1, 0)

        # Map score to level
        if score >= 6:
            return "CRITICAL"
        elif score >= 4:
            return "HIGH"
        elif score >= 2:
            return "MODERATE"
        else:
            return "LOW"

    def _append_basis(
        self,
        basis: Dict,
        observed: str,
        esc: Optional[Dict],
        contras: List[Dict],
        level: str,
    ) -> Dict:
        now = datetime.now(timezone.utc).isoformat()

        entry = {
            "timestamp": now,
            "observed_position": observed,
            "pressure_level": level,
        }

        if esc:
            entry["escalation_times"] = esc.get("times_detected", 0)
            entry["user_action"] = esc.get("last_user_action", "unknown")

        if contras:
            entry["contradiction_count"] = len(contras)
            entry["contradiction_types"] = [c.get("contradiction_type") for c in contras]

        # Add decision window at HIGH/CRITICAL
        window = WINDOW_DEFAULTS.get(level)
        if window is not None:
            # Never extend a previously compressed window
            prior_window = basis.get("window_days_remaining")
            if prior_window is not None and prior_window < window:
                window = prior_window
            entry["window_days_remaining"] = window
            basis["window_days_remaining"] = window

        # Append to history
        history = basis.get("history", [])
        history.append(entry)
        basis["history"] = history[-10:]  # Keep last 10 entries

        return basis

    # ═══════════════════════════════════════════════════════════════
    # PRESSURE DECAY
    # ═══════════════════════════════════════════════════════════════

    async def _decay_pressure(self, current: Dict):
        """Reduce pressure only when Watchtower recovers to STABLE."""
        try:
            self.supabase.table("decision_pressure").update({
                "active": False,
                "last_updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", current["id"]).execute()
            logger.info(f"[pressure] {current.get('domain')}: decayed to inactive")
        except Exception as e:
            logger.error(f"[pressure] Decay failed: {e}")

    async def _get_active(self, user_id: str, domain: str) -> Optional[Dict]:
        try:
            result = self.supabase.table("decision_pressure").select("*").eq(
                "user_id", user_id
            ).eq("domain", domain).eq("active", True).limit(1).execute()
            return result.data[0] if result.data else None
        except Exception:
            return None


# ═══════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════

_calibrator: Optional[PressureCalibration] = None


def init_pressure_calibration(supabase_client) -> PressureCalibration:
    global _calibrator
    _calibrator = PressureCalibration(supabase_client)
    logger.info("[pressure] Calibration initialized")
    return _calibrator


def get_pressure_calibration() -> PressureCalibration:
    if _calibrator is None:
        raise RuntimeError("Pressure calibration not initialized")
    return _calibrator
