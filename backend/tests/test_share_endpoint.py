"""
Tests for the CMO Report Share endpoint — fix/p0-marjo-e8-share-function.

PR #449 admitted "Share action could silently no-op". This test module
proves:

  1. POST /reports/cmo-report/share writes a share_events row and returns
     {ok, share_url, expires_at, share_event_id} — never a silent 200 with
     empty body.
  2. GET  /reports/cmo-report/shared/{token} returns sanitised text/html
     for a live token; 410 for expired/revoked; 400 for malformed; 404
     for missing.
  3. Contract v2: the public HTML never contains supplier names or
     internal markers.
"""
from __future__ import annotations

import asyncio
import importlib
import re
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.responses import HTMLResponse


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── In-memory Supabase stub ──────────────────────────────────────────────
# The real client supports a fluent builder. We mirror just the ops the
# share endpoint uses: select / insert / update / eq / order / limit /
# execute, plus a maybe_single() that we never actually invoke from the
# share path but include for parity with intelligence_modules helpers.

class _Result:
    def __init__(self, data):
        self.data = data


class _StubTable:
    def __init__(self, store, name):
        self._store = store
        self._name = name
        self._select_cols = "*"
        self._filters = []
        self._order = None
        self._limit_val = None
        self._maybe_single = False
        self._pending_insert = None
        self._pending_update = None

    def select(self, cols):
        self._select_cols = cols
        return self

    def insert(self, row):
        self._pending_insert = dict(row)
        return self

    def update(self, patch):
        self._pending_update = dict(patch)
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, n):
        self._limit_val = n
        return self

    def maybe_single(self):
        self._maybe_single = True
        return self

    def _matches(self, row):
        for col, val in self._filters:
            if row.get(col) != val:
                return False
        return True

    def execute(self):
        rows = self._store.setdefault(self._name, [])
        if self._pending_insert is not None:
            row = dict(self._pending_insert)
            row.setdefault("id", f"id-{len(rows) + 1}")
            row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
            rows.append(row)
            return _Result([dict(row)])
        if self._pending_update is not None:
            updated = []
            for r in rows:
                if self._matches(r):
                    r.update(self._pending_update)
                    updated.append(dict(r))
            return _Result(updated)
        # SELECT
        matched = [dict(r) for r in rows if self._matches(r)]
        if self._limit_val is not None:
            matched = matched[: self._limit_val]
        if self._maybe_single:
            return _Result(matched[0] if matched else None)
        return _Result(matched)


class _StubSB:
    def __init__(self):
        self._store = {
            "share_events": [],
            "business_dna_enrichment": [
                {
                    "id": "enr-1",
                    "user_id": "user-1",
                    "enrichment": {
                        "business_name": "Acme Co",
                        "executive_summary": "Acme is a friendly local widget maker.",
                        "swot": {
                            "strengths": ["Loyal customers"],
                            "weaknesses": ["Thin margins"],
                            "opportunities": ["New region"],
                            "threats": ["Aggressive competitor"],
                        },
                    },
                    "digital_footprint": {},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ],
        }

    def table(self, name):
        return _StubTable(self._store, name)


# ─── Module loader fixture ────────────────────────────────────────────────

@pytest.fixture
def reports_module(monkeypatch):
    """Load routes.reports with all heavy deps stubbed.

    We DON'T stub `core.response_sanitizer` because the tests need real
    sanitiser behaviour to prove Contract-v2 compliance.
    """
    sb_instance = _StubSB()

    auth_stub = types.ModuleType("routes.auth")
    auth_stub.get_current_user = lambda: {"id": "user-1"}
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    supabase_stub = types.ModuleType("supabase_client")
    supabase_stub.get_supabase_client = lambda: sb_instance
    supabase_stub.init_supabase = lambda: sb_instance
    monkeypatch.setitem(sys.modules, "supabase_client", supabase_stub)

    # Provide a deterministic CMO report payload so the public HTML test
    # can assert specific company/SWOT text.
    intelligence_stub = types.ModuleType("routes.intelligence_modules")

    async def _fake_report(user_dict):
        return {
            "company_name": "Acme Co",
            "report_date": "01/05/2026",
            "executive_summary": "Acme is a friendly local widget maker.",
            "market_position": {"overall": 72, "brand": 70, "digital": 76, "sentiment": 68},
            "swot": {
                "strengths": ["Loyal customers"],
                "weaknesses": ["Thin margins"],
                "opportunities": ["New region"],
                "threats": ["Aggressive competitor"],
            },
            "roadmap": {
                "quick_wins": [{"text": "Refresh homepage hero"}],
                "priorities": [{"text": "Launch newsletter"}],
                "strategic": [{"text": "Open second location"}],
            },
        }

    intelligence_stub.get_cmo_report = _fake_report
    monkeypatch.setitem(sys.modules, "routes.intelligence_modules", intelligence_stub)

    if "routes.reports" in sys.modules:
        del sys.modules["routes.reports"]
    module = importlib.import_module("routes.reports")
    # Expose the stub store so tests can introspect inserted rows.
    module._test_store = sb_instance._store  # type: ignore[attr-defined]
    return module


# ─── POST /reports/cmo-report/share ───────────────────────────────────────

def test_share_create_persists_row_and_returns_url(reports_module):
    payload = reports_module.ShareCreateRequest()
    response = asyncio.run(reports_module.create_cmo_report_share(payload, {"id": "user-1"}))

    assert response["ok"] is True
    assert response["mechanism"] == "shareable_link"
    assert isinstance(response["share_url"], str) and response["share_url"].startswith("http")
    assert "/r/" in response["share_url"]
    assert isinstance(response["expires_at"], str) and response["expires_at"]
    assert response["share_event_id"]

    # Persistence: a share_events row exists with the same token embedded
    # in share_url, owned by the caller, with accessed_count=0.
    rows = reports_module._test_store["share_events"]
    assert len(rows) == 1
    row = rows[0]
    assert row["user_id"] == "user-1"
    assert row["mechanism"] == "shareable_link"
    assert row["accessed_count"] == 0
    assert row["token"]
    assert row["token"] in response["share_url"]


def test_share_create_rejects_unauthenticated_caller(reports_module):
    payload = reports_module.ShareCreateRequest()
    with pytest.raises(HTTPException) as exc:
        asyncio.run(reports_module.create_cmo_report_share(payload, {}))
    assert exc.value.status_code == 401


def test_share_create_clamps_excessive_ttl(reports_module):
    payload = reports_module.ShareCreateRequest(ttl_days=9999)
    response = asyncio.run(reports_module.create_cmo_report_share(payload, {"id": "user-1"}))
    expires = datetime.fromisoformat(response["expires_at"].replace("Z", "+00:00"))
    delta_days = (expires - datetime.now(timezone.utc)).days
    # Clamped to _SHARE_MAX_TTL_DAYS (30); allow off-by-one for clock drift.
    assert 28 <= delta_days <= 31


def test_share_create_writes_recipient_when_provided(reports_module):
    payload = reports_module.ShareCreateRequest(recipient="cfo@example.com")
    response = asyncio.run(reports_module.create_cmo_report_share(payload, {"id": "user-1"}))
    assert response["recipient"] == "cfo@example.com"
    rows = reports_module._test_store["share_events"]
    assert rows[-1]["recipient"] == "cfo@example.com"


def test_share_create_never_silent_noop_on_supabase_failure(reports_module, monkeypatch):
    """Critical assertion against PR #449's admitted bug: no silent no-op.

    When the underlying insert raises, the endpoint must raise HTTPException,
    not return a 200 with empty data.
    """
    class _BrokenTable:
        def insert(self, _row):
            return self
        def select(self, _cols):
            return self
        def eq(self, *_args, **_kwargs):
            return self
        def order(self, *_args, **_kwargs):
            return self
        def limit(self, *_args, **_kwargs):
            return self
        def execute(self):
            raise RuntimeError("simulated DB outage")

    class _BrokenSB:
        def table(self, name):
            return _BrokenTable()

    monkeypatch.setattr(sys.modules["supabase_client"], "get_supabase_client", lambda: _BrokenSB())

    payload = reports_module.ShareCreateRequest()
    with pytest.raises(HTTPException) as exc:
        asyncio.run(reports_module.create_cmo_report_share(payload, {"id": "user-1"}))
    assert exc.value.status_code in (502, 503)
    # The detail must be sanitised — no 'RuntimeError', no 'simulated DB outage'.
    assert "RuntimeError" not in str(exc.value.detail)
    assert "simulated" not in str(exc.value.detail).lower()


# ─── GET /reports/cmo-report/shared/{token} ───────────────────────────────

def test_share_shared_returns_sanitised_html_for_live_token(reports_module):
    # Seed a live share row.
    payload = reports_module.ShareCreateRequest()
    created = asyncio.run(reports_module.create_cmo_report_share(payload, {"id": "user-1"}))
    token = created["share_url"].rsplit("/", 1)[-1]

    response = asyncio.run(reports_module.get_cmo_report_shared(token))

    assert isinstance(response, HTMLResponse)
    assert response.status_code == 200
    body = response.body.decode("utf-8")
    assert "BIQc CMO Report" in body
    assert "Acme Co" in body
    assert "Loyal customers" in body  # SWOT strength rendered
    # Robots header — public surface must opt-out of indexing.
    assert response.headers.get("X-Robots-Tag", "").lower().startswith("noindex")
    # accessed_count must have ticked.
    rows = reports_module._test_store["share_events"]
    assert rows[-1]["accessed_count"] == 1


def test_share_shared_rejects_malformed_token(reports_module):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(reports_module.get_cmo_report_shared("not a token"))
    assert exc.value.status_code == 400


def test_share_shared_returns_410_for_expired_token(reports_module):
    # Seed a row directly with an expires_at in the past.
    expired_token = "X" * 43
    reports_module._test_store["share_events"].append({
        "id": "expired-1",
        "user_id": "user-1",
        "mechanism": "shareable_link",
        "token": expired_token,
        "share_url": f"https://biqc.ai/r/{expired_token}",
        "expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "revoked_at": None,
        "accessed_count": 0,
    })
    with pytest.raises(HTTPException) as exc:
        asyncio.run(reports_module.get_cmo_report_shared(expired_token))
    assert exc.value.status_code == 410


def test_share_shared_returns_410_for_revoked_token(reports_module):
    revoked_token = "Y" * 43
    reports_module._test_store["share_events"].append({
        "id": "revoked-1",
        "user_id": "user-1",
        "mechanism": "shareable_link",
        "token": revoked_token,
        "share_url": f"https://biqc.ai/r/{revoked_token}",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "revoked_at": datetime.now(timezone.utc).isoformat(),
        "accessed_count": 0,
    })
    with pytest.raises(HTTPException) as exc:
        asyncio.run(reports_module.get_cmo_report_shared(revoked_token))
    assert exc.value.status_code == 410


def test_share_shared_returns_404_for_unknown_token(reports_module):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(reports_module.get_cmo_report_shared("Z" * 43))
    assert exc.value.status_code == 404


def test_share_shared_html_contains_no_supplier_names(reports_module):
    """Contract v2: the public HTML must never leak supplier names or
    internal markers — even if the underlying enrichment text contains them.
    """
    # Seed an enrichment row whose text mentions banned tokens, then
    # share it and verify the rendered HTML has them stripped.
    sb_module = sys.modules["supabase_client"]
    sb = sb_module.get_supabase_client()
    sb._store["business_dna_enrichment"].append({
        "id": "enr-2",
        "user_id": "user-2",
        "enrichment": {
            "business_name": "Beta Industries",
            "executive_summary": "We use SEMrush data and OpenAI to power growth.",
            "swot": {
                "strengths": ["Strong from Perplexity insights"],
                "weaknesses": [],
                "opportunities": [],
                "threats": [],
            },
        },
        "digital_footprint": {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })

    # Override the fake report to surface the polluted text.
    async def _polluted(user_dict):
        return {
            "company_name": "Beta Industries",
            "report_date": "01/05/2026",
            "executive_summary": "We use SEMrush data and OpenAI to power growth.",
            "swot": {
                "strengths": ["Strong from Perplexity insights"],
                "weaknesses": [],
                "opportunities": [],
                "threats": [],
            },
            "roadmap": {"quick_wins": [], "priorities": [], "strategic": []},
        }
    sys.modules["routes.intelligence_modules"].get_cmo_report = _polluted

    payload = reports_module.ShareCreateRequest()
    created = asyncio.run(reports_module.create_cmo_report_share(payload, {"id": "user-2"}))
    token = created["share_url"].rsplit("/", 1)[-1]

    response = asyncio.run(reports_module.get_cmo_report_shared(token))
    body = response.body.decode("utf-8")
    # All four supplier names must be redacted (case-insensitive).
    for banned in ("SEMrush", "OpenAI", "Perplexity", "Firecrawl"):
        assert not re.search(banned, body, re.IGNORECASE), f"{banned!r} leaked into shared HTML"


def test_share_shared_html_contains_brand_name_ask_biqc_safe(reports_module):
    """The shared HTML must read as a BIQc surface — never Soundboard /
    Chat / Assistant. This guards against future drift breaking the brand
    contract (per feedback_ask_biqc_brand_name.md)."""
    payload = reports_module.ShareCreateRequest()
    created = asyncio.run(reports_module.create_cmo_report_share(payload, {"id": "user-1"}))
    token = created["share_url"].rsplit("/", 1)[-1]
    response = asyncio.run(reports_module.get_cmo_report_shared(token))
    body = response.body.decode("utf-8")
    assert "BIQc" in body
    for banned_brand in ("Soundboard", "Chat Assistant", "soundboard"):
        assert banned_brand not in body
