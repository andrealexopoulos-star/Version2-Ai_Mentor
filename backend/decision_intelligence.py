"""
DECISION INTELLIGENCE ENGINE — Decision Lifecycle Tracking

Tracks the full lifecycle of business decisions: creation, outcome
recording, pattern analysis, and pending review surfacing.

INPUTS / OUTPUTS:
  - decision_log (read/write)
  - cognitive_profiles.consequence_memory (read/write)
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)

# How many consequence entries to retain in cognitive_profiles
MAX_CONSEQUENCE_HISTORY = 50


class DecisionIntelligenceEngine:
    """
    Manages the decision lifecycle: create, record outcome,
    analyse patterns, and surface pending reviews.
    """

    def __init__(self, sb_client):
        self.sb = sb_client

    # ═══════════════════════════════════════════════════════════════
    # PUBLIC API
    # ═══════════════════════════════════════════════════════════════

    def create_decision(
        self, user_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Insert a new decision into decision_log.

        Expected *data* keys:
            title, description, domain, decision_type, urgency,
            options[], expected_outcome, review_at

        Returns the created record.
        """
        try:
            now = datetime.now(timezone.utc).isoformat()
            record = {
                "id": str(uuid4()),
                "user_id": user_id,
                "title": data.get("title", "Untitled decision"),
                "description": data.get("description"),
                "domain": data.get("domain"),
                "decision_type": data.get("decision_type"),
                "urgency": data.get("urgency", "medium"),
                "options": data.get("options", []),
                "expected_outcome": data.get("expected_outcome"),
                "review_at": data.get("review_at"),
                "status": "decided",
                "created_at": now,
                "updated_at": now,
            }

            result = (
                self.sb.table("decision_log")
                .insert(record)
                .execute()
            )
            created = (result.data or [record])[0] if result.data else record

            logger.info(
                "[decision_intelligence] Created decision id=%s for user=%s",
                record["id"], user_id,
            )
            return created

        except Exception as exc:
            logger.error("[decision_intelligence] create_decision failed: %s", exc)
            return {"error": str(exc)}

    def record_outcome(
        self, user_id: str, decision_id: str, outcome_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Close a decision with its actual outcome and impact score.

        Updates decision_log and appends to
        cognitive_profiles.consequence_memory.

        *outcome_data* keys:
            actual_outcome (str), impact_score (float -1..1)
        """
        try:
            now = datetime.now(timezone.utc).isoformat()
            actual_outcome = outcome_data.get("actual_outcome", "")
            impact_score = outcome_data.get("impact_score", 0.0)

            # 1. Update the decision record
            self.sb.table("decision_log").update({
                "actual_outcome": actual_outcome,
                "impact_score": impact_score,
                "status": "closed",
                "closed_at": now,
                "updated_at": now,
            }).eq("id", decision_id).eq("user_id", user_id).execute()

            # 2. Fetch the decision for consequence_memory entry
            dec_result = (
                self.sb.table("decision_log")
                .select("title, domain, decision_type, urgency")
                .eq("id", decision_id)
                .limit(1)
                .execute()
            )
            decision = (dec_result.data or [{}])[0]

            # 3. Update cognitive_profiles.consequence_memory
            self._update_consequence_memory(
                user_id, decision, actual_outcome, impact_score, now
            )

            logger.info(
                "[decision_intelligence] Recorded outcome for decision=%s impact=%.2f",
                decision_id, impact_score,
            )
            return {
                "decision_id": decision_id,
                "status": "closed",
                "impact_score": impact_score,
                "actual_outcome": actual_outcome,
            }

        except Exception as exc:
            logger.error("[decision_intelligence] record_outcome failed: %s", exc)
            return {"error": str(exc)}

    def get_decision_patterns(self, user_id: str) -> Dict[str, Any]:
        """
        Analyse closed decisions to find strength/weakness patterns.

        Groups by domain, decision_type, and urgency. Calculates
        average impact per group.

        Strengths: avg impact > 0.3
        Weaknesses: avg impact < -0.2
        Requires >= 3 closed decisions.

        Returns:
            {sufficient_data, total_decisions, strengths[], weaknesses[],
             by_domain{}, by_type{}, by_urgency{}}
        """
        try:
            result = (
                self.sb.table("decision_log")
                .select("domain, decision_type, urgency, impact_score")
                .eq("user_id", user_id)
                .eq("status", "closed")
                .not_.is_("impact_score", "null")
                .execute()
            )
            decisions = result.data or []

            if len(decisions) < 3:
                return {
                    "sufficient_data": False,
                    "total_decisions": len(decisions),
                    "message": "Need at least 3 closed decisions with impact scores.",
                }

            by_domain = self._group_avg(decisions, "domain")
            by_type = self._group_avg(decisions, "decision_type")
            by_urgency = self._group_avg(decisions, "urgency")

            # Merge all groups for strength/weakness detection
            all_groups = []
            for label, groups in [
                ("domain", by_domain),
                ("type", by_type),
                ("urgency", by_urgency),
            ]:
                for key, stats in groups.items():
                    all_groups.append({
                        "dimension": label,
                        "value": key,
                        "avg_impact": stats["avg_impact"],
                        "count": stats["count"],
                    })

            strengths = [g for g in all_groups if g["avg_impact"] > 0.3]
            weaknesses = [g for g in all_groups if g["avg_impact"] < -0.2]

            return {
                "sufficient_data": True,
                "total_decisions": len(decisions),
                "strengths": sorted(
                    strengths, key=lambda x: x["avg_impact"], reverse=True
                ),
                "weaknesses": sorted(
                    weaknesses, key=lambda x: x["avg_impact"]
                ),
                "by_domain": by_domain,
                "by_type": by_type,
                "by_urgency": by_urgency,
            }

        except Exception as exc:
            logger.error("[decision_intelligence] get_decision_patterns failed: %s", exc)
            return {"sufficient_data": False, "total_decisions": 0, "error": str(exc)}

    def get_pending_reviews(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Return decisions that are due for review.

        Matches: status in (decided, implemented, reviewing)
                 AND review_at <= now.
        """
        try:
            now = datetime.now(timezone.utc).isoformat()

            result = (
                self.sb.table("decision_log")
                .select("*")
                .eq("user_id", user_id)
                .in_("status", ["decided", "implemented", "reviewing"])
                .lte("review_at", now)
                .order("review_at")
                .execute()
            )
            pending = result.data or []

            logger.info(
                "[decision_intelligence] %d pending reviews for user=%s",
                len(pending), user_id,
            )
            return pending

        except Exception as exc:
            logger.error("[decision_intelligence] get_pending_reviews failed: %s", exc)
            return []

    # ═══════════════════════════════════════════════════════════════
    # HELPERS
    # ═══════════════════════════════════════════════════════════════

    def _update_consequence_memory(
        self,
        user_id: str,
        decision: Dict[str, Any],
        actual_outcome: str,
        impact_score: float,
        timestamp: str,
    ) -> None:
        """
        Append an entry to cognitive_profiles.consequence_memory JSONB.
        Keeps only the last MAX_CONSEQUENCE_HISTORY entries.
        Updates running stats (total_decisions, avg_impact).
        """
        try:
            # Load current profile
            profile_result = (
                self.sb.table("cognitive_profiles")
                .select("consequence_memory")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            rows = profile_result.data or []
            memory = (rows[0].get("consequence_memory") or {}) if rows else {}

            history = memory.get("history", [])
            stats = memory.get("stats", {
                "total_decisions": 0,
                "avg_impact": 0.0,
            })

            # Append new entry
            entry = {
                "title": decision.get("title", ""),
                "domain": decision.get("domain"),
                "decision_type": decision.get("decision_type"),
                "urgency": decision.get("urgency"),
                "actual_outcome": actual_outcome,
                "impact_score": impact_score,
                "recorded_at": timestamp,
            }
            history.append(entry)

            # Trim to last N entries
            if len(history) > MAX_CONSEQUENCE_HISTORY:
                history = history[-MAX_CONSEQUENCE_HISTORY:]

            # Recalculate stats from history
            total = len(history)
            avg = (
                sum(h.get("impact_score", 0) for h in history) / total
                if total
                else 0.0
            )
            stats["total_decisions"] = total
            stats["avg_impact"] = round(avg, 3)

            updated_memory = {"history": history, "stats": stats}

            # Write back
            self.sb.table("cognitive_profiles").update({
                "consequence_memory": updated_memory,
            }).eq("user_id", user_id).execute()

            logger.debug(
                "[decision_intelligence] consequence_memory updated for user=%s (%d entries)",
                user_id, total,
            )

        except Exception as exc:
            logger.error(
                "[decision_intelligence] _update_consequence_memory failed: %s", exc
            )

    def _group_avg(
        self, decisions: List[Dict], field: str
    ) -> Dict[str, Dict[str, Any]]:
        """
        Group decisions by *field* and compute average impact_score.

        Returns: {group_value: {count, total_impact, avg_impact}}
        """
        groups: Dict[str, List[float]] = {}
        for dec in decisions:
            key = dec.get(field) or "unknown"
            score = dec.get("impact_score", 0.0)
            if key not in groups:
                groups[key] = []
            groups[key].append(score)

        result = {}
        for key, scores in groups.items():
            total = sum(scores)
            count = len(scores)
            result[key] = {
                "count": count,
                "total_impact": round(total, 3),
                "avg_impact": round(total / count, 3) if count else 0.0,
            }
        return result
