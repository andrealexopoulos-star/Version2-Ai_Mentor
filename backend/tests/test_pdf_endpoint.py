"""End-to-end tests for the CMO PDF endpoint (P0 marjo-E7 2026-05-04).

Each test renders the actual fpdf2-backed PDF using a stubbed Supabase +
canonical CMO payload, then introspects the resulting bytes with pypdf.
This is the load-bearing safety net: the prior 500 was caused by an fpdf2
cursor bug that no mock-based test would catch — we have to render real
bytes and read them back.

The tests are intentionally explicit about Andreas's must-pass criteria:

  * test_pdf_returns_200_for_valid_scan
  * test_pdf_content_type_correct
  * test_pdf_byte_size_min_10kb
  * test_pdf_contains_business_name_in_first_page
  * test_pdf_no_placeholder_strings
  * test_pdf_no_supplier_names_leaked          (Contract v2)
  * test_pdf_sections_all_present
"""

from __future__ import annotations

import asyncio
import importlib
import io
import re
import sys
import types
from pathlib import Path
from typing import Any, Dict, List

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Test scaffolding ────────────────────────────────────────────────────


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, data):
        self._data = data

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return _Result(self._data)


class _SB:
    """Minimal Supabase stub. Only `users` is hit by the PDF route — the
    rest of the data comes from the stubbed `get_cmo_report`."""

    def __init__(self, tier="pro"):
        self.tier = tier

    def table(self, name):
        if name == "users":
            return _Query({"subscription_tier": self.tier})
        return _Query({})


def _canonical_cmo_payload(business_name: str = "Acme Marketing Co",
                           generated_at: str = "2026-05-01T03:30:00Z",
                           include_swot: bool = True,
                           include_roadmap: bool = True,
                           include_competitors: bool = True,
                           state: str = "DATA_AVAILABLE") -> Dict[str, Any]:
    """Return a payload shaped like `GET /api/intelligence/cmo-report`.
    This is the single source of truth — the PDF route consumes this dict.

    Every field below maps to a real key emitted by `get_cmo_report` in
    intelligence_modules.py."""
    payload: Dict[str, Any] = {
        "company_name": business_name,
        "report_date": "01/05/2026",
        "generated_at": generated_at,
        "executive_summary": (
            f"{business_name} holds a defensible mid-market position with "
            "above-average brand recall and improving organic search reach. "
            "Recommended focus: paid retargeting and APAC market expansion."
        ),
        "market_position": {
            "overall": 72, "brand": 70, "digital": 76,
            "sentiment": 68, "competitive": 60,
        },
        "competitors": (
            [
                {"name": "Beta Co", "market_share": "22%", "threat_level": "high"},
                {"name": "Gamma Ltd", "market_share": "11%", "threat_level": "medium"},
            ] if include_competitors else []
        ),
        "swot": (
            {
                "strengths": ["Recognised brand authority", "Top-3 organic ranking on key terms"],
                "weaknesses": ["Limited paid media spend", "No structured ABM motion"],
                "opportunities": ["Expand into APAC markets", "Launch lifecycle email programme"],
                "threats": ["New entrant gaining share", "Rising paid search CPC in core market"],
            } if include_swot else {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []}
        ),
        "roadmap": (
            {
                "quick_wins": [{"text": "Refresh landing page hero copy"}],
                "priorities": [{"text": "Launch retargeting campaign on paid social"}],
                "strategic": [{"text": "Build brand equity through earned media programme"}],
            } if include_roadmap else {"quick_wins": [], "priorities": [], "strategic": []}
        ),
        "reviews": {
            "rating": 4.4, "count": 120, "positive_pct": 80,
            "neutral_pct": 12, "negative_pct": 8,
        },
        "review_themes": {
            "positive": ["Fast onboarding", "Helpful support team"],
            "negative": ["Pricing too high"],
        },
        "review_excerpts": [],
        "geographic": {"established": ["AU"], "growth": ["NZ", "UK"]},
        "confidence": 78,
        "report_id": "CMO-20260501-deadbeef",
        "report_state": "complete",
        "state": state,
        "section_inventory": {
            "Chief Marketing Summary": {"status": "DATA_AVAILABLE"},
            "Executive Summary": {"status": "DATA_AVAILABLE"},
            "Market Position Score": {"status": "DATA_AVAILABLE"},
            "Competitive Landscape": {"status": "DATA_AVAILABLE"},
            "SWOT": {"status": "DATA_AVAILABLE"},
            "Review Intelligence": {"status": "DATA_AVAILABLE"},
            "Strategic Roadmap": {"status": "DATA_AVAILABLE"},
        },
    }
    return payload


def _five_business_payloads() -> List[Dict[str, Any]]:
    """Five distinct business scenarios for parametrised verification.
    Andreas's acceptance: PDF must work for 5 distinct test URLs."""
    return [
        _canonical_cmo_payload(
            business_name="Sydney Smile Dental",
            generated_at="2026-05-01T01:00:00Z",
        ),
        _canonical_cmo_payload(
            business_name="Melbourne Mobile Mechanics",
            generated_at="2026-05-02T22:00:00Z",
        ),
        _canonical_cmo_payload(
            business_name="Brisbane Brews Coffee Roasters",
            generated_at="2026-05-03T08:15:00Z",
            include_competitors=False,
        ),
        _canonical_cmo_payload(
            business_name="Perth Pet Hospital",
            generated_at="2026-05-04T03:30:00Z",
            include_swot=True,
            include_roadmap=False,
        ),
        _canonical_cmo_payload(
            business_name="Adelaide Architects Studio",
            generated_at="2026-05-04T14:45:00Z",
            state="DEGRADED",
        ),
    ]


@pytest.fixture
def reports_module(monkeypatch):
    """Build a clean reports-module instance with stubbed deps. Each test
    that uses this fixture gets a fresh `routes.reports` import bound to
    the stubs the test installed via `_install_report_stub` below."""

    auth_stub = types.ModuleType("routes.auth")
    auth_stub.get_current_user = lambda: {"id": "stub-user"}
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    supabase_stub = types.ModuleType("supabase_client")
    supabase_stub.get_supabase_client = lambda: _SB("pro")
    supabase_stub.init_supabase = lambda: _SB("pro")
    monkeypatch.setitem(sys.modules, "supabase_client", supabase_stub)

    intelligence_stub = types.ModuleType("routes.intelligence_modules")

    async def _default(_user):
        return _canonical_cmo_payload()

    intelligence_stub.get_cmo_report = _default
    monkeypatch.setitem(sys.modules, "routes.intelligence_modules", intelligence_stub)

    # Force a fresh module load so the reports module re-imports against
    # the stubs we just installed.
    if "routes.reports" in sys.modules:
        del sys.modules["routes.reports"]
    return importlib.import_module("routes.reports")


def _install_report_stub(payload: Dict[str, Any]) -> None:
    """Replace `get_cmo_report` with a coroutine returning `payload`."""

    async def _fake(_user):
        return payload

    sys.modules["routes.intelligence_modules"].get_cmo_report = _fake


def _generate_pdf_bytes(reports_module, payload: Dict[str, Any]) -> bytes:
    """Run the PDF route end-to-end and return the response body bytes."""
    _install_report_stub(payload)
    response = asyncio.run(
        reports_module.generate_cmo_report_pdf({"id": "deadbeef-dead-beef-dead-beefdeadbeef"})
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    return bytes(response.body)


def _extract_text(pdf_bytes: bytes) -> str:
    """Extract all text from the PDF using pypdf. Raises if the bytes
    aren't a valid PDF — that's a useful failure mode."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(pdf_bytes))
    out = []
    for page in reader.pages:
        out.append(page.extract_text() or "")
    return "\n".join(out)


# ─── Tests ───────────────────────────────────────────────────────────────


def test_pdf_returns_200_for_valid_scan(reports_module):
    """Smoke test: the endpoint must return 200 for an entitled user with
    a populated CMO payload. Prior to this fix, this returned 500 because
    fpdf2.multi_cell raised 'Not enough horizontal space' when called
    repeatedly without resetting cursor X."""
    response = asyncio.run(
        reports_module.generate_cmo_report_pdf({"id": "deadbeef-dead-beef-dead-beefdeadbeef"})
    )
    assert response.status_code == 200


def test_pdf_content_type_correct(reports_module):
    """Content-Type must be application/pdf so the browser renders it
    inline / saves it with the right extension."""
    response = asyncio.run(
        reports_module.generate_cmo_report_pdf({"id": "deadbeef-dead-beef-dead-beefdeadbeef"})
    )
    assert response.media_type == "application/pdf"
    # Also assert the Content-Disposition header points to .pdf
    cd = response.headers.get("content-disposition") or ""
    assert ".pdf" in cd


def test_pdf_byte_size_min_10kb(reports_module):
    """Andreas's hard floor: PDF body must be >= 10KB. Below this and the
    PDF is empty / placeholder and not a real intelligence report."""
    body = _generate_pdf_bytes(reports_module, _canonical_cmo_payload())
    assert len(body) >= 10_000, (
        f"PDF body is only {len(body)} bytes; the rendered report is "
        "too small to contain real content."
    )


def test_pdf_contains_business_name_in_first_page(reports_module):
    """The cover page must contain the business name. This is the
    fundamental personalisation check."""
    payload = _canonical_cmo_payload(business_name="Sydney Smile Dental")
    body = _generate_pdf_bytes(reports_module, payload)
    text = _extract_text(body)
    assert "Sydney Smile Dental" in text, (
        "Business name not found in PDF text — cover page personalisation broken."
    )
    # Brand mark assertion: per feedback_ask_biqc_brand_name memory, the
    # surface is "Ask BIQc" everywhere. Ban the older alternates.
    assert "Ask BIQc" in text
    for banned_brand in ("Soundboard", "Assistant", "Chat AI"):
        assert banned_brand not in text, (
            f"Banned brand alternative '{banned_brand}' found in PDF text."
        )


def test_pdf_no_placeholder_strings(reports_module):
    """A populated CMO report must NOT contain placeholder/skeleton text
    in DATA_AVAILABLE sections. Regex catches both the prior endpoint's
    'No data available.' string and Andreas's broader placeholder family."""
    body = _generate_pdf_bytes(reports_module, _canonical_cmo_payload())
    text = _extract_text(body)

    placeholder_patterns = [
        r"No data available\.",
        r"\[placeholder\]",
        r"Lorem ipsum",
        r"TODO",
        r"FIXME",
        r"undefined",
        r"\bNaN\b",
        r"\[object Object\]",
        r"null,\s*null",
    ]
    for pattern in placeholder_patterns:
        assert re.search(pattern, text) is None, (
            f"Placeholder pattern '{pattern}' found in DATA_AVAILABLE PDF text."
        )


def test_pdf_no_supplier_names_leaked(reports_module):
    """Contract v2: PDF text must not contain supplier names or internal
    error markers. We use the central banned-token list so the check stays
    in lockstep with the sanitiser."""
    # Inject supplier names into the payload to make sure the scrub layer
    # actually fires. If the scrub is broken, the supplier name leaks.
    payload = _canonical_cmo_payload()
    payload["executive_summary"] = (
        "Acme Marketing Co relies on SEMRUSH-derived organic data and "
        "OpenAI synthesis for strategic recommendations."
    )
    payload["swot"]["strengths"].append("Browse.ai-monitored review feed shows positive sentiment.")
    body = _generate_pdf_bytes(reports_module, payload)
    text = _extract_text(body)

    from core.response_sanitizer import BANNED_SUPPLIER_TOKENS, BANNED_INTERNAL_TOKENS
    for token in BANNED_SUPPLIER_TOKENS:
        # `Bearer` and `source` style tokens have legitimate occurrences in
        # natural language (e.g. "social-media source"). The supplier-token
        # list is the strict one for PDFs.
        assert token not in text, (
            f"Contract v2 violation: supplier token '{token}' appeared in PDF text."
        )
    # Internal tokens — also strict.
    for token in BANNED_INTERNAL_TOKENS:
        if token in ("Bearer", "source"):
            continue  # natural-language matches; covered by serializer scrub
        assert token not in text, (
            f"Contract v2 violation: internal token '{token}' appeared in PDF text."
        )


def test_pdf_sections_all_present(reports_module):
    """Each canonical section header must appear at least once in the
    extracted text. Regression guard for partial / broken layouts."""
    body = _generate_pdf_bytes(reports_module, _canonical_cmo_payload())
    text = _extract_text(body)

    expected_headers = [
        "Chief Marketing Summary",
        "Market Position Score",
        "Competitive Landscape",
        "SWOT - Strengths",
        "SWOT - Weaknesses",
        "SWOT - Opportunities",
        "SWOT - Threats",
        "Review Intelligence",
        "Strategic Roadmap - 7 Day Quick Wins",
        "Strategic Roadmap - 30 Day Priorities",
        "Strategic Roadmap - 90 Day Strategic",
    ]
    missing = [h for h in expected_headers if h not in text]
    assert not missing, f"PDF is missing section headers: {missing}"


@pytest.mark.parametrize("payload", _five_business_payloads())
def test_pdf_renders_for_five_distinct_scans(reports_module, payload):
    """Andreas's hard requirement: PDF must work for 5 distinct test URLs.
    Each business gets its own scan timestamp + scenario mix
    (with/without competitors, with/without roadmap, DEGRADED state, etc.)
    Every one must return 200, ≥10KB, contain its business name."""
    body = _generate_pdf_bytes(reports_module, payload)
    assert len(body) >= 10_000
    text = _extract_text(body)
    assert payload["company_name"] in text
    # Footer with report ID is on every page — proves auto-footer fired.
    assert payload["report_id"] in text
