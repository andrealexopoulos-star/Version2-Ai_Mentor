"""
Tests for the `llm_global_pause` kill-switch in core/llm_router (Sprint D #28c).

Covers:
  (a) Flag ON  (enabled=True)  → normal provider path reached, provider called
  (b) Flag OFF (enabled=False) → sentinel response returned, provider NOT called
  (c) Flag lookup ERRORS       → defaults to NORMAL (fail-open), provider called
  (d) Per-request caching      → multiple calls within one request hit the DB once

The guard lives in every public entry function (llm_chat / llm_trinity_chat /
llm_chat_with_usage). We exercise llm_chat since it's the common path; the
trinity + with_usage variants share the same helper.

Run: pytest backend/tests/test_llm_router_flag.py -v

Note on hermeticity: other test files (e.g. test_feature_flags.py) also stub
`sys.modules["routes.deps"]`. We save + restore the prior stub so repeated
pytest runs that collect both files in the same process don't pollute each
other's state.
"""
from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import patch

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# Import the router under test — it's clean on 3.9 since heavy deps are lazy.
from core import llm_router as router  # noqa: E402


# ─── Fake Supabase ───────────────────────────────────────────────────────────

class _FakeRpcResult:
    def __init__(self, data: Any):
        self.data = data


class _FakeRpcOp:
    def __init__(self, parent: "_FakeSupabase", name: str, params: Dict[str, Any]):
        self._p = parent
        self._name = name
        self._params = params

    def execute(self) -> _FakeRpcResult:
        self._p.rpc_calls.append({"name": self._name, "params": dict(self._params or {})})
        if self._p.rpc_raises is not None:
            raise self._p.rpc_raises
        if self._name == "is_feature_flag_enabled":
            return _FakeRpcResult(self._p.flag_enabled)
        return _FakeRpcResult(None)


class _FakeSupabase:
    """Minimal fake — only covers .rpc(name, params).execute() for the guard."""

    def __init__(self, flag_enabled: bool = True, rpc_raises: Optional[Exception] = None):
        self.flag_enabled = flag_enabled
        self.rpc_raises = rpc_raises
        self.rpc_calls: List[Dict[str, Any]] = []

    def rpc(self, name: str, params: Optional[Dict[str, Any]] = None) -> _FakeRpcOp:
        return _FakeRpcOp(self, name, params or {})


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _reset_cache_and_log():
    """Isolate each test — the ContextVar cache and warn-once flag bleed otherwise."""
    router._reset_llm_pause_cache()
    router._LLM_PAUSE_LOGGED = False
    yield
    router._reset_llm_pause_cache()
    router._LLM_PAUSE_LOGGED = False


@pytest.fixture
def fake_sb_factory():
    """Yields a callable that installs a fake sb into routes.deps.get_sb.

    Preserves any prior `routes.deps` module in sys.modules so sibling test
    files that also stub it (test_feature_flags.py) still see their own stubs
    when pytest collects them in the same process.
    """
    prior_routes = sys.modules.get("routes")
    prior_deps = sys.modules.get("routes.deps")
    prior_deps_get_sb = getattr(prior_deps, "get_sb", None) if prior_deps else None

    installed_sb = {"ref": None}

    def _install(sb):
        installed_sb["ref"] = sb
        if "routes" not in sys.modules:
            pkg = types.ModuleType("routes")
            pkg.__path__ = [str(ROOT / "routes")]
            sys.modules["routes"] = pkg
        # Install or patch the deps module
        if "routes.deps" not in sys.modules:
            deps = types.ModuleType("routes.deps")
            sys.modules["routes.deps"] = deps
        sys.modules["routes.deps"].get_sb = lambda: sb

    yield _install

    # Restore prior state
    if prior_deps is not None and prior_deps_get_sb is not None:
        sys.modules["routes.deps"].get_sb = prior_deps_get_sb
    elif prior_deps is None and "routes.deps" in sys.modules:
        # We created it — leave it but clear our override
        del sys.modules["routes.deps"]
    if prior_routes is None and "routes" in sys.modules:
        # Only remove if we added it
        pkg = sys.modules.get("routes")
        # keep it if some other file is using it — safer to leave
        pass


async def _noop_async(*args, **kwargs):
    return None


# ─── Tests ───────────────────────────────────────────────────────────────────

def test_flag_on_hits_provider(fake_sb_factory):
    """When llm_global_pause is ON (enabled=True), provider is called normally."""
    sb = _FakeSupabase(flag_enabled=True)
    fake_sb_factory(sb)
    called = {"count": 0}

    async def _provider(**kwargs):
        called["count"] += 1
        return "real-response", {"prompt_tokens": 1, "completion_tokens": 1}

    with patch.object(router, "_openai_chat", new=_provider), \
         patch.object(router, "_record_usage", new=_noop_async), \
         patch.object(router, "_check_budget_or_raise", new=_noop_async), \
         patch.object(router, "OPENAI_API_KEY", "fake-key"):
        result = asyncio.run(router.llm_chat(
            system_message="sys",
            user_message="hi",
            route="default",
            user_id="u1",
        ))

    assert called["count"] == 1, "provider should be called exactly once when flag is ON"
    assert result == "real-response"
    assert len(sb.rpc_calls) == 1
    assert sb.rpc_calls[0]["name"] == "is_feature_flag_enabled"
    assert sb.rpc_calls[0]["params"]["flag"] == "llm_global_pause"


def test_flag_off_returns_sentinel_without_calling_provider(fake_sb_factory):
    """When llm_global_pause is OFF, sentinel is returned and NO provider call fires."""
    sb = _FakeSupabase(flag_enabled=False)
    fake_sb_factory(sb)
    called = {"count": 0}

    async def _provider(**kwargs):
        called["count"] += 1
        return "should-not-happen", {}

    with patch.object(router, "_openai_chat", new=_provider), \
         patch.object(router, "_record_usage", new=_noop_async), \
         patch.object(router, "_check_budget_or_raise", new=_noop_async), \
         patch.object(router, "OPENAI_API_KEY", "fake-key"):
        result = asyncio.run(router.llm_chat(
            system_message="sys",
            user_message="hi",
            route="default",
            user_id="u1",
        ))

    assert called["count"] == 0, "provider MUST NOT be called when flag is OFF"
    assert result == router.LLM_PAUSED_SENTINEL["content"]
    assert "paused" in result.lower()


def test_flag_lookup_error_fails_open(fake_sb_factory):
    """If the flag RPC itself raises, guard must default to NORMAL path (provider called)."""
    sb = _FakeSupabase(
        flag_enabled=True,
        rpc_raises=RuntimeError("feature_flags table missing / db down / rpc missing"),
    )
    fake_sb_factory(sb)
    called = {"count": 0}

    async def _provider(**kwargs):
        called["count"] += 1
        return "fail-open-response", {"prompt_tokens": 1, "completion_tokens": 1}

    with patch.object(router, "_openai_chat", new=_provider), \
         patch.object(router, "_record_usage", new=_noop_async), \
         patch.object(router, "_check_budget_or_raise", new=_noop_async), \
         patch.object(router, "OPENAI_API_KEY", "fake-key"):
        result = asyncio.run(router.llm_chat(
            system_message="sys",
            user_message="hi",
            route="default",
            user_id="u1",
        ))

    assert called["count"] == 1, "flag lookup error must fail OPEN — provider still called"
    assert result == "fail-open-response"


def test_is_llm_paused_helper_direct_on():
    """Direct helper test: flag ON → is_paused=False."""
    sb = _FakeSupabase(flag_enabled=True)
    paused = asyncio.run(router._is_llm_paused(sb))
    assert paused is False


def test_is_llm_paused_helper_direct_off():
    """Direct helper test: flag OFF → is_paused=True."""
    sb = _FakeSupabase(flag_enabled=False)
    paused = asyncio.run(router._is_llm_paused(sb))
    assert paused is True


def test_is_llm_paused_fails_open_on_none_sb():
    """If sb is None we assume not-paused (can't check, don't break the world)."""
    paused = asyncio.run(router._is_llm_paused(None))
    assert paused is False


def test_is_llm_paused_caches_within_request():
    """Single ContextVar cache means repeated calls in one async task hit the RPC once."""
    sb = _FakeSupabase(flag_enabled=True)

    async def _double_check():
        a = await router._is_llm_paused(sb)
        b = await router._is_llm_paused(sb)
        return a, b

    a, b = asyncio.run(_double_check())
    assert a is False and b is False
    assert len(sb.rpc_calls) == 1, (
        f"expected 1 rpc call (cached), got {len(sb.rpc_calls)}"
    )


def test_sentinel_shape():
    """LLM_PAUSED_SENTINEL has the documented keys."""
    s = router.LLM_PAUSED_SENTINEL
    assert s["paused"] is True
    assert s["model"] == "paused"
    assert isinstance(s["content"], str) and len(s["content"]) > 10


def test_llm_chat_with_usage_flag_off_returns_zero_usage_tuple(fake_sb_factory):
    """llm_chat_with_usage must unpack cleanly — return (sentinel_content, zero_usage_dict)."""
    sb = _FakeSupabase(flag_enabled=False)
    fake_sb_factory(sb)
    called = {"count": 0}

    async def _provider(**kwargs):
        called["count"] += 1
        return "bad", {}

    with patch.object(router, "_openai_chat", new=_provider), \
         patch.object(router, "_record_usage", new=_noop_async), \
         patch.object(router, "_check_budget_or_raise", new=_noop_async), \
         patch.object(router, "OPENAI_API_KEY", "fake-key"):
        content, usage = asyncio.run(router.llm_chat_with_usage(
            system_message="sys",
            user_message="hi",
            route="default",
            user_id="u1",
        ))

    assert called["count"] == 0
    assert content == router.LLM_PAUSED_SENTINEL["content"]
    assert usage == {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
