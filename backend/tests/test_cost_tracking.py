"""Tests for token_metering cost tracking (MODEL_PRICING + cost_aud).

These tests do NOT hit Supabase. They exercise the pure-Python cost math
and use a recording fake for the `sb` client so we can assert the shape
of the upsert payload.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest

# Make `backend/` importable the same way other tests do.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from middleware import token_metering  # noqa: E402
from middleware.token_metering import (  # noqa: E402
    MODEL_PRICING,
    _compute_cost_aud,
    record_token_usage,
)


# ─── _compute_cost_aud ─────────────────────────────────────────────

def test_compute_cost_aud_known_model():
    # gpt-5.4-pro = 22.80 AUD per 1M input, 91.20 AUD per 1M output.
    # 1,000,000 input + 500,000 output → 22.80 + 45.60 = 68.40 AUD
    cost = _compute_cost_aud("gpt-5.4-pro", 1_000_000, 500_000)
    assert cost == pytest.approx(68.40, abs=1e-4)


def test_compute_cost_aud_embedding_has_no_output_cost():
    # text-embedding-3-small has output_per_1m == 0.0
    cost = _compute_cost_aud("text-embedding-3-small", 2_000_000, 0)
    assert cost == pytest.approx(0.06, abs=1e-4)


def test_compute_cost_aud_unknown_model_returns_zero(caplog):
    cost = _compute_cost_aud("imaginary-model-v9", 10_000, 5_000)
    assert cost == 0.0


def test_compute_cost_aud_zero_tokens():
    assert _compute_cost_aud("gpt-5.4-pro", 0, 0) == 0.0


def test_compute_cost_aud_negative_tokens_are_clamped():
    # Safety: downstream tokeniser could legitimately return 0; if it ever
    # returns a negative we should not refund money by computing a negative cost.
    assert _compute_cost_aud("gpt-5.4-pro", -100, -50) == 0.0


def test_model_pricing_covers_every_routed_model():
    """Guardrail: every model referenced in the backend routing table
    must appear in MODEL_PRICING, otherwise cost_aud silently falls to 0.

    Skipped when FastAPI isn't installed locally — this guardrail runs in
    CI where the full backend is importable. Rest of the suite still runs.
    """
    pytest.importorskip("fastapi")
    # Build the set of models we actually route to.
    from routes.deps import AI_MODELS
    routed = {m for m in AI_MODELS.values() if isinstance(m, str)}
    # gpt-4o realtime is also referenced via the LLM router ROUTE_TABLE,
    # not AI_MODELS; ensure it's covered too.
    routed.add("gpt-4o-realtime-preview-2024-12-17")
    # OPENAI_MODEL_DEEP default is gpt-5.4
    routed.add("gpt-5.4")
    missing = sorted(m for m in routed if m not in MODEL_PRICING)
    assert not missing, f"Models routed but missing from MODEL_PRICING: {missing}"


# ─── record_token_usage: Supabase fake ────────────────────────────

class _FakeResult:
    def __init__(self, data: Any):
        self.data = data


class _FakeChain:
    """Minimal chain that records mutating calls against a fake backend."""

    def __init__(self, store: dict, table_name: str, op_log: list):
        self._store = store
        self._table = table_name
        self._op_log = op_log
        self._filters: list[tuple[str, str]] = []
        self._pending_upsert: dict | None = None
        self._pending_update: dict | None = None

    # read
    def select(self, *args, **kwargs):
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def maybe_single(self):
        return self

    # write
    def upsert(self, row, on_conflict=None):
        self._pending_upsert = row
        self._op_log.append(("upsert", self._table, dict(row), on_conflict))
        return self

    def update(self, patch):
        self._pending_update = patch
        self._op_log.append(("update", self._table, dict(patch)))
        return self

    def execute(self):
        # Read path: match stored row by filters.
        if self._pending_upsert is None and self._pending_update is None:
            row = self._store.get(self._table, {}).get(self._filters[0][1]) if self._filters else None
            return _FakeResult(row)

        if self._pending_upsert is not None:
            key = self._pending_upsert.get("key") or self._pending_upsert.get("user_id")
            bucket = self._store.setdefault(self._table, {})
            # Simulate upsert: start from existing, overlay upsert payload.
            prior = dict(bucket.get(key) or {})
            prior.update(self._pending_upsert)
            prior.setdefault("id", f"{self._table}-{key}")
            bucket[key] = prior
            result = _FakeResult([dict(prior)])
            self._pending_upsert = None
            return result

        if self._pending_update is not None:
            filter_key, filter_val = (self._filters[0] if self._filters else ("id", None))
            bucket = self._store.get(self._table, {})
            for bucket_key, existing in list(bucket.items()):
                if existing.get(filter_key) == filter_val:
                    existing.update(self._pending_update)
            self._pending_update = None
            return _FakeResult(None)


class _FakeSupabase:
    def __init__(self):
        self._store: dict[str, dict[str, dict]] = {}
        self.op_log: list = []

    def table(self, name: str) -> _FakeChain:
        return _FakeChain(self._store, name, self.op_log)


def test_record_token_usage_populates_cost_aud(monkeypatch):
    sb = _FakeSupabase()
    ok = record_token_usage(
        sb,
        user_id="user-1",
        model="gpt-5.4-pro",
        input_tokens=100_000,
        output_tokens=50_000,
        feature="soundboard_pro",
        tier="pro",
    )
    assert ok is True

    # Find the ai_usage_log upsert.
    usage_upserts = [op for op in sb.op_log if op[0] == "upsert" and op[1] == "ai_usage_log"]
    assert usage_upserts, "ai_usage_log was not upserted"
    payload = usage_upserts[-1][2]
    assert payload["user_id"] == "user-1"
    assert payload["feature"] == "soundboard_pro"
    assert payload["model_used"] == "gpt-5.4-pro"
    assert payload["input_tokens"] == 100_000
    assert payload["output_tokens"] == 50_000
    # 100k * 22.80/1M + 50k * 91.20/1M = 2.28 + 4.56 = 6.84 AUD
    assert payload["cost_aud"] == pytest.approx(6.84, abs=1e-4)
    assert payload["count"] == 1


def test_record_token_usage_accumulates_across_calls(monkeypatch):
    sb = _FakeSupabase()
    for _ in range(3):
        record_token_usage(
            sb,
            user_id="user-2",
            model="gpt-5.3",
            input_tokens=10_000,
            output_tokens=5_000,
            feature="calibration",
            tier="starter",
        )

    usage_upserts = [op for op in sb.op_log if op[0] == "upsert" and op[1] == "ai_usage_log"]
    final = usage_upserts[-1][2]
    assert final["count"] == 3
    assert final["input_tokens"] == 30_000
    assert final["output_tokens"] == 15_000
    # 30k input * 0.76/1M + 15k output * 3.04/1M = 0.0228 + 0.0456 = 0.0684 AUD
    assert final["cost_aud"] == pytest.approx(0.0684, abs=1e-5)


def test_record_token_usage_no_ops_when_zero_tokens():
    sb = _FakeSupabase()
    assert record_token_usage(sb, user_id="u", model="gpt-5.3", input_tokens=0, output_tokens=0) is True
    assert sb.op_log == []


def test_unknown_model_still_records_usage_with_zero_cost():
    sb = _FakeSupabase()
    ok = record_token_usage(
        sb,
        user_id="user-3",
        model="imaginary-model-v9",
        input_tokens=100,
        output_tokens=200,
        feature="llm_call",
        tier="free",
    )
    assert ok is True
    usage_upserts = [op for op in sb.op_log if op[0] == "upsert" and op[1] == "ai_usage_log"]
    assert usage_upserts, "ai_usage_log was not upserted"
    final = usage_upserts[-1][2]
    assert final["cost_aud"] == 0.0
    assert final["input_tokens"] == 100
