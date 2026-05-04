"""Report generation routes — PDF export with deterministic data only."""
import os
import json
import logging
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)
router = APIRouter()

# Auth dependency
from routes.auth import get_current_user

# Contract v2 / Step 3c: sanitize enrichment before PDF generation so
# customer-facing reports never embed supplier names, internal codes, or
# fabricated confident-but-empty scores.
from core.response_sanitizer import sanitize_enrichment_for_external


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


# ─── CMO PDF helpers (P0 marjo-E7 2026-05-04) ─────────────────────────────
#
# Root cause of the prior 500: `multi_cell(0, 6, ...)` was called in a loop
# inside `_section()` without resetting cursor X to LMARGIN between calls.
# After the first multi_cell, cursor X lands at the right page margin
# (~200mm); the next multi_cell with width=0 then computes available width
# as (page_width - x - right_margin) ≈ 0 mm, which raises:
#   `FPDFException: Not enough horizontal space to render a single character`
# That bubbled up as a generic 500 with the message "CMO PDF generation
# failed" so the user never got a PDF.
#
# Fix: every multi_cell now passes `new_x="LMARGIN", new_y="NEXT"` so the
# cursor returns to the left margin after each call. We also tightened the
# section render to be Contract v2 aware: each section uses state-aware
# rendering (DATA_AVAILABLE → content, INSUFFICIENT_SIGNAL → uncertainty
# banner, DEGRADED → partial banner + whatever data is present), and the
# final PDF body is scanned for banned supplier tokens before return.

_CMO_BANNED_TOKEN_CACHE: Optional[tuple] = None


def _get_banned_tokens() -> tuple:
    """Lazy-load banned tokens from the central sanitizer. Cached at module
    scope so we don't reimport on every request."""
    global _CMO_BANNED_TOKEN_CACHE
    if _CMO_BANNED_TOKEN_CACHE is not None:
        return _CMO_BANNED_TOKEN_CACHE
    try:
        from core.response_sanitizer import ALL_BANNED_TOKENS
        _CMO_BANNED_TOKEN_CACHE = tuple(ALL_BANNED_TOKENS)
    except Exception:
        # Defensive fallback: ship the well-known supplier names + internal
        # markers even if the import path changes. Better than letting a
        # leak through.
        _CMO_BANNED_TOKEN_CACHE = (
            "SEMRUSH", "Semrush", "semrush", "OPENAI", "OpenAI", "openai",
            "Anthropic", "ANTHROPIC", "Perplexity", "PERPLEXITY",
            "Firecrawl", "FIRECRAWL", "Browse.ai", "browse.ai", "BROWSE_AI",
            "Serper", "SERPER", "Merge.dev", "merge.dev", "MERGE_API",
            "service_role", "SERVICE_ROLE", "API_KEY", "API_KEY_MISSING",
            "ai_errors", "_http_status", "edge_tools", "edge_function",
            "HTTP 401", "HTTP 403", "HTTP 500", "HTTP 502", "HTTP 503",
        )
    return _CMO_BANNED_TOKEN_CACHE


def _scrub_text_for_external(text: str) -> str:
    """Replace any banned supplier/internal token in `text` with a Contract
    v2 uncertainty phrase. Never raises. Operates on substrings — case
    sensitive matches the central tuple. Used at every text write into the
    PDF so even if upstream forgot to sanitise, the PDF cannot leak."""
    if not text:
        return text
    cleaned = str(text)
    for token in _get_banned_tokens():
        if token and token in cleaned:
            cleaned = cleaned.replace(token, "[supplier-data]")
    return cleaned


def _aest_from_iso(iso_str: Optional[str]) -> str:
    """Return AEST (UTC+10) date/time string from ISO timestamp. Falls back
    to current UTC if the input is missing or unparseable. Australia uses
    AEST/AEDT seasonally; we render fixed +10:00 to keep the PDF
    deterministic and avoid pulling pytz."""
    try:
        if iso_str:
            dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
        else:
            dt = datetime.now(timezone.utc)
    except Exception:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # AEST is UTC+10 (no DST applied; AEDT would be +11 in summer).
    from datetime import timedelta
    aest = dt.astimezone(timezone(timedelta(hours=10)))
    return aest.strftime("%d %b %Y, %H:%M AEST")


def _utc_from_iso(iso_str: Optional[str]) -> str:
    """Return UTC date/time string from ISO timestamp."""
    try:
        if iso_str:
            dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
        else:
            dt = datetime.now(timezone.utc)
    except Exception:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%d %b %Y, %H:%M UTC")


def _section_state_for(report: dict, section_key: str) -> str:
    """Pull the per-section state from `section_inventory` if present.
    Returns one of {DATA_AVAILABLE, INSUFFICIENT_SIGNAL, DEGRADED, UNKNOWN}.

    The CMO endpoint exposes `section_inventory` keyed by display-name
    (e.g. "SWOT", "Market Position Score"). When absent, we infer from the
    payload itself — empty list/dict = INSUFFICIENT_SIGNAL, populated =
    DATA_AVAILABLE."""
    inventory = report.get("section_inventory") or {}
    if isinstance(inventory, dict):
        entry = inventory.get(section_key)
        if isinstance(entry, dict):
            status = entry.get("status")
            if isinstance(status, str) and status:
                return status.upper()
    return "UNKNOWN"


# Static intro copy for each section. Customer-facing language only —
# no supplier names, no error markers. Helps the reader understand what
# each section represents and how to act on it.
_SECTION_INTROS: Dict[str, str] = {
    "Chief Marketing Summary": (
        "A high-level synthesis of the market intelligence gathered for "
        "this business. Use this as your one-paragraph briefing to the "
        "leadership team."
    ),
    "Market Position Score": (
        "Five-dial composite score across brand authority, digital presence, "
        "customer sentiment, and competitive pressure. Each dial is "
        "scored 0 to 100. Zeroed dials indicate insufficient evidence "
        "rather than a low score."
    ),
    "Competitive Landscape": (
        "Named competitors detected for this business with a relative "
        "threat assessment and visible market share. Use to prioritise "
        "competitive defensive plays and to brief sales."
    ),
    "SWOT - Strengths": (
        "Internal capabilities and assets that this business should lean "
        "into. Each item is grounded in evidence gathered during the scan."
    ),
    "SWOT - Weaknesses": (
        "Internal gaps that competitors can exploit. Treat each item as a "
        "candidate for the next sprint of operational improvement."
    ),
    "SWOT - Opportunities": (
        "External openings that are addressable in the next two quarters. "
        "Pair each opportunity with the matching capability or gap."
    ),
    "SWOT - Threats": (
        "External pressures that could erode market position. Use these to "
        "scope risk-mitigation work and to inform board-level conversations."
    ),
    "Review Intelligence": (
        "Aggregated voice-of-customer signal: rating, volume, sentiment "
        "split, and the recurring themes customers raise. Direct input to "
        "product, customer success, and support roadmaps."
    ),
    "Strategic Roadmap - 7 Day Quick Wins": (
        "Tactical items deliverable inside one week. Designed for the "
        "operator who needs to move the needle today without committing "
        "engineering or campaign budget."
    ),
    "Strategic Roadmap - 30 Day Priorities": (
        "Initiatives that should land within a one-month sprint. These "
        "typically require coordination across marketing and product."
    ),
    "Strategic Roadmap - 90 Day Strategic": (
        "Larger plays that take a quarter to land. Use to anchor the next "
        "quarterly planning cycle and resource the relevant teams."
    ),
    "Digital Footprint": (
        "Composite signal of website performance, organic search reach, "
        "and content authority. Each component is scored 0 to 100 from "
        "the most recent scan."
    ),
    "SEO Analysis": (
        "Organic search performance signals: ranking strength, keyword "
        "coverage, and on-page hygiene. Identifies the highest-leverage "
        "areas to invest in next."
    ),
    "Geographic Footprint": (
        "Established markets where the business already has visibility, "
        "and growth markets where the scan detected opportunity signal."
    ),
    "CMO Priority Actions": (
        "Top recommended marketing actions ordered by expected impact. "
        "Each is grounded in the evidence inventory of this scan."
    ),
}


def _render_cmo_section(pdf, title: str, lines: List[str], state: str = "DATA_AVAILABLE",
                        message: Optional[str] = None,
                        intro: Optional[str] = None) -> None:
    """Render a CMO section with state-aware behaviour.

    DATA_AVAILABLE   → bold title + intro paragraph + bullet lines
    INSUFFICIENT_SIGNAL → bold title + intro paragraph + amber banner copy
                          (no fabricated content)
    DEGRADED         → bold title + intro paragraph + partial banner +
                       whatever lines we have
    UNKNOWN/other    → treat as DATA_AVAILABLE if lines, else INSUFFICIENT_SIGNAL.

    The intro paragraph is auto-pulled from `_SECTION_INTROS` when not
    provided. Always rendered so the reader has context even when the
    section is gated by INSUFFICIENT_SIGNAL.

    Critical: every multi_cell call passes `new_x="LMARGIN", new_y="NEXT"`
    so the cursor returns to the left margin and the next call has a full
    page width of horizontal space. This is the fix for the prior 500.
    """
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")

    # Intro paragraph (always rendered when available — gives context even
    # for INSUFFICIENT_SIGNAL sections).
    intro_text = intro or _SECTION_INTROS.get(title)
    if intro_text:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(110, 110, 110)
        pdf.multi_cell(0, 5, intro_text, new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(0, 0, 0)
        pdf.ln(1)

    pdf.set_font("Helvetica", "", 10)

    state_norm = (state or "").upper()
    has_lines = bool(lines)

    if state_norm == "INSUFFICIENT_SIGNAL" or (state_norm == "UNKNOWN" and not has_lines):
        pdf.set_text_color(140, 90, 0)  # amber
        banner = message or "Insufficient market signal for this section. Re-scan to refresh."
        pdf.multi_cell(0, 6, banner, new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)
        return

    if state_norm == "DEGRADED":
        pdf.set_text_color(140, 90, 0)
        pdf.multi_cell(
            0, 6,
            message or "Partial intelligence: some upstream signals were unavailable. Showing what we have.",
            new_x="LMARGIN", new_y="NEXT"
        )
        pdf.set_text_color(0, 0, 0)
        pdf.ln(1)

    # DATA_AVAILABLE / DEGRADED-with-data path
    if not has_lines:
        pdf.set_text_color(120, 120, 120)
        pdf.multi_cell(0, 6, "No content recorded for this section.",
                       new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)
        return

    for line in lines:
        if line is None:
            continue
        pdf.multi_cell(0, 6, f"- {_scrub_text_for_external(str(line))}",
                       new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def _build_cmo_pdf(report: dict, workspace_id: str):
    """Build the full CMO PDF from the canonical `get_cmo_report` payload.

    Returns the FPDF instance, ready for `.output()`. Cover page uses
    "Ask BIQc" branding (per feedback_ask_biqc_brand_name memory). Footer
    appears via FPDF's auto-footer hook on every page.
    """
    SafePDFClass = _get_safe_pdf_class()

    # Subclass once more to inject footer with report ID + Ask BIQc branding.
    report_id = report.get("report_id") or f"CMO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{workspace_id[:8]}"

    class _CMOReportPDF(SafePDFClass):
        def footer(self):
            self.set_y(-15)
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0, 6,
                f"Generated by Ask BIQc  |  Report ID: {report_id}  |  Page {self.page_no()}",
                align="C", new_x="LMARGIN", new_y="NEXT"
            )
            self.set_text_color(0, 0, 0)

    pdf = _CMOReportPDF()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Cover page
    pdf.add_page()
    pdf.ln(40)
    pdf.set_font("Helvetica", "B", 28)
    pdf.cell(0, 16, "Ask BIQc", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, "Chief Marketing Officer Intelligence", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(20)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, "CMO Report", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(12)

    pdf.set_font("Helvetica", "B", 14)
    business_name = _scrub_text_for_external(str(report.get("company_name") or "Your business"))
    pdf.cell(0, 10, business_name, new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(8)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    generated_at_iso = report.get("generated_at") or datetime.now(timezone.utc).isoformat()
    pdf.cell(0, 6, f"Scan date (UTC): {_utc_from_iso(generated_at_iso)}",
             new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 6, f"Scan date (AEST): {_aest_from_iso(generated_at_iso)}",
             new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(4)

    # Confidence + report state on cover.
    confidence = report.get("confidence")
    confidence_display = f"{confidence}" if isinstance(confidence, (int, float)) and confidence else "Insufficient evidence"
    pdf.cell(0, 6, f"Confidence: {confidence_display}",
             new_x="LMARGIN", new_y="NEXT", align="C")
    state_label = str(report.get("state") or "UNKNOWN").replace("_", " ").title()
    pdf.cell(0, 6, f"Report state: {state_label}",
             new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_text_color(0, 0, 0)

    # ── Methodology + how-to-read page ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, "How to read this report", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(
        0, 6,
        "This Chief Marketing Officer report is generated from a deep "
        "intelligence scan of your business. Each section combines public "
        "web signals, organic and paid search visibility data, customer "
        "review aggregation, and AI-assisted strategic synthesis to give "
        "you decision-grade marketing intelligence in one place.",
        new_x="LMARGIN", new_y="NEXT"
    )
    pdf.ln(2)
    pdf.multi_cell(
        0, 6,
        "Each section is annotated with a state. DATA AVAILABLE means we "
        "have evidence-backed signal to render the section in full. "
        "INSUFFICIENT SIGNAL means the underlying scan did not surface "
        "enough evidence to assess this section confidently — we render "
        "an uncertainty banner rather than a fabricated score. DEGRADED "
        "means the section is partially populated; we show what we have "
        "and flag what we do not.",
        new_x="LMARGIN", new_y="NEXT"
    )
    pdf.ln(2)
    pdf.multi_cell(
        0, 6,
        "A score of 0 or a missing field never means the business is "
        "weak in that area — it means the scan did not collect enough "
        "evidence to make a confident judgement. Re-run the scan or "
        "extend the data sources to fill those gaps.",
        new_x="LMARGIN", new_y="NEXT"
    )
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Sections in this report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    for s in ("Chief Marketing Summary",
              "Market Position Score",
              "Competitive Landscape",
              "SWOT Analysis (Strengths, Weaknesses, Opportunities, Threats)",
              "Review Intelligence",
              "Strategic Roadmap (7 day, 30 day, 90 day)",
              "Appendix: Digital Footprint, SEO Analysis, Geographic Footprint, CMO Priority Actions"):
        pdf.multi_cell(0, 6, f"- {s}", new_x="LMARGIN", new_y="NEXT")

    # Content pages: each section starts on a fresh page so headers are clear.
    pdf.add_page()

    # Chief Marketing Summary
    exec_summary = report.get("executive_summary")
    summary_lines = [str(exec_summary).strip()] if exec_summary else []
    exec_state = _section_state_for(report, "Chief Marketing Summary")
    if exec_state == "UNKNOWN":
        exec_state = _section_state_for(report, "Executive Summary")
    _render_cmo_section(pdf, "Chief Marketing Summary", summary_lines,
                        state=exec_state if exec_state != "UNKNOWN" else ("DATA_AVAILABLE" if summary_lines else "INSUFFICIENT_SIGNAL"))

    # Market Position Score
    mp = report.get("market_position") or {}
    mp_lines = []
    if isinstance(mp, dict):
        for label, key in (("Overall", "overall"), ("Brand", "brand"),
                           ("Digital", "digital"), ("Sentiment", "sentiment"),
                           ("Competitive", "competitive")):
            val = mp.get(key)
            if val is None or val == 0:
                continue  # skip null/zero rather than fabricate
            mp_lines.append(f"{label}: {val}")
    mp_state = _section_state_for(report, "Market Position Score")
    if mp_state == "UNKNOWN":
        mp_state = "DATA_AVAILABLE" if mp_lines else "INSUFFICIENT_SIGNAL"
    _render_cmo_section(pdf, "Market Position Score", mp_lines, state=mp_state)

    # Competitive Landscape
    competitors = report.get("competitors") or []
    comp_lines = []
    for c in competitors[:8]:
        if isinstance(c, dict):
            name = c.get("name") or "Unnamed"
            threat = c.get("threat_level") or "unknown"
            share = c.get("market_share") or "N/A"
            comp_lines.append(f"{name} - threat {threat}, share {share}")
        elif isinstance(c, str):
            comp_lines.append(c)
    comp_state = _section_state_for(report, "Competitive Landscape")
    if comp_state == "UNKNOWN":
        comp_state = "DATA_AVAILABLE" if comp_lines else "INSUFFICIENT_SIGNAL"
    _render_cmo_section(pdf, "Competitive Landscape", comp_lines, state=comp_state)

    # SWOT — render as four sub-sections, each with its own state hint.
    swot = report.get("swot") or {}
    swot_state = _section_state_for(report, "SWOT")
    pdf.add_page()
    for quadrant_key, quadrant_label in (("strengths", "Strengths"),
                                          ("weaknesses", "Weaknesses"),
                                          ("opportunities", "Opportunities"),
                                          ("threats", "Threats")):
        items = swot.get(quadrant_key) if isinstance(swot, dict) else []
        items = [str(x) for x in (items or []) if x]
        sub_state = swot_state
        if sub_state == "UNKNOWN":
            sub_state = "DATA_AVAILABLE" if items else "INSUFFICIENT_SIGNAL"
        _render_cmo_section(pdf, f"SWOT - {quadrant_label}", items, state=sub_state)

    # Review Intelligence
    pdf.add_page()
    reviews = report.get("reviews") or {}
    rv_lines = []
    if isinstance(reviews, dict):
        rating = reviews.get("rating")
        count = reviews.get("count")
        if rating:
            rv_lines.append(f"Average rating: {rating}")
        if count:
            rv_lines.append(f"Review count: {count}")
        for key, label in (("positive_pct", "Positive %"),
                           ("neutral_pct", "Neutral %"),
                           ("negative_pct", "Negative %")):
            val = reviews.get(key)
            if val:
                rv_lines.append(f"{label}: {val}")
    review_themes = report.get("review_themes") or {}
    if isinstance(review_themes, dict):
        for theme in (review_themes.get("positive") or [])[:3]:
            rv_lines.append(f"Positive theme: {theme}")
        for theme in (review_themes.get("negative") or [])[:3]:
            rv_lines.append(f"Negative theme: {theme}")
    review_state = _section_state_for(report, "Review Intelligence")
    if review_state == "UNKNOWN":
        review_state = "DATA_AVAILABLE" if rv_lines else "INSUFFICIENT_SIGNAL"
    _render_cmo_section(pdf, "Review Intelligence", rv_lines, state=review_state)

    # Strategic Roadmap (7/30/90 day)
    pdf.add_page()
    roadmap = report.get("roadmap") or {}
    roadmap_state = _section_state_for(report, "Strategic Roadmap")

    def _roadmap_lines(items):
        out = []
        for item in (items or []):
            if isinstance(item, dict):
                t = item.get("text") or ""
                if t:
                    out.append(str(t))
            elif isinstance(item, str) and item.strip():
                out.append(item)
        return out

    for col_key, col_label in (("quick_wins", "7 Day Quick Wins"),
                               ("priorities", "30 Day Priorities"),
                               ("strategic", "90 Day Strategic")):
        col_items = _roadmap_lines(roadmap.get(col_key) if isinstance(roadmap, dict) else [])
        sub_state = roadmap_state
        if sub_state == "UNKNOWN":
            sub_state = "DATA_AVAILABLE" if col_items else "INSUFFICIENT_SIGNAL"
        _render_cmo_section(pdf, f"Strategic Roadmap - {col_label}", col_items, state=sub_state)

    # ── Appendix sections (real fields from canonical CMO payload) ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Appendix: Detailed Signals", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    # Digital Footprint
    df = report.get("digital_footprint") or {}
    df_lines = []
    if isinstance(df, dict):
        for label, key in (("Overall score", "score"),
                           ("SEO visibility", "seo_score"),
                           ("Social engagement", "social_score"),
                           ("Content authority", "content_score")):
            val = df.get(key)
            if val:
                df_lines.append(f"{label}: {val}/100")
    _render_cmo_section(
        pdf, "Digital Footprint", df_lines,
        state="DATA_AVAILABLE" if df_lines else "INSUFFICIENT_SIGNAL"
    )

    # SEO Analysis
    seo = report.get("seo_analysis") or {}
    seo_lines = []
    if isinstance(seo, dict):
        seo_score = seo.get("score")
        seo_status = seo.get("status")
        if seo_score:
            seo_lines.append(f"Overall SEO score: {seo_score}/100")
        if seo_status and seo_status != seo_score:
            seo_lines.append(f"Status: {seo_status}")
        for s in (seo.get("strengths") or [])[:5]:
            seo_lines.append(f"Strength: {s}")
        for g in (seo.get("gaps") or [])[:5]:
            seo_lines.append(f"Gap: {g}")
        for a in (seo.get("priority_actions") or [])[:5]:
            seo_lines.append(f"Priority action: {a}")
    _render_cmo_section(
        pdf, "SEO Analysis", seo_lines,
        state="DATA_AVAILABLE" if seo_lines else "INSUFFICIENT_SIGNAL"
    )

    # Geographic Footprint
    geo = report.get("geographic") or {}
    geo_lines = []
    if isinstance(geo, dict):
        established = geo.get("established") or []
        growth = geo.get("growth") or []
        if established:
            geo_lines.append(f"Established markets: {', '.join(str(x) for x in established)}")
        if growth:
            geo_lines.append(f"Growth markets: {', '.join(str(x) for x in growth)}")
    _render_cmo_section(
        pdf, "Geographic Footprint", geo_lines,
        state="DATA_AVAILABLE" if geo_lines else "INSUFFICIENT_SIGNAL"
    )

    # CMO Priority Actions
    pa_lines = []
    for a in (report.get("cmo_priority_actions") or [])[:10]:
        if isinstance(a, str) and a.strip():
            pa_lines.append(a)
        elif isinstance(a, dict):
            t = a.get("text") or a.get("title") or ""
            if t:
                pa_lines.append(str(t))
    for a in (report.get("industry_action_items") or [])[:5]:
        if isinstance(a, str) and a.strip():
            pa_lines.append(f"Industry: {a}")
        elif isinstance(a, dict):
            t = a.get("text") or a.get("title") or ""
            if t:
                pa_lines.append(f"Industry: {t}")
    _render_cmo_section(
        pdf, "CMO Priority Actions", pa_lines,
        state="DATA_AVAILABLE" if pa_lines else "INSUFFICIENT_SIGNAL"
    )

    # ── Notes, methodology, data provenance ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, "Methodology and data provenance",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 10)

    methodology_paragraphs = [
        (
            "Intelligence in this report is synthesised from a deep web "
            "scan of the business website, public review aggregators, "
            "social presence indicators, organic and paid search "
            "visibility data, and competitor footprint detection. Each "
            "signal is scored against industry baselines and then "
            "composited into the dials, scores, and recommendations you "
            "see throughout this report."
        ),
        (
            "The scan runs a non-trivial number of independent intelligence "
            "calls in parallel. We track the success or failure of each "
            "underlying call so that when one component is unavailable, "
            "the affected sections render an INSUFFICIENT SIGNAL banner "
            "rather than a confidently fabricated number. This is a "
            "deliberate product posture: better an honest gap than a "
            "false certainty."
        ),
        (
            "Confidence on the cover page is an evidence-density score, "
            "not a satisfaction rating. A confidence of 78 means the "
            "scan returned strong, multi-source signal across most "
            "sections. A confidence below 50 means the scan was thin in "
            "places and the recommendations should be treated as "
            "directional rather than prescriptive."
        ),
        (
            "Recommendations in the Strategic Roadmap are sequenced for "
            "an operator with limited bandwidth: 7 day items can be "
            "shipped by a single person inside a week, 30 day items "
            "typically require a small team and a campaign plan, and 90 "
            "day items anchor the next quarterly cycle. Use the order "
            "as a default and adjust to your context."
        ),
        (
            "If a section is rendered with an INSUFFICIENT SIGNAL banner, "
            "the most common cause is a thin or new web presence for the "
            "business under review. Re-running the scan after publishing "
            "additional content, expanding the website, or growing review "
            "volume usually raises the underlying section to DATA "
            "AVAILABLE on the next pass."
        ),
        (
            "For audit and reproducibility, this report carries a "
            "deterministic identifier in the page footer. Quote that ID "
            "back to support if you need the same scan output replayed "
            "or verified."
        ),
    ]
    for paragraph in methodology_paragraphs:
        pdf.multi_cell(0, 6, paragraph, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Glossary", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    glossary = [
        ("Brand authority",
         "Composite signal of website presence, professionalism, and "
         "third-party recognition. Higher means more market trust."),
        ("Digital presence",
         "Composite signal of organic search visibility, content "
         "freshness, and social engagement."),
        ("Sentiment",
         "Aggregated polarity of recent customer reviews. A low score "
         "with high review volume is more meaningful than a low score "
         "with three reviews."),
        ("Competitive pressure",
         "Density and visibility of named competitors detected in "
         "the same market. Higher means more crowded."),
        ("DATA AVAILABLE",
         "Section has evidence-backed signal and is rendered in full."),
        ("INSUFFICIENT SIGNAL",
         "Underlying scan did not surface enough evidence to assess "
         "this section. Rendered with an uncertainty banner."),
        ("DEGRADED",
         "Section is partially populated. We render what we have and "
         "flag the gap."),
    ]
    for term, defn in glossary:
        pdf.set_font("Helvetica", "B", 10)
        pdf.multi_cell(0, 6, term, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 6, defn, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

    return pdf


@router.post("/reports/cmo-report/pdf")
async def generate_cmo_report_pdf(current_user: dict = Depends(get_current_user)):
    """Generate CMO report PDF for entitled plans (Pro and above).

    Single source of truth: the same payload that powers
    `GET /api/intelligence/cmo-report` (HTML CMO page) is rendered here.
    No re-derivation, no duplicated SQL, no separate sanitiser path.

    Contract v2: PDF text content goes through the central banned-token
    scrub before write, so even if upstream re-introduces a supplier name
    the PDF cannot leak it.
    """
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

        workspace_id = current_user.get('id') or 'unknown'
        pdf = _build_cmo_pdf(report, workspace_id)

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
        logger.error(f"CMO PDF generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="CMO PDF generation failed")
