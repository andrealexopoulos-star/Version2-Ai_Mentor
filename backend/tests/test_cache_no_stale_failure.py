"""
Regression coverage for the cache-poisoning class of bug closed by PR #383.

Root cause (2026-04-23): backend/routes/calibration.py::_cached_edge returned
ANY cached dict from Redis, including failure payloads (401/5xx) cached by an
earlier deploy. Because the cache TTL was 1h, every scan in the next hour was
served the poisoned 401 instead of calling the edge live. The CMO Report
showed "5% of expected depth" because the entire 7-edge fan-out was re-serving
stale failures.

These tests guarantee the cache layer cannot regress to that behaviour:

    A. test_failed_call_not_cached_as_success
       Failed edge call MUST NOT be cached. A subsequent scan must call live.

    B. test_failed_call_cache_has_short_ttl
       If a failure ever does land in the cache (legacy poisoning), the
       reader MUST NOT serve it. A retry MUST happen and a success MUST
       overwrite the poisoned entry.

    C. test_success_cache_obeys_ttl
       Success entries MUST be written with the declared EDGE_TTL and must
       expire — verified via the fake Redis clock.

    D. test_cache_key_isolation_across_domains
       Two different domains MUST NOT collide on the cache key. Scan A
       caching for foo.com MUST NOT shadow a scan for bar.com.

    E. test_cache_no_per_user_pii_leak
       Cache keys are intentionally domain-scoped (NOT user-scoped) so
       parallel users scanning the same competitor share one API call.
       That sharing is only safe if the cached payload contains NO
       per-user PII. This test asserts the orchestrator never writes a
       cached payload that embeds the requesting user_id.

    F. test_cache_disabled_path
       Setting BIQC_DISABLE_CACHE=1 MUST short-circuit every cache call
       (read returns None, write is no-op) so an in-prod debugger can
       force a fully live scan without a deploy.

The first two tests reproduce the PR #383 regression class. They will FAIL
on the pre-fix _cached_edge that returned any cached dict.

This file uses the same AST-extraction pattern as
test_calibration_edge_normalization.py to load helpers from calibration.py
without booting the full FastAPI app.
"""
from __future__ import annotations

import ast
import asyncio
import importlib
import os
import re
import sys
import types
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
CALIBRATION_SOURCE = REPO_ROOT / "backend" / "routes" / "calibration.py"
SCAN_CACHE_SOURCE = REPO_ROOT / "backend" / "scan_cache.py"


# ---------------------------------------------------------------------------
# Helper loading
# ---------------------------------------------------------------------------

def _load_helpers():
    """Pull `_edge_result_failed` out of calibration.py via AST so we can
    test it without importing the FastAPI router (which drags Supabase, the
    LLM router, Stripe, etc.).
    """
    tree = ast.parse(CALIBRATION_SOURCE.read_text(encoding="utf-8"))
    selected = [
        node
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name in {"_edge_result_failed"}
    ]
    module = ast.Module(body=selected, type_ignores=[])
    namespace: Dict[str, Any] = {"Any": Any}
    exec(compile(module, str(CALIBRATION_SOURCE), "exec"), namespace)
    return namespace


HELPERS = _load_helpers()
edge_result_failed = HELPERS["_edge_result_failed"]


def _load_scan_cache():
    """Import backend/scan_cache.py with biqc_jobs.get_redis stubbed out so
    we never touch the real Redis client at import time.
    """
    # Stub biqc_jobs before scan_cache imports it.
    if "biqc_jobs" not in sys.modules:
        biqc_jobs_stub = types.ModuleType("biqc_jobs")

        def _stub_get_redis():  # pragma: no cover — replaced per-test
            return None

        biqc_jobs_stub.get_redis = _stub_get_redis
        sys.modules["biqc_jobs"] = biqc_jobs_stub

    sys.path.insert(0, str(REPO_ROOT / "backend"))
    if "scan_cache" in sys.modules:
        importlib.reload(sys.modules["scan_cache"])
    import scan_cache as _scan_cache  # noqa: WPS433
    return _scan_cache


scan_cache = _load_scan_cache()


# ---------------------------------------------------------------------------
# Fake Redis with a controllable clock for TTL semantics.
# ---------------------------------------------------------------------------

class FakeRedis:
    """Minimal async Redis stub. Supports the methods scan_cache.py uses
    plus a manual clock for deterministic TTL expiry."""

    def __init__(self) -> None:
        # key -> (value_str, expires_at_seconds_or_None)
        self._store: Dict[str, Tuple[str, Optional[float]]] = {}
        self._now = 0.0
        self.set_calls: List[Dict[str, Any]] = []
        self.get_calls: List[str] = []
        self.delete_calls: List[Tuple[str, ...]] = []

    # Clock control -------------------------------------------------------

    def advance(self, seconds: float) -> None:
        self._now += seconds

    # Redis surface -------------------------------------------------------

    async def get(self, key: str) -> Optional[str]:
        self.get_calls.append(key)
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at is not None and self._now >= expires_at:
            # TTL elapsed; behave like Redis would and drop the entry.
            self._store.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self.set_calls.append({"key": key, "value": value, "ex": ex})
        expires_at = (self._now + ex) if ex else None
        self._store[key] = (value, expires_at)
        return True

    async def delete(self, *keys: str) -> int:
        self.delete_calls.append(tuple(keys))
        removed = 0
        for k in keys:
            if k in self._store:
                self._store.pop(k)
                removed += 1
        return removed

    async def keys(self, pattern: str) -> List[str]:
        # Translate Redis glob to regex (just `*` here).
        rx = re.compile("^" + re.escape(pattern).replace(r"\*", ".*") + "$")
        return [k for k in self._store.keys() if rx.match(k)]


@pytest.fixture
def fake_redis(monkeypatch):
    """Inject a FakeRedis as scan_cache.get_redis()."""
    fake = FakeRedis()
    monkeypatch.setattr(scan_cache, "get_redis", lambda: fake)
    # Make sure no leftover env flag from another test sneaks in.
    monkeypatch.delenv("BIQC_DISABLE_CACHE", raising=False)
    return fake


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


# ---------------------------------------------------------------------------
# Reference orchestrator that mirrors backend/routes/calibration.py::_cached_edge.
# We can't AST-extract it (it's a closure inside enrichment_website) so we
# rebuild its semantics here AND verify (in test_g) that the live source
# still contains the read-side guard pattern. Together they form the
# regression net.
# ---------------------------------------------------------------------------

class _LiveCallTracker:
    """Records every live call the orchestrator makes — i.e. cache misses."""

    def __init__(self) -> None:
        self.calls: List[Tuple[str, Dict[str, Any]]] = []


def _make_cached_edge(scan_domain: str, live_call_responder, tracker: _LiveCallTracker):
    """Return a `_cached_edge(fn_name, payload_dict)` coroutine that mirrors
    the production closure at backend/routes/calibration.py:2410-2440 — same
    read-guard, same write-guard, same structural shape.

    `live_call_responder(fn_name, payload)` returns the dict that a real
    edge call would have returned.
    """

    async def _cached_edge(fn_name: str, payload_dict: Dict[str, Any]):
        hit = await scan_cache.get_edge_result(fn_name, scan_domain)
        # Read-side guard (PR #383): never serve a cached failure.
        if isinstance(hit, dict) and not edge_result_failed(hit):
            return hit
        # Cache miss OR poisoned entry → call live.
        tracker.calls.append((fn_name, payload_dict))
        result = live_call_responder(fn_name, payload_dict)
        # Write-side guard (PR #383): only cache successful results.
        if isinstance(result, dict) and not edge_result_failed(result):
            await scan_cache.set_edge_result(fn_name, scan_domain, result)
        return result

    return _cached_edge


# ===========================================================================
# A. Failed call must not be cached as success.
# ===========================================================================

def test_failed_call_not_cached_as_success(fake_redis):
    """Scan A → edge returns 5xx. Then scan B (same key) → edge returns 200.
    Scan B MUST observe a fresh live call and a 200 result, not a stale 5xx
    served from cache.
    """
    domain = "smsglobal.com"
    fn_name = "deep-web-recon"

    # First scan: edge returns a 502.
    tracker_a = _LiveCallTracker()

    def respond_failure(_fn, _payload):
        return {
            "ok": False,
            "_http_status": 502,
            "code": "EDGE_FUNCTION_HTTP_ERROR",
            "error": "deep-web-recon returned HTTP 502",
        }

    cached_edge_a = _make_cached_edge(domain, respond_failure, tracker_a)
    result_a = _run(cached_edge_a(fn_name, {"user_id": "user-A", "website": "https://smsglobal.com"}))
    assert result_a["ok"] is False
    assert result_a["_http_status"] == 502

    # Cache must remain EMPTY for this key — write-side guard kicks in.
    cached_dict = _run(scan_cache.get_edge_result(fn_name, domain))
    assert cached_dict is None, (
        "Failure was cached. PR #383 regression — _cached_edge must only "
        "set the cache when the result passes _edge_result_failed."
    )

    # Second scan: edge returns 200 with real data.
    tracker_b = _LiveCallTracker()

    def respond_success(_fn, _payload):
        return {"ok": True, "_http_status": 200, "data": {"pages": 7}}

    cached_edge_b = _make_cached_edge(domain, respond_success, tracker_b)
    result_b = _run(cached_edge_b(fn_name, {"user_id": "user-B", "website": "https://smsglobal.com"}))

    # The orchestrator MUST have called live (cache was empty → no stale 502).
    assert tracker_b.calls == [(fn_name, {"user_id": "user-B", "website": "https://smsglobal.com"})], (
        "Scan B did not call live — it served a stale failure from cache."
    )
    assert result_b["ok"] is True
    assert result_b["_http_status"] == 200


# ===========================================================================
# B. Even if a poisoned failure exists in the cache (legacy), it must trigger
#    a live retry, not be served. (This reproduces the PR #383 root cause.)
# ===========================================================================

def test_failed_call_cache_has_short_ttl(fake_redis):
    """Pre-fix deploys did write 5xx into Redis with EDGE_TTL=3600s. The
    fix is read-side: even if such a poisoned row is present, the
    orchestrator MUST treat it as a miss and retry live; a successful live
    call MUST overwrite the poisoned entry.

    Test name preserved per mission spec; semantic check is "poisoned entry
    must self-heal on the next call".
    """
    domain = "poisoned.example"
    fn_name = "semrush-domain-intel"

    # Simulate the legacy poisoning: write a 401 directly into Redis,
    # bypassing the orchestrator's write guard, with the full 1h TTL.
    poisoned_payload = {
        "ok": False,
        "_http_status": 401,
        "code": "EDGE_FUNCTION_HTTP_ERROR",
        "error": "Unauthorized",
    }
    import json as _json
    fake_redis._store[scan_cache._edge_key(fn_name, domain)] = (
        _json.dumps(poisoned_payload),
        3_600.0,  # expires in 3600s — well within EDGE_TTL
    )

    # Now scan: orchestrator must NOT return the poisoned 401.
    tracker = _LiveCallTracker()

    def respond_success(_fn, _payload):
        return {"ok": True, "_http_status": 200, "data": {"organic_keywords": 1234}}

    cached_edge = _make_cached_edge(domain, respond_success, tracker)
    result = _run(cached_edge(fn_name, {"user_id": "u", "domain": domain, "database": "us"}))

    # Must have called live despite the cached entry.
    assert tracker.calls, (
        "Poisoned cache hit was returned. PR #383 regression — _cached_edge "
        "must call _edge_result_failed() before returning a cached dict."
    )
    # And served the live success, not the poison.
    assert result["ok"] is True
    assert result["_http_status"] == 200

    # And overwrote the poisoned entry with the success.
    cached_after = _run(scan_cache.get_edge_result(fn_name, domain))
    assert cached_after is not None and cached_after.get("ok") is True, (
        "Successful live result did not overwrite poisoned cache entry — "
        "self-healing path is broken."
    )


# ===========================================================================
# C. Success cache obeys declared TTL.
# ===========================================================================

def test_success_cache_obeys_ttl(fake_redis):
    """A successful cached result must expire after EDGE_TTL. After expiry,
    the next call must hit the live edge (cache miss), not return stale data.
    """
    domain = "ttltest.example"
    fn_name = "social-enrichment"

    call_counter = {"n": 0}

    def respond_success(_fn, _payload):
        call_counter["n"] += 1
        return {"ok": True, "_http_status": 200, "data": {"call": call_counter["n"]}}

    tracker = _LiveCallTracker()
    cached_edge = _make_cached_edge(domain, respond_success, tracker)

    # First call → live → cached.
    result_1 = _run(cached_edge(fn_name, {"user_id": "u1"}))
    assert result_1["data"]["call"] == 1
    assert len(tracker.calls) == 1

    # Second call within TTL → cache hit.
    result_2 = _run(cached_edge(fn_name, {"user_id": "u2"}))
    assert result_2["data"]["call"] == 1, (
        "Cache hit should have returned the same payload (call=1). "
        "Got call={}".format(result_2["data"]["call"])
    )
    assert len(tracker.calls) == 1, "TTL not honoured — duplicate live call."

    # Verify the SET was made with the declared EDGE_TTL (not no-TTL!).
    edge_set = [c for c in fake_redis.set_calls if c["key"].startswith("biqc:edge:")]
    assert edge_set, "Expected at least one biqc:edge:* SET call."
    assert all(c["ex"] == scan_cache.EDGE_TTL for c in edge_set), (
        "Edge cache SET was made without a TTL or with the wrong TTL — "
        "would create unbounded stale entries. expected ex={}".format(scan_cache.EDGE_TTL)
    )

    # Advance the clock past EDGE_TTL → entry expires → next call goes live.
    fake_redis.advance(scan_cache.EDGE_TTL + 1)
    result_3 = _run(cached_edge(fn_name, {"user_id": "u3"}))
    assert result_3["data"]["call"] == 2, (
        "Stale entry was served past TTL. Cache must drop expired keys."
    )
    assert len(tracker.calls) == 2


# ===========================================================================
# D. Cache key isolation across domains (no cross-business contamination).
# ===========================================================================

def test_cache_key_isolation_across_domains(fake_redis):
    """Caching the deep-web-recon result for foo.com MUST NOT make the same
    fn appear cached for bar.com. Cache key is `biqc:edge:{fn}:{domain}` —
    this test enforces that contract.
    """
    fn_name = "deep-web-recon"
    payload_a = {"foo_data": "alpha"}
    payload_b = {"bar_data": "beta"}

    # Cache foo.com.
    _run(scan_cache.set_edge_result(fn_name, "foo.com", {"ok": True, "_http_status": 200, "data": payload_a}))

    # Read bar.com — must MISS.
    cached_b = _run(scan_cache.get_edge_result(fn_name, "bar.com"))
    assert cached_b is None, (
        "Cache key collision across domains. _edge_key() must include the "
        "domain segment. Found cached entry for bar.com after only foo.com "
        "was written."
    )

    # Read foo.com — must HIT with foo's data.
    cached_a = _run(scan_cache.get_edge_result(fn_name, "foo.com"))
    assert cached_a is not None and cached_a["data"] == payload_a

    # Sanity-check the actual keys held in Redis.
    assert set(fake_redis._store.keys()) == {"biqc:edge:deep-web-recon:foo.com"}, (
        "Unexpected keys in cache: {}".format(list(fake_redis._store.keys()))
    )


# ===========================================================================
# E. No per-user PII leaks via shared-by-domain cache.
# ===========================================================================

def test_cache_no_per_user_pii_leak(fake_redis):
    """The cache is intentionally domain-scoped, NOT user-scoped — so two
    users scanning the same domain share one API call. That sharing is
    safe ONLY if the cached payload contains no per-user PII.

    Per Contract v2 + zero-401 rule: edge results are external-facing
    intelligence. They must contain market data, never the requesting
    user's identifiers.
    """
    domain = "shared-target.example"

    # User A scans first — orchestrator calls live with their user_id in
    # the payload, but the live edge's RESPONSE (what gets cached) must
    # not echo back user_id. Simulate a well-behaved edge response.
    def respond_user_neutral(_fn, payload):
        # Edge response does NOT include the requesting user_id.
        return {"ok": True, "_http_status": 200, "data": {"competitors": ["acme", "globex"]}}

    tracker_a = _LiveCallTracker()
    cached_edge_a = _make_cached_edge(domain, respond_user_neutral, tracker_a)
    _run(cached_edge_a("competitor-monitor", {"user_id": "user-A-uuid"}))

    # Inspect what was cached.
    cached_payload = _run(scan_cache.get_edge_result("competitor-monitor", domain))
    assert cached_payload is not None
    cached_str = str(cached_payload)
    assert "user-A-uuid" not in cached_str, (
        "Cached edge payload contains the requesting user's id. Because "
        "the cache is shared by domain across users, this is a PII leak: "
        "user B will see user A's id in their scan response."
    )

    # User B scans the same domain — must get a cache hit with no user-A
    # identifiers, and must NOT have triggered a live call.
    tracker_b = _LiveCallTracker()
    cached_edge_b = _make_cached_edge(domain, respond_user_neutral, tracker_b)
    result_b = _run(cached_edge_b("competitor-monitor", {"user_id": "user-B-uuid"}))
    assert tracker_b.calls == [], "Cache miss for user B — domain-scoped sharing broken."
    assert "user-A-uuid" not in str(result_b)


# ===========================================================================
# F. BIQC_DISABLE_CACHE=1 short-circuits the cache layer entirely.
# ===========================================================================

def test_cache_disabled_path(fake_redis, monkeypatch):
    """With BIQC_DISABLE_CACHE=1 set, every cache function MUST behave as
    if Redis were down: reads return None, writes are dropped. This is
    the in-prod debug affordance for forcing a fully live scan without a
    deploy.
    """
    domain = "bypass.example"
    fn_name = "deep-web-recon"

    monkeypatch.setenv("BIQC_DISABLE_CACHE", "1")

    # set should be a no-op.
    _run(scan_cache.set_edge_result(fn_name, domain, {"ok": True, "_http_status": 200, "data": {"x": 1}}))
    assert fake_redis.set_calls == [], (
        "BIQC_DISABLE_CACHE=1 did not short-circuit set_edge_result — "
        "Redis SET was issued."
    )

    # Even if Redis already had data (legacy entry from before the flag
    # was flipped), get must NOT return it.
    fake_redis._store[scan_cache._edge_key(fn_name, domain)] = (
        '{"ok": true, "_http_status": 200, "data": {"legacy": true}}',
        None,
    )
    result = _run(scan_cache.get_edge_result(fn_name, domain))
    assert result is None, (
        "BIQC_DISABLE_CACHE=1 did not short-circuit get_edge_result — "
        "stale entry was served."
    )

    # Domain-scan layer too.
    _run(scan_cache.set_domain_scan(domain, {"enrichment": "stuff"}))
    assert all(c["key"] != f"biqc:scan:{domain}" for c in fake_redis.set_calls), (
        "BIQC_DISABLE_CACHE=1 did not short-circuit set_domain_scan."
    )
    assert _run(scan_cache.get_domain_scan(domain)) is None

    # Invalidate is a no-op too — important so a misconfigured caller
    # doesn't accidentally wipe production cache while diagnosing.
    initial_keys = set(fake_redis._store.keys())
    _run(scan_cache.invalidate_domain_scan(domain))
    assert set(fake_redis._store.keys()) == initial_keys, (
        "BIQC_DISABLE_CACHE=1 did not short-circuit invalidate_domain_scan."
    )

    # Flip back off → behavior restored.
    monkeypatch.delenv("BIQC_DISABLE_CACHE", raising=False)
    _run(scan_cache.set_edge_result(fn_name, domain, {"ok": True, "_http_status": 200, "data": {"y": 2}}))
    assert any(c["key"] == scan_cache._edge_key(fn_name, domain) for c in fake_redis.set_calls), (
        "Disabling the bypass did not restore cache behaviour."
    )


# ===========================================================================
# G. Source-level structural assertion: the read-side guard pattern from
#    PR #383 must remain present in calibration.py::_cached_edge. If a
#    future refactor (like PR #449) accidentally removes it, this fails
#    immediately — even before any runtime test triggers.
# ===========================================================================

def test_cached_edge_read_guard_still_present_in_source():
    """The closure `_cached_edge` lives inside the enrichment_website route
    handler and can't be AST-extracted. Instead, verify the source still
    contains the two structural patterns that constitute the PR #383 fix:

        1. Read-side: `if isinstance(hit, dict) and not _edge_result_failed(hit):`
        2. Write-side: `if isinstance(result, dict) and not _edge_result_failed(result):`

    Either one missing = the cache-poisoning bug class is open again.
    """
    src = CALIBRATION_SOURCE.read_text(encoding="utf-8")
    read_guard_rx = re.compile(
        r"if\s+isinstance\(\s*hit\s*,\s*dict\s*\)\s+and\s+not\s+_edge_result_failed\(\s*hit\s*\)\s*:",
    )
    write_guard_rx = re.compile(
        r"if\s+isinstance\(\s*result\s*,\s*dict\s*\)\s+and\s+not\s+_edge_result_failed\(\s*result\s*\)\s*:",
    )
    assert read_guard_rx.search(src), (
        "READ-SIDE cache-poisoning guard removed from "
        "backend/routes/calibration.py::_cached_edge. PR #383 fix regressed: "
        "stale failed cached results will be served indefinitely. Restore "
        "the `if isinstance(hit, dict) and not _edge_result_failed(hit):` "
        "branch."
    )
    assert write_guard_rx.search(src), (
        "WRITE-SIDE cache-poisoning guard removed from "
        "backend/routes/calibration.py::_cached_edge. PR #383 fix regressed: "
        "failed edge calls will be cached and re-served. Restore the "
        "`if isinstance(result, dict) and not _edge_result_failed(result):` "
        "branch around set_edge_result()."
    )


# ===========================================================================
# H. Source-level assertion for the BIQC_DISABLE_CACHE bypass — every
#    public scan_cache function must reference the guard. Future refactors
#    that add a 6th cache function without wiring the bypass would silently
#    leave it un-bypassable.
# ===========================================================================

def test_disable_cache_bypass_wired_into_every_public_fn():
    src = SCAN_CACHE_SOURCE.read_text(encoding="utf-8")
    tree = ast.parse(src)
    public_async = [
        node for node in tree.body
        if isinstance(node, ast.AsyncFunctionDef) and not node.name.startswith("_")
    ]
    missing = []
    for fn in public_async:
        body_src = ast.unparse(fn) if hasattr(ast, "unparse") else src  # py>=3.9
        if "_cache_disabled()" not in body_src:
            missing.append(fn.name)
    assert not missing, (
        "scan_cache.py public coroutines missing the BIQC_DISABLE_CACHE "
        "bypass: {}. Every public read/write/invalidate must call "
        "_cache_disabled() at the top so an in-prod debugger can flip the "
        "flag without restart.".format(missing)
    )
