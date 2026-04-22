"""
Signals Routes — Sprint B #17 (2026-04-22)

Snooze + structured feedback on observation_events.

Complements:
- alerts.py          — Alert-centre dismissals (mirrored into observation_event_dismissals)
- intelligence_live_truth.py — Read path that surfaces the Advisor signal feed
- services/priority_scorer.py — Sprint B #15 scorer that consumes feedback signals

Endpoints:
- POST   /signals/{event_id}/snooze        body={until, source_surface?}
- DELETE /signals/{event_id}/snooze
- POST   /signals/{event_id}/feedback      body={feedback_key, note?, source_surface?}
- GET    /signals/feedback/taxonomy        returns the canonical enum + UX copy

Each write is enforced by the observation_events FK + Postgres CHECK constraint
on signal_feedback.feedback_key (see migration 122). Service-role writes bypass
RLS; the per-user filter is enforced in code via current_user['id'].
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field, field_validator

from routes.auth import get_current_user
from supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Taxonomy — canonical feedback keys ─────────────────────────────────────
# Mirrors the CHECK constraint on signal_feedback.feedback_key (migration 122).
# If this enum grows, update BOTH the DB constraint AND this list in the same
# migration.
FEEDBACK_KEY_LITERAL = Literal[
    "not_relevant",
    "already_done",
    "incorrect",
    "need_more_info",
]

FEEDBACK_TAXONOMY = [
    {
        "key": "not_relevant",
        "label": "Not relevant to me",
        "help": "Signal is real but doesn't apply to my business.",
        "priority_weight": -0.5,  # down-weight future similar emissions
    },
    {
        "key": "already_done",
        "label": "Already done",
        "help": "I've handled this — no further action needed.",
        "priority_weight": -0.7,  # strongly down-weight
    },
    {
        "key": "incorrect",
        "label": "Looks wrong",
        "help": "The signal itself is inaccurate or miscategorised.",
        "priority_weight": -0.9,  # almost-hide; also flag for content review
    },
    {
        "key": "need_more_info",
        "label": "Need more context",
        "help": "Can't act without additional information.",
        "priority_weight": 0.0,   # neutral — keep surfacing, note the gap
    },
]


class SnoozeRequest(BaseModel):
    until: datetime = Field(..., description="ISO8601 timestamp when snooze expires. Must be in the future.")
    source_surface: Optional[str] = Field(None, max_length=32)

    @field_validator("until")
    @classmethod
    def _future_only(cls, v: datetime) -> datetime:
        # Normalise to UTC; reject past timestamps.
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v <= datetime.now(timezone.utc):
            raise ValueError("snooze `until` must be in the future")
        return v


class FeedbackRequest(BaseModel):
    feedback_key: FEEDBACK_KEY_LITERAL
    note: Optional[str] = Field(None, max_length=1000)
    source_surface: Optional[str] = Field(None, max_length=32)


# ─── POST /signals/{event_id}/snooze ─────────────────────────────────────────
@router.post("/signals/{event_id}/snooze")
async def snooze_signal(
    body: SnoozeRequest,
    event_id: str = Path(..., min_length=1),
    current_user: dict = Depends(get_current_user),
):
    """Snooze a signal until `until`. Repeated snoozes overwrite the timestamp
    via upsert on (user_id, event_id) — the migration's UNIQUE constraint."""
    sb = get_supabase_admin()
    user_id = current_user["id"]

    payload = {
        "user_id": user_id,
        "event_id": event_id,
        "snoozed_until": body.until.isoformat(),
        "source_surface": body.source_surface,
    }
    try:
        res = (
            sb.table("signal_snoozes")
            .upsert(payload, on_conflict="user_id,event_id")
            .execute()
        )
    except Exception as exc:
        logger.exception("[signals.snooze] upsert failed for user=%s event=%s", user_id, event_id)
        # 404 if FK target (observation_events) missing — be specific.
        msg = str(exc)
        if "violates foreign key" in msg:
            raise HTTPException(status_code=404, detail="observation event not found")
        raise HTTPException(status_code=500, detail="snooze failed")

    return {"ok": True, "snooze": (res.data or [None])[0]}


# ─── DELETE /signals/{event_id}/snooze ───────────────────────────────────────
@router.delete("/signals/{event_id}/snooze")
async def unsnooze_signal(
    event_id: str = Path(..., min_length=1),
    current_user: dict = Depends(get_current_user),
):
    sb = get_supabase_admin()
    user_id = current_user["id"]
    (
        sb.table("signal_snoozes")
        .delete()
        .eq("user_id", user_id)
        .eq("event_id", event_id)
        .execute()
    )
    return {"ok": True}


# ─── POST /signals/{event_id}/feedback ───────────────────────────────────────
@router.post("/signals/{event_id}/feedback")
async def leave_feedback(
    body: FeedbackRequest,
    event_id: str = Path(..., min_length=1),
    current_user: dict = Depends(get_current_user),
):
    """Append a structured feedback row. Multiple feedback rows per event are
    allowed — they track the user's evolving view on a signal."""
    sb = get_supabase_admin()
    user_id = current_user["id"]

    payload = {
        "user_id": user_id,
        "event_id": event_id,
        "feedback_key": body.feedback_key,
        "note": body.note,
        "source_surface": body.source_surface,
    }
    try:
        res = sb.table("signal_feedback").insert(payload).execute()
    except Exception as exc:
        logger.exception("[signals.feedback] insert failed for user=%s event=%s", user_id, event_id)
        msg = str(exc)
        if "violates foreign key" in msg:
            raise HTTPException(status_code=404, detail="observation event not found")
        if "signal_feedback_key_allowed" in msg:
            # Shouldn't happen since Pydantic Literal validates first, but
            # belt-and-braces against drift between DB enum and Literal above.
            raise HTTPException(status_code=400, detail="unsupported feedback_key")
        raise HTTPException(status_code=500, detail="feedback failed")

    return {"ok": True, "feedback": (res.data or [None])[0]}


# ─── GET /signals/feedback/taxonomy ──────────────────────────────────────────
@router.get("/signals/feedback/taxonomy")
async def feedback_taxonomy():
    """Returns the canonical feedback enum + UX copy + scorer weights.
    Frontends should call this on mount rather than hard-coding strings so
    new feedback keys (or copy tweaks) roll out without a deploy."""
    return {"taxonomy": FEEDBACK_TAXONOMY}
