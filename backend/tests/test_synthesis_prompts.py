"""
R2E Synthesis Prompts — unit tests.

Covers the 7 acceptance criteria for fix/p0-marjo-r2e-synthesis-prompts:

  1. test_chief_marketing_summary_cites_3_signals
  2. test_swot_items_have_source_trace_ids (provenance contract)
  3. test_roadmap_items_cite_real_findings
  4. test_anti_template_denylist_in_prompt (forbidden patterns embedded)
  5. test_competitive_landscape_top_5_with_metrics
  6. test_review_intelligence_includes_theme_quotes
  7. test_no_marketing_101_phrases_in_output (regex sweep)

All tests are pure unit tests — no LLM round-trips, no Supabase, no
network. They directly invoke the prompt builders + filter helpers in
`backend/core/synthesis_prompts.py` against fixture enrichment payloads
shaped like the R2A-D + F14/F15 deepened data.

Cross-references:
  - BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2 (no supplier names
    in any output the LLM is told to produce — the prompts use customer-
    facing language only)
  - feedback_no_cheating.md (provenance enforcement: items without a
    real signal pointer are dropped, never padded)
  - feedback_ask_biqc_brand_name.md ("Ask BIQc" is the only product name
    surface — never Soundboard / Chat / Assistant)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

# Make backend/ importable as a top-level package, mirroring conftest.py
_REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT / "backend"))

from core.synthesis_prompts import (  # noqa: E402
    PROMPT_ANTI_TEMPLATE_TERMS,
    build_chief_marketing_summary_prompt,
    build_executive_summary_prompt,
    build_swot_prompt,
    build_strategic_roadmap_prompt,
    build_competitive_landscape_prompt,
    build_review_intelligence_prompt,
    collect_available_competitor_names,
    collect_available_brand_metric_names,
    collect_available_trace_ids,
    filter_synthesis_swot_with_provenance,
    filter_synthesis_roadmap_with_provenance,
    has_sufficient_synthesis_inputs,
    is_anti_template_phrase,
    parse_synthesis_json,
    shape_competitor_intelligence,
    shape_keyword_profile,
    shape_review_intelligence,
    shape_workplace_intelligence,
)


# ─── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def rich_enrichment() -> dict:
    """A scan with full R2A-D + F14/F15 deepened data — should produce
    specific, evidence-cited synthesis output."""
    return {
        "business_name": "Acme Roofing",
        "industry": "Construction — roofing services",
        "website_url": "https://acmeroofing.com.au",
        "keyword_intelligence": {
            "organic_keywords": [
                {
                    "keyword": "roofing repair sydney",
                    "position": 47,
                    "search_volume": 2400,
                    "cpc": 3.20,
                    "traffic_pct": 0.05,
                    "competition": "high",
                    "trace_id": "kw_trace_42",
                },
                {
                    "keyword": "commercial roofing",
                    "position": 12,
                    "search_volume": 1800,
                    "cpc": 4.50,
                    "traffic_pct": 0.18,
                    "trace_id": "kw_trace_43",
                },
                {
                    "keyword": "roof leak detection",
                    "position": 5,
                    "search_volume": 880,
                    "cpc": 2.10,
                    "traffic_pct": 0.22,
                    "trace_id": "kw_trace_44",
                },
                {
                    "keyword": "tile roof repair",
                    "position": 19,
                    "search_volume": 720,
                    "cpc": 2.85,
                    "traffic_pct": 0.08,
                },
                {
                    "keyword": "metal roof installation",
                    "position": 23,
                    "search_volume": 590,
                    "cpc": 5.10,
                    "traffic_pct": 0.07,
                },
            ],
            "top_pages": [
                {"url": "/services", "organic_traffic": 1200, "organic_keywords": 84, "traffic_pct": 0.18},
                {"url": "/leak-detection", "organic_traffic": 980, "organic_keywords": 32, "traffic_pct": 0.15},
            ],
            "total_keywords": 1247,
            "monthly_organic_traffic": 6800,
        },
        "customer_review_intelligence_v2": {
            "cross_platform": {
                "weighted_avg_rating": 4.3,
                "total_count": 187,
                "sentiment_distribution": {"positive_pct": 78, "negative_pct": 12, "neutral_pct": 10},
                "themes": ["fast service", "reliable craftsmanship", "fair pricing"],
                "velocity": "+12% MoM",
            },
            "per_platform": {
                "google": {
                    "rating": 4.5,
                    "count": 142,
                    "themes": ["fast service", "reliable craftsmanship"],
                    "recent_reviews": [
                        {"snippet": "Got my roof repair done in 2 days, great work.", "rating": 5, "date": "2026-04-12"},
                        {"snippet": "Fair price, professional team — would use again.", "rating": 5, "date": "2026-04-08"},
                    ],
                    "trace_id": "rv_trace_g1",
                },
                "productreview": {
                    "rating": 4.0,
                    "count": 45,
                    "themes": ["fair pricing", "communication"],
                    "recent_reviews": [
                        {"snippet": "Communication could be quicker but quality is solid.", "rating": 4},
                    ],
                    "trace_id": "rv_trace_pr1",
                },
            },
        },
        "workplace_intelligence": {
            "cross_platform": {
                "employer_brand_health_score": 72,
                "weighted_overall_rating": 4.1,
                "trend": "improving",
                "pros": ["flexible hours", "good team culture", "training opportunities"],
                "cons": ["salary below market", "limited advancement"],
            },
            "per_platform": {
                "seek": {"rating": 4.2, "count": 12, "themes": ["flexible hours", "training"]},
                "indeed": {"rating": 4.0, "count": 8, "themes": ["good culture", "salary"]},
            },
        },
        "competitive_intelligence": {
            "detailed_competitors": [
                {"domain": "roofright.com.au", "Or": 8400, "Ot": 22000, "Oc": 124, "Ad": 56, "trace_id": "comp_trace_1"},
                {"domain": "sydneyroof.com.au", "Or": 5200, "Ot": 12000, "Oc": 78, "Ad": 0, "trace_id": "comp_trace_2"},
                {"domain": "topnotchroofing.com.au", "Or": 3100, "Ot": 8200, "Oc": 45, "Ad": 22, "trace_id": "comp_trace_3"},
            ],
        },
        "advertising_intelligence": {
            "ad_history_12m": [
                {"date": "2026-04-01", "ad_keywords_count": 18, "ads_budget": 4200, "traffic": 820},
                {"date": "2026-03-01", "ad_keywords_count": 15, "ads_budget": 3800, "traffic": 740},
            ],
        },
        "paid_media_analysis": {
            "adwords_keywords": 22,
            "adwords_traffic": 980,
            "adwords_cost_usd": 4400,
            "top_paid_keywords": [
                {"keyword": "emergency roof repair", "position": 2, "search_volume": 1100, "cpc": 6.80},
            ],
        },
        "backlink_intelligence": {
            "total_backlinks": 4200,
            "referring_domains": 287,
            "follow_ratio": 0.78,
            "toxic_backlinks_pct": 4.2,
        },
    }


@pytest.fixture
def thin_enrichment() -> dict:
    """A scan with only baseline data — should NOT trigger synthesis,
    callers should flip section to INSUFFICIENT_SIGNAL instead."""
    return {
        "business_name": "Generic Co",
        "industry": "unknown",
        "website_url": "https://example.com",
        "competitors": [],
        "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
        "cmo_priority_actions": [],
    }


@pytest.fixture
def mixed_enrichment() -> dict:
    """A scan with reviews + competitors but no keyword profile — should
    produce DEGRADED state synthesis (some sections rich, others banner)."""
    return {
        "business_name": "Mid Co",
        "industry": "Professional services",
        "customer_review_intelligence_v2": {
            "cross_platform": {
                "weighted_avg_rating": 4.0,
                "total_count": 22,
                "sentiment_distribution": {"positive_pct": 65},
                "themes": ["responsive support", "value for money"],
            },
            "per_platform": {
                "google": {"rating": 4.0, "count": 22, "themes": ["responsive support"]},
            },
        },
        "competitive_intelligence": {
            "detailed_competitors": [
                {"domain": "midcompetitor1.com.au", "Or": 1200, "Ot": 4000},
                {"domain": "midcompetitor2.com.au", "Or": 800, "Ot": 2500},
            ],
        },
        # Intentionally missing: keyword_intelligence, workplace_intelligence
    }


# ═══════════════════════════════════════════════════════════════════════════
# 1. Chief Marketing Summary cites 3+ signals
# ═══════════════════════════════════════════════════════════════════════════


def test_chief_marketing_summary_cites_3_signals(rich_enrichment):
    """The chief marketing summary prompt must instruct the LLM to cite
    at least 3 specific signals, AND must include the structured input
    block that contains those signals."""
    system, user = build_chief_marketing_summary_prompt(
        business_name="Acme Roofing",
        enrichment=rich_enrichment,
    )
    # System message must instruct citing at least 3 signals
    assert "3" in system or "AT LEAST 3" in system or "at least 3" in system.lower(), (
        "Chief Marketing Summary prompt must instruct LLM to cite >=3 signals"
    )
    # User message must include the structured input with the real signals
    assert "STRUCTURED INPUT" in user or "SCAN DATA" in user
    assert "roofing repair sydney" in user, "keyword signal missing from prompt"
    assert "187" in user or "fast service" in user, "review signal missing from prompt"
    assert "roofright.com.au" in user, "competitor signal missing from prompt"
    # Output contract must require source_trace_ids
    assert "source_trace_ids" in user
    assert "signals_cited" in user
    # No supplier-name leakage
    for banned in ("SEMrush", "OpenAI", "Anthropic", "Browse.ai", "Perplexity"):
        assert banned.lower() not in system.lower(), f"supplier name leaked in system: {banned}"
        assert banned.lower() not in user.lower(), f"supplier name leaked in user: {banned}"


# ═══════════════════════════════════════════════════════════════════════════
# 2. SWOT items have source_trace_ids (provenance contract)
# ═══════════════════════════════════════════════════════════════════════════


def test_swot_items_have_source_trace_ids(rich_enrichment):
    """The SWOT prompt must explicitly require source_trace_ids per item,
    and the filter must drop items lacking provenance."""
    system, user = build_swot_prompt(
        business_name="Acme Roofing",
        enrichment=rich_enrichment,
    )
    assert "source_trace_ids" in user, "SWOT prompt missing source_trace_ids contract"
    assert "REJECTED" in system or "REJECTED" in user, (
        "SWOT prompt must warn that items without provenance will be REJECTED"
    )
    # Filter test: dict without source_trace_ids and not matching competitor
    # must be dropped.
    raw_items = [
        # GOOD: has trace_id
        {
            "text": "Ranks #5 for 'roof leak detection' (search_volume 880).",
            "source_trace_ids": ["kw_trace_44"],
            "evidence_tag": "keyword",
        },
        # GOOD: cites a competitor name from the allowed list
        {
            "text": "Outranks roofright.com.au on 124 shared keywords.",
            "evidence_tag": "competitor",
        },
        # BAD: no provenance, generic phrase
        {"text": "Strong online presence and good SEO."},
        # BAD: empty
        {"text": ""},
        # BAD: anti-template phrase
        {"text": "Improve social media presence", "source_trace_ids": ["xyz"]},
    ]
    filtered = filter_synthesis_swot_with_provenance(
        raw_items,
        available_trace_ids=["kw_trace_44"],
        available_competitor_names=["roofright.com.au"],
    )
    assert len(filtered) == 2, f"expected 2 items survive provenance filter, got {len(filtered)}: {filtered}"
    assert any("roof leak detection" in it["text"] for it in filtered)
    assert any("roofright.com.au" in it["text"] for it in filtered)


def test_swot_items_dropped_without_provenance():
    """Edge case: zero-provenance input → empty output → caller flips to
    INSUFFICIENT_SIGNAL."""
    raw = [
        {"text": "Good company"},
        {"text": "Strong brand"},
        {"text": "Competitive market"},
    ]
    filtered = filter_synthesis_swot_with_provenance(
        raw,
        available_trace_ids=[],
        available_competitor_names=[],
    )
    assert filtered == [], "items without any provenance must be dropped"


# ═══════════════════════════════════════════════════════════════════════════
# 3. Roadmap items cite real findings
# ═══════════════════════════════════════════════════════════════════════════


def test_roadmap_items_cite_real_findings(rich_enrichment):
    """Roadmap prompt must require evidence-cited items per horizon, and
    the filter must accept items citing a metric name OR competitor name OR
    trace_id."""
    system, user = build_strategic_roadmap_prompt(
        business_name="Acme Roofing",
        enrichment=rich_enrichment,
    )
    assert "7-day" in user.lower() or "quick wins" in user.lower()
    assert "30-day" in user.lower() or "priorities" in user.lower()
    assert "90-day" in user.lower() or "strategic" in user.lower()
    # The structured input must include the keyword + competitor data
    assert "roofing repair sydney" in user
    assert "roofright.com.au" in user
    # Each horizon must require source_trace_ids
    assert "source_trace_ids" in user
    # Filter test
    raw_items = [
        {
            "text": "Optimise /services page for keyword 'commercial roofing' (rank 12, SV 1,800).",
            "source_trace_ids": ["kw_trace_43"],
            "evidence_tag": "keyword",
            "priority": "critical",
        },
        {
            "text": "Pilot a paid campaign at half the budget of roofright.com.au's 56 ad keywords.",
            "evidence_tag": "competitor",
            "priority": "high",
        },
        {
            "text": "Set quarterly target on organic_traffic to grow 20% via top-pages strategy.",
            "evidence_tag": "metric",
            "priority": "medium",
        },
        # BAD: generic playbook
        {"text": "Improve SEO and create a content calendar.", "priority": "medium"},
    ]
    filtered = filter_synthesis_roadmap_with_provenance(
        raw_items,
        available_trace_ids=["kw_trace_43"],
        available_competitor_names=["roofright.com.au"],
        available_brand_metric_names=["organic_traffic", "weighted_avg_rating"],
    )
    assert len(filtered) == 3, f"expected 3 items survive, got {len(filtered)}: {filtered}"


# ═══════════════════════════════════════════════════════════════════════════
# 4. Anti-template denylist embedded in every prompt
# ═══════════════════════════════════════════════════════════════════════════


def test_anti_template_denylist_in_prompt(rich_enrichment):
    """Every prompt must include the FORBIDDEN OUTPUT PATTERNS block with
    the full anti-template denylist."""
    builders = [
        build_chief_marketing_summary_prompt,
        build_executive_summary_prompt,
        build_swot_prompt,
        build_strategic_roadmap_prompt,
        build_competitive_landscape_prompt,
        build_review_intelligence_prompt,
    ]
    for builder in builders:
        system, user = builder(
            business_name="Acme Roofing",
            enrichment=rich_enrichment,
        )
        assert "FORBIDDEN OUTPUT" in user, (
            f"{builder.__name__} missing FORBIDDEN OUTPUT block"
        )
        # Spot-check: representative anti-template phrases must literally
        # appear in the prompt's deny block.
        for phrase in (
            "Improve social media presence",
            "Increase brand awareness",
            "Develop a content calendar",
            "Optimize SEO",
        ):
            assert phrase in user, (
                f"{builder.__name__} missing anti-template phrase: {phrase}"
            )


def test_anti_template_terms_are_full_set():
    """The denylist must include >= 20 terms — broad enough to cover the
    full Marketing-101 surface."""
    assert len(PROMPT_ANTI_TEMPLATE_TERMS) >= 20, (
        f"anti-template denylist too small: {len(PROMPT_ANTI_TEMPLATE_TERMS)}"
    )


# ═══════════════════════════════════════════════════════════════════════════
# 5. Competitive Landscape produces top 5+ with metrics
# ═══════════════════════════════════════════════════════════════════════════


def test_competitive_landscape_top_5_with_metrics(rich_enrichment):
    """Competitive Landscape prompt must request up to 10 rows with the
    metric set (organic_keywords, organic_traffic, common_keywords,
    paid_keywords, threat_level)."""
    system, user = build_competitive_landscape_prompt(
        business_name="Acme Roofing",
        enrichment=rich_enrichment,
    )
    # Up-to-10 wording is in the contract
    assert "10" in user or "ten" in user.lower()
    # Required fields per row
    for field in (
        "organic_keywords",
        "organic_traffic",
        "common_keywords_with_you",
        "paid_keywords",
        "threat_level",
        "where_they_outrank_you",
    ):
        assert field in user, f"competitive landscape contract missing field: {field}"
    # The structured input has the 3 detailed competitors from the fixture
    assert "roofright.com.au" in user
    assert "sydneyroof.com.au" in user
    assert "topnotchroofing.com.au" in user
    # Comparative positioning is specified
    assert "comparative_positioning" in user
    # Shape helper produces the expected row count
    shaped = shape_competitor_intelligence(rich_enrichment)
    assert len(shaped["competitors"]) == 3
    assert all(row.get("name") for row in shaped["competitors"])


# ═══════════════════════════════════════════════════════════════════════════
# 6. Review Intelligence includes theme + quotes
# ═══════════════════════════════════════════════════════════════════════════


def test_review_intelligence_includes_theme_quotes(rich_enrichment):
    """Review Intelligence prompt must instruct the LLM to include
    example_quote per theme when recent_reviews are present in the input."""
    system, user = build_review_intelligence_prompt(
        business_name="Acme Roofing",
        enrichment=rich_enrichment,
    )
    # Quotes are explicitly requested
    assert "example_quote" in user, "review prompt missing example_quote contract"
    assert "verbatim" in system.lower() or "verbatim" in user.lower()
    # Per-platform breakdown
    assert "per_platform" in user
    # Workplace intelligence section
    assert "employer_brand_health_score" in user
    assert "top_pros" in user and "top_cons" in user
    # Real recent_reviews from fixture must appear in structured input
    assert "Got my roof repair done in 2 days" in user
    # The shape helper carries through the recent_reviews
    shaped = shape_review_intelligence(rich_enrichment)
    assert shaped["weighted_avg_rating"] == 4.3
    assert shaped["total_review_count"] == 187
    # Per-platform recent_reviews preserved
    assert "google" in shaped["per_platform"]
    google_data = shaped["per_platform"]["google"]
    assert google_data["rating"] == 4.5
    assert google_data["count"] == 142
    assert any("2 days" in r.get("snippet", "") for r in google_data.get("recent_reviews", []))


# ═══════════════════════════════════════════════════════════════════════════
# 7. No Marketing-101 phrases in output (regex sweep)
# ═══════════════════════════════════════════════════════════════════════════


def test_no_marketing_101_phrases_in_output():
    """is_anti_template_phrase + filter_synthesis_swot_with_provenance must
    catch every phrase in PROMPT_ANTI_TEMPLATE_TERMS."""
    for phrase in PROMPT_ANTI_TEMPLATE_TERMS:
        # Each anti-template phrase, even with a fake trace_id, must be
        # rejected by the SWOT filter (the denylist trumps provenance).
        items = [{"text": phrase, "source_trace_ids": ["fake_trace"]}]
        filtered = filter_synthesis_swot_with_provenance(
            items,
            available_trace_ids=["fake_trace"],
            available_competitor_names=[],
        )
        assert filtered == [], (
            f"Anti-template phrase NOT caught by filter: {phrase!r} → {filtered}"
        )


def test_marketing_101_subphrases_rejected():
    """Variants of the Marketing-101 phrases (different casing, variations)
    should also be rejected via the regex patterns."""
    cases = [
        "Improve your social media presence today",
        "INCREASE BRAND AWARENESS",
        "Develop a content calendar this quarter",
        "We should leverage social media better",
        "Let's optimize SEO across the site",
    ]
    for text in cases:
        assert is_anti_template_phrase(text), (
            f"variant should be rejected: {text!r}"
        )


def test_specific_evidence_text_passes_filter():
    """Specific evidence-cited text must NOT match the anti-template
    denylist — these are the 'good' examples we want to keep."""
    cases = [
        "Ranks #3 for keyword 'commercial roofing' (search_volume 1,800, traffic_pct 18%) — strong commercial-intent foothold.",
        "Customer reviews on google: rating 4.5/5 across 142 reviews. Top theme: 'fast service' (mentioned 47 times).",
        "Outranks roofright.com.au on 24 of the 124 shared keywords.",
        "Employer-brand health score 72/100 with trend 'improving' across seek + indeed.",
    ]
    for text in cases:
        assert not is_anti_template_phrase(text), (
            f"evidence-cited text wrongly rejected: {text!r}"
        )


# ═══════════════════════════════════════════════════════════════════════════
# Bonus coverage: parse_synthesis_json + has_sufficient_synthesis_inputs
# ═══════════════════════════════════════════════════════════════════════════


def test_parse_synthesis_json_handles_code_fences():
    """LLM sometimes emits ```json fences despite contract — strip them."""
    fenced = '```json\n{"summary": "test", "source_trace_ids": ["x"]}\n```'
    parsed = parse_synthesis_json(fenced)
    assert parsed == {"summary": "test", "source_trace_ids": ["x"]}


def test_parse_synthesis_json_handles_prose_preamble():
    """LLM sometimes emits prose then JSON — extract the JSON object."""
    messy = 'Here is your output:\n{"bullets": [{"text": "a"}]}'
    parsed = parse_synthesis_json(messy)
    assert isinstance(parsed, dict)
    assert "bullets" in parsed


def test_parse_synthesis_json_returns_none_on_garbage():
    """Unparseable input → None, caller treats as INSUFFICIENT_SIGNAL."""
    assert parse_synthesis_json("not json at all") is None
    assert parse_synthesis_json("") is None
    assert parse_synthesis_json(None) is None


def test_has_sufficient_synthesis_inputs_rich(rich_enrichment):
    """Rich enrichment passes the gate."""
    assert has_sufficient_synthesis_inputs(rich_enrichment) is True


def test_has_sufficient_synthesis_inputs_thin(thin_enrichment):
    """Thin enrichment fails the gate — caller skips synthesis."""
    assert has_sufficient_synthesis_inputs(thin_enrichment) is False


def test_has_sufficient_synthesis_inputs_mixed(mixed_enrichment):
    """Mixed enrichment passes (reviews + competitors qualify)."""
    assert has_sufficient_synthesis_inputs(mixed_enrichment) is True


def test_collect_available_trace_ids_walks_nested(rich_enrichment):
    """The trace_id collector must walk into nested dicts and lists."""
    traces = collect_available_trace_ids(rich_enrichment)
    assert "kw_trace_42" in traces
    assert "kw_trace_43" in traces
    assert "rv_trace_g1" in traces
    assert "comp_trace_1" in traces


def test_collect_available_competitor_names(rich_enrichment):
    """Names from competitive_intelligence + semrush + flat list are
    aggregated and deduped."""
    names = collect_available_competitor_names(rich_enrichment)
    assert "roofright.com.au" in names
    assert "sydneyroof.com.au" in names
    assert "topnotchroofing.com.au" in names


def test_collect_available_brand_metric_names_includes_core_metrics():
    """Metric names must include the headline brand metrics."""
    metrics = collect_available_brand_metric_names({})
    assert "organic_traffic" in metrics
    assert "weighted_avg_rating" in metrics
    assert "employer_brand_health_score" in metrics


# ═══════════════════════════════════════════════════════════════════════════
# Contract v2 sanity: no supplier names anywhere in the prompts
# ═══════════════════════════════════════════════════════════════════════════


def test_no_supplier_names_in_any_prompt(rich_enrichment):
    """BIQc Platform Contract v2: external-facing language must never name
    a supplier. The synthesis prompts feed the LLM — and the LLM output
    feeds the customer — so the prompts themselves must be supplier-free."""
    banned = (
        "semrush", "openai", "anthropic", "perplexity", "firecrawl",
        "browse.ai", "merge.dev", "claude-3", "claude-4", "gpt-4",
        "gpt-5", "supabase", "edge function", "api_key", "service_role",
        "401", "503",
    )
    builders = [
        build_chief_marketing_summary_prompt,
        build_executive_summary_prompt,
        build_swot_prompt,
        build_strategic_roadmap_prompt,
        build_competitive_landscape_prompt,
        build_review_intelligence_prompt,
    ]
    for builder in builders:
        system, user = builder(
            business_name="Acme Roofing",
            enrichment=rich_enrichment,
        )
        combined = (system + user).lower()
        for token in banned:
            assert token not in combined, (
                f"{builder.__name__} leaks banned token {token!r}"
            )


def test_ask_biqc_brand_in_system_prompt():
    """feedback_ask_biqc_brand_name.md: the conversational AI surface is
    'Ask BIQc' — appears in the system message."""
    system, user = build_chief_marketing_summary_prompt(
        business_name="Acme",
        enrichment={"business_name": "Acme"},
    )
    assert "Ask BIQc" in system, "system message must reference Ask BIQc"
    # Forbidden alternatives must NOT appear
    for forbidden in ("Soundboard", "ChatGPT-style", "Assistant™"):
        assert forbidden not in system, f"forbidden brand alt appeared: {forbidden}"
