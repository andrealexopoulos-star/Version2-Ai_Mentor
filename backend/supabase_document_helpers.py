"""
Supabase Documents Helper Functions
Supabase-backed document operations
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


async def create_document_supabase(supabase_client, doc_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Create a new document in Supabase"""
    try:
        result = supabase_client.table("documents").insert(doc_data).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Error creating document: {e}")
        return None


async def get_user_documents_supabase(
    supabase_client,
    user_id: str,
    document_type: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Get user's documents from Supabase"""
    try:
        query = supabase_client.table("documents").select("*").eq("user_id", user_id)
        
        if document_type:
            query = query.eq("document_type", document_type)
        
        result = query.order("created_at", desc=True).limit(limit).execute()
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        return []


async def get_document_by_id_supabase(
    supabase_client,
    doc_id: str
) -> Optional[Dict[str, Any]]:
    """Get a specific document by ID"""
    try:
        result = supabase_client.table("documents").select("*").eq("id", doc_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error fetching document: {e}")
        return None


async def update_document_supabase(
    supabase_client,
    doc_id: str,
    updates: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Update a document"""
    try:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = supabase_client.table("documents").update(updates).eq("id", doc_id).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Error updating document: {e}")
        return None


async def delete_document_supabase(
    supabase_client,
    doc_id: str,
    user_id: str
) -> bool:
    """Delete a document (with user verification)"""
    try:
        result = supabase_client.table("documents").delete().eq("id", doc_id).eq("user_id", user_id).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        return False


async def count_user_documents_supabase(
    supabase_client,
    user_id: str
) -> int:
    """Count user's documents"""
    try:
        result = supabase_client.table("documents").select("id", count="exact").eq("user_id", user_id).execute()
        return result.count if result.count is not None else 0
    except Exception as e:
        logger.error(f"Error counting documents: {e}")
        return 0


async def delete_user_documents_supabase(
    supabase_client,
    user_id: str
) -> int:
    """Delete all documents for a user"""
    try:
        result = supabase_client.table("documents").delete().eq("user_id", user_id).execute()
        return len(result.data) if result.data else 0
    except Exception as e:
        logger.error(f"Error deleting user documents: {e}")
        return 0
