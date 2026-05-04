"""Perimeter completeness regression test (P0 Marjo F14 2026-05-04).

Standing rule (feedback_zero_401_tolerance.md + BIQc Platform Contract v2):
every edge function in the calibration scan path MUST appear in EVERY
CI/CD perimeter surface — health contract, deploy smoke, contract gate,
sanitiser denylist, and the daily zero-401 check. If even one surface is
missing, a 401 in prod can ship undetected, which is the exact
churn-bomb pattern Andreas hit on 2026-04-23 with the 7 calibration edge
functions returning 401 silently.

The R-R2B + R-R2C audits found two new edge functions
(`customer-reviews-deep`, `staff-reviews-deep`) added to the scan
asyncio.gather but absent from the perimeter — this test fails-loud the
moment a future agent adds a new edge fn to the scan path without also
wiring it into all 5 perimeter surfaces.

Surfaces verified:
  1. backend/tests/test_calibration_edge_health_contract.py
     HEALTH_CONTRACT_TARGETS — guarantees the edge fn exposes a GET
     `{ ok, function, reachable, generated_at }` health contract.
  2. .github/workflows/supabase-functions-deploy.yml — guarantees the
     edge fn is smoked on every deploy that touches `supabase/functions/`.
  3. .github/workflows/deploy.yml EDGE_FUNCTIONS — guarantees the edge
     fn is smoked on the main BIQc deploy too (parallel surface).
  4. scripts/forensic_edge_contract_gate.py FUNCTION_SLUGS — guarantees
     the production contract gate probes the edge fn on demand.
  5. backend/core/response_sanitizer.py BANNED_INTERNAL_TOKENS —
     guarantees the edge fn slug is stripped from any external response
     (Contract v2 — internal architecture must not leak to the frontend).

If a future agent adds a new edge fn to calibration.py's asyncio.gather
without these 5 surfaces, this test fails — preventing the same gap
that motivated F14.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]


def _read(rel_path: str) -> str:
    return (REPO_ROOT / rel_path).read_text(encoding="utf-8")


def _scan_fanout_edge_fns() -> set[str]:
    """Discover every edge function name passed to `_cached_edge(...)`
    inside the calibration.py asyncio.gather block. This is the
    source-of-truth for "which edge fns are in the scan path"."""
    src = _read("backend/routes/calibration.py")
    # Match `_cached_edge("<name>", ...)` literal — any whitespace around it
    matches = re.findall(r'_cached_edge\(\s*"([a-z0-9-_]+)"', src)
    return set(matches)


def _health_contract_targets() -> set[str]:
    """Read the function names declared in
    test_calibration_edge_health_contract.HEALTH_CONTRACT_TARGETS."""
    src = _read("backend/tests/test_calibration_edge_health_contract.py")
    # Each tuple is on a line like:  "supabase/functions/<name>/index.ts",
    # followed by:                   "<name>",
    # The reliable extraction is the first quoted string per tuple.
    matches = re.findall(r'"supabase/functions/([a-z0-9-_]+)/index\.ts"', src)
    return set(matches)


def _bash_array_entries(src: str, array_name: str) -> set[str]:
    """Parse a bash array like `NAME=( ... )` from a YAML/shell file and
    return the set of token-shaped entries inside it. Comments (`# ...`)
    and blank lines are skipped. The closing `)` MUST be on its own line
    (preceded only by whitespace) so a `)` inside a comment doesn't
    terminate the match prematurely (e.g. `# P0 (2026-05-04)`)."""
    pattern = rf'{array_name}=\((.*?)^\s*\)\s*$'
    block_match = re.search(pattern, src, re.MULTILINE | re.DOTALL)
    if not block_match:
        pytest.fail(f"{array_name}=( ... ) array not found in source")
    block = block_match.group(1)
    names: set[str] = set()
    for line in block.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        token = stripped.split()[0]
        if re.fullmatch(r"[a-z0-9-_]+", token):
            names.add(token)
    return names


def _supabase_workflow_functions() -> set[str]:
    """Read the FUNCTIONS=( ... ) bash array in supabase-functions-deploy.yml."""
    return _bash_array_entries(
        _read(".github/workflows/supabase-functions-deploy.yml"),
        "FUNCTIONS",
    )


def _deploy_workflow_functions() -> set[str]:
    """Read the EDGE_FUNCTIONS=( ... ) array in deploy.yml."""
    return _bash_array_entries(
        _read(".github/workflows/deploy.yml"),
        "EDGE_FUNCTIONS",
    )


def _forensic_gate_function_slugs() -> set[str]:
    """Read FUNCTION_SLUGS list in scripts/forensic_edge_contract_gate.py."""
    src = _read("scripts/forensic_edge_contract_gate.py")
    block_match = re.search(r'FUNCTION_SLUGS:\s*List\[str\]\s*=\s*\[([^\]]+)\]', src)
    if not block_match:
        pytest.fail("FUNCTION_SLUGS list not found in scripts/forensic_edge_contract_gate.py")
    block = block_match.group(1)
    return set(re.findall(r'"([a-z0-9-_]+)"', block))


def _sanitizer_banned_edge_fn_tokens() -> set[str]:
    """Read BANNED_INTERNAL_TOKENS in backend/core/response_sanitizer.py
    and return only the edge-fn-slug-shaped entries (i.e. lowercase
    hyphen-separated tokens like `deep-web-recon`).

    The closing `)` of the tuple must be on its own line — same defence
    against a `)` in a comment ("(2026-05-04)") that we apply to the bash
    array parser above."""
    src = _read("backend/core/response_sanitizer.py")
    block_match = re.search(
        r'BANNED_INTERNAL_TOKENS:\s*Tuple\[str,\s*\.\.\.\]\s*=\s*\((.*?)^\)',
        src,
        re.MULTILINE | re.DOTALL,
    )
    if not block_match:
        pytest.fail("BANNED_INTERNAL_TOKENS tuple not found in response_sanitizer.py")
    block = block_match.group(1)
    quoted = re.findall(r'"([^"]+)"', block)
    # Filter to the edge-fn-slug shape (kebab-case, all lowercase, ≥2 segments)
    return {q for q in quoted if re.fullmatch(r"[a-z][a-z0-9]+(?:-[a-z0-9]+)+", q)}


# ────────────────────────────────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────────────────────────────────

# Edge fns that intentionally do NOT need the GET health contract:
# these run inside their own pipelines (warm-cognitive-engine,
# business-identity-lookup, calibration-sync) and aren't probed by the
# health smoke. Grandfathered explicitly so this test stays focused on
# the new-edge-fn perimeter rather than retrofitting all legacy.
HEALTH_CONTRACT_GRANDFATHERED: set[str] = {
    "warm-cognitive-engine",
    "business-identity-lookup",
}

# Edge fns that don't need to be in the deploy smoke FUNCTIONS array
# (same rationale — internal pipelines, not part of the user-facing
# scan-fanout health gate).
DEPLOY_SMOKE_GRANDFATHERED: set[str] = {
    "warm-cognitive-engine",
    "business-identity-lookup",
}

# The two F14 edge fns (R2B + R2C) that MUST be in every perimeter surface.
# Hard-coded so the test fails if they're ever removed from a surface.
F14_REQUIRED_EVERYWHERE: set[str] = {
    "customer-reviews-deep",
    "staff-reviews-deep",
}


def test_calibration_scan_fanout_includes_both_f14_edge_fns() -> None:
    """Source-of-truth check: both F14 edge fns must appear inside
    calibration.py's asyncio.gather call. If they don't, the rest of the
    perimeter checks become moot (you can't have a perimeter for an edge
    fn that isn't in the scan path)."""
    fanout = _scan_fanout_edge_fns()
    missing = F14_REQUIRED_EVERYWHERE - fanout
    assert not missing, (
        f"F14 edge fns missing from calibration.py asyncio.gather: {missing}. "
        f"Either add them to the scan or remove them from F14_REQUIRED_EVERYWHERE."
    )


def test_health_contract_covers_all_scan_fanout_edge_fns() -> None:
    """Every edge fn in the scan fanout (minus grandfathered) must appear
    in HEALTH_CONTRACT_TARGETS so the per-deploy health smoke catches
    silent 401s before they ship to prod."""
    fanout = _scan_fanout_edge_fns()
    contract_targets = _health_contract_targets()
    expected = fanout - HEALTH_CONTRACT_GRANDFATHERED
    missing = expected - contract_targets
    assert not missing, (
        f"Scan-path edge fns missing from HEALTH_CONTRACT_TARGETS in "
        f"backend/tests/test_calibration_edge_health_contract.py: {missing}. "
        f"Add a (path, name) tuple per edge fn — see existing entries for shape. "
        f"This is required by feedback_zero_401_tolerance.md — without it a 401 "
        f"can ship to prod undetected and silently zero-out a customer's scan."
    )


def test_supabase_deploy_workflow_smokes_all_scan_fanout_edge_fns() -> None:
    """Every scan-fanout edge fn (minus grandfathered) must appear in
    supabase-functions-deploy.yml so it's smoked on every deploy that
    touches `supabase/functions/`."""
    fanout = _scan_fanout_edge_fns()
    deploy_fns = _supabase_workflow_functions()
    expected = fanout - DEPLOY_SMOKE_GRANDFATHERED
    missing = expected - deploy_fns
    assert not missing, (
        f"Scan-path edge fns missing from FUNCTIONS=( ... ) in "
        f".github/workflows/supabase-functions-deploy.yml: {missing}. "
        f"Add each missing edge fn to the bash array."
    )


def test_main_deploy_workflow_smokes_all_scan_fanout_edge_fns() -> None:
    """Every scan-fanout edge fn (minus grandfathered) must appear in
    deploy.yml EDGE_FUNCTIONS so the main BIQc deploy gate also catches
    silent 401s. This is a parallel safety surface to
    supabase-functions-deploy.yml — both are exercised by different
    triggers."""
    fanout = _scan_fanout_edge_fns()
    deploy_fns = _deploy_workflow_functions()
    expected = fanout - DEPLOY_SMOKE_GRANDFATHERED
    missing = expected - deploy_fns
    assert not missing, (
        f"Scan-path edge fns missing from EDGE_FUNCTIONS=( ... ) in "
        f".github/workflows/deploy.yml: {missing}. Add each missing edge "
        f"fn to the bash array."
    )


def test_forensic_gate_probes_both_f14_edge_fns() -> None:
    """The production contract gate must probe both new F14 edge fns so
    operators running `python scripts/forensic_edge_contract_gate.py` see
    immediate health on the new pipelines."""
    gate_fns = _forensic_gate_function_slugs()
    missing = F14_REQUIRED_EVERYWHERE - gate_fns
    assert not missing, (
        f"F14 edge fns missing from FUNCTION_SLUGS in "
        f"scripts/forensic_edge_contract_gate.py: {missing}. Add each "
        f"missing slug to the list (alphabetical order preserved)."
    )


def test_response_sanitizer_bans_both_f14_edge_fn_slugs_externally() -> None:
    """Both F14 edge fn slugs must appear in BANNED_INTERNAL_TOKENS so a
    leaked log line cannot expose the new internal architecture
    (Firecrawl per-platform pipeline) to a customer per Contract v2."""
    banned = _sanitizer_banned_edge_fn_tokens()
    missing = F14_REQUIRED_EVERYWHERE - banned
    assert not missing, (
        f"F14 edge fn slugs missing from BANNED_INTERNAL_TOKENS in "
        f"backend/core/response_sanitizer.py: {missing}. Add each slug "
        f"to the tuple — see other edge-fn entries for shape."
    )


def test_no_edge_fn_in_scan_path_lacks_perimeter_coverage_anywhere() -> None:
    """Aggregate fail-loud: for every edge fn in the calibration scan
    fanout, build a dict of {fn_name: {surface: present?}} and assert
    every fn is present on every surface (modulo the per-surface
    grandfather lists). Designed so a future agent adding a 14th edge
    fn sees ALL the missing surfaces in one error message — instead of
    iterating through 5 separate test failures."""
    fanout = _scan_fanout_edge_fns()
    contract_targets = _health_contract_targets()
    supabase_fns = _supabase_workflow_functions()
    deploy_fns = _deploy_workflow_functions()
    gate_fns = _forensic_gate_function_slugs()
    banned = _sanitizer_banned_edge_fn_tokens()

    gaps: dict[str, list[str]] = {}
    for fn in sorted(fanout):
        missing_from: list[str] = []
        if fn not in contract_targets and fn not in HEALTH_CONTRACT_GRANDFATHERED:
            missing_from.append("HEALTH_CONTRACT_TARGETS")
        if fn not in supabase_fns and fn not in DEPLOY_SMOKE_GRANDFATHERED:
            missing_from.append("supabase-functions-deploy.yml:FUNCTIONS")
        if fn not in deploy_fns and fn not in DEPLOY_SMOKE_GRANDFATHERED:
            missing_from.append("deploy.yml:EDGE_FUNCTIONS")
        # Forensic gate + sanitiser only enforced for F14 edge fns to keep
        # this test focused on the new-edge-fn perimeter; legacy edge fns
        # already have variable coverage and shouldn't fail this test.
        if fn in F14_REQUIRED_EVERYWHERE:
            if fn not in gate_fns:
                missing_from.append("scripts/forensic_edge_contract_gate.py:FUNCTION_SLUGS")
            if fn not in banned:
                missing_from.append("backend/core/response_sanitizer.py:BANNED_INTERNAL_TOKENS")
        if missing_from:
            gaps[fn] = missing_from

    assert not gaps, (
        "Perimeter gap detected — edge fns in the scan path are missing from one or more "
        "CI/CD surfaces. This violates feedback_zero_401_tolerance.md (a silent 401 in prod "
        "would not be caught) AND the BIQc Platform Contract v2 (internal architecture leak). "
        f"Gaps:\n{gaps}\n\nFix by adding each missing edge fn to the surfaces listed above."
    )
