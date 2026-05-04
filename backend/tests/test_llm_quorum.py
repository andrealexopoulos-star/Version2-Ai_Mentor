"""
Tests for ADR-049 — Trinity quorum observability in core/llm_router.

Covers:
  (a) _classify_quorum_state maps success-count → enum correctly
  (b) _quorum_capability_from_keys reflects env-var presence
  (c) _emit_trinity_trace produces structured log entries with required fields
  (d) get_router_config exposes quorum_capability

Hermetic: no live API calls. These are pure-function + log-capture tests.

Why this exists: PR #449 admitted Anthropic + Gemini were "configured in
other functions, not proven in scan path." The full audit (ADR-049) showed
they ARE wired through llm_trinity_chat from the URL scan, but a silent
collapse to single-provider when keys are missing was previously invisible.
This test suite locks the observability surface so a future regression
(e.g. someone removes _emit_trinity_trace or breaks the enum) fails CI
instead of shipping silently.

Run: pytest backend/tests/test_llm_quorum.py -v
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


from core import llm_router as router  # noqa: E402


# ─── (a) _classify_quorum_state ───────────────────────────────────────────


def test_classify_quorum_state_full():
    assert router._classify_quorum_state(3) == router.QUORUM_FULL
    # Defensive: implementation uses >= 3 so a hypothetical 4-provider future
    # still maps to FULL. Lock that contract.
    assert router._classify_quorum_state(4) == router.QUORUM_FULL


def test_classify_quorum_state_partial():
    assert router._classify_quorum_state(2) == router.QUORUM_PARTIAL


def test_classify_quorum_state_single():
    assert router._classify_quorum_state(1) == router.QUORUM_SINGLE


def test_classify_quorum_state_failed():
    assert router._classify_quorum_state(0) == router.QUORUM_FAILED


def test_quorum_state_enum_values_are_stable():
    """The enum strings flow into INTERNAL log lines that downstream parsers
    (e.g. ops_daily_health_check_procedure.md) match against. Lock them so
    a refactor cannot silently rename them."""
    assert router.QUORUM_FULL == "FULL_QUORUM"
    assert router.QUORUM_PARTIAL == "PARTIAL_QUORUM"
    assert router.QUORUM_SINGLE == "SINGLE_PROVIDER"
    assert router.QUORUM_FAILED == "FAILED"


# ─── (b) _quorum_capability_from_keys ─────────────────────────────────────


def test_quorum_capability_full(monkeypatch):
    monkeypatch.setattr(router, "OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setattr(router, "GOOGLE_API_KEY", "test-google-key")
    monkeypatch.setattr(router, "ANTHROPIC_API_KEY", "test-anthropic-key")
    assert router._quorum_capability_from_keys() == router.QUORUM_FULL


def test_quorum_capability_partial(monkeypatch):
    monkeypatch.setattr(router, "OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setattr(router, "GOOGLE_API_KEY", "")
    monkeypatch.setattr(router, "ANTHROPIC_API_KEY", "test-anthropic-key")
    assert router._quorum_capability_from_keys() == router.QUORUM_PARTIAL


def test_quorum_capability_single(monkeypatch):
    monkeypatch.setattr(router, "OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setattr(router, "GOOGLE_API_KEY", "")
    monkeypatch.setattr(router, "ANTHROPIC_API_KEY", "")
    assert router._quorum_capability_from_keys() == router.QUORUM_SINGLE


def test_quorum_capability_failed(monkeypatch):
    monkeypatch.setattr(router, "OPENAI_API_KEY", "")
    monkeypatch.setattr(router, "GOOGLE_API_KEY", "")
    monkeypatch.setattr(router, "ANTHROPIC_API_KEY", "")
    assert router._quorum_capability_from_keys() == router.QUORUM_FAILED


# ─── (c) _emit_trinity_trace structured log ───────────────────────────────


def test_emit_trinity_trace_logs_all_fields(caplog):
    caplog.set_level(logging.INFO, logger="core.llm_router")
    router._emit_trinity_trace(
        requested=["openai", "google", "anthropic"],
        succeeded=["openai", "anthropic"],
        failed=[{"provider": "google", "reason": "timeout after 75s"}],
        synthesis_provider="anthropic",
        quorum_state=router.QUORUM_PARTIAL,
        user_id="abcdef1234-uuid-style-test-id",
        feature="trinity_synthesis",
    )

    # The trace line itself must contain the quorum state, the synthesis
    # provider, and the requested provider list — these are the fields a
    # downstream consumer (E2 enrichment_traces) will key on.
    info_records = [r for r in caplog.records if r.levelno == logging.INFO]
    assert any("PARTIAL_QUORUM" in r.getMessage() for r in info_records)
    assert any("synth=anthropic" in r.getMessage() for r in info_records)
    assert any("openai" in r.getMessage() for r in info_records)
    # User id is truncated to 8 chars to avoid PII spillage.
    assert any("user=abcdef12" in r.getMessage() for r in info_records)


def test_emit_trinity_trace_logs_provider_failures_at_warning(caplog):
    caplog.set_level(logging.WARNING, logger="core.llm_router")
    router._emit_trinity_trace(
        requested=["openai", "google", "anthropic"],
        succeeded=["openai"],
        failed=[
            {"provider": "google", "reason": "401 Unauthorized"},
            {"provider": "anthropic", "reason": "key missing"},
        ],
        synthesis_provider="openai",
        quorum_state=router.QUORUM_SINGLE,
        user_id="user-1",
        feature="trinity_single_provider",
    )

    warn_records = [r for r in caplog.records if r.levelno == logging.WARNING]
    # Each failure must surface as its own WARNING line so the daily
    # health check can scan logs and alert on a key getting silently revoked.
    assert any("provider=google" in r.getMessage() for r in warn_records)
    assert any("provider=anthropic" in r.getMessage() for r in warn_records)


def test_emit_trinity_trace_handles_malformed_failed_entries(caplog):
    """Trace emission must NEVER throw. If a failed-entry dict is malformed,
    we still want the main INFO trace line to fire so the parent caller's
    response is unaffected."""
    caplog.set_level(logging.INFO, logger="core.llm_router")
    # Pass a string instead of a dict — the old code would have crashed on .get
    router._emit_trinity_trace(
        requested=["openai"],
        succeeded=["openai"],
        failed=["not-a-dict"],  # type: ignore[list-item]
        synthesis_provider="openai",
        quorum_state=router.QUORUM_SINGLE,
        user_id=None,
        feature="trinity_single_provider",
    )
    info_records = [r for r in caplog.records if r.levelno == logging.INFO]
    assert any("SINGLE_PROVIDER" in r.getMessage() for r in info_records)


# ─── (d) get_router_config exposes quorum_capability ──────────────────────


def test_get_router_config_includes_quorum_capability(monkeypatch):
    monkeypatch.setattr(router, "OPENAI_API_KEY", "test-openai")
    monkeypatch.setattr(router, "GOOGLE_API_KEY", "test-google")
    monkeypatch.setattr(router, "ANTHROPIC_API_KEY", "test-anthropic")
    cfg = router.get_router_config()
    assert "quorum_capability" in cfg
    assert cfg["quorum_capability"] == router.QUORUM_FULL
    # Per-provider booleans still present (back-compat with the existing
    # health checks).
    assert cfg["providers"]["openai"] is True
    assert cfg["providers"]["google"] is True
    assert cfg["providers"]["anthropic"] is True


def test_get_router_config_quorum_capability_reflects_missing_keys(monkeypatch):
    monkeypatch.setattr(router, "OPENAI_API_KEY", "test-openai")
    monkeypatch.setattr(router, "GOOGLE_API_KEY", "")
    monkeypatch.setattr(router, "ANTHROPIC_API_KEY", "")
    cfg = router.get_router_config()
    assert cfg["quorum_capability"] == router.QUORUM_SINGLE
    assert cfg["providers"]["openai"] is True
    assert cfg["providers"]["google"] is False
    assert cfg["providers"]["anthropic"] is False


# ─── Sanity: the provider-detection helper still works ────────────────────


def test_provider_for_model_anthropic_gemini_openai():
    """Lock the model→provider routing — ADR-049 depends on this for the
    correct branch dispatch in llm_trinity_chat."""
    assert router._provider_for_model("claude-opus-4-6") == "anthropic"
    assert router._provider_for_model("claude-sonnet-4-6") == "anthropic"
    assert router._provider_for_model("gemini-3-pro-preview") == "google"
    assert router._provider_for_model("gpt-5.4") == "openai"
    assert router._provider_for_model("gpt-4o") == "openai"
    # Unknown / empty defaults to openai (the safest / always-on provider).
    assert router._provider_for_model("") == "openai"
    assert router._provider_for_model(None) == "openai"  # type: ignore[arg-type]
