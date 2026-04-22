"""BIQc Alerts Queue — Phase 6.5 alert flow system.

Backend API for the alerts_queue table. User-facing alerts are emitted by
cognitive/market/data-change workers, shown to users via the React useAlerts
hook, and cleared when users visit the target page or explicitly dismiss.

Every lifecycle timestamp (delivered/viewed/dismissed/actioned) is a learning
signal for the Phase 6.14 cognitive learner that personalizes routing.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from routes.auth import get_current_user
from supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class AlertPayload(BaseModel):
    """Content shown in the alert banner.

    ``observation_event_id`` / ``fingerprint`` are optional cross-surface
    linking keys. When an alert was emitted off the back of an
    ``observation_events`` row, the emitter SHOULD set one of these so the
    dismiss handler can mirror the dismissal into
    ``observation_event_dismissals`` (migration 116) and keep the Advisor
    Live Signal Feed consistent with the Alerts page.
    """
    title: str = Field(..., max_length=200)
    body: Optional[str] = Field(None, max_length=600)
    cta_label: Optional[str] = Field(None, max_length=50)
    cta_href: Optional[str] = Field(None, max_length=300)
    icon: Optional[str] = Field(None, max_length=50)          # lucide icon name
    severity: Optional[str] = Field('info', pattern='^(urgent|warning|info|success)$')
    # Cross-surface dismissal linking (Sprint A #8 follow-up).
    # Prefer observation_event_id when the emitter already has the UUID.
    # Fall back to fingerprint — the dismiss handler will join on it.
    observation_event_id: Optional[str] = Field(None, max_length=64)
    fingerprint: Optional[str] = Field(None, max_length=300)


class AlertEmit(BaseModel):
    """Payload for /alerts/emit — used by backend workers."""
    user_id: str
    type: str = Field(..., max_length=80)        # 'market_change', 'data_change', 'churn_risk', ...
    source: str = Field(..., max_length=80)      # 'market_scanner', 'hubspot', ...
    target_page: Optional[str] = Field(None, max_length=200)
    payload: AlertPayload
    priority: int = Field(3, ge=1, le=5)
    weight: float = Field(0.5, ge=0.0, le=1.0)


class AlertAction(BaseModel):
    action_taken: Optional[str] = Field(None, max_length=200)


class AlertFeedback(BaseModel):
    feedback: int = Field(..., ge=-1, le=1)  # -1, 0, 1


# ─── Seed logic — Phase 6.6 first-landing alert ──────────────────────────────

def _seed_welcome_market_alert_if_needed(sb, user_id: str) -> None:
    """Phase 6.6 — emit the "Visit Market Insights & Benchmark" alert on first
    landing after calibration. Idempotent: won't emit if one already exists
    (even if dismissed or viewed).
    """
    try:
        existing = sb.table('alerts_queue') \
            .select('id') \
            .eq('user_id', user_id) \
            .eq('type', 'welcome_market') \
            .limit(1) \
            .execute()
        if existing.data:
            return  # already seeded (in any state)

        # Check user completed calibration.
        # The schema has `last_calibration_step INT` (not `calibration_complete BOOL`).
        # calibration.py:3133 / :3178 set last_calibration_step=9 on completion,
        # so `>= 9` is the "calibration is done" threshold.
        # 2026-04-19 P0-e fix: previous query asked for a missing column and
        # was silently erroring for every user, so the welcome-market alert
        # was never being seeded.
        prof = sb.table('business_profiles') \
            .select('user_id, last_calibration_step, updated_at') \
            .eq('user_id', user_id) \
            .limit(1) \
            .execute()
        if not prof.data or (prof.data[0].get('last_calibration_step') or 0) < 9:
            return  # hasn't finished calibration yet

        sb.table('alerts_queue').insert({
            'user_id': user_id,
            'type': 'welcome_market',
            'source': 'onboarding',
            'target_page': '/market',
            'priority': 2,
            'weight': 0.9,
            'payload': {
                'title': 'Start with Market Insights & Benchmark',
                'body': "Your BIQc has mapped your business. Visit Market to see where you stand against the competition, and what moved in your industry this week.",
                'cta_label': 'Open Market',
                'cta_href': '/market',
                'icon': 'Radar',
                'severity': 'info',
            },
        }).execute()
    except Exception as e:
        logger.warning(f"[alerts] welcome_market seed failed for user={user_id}: {e}")


# ─── GET /alerts/active — used by useAlerts hook ─────────────────────────────

@router.get("/alerts/active")
async def list_active_alerts(current_user: dict = Depends(get_current_user)):
    """Return all undismissed, unviewed alerts for the current user, priority-ordered.

    Marks them as `delivered_at = now()` on first pull so we track delivery latency
    (Phase 6.14 learning signal: how fast after emit did the user see it?).

    Also opportunistically seeds the Phase 6.6 welcome-market alert on first
    post-calibration call. Idempotent.
    """
    sb = get_supabase_admin()
    user_id = current_user['id']

    # Phase 6.6 — seed welcome Market alert if user completed calibration + no
    # welcome_market alert yet exists. No-op otherwise. Runs before fetch so
    # the newly seeded alert appears in the same response.
    _seed_welcome_market_alert_if_needed(sb, user_id)

    # Fetch active alerts
    res = sb.table('alerts_queue') \
        .select('id, type, source, target_page, payload, priority, weight, created_at, delivered_at') \
        .eq('user_id', user_id) \
        .is_('viewed_at', 'null') \
        .is_('dismissed_at', 'null') \
        .order('priority') \
        .order('created_at', desc=True) \
        .execute()

    alerts = res.data or []

    # Mark freshly-pulled alerts as delivered (first time shown)
    undelivered_ids = [a['id'] for a in alerts if a.get('delivered_at') is None]
    if undelivered_ids:
        try:
            sb.table('alerts_queue') \
                .update({'delivered_at': datetime.now(timezone.utc).isoformat()}) \
                .in_('id', undelivered_ids) \
                .execute()
        except Exception as e:
            logger.warning(f"[alerts] failed to mark delivered_at: {e}")

    return {'alerts': alerts, 'count': len(alerts)}


# ─── POST /alerts/{id}/view — explicit acknowledge ───────────────────────────

@router.post("/alerts/{alert_id}/view")
async def mark_viewed(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Explicitly mark an alert as viewed. Usually called when user clicks into it."""
    sb = get_supabase_admin()
    sb.table('alerts_queue') \
        .update({'viewed_at': datetime.now(timezone.utc).isoformat()}) \
        .eq('id', alert_id) \
        .eq('user_id', current_user['id']) \
        .execute()
    return {'ok': True}


# ─── POST /alerts/{id}/dismiss — X button ────────────────────────────────────

@router.post("/alerts/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    """User explicitly dismissed the alert. Strong negative learning signal."""
    sb = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    res = sb.table('alerts_queue') \
        .update({'dismissed_at': now, 'viewed_at': now}) \
        .eq('id', alert_id) \
        .eq('user_id', current_user['id']) \
        .execute()

    # Mirror into observation_event_dismissals so a signal dismissed from the
    # Alerts page also vanishes from the Advisor Live Signal Feed rendered
    # out of observation_events (migration 116, Sprint A #8).
    #
    # Mapping (in order of preference):
    #   1. payload.observation_event_id / payload.event_id  — direct UUID
    #   2. payload.fingerprint joined to observation_events.fingerprint
    #      for this user — unique index exists on (user_id, fingerprint).
    #
    # Failures here MUST NOT fail the primary dismiss. The helper itself uses
    # upsert ON CONFLICT DO NOTHING so double-clicks and retries are safe.
    try:
        row = (res.data or [{}])[0] if res and res.data else {}
        payload = row.get('payload') or {}
        if isinstance(payload, str):
            import json as _json
            try:
                payload = _json.loads(payload)
            except Exception:
                payload = {}

        obs_event_id = (
            payload.get('observation_event_id')
            or payload.get('event_id')
            or row.get('observation_event_id')
        )

        # Fingerprint fallback — look up the observation_events row by
        # (user_id, fingerprint). If no match, this alert simply wasn't
        # sourced from an observation event and we no-op silently.
        if not obs_event_id:
            fp = payload.get('fingerprint') or row.get('fingerprint')
            if fp:
                try:
                    fp_result = sb.table('observation_events').select('id') \
                        .eq('user_id', current_user['id']) \
                        .eq('fingerprint', fp) \
                        .limit(1) \
                        .execute()
                    if fp_result.data:
                        obs_event_id = fp_result.data[0].get('id')
                except Exception as fp_err:
                    logger.warning(
                        f"[alerts/dismiss] fingerprint lookup failed alert={alert_id} fp={fp}: {fp_err}"
                    )

        if obs_event_id:
            from intelligence_live_truth import record_observation_event_dismissal
            record_observation_event_dismissal(sb, current_user['id'], str(obs_event_id), 'alerts')
    except Exception as e:
        logger.warning(f"[alerts/dismiss] observation_event mirror failed: {e}")

    return {'ok': True}


# ─── POST /alerts/{id}/action — user clicked CTA ─────────────────────────────

@router.post("/alerts/{alert_id}/action")
async def mark_actioned(alert_id: str, body: AlertAction, current_user: dict = Depends(get_current_user)):
    """User clicked the alert's CTA. Positive learning signal."""
    sb = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    updates = {
        'actioned_at': now,
        'viewed_at': now,
    }
    if body.action_taken:
        updates['action_taken'] = body.action_taken
    sb.table('alerts_queue') \
        .update(updates) \
        .eq('id', alert_id) \
        .eq('user_id', current_user['id']) \
        .execute()
    return {'ok': True}


# ─── POST /alerts/{id}/feedback — thumbs up/down (6.14) ──────────────────────

@router.post("/alerts/{alert_id}/feedback")
async def set_feedback(alert_id: str, body: AlertFeedback, current_user: dict = Depends(get_current_user)):
    """User rated the alert. Feeds 6.14 learner."""
    sb = get_supabase_admin()
    sb.table('alerts_queue') \
        .update({'feedback': body.feedback}) \
        .eq('id', alert_id) \
        .eq('user_id', current_user['id']) \
        .execute()
    return {'ok': True}


# ─── POST /alerts/visit — page-visit clearer ─────────────────────────────────

class AlertVisit(BaseModel):
    target_page: str


@router.post("/alerts/visit")
async def visit_page(body: AlertVisit, current_user: dict = Depends(get_current_user)):
    """User visited a page — mark all alerts with target_page=X as viewed.

    Used by MarketPage (and any other page) to clear their own alerts on mount.
    This is the "alerts disappear when user visits Market" behaviour Andreas asked for.
    """
    sb = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    res = sb.table('alerts_queue') \
        .update({'viewed_at': now}) \
        .eq('user_id', current_user['id']) \
        .eq('target_page', body.target_page) \
        .is_('viewed_at', 'null') \
        .execute()
    cleared = len(res.data or [])
    return {'ok': True, 'cleared': cleared}


# ─── POST /alerts/emit — backend worker entrypoint ───────────────────────────

@router.post("/alerts/emit")
async def emit_alert(body: AlertEmit, current_user: dict = Depends(get_current_user)):
    """Emit an alert for a user. Called by cognitive/data-change workers.

    Requires super-admin or service-role auth. A user cannot emit alerts for
    another user (enforced here + RLS).
    """
    # Only super_admin users can emit for arbitrary user_id. Otherwise enforce self.
    if current_user.get('role') != 'super_admin' and body.user_id != current_user['id']:
        raise HTTPException(status_code=403, detail='Cannot emit alert for another user')

    sb = get_supabase_admin()
    res = sb.table('alerts_queue').insert({
        'user_id': body.user_id,
        'type': body.type,
        'source': body.source,
        'target_page': body.target_page,
        'payload': body.payload.model_dump(exclude_none=True),
        'priority': body.priority,
        'weight': body.weight,
    }).execute()
    return {'ok': True, 'alert': (res.data or [{}])[0]}
