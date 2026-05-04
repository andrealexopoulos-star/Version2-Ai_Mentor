import importlib
import asyncio
import sys
import types
from pathlib import Path

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, data):
        self._data = data

    def select(self, _cols):
        return self

    def eq(self, _col, _val):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return _Result(self._data)


class _SB:
    def __init__(self, tier):
        self.tier = tier

    def table(self, _name):
        return _Query({"subscription_tier": self.tier})


@pytest.fixture
def reports_module(monkeypatch):
    auth_stub = types.ModuleType("routes.auth")
    auth_stub.get_current_user = lambda: {"id": "stub-user"}
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    sanitizer_stub = types.ModuleType("core.response_sanitizer")
    sanitizer_stub.sanitize_enrichment_for_external = lambda payload: payload
    monkeypatch.setitem(sys.modules, "core.response_sanitizer", sanitizer_stub)

    supabase_stub = types.ModuleType("supabase_client")
    supabase_stub.get_supabase_client = lambda: _SB("starter")
    monkeypatch.setitem(sys.modules, "supabase_client", supabase_stub)

    intelligence_stub = types.ModuleType("routes.intelligence_modules")
    async def _default_report(_user):
        return {}
    intelligence_stub.get_cmo_report = _default_report
    monkeypatch.setitem(sys.modules, "routes.intelligence_modules", intelligence_stub)

    if "routes.reports" in sys.modules:
        del sys.modules["routes.reports"]
    return importlib.import_module("routes.reports")


def test_cmo_pdf_rejects_unentitled_tier(monkeypatch, reports_module):
    sys.modules["supabase_client"].get_supabase_client = lambda: _SB("starter")

    async def _fake_report(_user):
        return {"company_name": "Example"}

    sys.modules["routes.intelligence_modules"].get_cmo_report = _fake_report

    with pytest.raises(HTTPException) as exc:
        asyncio.run(reports_module.generate_cmo_report_pdf({"id": "user-1"}))
    assert exc.value.status_code == 403


def test_cmo_pdf_allows_pro_tier(monkeypatch, reports_module):
    sys.modules["supabase_client"].get_supabase_client = lambda: _SB("pro")

    class _FakePDF:
        def set_auto_page_break(self, **_kwargs):
            return None

        def add_page(self):
            return None

        def set_font(self, *_args, **_kwargs):
            return None

        def cell(self, *_args, **_kwargs):
            return None

        def ln(self, *_args, **_kwargs):
            return None

        def multi_cell(self, *_args, **_kwargs):
            return None

        def output(self):
            return b"%PDF-1.4\n%fake\n"

        # Methods used by the new state-aware CMO PDF builder. The
        # entitlement test only cares that the call returns a 200 — these
        # are no-op shims so the tier check still gets exercised end-to-end.
        def set_text_color(self, *_args, **_kwargs):
            return None

        def set_y(self, *_args, **_kwargs):
            return None

        def set_x(self, *_args, **_kwargs):
            return None

        def page_no(self):
            return 1

        l_margin = 10

    monkeypatch.setattr(reports_module, "_get_safe_pdf_class", lambda: _FakePDF)

    async def _fake_report(_user):
        return {
            "company_name": "Example Co",
            "report_date": "01/01/2026",
            "confidence": "high",
            "executive_summary": "Summary",
            "market_position": {"overall": 72, "brand": 70, "digital": 76, "sentiment": 68},
            "swot": {"strengths": ["A"], "weaknesses": ["B"], "opportunities": ["C"], "threats": ["D"]},
            "roadmap": {"quick_wins": ["Q"], "priorities": ["P"], "strategic": ["S"]},
        }

    sys.modules["routes.intelligence_modules"].get_cmo_report = _fake_report

    response = asyncio.run(reports_module.generate_cmo_report_pdf({"id": "user-1"}))
    assert response.status_code == 200
    assert response.media_type == "application/pdf"
