"""Unit tests for the daily provider quota sweep.

Covers the contract locked down with Andreas on 2026-04-22 after
Firecrawl silently exhausted its credits:

  • Happy path   — 2000/3000 → row upserted, pct=66.67, no alert
  • Warning path — 2500/3000 (83 %) → warning alert written
  • Critical     — 3500/3000 (116 %) → critical alert, negative remainder
  • API error    — HTTP 500 from Firecrawl → last_check_error, no alert
  • Missing key  — FIRECRAWL_API_KEY unset → silent skip, no row touch
  • Dedup        — previous row already above 80 % → no duplicate alert

Stubbing follows the pattern in backend/tests/test_watchtower_degraded
_hardening.py and test_merge_health_check.py — we wire sys.modules
stubs for routes.deps + supabase_client so the worker imports cleanly
even in a test env without real Supabase credentials, and we inject
a fake httpx client directly into run_quota_check(http_client=…).
"""
from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


# ─── Path + import stubs (matches conftest pattern) ─────────────────

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _install_stub_modules() -> None:
    """Install the minimal sys.modules stubs the worker needs to import.

    We DON'T stub httpx — the worker late-imports it only when no
    http_client is injected, and all our tests pass one in.
    """
    if "routes" not in sys.modules:
        sys.modules["routes"] = types.ModuleType("routes")
    if "routes.deps" not in sys.modules:
        deps_stub = types.ModuleType("routes.deps")

        def _no_get_sb():
            raise RuntimeError("no sb in test env — tests inject sb directly")

        deps_stub.get_sb = _no_get_sb
        sys.modules["routes.deps"] = deps_stub

    if "supabase_client" not in sys.modules:
        sb_stub = types.ModuleType("supabase_client")

        def _no_init():
            raise RuntimeError("no supabase in test env")

        sb_stub.init_supabase = _no_init
        sys.modules["supabase_client"] = sb_stub


_install_stub_modules()


# ─── Fake Supabase client ───────────────────────────────────────────
#
# Minimal chainable stub covering the method calls the worker makes:
#   sb.table(name).select(…).eq(…).limit(…).execute()
#   sb.table(name).select(…).eq(…).order(…).limit(…).execute()
#   sb.table(name).upsert(row, on_conflict=…).execute()
#   sb.table(name).insert(row).execute()

class _FakeQuery:
    def __init__(self, table: "_FakeTable", op: str, payload: Any = None):
        self._table = table
        self._op = op
        self._payload = payload
        self._filters: List[tuple] = []
        self._limit_val: Optional[int] = None
        self._order: Optional[tuple] = None

    def select(self, *_a, **_kw): return self
    def eq(self, col, val): self._filters.append(("eq", col, val)); return self
    def order(self, col, desc=False): self._order = (col, desc); return self
    def limit(self, n): self._limit_val = n; return self

    def execute(self):
        if self._op == "select":
            rows = self._table.rows
            for kind, col, val in self._filters:
                if kind == "eq":
                    rows = [r for r in rows if r.get(col) == val]
            if self._order is not None:
                col, desc = self._order
                rows = sorted(rows, key=lambda r: r.get(col) or "", reverse=desc)
            if self._limit_val is not None:
                rows = rows[: self._limit_val]
            return types.SimpleNamespace(data=rows)
        if self._op == "upsert":
            # overwrite by PK (`provider`)
            pk = self._payload.get("provider")
            for i, existing in enumerate(self._table.rows):
                if existing.get("provider") == pk:
                    self._table.rows[i] = {**existing, **self._payload}
                    return types.SimpleNamespace(data=[self._table.rows[i]])
            self._table.rows.append(dict(self._payload))
            return types.SimpleNamespace(data=[self._payload])
        if self._op == "insert":
            self._table.rows.append(dict(self._payload))
            return types.SimpleNamespace(data=[self._payload])
        return types.SimpleNamespace(data=[])


class _FakeTable:
    def __init__(self, name: str, rows: Optional[List[Dict[str, Any]]] = None):
        self.name = name
        self.rows: List[Dict[str, Any]] = list(rows or [])

    def select(self, *a, **kw): return _FakeQuery(self, "select")
    def upsert(self, payload, on_conflict=None): return _FakeQuery(self, "upsert", payload)
    def insert(self, payload): return _FakeQuery(self, "insert", payload)


class _FakeSupabase:
    def __init__(self, *, super_admin_id: Optional[str] = "super-admin-uuid",
                 existing_quota_rows: Optional[List[Dict[str, Any]]] = None):
        users_rows = []
        if super_admin_id:
            users_rows.append({
                "id": super_admin_id, "tier": "super_admin",
                "created_at": "2020-01-01T00:00:00Z",
            })
        self.tables: Dict[str, _FakeTable] = {
            "users": _FakeTable("users", users_rows),
            "provider_quotas": _FakeTable("provider_quotas", existing_quota_rows or []),
            "alerts_queue": _FakeTable("alerts_queue", []),
        }

    def table(self, name: str) -> _FakeTable:
        if name not in self.tables:
            self.tables[name] = _FakeTable(name)
        return self.tables[name]


# ─── Fake httpx.AsyncClient ─────────────────────────────────────────

class _FakeResponse:
    def __init__(self, status_code: int, json_body: Any = None, text: str = ""):
        self.status_code = status_code
        self._json_body = json_body
        self.text = text or (str(json_body) if json_body is not None else "")

    def json(self):
        return self._json_body


class _FakeHttpClient:
    """Reads a {url: response} dict. Missing URLs return 404.

    Also records every (url, headers) call for assertion.
    """
    def __init__(self, url_map: Dict[str, Any]):
        self._url_map = url_map
        self.calls: List[Dict[str, Any]] = []

    async def get(self, url: str, *, headers: Any = None, timeout: Any = None):
        self.calls.append({"url": url, "headers": headers})
        if url in self._url_map:
            val = self._url_map[url]
            if isinstance(val, Exception):
                raise val
            return val
        return _FakeResponse(404, json_body={"success": False, "error": "not_found"})


def _run(coro):
    return asyncio.run(coro)


# ═══ Tests ═══════════════════════════════════════════════════════════

FIRECRAWL_V1 = "https://api.firecrawl.dev/v1/team/credit-usage"
FIRECRAWL_V2 = "https://api.firecrawl.dev/v2/team/credit-usage"


def _fc_response(remaining: int, plan: int, *, camel: bool = False) -> _FakeResponse:
    if camel:
        body = {
            "success": True,
            "data": {
                "remainingCredits": remaining,
                "planCredits": plan,
                "billingPeriodStart": "2026-04-01T00:00:00Z",
                "billingPeriodEnd": "2026-05-01T00:00:00Z",
            },
        }
    else:
        body = {
            "success": True,
            "data": {
                "remaining_credits": remaining,
                "plan_credits": plan,
                "billing_period_start": "2026-04-01T00:00:00Z",
                "billing_period_end": "2026-05-01T00:00:00Z",
            },
        }
    return _FakeResponse(200, json_body=body)


# ─── Happy path ─────────────────────────────────────────────────────

def test_happy_path_firecrawl_writes_row_and_no_alert(monkeypatch):
    """2000 / 3000 credits — pct ≈ 66.67, no threshold crossed."""
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc_test_key")
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    sb = _FakeSupabase()
    http = _FakeHttpClient({FIRECRAWL_V1: _fc_response(remaining=1000, plan=3000)})

    summary = _run(run_quota_check(sb=sb, http_client=http))

    fc_row = sb.tables["provider_quotas"].rows[0]
    assert fc_row["provider"] == "firecrawl"
    assert fc_row["quota_total"] == 3000
    assert fc_row["quota_used"] == 2000  # 3000 - 1000 remaining
    assert fc_row["last_check_error"] is None
    assert fc_row["last_checked_at"] is not None

    # pct_used in summary is computed at alert-decision time
    fc_summary = [p for p in summary["per_provider"] if p["provider"] == "firecrawl"][0]
    assert abs(fc_summary["pct_used"] - round((2000 / 3000) * 100.0, 2)) < 0.01
    assert fc_summary["severity"] is None
    assert fc_summary["alert_emitted"] is False

    # NO alert row written
    assert sb.tables["alerts_queue"].rows == []
    assert summary["alerts_emitted"] == 0
    assert summary["providers_checked"] >= 1


# ─── Warning threshold (80-99 %) ─────────────────────────────────────

def test_warning_threshold_emits_warning_alert(monkeypatch):
    """2500 / 3000 = 83 % — warning alert, priority=2."""
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc_test_key")
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    sb = _FakeSupabase()
    http = _FakeHttpClient({FIRECRAWL_V1: _fc_response(remaining=500, plan=3000)})

    summary = _run(run_quota_check(sb=sb, http_client=http))

    fc_summary = [p for p in summary["per_provider"] if p["provider"] == "firecrawl"][0]
    assert fc_summary["severity"] == "warning"
    assert fc_summary["alert_emitted"] is True

    alerts = sb.tables["alerts_queue"].rows
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert["user_id"] == "super-admin-uuid"
    assert alert["type"] == "system"
    assert alert["source"] == "provider_quota_check"
    assert alert["priority"] == 2
    assert alert["target_page"] == "/super-admin/providers"
    payload = alert["payload"]
    assert payload["severity"] == "warning"
    assert payload["provider"] == "firecrawl"
    assert payload["quota_used"] == 2500
    assert payload["quota_total"] == 3000


# ─── Critical threshold (>= 100 %) ──────────────────────────────────

def test_critical_threshold_emits_critical_alert_and_negative_remainder(monkeypatch):
    """3500 / 3000 = 116.67 % — critical alert, priority=1, negative remainder."""
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc_test_key")
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    sb = _FakeSupabase()
    # Firecrawl returns negative remaining (−500) when over-cap: plan=3000, used=3500
    http = _FakeHttpClient({FIRECRAWL_V1: _fc_response(remaining=-500, plan=3000)})

    summary = _run(run_quota_check(sb=sb, http_client=http))

    fc_row = sb.tables["provider_quotas"].rows[0]
    assert fc_row["quota_total"] == 3000
    assert fc_row["quota_used"] == 3500  # plan - remaining = 3000 - (-500)
    # quota_remaining is a generated column in prod; client-side we just
    # verify quota_total - quota_used = -500
    assert fc_row["quota_total"] - fc_row["quota_used"] == -500

    alerts = sb.tables["alerts_queue"].rows
    assert len(alerts) == 1
    assert alerts[0]["priority"] == 1
    assert alerts[0]["payload"]["severity"] == "critical"
    assert "EXHAUSTED" in alerts[0]["payload"]["title"]


# ─── API error: HTTP 500 ────────────────────────────────────────────

def test_firecrawl_http_500_records_error_and_no_alert(monkeypatch):
    """Upstream 5xx → last_check_error stored, quota fields untouched,
    no alert fired, sweep continues."""
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc_test_key")
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    sb = _FakeSupabase()
    http = _FakeHttpClient({
        FIRECRAWL_V1: _FakeResponse(500, json_body={"error": "upstream down"},
                                    text='{"error":"upstream down"}'),
        FIRECRAWL_V2: _FakeResponse(500, json_body={"error": "upstream down"},
                                    text='{"error":"upstream down"}'),
    })

    summary = _run(run_quota_check(sb=sb, http_client=http))

    fc_row = sb.tables["provider_quotas"].rows[0]
    assert fc_row["provider"] == "firecrawl"
    assert fc_row["last_check_error"] is not None
    assert "http_500" in fc_row["last_check_error"]
    # Quota numbers NOT set (adapter didn't return them)
    assert fc_row.get("quota_total") in (None,)
    assert fc_row.get("quota_used") in (None,)
    # last_checked_at IS stamped even on error — tells the dashboard
    # "we tried", as opposed to "we've never checked this".
    assert fc_row["last_checked_at"] is not None

    # NO alert fired when we can't determine pct
    assert sb.tables["alerts_queue"].rows == []
    assert summary["providers_errored"] >= 1


# ─── Missing env var: silent skip ───────────────────────────────────

def test_missing_firecrawl_env_var_skips_silently(monkeypatch):
    """No FIRECRAWL_API_KEY → adapter returns skipped_reason=env_not_set,
    provider_quotas row is NOT touched, no alert, no error."""
    monkeypatch.delenv("FIRECRAWL_API_KEY", raising=False)
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    # Seed the table with the migration-125 initial NULL row for firecrawl.
    sb = _FakeSupabase(existing_quota_rows=[
        {"provider": "firecrawl", "quota_total": None, "quota_used": None,
         "last_checked_at": None, "last_check_error": None}
    ])
    http = _FakeHttpClient({})  # no URL will be called

    summary = _run(run_quota_check(sb=sb, http_client=http))

    # Firecrawl row untouched
    fc_rows = [r for r in sb.tables["provider_quotas"].rows if r["provider"] == "firecrawl"]
    assert len(fc_rows) == 1
    assert fc_rows[0].get("last_checked_at") is None  # not stamped
    assert fc_rows[0].get("last_check_error") is None

    # No http calls made to Firecrawl
    firecrawl_calls = [c for c in http.calls if "firecrawl" in c["url"]]
    assert firecrawl_calls == []

    # No alert
    assert sb.tables["alerts_queue"].rows == []
    # Skipped stats
    assert summary["providers_skipped"] >= 1
    fc_summary = [p for p in summary["per_provider"] if p["provider"] == "firecrawl"][0]
    assert fc_summary["skipped_reason"] == "env_not_set"


# ─── Dedup: already-crossed threshold doesn't re-alert ──────────────

def test_already_above_threshold_does_not_duplicate_alert(monkeypatch):
    """If yesterday's row already had pct_used >= 80, today's sweep
    must NOT write a second warning alert — the super-admin dashboard
    is the continuous signal."""
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc_test_key")
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    # Previous row already at 90 %. Today we're still at 85 %.
    sb = _FakeSupabase(existing_quota_rows=[
        {"provider": "firecrawl", "quota_total": 3000, "quota_used": 2700,
         "last_checked_at": "2026-04-21T00:00:00Z"}
    ])
    http = _FakeHttpClient({FIRECRAWL_V1: _fc_response(remaining=450, plan=3000)})

    summary = _run(run_quota_check(sb=sb, http_client=http))

    # Today's pct is 85 %, severity warning, but dedup must kick in.
    fc_summary = [p for p in summary["per_provider"] if p["provider"] == "firecrawl"][0]
    assert fc_summary["severity"] == "warning"
    assert fc_summary["alert_emitted"] is False
    assert sb.tables["alerts_queue"].rows == []


# ─── V2 camelCase fallback (when v1 404s) ───────────────────────────

def test_firecrawl_falls_back_to_v2_when_v1_404s(monkeypatch):
    """v1 returns 404 → adapter tries v2, parses camelCase response."""
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc_test_key")
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    sb = _FakeSupabase()
    http = _FakeHttpClient({
        FIRECRAWL_V1: _FakeResponse(404, json_body={"error": "nope"}),
        FIRECRAWL_V2: _fc_response(remaining=1200, plan=3000, camel=True),
    })

    summary = _run(run_quota_check(sb=sb, http_client=http))

    fc_row = sb.tables["provider_quotas"].rows[0]
    assert fc_row["quota_total"] == 3000
    assert fc_row["quota_used"] == 1800  # 3000 - 1200
    assert fc_row["last_check_error"] is None


# ─── No super-admin user: alert emission skipped, sweep continues ───

def test_no_super_admin_user_skips_alert_without_crashing(monkeypatch):
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc_test_key")
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    sb = _FakeSupabase(super_admin_id=None)
    http = _FakeHttpClient({FIRECRAWL_V1: _fc_response(remaining=500, plan=3000)})

    summary = _run(run_quota_check(sb=sb, http_client=http))

    # Row still written
    fc_rows = [r for r in sb.tables["provider_quotas"].rows if r["provider"] == "firecrawl"]
    assert fc_rows[0]["quota_used"] == 2500
    # But no alert, because there's no user to route it to
    assert sb.tables["alerts_queue"].rows == []
    assert summary["alerts_emitted"] == 0


# ─── Adapter exception doesn't crash the sweep ──────────────────────

def test_adapter_exception_is_captured_and_sweep_continues(monkeypatch):
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc_test_key")
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    sb = _FakeSupabase()
    http = _FakeHttpClient({
        FIRECRAWL_V1: RuntimeError("socket blew up"),
        FIRECRAWL_V2: RuntimeError("socket blew up"),
    })

    summary = _run(run_quota_check(sb=sb, http_client=http))

    # Sweep finished cleanly
    assert "finished_at" in summary
    fc_row = sb.tables["provider_quotas"].rows[0]
    assert fc_row["provider"] == "firecrawl"
    assert fc_row["last_check_error"] is not None
    # Error message captures the exception class
    assert "RuntimeError" in fc_row["last_check_error"] or "socket blew up" in fc_row["last_check_error"]


# ─── No-adapter providers get their last_checked_at stamped ─────────

def test_no_adapter_providers_get_last_checked_stamp(monkeypatch):
    """Providers in _NO_ADAPTER_PROVIDERS (anthropic, supabase, etc.)
    should still have their last_checked_at updated so the dashboard
    shows 'recently reviewed' even though no numeric quota was pulled."""
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc_test_key")
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    from jobs.provider_quota_check import run_quota_check

    sb = _FakeSupabase()
    http = _FakeHttpClient({FIRECRAWL_V1: _fc_response(remaining=1000, plan=3000)})

    summary = _run(run_quota_check(sb=sb, http_client=http))

    provider_names = {r["provider"] for r in sb.tables["provider_quotas"].rows}
    # All no-adapter providers should have rows after the sweep
    for p in ("anthropic", "supabase", "browse_ai", "semrush", "serper"):
        assert p in provider_names, f"{p} row missing"
        row = [r for r in sb.tables["provider_quotas"].rows if r["provider"] == p][0]
        assert row["last_checked_at"] is not None
