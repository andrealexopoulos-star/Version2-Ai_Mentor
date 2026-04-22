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
