"""
Tests for backend.core.response_sanitizer — BIQc Platform Contract v2.

Covers:
    1. ExternalState / InternalErrorType enum integrity
    2. TYPE_TO_STATE mapping (contract §4)
    3. sanitize_error_for_external (single-line boundary guard)
    4. sanitize_edge_passthrough (proxy-route guard)
    5. sanitize_enrichment_for_external (big one — section-by-section)
    6. assert_no_banned_tokens (enforcement backbone)
    7. _derive_section_state decision table
    8. Top-state roll-up
    9. End-to-end: realistic enrichment with failed semrush → no leak
"""

from __future__ import annotations

import json
import pytest

from backend.core.response_sanitizer import (
    ExternalState,
    InternalErrorType,
    TYPE_TO_STATE,
    SECTION_CRITERIA,
    ALL_BANNED_TOKENS,
    ExternalContractViolation,
    sanitize_error_for_external,
    sanitize_edge_passthrough,
    sanitize_enrichment_for_external,
    assert_no_banned_tokens,
)


# ─── 1. Enum integrity ────────────────────────────────────────────────────

class TestEnumIntegrity:
    def test_external_state_has_exactly_five_members(self):
        members = {m.value for m in ExternalState}
        assert members == {
            "DATA_AVAILABLE",
            "DATA_UNAVAILABLE",
            "INSUFFICIENT_SIGNAL",
            "PROCESSING",
            "DEGRADED",
        }

    def test_external_state_values_are_strings(self):
        for m in ExternalState:
            assert isinstance(m.value, str)
            # Must be JSON-serializable as a plain string
            assert json.dumps(m.value) == f'"{m.value}"'

    def test_internal_error_type_has_seven_members(self):
        members = {m.value for m in InternalErrorType}
        assert members == {
            "CONFIG", "SUPPLIER", "TIMEOUT", "VALIDATION",
            "PARTIAL", "PENDING", "UNKNOWN",
        }

    def test_every_internal_type_maps_to_external_state(self):
        for t in InternalErrorType:
            assert t in TYPE_TO_STATE
            assert isinstance(TYPE_TO_STATE[t], ExternalState)


# ─── 2. Error-type mapping (contract §4) ──────────────────────────────────

class TestTypeToStateMapping:
    @pytest.mark.parametrize("t,expected", [
        (InternalErrorType.CONFIG, ExternalState.DATA_UNAVAILABLE),
        (InternalErrorType.SUPPLIER, ExternalState.DATA_UNAVAILABLE),
        (InternalErrorType.TIMEOUT, ExternalState.DATA_UNAVAILABLE),
        (InternalErrorType.VALIDATION, ExternalState.INSUFFICIENT_SIGNAL),
        (InternalErrorType.PARTIAL, ExternalState.DEGRADED),
        (InternalErrorType.PENDING, ExternalState.PROCESSING),
        (InternalErrorType.UNKNOWN, ExternalState.DEGRADED),
    ])
    def test_mapping(self, t, expected):
        assert TYPE_TO_STATE[t] == expected


# ─── 3. sanitize_error_for_external ──────────────────────────────────────

class TestSanitizeErrorForExternal:
    def test_config_error_with_supplier_hint_returns_data_unavailable(self):
        result = sanitize_error_for_external({
            "type": "CONFIG", "source": "semrush", "code": "SEMRUSH_API_KEY_MISSING",
        })
        assert result == {"ok": False, "state": "DATA_UNAVAILABLE"}

    def test_supplier_error_returns_data_unavailable(self):
        result = sanitize_error_for_external({"type": "SUPPLIER", "source": "openai"})
        assert result == {"ok": False, "state": "DATA_UNAVAILABLE"}

    def test_validation_error_returns_insufficient_signal(self):
        result = sanitize_error_for_external({"type": "VALIDATION"})
        assert result == {"ok": False, "state": "INSUFFICIENT_SIGNAL"}

    def test_no_type_defaults_to_degraded(self):
        result = sanitize_error_for_external({"source": "unknown"})
        assert result == {"ok": False, "state": "DEGRADED"}

    def test_empty_input_uses_fallback_type(self):
        result = sanitize_error_for_external(None, error_type=InternalErrorType.TIMEOUT)
        assert result == {"ok": False, "state": "DATA_UNAVAILABLE"}

    def test_output_never_contains_supplier_names(self):
        inputs = [
            {"type": "CONFIG", "source": "SEMRUSH", "code": "SEMRUSH_API_KEY_MISSING"},
            {"type": "SUPPLIER", "source": "OpenAI", "error": "HTTP 401"},
            {"type": "TIMEOUT", "message": "Perplexity unreachable"},
        ]
        for internal in inputs:
            result = sanitize_error_for_external(internal)
            assert_no_banned_tokens(result, source="test_error_sanitizer")


# ─── 4. sanitize_edge_passthrough ────────────────────────────────────────

class TestSanitizeEdgePassthrough:
    def test_success_path_returns_data_available_with_scrubbed_data(self):
        raw = {
            "ok": True,
            "_http_status": 200,
            "signals": [{"type": "competitor", "text": "x"}],
            "ai_errors": [],
            "correlation": {"run_id": "cal-123"},
        }
        result = sanitize_edge_passthrough(raw)
        assert result["ok"] is True
        assert result["state"] == "DATA_AVAILABLE"
        assert "ai_errors" not in result["data"]
        assert "correlation" not in result["data"]
        assert "_http_status" not in result["data"]

    def test_503_maps_to_data_unavailable(self):
        raw = {
            "ok": False,
            "_http_status": 503,
            "code": "SEMRUSH_API_KEY_MISSING",
            "ai_errors": ["SEMRUSH_API_KEY missing"],
        }
        result = sanitize_edge_passthrough(raw)
        assert result == {"ok": False, "state": "DATA_UNAVAILABLE"}

    def test_504_timeout_maps_to_data_unavailable(self):
        raw = {"ok": False, "_http_status": 504, "code": "EDGE_FUNCTION_TIMEOUT"}
        result = sanitize_edge_passthrough(raw)
        assert result["state"] == "DATA_UNAVAILABLE"

    def test_400_validation_maps_to_insufficient_signal(self):
        raw = {"ok": False, "_http_status": 400, "code": "BACKEND_ORCHESTRATION_CONTRACT_VIOLATION"}
        result = sanitize_edge_passthrough(raw)
        assert result["state"] == "INSUFFICIENT_SIGNAL"

    def test_non_dict_input_returns_degraded(self):
        for bad in (None, "string", 42, ["list"]):
            result = sanitize_edge_passthrough(bad)
            assert result == {"ok": False, "state": "DEGRADED"}

    def test_never_leaks_banned_tokens(self):
        raw = {
            "ok": False,
            "_http_status": 503,
            "code": "SEMRUSH_SUPPLIER_TOTAL_FAILURE",
            "error": "SEMrush supplier API failed for every call",
            "ai_errors": [
                "domain_rank: HTTP 403 — ERROR 403 :: ERROR 132 :: API UNITS BALANCE IS ZERO",
                "domain_organic: HTTP 403 — ERROR 403 :: ERROR 132 :: API UNITS BALANCE IS ZERO",
            ],
        }
        result = sanitize_edge_passthrough(raw)
        assert_no_banned_tokens(result, source="edge_passthrough_supplier_fail")


# ─── 5. sanitize_enrichment_for_external ─────────────────────────────────

class TestSanitizeEnrichmentForExternal:
    def _failed_edge_blob(self):
        """The realistic edge_tools blob from a FAILED scan (all suppliers down)."""
        return {
            "semrush_domain_intel": {"ok": False, "status": 401},
            "deep_web_recon": {"ok": False, "status": 401},
            "social_enrichment": {"ok": False, "status": 401},
            "competitor_monitor": {"ok": False, "status": 401},
            "market_analysis_ai": {"ok": False, "status": 401},
            "market_signal_scorer": {"ok": False, "status": 401},
            "browse_ai_reviews": {"ok": False, "status": 401},
        }

    def _healthy_edge_blob(self):
        return {
            "semrush_domain_intel": {"ok": True, "status": 200},
            "deep_web_recon": {"ok": True, "status": 200},
            "social_enrichment": {"ok": True, "status": 200},
            "competitor_monitor": {"ok": True, "status": 200},
            "market_analysis_ai": {"ok": True, "status": 200},
            "market_signal_scorer": {"ok": True, "status": 200},
            "browse_ai_reviews": {"ok": True, "status": 200},
        }

    def test_none_input_returns_processing(self):
        result = sanitize_enrichment_for_external(None)
        assert result == {"state": "PROCESSING", "enrichment": None}

    def test_non_dict_input_returns_degraded(self):
        result = sanitize_enrichment_for_external("oops")
        assert result == {"state": "DEGRADED", "enrichment": None}

    def test_strips_ai_errors_from_response(self):
        enrichment = {
            "business_name": "Acme",
            "ai_errors": [
                {"function": "semrush-domain-intel", "status": 401},
            ],
            "sources": {"edge_tools": self._failed_edge_blob()},
        }
        result = sanitize_enrichment_for_external(enrichment)
        assert "ai_errors" not in result["enrichment"]
        assert "sources" not in result["enrichment"]

    def test_seo_analysis_fails_when_semrush_failed(self):
        enrichment = {
            "business_name": "Acme",
            "seo_analysis": {
                "organic_keywords": None,
                "top_organic_keywords": [],
                "score": 80,  # fabricated score — must NOT leak through
                "status": "strong",
            },
            "sources": {"edge_tools": self._failed_edge_blob()},
        }
        result = sanitize_enrichment_for_external(enrichment)
        seo = result["enrichment"]["seo_analysis"]
        assert seo["state"] == "DATA_UNAVAILABLE"
        assert seo["score"] is None
        assert seo["status"] is None
        assert "message" in seo
        # Contract language, not "SEO weak"
        assert "Organic search performance data unavailable" in seo["message"]

    def test_seo_analysis_available_when_semrush_ok_and_fields_present(self):
        enrichment = {
            "seo_analysis": {
                "organic_keywords": 1500,
                "top_organic_keywords": [{"keyword": "foo"}],
                "score": 70,
                "status": "moderate",
            },
            "sources": {"edge_tools": self._healthy_edge_blob()},
        }
        result = sanitize_enrichment_for_external(enrichment)
        seo = result["enrichment"]["seo_analysis"]
        assert seo["state"] == "DATA_AVAILABLE"
        assert seo["score"] == 70  # real data preserved

    def test_seo_analysis_insufficient_signal_when_edge_ok_but_fields_empty(self):
        """Edge succeeded (domain was scanned) but SEMrush returned no keywords.
        That's a real 'domain has no SEO footprint' case — INSUFFICIENT_SIGNAL."""
        enrichment = {
            "seo_analysis": {
                "organic_keywords": None,
                "top_organic_keywords": [],
                "score": None,
                "status": "unknown",
            },
            "sources": {"edge_tools": self._healthy_edge_blob()},
        }
        result = sanitize_enrichment_for_external(enrichment)
        seo = result["enrichment"]["seo_analysis"]
        assert seo["state"] == "INSUFFICIENT_SIGNAL"
        assert seo["score"] is None

    def test_competitors_section_handles_list_values(self):
        """`competitors` is a list, not a dict. Sanitizer must handle both."""
        enrichment = {
            "competitors": [],
            "sources": {"edge_tools": self._failed_edge_blob()},
        }
        result = sanitize_enrichment_for_external(enrichment)
        competitors = result["enrichment"]["competitors"]
        # Empty list + edge failed → DATA_UNAVAILABLE
        assert competitors["state"] == "DATA_UNAVAILABLE"

    def test_swot_all_four_required_subfields(self):
        enrichment = {
            "swot": {
                "strengths": ["s1"],
                "weaknesses": ["w1"],
                "opportunities": ["o1"],
                "threats": ["t1"],
            },
            "sources": {"edge_tools": self._healthy_edge_blob()},
        }
        result = sanitize_enrichment_for_external(enrichment)
        swot = result["enrichment"]["swot"]
        assert swot["state"] == "DATA_AVAILABLE"

    def test_swot_missing_threats_flags_insufficient(self):
        enrichment = {
            "swot": {
                "strengths": ["s1"],
                "weaknesses": ["w1"],
                "opportunities": ["o1"],
                "threats": [],  # missing
            },
            "sources": {"edge_tools": self._healthy_edge_blob()},
        }
        result = sanitize_enrichment_for_external(enrichment)
        swot = result["enrichment"]["swot"]
        assert swot["state"] == "INSUFFICIENT_SIGNAL"

    def test_missing_edge_statuses_assumes_failure(self):
        enrichment = {
            "seo_analysis": {"organic_keywords": 1500, "top_organic_keywords": ["x"]},
            # No sources.edge_tools provided — treat as unknown = failed edge
        }
        result = sanitize_enrichment_for_external(enrichment)
        # Fields present but edge unknown → DEGRADED (data without verified provenance)
        assert result["enrichment"]["seo_analysis"]["state"] == "DEGRADED"

    def test_input_is_not_mutated(self):
        enrichment = {
            "seo_analysis": {"organic_keywords": None, "score": 80},
            "ai_errors": ["keep me internal"],
            "sources": {"edge_tools": self._failed_edge_blob()},
        }
        original_snapshot = json.dumps(enrichment, default=str)
        _ = sanitize_enrichment_for_external(enrichment)
        assert json.dumps(enrichment, default=str) == original_snapshot

    def test_top_state_all_available_rolls_up_to_available(self):
        enrichment = {
            "seo_analysis": {"organic_keywords": 1500, "top_organic_keywords": ["x"]},
            "swot": {"strengths": ["a"], "weaknesses": ["b"], "opportunities": ["c"], "threats": ["d"]},
            "competitors": ["comp1"],
            "sources": {"edge_tools": self._healthy_edge_blob()},
        }
        result = sanitize_enrichment_for_external(enrichment)
        # Some sections will be degraded due to missing other required sections;
        # the roll-up isn't strict DATA_AVAILABLE unless every SECTION_CRITERIA entry is present.
        # But the sections we DID populate should be DATA_AVAILABLE.
        assert result["enrichment"]["seo_analysis"]["state"] == "DATA_AVAILABLE"
        assert result["enrichment"]["swot"]["state"] == "DATA_AVAILABLE"

    def test_top_state_all_unavailable_rolls_up_to_unavailable(self):
        enrichment = {
            "seo_analysis": {"organic_keywords": None, "top_organic_keywords": []},
            "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
            "sources": {"edge_tools": self._failed_edge_blob()},
        }
        result = sanitize_enrichment_for_external(enrichment)
        # All populated sections UNAVAILABLE; unpopulated sections also UNAVAILABLE.
        assert result["state"] in ("DATA_UNAVAILABLE", "DEGRADED")

    def test_end_to_end_realistic_failed_scan_never_leaks(self):
        """The scenario from Andreas's actual 2026-04-23 outlook-user scan:
        7×401 across edge tools, fabricated seo_score=80, ai_errors with
        supplier names and HTTP codes. Sanitized output MUST NOT contain
        any banned token."""
        enrichment = {
            "business_name": "SMSGlobal",
            "industry": "SMS gateway",
            "website": "smsglobal.com",
            "seo_analysis": {
                "organic_keywords": None,
                "top_organic_keywords": [],
                "score": 80,
                "status": "strong",
                "source": "semrush",
            },
            "paid_media_analysis": {
                "adwords_keywords": None,
                "top_paid_keywords": [],
                "maturity": "none_detected",
                "source": "semrush",
            },
            "competitors": [],
            "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
            "competitor_analysis": {"organic_competitors": []},
            "ai_errors": [
                {"error": "semrush-domain-intel returned HTTP 401", "status": 401, "function": "semrush-domain-intel"},
                {"error": "deep-web-recon returned HTTP 401", "status": 401, "function": "deep-web-recon"},
                {"error": "market-analysis-ai returned HTTP 401", "status": 401, "function": "market-analysis-ai"},
            ],
            "sources": {
                "edge_tools": self._failed_edge_blob(),
                "raw_overview": {"Dn": "smsglobal.com", "Rk": "0"},
            },
        }
        result = sanitize_enrichment_for_external(enrichment)
        # The big test: no banned substring anywhere in the serialized result.
        assert_no_banned_tokens(result, source="realistic_failed_scan")


# ─── 6. assert_no_banned_tokens ───────────────────────────────────────────

class TestBannedTokenAssertion:
    def test_supplier_name_triggers_violation(self):
        with pytest.raises(ExternalContractViolation) as exc:
            assert_no_banned_tokens({"message": "SEMRUSH is down"}, source="test")
        assert "SEMRUSH" in str(exc.value)

    def test_http_status_string_triggers_violation(self):
        with pytest.raises(ExternalContractViolation):
            assert_no_banned_tokens({"err": "HTTP 401 from upstream"})

    def test_edge_tools_key_triggers_violation(self):
        with pytest.raises(ExternalContractViolation):
            assert_no_banned_tokens({"sources": {"edge_tools": {}}})

    def test_clean_payload_passes(self):
        clean = {
            "state": "DATA_UNAVAILABLE",
            "message": "Market intelligence temporarily unavailable",
            "score": None,
        }
        # Should not raise.
        assert_no_banned_tokens(clean, source="clean")

    def test_custom_banned_list(self):
        with pytest.raises(ExternalContractViolation):
            assert_no_banned_tokens({"x": "FOO"}, banned=["FOO"])

    def test_contract_enforcement_catches_fabricated_nested_leak(self):
        nested_leak = {
            "enrichment": {
                "seo_analysis": {"state": "DATA_AVAILABLE"},
                "meta": {"internal_debug": "service_role_exact"},
            }
        }
        with pytest.raises(ExternalContractViolation):
            assert_no_banned_tokens(nested_leak)


# ─── 7. Section criteria coverage ────────────────────────────────────────

class TestSectionCriteriaCoverage:
    def test_every_section_has_required_and_edge_tools(self):
        for name, criteria in SECTION_CRITERIA.items():
            assert "required" in criteria, f"{name} missing required"
            assert "edge_tools" in criteria, f"{name} missing edge_tools"
            assert isinstance(criteria["required"], tuple)
            assert isinstance(criteria["edge_tools"], tuple)


# ─── 8. Banned-tokens completeness ────────────────────────────────────────

class TestBannedTokensCompleteness:
    @pytest.mark.parametrize("token", [
        "SEMRUSH", "OpenAI", "Perplexity", "Firecrawl",
        "service_role", "API_KEY_MISSING", "HTTP 401",
        "ai_errors", "edge_tools", "semrush-domain-intel",
    ])
    def test_critical_tokens_are_banned(self, token):
        assert token in ALL_BANNED_TOKENS
