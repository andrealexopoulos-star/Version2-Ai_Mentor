"""
Sprint B #12 — Progressive onboarding checklist unit tests.

Mocks the Supabase query builder per table and asserts each step's `done`
flag toggles correctly based on the respective table's state. No network, no
live DB. See backend/routes/onboarding.py::_evaluate_onboarding_progress.

Tables covered (grep-confirmed):
  - business_dna_enrichment (calibration, upserted by calibration.py:2861)
  - workspace_integrations  (integration, upserted by integrations.py:824)
  - email_connections       (integration fallback, email.py:903/1175)
  - alerts_queue            (viewed_at → step 4; dismissed_at → step 5)
  - observation_event_dismissals (fallback for step 5)
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest

# Ensure backend/ is importable when running from repo root.
_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


# ───────────────────────────────────────────────────────────────────────
# Mock Supabase query builder. Supports the chained-builder style used in
# routes/onboarding.py: sb.table(x).select(...).eq(...).not_.is_(...)
# .order(...).limit(...).execute().
# ───────────────────────────────────────────────────────────────────────


class _Result:
    def __init__(self, data: Optional[List[Dict[str, Any]]]):
        self.data = data


class _QueryBuilder:
    """Chainable no-op builder that returns a pre-programmed result."""

    def __init__(self, rows: Optional[List[Dict[str, Any]]]):
        self._rows = rows
        # `not_` is a namespace on the real Supabase client (sb...not_.is_(...)).
        self.not_ = self

    def select(self, *_a, **_k): return self
    def eq(self, *_a, **_k): return self
    def is_(self, *_a, **_k): return self
    def order(self, *_a, **_k): return self
    def limit(self, *_a, **_k): return self

    def execute(self) -> _Result:
        return _Result(self._rows)


class _MockSB:
    """Mock Supabase admin client. Each table name maps to a canned result."""

    def __init__(self, table_rows: Optional[Dict[str, List[Dict[str, Any]]]] = None):
        self._map = table_rows or {}

    def table(self, name: str) -> _QueryBuilder:
        rows = self._map.get(name)
        # Always return a fresh builder — `.not_` attr must not persist mutation.
        return _QueryBuilder(rows if rows is not None else [])


@pytest.fixture
def evaluator():
    """Import the pure evaluator from services/ — no FastAPI / Supabase SDK
    imports, so this fixture works on any Python >=3.7."""
    from services.onboarding_progress import evaluate_onboarding_progress
    return evaluate_onboarding_progress


USER_ID = "11111111-1111-1111-1111-111111111111"


# ───────────────────────────────────────────────────────────────────────
# Step 1 — Sign up. Always done (endpoint is auth-guarded).
# ───────────────────────────────────────────────────────────────────────


def test_step1_signup_always_done(evaluator):
    sb = _MockSB()  # empty everything
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "signup")
    assert step["done"] is True, "Sign up must always be done — route is authenticated"


# ───────────────────────────────────────────────────────────────────────
# Step 2 — Calibration via business_dna_enrichment.
# ───────────────────────────────────────────────────────────────────────


def test_step2_calibration_not_done_when_no_row(evaluator):
    sb = _MockSB({"business_dna_enrichment": []})
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "calibration")
    assert step["done"] is False


def test_step2_calibration_done_when_row_exists(evaluator):
    sb = _MockSB({
        "business_dna_enrichment": [
            {"user_id": USER_ID, "updated_at": "2026-04-22T10:00:00Z"}
        ]
    })
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "calibration")
    assert step["done"] is True
    assert step["done_at"] == "2026-04-22T10:00:00Z"


# ───────────────────────────────────────────────────────────────────────
# Step 3 — Integration (workspace_integrations OR email_connections).
# ───────────────────────────────────────────────────────────────────────


def test_step3_integration_not_done_when_both_empty(evaluator):
    sb = _MockSB({"workspace_integrations": [], "email_connections": []})
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "integration")
    assert step["done"] is False


def test_step3_integration_done_via_workspace_integrations(evaluator):
    sb = _MockSB({
        "workspace_integrations": [
            {"status": "connected", "connected_at": "2026-04-22T09:00:00Z"}
        ],
        "email_connections": [],
    })
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "integration")
    assert step["done"] is True
    assert step["done_at"] == "2026-04-22T09:00:00Z"


def test_step3_integration_done_via_email_connections_fallback(evaluator):
    sb = _MockSB({
        "workspace_integrations": [],  # primary empty
        "email_connections": [{"provider": "gmail", "connected": True}],
    })
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "integration")
    assert step["done"] is True


# ───────────────────────────────────────────────────────────────────────
# Step 4 — Signal reviewed (alerts_queue.viewed_at NOT NULL).
# ───────────────────────────────────────────────────────────────────────


def test_step4_signal_reviewed_not_done_when_no_viewed_row(evaluator):
    sb = _MockSB({"alerts_queue": []})
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "signal_reviewed")
    assert step["done"] is False


def test_step4_signal_reviewed_done_when_viewed_row_exists(evaluator):
    # Builder is naive; we stub the filtered result directly.
    sb = _MockSB({
        "alerts_queue": [{"viewed_at": "2026-04-22T11:00:00Z"}]
    })
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "signal_reviewed")
    assert step["done"] is True
    assert step["done_at"] == "2026-04-22T11:00:00Z"


# ───────────────────────────────────────────────────────────────────────
# Step 5 — Action closed (alerts_queue.dismissed_at NOT NULL OR
# observation_event_dismissals fallback).
# ───────────────────────────────────────────────────────────────────────


def test_step5_action_closed_not_done_when_all_empty(evaluator):
    sb = _MockSB({"alerts_queue": [], "observation_event_dismissals": []})
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "action_closed")
    assert step["done"] is False


def test_step5_action_closed_done_via_alerts_queue(evaluator):
    # The evaluator runs two queries against alerts_queue (viewed then dismissed)
    # — the mock returns the same canned rows for both. That's fine for this
    # assertion because we only care that `action_closed` flips true when the
    # dismissed_at row exists.
    sb = _MockSB({
        "alerts_queue": [{"dismissed_at": "2026-04-22T12:00:00Z"}]
    })
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "action_closed")
    assert step["done"] is True
    assert step["done_at"] == "2026-04-22T12:00:00Z"


def test_step5_action_closed_done_via_dismissals_fallback(evaluator):
    # alerts_queue empty → fall back to observation_event_dismissals.
    sb = _MockSB({
        "alerts_queue": [],
        "observation_event_dismissals": [
            {"dismissed_at": "2026-04-22T13:00:00Z"}
        ],
    })
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "action_closed")
    assert step["done"] is True


# ───────────────────────────────────────────────────────────────────────
# Step 6 — Invite teammate ghost. Never done; marked ghost=True.
# ───────────────────────────────────────────────────────────────────────


def test_step6_invite_teammate_is_ghost_and_never_done(evaluator):
    # Even with everything else done, step 6 stays a ghost placeholder
    # until Sprint E #43 multi-user ships.
    sb = _MockSB({
        "business_dna_enrichment": [{"user_id": USER_ID, "updated_at": "x"}],
        "workspace_integrations": [{"status": "connected", "connected_at": "x"}],
        "alerts_queue": [{"viewed_at": "x", "dismissed_at": "x"}],
    })
    out = evaluator(sb, USER_ID)
    step = next(s for s in out["steps"] if s["key"] == "invite_teammate")
    assert step["done"] is False
    assert step["ghost"] is True


# ───────────────────────────────────────────────────────────────────────
# Aggregate behaviour — percent_complete + current_step_index.
# ───────────────────────────────────────────────────────────────────────


def test_fresh_signup_only_step1_done(evaluator):
    """User just signed up 30 sec ago → only step 1 done."""
    sb = _MockSB()  # every table empty
    out = evaluator(sb, USER_ID)
    # Countable steps = 5 (signup + 4 real milestones; ghost excluded).
    assert out["countable_total"] == 5
    assert out["countable_done"] == 1
    assert out["percent_complete"] == 20  # 1/5
    # current_step_index points to calibration (index 1).
    assert out["current_step_index"] == 1
    assert out["steps"][out["current_step_index"]]["key"] == "calibration"


def test_percent_complete_excludes_ghost_step(evaluator):
    """All 5 counted steps done → 100%, ghost step 6 still not done."""
    sb = _MockSB({
        "business_dna_enrichment": [{"user_id": USER_ID, "updated_at": "x"}],
        "workspace_integrations": [{"status": "connected", "connected_at": "x"}],
        "alerts_queue": [{"viewed_at": "x", "dismissed_at": "x"}],
    })
    out = evaluator(sb, USER_ID)
    assert out["percent_complete"] == 100
    assert out["countable_done"] == 5
    # All countable steps done → current_step_index points at the ghost.
    ghost_idx = next(
        i for i, s in enumerate(out["steps"]) if s["key"] == "invite_teammate"
    )
    assert out["current_step_index"] == ghost_idx


def test_response_shape_has_all_required_keys(evaluator):
    sb = _MockSB()
    out = evaluator(sb, USER_ID)
    assert set(out.keys()) >= {
        "steps", "percent_complete", "current_step_index",
        "countable_done", "countable_total",
    }
    assert len(out["steps"]) == 6
    for step in out["steps"]:
        assert set(step.keys()) >= {
            "key", "label", "helper_text", "href", "ghost", "done", "done_at"
        }
        # helper_text must exist and explain WHY — not be empty.
        assert isinstance(step["helper_text"], str) and len(step["helper_text"]) > 10


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v", "--tb=short"]))
