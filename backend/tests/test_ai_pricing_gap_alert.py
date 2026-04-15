"""Unit tests for the daily AI pricing gap alert (Step 15 / P1-11).

Purpose
-------
`backend/jobs/ai_pricing_gap_alert.py` runs unattended once a day and is
the only path by which ops learns that a new LLM model is missing from
MODEL_PRICING. If this job silently fails, the GP dashboard keeps
under-reporting LLM spend and we don't know until the month closes.

These tests lock in the contract:
  • Empty view → email NOT sent, skipped_reason='no_gaps', still returns
    a clean summary
  • Populated view → email sent, summary reflects gap_count
  • RESEND_API_KEY missing → email skipped with the right reason; job
    does NOT fail
  • Resend returns 4xx/5xx → email_sent=False + email_error recorded;
    job does NOT fail
  • RPC errors → error field populated; caller decides whether to 502
  • force_send=True → email goes out even with zero gaps (smoke test)

Run with `asyncio.run(...)` instead of pytest-asyncio so these tests
execute on the existing test runner without adding a new dependency.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import AsyncMock, patch

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Fake Supabase client ───────────────────────────────────────────

class _FakeRPCResult:
    def __init__(self, data: List[Dict[str, Any]] | None, *, raise_on_execute: bool = False):
        self._data = data
        self._raise = raise_on_execute
        self.data = data  # supabase-py returns this directly on .execute()

    def execute(self):
        if self._raise:
            raise RuntimeError("supabase_rpc_down")
        return self


class _FakeSupabase:
    def __init__(self, rpc_data: List[Dict[str, Any]] | None, *, rpc_raises: bool = False):
        self._rpc_data = rpc_data
        self._rpc_raises = rpc_raises
        self.rpc_calls: List[tuple] = []

    def rpc(self, fn_name: str, params: Dict[str, Any]):
        self.rpc_calls.append((fn_name, params))
        return _FakeRPCResult(self._rpc_data, raise_on_execute=self._rpc_raises)


def _run(coro):
    """Tiny helper — keeps these tests runnable without pytest-asyncio."""
    return asyncio.run(coro)


# ─── Happy-path: empty gaps ─────────────────────────────────────────

def test_empty_gaps_skips_email_and_returns_clean_summary():
    from jobs.ai_pricing_gap_alert import run_pricing_gap_alert
    sb = _FakeSupabase(rpc_data=[])

    # Patch the email sender so a missing RESEND_API_KEY doesn't pollute
    # the assertion — the contract here is about the *skip reason*.
    with patch("jobs.ai_pricing_gap_alert._send_gap_alert_email", new=AsyncMock()) as mock_send:
        summary = _run(run_pricing_gap_alert(sb))

    assert summary["gap_count"] == 0
    assert summary["gaps"] == []
    assert summary["email_sent"] is False
    assert summary["skipped_reason"] == "no_gaps"
    assert "run_id" in summary
    assert "started_at" in summary
    assert "finished_at" in summary
    # Critically: NO email send attempted when there are no gaps
    mock_send.assert_not_called()
    assert sb.rpc_calls == [("admin_ai_pricing_gaps", {"p_limit": 50})]


# ─── Happy-path: gaps present, email sent ───────────────────────────

def test_gaps_present_sends_email():
    from jobs.ai_pricing_gap_alert import run_pricing_gap_alert
    sample_gap = {
        "model_used": "gpt-5.4-ultra",
        "row_count": 12,
        "total_input_tokens": 34000,
        "total_output_tokens": 5600,
        "first_seen": "2026-04-14",
        "last_seen": "2026-04-15",
        "affected_users": 3,
    }
    sb = _FakeSupabase(rpc_data=[sample_gap])

    with patch(
        "jobs.ai_pricing_gap_alert._send_gap_alert_email",
        new=AsyncMock(return_value={"sent": True}),
    ) as mock_send:
        summary = _run(run_pricing_gap_alert(sb))

    assert summary["gap_count"] == 1
    assert summary["gaps"] == [sample_gap]
    assert summary["email_sent"] is True
    assert "skipped_reason" not in summary
    # Email helper got the gap list + the run_id
    mock_send.assert_called_once()
    call_kwargs = mock_send.call_args.kwargs
    assert call_kwargs["run_id"] == summary["run_id"]


# ─── Resend not configured: job must not fail ───────────────────────

def test_resend_not_configured_skips_gracefully():
    from jobs.ai_pricing_gap_alert import run_pricing_gap_alert
    sb = _FakeSupabase(rpc_data=[{"model_used": "unknown-model", "row_count": 1}])

    with patch(
        "jobs.ai_pricing_gap_alert._send_gap_alert_email",
        new=AsyncMock(return_value={
            "sent": False,
            "skipped_reason": "resend_not_configured",
        }),
    ):
        summary = _run(run_pricing_gap_alert(sb))

    assert summary["gap_count"] == 1
    assert summary["email_sent"] is False
    assert summary["skipped_reason"] == "resend_not_configured"
    # No `error` key — this is an expected, benign skip, not a failure.
    assert "error" not in summary


# ─── Resend returns 4xx: error recorded, job continues ──────────────

def test_resend_error_records_error_but_job_succeeds():
    from jobs.ai_pricing_gap_alert import run_pricing_gap_alert
    sb = _FakeSupabase(rpc_data=[{"model_used": "unknown-model", "row_count": 1}])

    with patch(
        "jobs.ai_pricing_gap_alert._send_gap_alert_email",
        new=AsyncMock(return_value={"sent": False, "error": "resend_503: upstream down"}),
    ):
        summary = _run(run_pricing_gap_alert(sb))

    assert summary["gap_count"] == 1
    assert summary["email_sent"] is False
    assert summary["email_error"] == "resend_503: upstream down"
    # Note: the run still has finished_at — job didn't bail out
    assert "finished_at" in summary


# ─── RPC errors: captured, caller decides HTTP status ───────────────

def test_rpc_error_surfaces_in_summary():
    from jobs.ai_pricing_gap_alert import run_pricing_gap_alert
    sb = _FakeSupabase(rpc_data=None, rpc_raises=True)

    with patch("jobs.ai_pricing_gap_alert._send_gap_alert_email", new=AsyncMock()) as mock_send:
        summary = _run(run_pricing_gap_alert(sb))

    assert summary["gap_count"] == 0
    assert "error" in summary
    assert "supabase_rpc_down" in summary["error"]
    # Email must NOT be sent when the RPC itself broke — we don't know
    # whether gaps exist.
    mock_send.assert_not_called()


# ─── force_send: email goes out even with empty gaps ────────────────

def test_force_send_sends_email_even_with_empty_gaps():
    from jobs.ai_pricing_gap_alert import run_pricing_gap_alert
    sb = _FakeSupabase(rpc_data=[])

    with patch(
        "jobs.ai_pricing_gap_alert._send_gap_alert_email",
        new=AsyncMock(return_value={"sent": True}),
    ) as mock_send:
        summary = _run(run_pricing_gap_alert(sb, force_send=True))

    assert summary["gap_count"] == 0
    assert summary["email_sent"] is True
    assert "skipped_reason" not in summary
    mock_send.assert_called_once()


# ─── Email body formatter ──────────────────────────────────────────

def test_email_body_includes_all_expected_sections():
    from jobs.ai_pricing_gap_alert import _format_gap_email_body
    gaps = [
        {
            "model_used": "gpt-5.4-ultra",
            "row_count": 12,
            "total_input_tokens": 34000,
            "total_output_tokens": 5600,
            "first_seen": "2026-04-14",
            "last_seen": "2026-04-15",
            "affected_users": 3,
        },
    ]
    body = _format_gap_email_body(gaps, run_id="abc-123")

    # The ops reader needs all of these signals in the email
    assert "Run ID:   abc-123" in body
    assert "1 model(s) produced billable tokens" in body
    assert "WHY THIS MATTERS" in body
    assert "backend/middleware/token_metering.py" in body
    assert "MODEL_PRICING" in body
    assert "gpt-5.4-ultra" in body
    assert "rows=12" in body
    assert "in_tok=34000" in body
    assert "out_tok=5600" in body
    assert "users=3" in body
    assert "first=2026-04-14" in body
    assert "last=2026-04-15" in body
    assert "/api/admin/cost/pricing-gaps" in body


def test_email_body_handles_empty_gap_list():
    from jobs.ai_pricing_gap_alert import _format_gap_email_body
    body = _format_gap_email_body([], run_id="xyz-456")
    # Empty list must still produce a well-formed body (force_send path)
    assert "Run ID:   xyz-456" in body
    assert "0 model(s) produced billable tokens" in body
    # No crash on empty gaps iterator
    assert "BIQc AI pricing gap alert" in body
