"""Progressive onboarding checklist evaluator — Sprint B #12.

Pure function that reads each step's done-state from the live Supabase tables
and returns the shape consumed by GET /api/onboarding/progress and the frontend
OnboardingChecklist component. Kept import-free (no FastAPI, no auth) so it can
be unit-tested with a mocked `sb` client.

Tables (grep-confirmed in the codebase, not guessed):
  - business_dna_enrichment    keyed on user_id, upserted by calibration.py:2861
  - workspace_integrations     workspace_id (= user_id), integrations.py:824
  - email_connections          user_id + provider + connected, email.py:903
  - alerts_queue               viewed_at (alerts.py:297), dismissed_at (alerts.py:186)
  - observation_event_dismissals  mirrored by alerts dismiss handler (alerts.py:191)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ───────────────────────────────────────────────────────────────────────
# Step catalogue. Each entry is the single source of truth for label +
# helper_text + href + ghost-ness. helper_text MUST explain WHY the step
# matters — it's the onboarding nudge copy.
# ───────────────────────────────────────────────────────────────────────

STEP_DEFS: List[Dict[str, Any]] = [
    {
        "key": "signup",
        "label": "Sign up",
        "helper_text": "You're in — the first step to turning noise into decisions.",
        "href": None,
    },
    {
        "key": "calibration",
        "label": "Complete calibration",
        "helper_text": "Calibration tells BIQc your context so every signal maps to your business.",
        "href": "/market/calibration",
    },
    {
        "key": "integration",
        "label": "Connect first integration",
        "helper_text": "Integrations power the evidence — without them BIQc is running blind.",
        "href": "/integrations",
    },
    {
        "key": "signal_reviewed",
        "label": "Review first signal",
        "helper_text": "Reading a signal teaches BIQc what matters to you — it gets smarter each time.",
        "href": "/advisor",
    },
    {
        "key": "action_closed",
        "label": "Close first action",
        "helper_text": "Closing the loop is where retention compounds — signals become outcomes.",
        "href": "/actions",
    },
    {
        "key": "invite_teammate",
        "label": "Invite a teammate",
        "helper_text": "Coming soon with Pro — collaborative decisions, shared context.",
        "href": None,
        "ghost": True,
    },
]


def evaluate_onboarding_progress(sb, user_id: str) -> Dict[str, Any]:
    """Evaluate each onboarding step against live Supabase state.

    Parameters
    ----------
    sb
        Any object with a `.table(name)` method returning a Supabase-style
        chainable query builder (`.select().eq().not_.is_().order().limit()
        .execute()`). Tests pass a mocked client.
    user_id
        Current user's UUID.

    Returns
    -------
    dict with keys:
        steps               — list of 6 step dicts (key, label, helper_text,
                              href, ghost, done, done_at).
        percent_complete    — 0-100 integer, ghost step excluded from both
                              numerator and denominator.
        current_step_index  — index of the first not-done, not-ghost step,
                              or the ghost step's index if everything else
                              is done.
        countable_done      — number of non-ghost steps complete.
        countable_total     — number of non-ghost steps (always 5).
    """
    steps: List[Dict[str, Any]] = []

    def _mk(key: str, done: bool, done_at: Optional[str] = None) -> Dict[str, Any]:
        defn = next(s for s in STEP_DEFS if s["key"] == key)
        return {
            "key": key,
            "label": defn["label"],
            "helper_text": defn["helper_text"],
            "href": defn.get("href"),
            "ghost": defn.get("ghost", False),
            "done": bool(done),
            "done_at": done_at,
        }

    # 1. Sign up — always done (caller has auth'd).
    steps.append(_mk("signup", True, None))

    # 2. Calibration — row in business_dna_enrichment keyed on user_id.
    try:
        res = sb.table("business_dna_enrichment").select(
            "user_id, updated_at"
        ).eq("user_id", user_id).limit(1).execute()
        row = (res.data or [None])[0]
        steps.append(_mk("calibration", bool(row), (row or {}).get("updated_at")))
    except Exception as e:
        logger.warning(f"[onboarding/progress] calibration check failed: {e}")
        steps.append(_mk("calibration", False))

    # 3. Integration — workspace_integrations.status == 'connected' (primary)
    #    OR email_connections.connected == True (fallback).
    integration_done = False
    integration_at: Optional[str] = None
    try:
        res = sb.table("workspace_integrations").select(
            "status, connected_at"
        ).eq("workspace_id", user_id).eq("status", "connected").limit(1).execute()
        row = (res.data or [None])[0]
        if row:
            integration_done = True
            integration_at = row.get("connected_at")
    except Exception as e:
        logger.warning(f"[onboarding/progress] workspace_integrations check failed: {e}")
    if not integration_done:
        try:
            res = sb.table("email_connections").select(
                "provider, connected"
            ).eq("user_id", user_id).eq("connected", True).limit(1).execute()
            row = (res.data or [None])[0]
            if row:
                integration_done = True
        except Exception as e:
            logger.warning(f"[onboarding/progress] email_connections check failed: {e}")
    steps.append(_mk("integration", integration_done, integration_at))

    # 4. Signal reviewed — alerts_queue row with viewed_at NOT NULL.
    signal_done = False
    signal_at: Optional[str] = None
    try:
        res = sb.table("alerts_queue").select(
            "viewed_at"
        ).eq("user_id", user_id).not_.is_("viewed_at", "null").order(
            "viewed_at", desc=True
        ).limit(1).execute()
        row = (res.data or [None])[0]
        if row:
            signal_done = True
            signal_at = row.get("viewed_at")
    except Exception as e:
        logger.warning(f"[onboarding/progress] alerts_queue viewed check failed: {e}")
    steps.append(_mk("signal_reviewed", signal_done, signal_at))

    # 5. Action closed — alerts_queue.dismissed_at OR observation_event_dismissals.
    action_done = False
    action_at: Optional[str] = None
    try:
        res = sb.table("alerts_queue").select(
            "dismissed_at"
        ).eq("user_id", user_id).not_.is_("dismissed_at", "null").order(
            "dismissed_at", desc=True
        ).limit(1).execute()
        row = (res.data or [None])[0]
        if row:
            action_done = True
            action_at = row.get("dismissed_at")
    except Exception as e:
        logger.warning(f"[onboarding/progress] alerts_queue dismissed check failed: {e}")
    if not action_done:
        try:
            res = sb.table("observation_event_dismissals").select(
                "dismissed_at"
            ).eq("user_id", user_id).order(
                "dismissed_at", desc=True
            ).limit(1).execute()
            row = (res.data or [None])[0]
            if row:
                action_done = True
                action_at = row.get("dismissed_at")
        except Exception as e:
            logger.warning(f"[onboarding/progress] observation_event_dismissals check failed: {e}")
    steps.append(_mk("action_closed", action_done, action_at))

    # 6. Invite teammate — ghost placeholder (Sprint E #43 multi-user).
    steps.append(_mk("invite_teammate", False))

    # Aggregate. Ghost steps excluded from numerator AND denominator.
    counted = [s for s in steps if not s.get("ghost")]
    done_count = sum(1 for s in counted if s["done"])
    total = len(counted) or 1
    percent = round(100.0 * done_count / total)

    current_index = None
    for idx, s in enumerate(steps):
        if not s["done"] and not s.get("ghost"):
            current_index = idx
            break
    if current_index is None:
        current_index = next(
            (i for i, s in enumerate(steps) if s.get("ghost")), len(steps) - 1
        )

    return {
        "steps": steps,
        "percent_complete": percent,
        "current_step_index": current_index,
        "countable_done": done_count,
        "countable_total": total,
    }
