"""
Supabase Google Drive Helpers
100% PostgreSQL storage
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


# =============================================
# MERGE INTEGRATIONS (CONNECTION MANAGEMENT)
# =============================================

async def store_merge_integration(supabase_client, integration_data: Dict[str, Any]) -> bool:
    """Store Merge.dev integration connection in Supabase"""
    try:
        result = supabase_client.table("merge_integrations").upsert(
            integration_data,
            on_conflict="account_id,integration_slug,account_token"
        ).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error storing merge integration: {e}")
        return False


async def get_user_merge_integrations(
    supabase_client,
    user_id: str,
    integration_category: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get user's Merge.dev integrations from Supabase"""
    try:
        query = supabase_client.table("merge_integrations").select("*").eq("user_id", user_id)
        
        if integration_category:
            query = query.eq("integration_category", integration_category)
        
        result = query.order("connected_at", desc=True).execute()
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching merge integrations: {e}")
        return []


async def get_merge_integration_by_token(
    supabase_client,
    account_token: str
) -> Optional[Dict[str, Any]]:
    """Get integration by account token"""
    try:
        result = supabase_client.table("merge_integrations").select("*").eq("account_token", account_token).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error fetching integration by token: {e}")
        return None


async def update_merge_integration_sync(
    supabase_client,
    account_token: str,
    sync_data: Dict[str, Any]
) -> bool:
    """Update integration sync status"""
    payload_variants = [
        dict(sync_data or {}),
        {
            k: v
            for k, v in dict(sync_data or {}).items()
            if k not in {"sync_stats", "sync_status", "last_attempt_at", "integration_name"}
        },
        {
            k: v
            for k, v in dict(sync_data or {}).items()
            if k in {"status", "last_sync_at", "error_message"}
        },
    ]
    last_error = None
    for payload in payload_variants:
        if not payload:
            continue
        try:
            result = (
                supabase_client.table("merge_integrations")
                .update(payload)
                .eq("account_token", account_token)
                .execute()
            )
            return bool(result.data is not None)
        except Exception as e:
            last_error = e
            continue
    logger.error(f"Error updating integration sync: {last_error}")
    return False


# =============================================
# GOOGLE DRIVE FILES (DATA STORAGE)
# =============================================

async def store_drive_file(supabase_client, file_data: Dict[str, Any]) -> bool:
    """Store Google Drive file in Supabase"""
    try:
        result = supabase_client.table("google_drive_files").upsert(
            file_data,
            on_conflict="account_id,merge_file_id"
        ).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error storing drive file: {e}")
        return False


async def store_drive_files_batch(supabase_client, files: List[Dict[str, Any]]) -> int:
    """Store multiple Google Drive files in batch"""
    try:
        result = supabase_client.table("google_drive_files").upsert(
            files,
            on_conflict="account_id,merge_file_id"
        ).execute()
        return len(result.data) if result.data else 0
    except Exception as e:
        logger.error(f"Error storing drive files batch: {e}")
        return 0


async def get_user_drive_files(
    supabase_client,
    user_id: str,
    limit: int = 50,
    business_relevance: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get user's Google Drive files from Supabase"""
    try:
        query = supabase_client.table("google_drive_files").select("*").eq("user_id", user_id)
        
        if business_relevance:
            query = query.eq("business_relevance", business_relevance)
        
        result = query.order("modified_at", desc=True).limit(limit).execute()
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching drive files: {e}")
        return []


async def count_user_drive_files(supabase_client, user_id: str) -> int:
    """Count user's Google Drive files"""
    try:
        result = supabase_client.table("google_drive_files").select(
            "id",
            count="exact"
        ).eq("user_id", user_id).execute()
        return result.count if result.count is not None else 0
    except Exception as e:
        logger.error(f"Error counting drive files: {e}")
        return 0


async def delete_user_drive_files(supabase_client, user_id: str) -> int:
    """Delete all Google Drive files for a user"""
    try:
        result = supabase_client.table("google_drive_files").delete().eq("user_id", user_id).execute()
        return len(result.data) if result.data else 0
    except Exception as e:
        logger.error(f"Error deleting drive files: {e}")
        return 0


async def get_drive_file_by_id(supabase_client, file_id: str) -> Optional[Dict[str, Any]]:
    """Get specific Google Drive file by ID"""
    try:
        result = supabase_client.table("google_drive_files").select("*").eq("id", file_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error fetching drive file: {e}")
        return None


async def get_drive_scope_policy(supabase_client, user_id: str) -> Optional[Dict[str, Any]]:
    try:
        result = (
            supabase_client.table("drive_scope_policy")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else None
    except Exception as e:
        logger.warning(f"Drive scope policy lookup failed (table may be absent): {e}")
        return None


async def upsert_drive_scope_policy(
    supabase_client,
    *,
    user_id: str,
    allow_all_files: bool,
    folder_ids: List[str],
    file_type_includes: List[str],
    file_type_excludes: List[str],
) -> bool:
    payload = {
        "user_id": user_id,
        "allow_all_files": bool(allow_all_files),
        "folder_ids": folder_ids or [],
        "file_type_includes": file_type_includes or [],
        "file_type_excludes": file_type_excludes or [],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase_client.table("drive_scope_policy").upsert(payload, on_conflict="user_id").execute()
        return True
    except Exception as e:
        logger.error(f"Drive scope policy upsert failed: {e}")
        return False
