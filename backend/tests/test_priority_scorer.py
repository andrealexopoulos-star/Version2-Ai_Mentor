"""
Tests for services.priority_scorer.compute_top_actions (Sprint B #15).

Covers:
  (a) empty candidates -> no actions
  (b) 5 candidates     -> top-2 with distinct, decreasing risk scores
  (c) tie-break by recency (more-recent wins when scores match)
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

# Make `backend/` importable when pytest is run from the repo root.
_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from services.priority_scorer import (  # noqa: E402
    compute_risk_score,
    compute_top_actions,
    PersonalizationContext,
    fetch_personalization_context,
)


def _ts(hours_ago: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()


def test_empty_candidates_returns_no_actions():
    """(a) 0 candidates -> 0 actions. Caller renders 'All quiet' copy."""
    assert compute_top_actions([], n=2) == []
    assert compute_top_actions(None, n=2) == []  # type: ignore[arg-type]


def test_five_candidates_returns_top_two_with_distinct_scores():
    """(b) 5 varied candidates -> top-2 by real priority, scores decreasing."""
    candidates = [
        {
            "signal_key": "xero-overdue-invoices",
            "bucket_hint": "decide_now",
            "severity": "critical",
            "timestamp": _ts(2),           # <6h => 1.5
            "confidence": 1.2,
            "signal_summary": "9 invoices overdue $18k",
            "action_summary": "Call top overdue clients today.",
        },
        {
            "signal_key": "crm-stalled-opportunities",
            "bucket_hint": "decide_now",
            "severity": "high",
            "timestamp": _ts(12),          # <24h => 1.2
            "confidence": 1.0,
            "signal_summary": "4 deals idle 72h+",
            "action_summary": "Reassign and follow up.",
        },
        {
            "signal_key": "priority-inbox-threads",
            "bucket_hint": "monitor_this_week",
            "severity": "warn",
            "timestamp": _ts(30),          # <72h => 1.0
            "confidence": 1.0,
            "signal_summary": "3 high-priority threads",
            "action_summary": "Triage top-priority inbox.",
        },
        {
            "signal_key": "systemic-followup-gap",
            "bucket_hint": "build_next",
            "severity": "info",
            "timestamp": _ts(100),          # else => 0.7
            "confidence": 0.8,
            "signal_summary": "Recurring followup gap",
            "action_summary": "Build owner cadence.",
        },
        {
            "signal_key": "unknown-low-signal",
            "bucket_hint": "monitor_this_week",
            "severity": "info",
            "timestamp": _ts(90),
            "confidence": 0.5,
            "signal_summary": "Minor FYI",
            "action_summary": "",
        },
    ]

    top = compute_top_actions(candidates, n=2)
    assert len(top) == 2, f"expected 2 top actions, got {len(top)}"

    # Top item should be the critical + fresh overdue invoices signal.
    assert top[0]["signal_key"] == "xero-overdue-invoices"
    assert top[1]["signal_key"] == "crm-stalled-opportunities"

    # Scores should be strictly decreasing + positive.
    assert top[0]["risk_score"] > top[1]["risk_score"] > 0
    # Enriched fields present.
    for item in top:
        assert "title" in item and item["title"]
        assert "why_this_ranks_here" in item and item["why_this_ranks_here"]
        assert "action_hint" in item


def test_ties_broken_by_recency():
    """(c) identical severity/evidence/playbook -> more recent wins."""
    older = {
        "signal_key": "crm-stalled-opportunities",
        "bucket_hint": "decide_now",
        "severity": "high",
        "timestamp": _ts(48),  # <72h bucket (1.0)
        "confidence": 1.0,
        "signal_summary": "Older stall signal",
        "action_summary": "Act.",
    }
    newer = {
        "signal_key": "crm-stalled-opportunities",
        "bucket_hint": "decide_now",
        "severity": "high",
        "timestamp": _ts(60),  # still <72h (same bucket), but more recent not possible here
        "confidence": 1.0,
        "signal_summary": "Newer stall signal",
        "action_summary": "Act.",
    }
    # Force the SAME recency bucket by keeping both in <72h: score will tie.
    # Then the tie-breaker (recency-in-seconds) decides.
    # Re-time `newer` to be MORE recent than `older`.
    newer["timestamp"] = _ts(10)   # much more recent
    older["timestamp"] = _ts(70)   # still <72h

    # Make sure both land in the same recency weight band (<72h) so the
    # composite score is identical → tie-break logic is what picks the winner.
    # Adjust: newer at 10h = 1.2 weight, older at 70h = 1.0 weight -> scores
    # will differ. So force both into the same band by keeping each <24h.
    older["timestamp"] = _ts(20)   # <24h => 1.2
    newer["timestamp"] = _ts(5)    # <6h  => 1.5

    # Those land in different bands, so we need another path. Simplest:
    # two candidates in the <6h band with identical everything except ts.
    older["timestamp"] = _ts(5.5)  # <6h => 1.5
    newer["timestamp"] = _ts(1.0)  # <6h => 1.5

    score_older = compute_risk_score(older)
    score_newer = compute_risk_score(newer)
    assert score_older == score_newer, (
        f"scores should tie in same band: older={score_older} newer={score_newer}"
    )

    top = compute_top_actions([older, newer], n=2)
    assert len(top) == 2
    assert top[0]["signal_summary"] == "Newer stall signal", (
        f"expected newer first, got {top[0]['signal_summary']}"
    )
    assert top[1]["signal_summary"] == "Older stall signal"


# ============================================================================
# Sprint B #16 — Personalization tests
# ============================================================================

def _mk_candidate(sev: str, signal_key: str = "test-key", hours_ago: float = 2.0):
    return {
        "signal_key": signal_key,
        "severity": sev,
        "timestamp": _ts(hours_ago),
        "confidence": 1.0,
        "signal_summary": f"{sev} signal {signal_key}",
        "action_summary": "Act.",
    }


def test_context_none_is_identical_to_pre_personalization_behavior():
    """Regression guard: the pre-#16 call signature must still work."""
    c = _mk_candidate("warn", "some-key")
    baseline = compute_risk_score(c)
    with_none = compute_risk_score(c, context=None)
    assert baseline == with_none


def test_risk_appetite_low_boosts_warn_and_info():
    ctx_low = PersonalizationContext(risk_appetite="low")
    c_warn = _mk_candidate("warn", "noisy-key", hours_ago=2)
    baseline = compute_risk_score(c_warn)
    boosted = compute_risk_score(c_warn, context=ctx_low)
    assert boosted > baseline, "low-appetite users should see warn/info BOOSTED"
    # 1.2× multiplier on the severity*recency*evidence product
    assert abs(boosted - (baseline * 1.2)) < 0.01


def test_risk_appetite_high_dampens_info():
    ctx_high = PersonalizationContext(risk_appetite="high")
    c_info = _mk_candidate("info", "minor-key", hours_ago=2)
    baseline = compute_risk_score(c_info)
    dampened = compute_risk_score(c_info, context=ctx_high)
    assert dampened < baseline, "high-appetite users should see info DAMPENED"
    assert abs(dampened - (baseline * 0.7)) < 0.01


def test_risk_appetite_never_touches_critical_or_high():
    """Critical/high signals are relevant regardless of user appetite."""
    for sev in ["critical", "high"]:
        c = _mk_candidate(sev, f"{sev}-key")
        baseline = compute_risk_score(c)
        low = compute_risk_score(c, context=PersonalizationContext(risk_appetite="low"))
        high = compute_risk_score(c, context=PersonalizationContext(risk_appetite="high"))
        assert baseline == low == high


def test_feedback_weights_downrank_repeat_signals():
    """A user who marks 'not_relevant' on signal_key=X should see X drop."""
    ctx = PersonalizationContext(
        risk_appetite=None,
        feedback_weights={"noisy-key": -0.5},  # one 'not_relevant' feedback
    )
    c_noisy = _mk_candidate("warn", "noisy-key")
    c_other = _mk_candidate("warn", "other-key")
    # Baseline (no context) — scores must be equal (same shape)
    assert compute_risk_score(c_noisy) == compute_risk_score(c_other)
    # With context — noisy-key drops by 0.5
    s_noisy = compute_risk_score(c_noisy, context=ctx)
    s_other = compute_risk_score(c_other, context=ctx)
    assert s_other - s_noisy == pytest.approx(0.5, abs=0.01)


def test_feedback_weight_clamped_at_negative_2():
    """A pile of feedback can't push a signal below -2 — prevents malicious zeroing."""
    ctx = PersonalizationContext(
        feedback_weights={"target": -10.0},  # unrealistic but exercises the floor
    )
    c = _mk_candidate("critical", "target")
    baseline = compute_risk_score(c)
    dampened = compute_risk_score(c, context=ctx)
    # The adjustment should floor at -2 regardless
    assert baseline - dampened <= 2.01


def test_feedback_adjustment_never_positive():
    """Feedback cannot BOOST a signal — even if some weight accidentally goes +."""
    ctx = PersonalizationContext(
        feedback_weights={"impossible-boost": 5.0},  # simulates bad data
    )
    c = _mk_candidate("warn", "impossible-boost")
    baseline = compute_risk_score(c)
    with_ctx = compute_risk_score(c, context=ctx)
    assert with_ctx <= baseline  # ceiling clamps +5.0 to 0


def test_top_actions_reorders_when_feedback_applied():
    """Feedback down-weight should FLIP the ranking when scores are close."""
    # Use identical timestamps so tie_break_recency is deterministic
    # (otherwise _mk_candidate's `now()` calls differ by nanoseconds and the
    # tie-break can pick either candidate).
    frozen_ts = _ts(1)
    c_a = {
        "signal_key": "signal-a",
        "severity": "warn",
        "timestamp": frozen_ts,
        "confidence": 1.0,
        "signal_summary": "warn signal signal-a",
        "action_summary": "Act.",
    }
    c_b = dict(c_a, signal_key="signal-b", signal_summary="warn signal signal-b")

    # Without context — scores tie, stable sort preserves insertion order
    plain = compute_top_actions([c_a, c_b], n=1)
    plain_key = plain[0]["signal_key"]
    # With context feedback on whichever came first — that one drops out
    ctx = PersonalizationContext(feedback_weights={plain_key: -0.9})
    personalized = compute_top_actions([c_a, c_b], n=1, context=ctx)
    expected_other = "signal-b" if plain_key == "signal-a" else "signal-a"
    assert personalized[0]["signal_key"] == expected_other, (
        f"feedback on {plain_key} should flip ranking, got {personalized[0]['signal_key']}"
    )


def test_rationale_mentions_personalization_when_applied():
    ctx = PersonalizationContext(
        risk_appetite="low",
        feedback_weights={"signal-a": -0.5},
    )
    c = _mk_candidate("warn", "signal-a")
    result = compute_top_actions([c], n=1, context=ctx)
    rationale = result[0]["why_this_ranks_here"]
    assert "low risk appetite" in rationale, rationale
    assert "down-weighted" in rationale, rationale


# ============================================================================
# fetch_personalization_context — defensive DB behavior tests
# ============================================================================

class _FakeTableBuilder:
    def __init__(self, data=None, raises=False):
        self._data = data
        self._raises = raises
        self._args = []

    def select(self, *a):  self._args.append(("select", a));   return self
    def eq(self, *a):      self._args.append(("eq", a));       return self
    def in_(self, *a):     self._args.append(("in_", a));      return self
    def limit(self, *a):   self._args.append(("limit", a));    return self
    def execute(self):
        if self._raises:
            raise RuntimeError("db boom")
        class _R: pass
        r = _R(); r.data = self._data; return r


class _FakeSB:
    def __init__(self, table_map):
        # table_map: str -> (data, raises)
        self._m = table_map

    def table(self, name):
        data, raises = self._m.get(name, (None, False))
        return _FakeTableBuilder(data=data, raises=raises)


def test_fetch_personalization_empty_for_no_user():
    ctx = fetch_personalization_context(sb=_FakeSB({}), user_id="")
    assert ctx.risk_appetite is None
    assert ctx.feedback_weights == {}


def test_fetch_personalization_db_errors_are_swallowed():
    sb = _FakeSB({"business_profiles": (None, True), "signal_feedback": (None, True)})
    ctx = fetch_personalization_context(sb=sb, user_id="u1")
    # No exception, returns empty context
    assert ctx.risk_appetite is None
    assert ctx.feedback_weights == {}


def test_fetch_personalization_resolves_risk_appetite_and_feedback_weights():
    sb = _FakeSB({
        "business_profiles": ([{"risk_appetite": "low"}], False),
        "signal_feedback": (
            [
                {"event_id": "evt-1", "feedback_key": "not_relevant"},
                {"event_id": "evt-1", "feedback_key": "not_relevant"},
                {"event_id": "evt-2", "feedback_key": "already_done"},
                {"event_id": "evt-3", "feedback_key": "need_more_info"},  # 0.0 → skip
            ],
            False,
        ),
        "observation_events": (
            [
                {"id": "evt-1", "signal_name": "crm-stalled-opportunities"},
                {"id": "evt-2", "signal_name": "xero-overdue-invoices"},
                {"id": "evt-3", "signal_name": "something-else"},
            ],
            False,
        ),
    })
    ctx = fetch_personalization_context(sb=sb, user_id="u1")
    assert ctx.risk_appetite == "low"
    # 2× -0.5 for crm-stalled, 1× -0.7 for xero, skip the 0.0 key
    assert ctx.feedback_weights["crm-stalled-opportunities"] == pytest.approx(-1.0)
    assert ctx.feedback_weights["xero-overdue-invoices"] == pytest.approx(-0.7)
    assert "something-else" not in ctx.feedback_weights  # need_more_info=0 skipped
