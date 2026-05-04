"""Report generation routes — PDF export with deterministic data only."""
import os
import json
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)
router = APIRouter()

# Auth dependency
from routes.auth import get_current_user

# Contract v2 / Step 3c: sanitize enrichment before PDF generation so
# customer-facing reports never embed supplier names, internal codes, or
# fabricated confident-but-empty scores.
from core.response_sanitizer import sanitize_enrichment_for_external

# Optional sanitizer helpers used by the share endpoints. Imported defensively
# so existing tests that monkey-patch `core.response_sanitizer` with a minimal
# stub (e.g. test_cmo_pdf_entitlement.py) keep working — the share path is
# the only consumer here and gracefully degrades to scrub-by-no-op + a
# permissive contract check when those helpers aren't available.
try:
    from core.response_sanitizer import (
        scrub_response_for_external,
        assert_no_banned_tokens,
        ExternalContractViolation,
    )
except ImportError:  # pragma: no cover — only hit by stub-owning tests
    def scrub_response_for_external(payload):  # type: ignore[no-redef]
        return payload

    class ExternalContractViolation(Exception):  # type: ignore[no-redef]
        pass

    def assert_no_banned_tokens(*_args, **_kwargs):  # type: ignore[no-redef]
        return None


# ── Unicode safety for fpdf2's latin-1 Helvetica ────────────────────────────
# 2026-04-21 demo bug: o3-generated enrichment contains curly quotes,
# em-dashes, ellipsis, and bullets. fpdf2's default Helvetica is latin-1
# only — any of those chars raises UnicodeEncodeError during pdf.output(),
# surfacing to the user as a generic "error" alert.
_LATIN1_REPLACEMENTS = {
    "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-",
    "\u2018": "'", "\u2019": "'", "\u201A": ",",
    "\u201C": '"', "\u201D": '"', "\u201E": '"',
    "\u2022": "*", "\u2026": "...",
    "\u00A0": " ", "\u200B": "", "\u2009": " ", "\u202F": " ",
    "\u2190": "<-", "\u2192": "->",
    "\u2713": "v", "\u2717": "x",
}


def _latin1_safe(value) -> str:
    """Strip/replace characters Helvetica can't render. Never raises."""
    if value is None:
        return ""
    s = str(value)
    for k, v in _LATIN1_REPLACEMENTS.items():
        s = s.replace(k, v)
    # Fallback: anything still outside latin-1 becomes '?'
    return s.encode("latin-1", "replace").decode("latin-1")


def _get_safe_pdf_class():
    """Build an FPDF subclass that auto-sanitizes every text-writing method."""
    from fpdf import FPDF

    class _SafePDF(FPDF):
        def cell(self, *args, **kwargs):
            args = list(args)
            # text is positional arg index 2 in fpdf2 (w, h, text, ...)
            if len(args) >= 3:
                args[2] = _latin1_safe(args[2])
            for key in ("text", "txt"):
                if key in kwargs:
                    kwargs[key] = _latin1_safe(kwargs[key])
            return super().cell(*args, **kwargs)

        def multi_cell(self, *args, **kwargs):
            args = list(args)
            # text is positional arg index 2 in fpdf2 (w, h, text, ...)
            if len(args) >= 3:
                args[2] = _latin1_safe(args[2])
            for key in ("text", "txt"):
                if key in kwargs:
                    kwargs[key] = _latin1_safe(kwargs[key])
            return super().multi_cell(*args, **kwargs)

        def write(self, *args, **kwargs):
            args = list(args)
            # text is positional arg index 1 in fpdf2 (h, text, ...)
            if len(args) >= 2:
                args[1] = _latin1_safe(args[1])
            for key in ("text", "txt"):
                if key in kwargs:
                    kwargs[key] = _latin1_safe(kwargs[key])
            return super().write(*args, **kwargs)

    return _SafePDF


class PDFRequest(BaseModel):
    integration_list: List[dict] = []
    events_count: int = 0
    avg_confidence: int = 0


@router.post("/reports/generate-pdf")
async def generate_pdf(req: PDFRequest, current_user: dict = Depends(get_current_user)):
    """Generate a deterministic intelligence report PDF.
    
    Rules:
    - Only includes data from verified integrations
    - No AI narrative filler
    - Explicit statement if integrations missing
    - Includes data snapshot and confidence summary
    """
    try:
        pdf = _get_safe_pdf_class()()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # Header
        pdf.set_font("Helvetica", "B", 18)
        pdf.cell(0, 12, "BIQc Intelligence Report", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(100, 100, 100)

        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        workspace_id = current_user.get("id", "unknown")

        pdf.cell(0, 6, f"Workspace: {workspace_id}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Generated: {generated_at}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Report Version: 1", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(8)

        # Data Source Summary
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "Data Source Summary", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)

        if not req.integration_list:
            pdf.set_text_color(180, 0, 0)
            pdf.cell(0, 6, "No verified integrations connected at generation time.", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(0, 0, 0)
        else:
            for integ in req.integration_list:
                itype = integ.get("type", "unknown")
                last_sync = integ.get("last_sync", "N/A")
                pdf.cell(0, 6, f"  - {itype.upper()}: Connected (Last sync: {last_sync or 'N/A'})", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(6)

        # Signal Section
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "Governance Events", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)

        if req.events_count == 0:
            pdf.cell(0, 6, "No governance events recorded.", new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.cell(0, 6, f"Total verified events: {req.events_count}", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(6)

        # Confidence Summary
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "Confidence Summary", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)

        if req.events_count > 0:
            pdf.cell(0, 6, f"Average confidence score: {req.avg_confidence}%", new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.cell(0, 6, "No confidence data available (no events).", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(6)

        # Appendix
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "Appendix: Data Snapshot", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(80, 80, 80)

        snapshot_data = {
            "workspace_id": workspace_id,
            "generated_at": generated_at,
            "integrations": req.integration_list,
            "events_count": req.events_count,
            "avg_confidence": req.avg_confidence,
        }
        snapshot_str = json.dumps(snapshot_data, indent=2)
        for line in snapshot_str.split("\n"):
            pdf.cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")

        # Save PDF
        os.makedirs("/tmp/reports", exist_ok=True)
        filename = f"biqc_report_{workspace_id[:8]}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"
        filepath = f"/tmp/reports/{filename}"
        pdf.output(filepath)

        # Store export record in Supabase
        try:
            from supabase_client import get_supabase_client
            sb = get_supabase_client()
            sb.table("report_exports").insert({
                "workspace_id": workspace_id,
                "report_type": "intelligence_report",
                "version": 1,
                "data_snapshot": snapshot_data,
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to store report export record: {e}")

        # Return the file path (in production, this would be a storage URL)
        backend_url = os.environ.get("BACKEND_URL", "")
        return {
            "status": "generated",
            "filename": filename,
            "pdf_url": f"{backend_url}/api/reports/download/{filename}",
            "data_snapshot": snapshot_data,
        }

    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library not available")
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/download/{filename}")
async def download_report(filename: str, current_user: dict = Depends(get_current_user)):
    """Serve a generated report PDF."""
    from fastapi.responses import FileResponse

    # Serve only deterministic filenames produced by this service and bound to
    # the requesting user's workspace prefix.
    safe_filename = os.path.basename(filename or "")
    if safe_filename != filename:
        raise HTTPException(status_code=400, detail="Invalid report filename")
    if ".." in safe_filename or "/" in safe_filename or "\\" in safe_filename:
        raise HTTPException(status_code=400, detail="Invalid report filename")
    if not re.fullmatch(r"biqc_report_[a-zA-Z0-9_]{1,30}_\d{8}_\d{6}\.pdf", safe_filename):
        raise HTTPException(status_code=404, detail="Report not found")

    workspace_prefix = f"biqc_report_{(current_user.get('id') or '')[:8]}_"
    if not safe_filename.startswith(workspace_prefix):
        raise HTTPException(status_code=403, detail="Forbidden report")

    base_dir = "/tmp/reports"
    filepath = os.path.realpath(os.path.join(base_dir, safe_filename))
    if not filepath.startswith(os.path.realpath(base_dir) + os.sep):
        raise HTTPException(status_code=400, detail="Invalid report filename")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report not found")

    return FileResponse(filepath, media_type="application/pdf", filename=safe_filename)


# ═══ EXECUTIVE PDF REPORTS — Market Position & Benchmark ═══

def _build_executive_pdf(title: str, business_name: str, enrichment: dict,
                         scan_date: str, sections: list) -> 'FPDF':
    """Build a formatted executive PDF report from enrichment data.

    Args:
        title: Report title (e.g. "Market & Position Report")
        business_name: Business name from enrichment
        enrichment: Full enrichment dict from business_dna_enrichment
        scan_date: ISO date string of when scan was performed
        sections: List of (section_title, content_fn) tuples
    Returns:
        FPDF instance ready for output()
    """
    pdf = _get_safe_pdf_class()()
    pdf.set_auto_page_break(auto=True, margin=15)

    # ── Cover page ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 24)
    pdf.ln(30)
    pdf.cell(0, 14, "BIQc", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, "Cognition as a Platform", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(20)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 8, business_name, new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(4)
    generated_at = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Generated: {generated_at}", new_x="LMARGIN", new_y="NEXT", align="C")
    if scan_date:
        pdf.cell(0, 6, f"Scan date: {scan_date}", new_x="LMARGIN", new_y="NEXT", align="C")

    # ── Content pages ──
    for section_title, content_fn in sections:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 10, section_title, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)
        content_fn(pdf, enrichment)

    return pdf


def _section_kpi_strip(pdf, enrichment):
    """Digital Footprint KPI strip."""
    fp = enrichment.get('digital_footprint', {})
    pdf.set_font("Helvetica", "", 10)
    metrics = [
        ('Overall Score', fp.get('score')),
        ('SEO Visibility', fp.get('seo_score')),
        ('Social Engagement', fp.get('social_score')),
        ('Content Authority', fp.get('content_score')),
    ]
    for label, value in metrics:
        display = f"{value}/100" if value is not None else "No data"
        pdf.cell(0, 7, f"  {label}: {display}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    conf = enrichment.get('confidence', 'N/A')
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f"Confidence level: {conf}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)


def _section_executive_summary(pdf, enrichment):
    """Executive summary section."""
    pdf.set_font("Helvetica", "", 10)
    summary = enrichment.get('executive_summary', '')
    if summary:
        pdf.multi_cell(0, 6, summary)
    else:
        pdf.cell(0, 6, "No executive summary available.", new_x="LMARGIN", new_y="NEXT")
    brief = enrichment.get('cmo_executive_brief', '')
    if brief:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "CMO Brief", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 6, brief)


def _section_swot(pdf, enrichment):
    """SWOT analysis section — 4 quadrants."""
    swot = enrichment.get('swot', {})
    pdf.set_font("Helvetica", "", 10)
    for quadrant, label in [
        ('strengths', 'Strengths'),
        ('weaknesses', 'Weaknesses'),
        ('opportunities', 'Opportunities'),
        ('threats', 'Threats'),
    ]:
        items = swot.get(quadrant, [])
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, label, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        if items:
            for item in items:
                text = item if len(item) <= 120 else item[:117] + '...'
                pdf.cell(0, 6, f"  - {text}", new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.cell(0, 6, "  No data", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)


def _section_cmo_actions(pdf, enrichment):
    """CMO Priority Actions section."""
    actions = enrichment.get('cmo_priority_actions', [])
    industry = enrichment.get('industry_action_items', [])
    pdf.set_font("Helvetica", "", 10)
    if actions:
        for i, action in enumerate(actions, 1):
            text = action if len(action) <= 120 else action[:117] + '...'
            pdf.cell(0, 7, f"  {i}. {text}", new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.cell(0, 6, "  No CMO actions available.", new_x="LMARGIN", new_y="NEXT")
    if industry:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Industry-Specific Actions", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        for i, action in enumerate(industry, 1):
            text = action if len(action) <= 120 else action[:117] + '...'
            pdf.cell(0, 7, f"  {i}. {text}", new_x="LMARGIN", new_y="NEXT")


def _section_market_position(pdf, enrichment):
    """Market position statement."""
    pos = enrichment.get('market_position', '')
    pdf.set_font("Helvetica", "", 10)
    if pos:
        pdf.multi_cell(0, 6, pos)
    else:
        pdf.cell(0, 6, "No market position data available.", new_x="LMARGIN", new_y="NEXT")


def _section_competitors(pdf, enrichment):
    """Competitor SWOT landscape."""
    comp_swot = enrichment.get('competitor_swot', [])
    pdf.set_font("Helvetica", "", 10)
    if not comp_swot:
        pdf.cell(0, 6, "No competitor data available.", new_x="LMARGIN", new_y="NEXT")
        return
    for comp in comp_swot[:5]:
        name = comp.get('name', 'Unknown')
        threat = comp.get('threat_level', 'unknown')
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, f"{name} (Threat: {threat})", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for s in comp.get('strengths', [])[:2]:
            text = s if len(s) <= 100 else s[:97] + '...'
            pdf.cell(0, 5, f"    + {text}", new_x="LMARGIN", new_y="NEXT")
        for w in comp.get('weaknesses', [])[:2]:
            text = w if len(w) <= 100 else w[:97] + '...'
            pdf.cell(0, 5, f"    - {text}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)


def _section_seo(pdf, enrichment):
    """SEO analysis section."""
    seo = enrichment.get('seo_analysis', {})
    pdf.set_font("Helvetica", "", 10)
    if not seo:
        pdf.cell(0, 6, "No SEO analysis data available.", new_x="LMARGIN", new_y="NEXT")
        return
    score = seo.get('score')
    status = seo.get('status', 'unknown')
    pdf.cell(0, 7, f"  Score: {score}/100 ({status})" if score else "  Score: N/A", new_x="LMARGIN", new_y="NEXT")
    strengths = seo.get('strengths', [])
    if strengths:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, "  Strengths:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for s in strengths:
            pdf.cell(0, 5, f"    + {s}", new_x="LMARGIN", new_y="NEXT")
    gaps = seo.get('gaps', [])
    if gaps:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, "  Gaps:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for g in gaps:
            pdf.cell(0, 5, f"    ! {g}", new_x="LMARGIN", new_y="NEXT")
    actions = seo.get('priority_actions', [])
    if actions:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, "  Priority Actions:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for i, a in enumerate(actions, 1):
            text = a if len(a) <= 100 else a[:97] + '...'
            pdf.cell(0, 5, f"    {i}. {text}", new_x="LMARGIN", new_y="NEXT")


def _section_social(pdf, enrichment):
    """Social media analysis section."""
    social = enrichment.get('social_media_analysis', {})
    pdf.set_font("Helvetica", "", 10)
    if not social:
        pdf.cell(0, 6, "No social media analysis data available.", new_x="LMARGIN", new_y="NEXT")
        return
    channels = social.get('active_channels', [])
    pdf.cell(0, 7, f"  Active channels ({social.get('channel_count', 0)}): {', '.join(channels)}", new_x="LMARGIN", new_y="NEXT")
    signals = social.get('content_signals_detected', [])
    if signals:
        pdf.cell(0, 7, f"  Content signals: {', '.join(signals)}", new_x="LMARGIN", new_y="NEXT")
    actions = social.get('priority_actions', [])
    if actions:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, "  Priority Actions:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for i, a in enumerate(actions, 1):
            text = a if len(a) <= 100 else a[:97] + '...'
            pdf.cell(0, 5, f"    {i}. {text}", new_x="LMARGIN", new_y="NEXT")


def _section_reviews(pdf, enrichment):
    """Review aggregation section."""
    reviews = enrichment.get('review_aggregation', {})
    pdf.set_font("Helvetica", "", 10)
    if not reviews or not reviews.get('has_data'):
        pdf.cell(0, 6, "No review data available.", new_x="LMARGIN", new_y="NEXT")
        return
    pdf.cell(0, 7, f"  Positive reviews: {reviews.get('positive_count', 0)}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, f"  Negative reviews: {reviews.get('negative_count', 0)}", new_x="LMARGIN", new_y="NEXT")
    top = reviews.get('top_recent', [])
    if top:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, "  Recent Reviews:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for r in top[:3]:
            text = r if len(r) <= 100 else r[:97] + '...'
            pdf.cell(0, 5, f"    - {text}", new_x="LMARGIN", new_y="NEXT")


@router.post("/reports/market-position/pdf")
async def generate_market_position_pdf(current_user: dict = Depends(get_current_user)):
    """Generate Market & Position executive PDF from enrichment data."""
    from supabase_client import get_supabase_client
    sb = get_supabase_client()

    # Check tier — block free users
    user_row = sb.table('users').select('subscription_tier').eq('id', current_user['id']).maybe_single().execute()
    tier = (user_row.data or {}).get('subscription_tier', 'free')
    if tier == 'free':
        raise HTTPException(status_code=403, detail='PDF reports are available on Pro plan and above.')

    bde = sb.table('business_dna_enrichment') \
        .select('enrichment, created_at') \
        .eq('user_id', current_user['id']) \
        .order('created_at', desc=True) \
        .limit(1) \
        .maybe_single() \
        .execute()
    if not bde.data or not bde.data.get('enrichment'):
        raise HTTPException(status_code=404, detail='No enrichment data. Complete calibration first.')

    # Contract v2 / Step 3c (2026-04-23): sanitize enrichment before feeding
    # it into the PDF builder. PDFs are customer-facing artefacts — the same
    # contract applies as to any frontend response. raw_enrichment stays in
    # the DB for audit; the PDF gets the contract-shaped view.
    raw_enrichment = bde.data['enrichment']
    _sanitized_envelope = sanitize_enrichment_for_external(raw_enrichment)
    enrichment = _sanitized_envelope['enrichment'] or {}
    business_name = raw_enrichment.get('business_name', 'Your Business')  # name is not sensitive
    scan_date = raw_enrichment.get('digital_footprint', {}).get('computed_at', bde.data.get('created_at', ''))
    if scan_date and isinstance(scan_date, str):
        try:
            scan_date = datetime.fromisoformat(scan_date.replace('Z', '+00:00')).strftime('%d %B %Y')
        except Exception:
            pass

    try:
        pdf = _build_executive_pdf(
            title="Market & Position Report",
            business_name=business_name,
            enrichment=enrichment,
            scan_date=scan_date,
            sections=[
                ("Digital Footprint", _section_kpi_strip),
                ("Executive Summary", _section_executive_summary),
                ("SWOT Analysis", _section_swot),
                ("CMO Priority Actions", _section_cmo_actions),
                ("Market Position", _section_market_position),
                ("Competitive Landscape", _section_competitors),
                ("SEO Analysis", _section_seo),
            ],
        )

        workspace_id = current_user.get('id', 'unknown')
        ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        filename = f"biqc_market_position_{workspace_id[:8]}_{ts}.pdf"
        pdf_bytes = bytes(pdf.output())

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library not available")
    except Exception as e:
        logger.error(f"Market position PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/benchmark/pdf")
async def generate_benchmark_pdf(current_user: dict = Depends(get_current_user)):
    """Generate Competitive Benchmark executive PDF from enrichment data."""
    from supabase_client import get_supabase_client
    sb = get_supabase_client()

    user_row = sb.table('users').select('subscription_tier').eq('id', current_user['id']).maybe_single().execute()
    tier = (user_row.data or {}).get('subscription_tier', 'free')
    if tier == 'free':
        raise HTTPException(status_code=403, detail='PDF reports are available on Pro plan and above.')

    bde = sb.table('business_dna_enrichment') \
        .select('enrichment, created_at') \
        .eq('user_id', current_user['id']) \
        .order('created_at', desc=True) \
        .limit(1) \
        .maybe_single() \
        .execute()
    if not bde.data or not bde.data.get('enrichment'):
        raise HTTPException(status_code=404, detail='No enrichment data. Complete calibration first.')

    # Contract v2 / Step 3c: sanitize enrichment before PDF building.
    raw_enrichment = bde.data['enrichment']
    _sanitized_envelope = sanitize_enrichment_for_external(raw_enrichment)
    enrichment = _sanitized_envelope['enrichment'] or {}
    business_name = raw_enrichment.get('business_name', 'Your Business')
    scan_date = raw_enrichment.get('digital_footprint', {}).get('computed_at', bde.data.get('created_at', ''))
    if scan_date and isinstance(scan_date, str):
        try:
            scan_date = datetime.fromisoformat(scan_date.replace('Z', '+00:00')).strftime('%d %B %Y')
        except Exception:
            pass

    try:
        pdf = _build_executive_pdf(
            title="Competitive Benchmark Report",
            business_name=business_name,
            enrichment=enrichment,
            scan_date=scan_date,
            sections=[
                ("Digital Footprint", _section_kpi_strip),
                ("Competitive Landscape", _section_competitors),
                ("SEO Analysis", _section_seo),
                ("Social Media Analysis", _section_social),
                ("Review Reputation", _section_reviews),
                ("Market Position", _section_market_position),
            ],
        )

        workspace_id = current_user.get('id', 'unknown')
        ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        filename = f"biqc_benchmark_{workspace_id[:8]}_{ts}.pdf"
        pdf_bytes = bytes(pdf.output())

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library not available")
    except Exception as e:
        logger.error(f"Benchmark PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/cmo-report/pdf")
async def generate_cmo_report_pdf(current_user: dict = Depends(get_current_user)):
    """Generate CMO report PDF for entitled plans (Pro and above)."""
    try:
        from supabase_client import get_supabase_client
        from routes.intelligence_modules import get_cmo_report

        sb = get_supabase_client()
        user_row = sb.table('users').select('subscription_tier').eq('id', current_user['id']).maybe_single().execute()
        tier = str((user_row.data or {}).get('subscription_tier', 'free')).strip().lower()
        entitled_tiers = {'pro', 'professional', 'business', 'enterprise', 'custom_build', 'super_admin'}
        if tier not in entitled_tiers:
            raise HTTPException(status_code=403, detail='PDF export is available on Pro and Business plans.')

        report = await get_cmo_report(current_user)
        if not isinstance(report, dict):
            raise HTTPException(status_code=500, detail='CMO report payload is unavailable')

        pdf = _get_safe_pdf_class()()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 18)
        pdf.cell(0, 12, "BIQc CMO Report", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, f"Business: {report.get('company_name') or 'Your business'}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Report Date: {report.get('report_date') or datetime.now(timezone.utc).strftime('%d/%m/%Y')}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Confidence: {report.get('confidence') or '--'}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Report State: {report.get('report_state') or report.get('state') or 'UNKNOWN'}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

        def _section(title: str, lines: List[str]) -> None:
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            if not lines:
                pdf.cell(0, 6, "Insufficient evidence for this section.", new_x="LMARGIN", new_y="NEXT")
                pdf.ln(2)
                return
            for line in lines:
                pdf.multi_cell(0, 6, f"- {line}")
            pdf.ln(2)

        _section("Chief Marketing Summary", [str(report.get("executive_summary") or "").strip()] if report.get("executive_summary") else [])
        _section("Market Position Score", [
            f"Overall: {(report.get('market_position') or {}).get('overall', '--')}",
            f"Brand: {(report.get('market_position') or {}).get('brand', '--')}",
            f"Digital: {(report.get('market_position') or {}).get('digital', '--')}",
            f"Sentiment: {(report.get('market_position') or {}).get('sentiment', '--')}",
        ])
        swot = report.get("swot") or {}
        _section("SWOT - Strengths", [str(x) for x in (swot.get("strengths") or [])])
        _section("SWOT - Weaknesses", [str(x) for x in (swot.get("weaknesses") or [])])
        _section("SWOT - Opportunities", [str(x) for x in (swot.get("opportunities") or [])])
        _section("SWOT - Threats", [str(x) for x in (swot.get("threats") or [])])
        roadmap = report.get("roadmap") or {}
        _section("Strategic Roadmap - 7 Day", [str(x) for x in (roadmap.get("quick_wins") or [])])
        _section("Strategic Roadmap - 30 Day", [str(x) for x in (roadmap.get("priorities") or [])])
        _section("Strategic Roadmap - 90 Day", [str(x) for x in (roadmap.get("strategic") or [])])

        workspace_id = current_user.get('id', 'unknown')
        ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        filename = f"biqc_cmo_report_{workspace_id[:8]}_{ts}.pdf"
        pdf_bytes = bytes(pdf.output())
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library not available")
    except Exception as e:
        logger.error(f"CMO PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail="CMO PDF generation failed")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Share Report — fix/p0-marjo-e8-share-function (PR #449 follow-up)
#
#  PR #449 admitted: "Share action could silently no-op". This block ships a
#  proven non-no-op:
#     • POST /reports/cmo-report/share          → creates a tokenised, expiring
#                                                  shareable URL and writes a
#                                                  share_events row. NEVER 200s
#                                                  with empty body — either it
#                                                  returns {share_url, expires_at,
#                                                  share_event_id} or raises
#                                                  HTTPException with a sanitised
#                                                  detail.
#     • GET  /reports/cmo-report/shared/{token} → unauthenticated read-only
#                                                  HTML view, sanitised per
#                                                  Contract v2 (no supplier
#                                                  names, no internal codes,
#                                                  no Ask BIQc internal
#                                                  navigation). Increments
#                                                  accessed_count. Expired
#                                                  tokens → 410 Gone. Malformed
#                                                  tokens → 400.
#
#  Brand: every external surface is "BIQc CMO Report" / "Ask BIQc" — never
#  Soundboard / Chat / Assistant (per feedback_ask_biqc_brand_name.md).
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Token shape: 32 bytes URL-safe base64 → 43 chars (no padding). We accept
# 32–64 chars of [A-Za-z0-9_-] so future rotations of `secrets.token_urlsafe`
# byte-length don't break this guard.
_SHARE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{32,64}$")
_SHARE_DEFAULT_TTL_DAYS = 7
_SHARE_MAX_TTL_DAYS = 30


class ShareCreateRequest(BaseModel):
    """Inbound payload for POST /reports/cmo-report/share."""
    # Optional recipient email for an email-mechanism share. Not validated as
    # an RFC 5322 address — backend just stores whatever the caller sent and
    # leaves SMTP delivery to a future iteration.
    recipient: Optional[str] = None
    # Optional override of expiry (in days). Clamped to [1, _SHARE_MAX_TTL_DAYS]
    # so a malicious client can't request a 100-year link.
    ttl_days: Optional[int] = None


def _frontend_base_url() -> str:
    """Return the public frontend origin used to build share URLs.

    Reads PUBLIC_FRONTEND_URL → FRONTEND_URL → REACT_APP_FRONTEND_URL in that
    order. Falls back to the production biqc.ai origin so a misconfigured
    container never silently emits an http://localhost link.
    """
    candidates = (
        os.environ.get("PUBLIC_FRONTEND_URL"),
        os.environ.get("FRONTEND_URL"),
        os.environ.get("REACT_APP_FRONTEND_URL"),
    )
    for raw in candidates:
        cleaned = (raw or "").strip().rstrip("/")
        if cleaned:
            return cleaned
    return "https://biqc.ai"


def _sanitise_recipient(value: Optional[str]) -> Optional[str]:
    """Trim + length-clamp recipient input. Never raises — just returns None
    on anything unusable. This is an audit field, not an SMTP address yet."""
    if not value or not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    return cleaned[:320]


def _serialise_share_event(row: Dict[str, Any], frontend_url: str) -> Dict[str, Any]:
    """Build the EXTERNAL response shape for a share_events row.

    Strips internal-only keys (revoked_at, raw scan_id) before returning to
    the frontend so we never accidentally widen the contract.
    """
    expires_at = row.get("expires_at") or ""
    return {
        "ok": True,
        "share_event_id": row.get("id"),
        "mechanism": row.get("mechanism") or "shareable_link",
        "share_url": row.get("share_url") or f"{frontend_url}/r/{row.get('token','')}",
        "expires_at": expires_at,
        "recipient": row.get("recipient"),
    }


@router.post("/reports/cmo-report/share")
async def create_cmo_report_share(
    payload: Optional[ShareCreateRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    """Create a tokenised shareable URL for the caller's CMO report.

    Returns `{ok, share_event_id, share_url, expires_at, mechanism, recipient}`.

    Never returns a silent success: either the share_events row is durably
    inserted and the URL is returned, or this endpoint raises HTTPException
    with a sanitised detail. PR #449 specifically warned about silent no-op
    — the route's contract is "writes a row OR raises".
    """
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        # Auth dep should have raised already; this is defence in depth.
        raise HTTPException(status_code=401, detail="Authentication required to share a report")

    body = payload or ShareCreateRequest()
    ttl_days = body.ttl_days if isinstance(body.ttl_days, int) and body.ttl_days > 0 else _SHARE_DEFAULT_TTL_DAYS
    ttl_days = max(1, min(ttl_days, _SHARE_MAX_TTL_DAYS))
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)

    token = secrets.token_urlsafe(32)
    frontend_url = _frontend_base_url()
    share_url = f"{frontend_url}/r/{token}"
    recipient = _sanitise_recipient(body.recipient)

    # Best-effort scan_id resolution: latest enrichment row for this user.
    # Nullable in the schema — if lookup fails we still write the share row.
    scan_id: Optional[str] = None
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        enr = (
            sb.table("business_dna_enrichment")
              .select("id")
              .eq("user_id", user_id)
              .order("created_at", desc=True)
              .limit(1)
              .execute()
        )
        rows = getattr(enr, "data", None) or []
        if rows and isinstance(rows[0], dict):
            scan_id = rows[0].get("id")
    except Exception as resolve_err:  # noqa: BLE001 — non-fatal, scan_id is optional
        logger.debug(f"[share] scan_id resolve skipped: {resolve_err}")

    insert_row = {
        "user_id": user_id,
        "scan_id": scan_id,
        "mechanism": "shareable_link",
        "token": token,
        "share_url": share_url,
        "recipient": recipient,
        "accessed_count": 0,
        "expires_at": expires_at.isoformat(),
    }

    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table("share_events").insert(insert_row).execute()
        rows = getattr(result, "data", None) or []
        if not rows:
            # Non-200 from Supabase — Contract v2 says do NOT return ok with
            # empty data. Surface as a sanitised 502.
            logger.error(f"[share] insert returned no rows for user {user_id}")
            raise HTTPException(status_code=502, detail="Could not create the share link. Please try again.")
        stored = rows[0] if isinstance(rows[0], dict) else dict(insert_row, id=None)
    except HTTPException:
        raise
    except Exception as ins_err:  # noqa: BLE001
        logger.error(f"[share] insert failed for user {user_id}: {ins_err}")
        # Sanitised external message — no DB names, no driver classes.
        raise HTTPException(status_code=502, detail="Could not create the share link. Please try again.")

    response_payload = _serialise_share_event({**insert_row, **stored}, frontend_url)

    # Belt-and-braces: assert the response contains no banned tokens before
    # it leaves the backend. If a future code change accidentally embeds a
    # supplier name, this fails CI rather than reaching the user.
    try:
        # Skip the share_url itself from the scrub so origin domains never
        # trip the banned-token list (assert_no_banned_tokens does substring
        # matches, never URLs in our banned set today).
        assert_no_banned_tokens(response_payload, source="reports.create_cmo_report_share")
    except ExternalContractViolation as cv:
        logger.error(f"[share] external contract violation: {cv}")
        raise HTTPException(status_code=500, detail="Could not create the share link. Please try again.")

    return response_payload


# Sanitisation pattern for textual fields in the public HTML view. We strip
# obvious supplier names + internal markers BEFORE rendering so the public
# page never leaks vendor identity even if the enrichment text drifts.
_PUBLIC_HTML_REDACTIONS = (
    "SEMrush", "SEMRUSH", "OpenAI", "Perplexity", "Firecrawl", "Browse.ai",
    "BrowseAI", "SerpAPI", "Merge.dev", "Anthropic", "Claude", "GPT-4", "GPT-3",
    "service_role", "user_jwt", "ai_errors", "edge_tools",
)


def _redact_for_public(text: Any) -> str:
    """Strip supplier names + internal markers from a string. Never raises."""
    if text is None:
        return ""
    s = str(text)
    for needle in _PUBLIC_HTML_REDACTIONS:
        s = re.sub(re.escape(needle), "", s, flags=re.IGNORECASE)
    return s.strip()


def _public_html_escape(value: Any) -> str:
    """Minimal HTML-escape for embedding into the shared template."""
    s = _redact_for_public(value)
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
         .replace('"', "&quot;")
         .replace("'", "&#39;")
    )


def _build_public_share_html(report: Dict[str, Any], company: str, generated_at: str) -> str:
    """Render the read-only HTML view for an unauthenticated share recipient.

    Contract v2: this is the most exposed surface in the share flow — the
    URL holder is unauthenticated. The HTML must never contain auth tokens,
    supplier names, internal codes, or links into the authenticated app
    (no /dashboard, no /ask-biqc internal navigation, no supabase URL).
    """
    safe_company = _public_html_escape(company or "Your business")
    safe_generated = _public_html_escape(generated_at)
    exec_summary = _public_html_escape(
        report.get("executive_summary")
        or "This report is still being prepared. Check back shortly."
    )

    mp = report.get("market_position") or {}
    overall = mp.get("overall") if isinstance(mp.get("overall"), (int, float)) else "—"

    swot = report.get("swot") or {}
    def _list(items):
        items = items or []
        if not items:
            return "<li class='muted'>No items available.</li>"
        return "".join(f"<li>{_public_html_escape(x)}</li>" for x in items[:10])

    swot_html = (
        f"<div class='swot'>"
        f"<div class='card'><h3>Strengths</h3><ul>{_list(swot.get('strengths'))}</ul></div>"
        f"<div class='card'><h3>Weaknesses</h3><ul>{_list(swot.get('weaknesses'))}</ul></div>"
        f"<div class='card'><h3>Opportunities</h3><ul>{_list(swot.get('opportunities'))}</ul></div>"
        f"<div class='card'><h3>Threats</h3><ul>{_list(swot.get('threats'))}</ul></div>"
        f"</div>"
    )

    roadmap = report.get("roadmap") or {}
    def _roadmap_items(items):
        items = items or []
        if not items:
            return "<li class='muted'>No items available.</li>"
        out = []
        for item in items[:10]:
            text = item.get("text") if isinstance(item, dict) else item
            out.append(f"<li>{_public_html_escape(text)}</li>")
        return "".join(out)
    roadmap_html = (
        f"<div class='roadmap'>"
        f"<div class='card'><h3>7-Day Quick Wins</h3><ol>{_roadmap_items(roadmap.get('quick_wins'))}</ol></div>"
        f"<div class='card'><h3>30-Day Priorities</h3><ol>{_roadmap_items(roadmap.get('priorities'))}</ol></div>"
        f"<div class='card'><h3>90-Day Strategic</h3><ol>{_roadmap_items(roadmap.get('strategic'))}</ol></div>"
        f"</div>"
    )

    return f"""<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8' />
  <meta name='robots' content='noindex,nofollow' />
  <meta name='viewport' content='width=device-width,initial-scale=1' />
  <title>BIQc CMO Report — {safe_company}</title>
  <style>
    :root {{ color-scheme: light; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 32px 20px; color: #1a1d29; background: #fafbfc; line-height: 1.55; }}
    h1 {{ font-size: 28px; margin-bottom: 4px; }}
    h2 {{ font-size: 18px; margin-top: 32px; padding-bottom: 6px; border-bottom: 1px solid #e1e4e8; }}
    h3 {{ font-size: 14px; margin: 0 0 12px; color: #424b5f; }}
    .eyebrow {{ font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #d6422a; font-weight: 700; }}
    .meta {{ font-size: 12px; color: #6b7280; margin-bottom: 20px; }}
    .summary {{ background: #fff; padding: 20px; border-left: 3px solid #d6422a; border-radius: 6px; margin-bottom: 24px; }}
    .score {{ display: inline-block; font-size: 48px; font-weight: 700; color: #d6422a; }}
    .swot, .roadmap {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }}
    .card {{ background: #fff; border: 1px solid #e1e4e8; border-radius: 8px; padding: 16px; }}
    .card ul, .card ol {{ margin: 0; padding-left: 18px; }}
    .card li {{ margin-bottom: 6px; font-size: 13px; color: #424b5f; }}
    .muted {{ color: #9ca3af; font-style: italic; }}
    footer {{ margin-top: 48px; padding-top: 16px; border-top: 1px solid #e1e4e8; text-align: center; font-size: 11px; color: #9ca3af; }}
    .read-only-banner {{ background: #fef3c7; color: #78350f; padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 16px; }}
  </style>
</head>
<body>
  <div class='read-only-banner'>You are viewing a read-only shared copy of this report. The full interactive report is available inside BIQc.</div>
  <span class='eyebrow'>BIQc CMO Intelligence Report</span>
  <h1>{safe_company}</h1>
  <p class='meta'>Generated {safe_generated}. Overall market position: <span class='score'>{overall}</span> / 100</p>
  <div class='summary'>{exec_summary}</div>
  <h2>SWOT Analysis</h2>
  {swot_html}
  <h2>Strategic Roadmap</h2>
  {roadmap_html}
  <footer>
    Prepared by BIQc Intelligence Engine. This shared view is read-only and does not include account-specific or sensitive operational data. Visit biqc.ai to learn more.
  </footer>
</body>
</html>
"""


@router.get("/reports/cmo-report/shared/{token}", include_in_schema=True)
async def get_cmo_report_shared(
    token: str = Path(..., min_length=8, max_length=128),
):
    """Public unauthenticated read-only HTML view of a shared CMO report.

    Returns:
        - 200 + sanitised text/html when the token is live and not expired
        - 400 when the token is malformed
        - 404 when no row matches
        - 410 (Gone) when the token has expired or been revoked
    """
    if not _SHARE_TOKEN_RE.match(token or ""):
        raise HTTPException(status_code=400, detail="Invalid share link")

    # Service-role read intentional: the holder of the token IS the
    # authorisation here. RLS on share_events restricts authenticated
    # access to the owner; this public endpoint reads via service role.
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = (
            sb.table("share_events")
              .select("id,user_id,mechanism,token,share_url,expires_at,revoked_at,accessed_count")
              .eq("token", token)
              .limit(1)
              .execute()
        )
        rows = getattr(result, "data", None) or []
    except Exception as lookup_err:  # noqa: BLE001
        logger.error(f"[share] token lookup failed: {lookup_err}")
        raise HTTPException(status_code=503, detail="Shared report is temporarily unavailable")

    if not rows:
        raise HTTPException(status_code=404, detail="Shared report not found")

    row = rows[0]
    if row.get("revoked_at"):
        raise HTTPException(status_code=410, detail="This share link has been revoked")

    expires_raw = row.get("expires_at")
    try:
        expires_dt = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00")) if expires_raw else None
    except Exception:  # noqa: BLE001
        expires_dt = None
    if expires_dt and expires_dt < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This share link has expired")

    user_id = row.get("user_id")
    if not user_id:
        # Defensive — shouldn't happen because the column is NOT NULL.
        raise HTTPException(status_code=410, detail="This share link is no longer valid")

    # Reconstruct the report as the share owner would see it. We deliberately
    # call get_cmo_report with a synthetic user dict so the existing
    # Contract-v2 sanitised pipeline runs unchanged.
    try:
        from routes.intelligence_modules import get_cmo_report
        report = await get_cmo_report({"id": user_id})
        if not isinstance(report, dict):
            report = {}
    except Exception as report_err:  # noqa: BLE001
        logger.error(f"[share] report rebuild failed for token: {report_err}")
        report = {}

    # Final scrub of the report payload through the centralised sanitizer
    # before it's rendered into HTML. Strips internal-only keys at any depth.
    try:
        report = scrub_response_for_external(report) or {}
    except Exception as scrub_err:  # noqa: BLE001
        logger.warning(f"[share] scrub failed (continuing with empty report): {scrub_err}")
        report = {}

    company = report.get("company_name") or "Your business"
    generated_at = report.get("report_date") or datetime.now(timezone.utc).strftime("%d/%m/%Y")

    html = _build_public_share_html(report, company, generated_at)

    # Belt-and-braces: assert no banned tokens slipped into the HTML.
    try:
        assert_no_banned_tokens(html, source="reports.get_cmo_report_shared")
    except ExternalContractViolation as cv:
        logger.error(f"[share] HTML contract violation: {cv}")
        # Fail closed: serve a generic placeholder rather than leaking.
        html = (
            "<!doctype html><html><head><meta charset='utf-8'><title>BIQc Shared Report</title></head>"
            "<body style='font-family:sans-serif;padding:32px;max-width:640px;margin:0 auto;'>"
            "<h1>BIQc CMO Report</h1>"
            "<p>This shared report is temporarily unavailable. Please contact the sender for an updated link.</p>"
            "</body></html>"
        )

    # Best-effort accessed_count increment. Failure here must not break the
    # response — the recipient still sees the report.
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        new_count = int(row.get("accessed_count") or 0) + 1
        sb.table("share_events").update({"accessed_count": new_count}).eq("id", row.get("id")).execute()
    except Exception as inc_err:  # noqa: BLE001
        logger.debug(f"[share] accessed_count increment skipped: {inc_err}")

    return HTMLResponse(
        content=html,
        status_code=200,
        headers={
            # Public surface — opt out of search-engine indexing.
            "X-Robots-Tag": "noindex, nofollow",
            "Cache-Control": "private, max-age=60",
            "Referrer-Policy": "no-referrer",
        },
    )
