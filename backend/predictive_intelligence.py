"""
Predictive Intelligence Engine — Runs 5 prediction models on existing BIQc data.

Models analyze email patterns, finance signals, sales pipeline, demand trajectory,
and team health to produce forward-looking predictions.

Results are upserted to the predictions table with
on_conflict="user_id,model_name,prediction_date".

SYNC Supabase calls only (supabase-py v2, snake_case API).
"""

from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List
from uuid import uuid4
import logging

from routes.deps import get_lookback_days, _normalize_subscription_tier

logger = logging.getLogger(__name__)


# Minimum data points required for a meaningful prediction
MIN_DATA_POINTS = 3


class PredictiveIntelligenceEngine:
    """
    Runs 5 prediction models against BIQc data.
    Each model returns a dict with:
        score (0-1), confidence (0-1), reasoning (str),
        data_points (int), horizon_days (int), details (dict)
    """

    def __init__(self, sb_client):
        self.sb = sb_client

    def _get_user_lookback_days(self, user_id: str, fallback: int = 180) -> int:
        """Resolve the tier-based lookback window for a user.

        Returns the number of days (or a large value for unlimited tiers).
        Falls back to *fallback* if the user row cannot be read.
        """
        try:
            row = self.sb.table("users").select("subscription_tier").eq("id", user_id).maybe_single().execute()
            raw_tier = (row.data or {}).get("subscription_tier", "free")
            days = get_lookback_days(raw_tier)
            return 3650 if days == -1 else days  # ~10 years for unlimited
        except Exception:
            return fallback

    # ═══════════════════════════════════════════════════════════════
    # PUBLIC API
    # ═══════════════════════════════════════════════════════════════

    def run_all_predictions(self, user_id: str) -> dict:
        """Run all models, store results in predictions table."""
        models = {
            "churn_risk": self._predict_churn_risk,
            "cash_runway": self._predict_cash_runway,
            "deal_closure": self._predict_deal_closure,
            "demand_trajectory": self._predict_demand_trajectory,
            "attrition_risk": self._predict_attrition_risk,
        }

        results: Dict[str, Dict[str, Any]] = {}
        today = date.today()

        for model_name, model_fn in models.items():
            try:
                prediction = model_fn(user_id)
                results[model_name] = prediction

                # Upsert to predictions table
                row = {
                    "user_id": user_id,
                    "model_name": model_name,
                    "prediction_date": today.isoformat(),
                    "score": prediction["score"],
                    "confidence": prediction["confidence"],
                    "reasoning": prediction["reasoning"],
                    "data_points_used": prediction["data_points"],
                    "horizon_days": prediction["horizon_days"],
                    "details": prediction["details"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                self.sb.table("predictions").upsert(
                    row, on_conflict="user_id,model_name,prediction_date"
                ).execute()

            except Exception as e:
                logger.error(f"[predictive] Model {model_name} failed for user {user_id}: {e}")
                results[model_name] = _insufficient_data_result(
                    f"Model execution failed: {e}", horizon_days=90
                )

        logger.info(
            f"[predictive] Predictions complete for user {user_id}: "
            f"{len(results)} models ran"
        )
        return results

    # ═══════════════════════════════════════════════════════════════
    # PREDICTION MODELS
    # ═══════════════════════════════════════════════════════════════

    def _predict_churn_risk(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze email frequency per client over 90 days.
        Clients with declining frequency = higher churn risk.
        """
        try:
            now = datetime.now(timezone.utc)
            ninety_ago = (now - timedelta(days=90)).isoformat()

            result = self.sb.table("outlook_emails").select(
                "from_address, received_date"
            ).eq("user_id", user_id).gte("received_date", ninety_ago).execute()

            rows = result.data or []
            if len(rows) < MIN_DATA_POINTS:
                return _insufficient_data_result(
                    "Not enough email data for churn prediction. "
                    "Connect your email integration for better insights.",
                    horizon_days=90,
                )

            # Group emails by sender, then by month bucket
            sender_buckets: Dict[str, Dict[str, int]] = {}
            for row in rows:
                addr = row.get("from_address")
                recv = row.get("received_date")
                if not addr or not recv:
                    continue
                try:
                    dt = datetime.fromisoformat(str(recv).replace("Z", "+00:00"))
                    bucket = "recent" if dt > now - timedelta(days=30) else (
                        "mid" if dt > now - timedelta(days=60) else "old"
                    )
                except (ValueError, TypeError):
                    continue

                sender_buckets.setdefault(addr, {"recent": 0, "mid": 0, "old": 0})
                sender_buckets[addr][bucket] += 1

            # Calculate churn indicators
            total_senders = len(sender_buckets)
            declining_senders = 0
            silent_senders = 0

            for addr, buckets in sender_buckets.items():
                old_mid = buckets["old"] + buckets["mid"]
                if old_mid >= 2 and buckets["recent"] == 0:
                    silent_senders += 1
                elif old_mid > buckets["recent"] and buckets["recent"] < old_mid * 0.5:
                    declining_senders += 1

            if total_senders == 0:
                return _insufficient_data_result(
                    "No sender data available for churn analysis.",
                    horizon_days=90,
                )

            churn_ratio = (declining_senders + silent_senders) / total_senders
            score = min(1.0, round(churn_ratio, 2))
            confidence = min(1.0, round(len(rows) / 100, 2))  # More data = more confidence

            if score > 0.5:
                reasoning = (
                    f"{silent_senders} contact(s) have gone silent and "
                    f"{declining_senders} show declining communication. "
                    f"Churn risk is elevated across {total_senders} tracked contacts."
                )
            elif score > 0.2:
                reasoning = (
                    f"Moderate churn indicators: {declining_senders} declining, "
                    f"{silent_senders} silent out of {total_senders} contacts."
                )
            else:
                reasoning = (
                    f"Communication patterns are healthy across {total_senders} contacts. "
                    f"Low churn risk detected."
                )

            return {
                "score": score,
                "confidence": confidence,
                "reasoning": reasoning,
                "data_points": len(rows),
                "horizon_days": 90,
                "details": {
                    "total_senders": total_senders,
                    "declining_senders": declining_senders,
                    "silent_senders": silent_senders,
                    "total_emails_analyzed": len(rows),
                },
            }
        except Exception as e:
            logger.error(f"[predictive] _predict_churn_risk failed: {e}")
            return _insufficient_data_result(
                f"Churn analysis encountered an error. Check email integration.",
                horizon_days=90,
            )

    def _predict_cash_runway(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze finance domain observation_events using tier-based lookback.
        Compare income vs expense signal rates.
        """
        try:
            lookback = self._get_user_lookback_days(user_id, fallback=180)
            now = datetime.now(timezone.utc)
            cutoff = (now - timedelta(days=lookback)).isoformat()

            result = self.sb.table("observation_events").select(
                "id, signal_type, detail, confidence, created_at"
            ).eq("user_id", user_id).eq("domain", "finance").gte(
                "created_at", cutoff
            ).execute()

            rows = result.data or []
            if len(rows) < MIN_DATA_POINTS:
                return _insufficient_data_result(
                    "Not enough finance data for cash runway prediction. "
                    "Connect accounting integrations (Xero, QuickBooks) for insights.",
                    horizon_days=lookback,
                )

            income_keywords = ("revenue", "income", "payment_received", "invoice_paid", "deposit")
            expense_keywords = ("expense", "payment", "cost", "outflow", "burn", "withdrawal")

            income_signals = []
            expense_signals = []

            for row in rows:
                st = (row.get("signal_type") or "").lower()
                detail = (row.get("detail") or "").lower()
                combined = st + " " + detail

                if any(kw in combined for kw in income_keywords):
                    income_signals.append(row)
                elif any(kw in combined for kw in expense_keywords):
                    expense_signals.append(row)

            total_classified = len(income_signals) + len(expense_signals)
            if total_classified == 0:
                return _insufficient_data_result(
                    "Finance signals exist but cannot be classified as income/expense. "
                    "Check integration data quality.",
                    horizon_days=180,
                )

            # Recent vs older trend
            ninety_ago = now - timedelta(days=90)
            recent_income = sum(
                1 for s in income_signals
                if _parse_dt(s.get("created_at")) and _parse_dt(s.get("created_at")) > ninety_ago
            )
            older_income = len(income_signals) - recent_income
            recent_expense = sum(
                1 for s in expense_signals
                if _parse_dt(s.get("created_at")) and _parse_dt(s.get("created_at")) > ninety_ago
            )
            older_expense = len(expense_signals) - recent_expense

            # Score: higher = healthier runway
            income_ratio = len(income_signals) / total_classified if total_classified else 0.5
            trend_factor = 1.0
            if older_income > 0 and recent_income < older_income * 0.5:
                trend_factor = 0.6  # Income declining
            elif recent_income > older_income:
                trend_factor = 1.2  # Income growing

            raw_score = income_ratio * trend_factor
            score = min(1.0, max(0.0, round(raw_score, 2)))
            confidence = min(1.0, round(total_classified / 50, 2))

            if score >= 0.6:
                reasoning = (
                    f"Cash position appears healthy. {len(income_signals)} income signals "
                    f"vs {len(expense_signals)} expense signals over {lookback} days. "
                    f"{'Income trend is improving.' if trend_factor > 1 else 'Income trend is stable.'}"
                )
            elif score >= 0.3:
                reasoning = (
                    f"Cash position is moderate. {len(income_signals)} income vs "
                    f"{len(expense_signals)} expense signals. Monitor closely."
                )
            else:
                reasoning = (
                    f"Cash position may be under pressure. Expense signals ({len(expense_signals)}) "
                    f"outpace income signals ({len(income_signals)}). "
                    f"{'Income is declining.' if trend_factor < 1 else ''}"
                )

            return {
                "score": score,
                "confidence": confidence,
                "reasoning": reasoning,
                "data_points": len(rows),
                "horizon_days": 180,
                "details": {
                    "income_signals": len(income_signals),
                    "expense_signals": len(expense_signals),
                    "recent_income": recent_income,
                    "recent_expense": recent_expense,
                    "trend_factor": trend_factor,
                },
            }
        except Exception as e:
            logger.error(f"[predictive] _predict_cash_runway failed: {e}")
            return _insufficient_data_result(
                "Cash runway analysis encountered an error. Check finance integrations.",
                horizon_days=180,
            )

    def _predict_deal_closure(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze sales domain events. Active deal movements in last 14 days
        = healthy pipeline.
        """
        try:
            now = datetime.now(timezone.utc)
            fourteen_ago = (now - timedelta(days=14)).isoformat()
            thirty_ago = (now - timedelta(days=30)).isoformat()

            # Recent 14 days
            recent_result = self.sb.table("observation_events").select(
                "id, signal_type, detail, confidence, created_at"
            ).eq("user_id", user_id).eq("domain", "sales").gte(
                "created_at", fourteen_ago
            ).execute()

            # Prior 14-30 days for comparison
            prior_result = self.sb.table("observation_events").select(
                "id, signal_type, detail, confidence, created_at"
            ).eq("user_id", user_id).eq("domain", "sales").gte(
                "created_at", thirty_ago
            ).lt("created_at", fourteen_ago).execute()

            recent = recent_result.data or []
            prior = prior_result.data or []
            total_points = len(recent) + len(prior)

            if total_points < MIN_DATA_POINTS:
                return _insufficient_data_result(
                    "Not enough sales data for deal closure prediction. "
                    "Connect your CRM integration for pipeline insights.",
                    horizon_days=30,
                )

            deal_keywords = ("deal", "pipeline", "opportunity", "proposal", "close", "won", "negotiation")
            recent_deals = [
                r for r in recent
                if any(kw in (r.get("signal_type") or "").lower() for kw in deal_keywords)
            ]
            prior_deals = [
                r for r in prior
                if any(kw in (r.get("signal_type") or "").lower() for kw in deal_keywords)
            ]

            # Pipeline health score
            recent_activity = len(recent)
            prior_activity = len(prior)

            if prior_activity > 0:
                momentum = recent_activity / prior_activity
            else:
                momentum = 1.0 if recent_activity > 0 else 0.0

            deal_ratio = len(recent_deals) / max(len(recent), 1)
            raw_score = min(1.0, (momentum * 0.6 + deal_ratio * 0.4))
            score = round(max(0.0, min(1.0, raw_score)), 2)
            confidence = min(1.0, round(total_points / 30, 2))

            if score >= 0.6:
                reasoning = (
                    f"Sales pipeline is active with {len(recent_deals)} deal signals "
                    f"in the last 14 days. Momentum is "
                    f"{'increasing' if momentum > 1.2 else 'steady'}."
                )
            elif score >= 0.3:
                reasoning = (
                    f"Moderate pipeline activity: {len(recent)} sales signals recently, "
                    f"{len(recent_deals)} deal-specific. Pipeline may need attention."
                )
            else:
                reasoning = (
                    f"Pipeline activity is low. Only {len(recent)} sales signals "
                    f"in 14 days vs {len(prior)} in the prior period. "
                    f"Deal closure probability is declining."
                )

            return {
                "score": score,
                "confidence": confidence,
                "reasoning": reasoning,
                "data_points": total_points,
                "horizon_days": 30,
                "details": {
                    "recent_signals": len(recent),
                    "prior_signals": len(prior),
                    "recent_deal_signals": len(recent_deals),
                    "prior_deal_signals": len(prior_deals),
                    "momentum": round(momentum, 2),
                },
            }
        except Exception as e:
            logger.error(f"[predictive] _predict_deal_closure failed: {e}")
            return _insufficient_data_result(
                "Deal closure analysis encountered an error. Check CRM integration.",
                horizon_days=30,
            )

    def _predict_demand_trajectory(self, user_id: str) -> Dict[str, Any]:
        """
        Compare signal volume in last 30 days vs prior 30 days
        across sales+finance+market domains.
        """
        try:
            now = datetime.now(timezone.utc)
            thirty_ago = (now - timedelta(days=30)).isoformat()
            sixty_ago = (now - timedelta(days=60)).isoformat()

            target_domains = ("sales", "finance", "market")

            recent_result = self.sb.table("observation_events").select(
                "id, domain, signal_type, confidence", count="exact"
            ).eq("user_id", user_id).in_(
                "domain", list(target_domains)
            ).gte("created_at", thirty_ago).execute()

            prior_result = self.sb.table("observation_events").select(
                "id, domain, signal_type, confidence", count="exact"
            ).eq("user_id", user_id).in_(
                "domain", list(target_domains)
            ).gte("created_at", sixty_ago).lt(
                "created_at", thirty_ago
            ).execute()

            recent_count = recent_result.count or 0
            prior_count = prior_result.count or 0
            total_points = recent_count + prior_count

            if total_points < MIN_DATA_POINTS:
                return _insufficient_data_result(
                    "Not enough cross-domain data for demand trajectory prediction. "
                    "Connect sales, finance, and market integrations.",
                    horizon_days=60,
                )

            # Domain breakdown
            recent_rows = recent_result.data or []
            prior_rows = prior_result.data or []
            domain_recent: Dict[str, int] = {}
            domain_prior: Dict[str, int] = {}

            for r in recent_rows:
                d = r.get("domain", "other")
                domain_recent[d] = domain_recent.get(d, 0) + 1
            for r in prior_rows:
                d = r.get("domain", "other")
                domain_prior[d] = domain_prior.get(d, 0) + 1

            # Trajectory calculation
            if prior_count > 0:
                growth_rate = (recent_count - prior_count) / prior_count
            else:
                growth_rate = 1.0 if recent_count > 0 else 0.0

            # Score: 0.5 = flat, >0.5 = growing, <0.5 = declining
            raw_score = 0.5 + (growth_rate * 0.3)  # Scale growth into 0-1 range
            score = round(max(0.0, min(1.0, raw_score)), 2)
            confidence = min(1.0, round(total_points / 60, 2))

            # Average confidence of recent signals
            avg_confidence = 0.0
            if recent_rows:
                confs = [r.get("confidence", 0.5) for r in recent_rows if r.get("confidence")]
                avg_confidence = round(sum(confs) / len(confs), 2) if confs else 0.5

            if growth_rate > 0.2:
                reasoning = (
                    f"Demand trajectory is positive. Signal volume grew "
                    f"{round(growth_rate * 100)}% month-over-month "
                    f"({prior_count} -> {recent_count} signals). "
                    f"Average signal confidence: {avg_confidence}."
                )
            elif growth_rate > -0.2:
                reasoning = (
                    f"Demand trajectory is stable. Signal volume is flat "
                    f"({prior_count} -> {recent_count} signals). "
                    f"No significant change detected."
                )
            else:
                reasoning = (
                    f"Demand trajectory is declining. Signal volume dropped "
                    f"{round(abs(growth_rate) * 100)}% month-over-month "
                    f"({prior_count} -> {recent_count} signals). "
                    f"Investigate market conditions."
                )

            return {
                "score": score,
                "confidence": confidence,
                "reasoning": reasoning,
                "data_points": total_points,
                "horizon_days": 60,
                "details": {
                    "recent_count": recent_count,
                    "prior_count": prior_count,
                    "growth_rate": round(growth_rate, 3),
                    "avg_signal_confidence": avg_confidence,
                    "domain_breakdown_recent": domain_recent,
                    "domain_breakdown_prior": domain_prior,
                },
            }
        except Exception as e:
            logger.error(f"[predictive] _predict_demand_trajectory failed: {e}")
            return _insufficient_data_result(
                "Demand trajectory analysis encountered an error. Check integrations.",
                horizon_days=60,
            )

    def _predict_attrition_risk(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze team domain events for negative signals
        (departures, satisfaction decline).
        """
        try:
            now = datetime.now(timezone.utc)
            ninety_ago = (now - timedelta(days=90)).isoformat()

            result = self.sb.table("observation_events").select(
                "id, signal_type, detail, confidence, created_at"
            ).eq("user_id", user_id).eq("domain", "team").gte(
                "created_at", ninety_ago
            ).execute()

            rows = result.data or []
            if len(rows) < MIN_DATA_POINTS:
                return _insufficient_data_result(
                    "Not enough team data for attrition prediction. "
                    "Connect HR/team integrations for workforce insights.",
                    horizon_days=90,
                )

            negative_keywords = (
                "departure", "resign", "quit", "leave", "turnover",
                "dissatisf", "burnout", "overwork", "complaint",
                "decline", "negative", "conflict", "disengag"
            )
            positive_keywords = (
                "hire", "onboard", "promotion", "satisfaction",
                "engagement", "positive", "milestone", "recognition"
            )

            negative_signals = []
            positive_signals = []

            for row in rows:
                st = (row.get("signal_type") or "").lower()
                detail = (row.get("detail") or "").lower()
                combined = st + " " + detail

                if any(kw in combined for kw in negative_keywords):
                    negative_signals.append(row)
                elif any(kw in combined for kw in positive_keywords):
                    positive_signals.append(row)

            total_classified = len(negative_signals) + len(positive_signals)
            if total_classified == 0:
                return {
                    "score": 0.3,
                    "confidence": 0.2,
                    "reasoning": (
                        f"{len(rows)} team signals found but none clearly indicate "
                        f"positive or negative attrition trends. "
                        f"More specific team data would improve this prediction."
                    ),
                    "data_points": len(rows),
                    "horizon_days": 90,
                    "details": {
                        "total_team_signals": len(rows),
                        "classified": 0,
                    },
                }

            # Higher score = higher attrition risk
            negative_ratio = len(negative_signals) / total_classified
            score = round(min(1.0, negative_ratio), 2)
            confidence = min(1.0, round(total_classified / 20, 2))

            # Check trend: recent vs older negative signals
            forty_five_ago = now - timedelta(days=45)
            recent_negative = sum(
                1 for s in negative_signals
                if _parse_dt(s.get("created_at")) and _parse_dt(s.get("created_at")) > forty_five_ago
            )
            older_negative = len(negative_signals) - recent_negative
            trend_worsening = recent_negative > older_negative

            if score > 0.5:
                reasoning = (
                    f"Attrition risk is elevated. {len(negative_signals)} negative team signals "
                    f"vs {len(positive_signals)} positive signals in 90 days. "
                    f"{'Trend is worsening recently.' if trend_worsening else 'Trend appears stable.'}"
                )
            elif score > 0.2:
                reasoning = (
                    f"Moderate attrition indicators: {len(negative_signals)} negative, "
                    f"{len(positive_signals)} positive team signals. Monitor team sentiment."
                )
            else:
                reasoning = (
                    f"Team health appears solid. {len(positive_signals)} positive signals "
                    f"outweigh {len(negative_signals)} negative. Low attrition risk."
                )

            return {
                "score": score,
                "confidence": confidence,
                "reasoning": reasoning,
                "data_points": len(rows),
                "horizon_days": 90,
                "details": {
                    "negative_signals": len(negative_signals),
                    "positive_signals": len(positive_signals),
                    "total_team_signals": len(rows),
                    "recent_negative": recent_negative,
                    "trend_worsening": trend_worsening,
                },
            }
        except Exception as e:
            logger.error(f"[predictive] _predict_attrition_risk failed: {e}")
            return _insufficient_data_result(
                "Attrition analysis encountered an error. Check team integrations.",
                horizon_days=90,
            )


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def _insufficient_data_result(reasoning: str, horizon_days: int) -> Dict[str, Any]:
    """Standard response when a model has insufficient data."""
    return {
        "score": 0.0,
        "confidence": 0.1,
        "reasoning": reasoning,
        "data_points": 0,
        "horizon_days": horizon_days,
        "details": {"insufficient_data": True},
    }


def _parse_dt(value) -> datetime | None:
    """Safely parse an ISO datetime string."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
