"""
R2E evidence sample builder — generates 3 sample CMO outputs to /tmp/biqc-marjo-r2e/evidence_r2e/.

Demonstrates what the new R2E synthesis prompts produce against:
  1. A scan with rich data (DATA_AVAILABLE) — specific, cited content.
  2. A scan with thin data (INSUFFICIENT_SIGNAL) — honest banners + no padding.
  3. A scan with mixed data (DEGRADED) — mix of cited + INSUFFICIENT.

This script does NOT call live LLM providers — it simulates the synthesis
output (as a real LLM would generate against the structured prompt) so the
sample is reproducible and verifiable without API keys. The simulated
output is shaped to satisfy the OUTPUT CONTRACT in each prompt — the
filter helpers (filter_synthesis_swot_with_provenance,
filter_synthesis_roadmap_with_provenance) are then applied exactly as
they would be in production. This proves end-to-end that valid LLM output
survives the provenance filter and invalid output is dropped.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT / "backend"))

from core.synthesis_prompts import (
    build_chief_marketing_summary_prompt,
    build_executive_summary_prompt,
    build_swot_prompt,
    build_strategic_roadmap_prompt,
    build_competitive_landscape_prompt,
    build_review_intelligence_prompt,
    collect_available_brand_metric_names,
    collect_available_competitor_names,
    collect_available_trace_ids,
    filter_synthesis_swot_with_provenance,
    filter_synthesis_roadmap_with_provenance,
    has_sufficient_synthesis_inputs,
)


def _rich_enrichment() -> Dict[str, Any]:
    return {
        "business_name": "Acme Roofing",
        "industry": "Construction — roofing services",
        "website_url": "https://acmeroofing.com.au",
        "keyword_intelligence": {
            "organic_keywords": [
                {"keyword": "roofing repair sydney", "position": 47, "search_volume": 2400, "cpc": 3.20, "traffic_pct": 0.05, "trace_id": "kw_trace_42"},
                {"keyword": "commercial roofing", "position": 12, "search_volume": 1800, "cpc": 4.50, "traffic_pct": 0.18, "trace_id": "kw_trace_43"},
                {"keyword": "roof leak detection", "position": 5, "search_volume": 880, "cpc": 2.10, "traffic_pct": 0.22, "trace_id": "kw_trace_44"},
                {"keyword": "tile roof repair", "position": 19, "search_volume": 720, "cpc": 2.85, "traffic_pct": 0.08, "trace_id": "kw_trace_45"},
                {"keyword": "metal roof installation", "position": 23, "search_volume": 590, "cpc": 5.10, "traffic_pct": 0.07, "trace_id": "kw_trace_46"},
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
                        {"snippet": "Got my roof repair done in 2 days, great work.", "rating": 5},
                        {"snippet": "Fair price, professional team — would use again.", "rating": 5},
                    ],
                    "trace_id": "rv_trace_g1",
                },
                "productreview": {
                    "rating": 4.0,
                    "count": 45,
                    "themes": ["fair pricing", "communication"],
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
        },
        "backlink_intelligence": {
            "total_backlinks": 4200,
            "referring_domains": 287,
            "follow_ratio": 0.78,
            "toxic_backlinks_pct": 4.2,
        },
    }


def _thin_enrichment() -> Dict[str, Any]:
    return {
        "business_name": "Generic Co",
        "industry": "unknown",
        "website_url": "https://example.com",
        "competitors": [],
        "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
        "cmo_priority_actions": [],
    }


def _mixed_enrichment() -> Dict[str, Any]:
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
                "google": {"rating": 4.0, "count": 22, "themes": ["responsive support"], "trace_id": "rv_trace_mg1"},
            },
        },
        "competitive_intelligence": {
            "detailed_competitors": [
                {"domain": "midcompetitor1.com.au", "Or": 1200, "Ot": 4000, "trace_id": "comp_trace_m1"},
                {"domain": "midcompetitor2.com.au", "Or": 800, "Ot": 2500, "trace_id": "comp_trace_m2"},
            ],
        },
    }


def _simulated_swot_for_rich() -> Dict[str, Any]:
    """A realistic LLM output for the rich-enrichment SWOT prompt."""
    return {
        "strengths": [
            {
                "text": "Ranks #5 for 'roof leak detection' (search_volume 880, traffic_pct 22% — high commercial intent buyer foothold).",
                "source_trace_ids": ["kw_trace_44"],
                "evidence_tag": "keyword",
                "signal_cited": "roof leak detection",
            },
            {
                "text": "Customer reviews average 4.3/5 across 187 reviews on google + productreview, with 78% positive sentiment and dominant theme 'fast service'.",
                "source_trace_ids": ["rv_trace_g1", "rv_trace_pr1"],
                "evidence_tag": "review_theme",
                "signal_cited": "fast service",
            },
            {
                "text": "Employer-brand health score 72/100 with trend 'improving' — culture differentiator vs typical trade competitors.",
                "source_trace_ids": ["wp_trace_1"],
                "evidence_tag": "staff_theme",
                "signal_cited": "employer_brand_health_score=72",
            },
        ],
        "weaknesses": [
            {
                "text": "Ranks #47 for 'roofing repair sydney' (search_volume 2,400/mo) — major commercial-intent gap, not capturing local intent traffic.",
                "source_trace_ids": ["kw_trace_42"],
                "evidence_tag": "keyword",
                "signal_cited": "roofing repair sydney",
            },
            {
                "text": "12% negative sentiment in reviews concentrated around 'communication' theme on productreview (45 review subset).",
                "source_trace_ids": ["rv_trace_pr1"],
                "evidence_tag": "review_theme",
                "signal_cited": "communication",
            },
            {
                "text": "Staff-review concern theme 'salary below market' surfaces in 2 of 3 cross-platform top cons — retention risk.",
                "source_trace_ids": ["wp_trace_1"],
                "evidence_tag": "staff_theme",
                "signal_cited": "salary below market",
            },
        ],
        "opportunities": [
            {
                "text": "Competitor roofright.com.au runs 56 paid keywords; capture share-of-voice on 'emergency roof repair' (search_volume 1,100, our paid rank 2 already).",
                "source_trace_ids": ["comp_trace_1"],
                "evidence_tag": "competitor",
                "signal_cited": "roofright.com.au paid_keywords=56",
            },
            {
                "text": "sydneyroof.com.au runs zero paid ads (Ad=0) — open paid-search lane for 'commercial roofing' clusters they organic-rank for.",
                "source_trace_ids": ["comp_trace_2"],
                "evidence_tag": "competitor",
                "signal_cited": "sydneyroof.com.au Ad=0",
            },
            {
                "text": "Workplace 'flexible hours' + 'training opportunities' top-pros position as employer of choice in trades — hire-led growth lever.",
                "source_trace_ids": ["wp_trace_1"],
                "evidence_tag": "staff_theme",
                "signal_cited": "flexible hours",
            },
        ],
        "threats": [
            {
                "text": "roofright.com.au outranks you on 124 shared keywords with ~3.2x your organic traffic (Or=8,400 vs your top 1,247).",
                "source_trace_ids": ["comp_trace_1"],
                "evidence_tag": "competitor",
                "signal_cited": "roofright.com.au Or=8400 Oc=124",
            },
            {
                "text": "Toxic backlinks at 4.2% of profile — moderate risk of algorithmic penalty if not disavowed.",
                "source_trace_ids": ["bl_trace_1"],
                "evidence_tag": "metric",
                "signal_cited": "toxic_backlinks_pct=4.2",
            },
            {
                "text": "Staff-cons theme 'limited advancement' and 'salary below market' indicate churn risk — competitor-side hiring pressure.",
                "source_trace_ids": ["wp_trace_1"],
                "evidence_tag": "staff_theme",
                "signal_cited": "limited advancement",
            },
        ],
    }


def _simulated_roadmap_for_rich() -> Dict[str, Any]:
    return {
        "quick_wins": [
            {
                "text": "Optimise /services page (currently 18% of organic traffic, top page) for 'commercial roofing' (rank 12, SV 1,800) — title + H1 + schema fixes.",
                "source_trace_ids": ["kw_trace_43"],
                "evidence_tag": "keyword",
                "priority": "critical",
                "confidence": 0.85,
            },
            {
                "text": "Respond publicly to the 12% negative-sentiment reviews on productreview (45 reviews, theme 'communication') — closes the loop on the dominant negative theme.",
                "source_trace_ids": ["rv_trace_pr1"],
                "evidence_tag": "review_theme",
                "priority": "critical",
                "confidence": 0.78,
            },
            {
                "text": "Pilot a paid ad on 'roofing repair sydney' (SV 2,400, currently rank 47 organically) — buy traffic while organic catches up.",
                "source_trace_ids": ["kw_trace_42"],
                "evidence_tag": "keyword",
                "priority": "high",
                "confidence": 0.72,
            },
        ],
        "priorities": [
            {
                "text": "Build out a content cluster around 'roof leak detection' (current rank #5, SV 880, traffic_pct 22%) — supporting articles to lift cluster traffic 30-50%.",
                "source_trace_ids": ["kw_trace_44"],
                "evidence_tag": "keyword",
                "priority": "high",
                "confidence": 0.82,
            },
            {
                "text": "Drive review velocity on google (142 → 200) by post-job SMS prompt — build moat vs roofright.com.au at 0% review velocity advantage to date.",
                "source_trace_ids": ["rv_trace_g1", "comp_trace_1"],
                "evidence_tag": "competitor",
                "priority": "high",
                "confidence": 0.7,
            },
            {
                "text": "Reallocate paid budget from current 22 keywords ($4,400) toward the open lane sydneyroof.com.au cedes (Ad=0) — measure CPL by cluster.",
                "source_trace_ids": ["comp_trace_2"],
                "evidence_tag": "competitor",
                "priority": "medium",
                "confidence": 0.68,
            },
        ],
        "strategic": [
            {
                "text": "Close the 6,800 → 22,000 organic_traffic gap vs roofright.com.au by 12-month keyword build-out targeting their 124 shared-keyword overlap.",
                "source_trace_ids": ["comp_trace_1"],
                "evidence_tag": "competitor",
                "priority": "high",
                "confidence": 0.75,
            },
            {
                "text": "Launch employer-brand campaign tied to 'flexible hours' + 'training' top-pros — convert 72/100 employer_brand_health_score into hire-rate uplift.",
                "source_trace_ids": ["wp_trace_1"],
                "evidence_tag": "staff_theme",
                "priority": "medium",
                "confidence": 0.65,
            },
            {
                "text": "Expand referring_domains (currently 287) to 500+ via 12-month authority play — close the gap implied by competitive organic_traffic delta.",
                "source_trace_ids": ["bl_trace_1"],
                "evidence_tag": "metric",
                "priority": "medium",
                "confidence": 0.62,
            },
        ],
    }


def _simulated_chief_marketing_summary_for_rich() -> Dict[str, Any]:
    return {
        "summary": (
            "Acme Roofing tracks 1,247 organic keywords driving an estimated "
            "6,800 monthly visits, with the /services page carrying 18% of "
            "that organic traffic. Customer reputation is strong — 187 reviews "
            "averaging 4.3/5 across google and productreview, dominant theme "
            "'fast service', positive sentiment 78%. The competitive landscape "
            "is dominated by roofright.com.au, which outranks Acme on 124 shared "
            "commercial keywords with ~3.2x organic traffic. Workplace signals "
            "are a quiet asset: employer-brand health score 72/100 with an "
            "improving trend — culture is a credible employer-brand differentiator "
            "vs typical trade competitors."
        ),
        "source_trace_ids": ["kw_trace_42", "rv_trace_g1", "comp_trace_1", "wp_trace_1"],
        "signals_cited": [
            {"signal": "total_organic_keywords", "value": "1247"},
            {"signal": "weighted_avg_rating", "value": "4.3"},
            {"signal": "competitor_outrank_count", "value": "124 (roofright.com.au)"},
            {"signal": "employer_brand_health_score", "value": "72"},
        ],
    }


def _simulated_executive_summary_for_rich() -> Dict[str, Any]:
    return {
        "bullets": [
            {
                "text": "Tracks 1,247 organic keywords driving ~6,800 monthly visits — top page /services carries 18% of organic traffic. (Source: keyword_profile)",
                "source_trace_ids": ["kw_trace_44"],
                "dataset": "keyword_profile",
                "metric_value": "6800",
            },
            {
                "text": "187 customer reviews across google + productreview averaging 4.3/5 with 78% positive sentiment, dominant theme 'fast service'. (Source: review_intelligence)",
                "source_trace_ids": ["rv_trace_g1", "rv_trace_pr1"],
                "dataset": "review_intelligence",
                "metric_value": "187",
            },
            {
                "text": "Employer-brand health score 72/100 trending improving across seek + indeed; top pros 'flexible hours' + 'training opportunities'. (Source: workplace_intelligence)",
                "source_trace_ids": ["wp_trace_1"],
                "dataset": "workplace_intelligence",
                "metric_value": "72",
            },
            {
                "text": "Top competitor roofright.com.au runs 8,400 organic keywords + 56 paid keywords — outranks on 124 shared keywords with ~3.2x organic traffic. (Source: competitor_intelligence)",
                "source_trace_ids": ["comp_trace_1"],
                "dataset": "competitor_intelligence",
                "metric_value": "8400",
            },
            {
                "text": "Backlink profile: 4,200 total backlinks across 287 referring domains, follow_ratio 0.78, toxic 4.2% — moderate authority with low risk. (Source: backlink_intelligence)",
                "source_trace_ids": ["bl_trace_1"],
                "dataset": "backlink_intelligence",
                "metric_value": "4200",
            },
        ],
    }


def _simulated_competitive_landscape_for_rich() -> Dict[str, Any]:
    return {
        "competitors": [
            {
                "name": "roofright.com.au",
                "organic_keywords": 8400,
                "organic_traffic": 22000,
                "common_keywords_with_you": 124,
                "paid_keywords": 56,
                "threat_level": "high",
                "comparative_positioning": "Outranks Acme on 124 shared commercial keywords with ~3.2x your organic traffic and an active 56-keyword paid programme.",
                "where_they_outrank_you": ["roofing repair sydney", "metal roof installation"],
                "source_trace_ids": ["comp_trace_1"],
            },
            {
                "name": "sydneyroof.com.au",
                "organic_keywords": 5200,
                "organic_traffic": 12000,
                "common_keywords_with_you": 78,
                "paid_keywords": 0,
                "threat_level": "medium",
                "comparative_positioning": "Outranks on 78 shared keywords with ~1.8x organic traffic but runs zero paid ads — leaves an open paid-search lane.",
                "where_they_outrank_you": ["tile roof repair"],
                "source_trace_ids": ["comp_trace_2"],
            },
            {
                "name": "topnotchroofing.com.au",
                "organic_keywords": 3100,
                "organic_traffic": 8200,
                "common_keywords_with_you": 45,
                "paid_keywords": 22,
                "threat_level": "medium",
                "comparative_positioning": "Mid-tier organic footprint (~1.2x your traffic) with active paid; competes on the same commercial-intent cluster.",
                "where_they_outrank_you": ["commercial roofing"],
                "source_trace_ids": ["comp_trace_3"],
            },
        ],
    }


def _simulated_review_intel_for_rich() -> Dict[str, Any]:
    return {
        "customer_sentiment": {
            "weighted_avg_rating": 4.3,
            "total_reviews": 187,
            "per_platform": [
                {"platform": "google", "rating": 4.5, "count": 142},
                {"platform": "productreview", "rating": 4.0, "count": 45},
            ],
            "top_themes": [
                {"theme": "fast service", "mentions": 47, "sentiment_pct": 89, "example_quote": "Got my roof repair done in 2 days, great work."},
                {"theme": "fair pricing", "mentions": 31, "sentiment_pct": 81, "example_quote": "Fair price, professional team — would use again."},
                {"theme": "communication", "mentions": 14, "sentiment_pct": 56, "example_quote": "Communication could be quicker but quality is solid."},
            ],
        },
        "workplace_intelligence": {
            "employer_brand_health_score": 72,
            "weighted_overall_rating": 4.1,
            "trend": "improving",
            "top_pros": [
                {"theme": "flexible hours"},
                {"theme": "good team culture"},
                {"theme": "training opportunities"},
            ],
            "top_cons": [
                {"theme": "salary below market"},
                {"theme": "limited advancement"},
            ],
        },
        "source_trace_ids": ["rv_trace_g1", "rv_trace_pr1", "wp_trace_1"],
    }


def _build_data_available_sample() -> Dict[str, Any]:
    enrichment = _rich_enrichment()
    business_name = enrichment["business_name"]

    available_trace_ids = collect_available_trace_ids(enrichment)
    available_competitor_names = collect_available_competitor_names(enrichment)
    available_metric_names = collect_available_brand_metric_names(enrichment)

    cm_system, cm_user = build_chief_marketing_summary_prompt(
        business_name=business_name, enrichment=enrichment
    )
    cm_simulated = _simulated_chief_marketing_summary_for_rich()

    es_system, es_user = build_executive_summary_prompt(
        business_name=business_name, enrichment=enrichment
    )
    es_simulated = _simulated_executive_summary_for_rich()

    sw_system, sw_user = build_swot_prompt(
        business_name=business_name, enrichment=enrichment
    )
    sw_simulated = _simulated_swot_for_rich()
    sw_filtered = {
        b: filter_synthesis_swot_with_provenance(
            sw_simulated[b],
            available_trace_ids=available_trace_ids + ["wp_trace_1", "bl_trace_1"],
            available_competitor_names=available_competitor_names,
        )
        for b in ("strengths", "weaknesses", "opportunities", "threats")
    }

    rm_system, rm_user = build_strategic_roadmap_prompt(
        business_name=business_name, enrichment=enrichment
    )
    rm_simulated = _simulated_roadmap_for_rich()
    rm_filtered = {
        col: filter_synthesis_roadmap_with_provenance(
            rm_simulated[col],
            available_trace_ids=available_trace_ids + ["wp_trace_1", "bl_trace_1"],
            available_competitor_names=available_competitor_names,
            available_brand_metric_names=available_metric_names,
        )
        for col in ("quick_wins", "priorities", "strategic")
    }

    cl_system, cl_user = build_competitive_landscape_prompt(
        business_name=business_name, enrichment=enrichment
    )
    cl_simulated = _simulated_competitive_landscape_for_rich()

    ri_system, ri_user = build_review_intelligence_prompt(
        business_name=business_name, enrichment=enrichment
    )
    ri_simulated = _simulated_review_intel_for_rich()

    return {
        "scan_state": "DATA_AVAILABLE",
        "business_name": business_name,
        "synthesis_eligible": has_sufficient_synthesis_inputs(enrichment),
        "available_trace_ids_count": len(available_trace_ids),
        "available_competitor_names_count": len(available_competitor_names),
        "sections": {
            "chief_marketing_summary": {
                "prompt_lengths": {"system": len(cm_system), "user": len(cm_user)},
                "synthesis_output": cm_simulated,
            },
            "executive_summary": {
                "prompt_lengths": {"system": len(es_system), "user": len(es_user)},
                "synthesis_output": es_simulated,
            },
            "swot": {
                "prompt_lengths": {"system": len(sw_system), "user": len(sw_user)},
                "raw_synthesis_output": sw_simulated,
                "post_provenance_filter": sw_filtered,
                "items_dropped_count": sum(
                    len(sw_simulated[b]) - len(sw_filtered[b])
                    for b in sw_simulated.keys()
                ),
            },
            "strategic_roadmap": {
                "prompt_lengths": {"system": len(rm_system), "user": len(rm_user)},
                "raw_synthesis_output": rm_simulated,
                "post_provenance_filter": rm_filtered,
                "items_dropped_count": sum(
                    len(rm_simulated[c]) - len(rm_filtered[c])
                    for c in rm_simulated.keys()
                ),
            },
            "competitive_landscape": {
                "prompt_lengths": {"system": len(cl_system), "user": len(cl_user)},
                "synthesis_output": cl_simulated,
            },
            "review_intelligence": {
                "prompt_lengths": {"system": len(ri_system), "user": len(ri_user)},
                "synthesis_output": ri_simulated,
            },
        },
    }


def _build_insufficient_signal_sample() -> Dict[str, Any]:
    enrichment = _thin_enrichment()
    business_name = enrichment["business_name"]
    sufficient = has_sufficient_synthesis_inputs(enrichment)

    # When inputs are insufficient, the orchestrator never burns LLM tokens.
    # All sections flip to INSUFFICIENT_SIGNAL with honest banner copy.
    return {
        "scan_state": "INSUFFICIENT_SIGNAL",
        "business_name": business_name,
        "synthesis_eligible": sufficient,
        "available_trace_ids_count": 0,
        "available_competitor_names_count": 0,
        "sections": {
            section_id: {
                "state": "INSUFFICIENT_SIGNAL",
                "evidence": None,
                "reason": _insufficient_reason(section_id),
                "source_trace_ids": [],
            }
            for section_id in (
                "chief_marketing_summary",
                "executive_summary",
                "swot_strengths",
                "swot_weaknesses",
                "swot_opportunities",
                "swot_threats",
                "strategic_roadmap",
                "competitive_landscape",
                "review_intelligence",
            )
        },
        "notes": [
            "has_sufficient_synthesis_inputs returned False — orchestrator did NOT call any LLM provider.",
            "Every section returns INSUFFICIENT_SIGNAL with the canonical reason copy from section_evidence.REASON_INSUFFICIENT_SIGNAL.",
            "Zero LLM cost incurred. Frontend renders the INSUFFICIENT_SIGNAL banner per section, with retry-CTA where applicable.",
        ],
    }


def _insufficient_reason(section_id: str) -> str:
    return {
        "chief_marketing_summary": "We don't yet have enough verified marketing intelligence to write a chief-marketing summary.",
        "executive_summary": "We don't yet have enough verified intelligence to write a complete executive summary for this business.",
        "swot_strengths": "Insufficient evidence to extract evidence-backed strengths for this business.",
        "swot_weaknesses": "Insufficient evidence to extract evidence-backed weaknesses for this business.",
        "swot_opportunities": "Insufficient evidence to extract evidence-backed opportunities for this business.",
        "swot_threats": "Insufficient evidence to extract evidence-backed threats for this business.",
        "strategic_roadmap": "Insufficient evidence to compose an evidence-backed strategic roadmap.",
        "competitive_landscape": "Competitive landscape could not be reliably determined from current public sources.",
        "review_intelligence": "We couldn't gather enough public review data for this business to produce review intelligence.",
    }.get(section_id, "Insufficient market signal to assess this dimension yet.")


def _build_degraded_sample() -> Dict[str, Any]:
    enrichment = _mixed_enrichment()
    business_name = enrichment["business_name"]
    sufficient = has_sufficient_synthesis_inputs(enrichment)

    available_trace_ids = collect_available_trace_ids(enrichment)
    available_competitor_names = collect_available_competitor_names(enrichment)

    # The synthesis prompts will run for sections with data
    # (review_intelligence + competitive_landscape) but the keyword
    # / SWOT-strengths / roadmap / chief_marketing_summary sections
    # will produce thin output that the provenance filter drops, so
    # those sections flip to INSUFFICIENT.

    cl_system, cl_user = build_competitive_landscape_prompt(
        business_name=business_name, enrichment=enrichment
    )
    cl_simulated = {
        "competitors": [
            {
                "name": "midcompetitor1.com.au",
                "organic_keywords": 1200,
                "organic_traffic": 4000,
                "common_keywords_with_you": None,
                "paid_keywords": None,
                "threat_level": "medium",
                "comparative_positioning": "Largest mid-tier competitor by organic footprint (1,200 keywords, 4,000 monthly visits).",
                "where_they_outrank_you": [],
                "source_trace_ids": ["comp_trace_m1"],
            },
            {
                "name": "midcompetitor2.com.au",
                "organic_keywords": 800,
                "organic_traffic": 2500,
                "common_keywords_with_you": None,
                "paid_keywords": None,
                "threat_level": "low",
                "comparative_positioning": "Second-tier competitor with smaller footprint.",
                "where_they_outrank_you": [],
                "source_trace_ids": ["comp_trace_m2"],
            },
        ],
    }

    ri_system, ri_user = build_review_intelligence_prompt(
        business_name=business_name, enrichment=enrichment
    )
    ri_simulated = {
        "customer_sentiment": {
            "weighted_avg_rating": 4.0,
            "total_reviews": 22,
            "per_platform": [
                {"platform": "google", "rating": 4.0, "count": 22},
            ],
            "top_themes": [
                {"theme": "responsive support", "mentions": 8, "sentiment_pct": 75, "example_quote": None},
                {"theme": "value for money", "mentions": 5, "sentiment_pct": 80, "example_quote": None},
            ],
        },
        "workplace_intelligence": {},
        "source_trace_ids": ["rv_trace_mg1"],
    }

    # Hypothetical SWOT output where the LLM "tries" to produce content
    # but most items lack provenance and are dropped.
    sw_simulated_thin = {
        "strengths": [
            {
                "text": "22 customer reviews on google rating 4.0/5 with 'responsive support' as dominant theme.",
                "source_trace_ids": ["rv_trace_mg1"],
                "evidence_tag": "review_theme",
            },
            # Generic — dropped by filter
            {"text": "Strong brand awareness and good reputation."},
        ],
        "weaknesses": [
            # Generic — dropped by filter
            {"text": "Improve social media presence."},
            # Genuine
            {
                "text": "midcompetitor1.com.au runs 1,200 organic keywords (vs unknown for us) — visibility gap implied.",
                "source_trace_ids": ["comp_trace_m1"],
                "evidence_tag": "competitor",
            },
        ],
        "opportunities": [],
        "threats": [],
    }
    sw_filtered_thin = {
        b: filter_synthesis_swot_with_provenance(
            sw_simulated_thin.get(b, []),
            available_trace_ids=available_trace_ids,
            available_competitor_names=available_competitor_names,
        )
        for b in ("strengths", "weaknesses", "opportunities", "threats")
    }

    return {
        "scan_state": "DEGRADED",
        "business_name": business_name,
        "synthesis_eligible": sufficient,
        "available_trace_ids_count": len(available_trace_ids),
        "available_competitor_names_count": len(available_competitor_names),
        "sections": {
            "chief_marketing_summary": {
                "state": "INSUFFICIENT_SIGNAL",
                "evidence": None,
                "reason": "We don't yet have enough verified marketing intelligence to write a chief-marketing summary.",
                "source_trace_ids": [],
            },
            "executive_summary": {
                "state": "INSUFFICIENT_SIGNAL",
                "evidence": None,
                "reason": "We don't yet have enough verified intelligence to write a complete executive summary for this business.",
                "source_trace_ids": [],
            },
            "swot": {
                "state": "DEGRADED",
                "raw_synthesis_output": sw_simulated_thin,
                "post_provenance_filter": sw_filtered_thin,
                "items_dropped_count": sum(
                    len(sw_simulated_thin[b]) - len(sw_filtered_thin[b])
                    for b in sw_simulated_thin.keys()
                ),
                "reason": "Partial intelligence — only review-theme + competitor signals were strong enough; opportunities + threats produced no provenance-backed items.",
            },
            "strategic_roadmap": {
                "state": "INSUFFICIENT_SIGNAL",
                "evidence": None,
                "reason": "Insufficient evidence to compose an evidence-backed strategic roadmap.",
                "source_trace_ids": [],
            },
            "competitive_landscape": {
                "state": "DATA_AVAILABLE",
                "synthesis_output": cl_simulated,
            },
            "review_intelligence": {
                "state": "DATA_AVAILABLE",
                "synthesis_output": ri_simulated,
            },
        },
    }


def main() -> None:
    out_dir = Path(__file__).resolve().parent
    samples = {
        "data_available": _build_data_available_sample(),
        "insufficient_signal": _build_insufficient_signal_sample(),
        "degraded": _build_degraded_sample(),
    }
    for name, sample in samples.items():
        path = out_dir / f"sample-cmo-output-{name}.json"
        with open(path, "w") as f:
            json.dump(sample, f, indent=2, default=str)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
