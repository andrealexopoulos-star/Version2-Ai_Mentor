"""Demo data seeder for new BIQc accounts.

Idempotent: only seeds if user has zero observation_events.
Purpose: give new signups an immediate 'magic moment' instead of
a 30-second blank dashboard while backend synthesizes their real data.
"""
import logging
from datetime import datetime, timedelta, timezone

log = logging.getLogger(__name__)

DEMO_OBSERVATION_EVENTS = [
    {"domain": "pipeline", "event_type": "deal_stall",
     "severity": "warning",
     "payload": {"deal_name": "Acme Corp Q2", "days_in_stage": 21,
                 "value": 45000}},
    {"domain": "pipeline", "event_type": "pipeline_decay",
     "severity": "critical",
     "payload": {"active_count": 8, "previous_count": 14,
                 "decay_pct": 43}},
    {"domain": "finance", "event_type": "cash_runway_alert",
     "severity": "warning",
     "payload": {"months_runway": 4.2, "burn_rate": 38000}},
    {"domain": "team", "event_type": "meeting_overload",
     "severity": "info",
     "payload": {"weekly_meetings": 32, "baseline": 20}},
    {"domain": "customer", "event_type": "churn_risk",
     "severity": "warning",
     "payload": {"at_risk_count": 3, "mrr_at_risk": 4500}},
    {"domain": "product", "event_type": "feature_adoption_low",
     "severity": "info",
     "payload": {"feature": "Advanced Reports", "adoption_pct": 12}},
    {"domain": "market", "event_type": "competitor_move",
     "severity": "info",
     "payload": {"competitor": "Sample Co", "action": "price_drop_15pct"}},
    {"domain": "operations", "event_type": "process_friction",
     "severity": "info",
     "payload": {"process": "Invoice Approval", "avg_delay_days": 4.5}},
]

DEMO_INSIGHTS = [
    {"domain": "pipeline", "position": "DETERIORATING",
     "previous_position": "STABLE",
     "finding": "Sales pipeline decayed 43% over 14 days. 2 enterprise deals stalled.",
     "confidence": 0.82},
    {"domain": "finance", "position": "ELEVATED",
     "previous_position": "STABLE",
     "finding": "Cash runway at 4.2 months. Burn rate up 12% this quarter.",
     "confidence": 0.91},
    {"domain": "customer", "position": "ELEVATED",
     "previous_position": "STABLE",
     "finding": "3 customers showing churn signals worth $4,500 MRR.",
     "confidence": 0.74},
    {"domain": "team", "position": "STABLE",
     "previous_position": "STABLE",
     "finding": "Meeting load 60% above baseline but team velocity holding.",
     "confidence": 0.68},
]


def seed_demo_account(supabase, user_id: str) -> dict:
    """Seed sample data ONLY if user has zero events. Idempotent."""
    try:
        existing = (
            supabase.table("observation_events")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        existing_count = getattr(existing, "count", None) or 0
    except Exception as e:
        log.exception("seed_demo_account: existence check failed")
        return {"seeded": False, "reason": "existence_check_failed",
                "error": str(e)}

    if existing_count > 0:
        log.info("seed_demo_account: skip — user %s already has %d events",
                 user_id, existing_count)
        return {"seeded": False, "reason": "user_has_data",
                "existing_count": existing_count}

    now = datetime.now(timezone.utc)
    events_inserted = 0
    for idx, ev in enumerate(DEMO_OBSERVATION_EVENTS):
        row = {
            "user_id": user_id,
            "domain": ev["domain"],
            "event_type": ev["event_type"],
            "severity": ev["severity"],
            "payload": ev["payload"],
            "source": "demo_seed",
            "observed_at": (now - timedelta(hours=idx * 6)).isoformat(),
        }
        try:
            supabase.table("observation_events").insert(row).execute()
            events_inserted += 1
        except Exception as e:
            log.warning("seed_demo_account: event insert failed: %s", e)

    insights_inserted = 0
    for ins in DEMO_INSIGHTS:
        row = {
            "user_id": user_id,
            "domain": ins["domain"],
            "position": ins["position"],
            "previous_position": ins["previous_position"],
            "finding": ins["finding"],
            "confidence": ins["confidence"],
            "source_event_ids": [],
            "detected_at": now.isoformat(),
        }
        try:
            supabase.table("watchtower_insights").insert(row).execute()
            insights_inserted += 1
        except Exception as e:
            log.warning("seed_demo_account: insight insert failed: %s", e)

    log.info(
        "seed_demo_account: user=%s events=%d insights=%d",
        user_id, events_inserted, insights_inserted,
    )
    return {
        "seeded": True,
        "events_inserted": events_inserted,
        "insights_inserted": insights_inserted,
    }
