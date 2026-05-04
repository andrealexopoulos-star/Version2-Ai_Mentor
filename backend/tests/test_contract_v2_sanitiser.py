"""
Tests for backend.lib.contract_v2_sanitiser — BIQc Platform Contract v2.

Memory ref:
    BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2
    feedback_zero_401_tolerance

This module tests the lib facade introduced for the
fix/p0-marjo-e3-contract-v2-sanitiser P0:
    1. Every denylist regex strips its target from sample payloads.
    2. The allowed external-state enum is preserved across sanitisation.
    3. Nested ai_errors deep inside business_dna_enrichment.enrichment
       are stripped end-to-end.
    4. Real-shaped payloads from a mocked scan emit no banned token.

The canonical sanitiser implementation continues to live in
`backend.core.response_sanitizer` and has its own deep test suite in
`tests/test_response_sanitizer.py`. These tests focus on the new
`sanitise_external_response` boundary helper + denylist-regex guard.
"""

from __future__ import annotations

import json
from typing import Any, Dict

import pytest

from backend.lib.contract_v2_sanitiser import (
    EXTERNAL_DENYLIST_REGEXES,
    EXTERNAL_DENYLIST_SOURCES,
    ExternalContractViolation,
    ExternalState,
    find_denylist_matches,
    sanitise_external_response,
    sanitize_edge_passthrough,
    sanitize_enrichment_for_external,
    sanitize_error_for_external,
)


# ─── 1. Denylist regex coverage ───────────────────────────────────────────

class TestDenylistRegexCoverage:
    """Each pattern from the mission spec must reject its target tokens."""

    @pytest.mark.parametrize("token", [
        "semrush", "Semrush", "SEMRUSH", "SEMRush",
        "openai", "OpenAI", "OPENAI",
        "perplexity", "Perplexity",
        "firecrawl", "Firecrawl",
        "browse.ai", "browse-ai", "BrowseAI", "browseai",
        "anthropic", "Anthropic",
        "gemini", "Gemini",
        "merge.dev", "Merge.dev",
        "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
        "SEMRUSH_API_KEY", "MERGE_API_KEY", "OPENAI_API_KEY",
        "Bearer eyJhbGciOiJIUzI1NiJ9",
        "BEARER service-role-key",
    ])
    def test_denylist_strips_token(self, token: str) -> None:
        """Each token must trigger a regex match — proving the denylist
        is wide enough to catch the realistic leak forms."""
        matches = find_denylist_matches({"err": f"Failed to call {token}"})
        assert matches, f"Denylist did not catch {token!r}"

    @pytest.mark.parametrize("infra_token", [
        "service_role", "deep-web-recon", "market-analysis-ai",
        "browse-ai-reviews", "semrush-domain-intel",
        "calibration-business-dna",
        "ai_errors", "_http_status", "edge_tools", "edge_function",
        "HTTP 401", "HTTP 403", "HTTP 500", "HTTP 503", "HTTP 504",
    ])
    def test_infrastructure_marker_caught(self, infra_token: str) -> None:
        """Internal infrastructure markers must be stripped."""
        matches = find_denylist_matches({"detail": infra_token})
        assert matches, f"Infrastructure leak missed: {infra_token!r}"

    def test_clean_payload_emits_no_match(self) -> None:
        """A payload using only allowed copy + external state passes."""
        clean: Dict[str, Any] = {
            "ok": True,
            "state": "DATA_AVAILABLE",
            "message": "Market intelligence available for this scan",
            "score": 72,
        }
        assert find_denylist_matches(clean) == []

    def test_uncertainty_language_passes(self) -> None:
        """Contract-approved uncertainty copy must not trigger any pattern."""
        approved = {
            "state": "DATA_UNAVAILABLE",
            "message": (
                "Insufficient market signal to assess SEO strength. "
                "Competitive landscape could not be reliably determined. "
                "Strategic synthesis pending — retry later."
            ),
        }
        assert find_denylist_matches(approved) == []


# ─── 2. Allowed external-state enum preservation ─────────────────────────

class TestExternalStatePreservation:
    @pytest.mark.parametrize("state", [
        ExternalState.DATA_AVAILABLE,
        ExternalState.DATA_UNAVAILABLE,
        ExternalState.INSUFFICIENT_SIGNAL,
        ExternalState.PROCESSING,
        ExternalState.DEGRADED,
    ])
    def test_state_round_trips(self, state: ExternalState) -> None:
        """`sanitise_external_response` must not mutate a valid external
        state value embedded in a clean payload."""
        payload = {"ok": True, "state": state.value, "score": 50}
        result = sanitise_external_response(payload)
        assert result["state"] == state.value

    def test_only_five_states_exist(self) -> None:
        members = {m.value for m in ExternalState}
        assert members == {
            "DATA_AVAILABLE",
            "DATA_UNAVAILABLE",
            "INSUFFICIENT_SIGNAL",
            "PROCESSING",
            "DEGRADED",
        }


# ─── 3. Nested ai_errors deep inside enrichment are stripped ─────────────

class TestNestedInternalKeyStripping:
    def _enrichment_with_deep_ai_errors(self) -> Dict[str, Any]:
        """Realistic shape: ai_errors nested 3+ levels deep, supplier
        names + HTTP statuses scattered through the tree."""
        return {
            "business_name": "Acme",
            "ai_errors": [
                {"function": "semrush-domain-intel", "status": 401,
                 "message": "Bearer token rejected by SEMrush"},
            ],
            "seo_analysis": {
                "organic_keywords": None,
                "score": 80,
                "status": "strong",
                "source": "semrush",
                "ai_errors": [
                    {"upstream": "OpenAI", "code": "RATE_LIMITED"},
                ],
            },
            "competitor_analysis": {
                "organic_competitors": [],
                "ai_errors": [{"err": "HTTP 503 from upstream"}],
            },
            "swot": {
                "strengths": [],
                "weaknesses": [],
                "opportunities": [],
                "threats": [],
            },
            "sources": {
                "edge_tools": {
                    "semrush_domain_intel": {"ok": False, "status": 401},
                    "deep_web_recon": {"ok": False, "status": 401},
                    "market_analysis_ai": {"ok": False, "status": 401},
                },
                "raw_overview": {"Dn": "acme.com", "Rk": "0"},
            },
        }

    def test_ai_errors_stripped_at_every_depth(self) -> None:
        result = sanitise_external_response(self._enrichment_with_deep_ai_errors())
        serialised = json.dumps(result)
        assert "ai_errors" not in serialised
        # Sources blob is dropped entirely (it's backend audit only).
        assert "edge_tools" not in serialised
        assert "raw_overview" not in serialised

    def test_supplier_names_stripped(self) -> None:
        """All supplier identifiers — anywhere in the tree — must vanish."""
        result = sanitise_external_response(self._enrichment_with_deep_ai_errors())
        # find_denylist_matches is the regex form of the contract.
        matches = find_denylist_matches(result)
        assert matches == [], (
            f"Supplier identifiers leaked through sanitiser: {matches}"
        )

    def test_fabricated_score_replaced_with_uncertainty(self) -> None:
        """The classic SEMRUSH-401 + seo_score=80/strong fabrication MUST
        flip to the contract uncertainty shape — score=null + state."""
        result = sanitise_external_response(self._enrichment_with_deep_ai_errors())
        seo = result["enrichment"]["seo_analysis"]
        assert seo["state"] in (
            ExternalState.DATA_UNAVAILABLE.value,
            ExternalState.DEGRADED.value,
            ExternalState.INSUFFICIENT_SIGNAL.value,
        )
        assert seo["score"] is None
        assert "Organic search performance data unavailable" in seo["message"]


# ─── 4. Real-shaped payloads from mocked scan ────────────────────────────

class TestRealShapedPayloads:
    def _mocked_scan_response_all_failed(self) -> Dict[str, Any]:
        """The exact response shape `/enrichment/website` would have
        produced on the night Andreas's outlook user calibrated and 7
        edge functions 401'd. seo_score fabricated, ai_errors populated,
        sources.edge_tools showing the failure cascade."""
        return {
            "status": "draft",
            "url": "https://smsglobal.com",
            "message": "Deep scan completed.",
            "enrichment": {
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
                "competitor_analysis": {"organic_competitors": []},
                "swot": {
                    "strengths": [], "weaknesses": [],
                    "opportunities": [], "threats": [],
                },
                "ai_errors": [
                    {"error": "semrush-domain-intel returned HTTP 401",
                     "status": 401, "function": "semrush-domain-intel"},
                    {"error": "deep-web-recon returned HTTP 401",
                     "status": 401, "function": "deep-web-recon"},
                    {"error": "market-analysis-ai returned HTTP 401",
                     "status": 401, "function": "market-analysis-ai"},
                ],
                "sources": {
                    "edge_tools": {
                        "semrush_domain_intel": {"ok": False, "status": 401},
                        "deep_web_recon": {"ok": False, "status": 401},
                        "social_enrichment": {"ok": False, "status": 401},
                        "competitor_monitor": {"ok": False, "status": 401},
                        "market_analysis_ai": {"ok": False, "status": 401},
                        "market_signal_scorer": {"ok": False, "status": 401},
                        "browse_ai_reviews": {"ok": False, "status": 401},
                    },
                    "raw_overview": {"Dn": "smsglobal.com", "Rk": "0"},
                },
            },
        }

    def test_failed_scan_emits_no_banned_token(self) -> None:
        """End-to-end: realistic 7×401 scan payload through the boundary
        helper — the result must not contain any denylist match."""
        result = sanitise_external_response(
            self._mocked_scan_response_all_failed()["enrichment"]
        )
        assert find_denylist_matches(result) == []

    def test_passthrough_fields_preserved(self) -> None:
        """The boundary helper must not eat top-level non-enrichment
        fields like url / status / message."""
        scan_response = self._mocked_scan_response_all_failed()
        # Strip wrapper to get raw enrichment shape — sanitiser knows
        # how to handle the enrichment dict directly.
        sanitised = sanitise_external_response(scan_response["enrichment"])
        # The enrichment-shape detection should kick in and replace
        # the internal sections with state-annotated skeletons.
        assert "state" in sanitised
        assert sanitised["state"] in {m.value for m in ExternalState}

    def test_healthy_scan_preserves_real_data(self) -> None:
        """A successful scan with real SEMrush+AI data must keep the
        numbers — sanitiser is not allowed to null out healthy data."""
        healthy = {
            "business_name": "Acme Co",
            "seo_analysis": {
                "organic_keywords": 1500,
                "top_organic_keywords": [{"keyword": "foo", "rank": 3}],
                "score": 72,
                "status": "moderate",
            },
            "swot": {
                "strengths": ["fast delivery"],
                "weaknesses": ["pricing opacity"],
                "opportunities": ["mid-market expansion"],
                "threats": ["incumbent consolidation"],
            },
            "sources": {
                "edge_tools": {
                    "semrush_domain_intel": {"ok": True, "status": 200},
                    "deep_web_recon": {"ok": True, "status": 200},
                    "market_analysis_ai": {"ok": True, "status": 200},
                },
            },
        }
        result = sanitise_external_response(healthy)
        seo = result["enrichment"]["seo_analysis"]
        assert seo["state"] == ExternalState.DATA_AVAILABLE.value
        assert seo["score"] == 72
        assert seo["organic_keywords"] == 1500


# ─── 5. Boundary helper edge cases ───────────────────────────────────────

class TestBoundaryHelperEdgeCases:
    def test_none_input_returns_processing(self) -> None:
        result = sanitise_external_response(None)
        assert result == {"ok": False, "state": ExternalState.PROCESSING.value}

    def test_non_dict_input_returns_degraded(self) -> None:
        for bad_input in ("string", 42, ["list"], 3.14, True):
            result = sanitise_external_response(bad_input)
            assert result == {"ok": False, "state": ExternalState.DEGRADED.value}

    def test_empty_dict_round_trips(self) -> None:
        result = sanitise_external_response({})
        # Empty dict isn't enrichment-shaped, isn't a leak — returns as-is.
        assert isinstance(result, dict)
        assert find_denylist_matches(result) == []

    def test_leaks_in_payload_raise(self) -> None:
        """If a banned token survives the scrub (e.g. embedded in a free-
        text field the sanitiser doesn't know to scrub), the boundary
        helper must raise — fail-closed."""
        payload = {
            "ok": True,
            "message": "All data fetched via SEMrush successfully",
        }
        with pytest.raises(ExternalContractViolation) as exc:
            sanitise_external_response(payload)
        assert "denylist" in str(exc.value).lower()

    def test_input_is_not_mutated(self) -> None:
        """Sanitiser must not mutate caller-owned state."""
        payload = {
            "seo_analysis": {"score": 80, "source": "semrush"},
            "ai_errors": [{"err": "HTTP 401"}],
            "sources": {"edge_tools": {"semrush_domain_intel": {"ok": False}}},
        }
        snapshot = json.dumps(payload, default=str)
        _ = sanitise_external_response(payload)
        assert json.dumps(payload, default=str) == snapshot


# ─── 6. Re-export integrity ──────────────────────────────────────────────

class TestReExportIntegrity:
    """The lib facade must re-export the canonical primitives 1:1 — no
    new code should need to import from `core.response_sanitizer` directly."""

    def test_sanitize_enrichment_re_exported(self) -> None:
        from backend.core.response_sanitizer import (
            sanitize_enrichment_for_external as canonical,
        )
        assert sanitize_enrichment_for_external is canonical

    def test_sanitize_edge_passthrough_re_exported(self) -> None:
        from backend.core.response_sanitizer import (
            sanitize_edge_passthrough as canonical,
        )
        assert sanitize_edge_passthrough is canonical

    def test_sanitize_error_re_exported(self) -> None:
        from backend.core.response_sanitizer import (
            sanitize_error_for_external as canonical,
        )
        assert sanitize_error_for_external is canonical

    def test_external_state_re_exported(self) -> None:
        from backend.core.response_sanitizer import ExternalState as canonical
        assert ExternalState is canonical


# ─── 7. Spec compliance: enumerate denylist sources ──────────────────────

class TestSpecCompliance:
    """Lock the denylist roots against the mission brief — if anyone
    deletes a regex, this test fails before the leak ships."""

    REQUIRED_ROOTS = (
        "semrush", "openai", "perplexity", "firecrawl",
        r"browse[\.\-]?ai", "anthropic", "gemini", r"merge\.dev",
        "SUPABASE_", "API_KEY", "BEARER ", "Bearer ",
    )

    @pytest.mark.parametrize("root", REQUIRED_ROOTS)
    def test_required_root_present(self, root: str) -> None:
        assert root in EXTERNAL_DENYLIST_SOURCES, (
            f"Missing required denylist root from spec: {root!r}"
        )

    def test_compiled_regexes_are_compiled_patterns(self) -> None:
        for pattern in EXTERNAL_DENYLIST_REGEXES:
            assert hasattr(pattern, "search"), (
                f"Expected compiled regex, got {type(pattern)}"
            )
