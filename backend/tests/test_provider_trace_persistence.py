"""Unit tests for provider trace persistence — P0 Marjo E2 / 2026-05-04.

Mission: prove that for a mocked URL scan, exactly N rows land in
public.enrichment_traces — one per provider/edge attempt, BEFORE+AFTER
state captured, scan_id consistent across all rows.

Cites:
  - BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2 (sanitiser_applied
    must be True on every row written by the new helpers)
  - feedback_zero_401_tolerance.md (failures land rows with error+http_status,
    not silent fallbacks)

The tests don't import the FastAPI route — they exercise the per-call
contract directly:

  * record_provider_trace inserts exactly one row.
  * begin_trace + complete_trace insert one row, then update it.
  * fetch_scan_provider_chain returns the right counts.
  * The known provider catalogue rejects unknowns instead of writing
    rogue rows.
  * The async wrappers behave identically.
  * Helpers are no-op (return None / no insert) when there is no
    Supabase client — telemetry must never raise.
  * The ContextVar (set_active_scan / get_active_scan_id) round-trips
    cleanly and clear_active_scan restores prior state.
"""
from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path
from typing import Any, Dict, List, Optional


# ─── Path + import stubs (same pattern as test_provider_quota_check.py) ──
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _install_stub_modules() -> None:
    """Install minimal sys.modules stubs the helper needs."""
    if "supabase_client" not in sys.modules:
        sb_stub = types.ModuleType("supabase_client")

        # The helper does `from supabase_client import init_supabase`
        # inside _get_sb_client. Default behaviour for a test that
        # hasn't injected an sb is to return None (the helpers must
        # no-op gracefully).
        def _none_client():
            return None

        sb_stub.init_supabase = _none_client
        # Keep the legacy export for any other module that still
        # imports it during the same test run — anon-key client tests.
        sb_stub.get_supabase_client = _none_client
        sys.modules["supabase_client"] = sb_stub


_install_stub_modules()


# ─── Fake Supabase client ───────────────────────────────────────────────
#
# Mirrors test_provider_quota_check.py: a chainable .table().insert().execute()
# and .table().update().eq().execute() facade over an in-memory dict-of-rows.

class _FakeQuery:
    def __init__(self, table: "_FakeTable", op: str, payload: Any = None):
        self._table = table
        self._op = op
        self._payload = payload
        self._filters: List[tuple] = []
        self._order: Optional[tuple] = None
        self._limit_val: Optional[int] = None

    def select(self, *_a, **_kw): return self
    def eq(self, col, val): self._filters.append(("eq", col, val)); return self
    def order(self, col, desc=False): self._order = (col, desc); return self
    def limit(self, n): self._limit_val = n; return self
    def maybe_single(self): return self

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
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", f"trace-{len(self._table.rows) + 1}")
            self._table.rows.append(row)
            return types.SimpleNamespace(data=[row])
        if self._op == "update":
            for kind, col, val in self._filters:
                if kind != "eq":
                    continue
                for i, existing in enumerate(self._table.rows):
                    if existing.get(col) == val:
                        self._table.rows[i] = {**existing, **self._payload}
            return types.SimpleNamespace(data=[])
        return types.SimpleNamespace(data=[])


class _FakeTable:
    def __init__(self, name: str, rows: Optional[List[Dict[str, Any]]] = None):
        self.name = name
        self.rows: List[Dict[str, Any]] = list(rows or [])

    def select(self, *a, **kw): return _FakeQuery(self, "select")
    def insert(self, payload): return _FakeQuery(self, "insert", payload)
    def update(self, payload): return _FakeQuery(self, "update", payload)


class _FakeSupabase:
    def __init__(self):
        self.tables: Dict[str, _FakeTable] = {
            "enrichment_traces": _FakeTable("enrichment_traces", []),
        }

    def table(self, name: str) -> _FakeTable:
        if name not in self.tables:
            self.tables[name] = _FakeTable(name)
        return self.tables[name]


def _run(coro):
    return asyncio.run(coro)


# ═══ Tests ═══════════════════════════════════════════════════════════════

SCAN_ID = "11111111-2222-3333-4444-555555555555"
USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


# ─── 1. Single-call helper writes exactly one row ───────────────────────

def test_record_provider_trace_inserts_exactly_one_row():
    from core.enrichment_trace import record_provider_trace
    sb = _FakeSupabase()
    trace_id = record_provider_trace(
        scan_id=SCAN_ID,
        provider="firecrawl",
        user_id=USER_ID,
        http_status=200,
        latency_ms=842,
        request_summary={"url": "smsglobal.com", "query_chars": 84},
        response_summary={"evidence_size": 12830, "citation_count": 14},
        evidence_payload={"competitors": [1, 2, 3]},
        sanitiser_applied=True,
        sb=sb,
    )
    rows = sb.tables["enrichment_traces"].rows
    assert len(rows) == 1, f"expected exactly 1 row, got {len(rows)}"
    assert trace_id is not None
    row = rows[0]
    assert row["scan_id"] == SCAN_ID
    assert row["provider"] == "firecrawl"
    assert row["user_id"] == USER_ID
    assert row["http_status"] == 200
    assert row["latency_ms"] == 842
    assert row["sanitiser_applied"] is True
    # evidence_hash computed from evidence_payload, sha256 (64 hex chars).
    assert isinstance(row.get("evidence_hash"), str)
    assert len(row["evidence_hash"]) == 64


# ─── 2. begin_trace + complete_trace = one row, two states ──────────────

def test_begin_then_complete_trace_writes_one_row_with_final_state():
    from core.enrichment_trace import begin_trace, complete_trace
    sb = _FakeSupabase()
    trace_id = begin_trace(
        scan_id=SCAN_ID,
        provider="perplexity",
        edge_function="deep-web-recon",
        user_id=USER_ID,
        attempt=1,
        request_summary={"edge_function": "deep-web-recon"},
        sb=sb,
    )
    rows = sb.tables["enrichment_traces"].rows
    assert len(rows) == 1
    assert trace_id is not None
    started_row = rows[0]
    # Pre-call row: http_status + latency_ms are deliberately ABSENT from the
    # insert payload (helper only sets keys with non-None values, so the DB
    # column stores NULL — same contract as "started but not completed").
    assert "http_status" not in started_row
    assert "latency_ms" not in started_row
    assert started_row["edge_function"] == "deep-web-recon"

    ok = complete_trace(
        trace_id,
        http_status=200,
        latency_ms=1340,
        response_summary={"results_count": 9},
        evidence_payload={"results": [1, 2, 3]},
        sanitiser_applied=True,
        sb=sb,
    )
    assert ok is True
    # Same row, now updated.
    assert len(sb.tables["enrichment_traces"].rows) == 1
    final = sb.tables["enrichment_traces"].rows[0]
    assert final["http_status"] == 200
    assert final["latency_ms"] == 1340
    assert final["sanitiser_applied"] is True


# ─── 3. Failure path lands a row with error populated (zero-401 audit) ──

def test_failure_lands_row_with_error_and_status():
    from core.enrichment_trace import record_provider_trace
    sb = _FakeSupabase()
    record_provider_trace(
        scan_id=SCAN_ID,
        provider="semrush",
        edge_function="semrush-domain-intel",
        user_id=USER_ID,
        http_status=401,
        latency_ms=120,
        request_summary={"domain": "smsglobal.com"},
        response_summary={"ok": False, "code": "EDGE_FUNCTION_HTTP_ERROR"},
        error="EDGE_FUNCTION_HTTP_401 : semrush-domain-intel returned HTTP 401",
        sanitiser_applied=True,
        sb=sb,
    )
    rows = sb.tables["enrichment_traces"].rows
    assert len(rows) == 1
    row = rows[0]
    assert row["http_status"] == 401
    assert "401" in row["error"]
    # Per zero-401 contract: failure row STILL persists; no silent fallback.
    assert row["sanitiser_applied"] is True


# ─── 4. Unknown provider rejected — never writes a rogue row ────────────

def test_unknown_provider_rejects_no_row_written():
    from core.enrichment_trace import record_provider_trace
    sb = _FakeSupabase()
    trace_id = record_provider_trace(
        scan_id=SCAN_ID,
        provider="unknown_vendor",
        http_status=200,
        sb=sb,
    )
    assert trace_id is None
    assert len(sb.tables["enrichment_traces"].rows) == 0


# ─── 5. Empty scan_id is a no-op ────────────────────────────────────────

def test_empty_scan_id_is_noop():
    from core.enrichment_trace import record_provider_trace
    sb = _FakeSupabase()
    trace_id = record_provider_trace(
        scan_id="",
        provider="openai",
        http_status=200,
        sb=sb,
    )
    assert trace_id is None
    assert len(sb.tables["enrichment_traces"].rows) == 0


# ─── 6. Helpers no-op when sb is None — telemetry must never raise ──────

def test_helper_returns_none_when_sb_unavailable():
    from core.enrichment_trace import record_provider_trace, complete_trace
    # No sb passed and the stub init_supabase returns None → no raise.
    result = record_provider_trace(scan_id=SCAN_ID, provider="openai", http_status=200)
    assert result is None
    # complete_trace with a None trace_id returns False.
    assert complete_trace(None, http_status=200) is False


def test_get_sb_client_uses_service_role_init_supabase_path():
    """Regression guard for the 2026-05-04 CMO blank-cards bug.

    The trace writer MUST resolve its Supabase client via init_supabase()
    (service-role admin) — NOT get_supabase_client() (anon, RLS-bound).
    Anon-key writes can't bypass RLS and the table's only policy is
    SELECT-for-owner; using the wrong client => every trace insert
    silently fails => enrichment_traces stays empty => CMO provenance
    filter blanks every populated card.

    Cites: BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2,
           feedback_zero_401_tolerance.md.
    """
    import inspect

    from core import enrichment_trace as et

    src = inspect.getsource(et._get_sb_client)
    assert "init_supabase" in src, (
        "_get_sb_client must call init_supabase() (service-role); "
        f"current source:\n{src}"
    )
    # If get_supabase_client appears it must be inside a docstring/comment
    # explaining the prior bug, never as a live call. Easy heuristic: a
    # live call would be `from supabase_client import get_supabase_client`.
    assert "from supabase_client import get_supabase_client" not in src, (
        "_get_sb_client must NOT import get_supabase_client (anon-key); "
        f"current source:\n{src}"
    )


# ─── 7. Async wrappers persist exactly one row each ─────────────────────

def test_async_wrappers_persist_one_row():
    from core.enrichment_trace import arecord_provider_trace, abegin_trace, acomplete_trace
    sb = _FakeSupabase()

    async def _do():
        tid = await arecord_provider_trace(
            scan_id=SCAN_ID, provider="anthropic",
            http_status=200, latency_ms=210,
            request_summary={"model": "claude-opus-4"},
            response_summary={"ok": True, "completion_chars": 1024},
            sanitiser_applied=True,
            sb=sb,
        )
        assert tid is not None
        # begin + complete inside async wrapper = same insert + update flow.
        bid = await abegin_trace(
            scan_id=SCAN_ID, provider="gemini",
            user_id=USER_ID,
            request_summary={"model": "gemini-2.5-pro"},
            sb=sb,
        )
        assert bid is not None
        ok = await acomplete_trace(
            bid,
            http_status=200, latency_ms=540,
            response_summary={"completion_chars": 2210},
            sanitiser_applied=True,
            sb=sb,
        )
        assert ok is True

    _run(_do())
    rows = sb.tables["enrichment_traces"].rows
    # 1 from arecord_provider_trace + 1 from abegin_trace (updated, not new)
    assert len(rows) == 2, f"expected 2 rows, got {len(rows)}"
    by_provider = {r["provider"]: r for r in rows}
    assert "anthropic" in by_provider and by_provider["anthropic"]["http_status"] == 200
    assert "gemini" in by_provider and by_provider["gemini"]["http_status"] == 200


# ─── 8. fetch_scan_provider_chain returns correct counts and providers ──

def test_fetch_scan_provider_chain_summary_shape():
    from core.enrichment_trace import record_provider_trace, fetch_scan_provider_chain
    sb = _FakeSupabase()
    # 3 ok, 1 failure, 1 distinct duplicate provider (firecrawl x2).
    record_provider_trace(scan_id=SCAN_ID, provider="firecrawl", http_status=200, latency_ms=100, sanitiser_applied=True, sb=sb)
    record_provider_trace(scan_id=SCAN_ID, provider="firecrawl", http_status=200, latency_ms=110, sanitiser_applied=True, sb=sb)
    record_provider_trace(scan_id=SCAN_ID, provider="perplexity", http_status=200, latency_ms=300, sanitiser_applied=True, sb=sb)
    record_provider_trace(scan_id=SCAN_ID, provider="semrush", http_status=401, latency_ms=80, error="HTTP_401", sanitiser_applied=True, sb=sb)
    # Plus one row that wasn't sanitised — exercises unsanitised_count.
    record_provider_trace(scan_id=SCAN_ID, provider="openai", http_status=200, latency_ms=420, sanitiser_applied=False, sb=sb)

    chain = fetch_scan_provider_chain(SCAN_ID, sb=sb)
    assert chain["scan_id"] == SCAN_ID
    assert chain["trace_count"] == 5
    assert chain["ok_count"] == 4
    assert chain["fail_count"] == 1
    # Distinct providers: firecrawl, perplexity, semrush, openai — 4 unique.
    assert sorted(chain["providers"]) == ["firecrawl", "openai", "perplexity", "semrush"]
    # One row with sanitiser_applied=False.
    assert chain["unsanitised_count"] == 1


# ─── 9. ContextVar round-trip — set/get/clear works as advertised ───────

def test_active_scan_contextvar_roundtrip():
    from core.enrichment_trace import (
        set_active_scan, clear_active_scan,
        get_active_scan_id, get_active_user_id,
    )
    # Default empty.
    assert get_active_scan_id() is None
    assert get_active_user_id() is None
    tokens = set_active_scan(SCAN_ID, USER_ID)
    assert get_active_scan_id() == SCAN_ID
    assert get_active_user_id() == USER_ID
    clear_active_scan(tokens)
    assert get_active_scan_id() is None
    assert get_active_user_id() is None


# ─── 10. Mocked-scan integration — N edge calls ⇒ N rows ────────────────
#
# Simulates the per-attempt bracket pattern that calibration._call_edge_function
# now uses. The 7 calibration edge functions land 7 rows; failures land rows
# with error populated (zero-401 contract); successes land rows with
# evidence_hash populated.

def test_mocked_seven_edge_calls_lands_seven_rows():
    from core.enrichment_trace import begin_trace, complete_trace
    sb = _FakeSupabase()

    fanout = [
        # (edge_function, provider, http_status, latency_ms, error)
        ("deep-web-recon",       "perplexity", 200, 1300, None),
        ("social-enrichment",    "perplexity", 200, 980,  None),
        ("competitor-monitor",   "perplexity", 200, 1450, None),
        ("market-analysis-ai",   "perplexity", 200, 2100, None),
        ("market-signal-scorer", "perplexity", 200, 760,  None),
        ("browse-ai-reviews",    "browse_ai",  200, 1880, None),
        ("semrush-domain-intel", "semrush",    401, 90,
         "EDGE_FUNCTION_HTTP_401 : semrush-domain-intel returned HTTP 401"),
    ]

    for fn, prov, status, latency, err in fanout:
        tid = begin_trace(
            scan_id=SCAN_ID, provider=prov, edge_function=fn,
            user_id=USER_ID, attempt=1,
            request_summary={"edge_function": fn, "has_user_id": True},
            sb=sb,
        )
        assert tid is not None, f"begin_trace failed for {fn}"
        complete_trace(
            tid,
            http_status=status, latency_ms=latency,
            response_summary={"http_status": status, "ok": err is None},
            error=err,
            evidence_payload={"fn": fn} if err is None else None,
            sanitiser_applied=True,
            sb=sb,
        )

    rows = sb.tables["enrichment_traces"].rows
    assert len(rows) == 7, f"expected 7 rows for 7 edge calls, got {len(rows)}"

    # All rows tagged with the same scan_id.
    assert all(r["scan_id"] == SCAN_ID for r in rows)

    # All rows passed the sanitiser flag.
    assert all(r["sanitiser_applied"] is True for r in rows)

    # 6 successes, 1 failure — the zero-401 audit row is present + non-silent.
    by_status = {}
    for r in rows:
        by_status.setdefault(r["http_status"], []).append(r)
    assert len(by_status.get(200, [])) == 6
    assert len(by_status.get(401, [])) == 1
    failure_row = by_status[401][0]
    assert failure_row["edge_function"] == "semrush-domain-intel"
    assert "401" in failure_row["error"]
    # The successful rows have evidence hashes; the failure row does not.
    success_hashes = [r.get("evidence_hash") for r in by_status[200]]
    assert all(isinstance(h, str) and len(h) == 64 for h in success_hashes)
    assert failure_row.get("evidence_hash") in (None, "")


# ─── 11. Contract: every helper-written row has sanitiser_applied=True ──
#
# This is the audit-pane contract. The CMO daily check counts unsanitised
# rows per scan and surfaces them as compliance debt. The new helpers must
# pass-through the caller's flag rather than hard-coding True; this test
# proves the True-from-caller path lands TRUE in the row.

def test_sanitiser_applied_default_false_explicit_true_persists():
    from core.enrichment_trace import record_provider_trace
    sb = _FakeSupabase()
    # Default = False. Caller didn't claim sanitised.
    record_provider_trace(scan_id=SCAN_ID, provider="openai", http_status=200, sb=sb)
    # Explicit True.
    record_provider_trace(scan_id=SCAN_ID, provider="openai", http_status=200,
                          sanitiser_applied=True, sb=sb)
    rows = sb.tables["enrichment_traces"].rows
    assert len(rows) == 2
    assert rows[0]["sanitiser_applied"] is False
    assert rows[1]["sanitiser_applied"] is True
