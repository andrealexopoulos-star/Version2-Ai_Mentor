"""
Data Center Routes — File upload, download, management
Extracted from server.py.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional
from datetime import datetime, timezone
from collections import Counter
import uuid
import base64

from routes.deps import get_current_user, get_sb, logger
from supabase_intelligence_helpers import (
    create_data_file_supabase,
    get_user_data_files_supabase,
    count_user_data_files_supabase,
    get_business_profile_supabase,
)

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt', 'md', 'json']


@router.post("/data-center/upload")
async def upload_data_file(
    file: UploadFile = File(...),
    category: str = Form(...),
    description: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    try:
        sb = get_sb()
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Max 10MB allowed.")

        ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

        from core.helpers import extract_file_content
        extracted_text = await extract_file_content(file.filename, content)

        now = datetime.now(timezone.utc).isoformat()
        file_id = str(uuid.uuid4())
        file_doc = {
            "id": file_id, "user_id": current_user["id"],
            "filename": file.filename, "file_type": ext, "category": category,
            "description": description, "extracted_text": extracted_text,
            "file_content": base64.b64encode(content).decode('utf-8'),
            "file_size": len(content), "created_at": now
        }
        await create_data_file_supabase(sb, file_doc)
        return {
            "id": file_id, "filename": file.filename, "category": category,
            "file_size": len(content),
            "extracted_text_preview": extracted_text[:500] if extracted_text else None,
            "message": "File uploaded successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[upload-data-file] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-center/files")
async def get_data_files(category: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    try:
        sb = get_sb()
        query = sb.table("data_files").select(
            "id,filename,file_type,category,description,extracted_text,file_size,created_at"
        ).eq("user_id", current_user["id"])
        if category:
            query = query.eq("category", category)
        result = query.order("created_at", desc=True).limit(100).execute()
        return result.data or []
    except Exception as e:
        logger.error(f"[get-data-files] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-center/files/{file_id}")
async def get_data_file(file_id: str, current_user: dict = Depends(get_current_user)):
    try:
        sb = get_sb()
        result = sb.table("data_files").select(
            "id,filename,file_type,category,description,extracted_text,file_size,created_at"
        ).eq("id", file_id).eq("user_id", current_user["id"]).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="File not found")
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[get-data-file] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-center/files/{file_id}/download")
async def download_data_file(file_id: str, current_user: dict = Depends(get_current_user)):
    try:
        sb = get_sb()
        result = sb.table("data_files").select(
            "filename,file_content,file_type"
        ).eq("id", file_id).eq("user_id", current_user["id"]).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="File not found")
        return {"filename": result.data["filename"], "content": result.data["file_content"], "file_type": result.data["file_type"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[download-data-file] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/data-center/files/{file_id}")
async def delete_data_file(file_id: str, current_user: dict = Depends(get_current_user)):
    try:
        sb = get_sb()
        result = sb.table("data_files").delete().eq("id", file_id).eq("user_id", current_user["id"]).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="File not found")
        return {"message": "File deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[delete-data-file] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-center/categories")
async def get_data_categories(current_user: dict = Depends(get_current_user)):
    try:
        sb = get_sb()
        result = sb.table("data_files").select("category").eq("user_id", current_user["id"]).execute()
        categories_raw = result.data or []
        counter = Counter([c.get("category") for c in categories_raw if c.get("category")])
        return [{"category": cat, "count": cnt} for cat, cnt in sorted(counter.items(), key=lambda x: x[1], reverse=True)]
    except Exception as e:
        logger.error(f"[get-data-categories] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-center/stats")
async def get_data_center_stats(current_user: dict = Depends(get_current_user)):
    try:
        sb = get_sb()
        total_files = await count_user_data_files_supabase(sb, current_user["id"])
        size_result = sb.table("data_files").select("file_size").eq("user_id", current_user["id"]).execute()
        total_size = sum([r.get("file_size", 0) or 0 for r in (size_result.data or [])])
        categories = await get_data_categories(current_user)
        profile = await get_business_profile_supabase(sb, current_user["id"])
        from routes.profile import calculate_profile_completeness
        return {
            "total_files": total_files, "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "categories": categories,
            "has_business_profile": profile is not None,
            "profile_completeness": calculate_profile_completeness(profile) if profile else 0
        }
    except Exception as e:
        logger.error(f"[get-data-center-stats] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
