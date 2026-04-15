"""Unit tests for unified custom_build tier normalisation
(Step 8 / P1-3).

Purpose:
  Prior to this step, `custom_build` was handled inconsistently:
    - tier_resolver.py + frontend treated it as a distinct tier
    - deps._normalize_subscription_tier collapsed it to `enterprise`
    - middleware/token_metering._normalize_tier collapsed it to `enterprise`

  The inconsistency meant a user on 'custom_build' saw "Custom Build" in
  the UI but their rate limits and token allocations were keyed under
  'enterprise', making per-tier reporting lie.

  This suite asserts:
    - Both normalisers return 'custom_build' for 'custom' and 'custom_build'
      inputs.
    - TIER_RATE_LIMIT_DEFAULTS has a distinct 'custom_build' entry.
    - TIER_TOKEN_LIMITS has a distinct 'custom_build' entry with values
      that match enterprise (defensive — if enterprise changes, somebody
      must look at custom_build intentionally).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# routes.deps and middleware.token_metering both import core.config at
# module level. We don't need the real config for these pure-function
# tests, but the import must not explode — so we patch just enough.
@pytest.fixture(autouse=True)
def _stub_heavy_imports(monkeypatch):
    import types

    # supabase_client has a PEP-604 union syntax that fails on Py 3.9;
    # stub it out so routes.deps imports cleanly.
    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    sb_stub.get_supabase_client = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    # auth_supabase re-exports MASTER_ADMIN_EMAIL — just provide a
    # placeholder to satisfy the import.
    auth_sb_stub = types.ModuleType("auth_supabase")
    auth_sb_stub.MASTER_ADMIN_EMAIL = "admin@example.com"
    monkeypatch.setitem(sys.modules, "auth_supabase", auth_sb_stub)

    # core.config exports helpers used by rate limiters — only _get_rate_limit_redis
    # / _redis_sliding_window_check are touched during import, so stub both.
    core_config_stub = types.ModuleType("core.config")
    core_config_stub._get_rate_limit_redis = lambda: None
    core_config_stub._redis_sliding_window_check = lambda *args, **kwargs: (None, None)
    core_pkg = types.ModuleType("core")
    core_pkg.config = core_config_stub
    monkeypatch.setitem(sys.modules, "core", core_pkg)
    monkeypatch.setitem(sys.modules, "core.config", core_config_stub)

    # routes.auth is imported by routes.deps via a sibling import; stub.
    auth_stub = types.ModuleType("routes.auth")
    async def _get_current_user():
        return {"id": "stub"}
    auth_stub.get_current_user = _get_current_user
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    # Freshly import both modules so our stubs take effect.
    for mod_name in ("routes.deps", "middleware.token_metering"):
        if mod_name in sys.modules:
            del sys.modules[mod_name]


# ─── Tests ────────────────────────────────────────────────────────

def test_deps_normalizer_maps_custom_build_to_self():
    from routes.deps import _normalize_subscription_tier

    assert _normalize_subscription_tier("custom_build") == "custom_build"
    assert _normalize_subscription_tier("custom") == "custom_build"
    assert _normalize_subscription_tier("CUSTOM_BUILD") == "custom_build"
    assert _normalize_subscription_tier("  custom  ") == "custom_build"


def test_deps_normalizer_keeps_enterprise_separate():
    """Regression guard — the previous bug was collapsing custom_build
    into enterprise. Make sure enterprise still normalises to itself
    and never becomes custom_build."""
    from routes.deps import _normalize_subscription_tier

    assert _normalize_subscription_tier("enterprise") == "enterprise"
    assert _normalize_subscription_tier("ENTERPRISE") == "enterprise"


def test_token_metering_normalizer_maps_custom_build_to_self():
    from middleware.token_metering import _normalize_tier

    assert _normalize_tier("custom_build") == "custom_build"
    assert _normalize_tier("custom") == "custom_build"
    assert _normalize_tier("Custom_Build") == "custom_build"


def test_token_metering_normalizer_keeps_enterprise_separate():
    from middleware.token_metering import _normalize_tier

    assert _normalize_tier("enterprise") == "enterprise"


def test_tier_rate_limit_defaults_has_custom_build_entry():
    from routes.deps import TIER_RATE_LIMIT_DEFAULTS

    assert "custom_build" in TIER_RATE_LIMIT_DEFAULTS
    # Must match enterprise's monthly ceilings (both unlimited). If this
    # ever changes, the divergence should be intentional — change the
    # test too so future readers see the commit that justified it.
    enterprise = TIER_RATE_LIMIT_DEFAULTS["enterprise"]
    custom = TIER_RATE_LIMIT_DEFAULTS["custom_build"]
    for feature in ("soundboard_daily", "trinity_daily", "boardroom_diagnosis", "war_room_ask"):
        assert feature in custom, f"custom_build missing feature {feature}"
        assert custom[feature]["monthly_limit"] == enterprise[feature]["monthly_limit"]


def test_tier_token_limits_has_custom_build_entry():
    from middleware.token_metering import TIER_TOKEN_LIMITS

    assert "custom_build" in TIER_TOKEN_LIMITS
    enterprise = TIER_TOKEN_LIMITS["enterprise"]
    custom = TIER_TOKEN_LIMITS["custom_build"]
    assert custom["input_allocated"] == enterprise["input_allocated"]
    assert custom["output_allocated"] == enterprise["output_allocated"]


@pytest.mark.parametrize(
    "input_tier,expected",
    [
        ("free", "free"),
        (None, "free"),
        ("", "free"),
        ("unknown", "free"),
        ("starter", "starter"),
        ("growth", "starter"),
        ("foundation", "starter"),
        ("pro", "pro"),
        ("professional", "pro"),
        ("business", "business"),
        ("enterprise", "enterprise"),
        ("custom", "custom_build"),
        ("custom_build", "custom_build"),
        ("super_admin", "super_admin"),
        ("superadmin", "super_admin"),
    ],
)
def test_normalizers_full_table(input_tier, expected):
    """Matrix test — both deps and token_metering must agree on every
    input → canonical output. Catches drift where one normaliser gets
    updated and the other doesn't."""
    from routes.deps import _normalize_subscription_tier
    from middleware.token_metering import _normalize_tier

    assert _normalize_subscription_tier(input_tier) == expected
    assert _normalize_tier(input_tier) == expected
