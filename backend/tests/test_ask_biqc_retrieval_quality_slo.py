"""
Block 4 — Ask BIQc retrieval / answer-quality SLO.

- Static checks driven by scripts/ask_biqc_retrieval_slo_spec.json (same as gate script).
- Lightweight runtime evaluation of _build_retrieval_contract (no HTTP).
"""

from __future__ import annotations

import functools
import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = REPO_ROOT / "scripts" / "ask_biqc_retrieval_slo_spec.json"
GATE_SCRIPT = REPO_ROOT / "scripts" / "block4_ask_biqc_retrieval_quality_gate.py"


@functools.lru_cache(maxsize=1)
def _soundboard_import_ok() -> bool:
    """True only when full backend deps allow importing soundboard (transitive imports)."""
    try:
        from routes.soundboard import _build_retrieval_contract  # noqa: F401
        return True
    except Exception:
        return False


backend_runtime = pytest.mark.skipif(
    not _soundboard_import_ok(),
    reason="cannot import routes.soundboard — install backend/requirements.txt for eval tests",
)


def _load_spec() -> dict:
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


def test_spec_file_exists():
    assert SPEC_PATH.is_file(), f"Missing spec at {SPEC_PATH}"


def test_static_spec_contract_keys_in_soundboard():
    spec = _load_spec()
    sound_src = (REPO_ROOT / "backend" / "routes" / "soundboard.py").read_text(encoding="utf-8")
    start = sound_src.find("def _build_retrieval_contract(")
    assert start >= 0
    end = sound_src.find("\ndef _build_report_grounding_block", start)
    assert end > start
    chunk = sound_src[start:end]
    for key in spec["retrieval_contract_keys"]:
        assert f'"{key}"' in chunk, f"retrieval_contract missing key {key!r}"


@backend_runtime
def test_answer_grade_matrix_matches_product_rules():
    from routes.soundboard import _build_retrieval_contract

    base_kw = dict(
        report_grade_request=False,
        grounded_report_ready=False,
        has_connected_sources=False,
        live_signal_count=0,
        coverage_window={"coverage_start": None, "coverage_end": None, "missing_periods": []},
        retrieval_depth={"crm_pages_fetched": 0, "accounting_pages_fetched": 0, "history_truncated": False},
        materialization_state={"attempted": False, "signals_emitted": 0},
    )

    assert _build_retrieval_contract(guardrail_status="BLOCKED", **base_kw)["answer_grade"] == "BLOCKED"
    assert _build_retrieval_contract(guardrail_status="DEGRADED", **base_kw)["answer_grade"] == "DEGRADED"

    partial_kw = {
        **base_kw,
        "guardrail_status": "FULL",
        "coverage_window": {
            "coverage_start": "2024-01-01T00:00:00+00:00",
            "coverage_end": "2025-01-01T00:00:00+00:00",
            "missing_periods": ["gap"],
        },
    }
    assert _build_retrieval_contract(**partial_kw)["answer_grade"] == "PARTIAL"

    full_kw = {
        **base_kw,
        "guardrail_status": "FULL",
        "coverage_window": {
            "coverage_start": "2024-01-01T00:00:00+00:00",
            "coverage_end": "2025-01-01T00:00:00+00:00",
            "missing_periods": [],
        },
    }
    assert _build_retrieval_contract(**full_kw)["answer_grade"] == "FULL"


@backend_runtime
def test_retrieval_mode_report_grade_and_signals():
    from routes.soundboard import _build_retrieval_contract

    common = dict(
        guardrail_status="FULL",
        has_connected_sources=True,
        live_signal_count=3,
        coverage_window={"coverage_start": "a", "coverage_end": "b", "missing_periods": []},
        retrieval_depth={"crm_pages_fetched": 1, "accounting_pages_fetched": 0, "history_truncated": False},
        materialization_state={"attempted": True, "signals_emitted": 2},
    )

    c1 = _build_retrieval_contract(
        report_grade_request=True,
        grounded_report_ready=True,
        **common,
    )
    assert c1["retrieval_mode"] == "report_grounded_materialized"

    c2 = _build_retrieval_contract(
        report_grade_request=True,
        grounded_report_ready=False,
        **common,
    )
    assert c2["retrieval_mode"] == "report_grounding_blocked"

    c3 = _build_retrieval_contract(
        report_grade_request=False,
        grounded_report_ready=False,
        **common,
    )
    assert c3["retrieval_mode"] == "materialized_signals"

    c4 = _build_retrieval_contract(
        report_grade_request=False,
        grounded_report_ready=False,
        live_signal_count=0,
        has_connected_sources=True,
        **{k: v for k, v in common.items() if k not in ("live_signal_count", "has_connected_sources")},
    )
    assert c4["retrieval_mode"] == "connector_connected_signal_thin"

    c5 = _build_retrieval_contract(
        report_grade_request=False,
        grounded_report_ready=False,
        live_signal_count=0,
        has_connected_sources=False,
        **{k: v for k, v in common.items() if k not in ("live_signal_count", "has_connected_sources")},
    )
    assert c5["retrieval_mode"] == "profile_only"


@backend_runtime
def test_depth_fields_pass_through_contract():
    from routes.soundboard import _build_retrieval_contract

    depth = {
        "crm_pages_fetched": 4,
        "accounting_pages_fetched": 7,
        "history_truncated": True,
        "crm": {"pages_fetched": 4, "rows_loaded": 42, "window_start": "2025-01-01", "window_end": "2025-12-31"},
        "accounting": {"pages_fetched": 7, "rows_loaded": 55, "window_start": "2025-01-01", "window_end": "2025-12-31"},
        "email": {"pages_fetched": 1, "rows_loaded": 10, "window_start": "2025-08-01", "window_end": "2025-09-01"},
        "calendar": {"pages_fetched": 1, "rows_loaded": 5, "window_start": "2025-08-01", "window_end": "2025-09-01"},
        "custom": {"pages_fetched": 1, "rows_loaded": 3, "window_start": "2025-08-01", "window_end": "2025-09-01"},
    }
    c = _build_retrieval_contract(
        report_grade_request=False,
        grounded_report_ready=False,
        guardrail_status="FULL",
        has_connected_sources=True,
        live_signal_count=1,
        coverage_window={"missing_periods": []},
        retrieval_depth=depth,
        materialization_state={"attempted": True, "signals_emitted": 5},
        intent_action="compare",
        wants_integration_analytics=True,
        data_freshness="45m",
        workspace_tier="starter",
        coverage_pct=72,
        live_signal_age_hours=0.4,
        latency_ms_actual=2200,
    )
    assert c["crm_pages_fetched"] == 4
    assert c["accounting_pages_fetched"] == 7
    assert c["history_truncated"] is True
    assert c["materialization_attempted"] is True
    assert c["signals_emitted_on_demand"] == 5
    assert c["canonical_retrieval_mode"] == "hybrid_compare"
    assert c["retrieval_plane"]["execution_path"] == "hybrid_compare_cross_connector"
    assert "crm" in c["sources_used"]
    assert c["searched_windows"]["crm"]["start"] == "2025-01-01"
    assert c["semantic_signal_layer"]["version"] == "semantic_signal_layer_v2"
    assert c["quality_eval"]["latency_slo_ms_target"] > 0
    assert c["quality_eval"]["latency_slo_breached"] is False
    assert c["pricing_packaging"]["required_tier"] in {"starter", "pro", "enterprise", "free"}


@pytest.mark.skipif(not GATE_SCRIPT.is_file(), reason="gate script missing")
def test_block4_gate_script_exits_zero():
    r = subprocess.run(
        [sys.executable, str(GATE_SCRIPT), "--no-report", "--quiet-json"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert r.returncode == 0, r.stderr or r.stdout
    assert "ASK_BIQC_RETRIEVAL_SLO_GATE: PASS" in r.stdout
