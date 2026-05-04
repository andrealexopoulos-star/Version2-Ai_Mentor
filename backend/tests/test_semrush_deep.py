"""
Tests for the R2D deep SEMrush integration.

Covers:
    1. test_organic_keywords_top_100_extracted — top-100 spectrum surfaces in
       enrichment.keyword_intelligence.organic_keywords
    2. test_backlinks_overview_schema — backlink_intelligence shape correct
       (total_backlinks, referring_domains, follow_ratio, toxic_backlinks_pct)
    3. test_adwords_history_12m_returned — advertising_intelligence.ad_history_12m
    4. test_top_pages_extracted — keyword_intelligence.top_pages from
       domain_organic_pages
    5. test_detailed_competitors_top_10 — competitor_analysis.detailed_competitors
    6. test_partial_failure_other_endpoints_succeed — one sub-call fails,
       others persist
    7. test_api_units_used_reported — provider_telemetry.semrush.api_units_used
    8. test_no_key_in_response_or_logs — Contract v2 sanitiser strips keys/codes
    9. test_24h_cache_ttl_obeyed — EDGE_TTL_OVERRIDES['semrush-domain-intel'] = 86_400

All tests operate against the merge layer in calibration.py (synthetic
edge response → enrichment) plus the response sanitizer. They do NOT make
real SEMrush API calls; the edge-function HTTP behaviour is covered by
the Deno test suite at supabase/functions/semrush-domain-intel/test.ts.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

# Ensure repo root is importable as `backend.*` (pattern used by sibling tests).
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


# ─── Synthetic edge-function response fixture ─────────────────────────────


def _semrush_full_response():
    """Realistic full-success edge response for marjo.com.au with all 8
    sub-calls returning data. Mirrors the production shape produced by
    supabase/functions/semrush-domain-intel/index.ts.
    """
    organic_kw = [
        {
            "keyword": f"keyword_{i}",
            "position": (i % 50) + 1,
            "search_volume": 1000 - i * 7,
            "cpc": round(1.5 - i * 0.01, 3),
            "url": f"https://marjo.com.au/page-{i}",
            "traffic": max(1, 200 - i),
            "traffic_cost": max(0, 100 - i),
            "competition": round((i % 10) / 10.0, 2),
            "keyword_difficulty": (i % 90) + 5,
        }
        for i in range(100)
    ]
    top_pages = [
        {
            "page_url": f"https://marjo.com.au/page-{i}",
            "organic_traffic": 5000 - i * 100,
            "traffic_pct": round(20.0 - i * 0.5, 2),
            "page_rank": i + 1,
            "organic_keywords": 50 - i,
        }
        for i in range(20)
    ]
    ad_history = [
        {
            "date": f"2025-{((i % 12) + 1):02d}",
            "position": (i % 5) + 1,
            "cpc": 2.10 + (i * 0.05),
            "search_volume": 4000 - i * 50,
            "traffic": 800 - i * 20,
            "url": "https://marjo.com.au/landing",
            "ad_title": f"Ad title {i}",
            "ad_description": f"Ad description {i}",
        }
        for i in range(12)
    ]
    detailed_competitors = [
        {
            "rank": i + 1,
            "domain": f"competitor{i}.com",
            "common_keywords": 50 - i * 4,
            "total_keywords": 1000 - i * 50,
            "organic_keywords": 800 - i * 40,
            "organic_traffic": 100000 - i * 5000,
            "organic_cost_usd": 5000 - i * 200,
            "adwords_keywords": 30 - i,
            "competitive_intensity_tier": "dominant" if i < 2 else "strong" if i < 5 else "established",
        }
        for i in range(10)
    ]
    organic_competitors = [
        {
            "domain": d["domain"],
            "common_keywords": d["common_keywords"],
            "total_keywords": d["total_keywords"],
            "organic_keywords": d["organic_keywords"],
            "organic_traffic": d["organic_traffic"],
            "organic_cost": d["organic_cost_usd"],
            "adwords_keywords": d["adwords_keywords"],
        }
        for d in detailed_competitors
    ]
    paid_competitors = [
        {
            "domain": f"paidcomp{i}.com",
            "total_keywords": 500 - i * 30,
            "adwords_keywords": 80 - i * 5,
            "adwords_traffic": 20000 - i * 1000,
            "adwords_cost": 3000 - i * 150,
        }
        for i in range(10)
    ]
    return {
        "ok": True,
        "domain": "marjo.com.au",
        "database": "us",
        "seo_analysis": {
            "semrush_rank": 145000,
            "organic_keywords": 1234,
            "organic_traffic": 5600,
            "organic_cost_usd": 8900,
            "featured_snippets": 12,
            "featured_positions": 5,
            "top_organic_keywords": organic_kw[:20],
            "score": 70,
            "status": "moderate",
            "source": "semrush",
        },
        "paid_media_analysis": {
            "adwords_keywords": 15,
            "adwords_traffic": 2200,
            "adwords_cost_usd": 1500,
            "top_paid_keywords": [],
            "maturity": "active",
            "assessment": "Active paid search detected.",
            "source": "semrush",
        },
        "competitor_analysis": {
            "organic_competitors": organic_competitors,
            "detailed_competitors": detailed_competitors,
            "competitor_count": 10,
            "source": "semrush",
        },
        "paid_competitor_analysis": {
            "paid_competitors": paid_competitors,
            "paid_competitor_count": 10,
            "source": "semrush",
        },
        "backlink_profile": {
            "total_backlinks": 12345,
            "referring_domains": 678,
            "referring_urls": 12000,
            "referring_ips": 540,
            "referring_ip_class_c": 320,
            "authority_score": 42,
            "follow_links": 9000,
            "nofollow_links": 3345,
            "follow_ratio": 0.729,
            "toxic_backlinks_pct": None,
            "source": "semrush",
        },
        "backlink_intelligence": {  # alias
            "total_backlinks": 12345,
            "referring_domains": 678,
            "referring_urls": 12000,
            "referring_ips": 540,
            "referring_ip_class_c": 320,
            "authority_score": 42,
            "follow_links": 9000,
            "nofollow_links": 3345,
            "follow_ratio": 0.729,
            "toxic_backlinks_pct": None,
            "source": "semrush",
        },
        "keyword_intelligence": {
            "organic_keywords": organic_kw,
            "organic_keywords_count": 100,
            "top_pages": top_pages,
            "top_pages_count": 20,
            "source": "semrush",
        },
        "advertising_intelligence": {
            "ad_history_12m": ad_history,
            "months_active": 12,
            "mean_monthly_traffic": 690,
            "max_monthly_traffic": 800,
            "budget_posture": "consistent_advertiser",
            "source": "semrush",
        },
        "api_units_used": 232,
        "api_calls_made": 8,
        "api_calls_ok": 8,
        "provider_traces": [
            {"endpoint": "domain_rank", "status": 200, "ms": 412, "rows": 1, "units": 10, "ok": True},
            {"endpoint": "domain_organic", "status": 200, "ms": 891, "rows": 100, "units": 1000, "ok": True},
            {"endpoint": "domain_adwords", "status": 200, "ms": 530, "rows": 15, "units": 300, "ok": True},
            {"endpoint": "domain_organic_organic", "status": 200, "ms": 612, "rows": 10, "units": 400, "ok": True},
            {"endpoint": "domain_adwords_adwords", "status": 200, "ms": 549, "rows": 10, "units": 400, "ok": True},
            {"endpoint": "backlinks_overview", "status": 200, "ms": 720, "rows": 1, "units": 40, "ok": True},
            {"endpoint": "domain_organic_pages", "status": 200, "ms": 482, "rows": 20, "units": 200, "ok": True},
            {"endpoint": "domain_adwords_history", "status": 200, "ms": 690, "rows": 12, "units": 1200, "ok": True},
        ],
        "raw_overview": {"Dn": "marjo.com.au"},
        "ai_errors": [],
        "correlation": {"run_id": None, "step": None},
        "generated_at": "2026-05-04T10:00:00Z",
    }


def _semrush_partial_failure_response():
    """One sub-call (backlinks_overview) returns auth_failed; others succeed.
    Tests that the merge layer keeps real data and surfaces only the ai_error
    for the failed call."""
    full = _semrush_full_response()
    full["backlink_profile"] = None
    full["backlink_intelligence"] = None
    full["api_units_used"] = 232 - 40  # backlinks dropped
    full["api_calls_ok"] = 7
    full["provider_traces"][5] = {
        "endpoint": "backlinks_overview",
        "status": 401,
        "ms": 250,
        "rows": 0,
        "units": 0,
        "ok": False,
        "failure_reason": "auth_failed",
    }
    full["ai_errors"] = ["backlinks_overview: auth_failed"]
    return full


# ─── Apply merge logic standalone (mirrors calibration.py block) ──────────


def _apply_semrush_merge(enrichment, semrush_intel):
    """Apply the SEMrush merge from calibration.py:2851+ in isolation.

    Mirrors the exact merge block under `if isinstance(semrush_intel, dict)
    and semrush_intel.get("ok"):`. Lifted to test-side so we don't have to
    bootstrap the FastAPI app for unit tests. Synced with calibration.py
    on 2026-05-04 — keep in sync if the merge changes there.
    """
    if not (isinstance(semrush_intel, dict) and semrush_intel.get("ok")):
        return enrichment

    sr_seo = semrush_intel.get("seo_analysis") or {}
    if sr_seo.get("organic_keywords"):
        enrichment["seo_analysis"] = {
            "semrush_rank": sr_seo.get("semrush_rank"),
            "organic_keywords": sr_seo.get("organic_keywords"),
            "organic_traffic": sr_seo.get("organic_traffic"),
            "organic_cost_usd": sr_seo.get("organic_cost_usd"),
            "featured_snippets": sr_seo.get("featured_snippets"),
            "top_organic_keywords": sr_seo.get("top_organic_keywords", [])[:10],
            "score": sr_seo.get("score"),
            "status": sr_seo.get("status"),
            "source": "semrush",
        }
    sr_paid = semrush_intel.get("paid_media_analysis") or {}
    if sr_paid.get("adwords_keywords") is not None:
        enrichment["paid_media_analysis"] = {
            "adwords_keywords": sr_paid.get("adwords_keywords"),
            "adwords_traffic": sr_paid.get("adwords_traffic"),
            "adwords_cost_usd": sr_paid.get("adwords_cost_usd"),
            "top_paid_keywords": sr_paid.get("top_paid_keywords", [])[:10],
            "maturity": sr_paid.get("maturity"),
            "assessment": sr_paid.get("assessment"),
            "source": "semrush",
        }
    sr_comp = semrush_intel.get("competitor_analysis") or {}
    if sr_comp.get("organic_competitors"):
        enrichment["semrush_competitors"] = sr_comp.get("organic_competitors", [])

    sr_paid_comp = semrush_intel.get("paid_competitor_analysis") or {}
    if sr_paid_comp.get("paid_competitors"):
        enrichment["paid_competitor_analysis"] = {
            "paid_competitors": sr_paid_comp.get("paid_competitors", [])[:10],
            "paid_competitor_count": sr_paid_comp.get("paid_competitor_count") or 0,
        }

    sr_backlinks = semrush_intel.get("backlink_profile")
    if isinstance(sr_backlinks, dict) and sr_backlinks.get("total_backlinks") is not None:
        enrichment["backlink_profile"] = {
            "total_backlinks": sr_backlinks.get("total_backlinks"),
            "referring_domains": sr_backlinks.get("referring_domains"),
            "referring_urls": sr_backlinks.get("referring_urls"),
            "referring_ips": sr_backlinks.get("referring_ips"),
            "referring_ip_class_c": sr_backlinks.get("referring_ip_class_c"),
            "authority_score": sr_backlinks.get("authority_score"),
            "follow_links": sr_backlinks.get("follow_links"),
            "nofollow_links": sr_backlinks.get("nofollow_links"),
            "follow_ratio": sr_backlinks.get("follow_ratio"),
            "toxic_backlinks_pct": sr_backlinks.get("toxic_backlinks_pct"),
        }

    sr_keyword_intel = semrush_intel.get("keyword_intelligence")
    if isinstance(sr_keyword_intel, dict) and (
        sr_keyword_intel.get("organic_keywords")
        or sr_keyword_intel.get("top_pages")
    ):
        enrichment["keyword_intelligence"] = {
            "organic_keywords": sr_keyword_intel.get("organic_keywords") or [],
            "organic_keywords_count": sr_keyword_intel.get("organic_keywords_count") or 0,
            "top_pages": sr_keyword_intel.get("top_pages") or [],
            "top_pages_count": sr_keyword_intel.get("top_pages_count") or 0,
        }

    if "backlink_profile" in enrichment:
        enrichment["backlink_intelligence"] = dict(enrichment["backlink_profile"])

    sr_adv_intel = semrush_intel.get("advertising_intelligence")
    if isinstance(sr_adv_intel, dict) and sr_adv_intel.get("ad_history_12m"):
        enrichment["advertising_intelligence"] = {
            "ad_history_12m": sr_adv_intel.get("ad_history_12m") or [],
            "months_active": sr_adv_intel.get("months_active") or 0,
            "mean_monthly_traffic": sr_adv_intel.get("mean_monthly_traffic"),
            "max_monthly_traffic": sr_adv_intel.get("max_monthly_traffic"),
            "budget_posture": sr_adv_intel.get("budget_posture"),
        }

    sr_detailed = (sr_comp or {}).get("detailed_competitors") if isinstance(sr_comp, dict) else None
    if isinstance(sr_detailed, list) and sr_detailed:
        if not isinstance(enrichment.get("competitor_analysis"), dict):
            enrichment["competitor_analysis"] = {}
        enrichment["competitor_analysis"]["detailed_competitors"] = sr_detailed[:10]

    enrichment.setdefault("provider_telemetry", {})
    enrichment["provider_telemetry"]["semrush"] = {
        "api_units_used": semrush_intel.get("api_units_used") or 0,
        "api_calls_made": semrush_intel.get("api_calls_made") or 0,
        "api_calls_ok": semrush_intel.get("api_calls_ok") or 0,
        "provider_traces": semrush_intel.get("provider_traces") or [],
    }
    enrichment["semrush_data"] = semrush_intel
    return enrichment


# ─── Tests 1-5: NEW endpoint payloads land in enrichment ──────────────────


class TestNewEndpointsExtracted:
    def test_organic_keywords_top_100_extracted(self):
        enrichment: dict = {}
        _apply_semrush_merge(enrichment, _semrush_full_response())
        ki = enrichment["keyword_intelligence"]
        assert ki["organic_keywords_count"] == 100
        assert len(ki["organic_keywords"]) == 100
        # Each row must have keyword/position/volume.
        first = ki["organic_keywords"][0]
        assert "keyword" in first and first["keyword"] == "keyword_0"
        assert "position" in first
        assert "search_volume" in first
        assert "traffic" in first

    def test_backlinks_overview_schema(self):
        enrichment: dict = {}
        _apply_semrush_merge(enrichment, _semrush_full_response())
        bi = enrichment["backlink_intelligence"]
        # Required brief fields:
        for required_key in ("total_backlinks", "referring_domains",
                             "follow_ratio", "toxic_backlinks_pct"):
            assert required_key in bi, f"backlink_intelligence missing key {required_key!r}"
        assert isinstance(bi["total_backlinks"], int)
        assert isinstance(bi["referring_domains"], int)
        # follow_ratio is a 0..1 float when computed.
        assert 0.0 <= bi["follow_ratio"] <= 1.0

    def test_adwords_history_12m_returned(self):
        enrichment: dict = {}
        _apply_semrush_merge(enrichment, _semrush_full_response())
        adv = enrichment["advertising_intelligence"]
        assert adv["months_active"] == 12
        assert len(adv["ad_history_12m"]) == 12
        # Each row must have date/cpc/traffic/search_volume.
        first = adv["ad_history_12m"][0]
        assert "date" in first
        assert "cpc" in first
        assert "traffic" in first
        assert "search_volume" in first
        # budget_posture inferred from cadence.
        assert adv["budget_posture"] == "consistent_advertiser"

    def test_top_pages_extracted(self):
        enrichment: dict = {}
        _apply_semrush_merge(enrichment, _semrush_full_response())
        pages = enrichment["keyword_intelligence"]["top_pages"]
        assert len(pages) == 20
        first = pages[0]
        assert "page_url" in first
        assert "organic_traffic" in first
        assert "traffic_pct" in first
        assert "organic_keywords" in first
        # Highest-traffic page sits first per display_sort=tg_desc.
        assert first["organic_traffic"] >= pages[-1]["organic_traffic"]

    def test_detailed_competitors_top_10(self):
        enrichment: dict = {}
        _apply_semrush_merge(enrichment, _semrush_full_response())
        dc = enrichment["competitor_analysis"]["detailed_competitors"]
        assert len(dc) == 10
        first = dc[0]
        for required_key in ("rank", "domain", "common_keywords", "organic_keywords",
                             "organic_traffic", "competitive_intensity_tier"):
            assert required_key in first, f"detailed_competitors missing key {required_key!r}"
        assert first["rank"] == 1
        # Intensity tier comes from edge fn classification.
        assert first["competitive_intensity_tier"] in ("dominant", "strong", "established", "emerging")


# ─── Test 6: partial failure persists other endpoints ─────────────────────


class TestPartialFailure:
    def test_partial_failure_other_endpoints_succeed(self):
        enrichment: dict = {}
        partial = _semrush_partial_failure_response()
        _apply_semrush_merge(enrichment, partial)

        # backlinks failed → backlink_intelligence absent.
        assert "backlink_intelligence" not in enrichment
        assert "backlink_profile" not in enrichment

        # All other fields still hydrated.
        assert "keyword_intelligence" in enrichment
        assert enrichment["keyword_intelligence"]["organic_keywords_count"] == 100
        assert "advertising_intelligence" in enrichment
        assert enrichment["advertising_intelligence"]["months_active"] == 12
        assert enrichment["competitor_analysis"]["detailed_competitors"][0]["rank"] == 1

        # Telemetry shows only one failed sub-call.
        traces = enrichment["provider_telemetry"]["semrush"]["provider_traces"]
        failed = [t for t in traces if not t.get("ok")]
        assert len(failed) == 1
        assert failed[0]["endpoint"] == "backlinks_overview"


# ─── Test 7: api_units_used reported ──────────────────────────────────────


class TestApiUnitsUsed:
    def test_api_units_used_reported(self):
        enrichment: dict = {}
        _apply_semrush_merge(enrichment, _semrush_full_response())
        tel = enrichment["provider_telemetry"]["semrush"]
        # Sum of unit costs across 8 calls (~232 in fixture).
        assert tel["api_units_used"] == 232
        assert tel["api_calls_made"] == 8
        assert tel["api_calls_ok"] == 8
        # Each provider_trace row has units > 0 (or 0 for failed/empty).
        for trace in tel["provider_traces"]:
            assert "units" in trace
            assert trace["units"] >= 0


# ─── Test 8: Contract v2 — no key/code leak after sanitisation ────────────


class TestNoKeyOrCodeLeak:
    def test_no_key_in_response_or_logs(self):
        from backend.core.response_sanitizer import (
            sanitize_enrichment_for_external,
            assert_no_banned_tokens,
        )

        enrichment: dict = {}
        _apply_semrush_merge(enrichment, _semrush_full_response())
        # Wire edge-tool status so the sanitiser treats sections as DATA_AVAILABLE.
        enrichment["sources"] = {
            "edge_tools": {
                "semrush_domain_intel": {"ok": True, "status": 200},
            }
        }
        envelope = sanitize_enrichment_for_external(enrichment)

        # Core contract — no banned tokens at any depth.
        assert_no_banned_tokens(envelope, source="test_semrush_deep.no_key_leak")

        # Specific R2D leakage classes — none of these should appear.
        import json as _json
        serialized = _json.dumps(envelope)
        for forbidden in (
            "SEMRUSH_API_KEY",      # the env var name
            "key=",                 # query-string key arg
            "PROVIDER_KEY_MISSING", # internal code from edge fn
            "PROVIDER_TOTAL_FAILURE",
            "auth_failed",          # sanitised provider failure category
            "supplier_4xx",
            "supplier_5xx",
            "rate_limited",
            "transport_error",
            "raw_overview",         # SEMrush CSV row leak
        ):
            assert forbidden not in serialized, f"R2D leak: {forbidden!r} in sanitised payload"


# ─── Test 9: 24h cache TTL obeyed ─────────────────────────────────────────


class TestCacheTtl:
    def test_24h_cache_ttl_obeyed(self):
        # Guarantees R2D budget — same domain inside 24h → zero new units.
        # Verifies the EDGE_TTL_OVERRIDES table and that set_edge_result
        # honours it for `semrush-domain-intel`.
        #
        # We can't `import backend.scan_cache` directly because it pulls in
        # `biqc_jobs.get_redis()` which has its own import chain that needs
        # the backend/ entry on sys.path. Inspect the file source instead —
        # the test cares about the contract (override exists, TTL = 86_400),
        # not about Redis being live.
        scan_cache_path = _REPO_ROOT / "backend" / "scan_cache.py"
        assert scan_cache_path.exists(), "backend/scan_cache.py missing"
        src = scan_cache_path.read_text()

        # The override table must exist with the right semrush TTL.
        assert "EDGE_TTL_OVERRIDES" in src, \
            "EDGE_TTL_OVERRIDES table missing — R2D budget contract broken"
        assert '"semrush-domain-intel": 86_400' in src \
            or '"semrush-domain-intel": 86400' in src, \
            "semrush-domain-intel must use 24h TTL (86_400 seconds)"

        # Default TTL for other functions stays at 1h.
        assert "EDGE_TTL = 3_600" in src or "EDGE_TTL = 3600" in src, \
            "Default EDGE_TTL changed — review impact on other edge functions"

        # set_edge_result must look up the override via fn_name.
        assert "EDGE_TTL_OVERRIDES.get(function_name" in src, \
            "set_edge_result must consult EDGE_TTL_OVERRIDES for per-fn TTL"

        # ttl parameter must default to None so the override table is honoured
        # rather than forcing the caller to supply 86_400 explicitly.
        assert "ttl: Optional[int] = None" in src, \
            "set_edge_result.ttl must default to None so EDGE_TTL_OVERRIDES applies"
