"""
CMO Report Synthesis Prompts — R2E (P0, fix/p0-marjo-r2e-synthesis-prompts)

Issued 2026-05-04 after R2A-R2D + F14/F15 deepened the underlying enrichment
data (SEMrush keyword profile / customer reviews per-platform / staff reviews
per-platform / detailed competitor analysis). The LLM synthesis prompts had
not yet been updated to USE that depth — the result was generic Marketing-101
SWOT/Roadmap items that did not reference the real signals captured.

This module provides the world-class synthesis prompt builders for the 6
CMO Report sections that need real-signal grounding:

    1. Chief Marketing Summary    (build_chief_marketing_summary_prompt)
    2. Executive Summary          (build_executive_summary_prompt)
    3. SWOT (4 buckets)           (build_swot_prompt)
    4. Strategic Roadmap (3 horizons) (build_strategic_roadmap_prompt)
    5. Competitive Landscape      (build_competitive_landscape_prompt)
    6. Review Intelligence        (build_review_intelligence_prompt)

CONTRACTS HONORED
─────────────────
- BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2
    No supplier names, no API key markers, no internal codes ever appear in
    prompt outputs. The LLM is instructed in plain language about what data
    it has — never told "SEMrush returned X" or "browse-ai-reviews failed".
    Section state translates to ExternalState (DATA_AVAILABLE / DEGRADED /
    INSUFFICIENT_SIGNAL / etc.) at the response boundary.

- feedback_no_cheating.md
    Prompts only present the data the scan actually produced. Nothing
    fabricated. Items that lack provenance are dropped by the caller via
    section_evidence.filter_swot_items_with_provenance().

- feedback_ask_biqc_brand_name.md
    "Ask BIQc" is the only product name surface. The conversational AI
    surface is never called Soundboard / Chat / Assistant.

- E6 section_evidence contract
    Every output JSON item MUST include a `source_trace_ids` array. Items
    without provenance are dropped at the boundary; the prompt instructs the
    LLM to ALWAYS include source_trace_ids when an item references a real
    signal from the structured input. The placeholder denylist
    (PROMPT_ANTI_TEMPLATE_TERMS) is included literally in every prompt as a
    forbidden output pattern, so the LLM is told what NOT to write.

Author: BIQc backend engineering, 2026-05-04 (R2E P0).
"""

from __future__ import annotations

import json
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple


# ─── Anti-template denylist ───────────────────────────────────────────────
#
# These are the Marketing-101 phrases the prompts MUST NOT emit. They are
# included verbatim in every prompt as a FORBIDDEN OUTPUT pattern, AND are
# enforced again at the response boundary by section_evidence.is_placeholder_string.
# Together, they form a defence-in-depth filter:
#   1. Prompt instructs LLM not to write these.
#   2. section_evidence drops anything that slips through.
#
# The list is a superset of section_evidence.PLACEHOLDER_PHRASE_PATTERNS so
# the prompt-side filter is at least as strict as the response-side filter.

PROMPT_ANTI_TEMPLATE_TERMS: tuple = (
    "Improve social media presence",
    "Increase brand awareness",
    "Develop a content calendar",
    "Leverage social media",
    "Engage with customers",
    "Build an email list",
    "Expand market presence",
    "Optimize SEO",
    "Optimise SEO",
    "Focus on customer service",
    "Differentiate from competitors",
    "Improve online presence",
    "Strengthen your brand",
    "Build customer loyalty",
    "Create high-quality content",
    "Run targeted ad campaigns",
    "Invest in digital marketing",
    "Embrace digital transformation",
    "Implement a CRM",
    "Foster customer engagement",
    "Focus on lead generation",
    "Build a strong online community",
    "Optimize the customer journey",
    "Enhance user experience",
    "Track key performance indicators",
)


# ─── Top-level prompt scaffolding ─────────────────────────────────────────

_BIQC_BRAND_LINE = (
    'You are BIQc Intelligence Engine — the analyst behind "Ask BIQc", '
    "the conversational AI surface inside biqc.ai. You do strategic marketing "
    "synthesis for Australian SMB owners using only verified scan data."
)

_NEVER_LEAK_RULE = (
    "NEVER mention third-party data suppliers, vendor brand names, model "
    "names, API names, HTTP error codes, auth-path markers, internal "
    "architecture details, edge-function names, or service-role identifiers. "
    "If a data point is absent or thin, simply state plainly that the signal "
    "could not be verified for this scan — never explain WHY in vendor-"
    "specific or technical terms. Customer-facing language only."
)

_PROVENANCE_RULE = (
    "Every output item MUST cite at least one specific signal from the "
    "STRUCTURED INPUT block — a keyword string, a competitor name, a review "
    "theme phrase, a numeric metric, or a trace_id. Items that do not cite a "
    "specific signal will be REJECTED downstream and silently dropped. The "
    "JSON output MUST include a `source_trace_ids` array of one or more "
    "string ids drawn from the `available_trace_ids` list in the input. If "
    "you cannot cite a real signal for an item, do not include that item."
)

_NUMBERS_OVER_ADJECTIVES_RULE = (
    "Use real numbers wherever the structured input provides them: search "
    "volumes, ranks, review counts, ratings, traffic share, ad budgets, "
    'sentiment %. Do not write adjectives like "strong", "weak", "low", '
    '"high", "various" as standalone descriptors. Numbers are evidence; '
    "adjectives without numbers are not."
)


def _format_anti_template_block() -> str:
    """The forbidden-output block embedded in every prompt.

    Lists every Marketing-101 phrase that downstream filters will reject,
    together with the contract: "items matching these patterns are silently
    dropped — write nothing rather than write a placeholder".
    """
    bulleted = "\n".join(f"  - {term}" for term in PROMPT_ANTI_TEMPLATE_TERMS)
    return (
        "FORBIDDEN OUTPUT PATTERNS (any item matching these will be REJECTED "
        "and silently dropped — write nothing rather than write a placeholder):\n"
        f"{bulleted}\n"
        "Also forbidden: any generic Marketing-101 phrase that could apply "
        "to ANY business in any industry. Every item must be specific to "
        "this business's scan data."
    )


# ─── Structured-input shaping ─────────────────────────────────────────────
#
# Pull the parts of `enrichment` the LLM needs, with size caps so the prompt
# fits inside the 8K-token budget the calibration route allocates. Each
# helper returns a sub-dict that becomes the prompt's STRUCTURED INPUT block.


def _trim_dict_list(rows: Any, *, max_rows: int = 10, keep_keys: Iterable[str] = ()) -> List[Dict[str, Any]]:
    """Pick the first N dict rows and keep only `keep_keys` per row."""
    if not isinstance(rows, list):
        return []
    keep = list(keep_keys)
    out: List[Dict[str, Any]] = []
    for row in rows[:max_rows]:
        if not isinstance(row, dict):
            continue
        if keep:
            out.append({k: row.get(k) for k in keep if k in row})
        else:
            out.append(dict(row))
    return out


def shape_keyword_profile(enrichment: Mapping[str, Any]) -> Dict[str, Any]:
    """Extract the keyword profile sub-block from enrichment.

    Pulls top organic keywords (R2D `keyword_intelligence.organic_keywords`),
    top pages (`keyword_intelligence.top_pages`), and falls back to the
    legacy `seo_analysis.top_organic_keywords` shape so this works on both
    the deepened R2A-D shape and the older shape from before R2D landed.
    """
    ki = enrichment.get("keyword_intelligence") if isinstance(enrichment.get("keyword_intelligence"), dict) else {}
    seo = enrichment.get("seo_analysis") if isinstance(enrichment.get("seo_analysis"), dict) else {}
    organic = ki.get("organic_keywords") or seo.get("top_organic_keywords") or []
    top_pages = ki.get("top_pages") or seo.get("top_pages") or []
    return {
        "top_organic_keywords": _trim_dict_list(
            organic,
            max_rows=10,
            keep_keys=("keyword", "position", "search_volume", "cpc", "traffic_pct", "competition"),
        ),
        "top_pages": _trim_dict_list(
            top_pages,
            max_rows=5,
            keep_keys=("url", "organic_traffic", "organic_keywords", "traffic_pct"),
        ),
        "total_organic_keywords": seo.get("organic_keywords") or ki.get("total_keywords"),
        "monthly_organic_traffic": seo.get("organic_traffic") or ki.get("monthly_organic_traffic"),
    }


def shape_review_intelligence(enrichment: Mapping[str, Any]) -> Dict[str, Any]:
    """Extract the customer-review intelligence sub-block.

    R2B / F14 deepened shape: `customer_review_intelligence_v2` with per-platform
    rating + cross-platform sentiment + themes. Falls back to legacy
    `customer_review_intelligence` and `customer_review_highlights`.
    """
    v2 = enrichment.get("customer_review_intelligence_v2") if isinstance(enrichment.get("customer_review_intelligence_v2"), dict) else {}
    legacy = enrichment.get("customer_review_intelligence") if isinstance(enrichment.get("customer_review_intelligence"), dict) else {}
    highlights = enrichment.get("customer_review_highlights") if isinstance(enrichment.get("customer_review_highlights"), dict) else {}

    per_platform = v2.get("per_platform") or legacy.get("per_platform") or {}
    cross = v2.get("cross_platform") or legacy.get("cross_platform") or {}

    out: Dict[str, Any] = {
        "weighted_avg_rating": cross.get("weighted_avg_rating") or legacy.get("rating") or v2.get("weighted_avg_rating"),
        "total_review_count": cross.get("total_count") or legacy.get("count") or v2.get("total_count"),
        "sentiment_distribution": cross.get("sentiment_distribution") or {
            "positive_pct": legacy.get("positive_pct"),
            "negative_pct": legacy.get("negative_pct"),
        },
        "top_themes": (cross.get("themes") or [])[:5] or (highlights.get("positive_themes") or [])[:5],
        "negative_themes": highlights.get("negative_themes") or [],
        "velocity_trend": cross.get("velocity") or v2.get("velocity"),
        "per_platform": {},
    }
    if isinstance(per_platform, dict):
        for platform_name, platform_data in list(per_platform.items())[:6]:
            if not isinstance(platform_data, dict):
                continue
            out["per_platform"][platform_name] = {
                "rating": platform_data.get("rating"),
                "count": platform_data.get("count"),
                "themes": (platform_data.get("themes") or [])[:3],
                "recent_reviews": _trim_dict_list(
                    platform_data.get("recent_reviews") or [],
                    max_rows=3,
                    keep_keys=("snippet", "rating", "date", "sentiment"),
                ),
            }
    return out


def shape_workplace_intelligence(enrichment: Mapping[str, Any]) -> Dict[str, Any]:
    """Extract the workplace / staff-review intelligence sub-block.

    R2C / F14 deepened shape: `workplace_intelligence` with per-platform
    rating + cross-platform employer_brand_health_score + themes. Falls back
    to the legacy `staff_review_intelligence` / `staff_review_highlights`.
    """
    wp = enrichment.get("workplace_intelligence") if isinstance(enrichment.get("workplace_intelligence"), dict) else {}
    legacy_staff = enrichment.get("staff_review_intelligence") if isinstance(enrichment.get("staff_review_intelligence"), dict) else {}
    staff_high = enrichment.get("staff_review_highlights") if isinstance(enrichment.get("staff_review_highlights"), dict) else {}
    cross = wp.get("cross_platform") or {}
    per_platform = wp.get("per_platform") or {}

    out: Dict[str, Any] = {
        "employer_brand_health_score": cross.get("employer_brand_health_score") or wp.get("employer_brand_health_score"),
        "weighted_overall_rating": cross.get("weighted_overall_rating") or legacy_staff.get("rating"),
        "trend": cross.get("trend") or wp.get("trend"),
        "top_pros": (cross.get("pros") or [])[:3] or (staff_high.get("pros") or [])[:3],
        "top_cons": (cross.get("cons") or [])[:3] or (staff_high.get("cons") or [])[:3],
        "per_platform": {},
    }
    if isinstance(per_platform, dict):
        for platform_name, platform_data in list(per_platform.items())[:4]:
            if not isinstance(platform_data, dict):
                continue
            out["per_platform"][platform_name] = {
                "rating": platform_data.get("rating"),
                "count": platform_data.get("count"),
                "themes": (platform_data.get("themes") or [])[:3],
            }
    return out


def shape_competitor_intelligence(enrichment: Mapping[str, Any]) -> Dict[str, Any]:
    """Extract the competitor intelligence sub-block.

    R2D shape: `competitive_intelligence.detailed_competitors` with
    per-competitor mini-overview (organic keywords, traffic, paid keywords).
    Falls back to `semrush_competitors` / `competitor_swot` / `competitors`.
    """
    ci = enrichment.get("competitive_intelligence") if isinstance(enrichment.get("competitive_intelligence"), dict) else {}
    detailed = ci.get("detailed_competitors") or enrichment.get("semrush_competitors") or []
    legacy_swot = enrichment.get("competitor_swot") if isinstance(enrichment.get("competitor_swot"), list) else []
    flat_names = enrichment.get("competitors") if isinstance(enrichment.get("competitors"), list) else []

    rows: List[Dict[str, Any]] = []
    for row in (detailed or [])[:10]:
        if not isinstance(row, dict):
            continue
        rows.append({
            "name": row.get("domain") or row.get("name"),
            "organic_keywords": row.get("Or") or row.get("organic_keywords"),
            "organic_traffic": row.get("Ot") or row.get("organic_traffic"),
            "common_keywords": row.get("Oc") or row.get("common_keywords"),
            "paid_keywords": row.get("Ad") or row.get("paid_keywords"),
        })
    if not rows:
        # Build from legacy snapshots (R2A pre-D shape).
        for snap in legacy_swot[:5]:
            if not isinstance(snap, dict):
                continue
            rows.append({
                "name": snap.get("name"),
                "strengths": (snap.get("strengths") or [])[:2],
                "threat_level": snap.get("threat_level"),
            })
    if not rows:
        # Last-resort: flat name list.
        for name in (flat_names or [])[:5]:
            if isinstance(name, str) and name.strip():
                rows.append({"name": name.strip()})

    return {
        "competitors": rows,
        "competitor_count_total": len(detailed or flat_names or []),
    }


def shape_advertising_intelligence(enrichment: Mapping[str, Any]) -> Dict[str, Any]:
    """Extract paid-media + ad history sub-block (R2D `advertising_intelligence`)."""
    ad = enrichment.get("advertising_intelligence") if isinstance(enrichment.get("advertising_intelligence"), dict) else {}
    paid = enrichment.get("paid_media_analysis") if isinstance(enrichment.get("paid_media_analysis"), dict) else {}
    return {
        "paid_keywords": paid.get("adwords_keywords"),
        "paid_traffic": paid.get("adwords_traffic"),
        "paid_cost_usd": paid.get("adwords_cost_usd"),
        "ad_history_recent": _trim_dict_list(
            ad.get("ad_history_12m") or [],
            max_rows=4,
            keep_keys=("date", "ad_keywords_count", "ads_budget", "traffic"),
        ),
        "top_paid_keywords": _trim_dict_list(
            paid.get("top_paid_keywords") or [],
            max_rows=5,
            keep_keys=("keyword", "position", "search_volume", "cpc"),
        ),
    }


def shape_backlink_intelligence(enrichment: Mapping[str, Any]) -> Dict[str, Any]:
    """Extract backlink / authority sub-block (R2D `backlink_intelligence`)."""
    bl = enrichment.get("backlink_intelligence") if isinstance(enrichment.get("backlink_intelligence"), dict) else {}
    legacy_bl = enrichment.get("backlink_profile") if isinstance(enrichment.get("backlink_profile"), dict) else {}
    return {
        "total_backlinks": bl.get("total_backlinks") or legacy_bl.get("total_backlinks"),
        "referring_domains": bl.get("referring_domains") or legacy_bl.get("referring_domains"),
        "follow_ratio": bl.get("follow_ratio"),
        "toxic_backlinks_pct": bl.get("toxic_backlinks_pct"),
        "authority_score": legacy_bl.get("authority_score"),
    }


def collect_available_trace_ids(enrichment: Mapping[str, Any]) -> List[str]:
    """Walk the enrichment for trace_ids attached to any intelligence row.

    The E2 enrichment_traces system tags each piece of enrichment with a
    trace_id. This helper collects the set of trace_ids the LLM is allowed
    to cite. The caller passes this list into the prompt so the LLM cannot
    invent trace_ids.
    """
    found: List[str] = []
    seen = set()

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ("trace_id", "trace_ids", "source_trace_ids"):
                    if isinstance(v, str) and v not in seen:
                        seen.add(v)
                        found.append(v)
                    elif isinstance(v, list):
                        for t in v:
                            if isinstance(t, str) and t not in seen:
                                seen.add(t)
                                found.append(t)
                elif isinstance(v, (dict, list)):
                    _walk(v)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    _walk(enrichment)
    # Cap to keep prompt size bounded; if we end up with thousands of traces
    # the LLM doesn't need them all in-prompt — it only needs enough to cite.
    return found[:50]


def collect_available_competitor_names(enrichment: Mapping[str, Any]) -> List[str]:
    """Names the LLM may cite by-name in SWOT/Roadmap items.

    Drawn from `competitive_intelligence.detailed_competitors`,
    `semrush_competitors`, `competitor_swot`, and `competitors`.
    """
    out: List[str] = []
    seen = set()

    def _add(name: Any) -> None:
        if not isinstance(name, str):
            return
        clean = name.strip()
        if not clean or clean.lower() in seen:
            return
        seen.add(clean.lower())
        out.append(clean)

    ci = enrichment.get("competitive_intelligence") if isinstance(enrichment.get("competitive_intelligence"), dict) else {}
    for row in (ci.get("detailed_competitors") or []):
        if isinstance(row, dict):
            _add(row.get("domain") or row.get("name"))
    for row in (enrichment.get("semrush_competitors") or []):
        if isinstance(row, dict):
            _add(row.get("domain") or row.get("name"))
    for snap in (enrichment.get("competitor_swot") or []):
        if isinstance(snap, dict):
            _add(snap.get("name"))
    for name in (enrichment.get("competitors") or []):
        _add(name)
    return out[:25]


def collect_available_brand_metric_names(enrichment: Mapping[str, Any]) -> List[str]:
    """Brand-metric names the LLM may cite in roadmap items.

    Surfaces metric names like 'organic_traffic', 'authority_score',
    'sentiment_distribution.positive_pct', 'employer_brand_health_score',
    'follow_ratio'. The LLM is told it may reference these by name in roadmap
    items as evidence pointers (filter_roadmap_items_with_provenance accepts
    a metric-name match as provenance).
    """
    return [
        "organic_traffic",
        "organic_keywords",
        "monthly_organic_traffic",
        "weighted_avg_rating",
        "weighted_overall_rating",
        "employer_brand_health_score",
        "sentiment_distribution.positive_pct",
        "sentiment_distribution.negative_pct",
        "authority_score",
        "follow_ratio",
        "toxic_backlinks_pct",
        "ad_history_12m",
        "paid_keywords",
        "paid_traffic",
        "paid_cost_usd",
        "total_backlinks",
        "referring_domains",
    ]


# ─── Section prompt builders ──────────────────────────────────────────────
#
# Each `build_*_prompt` returns a (system, user) tuple suitable for direct
# pass to llm_chat / llm_trinity_chat / llm_trinity_synthesis. The
# user-message includes the STRUCTURED INPUT JSON block + an OUTPUT
# CONTRACT JSON schema + the anti-template denylist + good-vs-bad examples.


_SUPPLIER_TOKENS_TO_SCRUB: tuple = (
    "semrush", "openai", "anthropic", "perplexity", "firecrawl",
    "browse.ai", "browse-ai", "merge.dev", "supabase", "claude-3",
    "claude-4", "gpt-4", "gpt-5", "serper",
)


def _scrub_supplier_tokens(text: str) -> str:
    """Strip supplier names from a string before it is shown to the LLM.

    Defence in depth: even though the enrichment pipeline is supposed to
    sanitise supplier names out of customer-facing fields, an upstream
    annotation (e.g. `"source": "semrush"`) can still leak through into
    the structured input. This pass replaces those tokens with a generic
    "data-supplier" placeholder so the LLM never sees the name.
    """
    if not isinstance(text, str) or not text:
        return text
    out = text
    for tok in _SUPPLIER_TOKENS_TO_SCRUB:
        # Case-insensitive whole-token replace; keep simple to avoid
        # catastrophic regex on long JSON dumps.
        lowered = out.lower()
        idx = 0
        while True:
            pos = lowered.find(tok, idx)
            if pos == -1:
                break
            out = out[:pos] + "data-supplier" + out[pos + len(tok):]
            lowered = out.lower()
            idx = pos + len("data-supplier")
    return out


def _structured_input_block(payload: Mapping[str, Any]) -> str:
    """Render a STRUCTURED INPUT block that the LLM must read first.

    The payload JSON is post-processed to scrub supplier names — defence
    in depth in case an upstream annotation leaks one through.
    """
    json_blob = json.dumps(payload, default=str, indent=2)[:12000]
    json_blob = _scrub_supplier_tokens(json_blob)
    return (
        "## SCAN DATA INPUTS (this is the only data you may cite)\n\n"
        f"```json\n{json_blob}\n```\n"
    )


def _output_contract_block(schema_description: str) -> str:
    """Render an OUTPUT CONTRACT block describing the JSON shape required."""
    return (
        "## OUTPUT CONTRACT (return JSON only — no prose, no markdown fences)\n\n"
        f"{schema_description}\n"
    )


def _examples_block(good: str, bad: str) -> str:
    """Render a worked GOOD / BAD example block to guide the LLM."""
    return (
        "## EXAMPLES\n\n"
        f"GOOD: {good}\n"
        f"BAD: {bad}\n"
        "(GOOD cites a specific signal from the structured input. "
        "BAD is a generic Marketing-101 phrase that applies to any business.)\n"
    )


def build_chief_marketing_summary_prompt(
    *,
    business_name: str,
    enrichment: Mapping[str, Any],
    available_trace_ids: Optional[List[str]] = None,
) -> Tuple[str, str]:
    """Build the system+user prompt pair for the Chief Marketing Summary.

    Output: a single 80-150 word paragraph that cites at least 3 specific
    signals from the scan (e.g. brand-authority rank, review count, top
    keyword, employer-brand health score). The paragraph reads like an
    analyst's briefing, not Marketing-101 platitude.
    """
    keyword_profile = shape_keyword_profile(enrichment)
    review_intel = shape_review_intelligence(enrichment)
    workplace_intel = shape_workplace_intelligence(enrichment)
    competitor_intel = shape_competitor_intelligence(enrichment)
    backlink_intel = shape_backlink_intelligence(enrichment)
    trace_ids = available_trace_ids or collect_available_trace_ids(enrichment)

    structured_input = {
        "business_name": business_name,
        "industry": enrichment.get("industry"),
        "keyword_profile": keyword_profile,
        "review_intelligence": review_intel,
        "workplace_intelligence": workplace_intel,
        "competitor_intelligence": competitor_intel,
        "backlink_intelligence": backlink_intel,
        "available_trace_ids": trace_ids,
    }

    system = (
        f"{_BIQC_BRAND_LINE}\n\n"
        "Your job: write a Chief Marketing Summary paragraph for the CMO Report. "
        "Read the STRUCTURED INPUT block carefully. Write 80-150 words that cite "
        "AT LEAST 3 specific signals from this scan. Write like an analyst, not a "
        "marketer. Lead with the strongest verified fact.\n\n"
        f"{_NEVER_LEAK_RULE}\n\n"
        f"{_NUMBERS_OVER_ADJECTIVES_RULE}\n\n"
        f"{_PROVENANCE_RULE}"
    )

    user = (
        f"Business: {business_name}\n\n"
        + _structured_input_block(structured_input)
        + "\n"
        + _output_contract_block(
            'Return JSON: `{"summary": "<80-150 word paragraph>", '
            '"source_trace_ids": ["..."], '
            '"signals_cited": [{"signal": "...", "value": "..."}]}`. '
            "`signals_cited` must list at least 3 distinct signals you used "
            "from the structured input. `summary` must mention each of those "
            "signals in plain English."
        )
        + "\n"
        + _examples_block(
            good=(
                f"\"{business_name} ranks {keyword_profile.get('total_organic_keywords') or 'N/A'} organic "
                f"keywords against an estimated {keyword_profile.get('monthly_organic_traffic') or 'N/A'} monthly visits, "
                f"with {review_intel.get('total_review_count') or 'N/A'} customer reviews averaging "
                f"{review_intel.get('weighted_avg_rating') or 'N/A'}/5 across "
                f"{len((review_intel.get('per_platform') or {}))} platforms. The dominant theme is "
                f'\"{(review_intel.get("top_themes") or ["N/A"])[0]}\".\"'
            ),
            bad=(
                f"\"{business_name} has a strong brand and good customer reviews. "
                "We recommend continuing to leverage social media and engaging "
                "with customers to build awareness.\""
            ),
        )
        + "\n"
        + _format_anti_template_block()
    )
    return system, user


def build_executive_summary_prompt(
    *,
    business_name: str,
    enrichment: Mapping[str, Any],
    available_trace_ids: Optional[List[str]] = None,
) -> Tuple[str, str]:
    """Build the prompt for the Executive Summary (5 fact-bullets).

    Output: 5 bullets, each ONE FACT tied to a specific data point with
    provenance. Numbers are real numbers, not adjectives. Each bullet
    formatted as: `{fact}. (Source: {dataset name})`.
    """
    keyword_profile = shape_keyword_profile(enrichment)
    review_intel = shape_review_intelligence(enrichment)
    workplace_intel = shape_workplace_intelligence(enrichment)
    competitor_intel = shape_competitor_intelligence(enrichment)
    advertising_intel = shape_advertising_intelligence(enrichment)
    backlink_intel = shape_backlink_intelligence(enrichment)
    trace_ids = available_trace_ids or collect_available_trace_ids(enrichment)

    structured_input = {
        "business_name": business_name,
        "industry": enrichment.get("industry"),
        "keyword_profile": keyword_profile,
        "review_intelligence": review_intel,
        "workplace_intelligence": workplace_intel,
        "competitor_intelligence": competitor_intel,
        "advertising_intelligence": advertising_intel,
        "backlink_intelligence": backlink_intel,
        "available_trace_ids": trace_ids,
    }

    system = (
        f"{_BIQC_BRAND_LINE}\n\n"
        "Your job: write 5 executive-summary bullets for the CMO Report. "
        "Each bullet is ONE FACT with a real number from the STRUCTURED INPUT, "
        "tagged with the dataset name in parentheses at the end. Adjectives "
        "without numbers are not facts.\n\n"
        f"{_NEVER_LEAK_RULE}\n\n"
        f"{_NUMBERS_OVER_ADJECTIVES_RULE}\n\n"
        f"{_PROVENANCE_RULE}"
    )

    user = (
        f"Business: {business_name}\n\n"
        + _structured_input_block(structured_input)
        + "\n"
        + _output_contract_block(
            'Return JSON: `{"bullets": [{"text": "<one fact + dataset tag>", '
            '"source_trace_ids": ["..."], "dataset": "<name>", '
            '"metric_value": "<number>"}]}`. Exactly 5 bullets. Each bullet text '
            "ends with `(Source: <dataset name>)`. `dataset` is one of: "
            '"keyword_profile", "review_intelligence", "workplace_intelligence", '
            '"competitor_intelligence", "advertising_intelligence", "backlink_intelligence". '
            "If you cannot produce 5 evidence-backed bullets from the input, return "
            "fewer rather than padding with generic content."
        )
        + "\n"
        + _examples_block(
            good=(
                'Tracks 1,247 organic keywords with an estimated 3,200 monthly '
                'visits — top page is /services with 18% of organic traffic. '
                "(Source: keyword_profile)"
            ),
            bad=(
                "Has a strong online presence and good SEO performance. "
                "(Source: SEO)"
            ),
        )
        + "\n"
        + _format_anti_template_block()
    )
    return system, user


def build_swot_prompt(
    *,
    business_name: str,
    enrichment: Mapping[str, Any],
    available_trace_ids: Optional[List[str]] = None,
) -> Tuple[str, str]:
    """Build the SWOT synthesis prompt.

    Output: 3-4 items per bucket (S/W/O/T), each item tied to ONE of:
      - a specific keyword you rank for (Strengths) or rank poorly for (Weaknesses)
      - a specific review theme (positive=Strengths, negative=Weaknesses)
      - a specific competitor (Opportunities=where you can outflank, Threats=where they outflank)
      - a specific staff review theme (Opportunities=culture differentiator, Threats=churn risk)

    section_evidence.filter_swot_items_with_provenance() will drop any item
    that lacks a provenance pointer. The prompt instructs the LLM to ALWAYS
    include `source_trace_ids` per item.
    """
    keyword_profile = shape_keyword_profile(enrichment)
    review_intel = shape_review_intelligence(enrichment)
    workplace_intel = shape_workplace_intelligence(enrichment)
    competitor_intel = shape_competitor_intelligence(enrichment)
    backlink_intel = shape_backlink_intelligence(enrichment)
    advertising_intel = shape_advertising_intelligence(enrichment)
    trace_ids = available_trace_ids or collect_available_trace_ids(enrichment)
    competitor_names = collect_available_competitor_names(enrichment)

    structured_input = {
        "business_name": business_name,
        "industry": enrichment.get("industry"),
        "keyword_profile": keyword_profile,
        "review_intelligence": review_intel,
        "workplace_intelligence": workplace_intel,
        "competitor_intelligence": competitor_intel,
        "backlink_intelligence": backlink_intel,
        "advertising_intelligence": advertising_intel,
        "available_trace_ids": trace_ids,
        "competitor_names_you_may_cite": competitor_names,
    }

    system = (
        f"{_BIQC_BRAND_LINE}\n\n"
        "Your job: produce evidence-backed SWOT items for the CMO Report. "
        "Each item must reference at least ONE specific signal from the "
        "STRUCTURED INPUT — a keyword string, a review theme, a competitor "
        "name (only from `competitor_names_you_may_cite`), a staff-review "
        "theme, or a numeric metric. Items that do not cite a real signal "
        "will be REJECTED downstream and silently dropped. If a bucket has no "
        "evidence, return an empty list — do not pad.\n\n"
        "Heuristics for what fits each bucket:\n"
        "  - Strength: a metric / keyword / theme / capability where THIS "
        "    business outperforms the typical baseline.\n"
        "  - Weakness: a metric / keyword / theme where THIS business "
        "    underperforms or is missing data.\n"
        "  - Opportunity: a competitor weakness, staff-culture differentiator, "
        "    or under-served keyword cluster you can capture.\n"
        "  - Threat: a competitor advantage, customer-churn risk, or staff "
        "    retention risk that could erode the business.\n\n"
        f"{_NEVER_LEAK_RULE}\n\n"
        f"{_NUMBERS_OVER_ADJECTIVES_RULE}\n\n"
        f"{_PROVENANCE_RULE}"
    )

    user = (
        f"Business: {business_name}\n\n"
        + _structured_input_block(structured_input)
        + "\n"
        + _output_contract_block(
            'Return JSON: `{"strengths": [...], "weaknesses": [...], '
            '"opportunities": [...], "threats": [...]}` where each item is '
            '`{"text": "<signal-cited statement>", "source_trace_ids": ["..."], '
            '"evidence_tag": "<one of: keyword|review_theme|competitor|staff_theme|metric>", '
            '"signal_cited": "<the exact value from input>"}`. 3-4 items per bucket maximum. '
            "If a bucket has zero evidence, return an empty list for that bucket."
        )
        + "\n"
        + _examples_block(
            good=(
                'Strength: "Ranks #3 for keyword \'roofing repair Sydney\' '
                "(search_volume 2,400/mo, ~22% of organic traffic) — strong "
                'buyer-intent foothold." source_trace_ids=["kw_trace_42"], '
                'evidence_tag="keyword", signal_cited="roofing repair Sydney"'
            ),
            bad=(
                'Strength: "Strong online presence and good SEO" — generic, no '
                "signal cited, will be rejected."
            ),
        )
        + "\n"
        + _format_anti_template_block()
    )
    return system, user


def build_strategic_roadmap_prompt(
    *,
    business_name: str,
    enrichment: Mapping[str, Any],
    available_trace_ids: Optional[List[str]] = None,
) -> Tuple[str, str]:
    """Build the Strategic Roadmap prompt (7-day / 30-day / 90-day).

    Output: 3+ items per horizon, each citing a specific finding from this
    scan — NOT a generic playbook item. Each item must reference at least one
    of: a top page URL, a keyword, a review theme, a competitor name, a
    metric name. section_evidence.filter_roadmap_items_with_provenance()
    drops items without provenance.
    """
    keyword_profile = shape_keyword_profile(enrichment)
    review_intel = shape_review_intelligence(enrichment)
    workplace_intel = shape_workplace_intelligence(enrichment)
    competitor_intel = shape_competitor_intelligence(enrichment)
    backlink_intel = shape_backlink_intelligence(enrichment)
    advertising_intel = shape_advertising_intelligence(enrichment)
    trace_ids = available_trace_ids or collect_available_trace_ids(enrichment)
    competitor_names = collect_available_competitor_names(enrichment)
    metric_names = collect_available_brand_metric_names(enrichment)

    structured_input = {
        "business_name": business_name,
        "industry": enrichment.get("industry"),
        "keyword_profile": keyword_profile,
        "review_intelligence": review_intel,
        "workplace_intelligence": workplace_intel,
        "competitor_intelligence": competitor_intel,
        "backlink_intelligence": backlink_intel,
        "advertising_intelligence": advertising_intel,
        "available_trace_ids": trace_ids,
        "competitor_names_you_may_cite": competitor_names,
        "metric_names_you_may_cite": metric_names,
    }

    system = (
        f"{_BIQC_BRAND_LINE}\n\n"
        "Your job: produce an evidence-backed Strategic Roadmap for the CMO "
        "Report — three horizons: 7-day Quick Wins, 30-day Priorities, "
        "90-day Strategic Goals. Each item MUST cite a specific finding "
        "from the STRUCTURED INPUT — a keyword + rank, a top-page URL, a "
        "competitor name (from the allowed list), a review theme, or a "
        "named metric. Generic playbook items (e.g. 'optimise your SEO') "
        "will be REJECTED downstream and silently dropped.\n\n"
        "Item shape by horizon:\n"
        "  - 7-day Quick Wins (tactical, in-week): page-level fixes, "
        "    review-response actions, single-keyword optimisations, "
        "    landing-page copy updates.\n"
        "  - 30-day Priorities (medium-horizon): keyword cluster build-outs, "
        "    review-velocity drives, paid-media reallocations, content "
        "    series launches tied to specific competitor gaps.\n"
        "  - 90-day Strategic Goals (strategic): competitive-positioning "
        "    plays, employer-brand initiatives tied to staff-review themes, "
        "    backlink-authority campaigns, expansion-keyword plays.\n\n"
        f"{_NEVER_LEAK_RULE}\n\n"
        f"{_NUMBERS_OVER_ADJECTIVES_RULE}\n\n"
        f"{_PROVENANCE_RULE}"
    )

    user = (
        f"Business: {business_name}\n\n"
        + _structured_input_block(structured_input)
        + "\n"
        + _output_contract_block(
            'Return JSON: `{"quick_wins": [...], "priorities": [...], '
            '"strategic": [...]}` where each item is `{"text": "<action with '
            'signal cited>", "source_trace_ids": ["..."], "evidence_tag": '
            '"<keyword|review_theme|competitor|staff_theme|metric|page>", '
            '"priority": "critical|high|medium", "confidence": <0.0-1.0>}`. '
            "3-5 items per horizon maximum. Empty list if no evidence."
        )
        + "\n"
        + _examples_block(
            good=(
                '7-day quick win: "Optimise /services page (currently 18% of '
                "organic traffic, top organic page) for keyword 'commercial "
                "roofing repair' (search_volume 1,800, currently rank 47 — gap "
                "vs competitor xyz.com.au at rank 4).\" source_trace_ids="
                '["kw_trace_42", "page_trace_3"], evidence_tag="keyword", '
                'priority="critical", confidence=0.85'
            ),
            bad=(
                '7-day quick win: "Improve SEO and create a content calendar." '
                "— generic playbook item, no signal cited, will be rejected."
            ),
        )
        + "\n"
        + _format_anti_template_block()
    )
    return system, user


def build_competitive_landscape_prompt(
    *,
    business_name: str,
    enrichment: Mapping[str, Any],
    available_trace_ids: Optional[List[str]] = None,
) -> Tuple[str, str]:
    """Build the Competitive Landscape prompt.

    Output: 5-10 detailed competitor rows. Each: name, traffic share, ad
    spend, social presence, review counts (where available), specific
    keywords where they outrank you. Comparative positioning.
    """
    keyword_profile = shape_keyword_profile(enrichment)
    competitor_intel = shape_competitor_intelligence(enrichment)
    advertising_intel = shape_advertising_intelligence(enrichment)
    backlink_intel = shape_backlink_intelligence(enrichment)
    trace_ids = available_trace_ids or collect_available_trace_ids(enrichment)

    structured_input = {
        "business_name": business_name,
        "industry": enrichment.get("industry"),
        "your_keyword_profile": keyword_profile,
        "your_advertising_profile": advertising_intel,
        "your_backlink_profile": backlink_intel,
        "competitor_intelligence": competitor_intel,
        "available_trace_ids": trace_ids,
    }

    system = (
        f"{_BIQC_BRAND_LINE}\n\n"
        "Your job: produce a detailed Competitive Landscape table for the "
        "CMO Report. Up to 10 competitor rows, ranked by overall threat "
        "level. For each competitor, surface only the metrics you have data "
        "for — never fabricate a number you don't see in the input. Comparative "
        "positioning: where they outrank, where you outrank, headline-level "
        "differentiators.\n\n"
        f"{_NEVER_LEAK_RULE}\n\n"
        f"{_NUMBERS_OVER_ADJECTIVES_RULE}\n\n"
        f"{_PROVENANCE_RULE}"
    )

    user = (
        f"Business: {business_name}\n\n"
        + _structured_input_block(structured_input)
        + "\n"
        + _output_contract_block(
            'Return JSON: `{"competitors": [{"name": "...", '
            '"organic_keywords": <int|null>, "organic_traffic": <int|null>, '
            '"common_keywords_with_you": <int|null>, "paid_keywords": <int|null>, '
            '"threat_level": "high|medium|low", "comparative_positioning": '
            '"<one-sentence diagnosis>", "where_they_outrank_you": '
            '["<keyword|topic>"], "source_trace_ids": ["..."]}]}`. '
            "Up to 10 competitors. Sort by threat_level desc."
        )
        + "\n"
        + _examples_block(
            good=(
                '"name": "competitorx.com.au", "organic_keywords": 8400, '
                '"organic_traffic": 22000, "common_keywords_with_you": 124, '
                '"threat_level": "high", "comparative_positioning": "Outranks '
                "you on 124 shared commercial-intent keywords with ~7x your "
                'monthly organic traffic.", "where_they_outrank_you": '
                '["commercial roofing", "industrial roofing"]'
            ),
            bad=(
                '"name": "competitorx.com.au", "comparative_positioning": '
                '"A strong competitor in the market." — no metrics, no '
                "signal cited."
            ),
        )
        + "\n"
        + _format_anti_template_block()
    )
    return system, user


def build_review_intelligence_prompt(
    *,
    business_name: str,
    enrichment: Mapping[str, Any],
    available_trace_ids: Optional[List[str]] = None,
) -> Tuple[str, str]:
    """Build the Customer-Sentiment + Review-Intelligence + Workplace-Intelligence prompt.

    Output: theme analysis with sentiment per theme, per-platform breakdown,
    employer-brand health score, top 3 pros and top 3 cons with example
    quotes (when available). Numbers, not adjectives.
    """
    review_intel = shape_review_intelligence(enrichment)
    workplace_intel = shape_workplace_intelligence(enrichment)
    trace_ids = available_trace_ids or collect_available_trace_ids(enrichment)

    structured_input = {
        "business_name": business_name,
        "industry": enrichment.get("industry"),
        "review_intelligence": review_intel,
        "workplace_intelligence": workplace_intel,
        "available_trace_ids": trace_ids,
    }

    system = (
        f"{_BIQC_BRAND_LINE}\n\n"
        "Your job: synthesise Customer Sentiment + Review Intelligence + "
        "Workplace Intelligence for the CMO Report. Output is structured "
        "JSON. Cite real numbers and real theme phrases — never write "
        "'positive' or 'negative' as a standalone descriptor without the "
        "underlying mention count and percentage. When example quotes are "
        "available in `recent_reviews`, include them verbatim (truncated "
        "to 140 chars).\n\n"
        f"{_NEVER_LEAK_RULE}\n\n"
        f"{_NUMBERS_OVER_ADJECTIVES_RULE}\n\n"
        f"{_PROVENANCE_RULE}"
    )

    user = (
        f"Business: {business_name}\n\n"
        + _structured_input_block(structured_input)
        + "\n"
        + _output_contract_block(
            'Return JSON: `{"customer_sentiment": {"weighted_avg_rating": <num>, '
            '"total_reviews": <int>, "per_platform": [{"platform": "...", '
            '"rating": <num>, "count": <int>}], "top_themes": [{"theme": "...", '
            '"mentions": <int>, "sentiment_pct": <num>, "example_quote": "..."}]}, '
            '"workplace_intelligence": {"employer_brand_health_score": <num>, '
            '"weighted_overall_rating": <num>, "trend": "...", '
            '"top_pros": [{"theme": "...", "example_quote": "..."}], '
            '"top_cons": [{"theme": "...", "example_quote": "..."}]}, '
            '"source_trace_ids": ["..."]}`. '
            "Omit any sub-field for which the input has no data. Empty arrays "
            "are fine."
        )
        + "\n"
        + _examples_block(
            good=(
                '"top_themes": [{"theme": "fast service", "mentions": 23, '
                '"sentiment_pct": 87, "example_quote": "Got my repair done in '
                '2 days."}]'
            ),
            bad=(
                '"top_themes": [{"theme": "service", "sentiment": "positive"}] '
                "— no count, no percentage, no quote."
            ),
        )
        + "\n"
        + _format_anti_template_block()
    )
    return system, user


# ─── Master synthesis entry point ─────────────────────────────────────────

CMO_SECTION_BUILDERS: Dict[str, Any] = {
    "chief_marketing_summary": build_chief_marketing_summary_prompt,
    "executive_summary": build_executive_summary_prompt,
    "swot": build_swot_prompt,
    "strategic_roadmap": build_strategic_roadmap_prompt,
    "competitive_landscape": build_competitive_landscape_prompt,
    "review_intelligence": build_review_intelligence_prompt,
}


def build_section_prompt(
    section_id: str,
    *,
    business_name: str,
    enrichment: Mapping[str, Any],
    available_trace_ids: Optional[List[str]] = None,
) -> Tuple[str, str]:
    """Public entry point for one-section prompt construction.

    Raises KeyError on unknown section_id so callers can never silently
    pick the wrong builder.
    """
    builder = CMO_SECTION_BUILDERS.get(section_id)
    if builder is None:
        raise KeyError(
            f"Unknown CMO synthesis section: {section_id!r}. "
            f"Allowed: {sorted(CMO_SECTION_BUILDERS.keys())}"
        )
    return builder(
        business_name=business_name,
        enrichment=enrichment,
        available_trace_ids=available_trace_ids,
    )


# ─── Helpers for callers (response-shaping) ───────────────────────────────


import re as _re

# Compiled regexes mirroring section_evidence.PLACEHOLDER_PHRASE_PATTERNS so
# this module is self-contained (R2E ships before E6 lands or alongside it,
# and either way must reject the same Marketing-101 phrases). When E6's
# section_evidence module is present in the same deploy, callers may use
# either module's filter — they enforce the same contract.

_SP_DENY_PHRASE_PATTERNS: tuple = (
    _re.compile(r"improve.{1,30}social media presence", _re.IGNORECASE),
    _re.compile(r"increase.{1,30}brand awareness", _re.IGNORECASE),
    _re.compile(r"(create|develop|build|design).{1,30}content calendar", _re.IGNORECASE),
    _re.compile(r"leverage.{1,30}social media", _re.IGNORECASE),
    _re.compile(r"engage with.{1,30}customers", _re.IGNORECASE),
    _re.compile(r"(build|grow).{1,30}email list", _re.IGNORECASE),
    _re.compile(r"expand.{1,30}market presence", _re.IGNORECASE),
    _re.compile(r"(optimi[sz]e|improve).{0,30}seo", _re.IGNORECASE),
    _re.compile(r"focus on.{1,30}customer service", _re.IGNORECASE),
    _re.compile(r"differentiate.{1,30}from competitors", _re.IGNORECASE),
    _re.compile(r"(strengthen|build).{1,30}brand", _re.IGNORECASE),
    _re.compile(r"build.{1,30}customer loyalty", _re.IGNORECASE),
    _re.compile(r"create.{1,30}high-quality content", _re.IGNORECASE),
    _re.compile(r"run.{1,30}targeted ad campaigns", _re.IGNORECASE),
    _re.compile(r"invest in.{1,30}digital marketing", _re.IGNORECASE),
    _re.compile(r"embrace.{1,30}digital transformation", _re.IGNORECASE),
    _re.compile(r"foster.{1,30}customer engagement", _re.IGNORECASE),
    _re.compile(r"focus on.{1,30}lead generation", _re.IGNORECASE),
    _re.compile(r"build.{1,30}strong online community", _re.IGNORECASE),
    _re.compile(r"optimi[sz]e.{1,30}customer journey", _re.IGNORECASE),
    _re.compile(r"enhance.{1,30}user experience", _re.IGNORECASE),
    _re.compile(r"track.{1,30}key performance indicators", _re.IGNORECASE),
    _re.compile(r"improve.{1,30}online presence", _re.IGNORECASE),
    _re.compile(r"implement.{1,30}crm", _re.IGNORECASE),
)

_SP_DENY_EXACT: frozenset = frozenset({
    "tbd", "coming soon", "various", "strong", "weak", "positive",
    "negative", "average", "n/a", "todo", "placeholder",
})


def is_anti_template_phrase(value: Any) -> bool:
    """True if `value` matches the anti-template denylist (R2E-side filter).

    Equivalent to section_evidence.is_placeholder_string but lives in
    synthesis_prompts so this module is self-contained. When section_evidence
    is also present, callers may use either — both enforce the same contract.
    """
    if not isinstance(value, str):
        return False
    text = value.strip()
    if not text:
        return False
    if text.lower().rstrip(".!?") in _SP_DENY_EXACT:
        return True
    for pattern in _SP_DENY_PHRASE_PATTERNS:
        if pattern.search(text):
            return True
    return False


def filter_synthesis_swot_with_provenance(
    items: Iterable[Any],
    *,
    available_trace_ids: Iterable[str] = (),
    available_competitor_names: Iterable[str] = (),
) -> List[Dict[str, Any]]:
    """Drop SWOT items that lack provenance OR match the anti-template denylist.

    Mirrors section_evidence.filter_swot_items_with_provenance so R2E-only
    deploys still enforce the contract. Each item in the input may be either
    a string (interpreted as text-only) or a dict with `text` /
    `source_trace_ids` / `evidence_tag`. Returns a normalised list of dicts
    with `text` / `source_trace_ids` / `evidence_tag`.
    """
    trace_set = {str(t) for t in available_trace_ids if t}
    comp_set_lower = {str(c).lower() for c in available_competitor_names if c}
    out: List[Dict[str, Any]] = []
    for raw in items or []:
        if isinstance(raw, str):
            text = raw.strip()
            item_traces: List[str] = []
            evidence_tag: Optional[str] = None
        elif isinstance(raw, dict):
            text = str(raw.get("text") or "").strip()
            item_traces_raw = raw.get("source_trace_ids") or raw.get("trace_ids") or []
            item_traces = [str(t) for t in item_traces_raw if t]
            evidence_tag = raw.get("evidence_tag")
        else:
            continue
        if not text or is_anti_template_phrase(text):
            continue
        has_trace = any(t in trace_set for t in item_traces) or bool(item_traces)
        has_comp_mention = any(c and c in text.lower() for c in comp_set_lower)
        has_evidence_tag = bool(evidence_tag)
        if not (has_trace or has_comp_mention or has_evidence_tag):
            continue
        out.append({
            "text": text,
            "source_trace_ids": item_traces,
            "evidence_tag": evidence_tag,
        })
    return out


def filter_synthesis_roadmap_with_provenance(
    items: Iterable[Any],
    *,
    available_trace_ids: Iterable[str] = (),
    available_competitor_names: Iterable[str] = (),
    available_brand_metric_names: Iterable[str] = (),
) -> List[Dict[str, Any]]:
    """Drop roadmap items that lack provenance OR match the denylist.

    Mirrors section_evidence.filter_roadmap_items_with_provenance.
    """
    trace_set = {str(t) for t in available_trace_ids if t}
    comp_set_lower = {str(c).lower() for c in available_competitor_names if c}
    metric_set_lower = {str(m).lower() for m in available_brand_metric_names if m}
    out: List[Dict[str, Any]] = []
    for raw in items or []:
        if isinstance(raw, str):
            text = raw.strip()
            priority = "medium"
            evidence_tag: Optional[str] = None
            item_traces: List[str] = []
            confidence: Optional[float] = None
        elif isinstance(raw, dict):
            text = str(raw.get("text") or "").strip()
            priority = str(raw.get("priority") or "medium").lower()
            evidence_tag = raw.get("evidence_tag")
            traces_raw = raw.get("source_trace_ids") or raw.get("trace_ids") or []
            item_traces = [str(t) for t in traces_raw if t]
            try:
                confidence = float(raw.get("confidence")) if raw.get("confidence") is not None else None
            except (TypeError, ValueError):
                confidence = None
        else:
            continue
        if not text or is_anti_template_phrase(text):
            continue
        has_trace = any(t in trace_set for t in item_traces) or bool(item_traces)
        has_comp_mention = any(c and c in text.lower() for c in comp_set_lower)
        has_metric_mention = any(m and m in text.lower() for m in metric_set_lower)
        has_evidence_tag = bool(evidence_tag)
        if not (has_trace or has_comp_mention or has_metric_mention or has_evidence_tag):
            continue
        out.append({
            "text": text,
            "priority": priority if priority in {"critical", "high", "medium", "low"} else "medium",
            "evidence_tag": evidence_tag,
            "source_trace_ids": item_traces,
            "confidence": confidence,
        })
    return out


def parse_synthesis_json(raw: str) -> Optional[Dict[str, Any]]:
    """Parse the LLM's JSON output, tolerating minor formatting drift.

    Returns None when the output is not parseable as JSON. Callers should
    treat a None return as INSUFFICIENT_SIGNAL (the LLM produced
    unstructured prose instead of the contract'd JSON).
    """
    if not raw:
        return None
    text = raw.strip()
    # Strip common code-fence wrappers the LLM sometimes emits despite
    # the OUTPUT CONTRACT instruction.
    if text.startswith("```"):
        # Drop the opening fence (and language label, e.g. ```json).
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        # Drop the trailing fence.
        if text.endswith("```"):
            text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError, ValueError):
        # Try to find the largest JSON object in the text.
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except (json.JSONDecodeError, TypeError, ValueError):
                return None
        return None


def has_sufficient_synthesis_inputs(enrichment: Mapping[str, Any]) -> bool:
    """True when enrichment has enough deepened data to warrant LLM synthesis.

    The R2E synthesis prompts are designed to USE deep R2A-D + F14/F15
    data. When the scan only produced thin baseline data (e.g. just a
    business name and a 1-page crawl), the prompts will produce thin
    output too. The caller uses this gate to decide whether to invoke
    the trinity LLM (cost-bearing) or to flip the section to
    INSUFFICIENT_SIGNAL.

    Heuristic threshold: at least one of the deepened blocks has real data:
      - keyword_profile.top_organic_keywords with >= 3 rows
      - review_intelligence.total_review_count > 0
      - workplace_intelligence.employer_brand_health_score is not None
      - competitor_intelligence.competitors with >= 2 rows
    """
    kp = shape_keyword_profile(enrichment)
    if isinstance(kp.get("top_organic_keywords"), list) and len(kp["top_organic_keywords"]) >= 3:
        return True
    ri = shape_review_intelligence(enrichment)
    if ri.get("total_review_count") and int(ri["total_review_count"] or 0) > 0:
        return True
    wp = shape_workplace_intelligence(enrichment)
    if wp.get("employer_brand_health_score") is not None:
        return True
    ci = shape_competitor_intelligence(enrichment)
    comps = ci.get("competitors") or []
    if isinstance(comps, list) and len(comps) >= 2:
        return True
    return False
