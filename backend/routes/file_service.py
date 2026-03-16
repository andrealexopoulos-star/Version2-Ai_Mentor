"""BIQc File Generation + Storage Service.

Generates: logos (via AI), documents (PDF/text), reports.
Stores in Supabase Storage buckets.
Downloads tracked in generated_files table.
Integrated with SoundBoard for conversational file creation.
"""
import os
import io
import time
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
from guardrails import sanitise_output, log_llm_call_to_db
from biqc_jobs import enqueue_job

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")


class GenerateFileRequest(BaseModel):
    file_type: str  # 'logo', 'document', 'report', 'social_image'
    prompt: str
    format: str = 'png'  # png, pdf, svg, txt, html
    conversation_id: str = ''


class DownloadRequest(BaseModel):
    file_id: str


def _get_storage():
    from supabase_client import get_supabase_client
    return get_supabase_client()


async def _generate_image(prompt: str, size: str = "1024x1024") -> bytes:
    """Generate image via OpenAI DALL-E / GPT Image."""
    try:
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_KEY)
        response = await client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            n=1,
            size=size,
            response_format="b64_json",
        )
        import base64
        return base64.b64decode(response.data[0].b64_json)
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)[:100]}")


async def _generate_document(prompt: str, doc_type: str) -> str:
    """Generate text document via LLM."""
    from core.llm_router import llm_chat

    system_prompts = {
        'document': 'You are a professional document writer. Generate clear, well-structured business documents. Use markdown formatting.',
        'report': 'You are a business intelligence report writer. Generate data-driven reports with sections, findings, and recommendations. Use markdown.',
        'social_image': 'You are a creative director. Generate a detailed image prompt for a social media graphic. Be specific about colors, layout, text placement, and style.',
    }


    start = time.time()
    response = await llm_chat(
        system_message=system_prompts.get(doc_type, system_prompts['document']),
        user_message=prompt,
        model="gpt-4o",
        api_key=OPENAI_KEY,
    )
    elapsed = int((time.time() - start) * 1000)

    response = sanitise_output(response)
    log_llm_call_to_db(model_name='gpt-4o', endpoint=f'files/generate_{doc_type}', latency_ms=elapsed, total_tokens=(len(prompt) + len(response)) // 4)

    return response


def _upload_to_storage(sb, tenant_id: str, bucket: str, file_name: str, content: bytes, content_type: str) -> str:
    """Upload file to Supabase Storage. Returns storage path."""
    path = f"{tenant_id}/{file_name}"
    try:
        sb.storage.from_(bucket).upload(path, content, {"content-type": content_type})
    except Exception as e:
        if 'already exists' in str(e).lower() or 'Duplicate' in str(e):
            sb.storage.from_(bucket).update(path, content, {"content-type": content_type})
        else:
            raise
    return path


async def execute_file_generation_job(payload: dict) -> dict:
    """Generate a file (logo, document, report) and store in Supabase Storage."""
    req = GenerateFileRequest(
        file_type=str(payload.get('file_type') or ''),
        prompt=str(payload.get('prompt') or ''),
        format=str(payload.get('format') or 'png'),
        conversation_id=str(payload.get('conversation_id') or ''),
    )
    current_user = payload.get('current_user') or {'id': payload.get('user_id')}
    tenant_id = current_user['id']
    sb = _get_storage()
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')

    if req.file_type == 'logo':
        # Generate logo image
        logo_prompt = f"Professional business logo design: {req.prompt}. Clean, modern, minimal. White background. No text unless specified."
        image_bytes = await _generate_image(logo_prompt)
        file_name = f"logo_{timestamp}.png"
        content_type = "image/png"
        storage_path = _upload_to_storage(sb, tenant_id, 'user-files', file_name, image_bytes, content_type)
        size_bytes = len(image_bytes)

    elif req.file_type == 'social_image':
        # Generate social media image
        image_bytes = await _generate_image(req.prompt, size="1024x1024")
        file_name = f"social_{timestamp}.png"
        content_type = "image/png"
        storage_path = _upload_to_storage(sb, tenant_id, 'user-files', file_name, image_bytes, content_type)
        size_bytes = len(image_bytes)

    elif req.file_type in ('document', 'report'):
        # Generate text document
        content = await _generate_document(req.prompt, req.file_type)
        bucket = 'reports' if req.file_type == 'report' else 'user-files'

        if req.format == 'pdf':
            # Convert markdown to PDF
            try:
                from fpdf import FPDF
                pdf = FPDF()
                pdf.add_page()
                pdf.set_auto_page_break(auto=True, margin=15)
                pdf.set_font("Helvetica", size=11)
                for line in content.split('\n'):
                    line = line.strip()
                    if line.startswith('# '):
                        pdf.set_font("Helvetica", "B", 16)
                        pdf.cell(0, 10, line[2:], new_x="LMARGIN", new_y="NEXT")
                        pdf.set_font("Helvetica", size=11)
                    elif line.startswith('## '):
                        pdf.set_font("Helvetica", "B", 13)
                        pdf.cell(0, 8, line[3:], new_x="LMARGIN", new_y="NEXT")
                        pdf.set_font("Helvetica", size=11)
                    elif line:
                        pdf.multi_cell(0, 6, line)
                    else:
                        pdf.ln(4)
                pdf_bytes = pdf.output()
                file_name = f"{req.file_type}_{timestamp}.pdf"
                content_type = "application/pdf"
                storage_path = _upload_to_storage(sb, tenant_id, bucket, file_name, pdf_bytes, content_type)
                size_bytes = len(pdf_bytes)
            except Exception:
                # Fallback to text
                file_bytes = content.encode('utf-8')
                file_name = f"{req.file_type}_{timestamp}.md"
                content_type = "text/plain"
                storage_path = _upload_to_storage(sb, tenant_id, bucket, file_name, file_bytes, content_type)
                size_bytes = len(file_bytes)
        else:
            file_bytes = content.encode('utf-8')
            ext = 'md' if req.format == 'txt' else req.format
            file_name = f"{req.file_type}_{timestamp}.{ext}"
            content_type = "text/plain"
            storage_path = _upload_to_storage(sb, tenant_id, 'user-files' if req.file_type != 'report' else 'reports', file_name, file_bytes, content_type)
            size_bytes = len(file_bytes)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown file type: {req.file_type}")

    # Register in generated_files
    file_record = {
        'tenant_id': tenant_id,
        'file_name': file_name,
        'file_type': req.file_type,
        'storage_path': storage_path,
        'bucket': 'reports' if req.file_type == 'report' else 'user-files',
        'size_bytes': size_bytes,
        'generated_by': 'soundboard' if req.conversation_id else 'direct',
        'source_conversation_id': req.conversation_id or None,
        'metadata': {'prompt': req.prompt[:200], 'format': req.format},
    }
    result = sb.table('generated_files').insert(file_record).execute()
    file_id = result.data[0]['id'] if result.data else None

    # Generate signed download URL (1 hour expiry)
    bucket = file_record['bucket']
    signed = sb.storage.from_(bucket).create_signed_url(storage_path, 3600)
    download_url = signed.get('signedURL', signed.get('signedUrl', ''))

    return {
        'status': 'generated',
        'file_id': file_id,
        'file_name': file_name,
        'file_type': req.file_type,
        'size_bytes': size_bytes,
        'download_url': download_url,
        'storage_path': storage_path,
    }


@router.post("/files/generate")
async def generate_file(req: GenerateFileRequest, current_user: dict = Depends(get_current_user)):
    queued = await enqueue_job(
        "file-generation",
        {
            'file_type': req.file_type,
            'prompt': req.prompt,
            'format': req.format,
            'conversation_id': req.conversation_id,
            'user_id': current_user.get('id'),
            'workspace_id': current_user.get('id'),
            'current_user': {'id': current_user.get('id')},
        },
        company_id=current_user.get('id'),
        window_seconds=180,
    )

    if queued.get('queued'):
        return {
            'status': 'queued',
            'job_type': 'file-generation',
            'job_id': queued.get('job_id'),
        }

    return await execute_file_generation_job({
        'file_type': req.file_type,
        'prompt': req.prompt,
        'format': req.format,
        'conversation_id': req.conversation_id,
        'user_id': current_user.get('id'),
        'current_user': {'id': current_user.get('id')},
    })


@router.get("/files/list")
async def list_files(current_user: dict = Depends(get_current_user)):
    """List all generated files for the user."""
    sb = _get_storage()
    result = sb.table('generated_files') \
        .select('id, file_name, file_type, size_bytes, generated_by, created_at, metadata') \
        .eq('tenant_id', current_user['id']) \
        .order('created_at', desc=True) \
        .limit(50).execute()
    return {'files': result.data or []}


@router.get("/files/download/{file_id}")
async def get_download_url(file_id: str, current_user: dict = Depends(get_current_user)):
    """Get signed download URL for a file."""
    sb = _get_storage()
    file = sb.table('generated_files') \
        .select('storage_path, bucket, file_name') \
        .eq('id', file_id) \
        .eq('tenant_id', current_user['id']) \
        .single().execute()

    if not file.data:
        raise HTTPException(status_code=404, detail="File not found")

    # Increment download count
    sb.rpc('increment_download_count', {'p_file_id': file_id}).execute() if False else None
    sb.table('generated_files').update({'download_count': 1}).eq('id', file_id).execute()

    signed = sb.storage.from_(file.data['bucket']).create_signed_url(file.data['storage_path'], 3600)
    url = signed.get('signedURL', signed.get('signedUrl', ''))

    return {'download_url': url, 'file_name': file.data['file_name']}


@router.get("/files/reports")
async def list_reports(current_user: dict = Depends(get_current_user)):
    """List all reports (for Reports tab)."""
    sb = _get_storage()
    result = sb.table('generated_files') \
        .select('id, file_name, file_type, size_bytes, generated_by, source_conversation_id, created_at, metadata') \
        .eq('tenant_id', current_user['id']) \
        .in_('file_type', ['report', 'document']) \
        .order('created_at', desc=True) \
        .limit(50).execute()
    return {'reports': result.data or []}
