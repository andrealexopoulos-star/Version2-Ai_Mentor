"""
test_cmo_section_evidence — E6 / fix/p0-marjo-e6-cmo-section-evidence.

Covers:
    1. SectionEvidence schema + state validation
    2. Placeholder denylist (exact + Marketing-101 phrase patterns)
    3. SWOT + Roadmap provenance enforcement (PR #449 failure mode)
    4. Reason-string external-safety guard (Contract v2 — no supplier names)
    5. CMO endpoint integration: response.sections covers all 32 ids,
       every section is a valid SectionEvidence, no placeholder text
       leaks into rendered evidence.
"""

from __future__ import annotations

import asyncio
import importlib
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Pure-module tests (no FastAPI / Supabase setup needed) ──────────────

from core.section_evidence import (  # noqa: E402
    SECTION_IDS,
    OPTIONAL_SECTION_IDS,
    PLACEHOLDER_EXACT_DENYLIST,
    PLACEHOLDER_PHRASE_PATTERNS,
    PlaceholderViolation,
    ReasonLeakViolation,
    SectionEvidence,
    assert_no_placeholders,
    assert_reason_is_external_safe,
    filter_roadmap_items_with_provenance,
    filter_swot_items_with_provenance,
    is_placeholder_string,
    make_section,
    reason_for,
    section_state_for_value,
    validate_section_evidence,
)
from core.response_sanitizer import ExternalState, scrub_response_for_external  # noqa: E402


# ── 1. Schema + state validation ──

def test_section_ids_count_matches_audit_contract():
    """The audit contract enumerates 32 sections — header through abn."""
    assert len(SECTION_IDS) == 32
    assert "header" in SECTION_IDS
    assert "swot_strengths" in SECTION_IDS
    assert "ninety_day_strategic_goals" in SECTION_IDS
    assert OPTIONAL_SECTION_IDS.issubset(set(SECTION_IDS))


def test_make_section_data_available_requires_evidence():
    with pytest.raises(ValueError, match="DATA_AVAILABLE but evidence is None"):
        make_section("swot_strengths", state=ExternalState.DATA_AVAILABLE.value, evidence=None)


def test_make_section_rejects_invalid_state():
    with pytest.raises(ValueError, match="invalid state"):
        make_section("swot_strengths", state="HALLUCINATED_STATE")


def test_make_section_insufficient_signal_autofills_canonical_reason():
    sec = make_section("customer_sentiment", state=ExternalState.INSUFFICIENT_SIGNAL.value)
    assert sec["state"] == "INSUFFICIENT_SIGNAL"
    assert sec["reason"]
    # Customer-facing copy from REASON_INSUFFICIENT_SIGNAL — checks the right
    # section copy was selected.
    assert "review data" in sec["reason"].lower() or "sentiment" in sec["reason"].lower()


def test_validate_section_evidence_catches_missing_keys():
    with pytest.raises(ValueError, match="missing key: evidence"):
        validate_section_evidence(
            {"state": "DATA_AVAILABLE", "reason": None, "source_trace_ids": []}
        )
    with pytest.raises(ValueError, match="source_trace_ids must be a list"):
        validate_section_evidence(
            {"state": "DATA_AVAILABLE", "evidence": {"x": 1}, "reason": None, "source_trace_ids": "no"}
        )


def test_section_state_for_value_heuristic():
    assert section_state_for_value(None) == "INSUFFICIENT_SIGNAL"
    assert section_state_for_value("") == "INSUFFICIENT_SIGNAL"
    assert section_state_for_value([]) == "INSUFFICIENT_SIGNAL"
    assert section_state_for_value({}) == "INSUFFICIENT_SIGNAL"
    assert section_state_for_value(0) == "INSUFFICIENT_SIGNAL"
    assert section_state_for_value("real-data") == "DATA_AVAILABLE"
    assert section_state_for_value([1, 2]) == "DATA_AVAILABLE"
    assert section_state_for_value({"a": 1}) == "DATA_AVAILABLE"
    assert section_state_for_value(42) == "DATA_AVAILABLE"
    assert section_state_for_value(None, is_processing=True) == "PROCESSING"
    assert section_state_for_value(None, has_upstream_failure=True) == "DATA_UNAVAILABLE"


# ── 2. Placeholder denylist ──

def test_placeholder_denylist_exact_strings():
    for placeholder in PLACEHOLDER_EXACT_DENYLIST:
        assert is_placeholder_string(placeholder), f"missed: {placeholder!r}"
        assert is_placeholder_string(placeholder + ".")
        assert is_placeholder_string("  " + placeholder + "  ")


def test_placeholder_denylist_marketing_101_phrases():
    """The exact PR #449 SWOT failure mode."""
    fail_phrases = [
        "Improve your social media presence",
        "Increase brand awareness through targeted campaigns",
        "Create a content calendar for Q3",
        "Leverage your social media channels",
        "Engage with your customers more often",
        "Build an email list of qualified prospects",
        "Expand market presence in the eastern states",
        "Optimize SEO for AU search terms",
        "Optimise your SEO for the AU market",
        "Focus on customer service excellence",
        "Differentiate from competitors in your category",
    ]
    for phrase in fail_phrases:
        assert is_placeholder_string(phrase), f"denylist missed: {phrase!r}"


def test_evidence_backed_text_passes_denylist():
    """Real evidence-backed copy must NOT trip the denylist."""
    ok = [
        "Direct competitor 'ACME Roofing' shows 4.7-star Google profile vs your unrated profile.",
        "Your domain authority of 28 lags Joe's Plumbing (DA 41) and Roofing Co (DA 38).",
        "Customer complaints concentrated on slow callback times (62% of negative reviews).",
        "Local pack ranking #4 for 'plumbers near me' in Brisbane CBD.",
    ]
    for text in ok:
        assert not is_placeholder_string(text), f"false-positive on evidence-backed text: {text!r}"


def test_assert_no_placeholders_walks_nested_structures():
    payload = {
        "items": [
            {"text": "Real evidence-backed item"},
            {"text": "Improve your social media presence"},  # should trip
        ],
    }
    with pytest.raises(PlaceholderViolation):
        assert_no_placeholders(payload, section_id="swot_strengths")


def test_assert_no_placeholders_allows_clean_payload():
    payload = {"items": [{"text": "Brisbane CBD local pack rank #4 for primary keyword."}]}
    assert_no_placeholders(payload, section_id="swot_strengths")


# ── 3. SWOT + Roadmap provenance enforcement ──

def test_swot_filter_drops_items_without_provenance():
    """An item with NO source_trace_id, NO competitor mention, NO evidence_tag
    is dropped — that was PR #449's failure mode."""
    items = [
        "Generic SWOT item with no provenance",
        {"text": "Another generic", "trace_ids": []},
    ]
    kept = filter_swot_items_with_provenance(
        items, available_trace_ids=["trace-1"], available_competitor_names=["ACME"],
    )
    assert kept == []


def test_swot_filter_keeps_items_with_provenance():
    items = [
        {"text": "Strong domain authority vs ACME", "trace_ids": ["trace-1"]},
        {"text": "Beats ACME on review velocity", "evidence_tag": "review_velocity_v1"},
    ]
    kept = filter_swot_items_with_provenance(
        items, available_trace_ids=["trace-1"], available_competitor_names=["ACME"],
    )
    assert len(kept) == 2
    assert kept[0]["source_trace_ids"] == ["trace-1"]


def test_swot_filter_keeps_items_via_competitor_mention():
    """An item with no trace id but mentioning a real competitor by name
    is kept — the competitor is the provenance pointer."""
    kept = filter_swot_items_with_provenance(
        ["Trailing acme on local pack ranking"],
        available_competitor_names=["ACME"],
    )
    assert len(kept) == 1


def test_swot_filter_drops_marketing_101_even_with_provenance():
    """Marketing-101 phrases are an AUTOMATIC FAIL even if the supplier
    attached a trace id."""
    items = [
        {"text": "Improve your social media presence", "trace_ids": ["trace-1"]},
    ]
    kept = filter_swot_items_with_provenance(
        items, available_trace_ids=["trace-1"],
    )
    assert kept == []


def test_roadmap_filter_requires_provenance():
    items = [
        "Generic action with no provenance",
        {"text": "Action against ACME", "evidence_tag": "competitor_pressure"},
    ]
    kept = filter_roadmap_items_with_provenance(
        items, available_competitor_names=["ACME"],
    )
    assert len(kept) == 1
    assert "ACME" in kept[0]["text"]


def test_roadmap_filter_keeps_metric_referenced_items():
    items = [
        {"text": "Boost brand strength score from 28 → 50 via local PR push.",
         "trace_ids": ["m-1"], "priority": "high"},
    ]
    kept = filter_roadmap_items_with_provenance(
        items,
        available_trace_ids=["m-1"],
        available_brand_metric_names=["brand strength"],
    )
    assert len(kept) == 1
    assert kept[0]["priority"] == "high"


# ── 4. Reason-string external-safety guard (Contract v2) ──

def test_reason_leak_violation_on_supplier_names():
    for leak in (
        "browse-ai-reviews returned 0 reviews",
        "SEMRUSH_API_KEY_MISSING",
        "openai rate-limited",
        "HTTP 401 from supplier",
        "service_role rejected",
    ):
        with pytest.raises(ReasonLeakViolation):
            assert_reason_is_external_safe(leak, section_id="x")


def test_reason_external_safe_passes_canonical_copy():
    for ok in (
        "Insufficient market signal to assess SEO strength.",
        "We couldn't gather enough public review data for this business.",
        "Competitive landscape could not be reliably determined.",
    ):
        assert_reason_is_external_safe(ok, section_id="x")


def test_make_section_blocks_leaky_reason():
    with pytest.raises(ReasonLeakViolation):
        make_section(
            "executive_summary",
            state=ExternalState.INSUFFICIENT_SIGNAL.value,
            reason="HTTP 401 from semrush",
        )


def test_reason_for_returns_canonical_copy_per_section():
    r = reason_for("customer_sentiment", ExternalState.INSUFFICIENT_SIGNAL.value)
    assert r and "review" in r.lower()
    r2 = reason_for("swot_strengths", ExternalState.INSUFFICIENT_SIGNAL.value)
    assert "evidence" in r2.lower()
    r3 = reason_for("anything", ExternalState.PROCESSING.value)
    assert "processing" in r3.lower()


# ── 5. CMO endpoint integration: response.sections shape + denylist ──
#
# We stub the Supabase client + auth to avoid hitting any external services,
# then call get_cmo_report directly. Two cases:
#   (a) no enrichment row → empty/PROCESSING shell
#   (b) enrichment present with junk SWOT + Roadmap items → flips affected
#       sections to INSUFFICIENT_SIGNAL via the denylist + provenance guards.

def _install_intel_stubs(monkeypatch, *, enrichment_rows):
    """Install supabase_client + auth + calibration stubs and return the loaded module."""
    auth_stub = types.ModuleType("routes.auth")
    auth_stub.get_current_user = lambda: {"id": "user-1"}
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    spine_stub = types.ModuleType("intelligence_spine")
    spine_stub.emit_spine_event = lambda *a, **kw: None
    monkeypatch.setitem(sys.modules, "intelligence_spine", spine_stub)

    # Stub routes.calibration to avoid pulling in redis + scan_cache at
    # import time. We only need _is_noisy_competitor + the scrub helpers
    # for the CMO endpoint's render-time filters.
    calibration_stub = types.ModuleType("routes.calibration")

    _NOISY_COMPETITOR_SUBSTRINGS = (
        "facebook", "instagram", "youtube", "linkedin", "twitter",
        "tiktok", "wikipedia", "yelp",
    )

    def _is_noisy_competitor(name):
        if not isinstance(name, str):
            return True
        n = name.lower().strip()
        if not n:
            return True
        return any(s in n for s in _NOISY_COMPETITOR_SUBSTRINGS)

    def _scrub_sentinel(text):
        if not isinstance(text, str):
            return ""
        t = text.strip()
        # Mirror the production scrubber's most common sentinel patterns.
        for pat in ("no data available yet", "tbd", "lorem ipsum"):
            if pat in t.lower():
                return ""
        return t

    def _filter_meta_gap_list(items):
        return [it for it in (items or []) if isinstance(it, str) and it.strip()]

    def _filter_competitor_candidates(rows):
        return [r for r in (rows or []) if not _is_noisy_competitor((r or {}).get("name") if isinstance(r, dict) else r)]

    calibration_stub._is_noisy_competitor = _is_noisy_competitor
    calibration_stub._scrub_sentinel = _scrub_sentinel
    calibration_stub._filter_meta_gap_list = _filter_meta_gap_list
    calibration_stub._filter_competitor_candidates = _filter_competitor_candidates
    monkeypatch.setitem(sys.modules, "routes.calibration", calibration_stub)

    class _Result:
        def __init__(self, data):
            self.data = data

    class _Query:
        def __init__(self, table):
            self._table = table

        def select(self, *_a, **_kw):
            return self
        def eq(self, *_a, **_kw):
            return self
        def order(self, *_a, **_kw):
            return self
        def limit(self, *_a, **_kw):
            return self
        def maybe_single(self):
            return self
        def execute(self):
            if self._table == "business_dna_enrichment":
                return _Result(enrichment_rows)
            if self._table == "business_profiles":
                return _Result([{"business_name": "Stub Plumbing"}])
            return _Result([])

    class _SB:
        def table(self, name):
            return _Query(name)

    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: _SB()
    sb_stub.get_supabase_client = lambda: _SB()
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    # Force re-import so the stubs take effect. Note: routes.calibration
    # is the calibration_stub installed above; we keep that one in sys.modules.
    sys.modules.pop("routes.intelligence_modules", None)
    return importlib.import_module("routes.intelligence_modules")


def test_cmo_endpoint_returns_sections_with_processing_state_when_no_enrichment(monkeypatch):
    intel_mod = _install_intel_stubs(monkeypatch, enrichment_rows=None)
    response = asyncio.run(intel_mod.get_cmo_report({"id": "user-1"}))
    assert "sections" in response
    sections = response["sections"]
    assert isinstance(sections, dict)
    # All required sections present
    for sid in SECTION_IDS:
        assert sid in sections, f"missing section: {sid}"
        validate_section_evidence(sections[sid], section_id=sid)
    # Major narrative + SWOT sections must be PROCESSING in the empty shell
    assert sections["chief_marketing_summary"]["state"] == "PROCESSING"
    assert sections["swot_strengths"]["state"] in {"PROCESSING", "INSUFFICIENT_SIGNAL"}


def test_cmo_endpoint_drops_marketing_101_swot_items_to_insufficient_signal(monkeypatch):
    """With junk SWOT items (no provenance + Marketing-101 text), the
    SWOT buckets must flip to INSUFFICIENT_SIGNAL — not render the junk."""
    enrichment_rows = {
        "enrichment": {
            "business_name": "Stub Plumbing",
            "website_url": "https://stub.example.com",
            "swot": {
                "strengths": [
                    "Improve your social media presence",   # denylist
                    "Strong",                               # exact deny
                    "Generic strength with no provenance",  # provenance fail
                ],
                "weaknesses": ["TBD"],
                "opportunities": ["Increase brand awareness across regions"],
                "threats": ["Various"],
            },
            "cmo_priority_actions": [
                "Improve your social media presence",       # denylist
                "Build an email list",                      # denylist
            ],
            "industry_action_items": [
                "Generic action with no provenance",
            ],
        },
        "digital_footprint": {},
        "created_at": "2026-05-04T12:00:00Z",
        "updated_at": "2026-05-04T12:00:00Z",
    }
    intel_mod = _install_intel_stubs(monkeypatch, enrichment_rows=enrichment_rows)
    response = asyncio.run(intel_mod.get_cmo_report({"id": "user-1"}))
    sections = response["sections"]
    # All four SWOT buckets flipped to INSUFFICIENT_SIGNAL
    for bucket in ("swot_strengths", "swot_weaknesses", "swot_opportunities", "swot_threats"):
        assert sections[bucket]["state"] == "INSUFFICIENT_SIGNAL", (
            f"bucket {bucket} should be INSUFFICIENT_SIGNAL but is {sections[bucket]['state']}"
        )
        assert sections[bucket]["evidence"] is None
        # Reason must be present + customer-safe
        assert sections[bucket]["reason"]
        assert_reason_is_external_safe(sections[bucket]["reason"], section_id=bucket)
    # All three roadmap horizons flipped to INSUFFICIENT_SIGNAL
    for h in ("seven_day_quick_wins", "thirty_day_priorities", "ninety_day_strategic_goals"):
        assert sections[h]["state"] == "INSUFFICIENT_SIGNAL"


def test_cmo_endpoint_response_contains_no_placeholder_text(monkeypatch):
    """End-to-end: no rendered evidence anywhere in response.sections may
    match the placeholder denylist."""
    enrichment_rows = {
        "enrichment": {
            "business_name": "Stub Plumbing",
            "website_url": "https://stub.example.com",
            "swot": {
                "strengths": ["Improve your social media presence", "TBD"],
                "weaknesses": ["Various"],
                "opportunities": [],
                "threats": [],
            },
        },
        "digital_footprint": {},
        "created_at": "2026-05-04T12:00:00Z",
        "updated_at": "2026-05-04T12:00:00Z",
    }
    intel_mod = _install_intel_stubs(monkeypatch, enrichment_rows=enrichment_rows)
    response = asyncio.run(intel_mod.get_cmo_report({"id": "user-1"}))
    sections = response["sections"]

    def walk(node, path):
        if isinstance(node, str):
            assert not is_placeholder_string(node), f"placeholder leaked at {path}: {node!r}"
            return
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{path}.{k}")
            return
        if isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]")
            return

    for sid, payload in sections.items():
        # We only check `evidence` (rendered content) — `reason` strings are
        # canonical customer-facing copy and are allowed to use the words
        # "insufficient", "evidence", etc. that aren't in the denylist anyway.
        if payload.get("evidence") is not None:
            walk(payload["evidence"], f"sections.{sid}.evidence")


def test_cmo_endpoint_every_section_validates_against_schema(monkeypatch):
    """Schema integrity check across all 32 sections in both the empty +
    rich-enrichment paths."""
    intel_mod = _install_intel_stubs(monkeypatch, enrichment_rows=None)
    response_empty = asyncio.run(intel_mod.get_cmo_report({"id": "user-1"}))
    for sid in SECTION_IDS:
        validate_section_evidence(response_empty["sections"][sid], section_id=sid)

    enrichment_rows = {
        "enrichment": {
            "business_name": "Stub Plumbing",
            "website_url": "https://stub.example.com",
            "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
        },
        "digital_footprint": {},
        "created_at": "2026-05-04T12:00:00Z",
        "updated_at": "2026-05-04T12:00:00Z",
    }
    intel_mod2 = _install_intel_stubs(monkeypatch, enrichment_rows=enrichment_rows)
    response_rich = asyncio.run(intel_mod2.get_cmo_report({"id": "user-1"}))
    for sid in SECTION_IDS:
        validate_section_evidence(response_rich["sections"][sid], section_id=sid)


# ── 6. F7 P1 regression tests (R6 findings on E6) ──────────────────────────
#
# Both regressions cover silent-failure paths the E6 contract was meant to
# close but quietly bypassed.


def test_f7_p1_1_scan_source_evidence_survives_external_sanitizer():
    """R6 P1-1: scan_source emits evidence={'name': ...} (NOT 'source').

    The key 'source' is on response_sanitizer._INTERNAL_KEYS denylist
    (it identifies supplier provenance). If scan_source uses 'source' as
    its evidence key, scrub_response_for_external strips the value and
    leaves evidence={} — silently degrading DATA_AVAILABLE → effectively
    empty. Renaming to 'name' preserves the value through the sanitiser.
    """
    sec = make_section(
        "scan_source",
        state=ExternalState.DATA_AVAILABLE.value,
        evidence={"name": "calibration-business-dna-scan"},
    )
    # Wrap in a typical response shape so the sanitizer walks through it
    # exactly as it would for the real CMO endpoint payload.
    response = {"sections": {"scan_source": sec}}
    scrubbed = scrub_response_for_external(response)
    scrubbed_evidence = scrubbed["sections"]["scan_source"]["evidence"]
    # Evidence must be preserved as a non-empty dict containing 'name'.
    assert scrubbed_evidence is not None, "scan_source evidence dropped by sanitizer"
    assert scrubbed_evidence != {}, (
        "scan_source evidence emptied by sanitizer — likely using 'source' key collision"
    )
    assert "name" in scrubbed_evidence, (
        f"expected 'name' in scan_source evidence, got {scrubbed_evidence!r}"
    )
    assert scrubbed_evidence["name"] == "calibration-business-dna-scan"
    # And confirm the now-banned 'source' key is NOT present (defence in depth).
    assert "source" not in scrubbed_evidence


def test_f7_p1_1_legacy_source_key_would_be_stripped():
    """Documents WHY the rename was needed: the legacy 'source' key gets
    stripped by scrub_response_for_external because it sits on the internal-
    keys denylist (used by suppliers like SEMrush/Perplexity field tags).
    If a future change re-introduces evidence={'source': ...} for scan_source,
    this test fires the alarm.
    """
    legacy_response = {
        "sections": {
            "scan_source": {
                "state": "DATA_AVAILABLE",
                "evidence": {"source": "some-scan-source-name"},
                "reason": None,
                "source_trace_ids": [],
            }
        }
    }
    scrubbed = scrub_response_for_external(legacy_response)
    # The 'source' key must be gone (it's on the denylist) — that's exactly
    # the silent-degradation bug we're guarding against.
    assert "source" not in scrubbed["sections"]["scan_source"]["evidence"]
    assert scrubbed["sections"]["scan_source"]["evidence"] == {}, (
        "the legacy key 'source' should be stripped, leaving an empty evidence dict"
    )


def test_f7_p1_2_swot_drops_items_with_fabricated_traces():
    """R6 P1-2: SWOT items with item_traces that DON'T intersect the
    available trace_set must be dropped — even though item_traces is
    non-empty. The previous `or bool(item_traces)` clause silently let
    fabricated trace ids through; that's the exact silent-failure class
    the function was designed to prevent.
    """
    items = [
        {"text": "We dominate organic SEO based on supplier estimates",
         "trace_ids": ["trace-fabricated-1", "trace-fabricated-2"]},
    ]
    kept = filter_swot_items_with_provenance(
        items,
        available_trace_ids=["trace-a", "trace-b"],
        available_competitor_names=[],
    )
    assert kept == [], (
        f"expected items with fabricated trace ids to be DROPPED, got {kept!r}"
    )


def test_f7_p1_2_swot_keeps_items_with_one_real_trace():
    """An item with a mix of real + fabricated trace ids passes the check
    (at least one real trace is enough — provenance, not purity)."""
    items = [
        {"text": "Local pack rank #4 vs ACME at #2 in Brisbane CBD",
         "trace_ids": ["trace-a", "trace-fabricated-1"]},
    ]
    kept = filter_swot_items_with_provenance(
        items,
        available_trace_ids=["trace-a", "trace-b"],
        available_competitor_names=[],
    )
    assert len(kept) == 1
    # Both trace ids preserved on the item; the filter doesn't strip
    # individual trace ids, only the whole item if no real one is present.
    assert kept[0]["text"].startswith("Local pack rank")
    assert "trace-a" in kept[0]["source_trace_ids"]


def test_f7_p1_2_swot_empty_bucket_flips_to_insufficient_signal():
    """End-to-end: when every SWOT item in a bucket fails provenance
    (all fabricated), the bucket emits an empty list and the caller
    flips it to INSUFFICIENT_SIGNAL — NOT DATA_AVAILABLE-with-junk.
    """
    items = [
        {"text": "Generic SWOT line 1",
         "trace_ids": ["trace-fabricated-x"]},
        {"text": "Generic SWOT line 2",
         "trace_ids": ["trace-fabricated-y", "trace-fabricated-z"]},
    ]
    kept = filter_swot_items_with_provenance(
        items,
        available_trace_ids=["trace-real-a", "trace-real-b"],
        available_competitor_names=[],
    )
    assert kept == []
    # The caller in routes/intelligence_modules.py uses this empty list
    # as the trigger to emit the bucket as INSUFFICIENT_SIGNAL — which the
    # other CMO-endpoint integration tests already cover. This test just
    # confirms the upstream filter returns the empty list cleanly.
    sec = make_section(
        "swot_strengths",
        state=(
            ExternalState.DATA_AVAILABLE.value if kept
            else ExternalState.INSUFFICIENT_SIGNAL.value
        ),
        evidence={"items": kept} if kept else None,
    )
    assert sec["state"] == ExternalState.INSUFFICIENT_SIGNAL.value
    assert sec["evidence"] is None


def test_f7_p1_2_roadmap_drops_items_with_fabricated_traces():
    """Same provenance-bypass fix on the roadmap filter."""
    items = [
        {"text": "Run an aggressive SEO blitz over the next 30 days.",
         "trace_ids": ["trace-fabricated-a"], "priority": "high"},
    ]
    kept = filter_roadmap_items_with_provenance(
        items,
        available_trace_ids=["trace-real-1"],
        available_competitor_names=[],
        available_brand_metric_names=[],
    )
    assert kept == [], (
        f"expected fabricated-trace roadmap items to be dropped, got {kept!r}"
    )


def test_f7_p1_2_roadmap_keeps_items_with_one_real_trace():
    items = [
        {"text": "Beat ACME on review velocity (target: 3 verified reviews / month).",
         "trace_ids": ["trace-real-1", "trace-fabricated-x"], "priority": "medium"},
    ]
    kept = filter_roadmap_items_with_provenance(
        items,
        available_trace_ids=["trace-real-1"],
        available_competitor_names=[],
        available_brand_metric_names=[],
    )
    assert len(kept) == 1
    assert kept[0]["priority"] == "medium"
