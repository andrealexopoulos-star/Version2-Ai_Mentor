"""
Supabase Email & Calendar Helper Functions
Replaces MongoDB operations with Supabase queries
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# =============================================
# EMAIL OPERATIONS
# =============================================

async def store_email_supabase(supabase_client, email_data: Dict[str, Any]) -> bool:
    """Store email in Supabase outlook_emails table (provider-agnostic)"""
    try:
        # Upsert using provider-agnostic constraint
        # Constraint: (account_id, provider, graph_message_id)
        result = supabase_client.table("outlook_emails").upsert(
            email_data,
            on_conflict="account_id,provider,graph_message_id"
        ).execute()
        
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error storing email in Supabase: {e}")
        return False


async def get_user_emails_supabase(
    supabase_client, 
    user_id: str, 
    limit: int = 50,
    folder: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get user's emails from Supabase"""
    try:
        query = supabase_client.table("outlook_emails").select("*").eq("user_id", user_id)
        
        if folder:
            query = query.eq("folder", folder)
        
        result = query.order("received_date", desc=True).limit(limit).execute()
        
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching emails from Supabase: {e}")
        return []


async def count_user_emails_supabase(supabase_client, user_id: str) -> int:
    """Count user's emails in Supabase"""
    try:
        result = supabase_client.table("outlook_emails").select(
            "id",
            count="exact"
        ).eq("user_id", user_id).execute()
        
        return result.count if result.count is not None else 0
    except Exception as e:
        logger.error(f"Error counting emails: {e}")
        return 0


async def delete_user_emails_supabase(supabase_client, user_id: str) -> int:
    """Delete all emails for a user"""
    try:
        result = supabase_client.table("outlook_emails").delete().eq("user_id", user_id).execute()
        return len(result.data) if result.data else 0
    except Exception as e:
        logger.error(f"Error deleting emails: {e}")
        return 0


async def find_email_by_id_supabase(supabase_client, email_id: str) -> Optional[Dict[str, Any]]:
    """Find a specific email by ID"""
    try:
        result = supabase_client.table("outlook_emails").select("*").eq("id", email_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error finding email: {e}")
        return None


async def find_email_by_graph_message_id_supabase(
    supabase_client,
    user_id: str,
    graph_message_id: str,
) -> Optional[Dict[str, Any]]:
    """Find a user's email by provider message ID."""
    try:
        result = (
            supabase_client
            .table("outlook_emails")
            .select("*")
            .eq("user_id", user_id)
            .eq("graph_message_id", graph_message_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Error finding email by graph_message_id: {e}")
        return None


# =============================================
# SYNC JOB OPERATIONS
# =============================================

async def create_sync_job_supabase(supabase_client, job_data: Dict[str, Any]) -> bool:
    """Create a new sync job"""
    try:
        result = supabase_client.table("outlook_sync_jobs").insert(job_data).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error creating sync job: {e}")
        return False


async def get_sync_job_supabase(supabase_client, job_id: str) -> Optional[Dict[str, Any]]:
    """Get sync job by job_id"""
    try:
        result = supabase_client.table("outlook_sync_jobs").select("*").eq("job_id", job_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error getting sync job: {e}")
        return None


async def update_sync_job_supabase(
    supabase_client, 
    job_id: str, 
    updates: Dict[str, Any]
) -> bool:
    """Update sync job status/progress"""
    try:
        result = supabase_client.table("outlook_sync_jobs").update(updates).eq("job_id", job_id).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error updating sync job: {e}")
        return False


async def delete_user_sync_jobs_supabase(supabase_client, user_id: str) -> int:
    """Delete all sync jobs for a user"""
    try:
        result = supabase_client.table("outlook_sync_jobs").delete().eq("user_id", user_id).execute()
        return len(result.data) if result.data else 0
    except Exception as e:
        logger.error(f"Error deleting sync jobs: {e}")
        return 0


async def find_user_sync_job_supabase(
    supabase_client, 
    user_id: str, 
    status: str
) -> Optional[Dict[str, Any]]:
    """Find a user's sync job by status"""
    try:
        result = supabase_client.table("outlook_sync_jobs").select("*").eq(
            "user_id", user_id
        ).eq("status", status).order("started_at", desc=True).limit(1).execute()
        
        return result.data[0] if result.data and len(result.data) > 0 else None
    except Exception as e:
        logger.error(f"Error finding sync job: {e}")
        return None


# =============================================
# CALENDAR OPERATIONS
# =============================================

async def store_calendar_event_supabase(supabase_client, event_data: Dict[str, Any]) -> bool:
    """Store calendar event in Supabase"""
    try:
        result = supabase_client.table("outlook_calendar_events").upsert(
            event_data,
            on_conflict="user_id,graph_event_id"
        ).execute()
        
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error storing calendar event: {e}")
        return False


async def get_user_calendar_events_supabase(
    supabase_client,
    user_id: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Get user's calendar events"""
    try:
        result = supabase_client.table("outlook_calendar_events").select("*").eq(
            "user_id", user_id
        ).order("start_time", desc=True).limit(limit).execute()
        
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching calendar events: {e}")
        return []


async def store_calendar_events_batch_supabase(
    supabase_client,
    events_data: List[Dict[str, Any]]
) -> int:
    """Store multiple calendar events at once"""
    try:
        if not events_data:
            return 0
            
        # Upsert all events
        result = supabase_client.table("outlook_calendar_events").upsert(
            events_data,
            on_conflict="user_id,graph_event_id"
        ).execute()
        
        return len(result.data) if result.data else 0
    except Exception as e:
        logger.error(f"Error batch storing calendar events: {e}")
        return 0


async def delete_user_calendar_events_supabase(supabase_client, user_id: str) -> int:
    """Delete all calendar events for a user"""
    try:
        result = supabase_client.table("outlook_calendar_events").delete().eq("user_id", user_id).execute()
        return len(result.data) if result.data else 0
    except Exception as e:
        logger.error(f"Error deleting calendar events: {e}")
        return 0

