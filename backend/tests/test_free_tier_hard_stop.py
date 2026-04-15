"""Unit tests for the free-tier 402 hard-stop (Step 9 / P1-6).

Purpose:
  The only pre-existing quota gate on free tier was a per-feature call
  count (80 soundboard/mo, 40 war-room/mo) in routes.deps.check_rate_limit.
  That leaves a real cost hole: a free user can stay inside their call
  count but send massive prompts, burning through the 150K input / 75K
  output token allocation on gpt-5.4-pro and costing BIQc money until
  the next calendar month rolls over.

  enforce_free_tier_budget closes the hole at the LLM-router chokepoint
  by raising HTTPException 402 the moment input OR output usage hits
  allocated ceiling. This suite locks that behaviour in.

What's guarded:
  - Free tier at 100% input → 402 with the expected payload
  - Free tier at 100% output → 402, dimension_exhausted="output"
  - Free tier above 100% (overage recorded) → still 402
  - Free tier below 100% → no raise
  - Paid tiers (starter/pro/business/enterprise/custom_build/super_admin)
    are never hard-stopped here; overage handling is revenue's problem.
  - Tier aliases (custom/superadmin/growth/None) normalise before the
    gate so operators never slip through on a label mismatch.
  - Service outages (allocation lookup raises, or returns None) FAIL
    OPEN — a Supabase blip must not block every free-tier call.
  - Anonymous calls (no user_id) short-circuit — auth upstream.
  - Unlimited allocation rows (negative values) do not trigger.
"""
from __future__ import annotations

import sys
import types
from pathlib import Path

import pytest
from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Fixtures ─────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _stub_heavy_imports(monkeypatch):
    """Make middleware.token_metering importable without real config.

    Only touches sibling modules that middleware.token_metering doesn't
    actually depend on at import time — stubbing them is a defence
    against future import-side-effects creeping in.
    """
    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    sb_stub.get_supabase_client = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    # Freshly import so our monkeypatches on get_or_create_allocation
    # apply to the instance the test touches.
    if "middleware.token_metering" in sys.modules:
        del sys.modules["middleware.token_metering"]


def _alloc(
    *,
    input_used: int = 0,
    input_allocated: int = 150_000,
    output_used: int = 0,
    output_allocated: int = 75_000,
    tier: str = "free",
):
    """Build a realistic token_allocations row dict for tests."""
    return {
        "id": "alloc-test",
        "tier": tier,
        "period_start": "2026-04-01T00:00:00+00:00",
        "period_end": "2026-05-01T00:00:00+00:00",
        "input_used": input_used,
        "input_allocated": input_allocated,
        "output_used": output_used,
        "output_allocated": output_allocated,
        "overage_input": max(0, input_used - input_allocated),
        "overage_output": max(0, output_used - output_allocated),
    }


def _patch_alloc(monkeypatch, return_value=None, raises: Exception | None = None):
    """Override get_or_create_allocation on the freshly-imported module."""
    from middleware import token_metering

    def _fake(sb, user_id, tier):
        if raises is not None:
            raise raises
        return return_value

    monkeypatch.setattr(token_metering, "get_or_create_allocation", _fake)
    return token_metering


# ─── Free-tier: exhausted → 402 ───────────────────────────────────

def test_free_tier_at_100pct_input_raises_402(monkeypatch):
    tm = _patch_alloc(monkeypatch, _alloc(input_used=150_000))

    with pytest.raises(HTTPException) as exc_info:
        tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="free")

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail["error"] == "free_tier_quota_exhausted"
    assert exc_info.value.detail["upgrade_url"] == "/upgrade"
    assert exc_info.value.detail["dimension_exhausted"] == "input"


def test_free_tier_at_100pct_output_raises_402(monkeypatch):
    tm = _patch_alloc(monkeypatch, _alloc(output_used=75_000))

    with pytest.raises(HTTPException) as exc_info:
        tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="free")

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail["dimension_exhausted"] == "output"


def test_free_tier_over_cap_still_raises_402(monkeypatch):
    """Once the user crosses the line, keep blocking. Overage rows exist
    because record_token_usage keeps writing even after the cap — this
    guard must not accidentally flip back to allow-through when used > cap."""
    tm = _patch_alloc(monkeypatch, _alloc(input_used=200_000))

    with pytest.raises(HTTPException) as exc_info:
        tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="free")

    assert exc_info.value.status_code == 402


def test_free_tier_payload_contains_all_fields(monkeypatch):
    """Frontend CTA builds off these keys. Adding a new key is fine;
    removing or renaming one is a breaking change for UpgradeModal."""
    tm = _patch_alloc(
        monkeypatch,
        _alloc(input_used=150_000, output_used=30_000),
    )

    with pytest.raises(HTTPException) as exc_info:
        tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="free")

    detail = exc_info.value.detail
    for key in (
        "error",
        "message",
        "upgrade_url",
        "tier",
        "input_used",
        "input_allocated",
        "output_used",
        "output_allocated",
        "dimension_exhausted",
    ):
        assert key in detail, f"402 detail missing {key}"
    assert detail["tier"] == "free"
    assert detail["input_used"] == 150_000
    assert detail["input_allocated"] == 150_000
    assert detail["output_used"] == 30_000


# ─── Free-tier: still-within-budget → no raise ────────────────────

def test_free_tier_at_99pct_does_not_raise(monkeypatch):
    """Just under cap must pass — the block is at 100%, not at 95%."""
    tm = _patch_alloc(monkeypatch, _alloc(input_used=149_999, output_used=74_999))

    # Should return None without raising
    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="free") is None


def test_free_tier_zero_usage_does_not_raise(monkeypatch):
    tm = _patch_alloc(monkeypatch, _alloc())

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="free") is None


# ─── Paid tiers: never hard-stopped here ──────────────────────────

@pytest.mark.parametrize("tier", ["starter", "pro", "business", "enterprise"])
def test_paid_tiers_never_raise_here_even_over_cap(monkeypatch, tier):
    """Paid tiers can technically go into overage (tracked in overage_input/
    overage_output) but THIS gate does not block them. Overage is billed
    or soft-throttled elsewhere; free-tier enforcement is the only
    hard-stop this function implements."""
    tm = _patch_alloc(
        monkeypatch,
        # Paid tiers have much higher allocations; even over-cap we pass.
        _alloc(tier=tier, input_used=999_999_999, input_allocated=1_000_000),
    )

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier=tier) is None


def test_custom_build_never_raises_here(monkeypatch):
    """custom_build → paid, not hard-stopped here regardless of usage."""
    tm = _patch_alloc(monkeypatch, _alloc(tier="custom_build", input_used=99_999_999))

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="custom_build") is None


def test_legacy_custom_alias_never_raises_here(monkeypatch):
    """Legacy 'custom' tier-string normalises to custom_build before the check."""
    tm = _patch_alloc(monkeypatch, _alloc(tier="custom_build", input_used=99_999_999))

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="custom") is None


def test_super_admin_never_raises_here(monkeypatch):
    tm = _patch_alloc(monkeypatch, _alloc(tier="super_admin", input_allocated=-1, output_allocated=-1))

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="super_admin") is None


def test_superadmin_alias_never_raises(monkeypatch):
    tm = _patch_alloc(monkeypatch, _alloc(tier="super_admin", input_allocated=-1, output_allocated=-1))

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="superadmin") is None


@pytest.mark.parametrize("alias", ["growth", "foundation", "professional", "ENTERPRISE", "  pro  "])
def test_paid_tier_aliases_normalise_before_check(monkeypatch, alias):
    """deps.py and tiers.js both accept these aliases; the enforcer must
    follow the same normalisation rules so aliased callers don't leak
    into the free-tier gate."""
    tm = _patch_alloc(monkeypatch, _alloc(tier="starter", input_used=999_999))

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier=alias) is None


# ─── Unlimited allocations do not trigger ─────────────────────────

def test_unlimited_input_allocation_does_not_raise(monkeypatch):
    """Rows with input_allocated < 0 represent unlimited allocations
    (super_admin fallback). Even with massive used, the gate must pass."""
    tm = _patch_alloc(
        monkeypatch,
        _alloc(input_used=999_999, input_allocated=-1, output_used=999_999, output_allocated=-1, tier="super_admin"),
    )

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="super_admin") is None


# ─── Anonymous / missing user_id → no-op ──────────────────────────

def test_empty_user_id_skips_check(monkeypatch):
    """No user_id means no allocation row can be looked up. Short-circuit
    silently instead of bothering Supabase."""
    sentinel = {"called": False}

    def _fake(sb, user_id, tier):
        sentinel["called"] = True
        return _alloc()

    from middleware import token_metering
    monkeypatch.setattr(token_metering, "get_or_create_allocation", _fake)

    assert token_metering.enforce_free_tier_budget(sb=None, user_id="", tier="free") is None
    assert sentinel["called"] is False, "allocation lookup should be skipped when user_id is empty"


def test_none_user_id_skips_check(monkeypatch):
    from middleware import token_metering
    monkeypatch.setattr(token_metering, "get_or_create_allocation", lambda *a, **kw: _alloc())

    assert token_metering.enforce_free_tier_budget(sb=None, user_id=None, tier="free") is None


# ─── Fail-open semantics ──────────────────────────────────────────

def test_allocation_lookup_returns_none_fails_open(monkeypatch):
    """If get_or_create_allocation returns None (DB unreachable, upsert
    race, etc.) the enforcer MUST NOT raise — blocking every free-tier
    call during a Supabase outage is worse than a brief cost leak."""
    tm = _patch_alloc(monkeypatch, return_value=None)

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="free") is None


def test_allocation_lookup_raises_fails_open(monkeypatch):
    """Same rationale as above — unexpected exceptions mustn't cascade
    into 500s from the LLM router."""
    tm = _patch_alloc(monkeypatch, raises=RuntimeError("simulated outage"))

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="free") is None


def test_allocation_with_malformed_values_fails_open(monkeypatch):
    """If used/allocated are non-numeric we can't make an allow/deny
    decision safely — fail open rather than 500."""
    tm = _patch_alloc(
        monkeypatch,
        {
            "id": "alloc-x",
            "tier": "free",
            "input_used": "not-a-number",
            "input_allocated": 150_000,
            "output_used": 0,
            "output_allocated": 75_000,
        },
    )

    assert tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="free") is None


# ─── None/unknown tier → treated as free ──────────────────────────

def test_none_tier_treated_as_free_and_checked(monkeypatch):
    """None tier normalises to 'free' via _normalize_tier, so an at-cap
    user with tier=None must still be hard-stopped (defence against
    callers that forget to pass tier)."""
    tm = _patch_alloc(monkeypatch, _alloc(input_used=150_000))

    with pytest.raises(HTTPException) as exc_info:
        tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier=None)

    assert exc_info.value.status_code == 402


def test_empty_tier_string_treated_as_free(monkeypatch):
    tm = _patch_alloc(monkeypatch, _alloc(output_used=75_000))

    with pytest.raises(HTTPException) as exc_info:
        tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="")

    assert exc_info.value.status_code == 402


def test_unknown_tier_string_treated_as_free(monkeypatch):
    """A mistyped tier (e.g. 'stater' typo) must not accidentally bypass
    the gate. _normalize_tier routes unknown values to 'free' so we
    default to the safest quota."""
    tm = _patch_alloc(monkeypatch, _alloc(input_used=150_000))

    with pytest.raises(HTTPException) as exc_info:
        tm.enforce_free_tier_budget(sb=None, user_id="u-1", tier="stater")

    assert exc_info.value.status_code == 402


# ─── Constants are exported and stable ────────────────────────────

def test_constants_exported_for_frontend_contract():
    """The 402 payload is part of the frontend upgrade-CTA contract —
    tests pin the exact wording so a refactor doesn't silently change
    what users see."""
    from middleware.token_metering import (
        FREE_TIER_QUOTA_EXHAUSTED_ERROR,
        FREE_TIER_UPGRADE_URL,
    )

    assert FREE_TIER_QUOTA_EXHAUSTED_ERROR == "free_tier_quota_exhausted"
    assert FREE_TIER_UPGRADE_URL == "/upgrade"


# ─── Wiring: llm_router chokepoint fires enforcer before LLM call ──

@pytest.fixture
def llm_router_module(monkeypatch):
    """Import core.llm_router with stubs so the enforcer wiring can be
    exercised without hitting routes.deps' full dependency graph."""
    import importlib

    # Stub routes.deps.get_sb so _check_budget_or_raise's lazy import
    # succeeds without pulling in FastAPI routers, auth_supabase, etc.
    deps_stub = types.ModuleType("routes.deps")
    deps_stub.get_sb = lambda: "sentinel-sb"
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    # Reset the enforcer cache so _get_budget_enforcer re-resolves and
    # any test-scoped patches take effect.
    if "core.llm_router" in sys.modules:
        del sys.modules["core.llm_router"]
    return importlib.import_module("core.llm_router")


def test_llm_chat_raises_402_before_any_http_call(llm_router_module, monkeypatch):
    """The whole point of the hard-stop is to block spend BEFORE the
    provider call. If httpx is touched even once, the enforcer was
    placed after the round-trip by mistake — make it loud."""
    import asyncio

    def _explode(*args, **kwargs):
        raise AssertionError(
            "HTTP client was invoked before the enforcer — wiring regression"
        )

    monkeypatch.setattr(llm_router_module.httpx, "AsyncClient", _explode)

    # Install a stub enforcer that raises 402 unconditionally. Setting
    # the module attribute directly means _get_budget_enforcer skips
    # the import path and returns our stub on the next call.
    def _stub_enforcer(sb, user_id, tier):
        raise HTTPException(status_code=402, detail={"error": "free_tier_quota_exhausted"})

    monkeypatch.setattr(llm_router_module, "_budget_enforcer", _stub_enforcer)

    async def _run():
        return await llm_router_module.llm_chat(
            system_message="s",
            user_message="u",
            user_id="user-1",
            tier="free",
        )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(_run())

    assert exc_info.value.status_code == 402


def test_llm_trinity_chat_raises_402_before_any_http_call(llm_router_module, monkeypatch):
    """Same check for the Trinity path — it's the most expensive call
    (3 providers + synthesis) so the gate has to fire here too."""
    import asyncio

    def _explode(*args, **kwargs):
        raise AssertionError(
            "HTTP client was invoked before the enforcer in Trinity — wiring regression"
        )

    monkeypatch.setattr(llm_router_module.httpx, "AsyncClient", _explode)

    def _stub_enforcer(sb, user_id, tier):
        raise HTTPException(status_code=402, detail={"error": "free_tier_quota_exhausted"})

    monkeypatch.setattr(llm_router_module, "_budget_enforcer", _stub_enforcer)
    # Trinity also checks provider keys; give it one so it doesn't early-abort.
    monkeypatch.setattr(llm_router_module, "OPENAI_API_KEY", "sk-test")

    async def _run():
        return await llm_router_module.llm_trinity_chat(
            system_message="s",
            user_message="u",
            user_id="user-1",
            tier="free",
        )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(_run())

    assert exc_info.value.status_code == 402


def test_llm_chat_with_usage_raises_402_before_any_http_call(llm_router_module, monkeypatch):
    """Third entrypoint — calibration scoring and anywhere else that
    needs raw usage counts uses this. Same hard-stop contract."""
    import asyncio

    def _explode(*args, **kwargs):
        raise AssertionError(
            "HTTP client was invoked before the enforcer in llm_chat_with_usage"
        )

    monkeypatch.setattr(llm_router_module.httpx, "AsyncClient", _explode)

    def _stub_enforcer(sb, user_id, tier):
        raise HTTPException(status_code=402, detail={"error": "free_tier_quota_exhausted"})

    monkeypatch.setattr(llm_router_module, "_budget_enforcer", _stub_enforcer)

    async def _run():
        return await llm_router_module.llm_chat_with_usage(
            system_message="s",
            user_message="u",
            user_id="user-1",
            tier="free",
        )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(_run())

    assert exc_info.value.status_code == 402


def test_llm_chat_skips_enforcer_when_user_id_absent(llm_router_module, monkeypatch):
    """Anonymous / background calls don't have a user_id. They must not
    invoke the enforcer at all — there's nothing to block against."""
    import asyncio

    call_count = {"enforcer": 0}

    def _stub_enforcer(sb, user_id, tier):
        call_count["enforcer"] += 1

    monkeypatch.setattr(llm_router_module, "_budget_enforcer", _stub_enforcer)

    # Mock httpx so the actual llm_chat fails on missing key (not our concern
    # for this test — we only care whether the enforcer was invoked).
    monkeypatch.setattr(llm_router_module, "OPENAI_API_KEY", "")

    async def _run():
        try:
            await llm_router_module.llm_chat(
                system_message="s",
                user_message="u",
                user_id=None,
                tier="free",
            )
        except Exception:
            pass  # we're asserting on call_count, not on return value

    asyncio.run(_run())
    assert call_count["enforcer"] == 0, "enforcer must not run for anonymous calls"
