"""
CONFIDENCE DECAY & EVIDENCE FRESHNESS — Certainty Governance

Governs when certainty is allowed.
Reduces confidence when evidence becomes stale.
Increases confidence only with fresh, reinforcing signals.

Does NOT create intelligence.
Does NOT change Watchtower logic.
Does NOT change Board Room structure.
Does NOT speak to users.

Certainty must always be earned and maintained.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)

CONFIDENCE_STATES = frozenset(["FRESH", "AGING", "STALE"])
VALID_DOMAINS = frozenset(["finance", "sales", "operations", "team", "market"])

# Default decay rate per hour (confidence units lost per hour without reinforcement)
DEFAULT_DECAY_RATE = 0.002

# Window thresholds (hours)
AGING_THRESHOLD_HOURS = 48     # No evidence for 48h → AGING
STALE_THRESHOLD_HOURS = 168    # No evidence for 7d → STALE


class EvidenceFreshness:

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def run_freshness_check(
        self,
        user_id: str,
        positions: Dict[str, Any],
        findings: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Run freshness evaluation for all domains with positions.
        Called after each Watchtower cycle.
        Returns list of freshness records that changed.
        """
        changed = []
        now = datetime.now(timezone.utc)

        for domain, pos_data in positions.items():
            if domain not in VALID_DOMAINS:
                continue

            watchtower_confidence = pos_data.get("confidence", 0)
            detected_at = pos_data.get("detected_at")

            # Find the most recent finding for this domain
            domain_findings = [f for f in findings if f.get("domain") == domain]
            latest_evidence_at = None
            if domain_findings:
                latest_ts = domain_findings[0].get("detected_at")
                if latest_ts:
                    try:
                        latest_evidence_at = datetime.fromisoformat(
                            str(latest_ts).replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass

            if not latest_evidence_at and detected_at:
                try:
                    latest_evidence_at = datetime.fromisoformat(
                        str(detected_at).replace("Z", "+00:00")
                    )
                except (ValueError, TypeError):
                    pass

            if not latest_evidence_at:
                latest_evidence_at = now

            result = await self._evaluate_domain(
                user_id, domain, watchtower_confidence, latest_evidence_at, now
            )
            if result:
                changed.append(result)

        # Decay domains that have freshness records but no current position
        active_records = await self._get_all_active(user_id)
        for record in active_records:
            domain = record.get("domain")
            if domain not in positions:
                # Domain no longer has a position → let it decay
                result = await self._apply_decay(record, now)
                if result:
                    changed.append(result)

        return changed

    async def get_freshness(self, user_id: str) -> Dict[str, Any]:
        """Read current freshness state keyed by domain."""
        try:
            result = self.supabase.table("evidence_freshness").select("*").eq(
                "user_id", user_id
            ).eq("active", True).execute()
            return {r["domain"]: r for r in (result.data or [])}
        except Exception as e:
            logger.debug(f"[freshness] Read failed: {e}")
            return {}

    # ═══════════════════════════════════════════════════════════════
    # EVALUATION
    # ═══════════════════════════════════════════════════════════════

    async def _evaluate_domain(
        self,
        user_id: str,
        domain: str,
        watchtower_confidence: float,
        latest_evidence_at: datetime,
        now: datetime,
    ) -> Optional[Dict[str, Any]]:

        existing = await self._get_active_domain(user_id, domain)
        hours_since_evidence = (now - latest_evidence_at).total_seconds() / 3600

        # Determine confidence state
        if hours_since_evidence < AGING_THRESHOLD_HOURS:
            new_state = "FRESH"
        elif hours_since_evidence < STALE_THRESHOLD_HOURS:
            new_state = "AGING"
        else:
            new_state = "STALE"

        # Calculate decayed confidence
        if new_state == "FRESH":
            # Reinforcement: restore or increase confidence
            new_confidence = watchtower_confidence
        elif new_state == "AGING":
            # Gradual decay
            hours_aging = hours_since_evidence - AGING_THRESHOLD_HOURS
            decay = hours_aging * DEFAULT_DECAY_RATE
            base = existing.get("current_confidence", watchtower_confidence) if existing else watchtower_confidence
            new_confidence = max(base - decay, 0.1)
        else:
            # STALE: significant reduction
            base = existing.get("current_confidence", watchtower_confidence) if existing else watchtower_confidence
            new_confidence = max(base * 0.5, 0.05)

        new_confidence = round(min(max(new_confidence, 0.0), 1.0), 3)
        now_iso = now.isoformat()

        if existing:
            old_state = existing.get("confidence_state")
            old_confidence = existing.get("current_confidence", 0)

            # Check if anything changed
            state_changed = old_state != new_state
            confidence_changed = abs(old_confidence - new_confidence) > 0.005

            if not state_changed and not confidence_changed:
                return None  # No change

            try:
                self.supabase.table("evidence_freshness").update({
                    "current_confidence": new_confidence,
                    "confidence_state": new_state,
                    "last_evidence_at": latest_evidence_at.isoformat(),
                    "decay_rate": DEFAULT_DECAY_RATE,
                }).eq("id", existing["id"]).execute()

                logger.info(f"[freshness] {domain}: {old_state}({old_confidence}) → {new_state}({new_confidence})")
                return {"domain": domain, "state": new_state, "confidence": new_confidence, "action": "updated"}
            except Exception as e:
                logger.error(f"[freshness] Update failed: {e}")
                return None
        else:
            # New record
            record = {
                "id": str(uuid4()),
                "user_id": user_id,
                "domain": domain,
                "current_confidence": new_confidence,
                "last_evidence_at": latest_evidence_at.isoformat(),
                "decay_rate": DEFAULT_DECAY_RATE,
                "confidence_state": new_state,
                "active": True,
            }
            try:
                self.supabase.table("evidence_freshness").insert(record).execute()
                logger.info(f"[freshness] {domain}: NEW → {new_state}({new_confidence})")
                return {"domain": domain, "state": new_state, "confidence": new_confidence, "action": "created"}
            except Exception as e:
                logger.error(f"[freshness] Insert failed: {e}")
                return None

    async def _apply_decay(self, record: Dict[str, Any], now: datetime) -> Optional[Dict[str, Any]]:
        """Apply decay to a domain that no longer has an active Watchtower position."""
        last_evidence = record.get("last_evidence_at")
        if not last_evidence:
            return None

        try:
            last_dt = datetime.fromisoformat(str(last_evidence).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None

        hours_since = (now - last_dt).total_seconds() / 3600
        old_state = record.get("confidence_state")
        old_confidence = record.get("current_confidence", 0)

        if hours_since >= STALE_THRESHOLD_HOURS:
            new_state = "STALE"
            new_confidence = max(old_confidence * 0.5, 0.05)
        elif hours_since >= AGING_THRESHOLD_HOURS:
            new_state = "AGING"
            hours_aging = hours_since - AGING_THRESHOLD_HOURS
            new_confidence = max(old_confidence - (hours_aging * DEFAULT_DECAY_RATE), 0.1)
        else:
            return None  # Still fresh, no decay needed

        new_confidence = round(new_confidence, 3)

        if new_state == old_state and abs(old_confidence - new_confidence) < 0.005:
            return None

        try:
            self.supabase.table("evidence_freshness").update({
                "current_confidence": new_confidence,
                "confidence_state": new_state,
                "decay_rate": DEFAULT_DECAY_RATE,
            }).eq("id", record["id"]).execute()
            return {"domain": record.get("domain"), "state": new_state, "confidence": new_confidence, "action": "decayed"}
        except Exception as e:
            logger.error(f"[freshness] Decay failed: {e}")
            return None

    # ═══════════════════════════════════════════════════════════════
    # DATA ACCESS
    # ═══════════════════════════════════════════════════════════════

    async def _get_active_domain(self, user_id: str, domain: str) -> Optional[Dict[str, Any]]:
        try:
            result = self.supabase.table("evidence_freshness").select("*").eq(
                "user_id", user_id
            ).eq("domain", domain).eq("active", True).limit(1).execute()
            return result.data[0] if result.data else None
        except Exception:
            return None

    async def _get_all_active(self, user_id: str) -> List[Dict[str, Any]]:
        try:
            result = self.supabase.table("evidence_freshness").select("*").eq(
                "user_id", user_id
            ).eq("active", True).execute()
            return result.data or []
        except Exception:
            return []


# ═══════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════

_freshness: Optional[EvidenceFreshness] = None


def init_evidence_freshness(supabase_client) -> EvidenceFreshness:
    global _freshness
    _freshness = EvidenceFreshness(supabase_client)
    logger.info("[freshness] Evidence Freshness initialized")
    return _freshness


def get_evidence_freshness() -> EvidenceFreshness:
    if _freshness is None:
        raise RuntimeError("Evidence freshness not initialized")
    return _freshness
