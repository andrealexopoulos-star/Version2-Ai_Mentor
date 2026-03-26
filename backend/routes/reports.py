"""Report generation routes — PDF export with deterministic data only."""
import os
import json
import logging
import re
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)
router = APIRouter()

# Auth dependency
from routes.auth import get_current_user
from routes.deps import get_sb, check_rate_limit


class PDFRequest(BaseModel):
    report_type: Optional[str] = "intelligence_report"
    integration_list: List[dict] = []
    events_count: int = 0
    avg_confidence: int = 0
    wow_full: Optional[Dict[str, Any]] = None
    identity_signals: Optional[Dict[str, Any]] = None


def _is_non_empty(value):
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return len(value) > 0
    return True


def _build_social_payload(identity_signals: Dict[str, Any]) -> Dict[str, Any]:
    social = (identity_signals or {}).get("social_enrichment") or {}
    keys = ["linkedin", "facebook", "instagram", "twitter", "youtube"]
    return {
        **{k: (social.get(k) or "") for k in keys},
        "source": social.get("source") or "search",
        "social_status": social.get("social_status") or "not_detected",
    }


def _build_deep_cmo_report_payload(req: PDFRequest, user_id: str) -> Dict[str, Any]:
    wow_full = req.wow_full or {}
    identity = req.identity_signals or {}
    required_any = [
        wow_full.get("business_name"),
        wow_full.get("main_products_services"),
        wow_full.get("target_market"),
        wow_full.get("unique_value_proposition"),
        wow_full.get("cmo_executive_brief"),
    ]
    if not any(_is_non_empty(v) for v in required_any):
        raise HTTPException(status_code=422, detail="Insufficient verified data")

    social = _build_social_payload(identity)
    return {
        "user_id": user_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "business_name": wow_full.get("business_name") or "",
        "what_you_do": wow_full.get("main_products_services") or "",
        "who_you_serve": wow_full.get("target_market") or wow_full.get("ideal_customer_profile") or "",
        "what_sets_you_apart": wow_full.get("unique_value_proposition") or "",
        "executive_narrative": wow_full.get("cmo_executive_brief") or wow_full.get("executive_summary") or "",
        "roadmap_7_day": wow_full.get("cmo_priority_actions", [])[0] if isinstance(wow_full.get("cmo_priority_actions"), list) and wow_full.get("cmo_priority_actions") else "",
        "roadmap_30_day": wow_full.get("cmo_priority_actions", [])[1] if isinstance(wow_full.get("cmo_priority_actions"), list) and len(wow_full.get("cmo_priority_actions")) > 1 else "",
        "roadmap_90_day": wow_full.get("cmo_priority_actions", [])[2] if isinstance(wow_full.get("cmo_priority_actions"), list) and len(wow_full.get("cmo_priority_actions")) > 2 else "",
        "abn_validation": {
            "abn_verified": bool(identity.get("abn_verified")),
            "abn_source": identity.get("abn_source") or "gud_api",
            "legal_name": identity.get("legal_name") or "",
            "entity_status": identity.get("entity_status") or "",
            "registered_address": identity.get("registered_address") or "",
            "abn_status": identity.get("abn_status") or "not_found",
        },
        "social_validation": social,
        "wow_full": wow_full,
        "identity_signals": identity,
    }


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
        from fpdf import FPDF
        sb = get_sb()
        user_id = current_user.get("id", "unknown")
        await check_rate_limit(user_id, "reports_monthly", sb=sb)

        is_deep_cmo = (req.report_type or "intelligence_report") == "deep_cmo"
        deep_payload = None
        source_hash = None
        deep_report_id = None
        if is_deep_cmo:
            deep_payload = _build_deep_cmo_report_payload(req, user_id)
            source_hash = hashlib.sha256(
                json.dumps(deep_payload, sort_keys=True, default=str).encode("utf-8")
            ).hexdigest()
            created = sb.table("deep_cmo_reports").insert({
                "user_id": user_id,
                "report_type": "deep_cmo",
                "status": "generating",
                "abn_status": deep_payload["abn_validation"]["abn_status"],
                "social_status": deep_payload["social_validation"]["social_status"],
                "source_hash": source_hash,
                "source_payload": deep_payload,
                "quota_month_key": datetime.now(timezone.utc).strftime("%Y-%m"),
            }).execute()
            if created.data:
                deep_report_id = created.data[0].get("id")

        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # Header
        pdf.set_font("Helvetica", "B", 18)
        pdf.cell(0, 12, "BIQc Deep CMO Report" if is_deep_cmo else "BIQc Intelligence Report", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(100, 100, 100)

        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        workspace_id = user_id

        pdf.cell(0, 6, f"Workspace: {workspace_id}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Generated: {generated_at}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Report Version: 1", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(8)

        # Data Source Summary
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "Data Source Summary", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)

        if is_deep_cmo:
            abn_validation = deep_payload["abn_validation"]
            social_validation = deep_payload["social_validation"]
            pdf.cell(0, 6, f"ABN status: {abn_validation.get('abn_status')}", new_x="LMARGIN", new_y="NEXT")
            pdf.cell(0, 6, f"Social status: {social_validation.get('social_status')}", new_x="LMARGIN", new_y="NEXT")
            pdf.cell(0, 6, f"Social source: {social_validation.get('source')}", new_x="LMARGIN", new_y="NEXT")
        else:
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

        if is_deep_cmo:
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(0, 10, "Executive Narrative", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            narrative = deep_payload.get("executive_narrative") or "Insufficient verified data"
            for line in str(narrative).split("\n"):
                pdf.multi_cell(0, 6, line)
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(0, 10, "Roadmap (7 / 30 / 90)", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 6, f"7-day: {deep_payload.get('roadmap_7_day') or 'Insufficient verified data'}", new_x="LMARGIN", new_y="NEXT")
            pdf.cell(0, 6, f"30-day: {deep_payload.get('roadmap_30_day') or 'Insufficient verified data'}", new_x="LMARGIN", new_y="NEXT")
            pdf.cell(0, 6, f"90-day: {deep_payload.get('roadmap_90_day') or 'Insufficient verified data'}", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(4)
        else:
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

        if not is_deep_cmo and req.events_count > 0:
            pdf.cell(0, 6, f"Average confidence score: {req.avg_confidence}%", new_x="LMARGIN", new_y="NEXT")
        elif is_deep_cmo:
            abn_validation = deep_payload["abn_validation"]
            social_validation = deep_payload["social_validation"]
            pdf.cell(0, 6, f"ABN verified: {'Yes' if abn_validation.get('abn_verified') else 'No'}", new_x="LMARGIN", new_y="NEXT")
            pdf.cell(0, 6, f"Social profiles detected: {social_validation.get('social_status')}", new_x="LMARGIN", new_y="NEXT")
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
            "report_type": "deep_cmo_report" if is_deep_cmo else "intelligence_report",
            "integrations": req.integration_list if not is_deep_cmo else [],
            "events_count": req.events_count if not is_deep_cmo else 0,
            "avg_confidence": req.avg_confidence if not is_deep_cmo else None,
            "source_hash": source_hash,
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
            sb.table("report_exports").insert({
                "workspace_id": workspace_id,
                "report_type": "deep_cmo_report" if is_deep_cmo else "intelligence_report",
                "version": 1,
                "data_snapshot": snapshot_data,
            }).execute()
            if is_deep_cmo and deep_report_id:
                sb.table("deep_cmo_reports").update({
                    "status": "generated",
                    "pdf_filename": filename,
                    "pdf_url": f"{os.environ.get('BACKEND_URL', '')}/api/reports/download/{filename}",
                    "report_payload": snapshot_data,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", deep_report_id).execute()
        except Exception as e:
            logger.warning(f"Failed to store report export record: {e}")

        # Return the file path (in production, this would be a storage URL)
        backend_url = os.environ.get("BACKEND_URL", "")
        return {
            "status": "generated",
            "filename": filename,
            "pdf_url": f"{backend_url}/api/reports/download/{filename}",
            "data_snapshot": snapshot_data,
            "deep_report_id": deep_report_id,
        }

    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library not available")
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/deep-cmo/history")
async def deep_cmo_history(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    sb = get_sb()
    rows = sb.table("deep_cmo_reports").select(
        "id, created_at, generated_at, status, abn_status, social_status, pdf_filename, pdf_url"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(30).execute()
    return {"items": rows.data or []}


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
    if not re.fullmatch(r"biqc_report_[a-zA-Z0-9]{1,8}_\d{8}_\d{6}\.pdf", safe_filename):
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
