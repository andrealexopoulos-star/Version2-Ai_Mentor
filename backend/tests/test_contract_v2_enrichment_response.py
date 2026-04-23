"""
Contract-enforcement integration tests for the `/enrichment/website`
response path under the BIQc Platform Contract v2 (Step 3b).

Not a route-level test (would require fastapi + full app bootstrap).
Instead, directly invokes `sanitize_enrichment_for_external()` against
the realistic enrichment shapes that the route would return, to assert
the contract holds for the exact data flows that exist in production.
"""

from __future__ import annotations

import pytest

from backend.core.response_sanitizer import (
    sanitize_enrichment_for_external,
    assert_no_banned_tokens,
    ExternalState,
)


# ─── Realistic enrichment fixtures ────────────────────────────────────────

def _outlook_user_7x401_enrichment():
    """The actual shape of business_dna_enrichment.enrichment for user
    andre.alexopoulos@outlook.com on 2026-04-23 00:38 UTC (pre-Incident-H
    fix). Every edge tool 401'd, yet seo_score was fabricated as 80/strong
    from the HTML-hygiene heuristic. This is the exact ground-truth leak
    the contract targets."""
    return {
        "business_name": "SMSGlobal : SMS Service Provider, Bulk SMS Gateway & API Integration",
        "industry": "SMS / CPaaS",
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
            "assessment": "No paid search activity detected by SEMrush.",
            "source": "semrush",
        },
        "competitors": [],
        "swot": {
            "strengths": [],
            "weaknesses": [],
            "opportunities": [],
            "threats": [],
        },
        "competitor_analysis": {"organic_competitors": []},
        "competitor_swot": [],
        "cmo_executive_brief": "",
        "cmo_priority_actions": [],
        "ai_errors": [
            {"error": "semrush-domain-intel returned HTTP 401", "status": 401, "function": "semrush-domain-intel"},
            {"error": "deep-web-recon returned HTTP 401", "status": 401, "function": "deep-web-recon"},
            {"error": "market-analysis-ai returned HTTP 401", "status": 401, "function": "market-analysis-ai"},
            {"error": "social-enrichment returned HTTP 401", "status": 401, "function": "social-enrichment"},
            {"error": "competitor-monitor returned HTTP 401", "status": 401, "function": "competitor-monitor"},
            {"error": "market-signal-scorer returned HTTP 401", "status": 401, "function": "market-signal-scorer"},
            {"error": "browse-ai-reviews returned HTTP 401", "status": 401, "function": "browse-ai-reviews"},
        ],
        "sources": {
            "edge_tools": {
                "deep_web_recon": {"ok": False, "status": 401},
                "social_enrichment": {"ok": False, "status": 401},
                "competitor_monitor": {"ok": False, "status": 401},
                "market_analysis_ai": {"ok": False, "status": 401},
                "market_signal_scorer": {"ok": False, "status": 401},
                "browse_ai_reviews": {"ok": False, "status": 401},
                "semrush_domain_intel": {"ok": False, "status": 401},
            },
            "crawled_pages": [],
            "raw_overview": {"Dn": "smsglobal.com"},
        },
    }


def _smsglobal_semrush_zero_units_enrichment():
    """Post-Incident-H shape: edge calls themselves returned 200 (service_role
    works) but SEMrush itself returned 'API UNITS BALANCE IS ZERO'. Backend
    now stores the 503 + supplier-total-failure + ai_errors."""
    return {
        "business_name": "SMSGlobal",
        "website": "smsglobal.com",
        "seo_html_hygiene": {  # populated from HTML scrape
            "score": 80,
            "status": "strong",
            "strengths": ["Primary H1 heading detected.", "Structured data markup detected."],
            "gaps": ["Title length outside best-practice range."],
        },
        "seo_analysis": {},  # empty because SEMrush failed
        "paid_media_analysis": {},
        "competitors": ["competitor-a.com", "competitor-b.com"],  # from deep-web-recon
        "swot": {
            "strengths": ["Strong brand presence"],
            "weaknesses": ["No meta description"],
            "opportunities": ["Untapped paid search"],
            "threats": ["Rising competitor activity"],
        },
        "ai_errors": [
            "SEMrush supplier API failed for every call",
        ],
        "sources": {
            "edge_tools": {
                "deep_web_recon": {"ok": True, "status": 200},
                "social_enrichment": {"ok": True, "status": 200},
                "competitor_monitor": {"ok": True, "status": 200},
                "market_analysis_ai": {"ok": True, "status": 200},
                "market_signal_scorer": {"ok": True, "status": 200},
                "browse_ai_reviews": {"ok": True, "status": 200},
                "semrush_domain_intel": {"ok": False, "status": 503},
            },
        },
    }


def _healthy_enrichment():
    """Everything worked — semrush returned real data, AI synthesized SWOT.
    Sanitized output should preserve the data, annotate states as
    DATA_AVAILABLE."""
    return {
        "business_name": "SMSGlobal",
        "seo_html_hygiene": {
            "score": 80,
            "status": "strong",
            "strengths": ["H1 detected"],
            "gaps": [],
        },
        "seo_analysis": {
            "organic_keywords": 4500,
            "top_organic_keywords": [{"keyword": "bulk sms api"}],
            "score": 70,
            "status": "moderate",
            "source": "semrush",
        },
        "paid_media_analysis": {
            "adwords_keywords": 45,
            "top_paid_keywords": [{"keyword": "sms api"}],
            "maturity": "active",
            "source": "semrush",
        },
        "competitors": ["twilio.com", "messagebird.com"],
        "swot": {
            "strengths": ["strong"],
            "weaknesses": ["weak"],
            "opportunities": ["opp"],
            "threats": ["threat"],
        },
        "sources": {
            "edge_tools": {
                "deep_web_recon": {"ok": True, "status": 200},
                "social_enrichment": {"ok": True, "status": 200},
                "competitor_monitor": {"ok": True, "status": 200},
                "market_analysis_ai": {"ok": True, "status": 200},
                "market_signal_scorer": {"ok": True, "status": 200},
                "browse_ai_reviews": {"ok": True, "status": 200},
                "semrush_domain_intel": {"ok": True, "status": 200},
            },
        },
    }


# ─── Tests ────────────────────────────────────────────────────────────────

class TestContractV2EnrichmentResponse:

    def test_7x401_scan_never_leaks(self):
        """The most important test: the exact outlook-user 7×401 data must
        produce a sanitized response with no banned tokens."""
        result = sanitize_enrichment_for_external(_outlook_user_7x401_enrichment())
        assert_no_banned_tokens(result, source="outlook_7x401_full_enrichment")

    def test_7x401_fabricated_seo_score_is_nulled(self):
        """The specific defect: score=80 fabricated from HTML hygiene when
        SEMrush returned null, surfaced to UI as 'SEO STRONG'. Must be
        nulled out with contract-shaped message."""
        result = sanitize_enrichment_for_external(_outlook_user_7x401_enrichment())
        seo = result["enrichment"]["seo_analysis"]
        assert seo["state"] == "DATA_UNAVAILABLE"
        assert seo["score"] is None
        assert seo["status"] is None
        assert "unavailable" in seo["message"].lower()

    def test_7x401_ai_errors_array_is_stripped(self):
        result = sanitize_enrichment_for_external(_outlook_user_7x401_enrichment())
        assert "ai_errors" not in result["enrichment"]

    def test_7x401_sources_edge_tools_is_stripped(self):
        result = sanitize_enrichment_for_external(_outlook_user_7x401_enrichment())
        assert "sources" not in result["enrichment"]

    def test_zero_units_semrush_fail_does_not_leak_supplier_name(self):
        """Post-Incident-H shape: edges succeed but SEMrush itself fails.
        Sanitized response must not mention 'SEMrush', 'API UNITS', or
        HTTP codes."""
        result = sanitize_enrichment_for_external(_smsglobal_semrush_zero_units_enrichment())
        assert_no_banned_tokens(result, source="zero_units_semrush_fail")

    def test_zero_units_seo_analysis_state_is_unavailable(self):
        """SEMrush failed → seo_analysis.state = DATA_UNAVAILABLE."""
        result = sanitize_enrichment_for_external(_smsglobal_semrush_zero_units_enrichment())
        assert result["enrichment"]["seo_analysis"]["state"] == "DATA_UNAVAILABLE"

    def test_zero_units_seo_html_hygiene_is_available(self):
        """HTML hygiene should still surface because it doesn't depend on
        a supplier — it's derived from scraped HTML."""
        result = sanitize_enrichment_for_external(_smsglobal_semrush_zero_units_enrichment())
        hygiene = result["enrichment"]["seo_html_hygiene"]
        assert hygiene["state"] == "DATA_AVAILABLE"
        # The underlying score is preserved when available
        assert hygiene.get("score") == 80

    def test_zero_units_competitors_still_available_from_deep_web_recon(self):
        """deep-web-recon succeeded and produced competitors. Should be
        DATA_AVAILABLE even if SEMrush failed."""
        result = sanitize_enrichment_for_external(_smsglobal_semrush_zero_units_enrichment())
        competitors = result["enrichment"]["competitors"]
        # competitors is a list; sanitizer leaves list-shaped sections as-is
        # when DATA_AVAILABLE. Verify it's still a list with content.
        assert isinstance(competitors, list)
        assert len(competitors) > 0

    def test_zero_units_top_state_is_degraded(self):
        """Mixed success (6 edges ok, 1 failed) → top-level DEGRADED."""
        result = sanitize_enrichment_for_external(_smsglobal_semrush_zero_units_enrichment())
        assert result["state"] == ExternalState.DEGRADED.value

    def test_healthy_scan_preserves_real_data(self):
        result = sanitize_enrichment_for_external(_healthy_enrichment())
        # seo_analysis should preserve the SEMrush score (70) and be DATA_AVAILABLE
        seo = result["enrichment"]["seo_analysis"]
        assert seo["state"] == "DATA_AVAILABLE"
        assert seo["score"] == 70
        assert seo["organic_keywords"] == 4500
        # No banned tokens
        assert_no_banned_tokens(result, source="healthy_scan")

    def test_healthy_scan_paid_media_preserved(self):
        result = sanitize_enrichment_for_external(_healthy_enrichment())
        paid = result["enrichment"]["paid_media_analysis"]
        assert paid["state"] == "DATA_AVAILABLE"
        assert paid["adwords_keywords"] == 45

    def test_response_shape_includes_top_level_state(self):
        """Contract §2: external responses include a top-level state."""
        result = sanitize_enrichment_for_external(_outlook_user_7x401_enrichment())
        assert "state" in result
        assert result["state"] in {
            "DATA_AVAILABLE", "DATA_UNAVAILABLE",
            "INSUFFICIENT_SIGNAL", "PROCESSING", "DEGRADED",
        }

    def test_input_enrichment_is_not_mutated(self):
        """Sanitizer must be pure — the DB-backed audit copy stays intact."""
        import json
        enrichment = _outlook_user_7x401_enrichment()
        before = json.dumps(enrichment, default=str, sort_keys=True)
        _ = sanitize_enrichment_for_external(enrichment)
        after = json.dumps(enrichment, default=str, sort_keys=True)
        assert before == after
