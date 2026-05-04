"""
F16 — `_section_is_thin` anti-template + bare-string awareness tests.

Covers the merge-blocking RR2E HIGH gap:

  Legacy Marketing-101 template builders upstream of `_enrich_cmo_with_synthesis`
  fill SWOT / roadmap buckets with bare strings like "Improve social media
  presence" and "Strengthen brand". The pre-F16 thinness check counted
  those as content and so NEVER fired R2E synthesis — even though the
  buckets were full of fluff.

The 6 acceptance tests below verify F16 closes that gap WITHOUT
regressing the original behaviour for genuinely-empty payloads or
already-rich provenance-bearing payloads.

Test plan:

  1. test_section_with_legacy_marketing_101_strings_treated_thin
  2. test_section_with_anti_template_strings_only_treated_thin
  3. test_section_with_real_provenance_items_NOT_thin
  4. test_mixed_section_anti_template_dropped_real_kept_thin_calculation_correct
  5. test_empty_section_thin
  6. test_section_with_strings_but_real_content_handled
     (hard case — bare-string payload that has SPECIFIC content, not
     anti-template fluff. By the belt-and-braces rule it still counts
     as thin because R2E contract requires provenance, but the
     synthesis pass only ever uses the bare-string content as a hint —
     it never deletes it. We verify the thinness signal here and rely
     on the gap-fill `swot[bucket] = …` loop in `_enrich_cmo_with_synthesis`
     to keep the existing strings if synthesis fails.)

All tests are pure unit tests — no LLM round-trips, no Supabase, no
network. They invoke `_section_is_thin` directly through a thin module
shim that installs the same fastapi / supabase stubs the existing
`test_intelligence_modules_hardening.py` test file uses.

Cross-references:
  - feedback_no_cheating.md — provenance enforcement
  - BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2 — anti-template denylist
  - fix/p0-marjo-r2e-synthesis-prompts (R2E) — synthesis path this gate guards
"""

from __future__ import annotations

import sys
import types
from pathlib import Path


# Make backend/ importable as a top-level package (mirrors existing tests).
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


# ─── Module stubs (mirrors test_intelligence_modules_hardening.py) ──────────


class _HTTPException(Exception):
    def __init__(self, status_code: int = 500, detail: str = ""):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class _APIRouter:
    def _passthrough(self, *_args, **_kwargs):
        def _decorator(func):
            return func
        return _decorator

    get = _passthrough
    post = _passthrough
    put = _passthrough
    patch = _passthrough
    delete = _passthrough


class _Request:
    pass


def _install_module_stubs() -> None:
    if "fastapi" not in sys.modules:
        fastapi_stub = types.ModuleType("fastapi")
        fastapi_stub.APIRouter = _APIRouter
        fastapi_stub.Depends = lambda fn: fn
        fastapi_stub.HTTPException = _HTTPException
        fastapi_stub.Request = _Request
        # Header / Query / Body are minimal callables (used as default-
        # value markers in route signatures). They never run at import
        # time for the path under test.
        fastapi_stub.Header = lambda *_args, **_kwargs: None
        fastapi_stub.Query = lambda *_args, **_kwargs: None
        fastapi_stub.Body = lambda *_args, **_kwargs: None
        sys.modules["fastapi"] = fastapi_stub
    else:
        # If a real or partial fastapi shim already exists, ensure Header
        # is present (the existing hardening test stub may not include it).
        existing = sys.modules["fastapi"]
        if not hasattr(existing, "Header"):
            existing.Header = lambda *_args, **_kwargs: None

    if "fastapi.responses" not in sys.modules:
        responses_stub = types.ModuleType("fastapi.responses")

        class _JSONResponse:
            def __init__(self, status_code: int = 200, content=None):
                self.status_code = status_code
                self.content = content or {}

        class _Response:
            def __init__(
                self,
                content=None,
                status_code: int = 200,
                media_type: str = "application/octet-stream",
                headers=None,
                **_kw,
            ):
                self.content = content
                self.body = content if isinstance(content, (bytes, bytearray, str)) else b""
                self.status_code = status_code
                self.media_type = media_type
                self.headers = headers or {}

        responses_stub.JSONResponse = _JSONResponse
        # Sibling tests (e.g. test_cmo_pdf_entitlement → routes.reports)
        # import Response / PlainTextResponse / StreamingResponse from
        # fastapi.responses. Without these names, pytest collection of the
        # later test fails because Python caches the partial stub here.
        responses_stub.Response = _Response
        responses_stub.PlainTextResponse = _Response
        responses_stub.StreamingResponse = _Response
        responses_stub.HTMLResponse = _Response
        responses_stub.RedirectResponse = _Response
        sys.modules["fastapi.responses"] = responses_stub
    else:
        # If a sibling test installed a thinner shim earlier in the run,
        # backfill the names this run will need before any later import.
        existing_resp = sys.modules["fastapi.responses"]
        for _name in ("Response", "PlainTextResponse", "StreamingResponse",
                      "HTMLResponse", "RedirectResponse"):
            if not hasattr(existing_resp, _name):
                class _Response:  # noqa: D401, F811
                    def __init__(
                        self,
                        content=None,
                        status_code: int = 200,
                        media_type: str = "application/octet-stream",
                        headers=None,
                        **_kw,
                    ):
                        self.content = content
                        self.body = content if isinstance(content, (bytes, bytearray, str)) else b""
                        self.status_code = status_code
                        self.media_type = media_type
                        self.headers = headers or {}
                setattr(existing_resp, _name, _Response)

    if "supabase_client" not in sys.modules:
        sb_stub = types.ModuleType("supabase_client")
        sb_stub.init_supabase = lambda: object()
        sys.modules["supabase_client"] = sb_stub

    if "intelligence_spine" not in sys.modules:
        spine_stub = types.ModuleType("intelligence_spine")
        spine_stub.emit_spine_event = lambda **_kwargs: None
        spine_stub._get_cached_flag = lambda _flag: False
        spine_stub._get_spine_enabled = lambda: False
        spine_stub._get_spine_enabled_for_tenant = lambda _tenant_id: False
        spine_stub.log_llm_call = lambda **_kwargs: None
        spine_stub.log_model_execution = lambda **_kwargs: None

        class _SpineWriteError(Exception):
            pass

        spine_stub.SpineWriteError = _SpineWriteError
        sys.modules["intelligence_spine"] = spine_stub

    if "routes.auth" not in sys.modules:
        routes_auth_stub = types.ModuleType("routes.auth")
        routes_auth_stub.get_current_user = lambda: {"id": "stub-user"}
        router_cls = getattr(sys.modules.get("fastapi"), "APIRouter", _APIRouter)
        routes_auth_stub.router = router_cls()
        sys.modules["routes.auth"] = routes_auth_stub


_install_module_stubs()

import routes.intelligence_modules as intelligence_modules  # noqa: E402

_section_is_thin = intelligence_modules._section_is_thin


# ─── Tests ─────────────────────────────────────────────────────────────────


def test_section_with_legacy_marketing_101_strings_treated_thin():
    """A SWOT-shaped dict whose buckets contain ONLY legacy bare-string
    Marketing-101 phrases must be classified thin — so synthesis fires.

    This is the pre-F16 regression: the thinness check used to return
    False for any non-empty bucket; now anti-template strings are
    excluded from the count, AND a bucket containing only bare strings
    (rather than provenance dicts) is thin by the belt-and-braces rule.
    """
    swot = {
        "strengths": ["Strong brand", "Strong customer loyalty"],
        "weaknesses": ["Weak SEO", "Improve online presence"],
        "opportunities": [
            "Improve social media presence",
            "Increase brand awareness",
        ],
        "threats": ["Differentiate from competitors"],
    }
    assert _section_is_thin(swot, min_items=1) is True


def test_section_with_anti_template_strings_only_treated_thin():
    """A flat list whose every entry is an anti-template denylist match
    is thin (effective_count == 0)."""
    bullets = [
        "Improve social media presence",
        "Build customer loyalty",
        "Optimize customer journey",
        "Implement CRM",
    ]
    # Even though the list has 4 entries, none of them satisfy min_items.
    assert _section_is_thin(bullets, min_items=1) is True


def test_section_with_real_provenance_items_NOT_thin():
    """A SWOT-shaped dict with provenance-bearing dicts in at least 2
    buckets is NOT thin — synthesis must NOT overwrite this content."""
    enriched_swot = {
        "strengths": [
            {
                "text": (
                    "Brand authority rank 78/100 (kw_trace_42) with 1.2K "
                    "monthly organic visits — 35% above industry median."
                ),
                "source_trace_ids": ["kw_trace_42"],
                "evidence_tag": "keyword_intelligence",
            }
        ],
        "weaknesses": [
            {
                "text": (
                    "Mobile pagespeed 41/100 vs competitor median 78 "
                    "(perf_trace_11)."
                ),
                "source_trace_ids": ["perf_trace_11"],
                "evidence_tag": "performance_intelligence",
            }
        ],
        "opportunities": [],
        "threats": [],
    }
    # Two buckets have provenance dicts → effective_count >= 1 in those
    # buckets → at least one bucket is NOT thin → section is NOT thin.
    assert _section_is_thin(enriched_swot, min_items=1) is False


def test_mixed_section_anti_template_dropped_real_kept_thin_calculation_correct():
    """When a bucket has BOTH provenance dicts AND anti-template strings,
    the effective_count counts only the provenance dicts. With min_items=2
    and only 1 provenance dict + N anti-template strings, the bucket is
    still thin.

    Uses phrases that DEFINITELY match the denylist (verified via
    is_anti_template_phrase), to lock down the count math without being
    sensitive to denylist evolution.
    """
    # Sanity: verify our anti-template strings really are denied.
    from core.synthesis_prompts import is_anti_template_phrase
    assert is_anti_template_phrase("Improve social media presence") is True
    assert is_anti_template_phrase("Build customer loyalty") is True
    assert is_anti_template_phrase("Strengthen brand") is True
    assert is_anti_template_phrase("Improve online presence") is True

    swot = {
        "strengths": [
            "Strengthen brand",  # anti-template → 0
            "Improve social media presence",  # anti-template → 0
            {
                "text": "78/100 brand authority via kw_trace_42",
                "source_trace_ids": ["kw_trace_42"],
            },  # provenance dict → +1
        ],
        "weaknesses": [
            "Improve online presence",  # anti-template → 0
        ],
        "opportunities": [
            "Build customer loyalty",  # anti-template → 0
        ],
        "threats": [],
    }
    # min_items=2 → strengths effective_count == 1 → thin.
    # All other buckets are also thin → section is thin.
    assert _section_is_thin(swot, min_items=2) is True
    # min_items=1 → strengths has effective_count == 1 → NOT thin →
    # section overall is NOT thin (one bucket meets the threshold).
    assert _section_is_thin(swot, min_items=1) is False


def test_empty_section_thin():
    """A None / empty-string / empty-list / empty-dict is always thin."""
    assert _section_is_thin(None) is True
    assert _section_is_thin("") is True
    assert _section_is_thin("   ") is True
    assert _section_is_thin([]) is True
    assert _section_is_thin({}) is True
    # Empty SWOT-shape buckets:
    assert _section_is_thin({
        "strengths": [],
        "weaknesses": [],
        "opportunities": [],
        "threats": [],
    }) is True


def test_section_with_strings_but_real_content_handled():
    """A SWOT-shape dict whose buckets contain ONLY bare strings — even
    SPECIFIC, non-anti-template strings like the one below — is treated
    as THIN by the belt-and-braces rule.

    Rationale: the world-class R2E synthesis path always emits
    provenance-bearing dicts. The legacy Marketing-101 builders are the
    only callers that emit bare strings. Even if a bare string happens
    to be specific (because a developer hand-typed it or another legacy
    path emitted it), it lacks provenance and so cannot satisfy the
    R2E contract — synthesis SHOULD run to upgrade it. The
    `_enrich_cmo_with_synthesis` gap-fill loop only OVERWRITES a bucket
    if the existing list is empty, so the original bare strings are
    preserved when synthesis fails.

    This test pins the belt-and-braces behaviour so a future change
    cannot silently regress it.
    """
    swot = {
        "strengths": [
            "Brand authority rank 78/100 with 1.2K monthly visits — 35% "
            "above industry median"
        ],
        "weaknesses": [],
        "opportunities": [],
        "threats": [],
    }
    # Specific content but bare-string shape → thin by belt-and-braces.
    assert _section_is_thin(swot, min_items=1) is True

    # The same content as a provenance dict → NOT thin.
    swot_with_provenance = {
        "strengths": [
            {
                "text": (
                    "Brand authority rank 78/100 with 1.2K monthly visits — "
                    "35% above industry median"
                ),
                "source_trace_ids": ["kw_trace_42"],
            }
        ],
        "weaknesses": [],
        "opportunities": [],
        "threats": [],
    }
    assert _section_is_thin(swot_with_provenance, min_items=1) is False
