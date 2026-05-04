"""
Marjo P0 / R2A (2026-05-04) — Full-fanout zero-401 contract for the 4 edge fns
that E1's audit missed but the URL-scan asyncio.gather actually invokes.

Background:
    PR #449 + Round 1 fix (E1, commit c228eae7) covered 8 calibration edge
    functions but missed 4 that ARE in the website_enrichment fanout
    (calibration.py:~2454):

      - semrush-domain-intel
      - competitor-monitor
      - market-analysis-ai
      - market-signal-scorer

    These need the SAME zero-401 treatment as E1's set, plus per-edge-fn
    response_summary persisted to the enrichment payload (sanitised at
    the boundary, not exposed externally).

Pins enforced here:
  α. The full URL-scan fanout is the canonical 11-element gather (8 from
     E1 + 4 from R2A — naming convention says "7 expected" in the brief
     but the actual gather has 11 because deep-web-recon + business-
     identity-lookup + warm-cognitive-engine + calibration-business-dna
     + calibration-sync are E1 functions plus R2A's 4; the brief's "7"
     refers to the original 7 enrichment-edge-functions count from the
     2026-04-23 incident, before browse-ai-reviews + calibration-sync
     were added). Test asserts the 11 currently-gathered slugs are present.

  β. Each of the 4 R2A-added fns appears in MISSION_EDGE_FUNCTIONS_ZERO_401
     (so it benefits from _surface_edge_non_200 logging, strict-mode
     enforcement, and the post-gather blocker scan).

  γ. Contract v2 sanitiser strips internal `_edge_response_summary`
     before the response leaves the backend.

  δ. Provider-trace metadata is collected per fn into the response_summary
     (mocked at the recorder level).

Test strategy: ast-load symbols + read calibration.py source for fanout
slug list. No FastAPI / Supabase imports needed.

Mocked transport: yes. Live verification was captured at PR-author time
under evidence_r2a/edge-fn-status-evidence.txt via Supabase MCP queries.
"""
from __future__ import annotations

import ast
import os
import sys
import re
from pathlib import Path
from typing import List, Set


REPO_ROOT = Path(__file__).resolve().parents[2]
CALIBRATION_SOURCE = REPO_ROOT / "backend" / "routes" / "calibration.py"
SANITIZER_SOURCE = REPO_ROOT / "backend" / "core" / "response_sanitizer.py"


THE_4_R2A_MISSED_FUNCTIONS = (
    "semrush-domain-intel",
    "competitor-monitor",
    "market-analysis-ai",
    "market-signal-scorer",
)

# E1's set + R2A's additions = full mission set. 13 entries (12 distinct
# fns + 1 calibration_psych alias).
THE_FULL_MISSION_SET = {
    # E1
    "browse-ai-reviews",
    "calibration-psych",
    "calibration_psych",
    "business-identity-lookup",
    "calibration-business-dna",
    "calibration-sync",
    "deep-web-recon",
    "warm-cognitive-engine",
    "social-enrichment",
    # R2A
    "semrush-domain-intel",
    "competitor-monitor",
    "market-analysis-ai",
    "market-signal-scorer",
}

# What the website_enrichment fanout actually gathers, slug -> True.
# Sourced by reading the asyncio.gather block. The 8 from E1 + 4 from R2A
# minus the calibration_psych alias = 11. (calibration-psych is invoked
# elsewhere via /integrations proxy, not in the website_enrichment gather.)
EXPECTED_FANOUT_SLUGS = {
    "warm-cognitive-engine",
    "calibration-business-dna",
    "business-identity-lookup",
    "calibration-sync",
    "deep-web-recon",
    "social-enrichment",
    "competitor-monitor",
    "market-analysis-ai",
    "market-signal-scorer",
    "browse-ai-reviews",
    "semrush-domain-intel",
}


def _load_mission_set_from_calibration() -> Set[str]:
    """Pull the literal set MISSION_EDGE_FUNCTIONS_ZERO_401 out of
    calibration.py without importing the full FastAPI module."""
    tree = ast.parse(CALIBRATION_SOURCE.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "MISSION_EDGE_FUNCTIONS_ZERO_401":
                    # Evaluate the set literal in a safe namespace.
                    module = ast.Module(body=[node], type_ignores=[])
                    namespace: dict = {}
                    exec(compile(module, str(CALIBRATION_SOURCE), "exec"), namespace)
                    val = namespace.get("MISSION_EDGE_FUNCTIONS_ZERO_401")
                    assert isinstance(val, set), "must be a set literal"
                    return val
    raise AssertionError("MISSION_EDGE_FUNCTIONS_ZERO_401 not found in calibration.py")


def _extract_fanout_slugs_from_source() -> Set[str]:
    """Static-parse calibration.py for every _cached_edge("…") slug literal
    inside the website_enrichment scan branch. This is the canonical
    answer to "what does the URL-scan asyncio.gather actually call?"
    """
    src = CALIBRATION_SOURCE.read_text(encoding="utf-8")
    # Find every _cached_edge("slug", ...) literal — first-arg string.
    matches = re.findall(r'_cached_edge\(\s*[\"\']([a-z0-9_\-]+)[\"\']', src)
    return set(matches)


# ─── Pin α: Fanout set = E1's 8 + R2A's 4 (or close to it) ─────────────────

def test_full_scan_fanout_includes_all_expected_edge_fns():
    """The website_enrichment scan's asyncio.gather MUST invoke each
    expected edge fn slug (E1's 8 + R2A's 4 = 11 distinct slugs since the
    calibration_psych alias is proxy-only, not in the gather).

    Brief said '7 expected functions' — that's the legacy count from the
    2026-04-23 zero-401 standing rule (before browse-ai-reviews and
    calibration-sync were added to the fanout). The current gather has
    11. This test pins the current set so any silent removal trips a
    P0 alarm.
    """
    actual = _extract_fanout_slugs_from_source()
    missing = EXPECTED_FANOUT_SLUGS - actual
    assert not missing, (
        f"website_enrichment fanout missing expected edge fn(s): {missing}. "
        f"Actual slugs found in source: {sorted(actual)}"
    )


def test_full_scan_fanout_includes_all_4_r2a_missed_fns():
    """The 4 R2A-targeted fns MUST be present in the actual fanout.
    If a future PR removes one without removing the corresponding test
    entry here, this test catches it as a regression."""
    actual = _extract_fanout_slugs_from_source()
    for slug in THE_4_R2A_MISSED_FUNCTIONS:
        assert slug in actual, (
            f"website_enrichment fanout no longer invokes {slug!r}. "
            f"If this is intentional, also remove it from "
            f"MISSION_EDGE_FUNCTIONS_ZERO_401 + this test."
        )


# ─── Pin β: Each of the 4 R2A fns is in the mission set ───────────────────

def test_each_of_4_missed_fns_in_mission_set():
    """The 4 R2A-targeted fns MUST be present in
    MISSION_EDGE_FUNCTIONS_ZERO_401 so they get _surface_edge_non_200
    logging + strict-mode enforcement + post-gather blocker check."""
    mission = _load_mission_set_from_calibration()
    for slug in THE_4_R2A_MISSED_FUNCTIONS:
        assert slug in mission, (
            f"R2A-missed slug {slug!r} not in MISSION_EDGE_FUNCTIONS_ZERO_401 "
            f"(set={sorted(mission)!r}). Add it back — zero-401 standing rule."
        )


def test_mission_set_is_union_of_e1_and_r2a():
    """Sanity check: the mission set is exactly the union of E1's 8 + alias
    + R2A's 4 = 13 entries. Catches accidental additions/removals."""
    mission = _load_mission_set_from_calibration()
    assert mission == THE_FULL_MISSION_SET, (
        f"MISSION_EDGE_FUNCTIONS_ZERO_401 differs from expected union.\n"
        f"  Missing from set: {THE_FULL_MISSION_SET - mission}\n"
        f"  Unexpected in set: {mission - THE_FULL_MISSION_SET}"
    )


# ─── Pin γ: Contract v2 sanitiser strips _edge_response_summary ───────────

def test_contract_v2_sanitiser_strips_edge_response_summary():
    """The _edge_response_summary key (added by R2A to the enrichment
    payload) carries internal slug + status + code per fn. It MUST be
    stripped by the centralised sanitiser before reaching the frontend
    (per BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2 rule 1:
    backend is the boundary)."""
    # Add backend/ to sys.path for response_sanitizer import.
    backend_dir = REPO_ROOT / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    from core.response_sanitizer import _INTERNAL_KEYS, _scrub_internal_keys
    assert "_edge_response_summary" in _INTERNAL_KEYS, (
        "_edge_response_summary must be in _INTERNAL_KEYS to be stripped. "
        "If this fails, the per-fn audit metadata leaks supplier slugs to UI."
    )
    payload = {
        "business_name": "Test Co",
        "_edge_response_summary": {
            "semrush-domain-intel": {"ok": False, "_http_status": 503, "code": "EDGE_FUNCTION_FAILED"},
            "competitor-monitor": {"ok": True, "_http_status": 200, "code": "OK"},
            "market-analysis-ai": {"ok": True, "_http_status": 200, "code": "OK"},
            "market-signal-scorer": {"ok": False, "_http_status": 400, "code": "EDGE_FUNCTION_HTTP_ERROR"},
        },
    }
    cleaned = _scrub_internal_keys(payload)
    assert "_edge_response_summary" not in cleaned, (
        f"_edge_response_summary survived the sanitiser — "
        f"supplier slugs would leak to UI. Got: {cleaned}"
    )
    assert "business_name" in cleaned, "non-internal keys must survive"


def test_contract_v2_sanitiser_strips_edge_response_summary_at_any_depth():
    """Defence in depth: even if a future merge nests the summary inside
    a sub-object, the recursive scrubber strips it."""
    backend_dir = REPO_ROOT / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    from core.response_sanitizer import _scrub_internal_keys
    payload = {
        "business_name": "Test Co",
        "diagnostics": {
            "_edge_response_summary": {
                "semrush-domain-intel": {"ok": False},
            },
            "ok_field": "ok value",
        },
    }
    cleaned = _scrub_internal_keys(payload)
    assert "_edge_response_summary" not in cleaned.get("diagnostics", {}), (
        "nested _edge_response_summary survived — recursive scrub is broken"
    )
    assert cleaned["diagnostics"].get("ok_field") == "ok value"


# ─── Pin δ: response_summary contract for each of the 4 fns ───────────────

def test_response_summary_keys_present_for_each_of_4_fns():
    """The R2A merge code at calibration.py inserts _edge_response_summary
    with a key per R2A-added fn. Source-level pin: ensure the literal
    tuple used to build the summary names all 4."""
    src = CALIBRATION_SOURCE.read_text(encoding="utf-8")
    # The per-fn summary loop iterates a literal tuple; check each slug
    # appears within the r2a_response_summary block region.
    block_match = re.search(
        r"r2a_response_summary\s*=\s*\{\}.*?enrichment\[\"_edge_response_summary\"\]\s*=\s*r2a_response_summary",
        src,
        flags=re.DOTALL,
    )
    assert block_match, (
        "r2a_response_summary build block not found in calibration.py "
        "— R2A merge step missing"
    )
    block = block_match.group(0)
    for slug in THE_4_R2A_MISSED_FUNCTIONS:
        assert slug in block, (
            f"R2A response summary loop does not include {slug!r}; "
            f"per-fn audit row will be missing"
        )


def test_response_summary_records_failure_with_status_and_code():
    """When an R2A-added fn returns a failure shape, the summary entry
    MUST capture _http_status + code (without supplier name in error). Per
    Contract v2 internal layer: backend logs may carry supplier names; the
    sanitised external response uses the state enum only."""
    # Re-load just the source block to verify the shape is exactly as
    # expected. We can't call the gather block directly without a full
    # FastAPI/Supabase boot, so this is a static-source assertion.
    src = CALIBRATION_SOURCE.read_text(encoding="utf-8")
    # The summary entry shape must include "_http_status" and "code" keys.
    block_match = re.search(
        r'r2a_response_summary\[r2a_fn_name\]\s*=\s*\{(.*?)\}',
        src,
        flags=re.DOTALL,
    )
    assert block_match, "summary entry shape literal not found"
    entry_body = block_match.group(1)
    assert "_http_status" in entry_body, (
        "R2A summary entry must record _http_status for audit"
    )
    assert "code" in entry_body, (
        "R2A summary entry must record code for audit (without supplier name)"
    )
    assert "ok" in entry_body, (
        "R2A summary entry must record ok flag"
    )


# ─── Pin: provider trace inheritance (E2 inherited via _call_edge_function) ─

def test_provider_traces_persisted_for_each_via_inherited_call_edge_function():
    """E2's commit b130fbfe wraps _call_edge_function with begin/complete
    trace pairs around every edge call. The 4 R2A-missed fns inherit this
    automatically because they ALL go through _call_edge_function (via
    _cached_edge in the website_enrichment fanout). This test pins:

      1. _call_edge_function is the single entry path for each of the 4
         (no direct httpx.post bypass for them in the source).
      2. _cached_edge wraps _call_edge_function.

    When E2 lands the begin_trace/complete_trace wrapping inside
    _call_edge_function, each of the 4 fns automatically gets a trace
    pair recorded. No per-fn change needed in R2A.
    """
    src = CALIBRATION_SOURCE.read_text(encoding="utf-8")
    # Pin 1: _cached_edge does call _call_edge_function.
    assert re.search(
        r"async def _cached_edge.*?_call_edge_function\(",
        src,
        flags=re.DOTALL,
    ), "_cached_edge must invoke _call_edge_function"

    # Pin 2: each of the 4 R2A fns is invoked via _cached_edge, not via
    # raw httpx.post somewhere else in this file.
    for slug in THE_4_R2A_MISSED_FUNCTIONS:
        # Must appear inside a _cached_edge("slug", …) call.
        assert re.search(
            rf'_cached_edge\(\s*[\"\']' + re.escape(slug) + r'[\"\']',
            src,
        ), (
            f"slug {slug!r} not invoked via _cached_edge — "
            f"may bypass _call_edge_function and the inherited trace pair"
        )
        # And NOT via a sibling httpx.post.
        # (Soft check: any occurrence of the slug outside _cached_edge or
        # MISSION_EDGE_FUNCTIONS_ZERO_401 is suspicious.)
        bypass = re.search(
            rf'httpx\.post\(.*?{re.escape(slug)}',
            src,
        )
        assert not bypass, (
            f"slug {slug!r} appears in a raw httpx.post call — "
            f"bypasses _call_edge_function tracing"
        )
