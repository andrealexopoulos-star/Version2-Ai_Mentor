"""
Supabase Intelligence & Support Collections Helpers
Replaces MongoDB operations for intelligence, chat, files, analyses
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# =============================================
# EMAIL INTELLIGENCE
# =============================================

async def get_email_intelligence_supabase(supabase_client, user_id: str) -> Optional[Dict[str, Any]]:
    """Get email intelligence for user"""
    try:
        result = supabase_client.table("email_intelligence").select("*").eq("user_id", user_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        if "PGRST116" in str(e):  # No rows returned
            return None
        logger.error(f"Error fetching email intelligence: {e}")
        return None


async def update_email_intelligence_supabase(supabase_client, user_id: str, intel_data: Dict[str, Any]) -> bool:
    """Update or create email intelligence"""
    try:
        intel_data["user_id"] = user_id
        intel_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = supabase_client.table("email_intelligence").upsert(intel_data, on_conflict="user_id").execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error updating email intelligence: {e}")
        return False


# =============================================
# CALENDAR INTELLIGENCE
# =============================================

async def get_calendar_intelligence_supabase(supabase_client, user_id: str) -> Optional[Dict[str, Any]]:
    """Get calendar intelligence for user"""
    try:
        result = supabase_client.table("calendar_intelligence").select("*").eq("user_id", user_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        if "PGRST116" in str(e):
            return None
        logger.error(f"Error fetching calendar intelligence: {e}")
        return None


async def update_calendar_intelligence_supabase(supabase_client, user_id: str, intel_data: Dict[str, Any]) -> bool:
    """Update or create calendar intelligence"""
    try:
        intel_data["user_id"] = user_id
        
        result = supabase_client.table("calendar_intelligence").upsert(intel_data, on_conflict="user_id").execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error updating calendar intelligence: {e}")
        return False


# =============================================
# EMAIL PRIORITY ANALYSIS
# =============================================

async def get_priority_analysis_supabase(supabase_client, user_id: str) -> Optional[Dict[str, Any]]:
    """Get email priority analysis for user"""
    try:
        result = supabase_client.table("email_priority_analysis").select("*").eq("user_id", user_id).single().execute()
        if not result.data:
            return None

        row = result.data

        # New schema shape: row.analysis holds full JSON payload
        if isinstance(row.get("analysis"), dict):
            return row

        # Legacy schema shape: high_priority/medium_priority/low_priority as direct columns
        if any(key in row for key in ("high_priority", "medium_priority", "low_priority")):
            analysis = {
                "high_priority": row.get("high_priority") or [],
                "medium_priority": row.get("medium_priority") or [],
                "low_priority": row.get("low_priority") or [],
                "strategic_insights": row.get("strategic_insights") or "",
            }
            return {
                "user_id": row.get("user_id"),
                "analysis": analysis,
                "emails_analyzed": row.get("emails_analyzed") or (
                    len(analysis["high_priority"]) + len(analysis["medium_priority"]) + len(analysis["low_priority"])
                ),
                "analyzed_at": row.get("analyzed_at"),
                "created_at": row.get("created_at"),
            }

        return row
    except Exception as e:
        if "PGRST116" in str(e):
            return None
        logger.error(f"Error fetching priority analysis: {e}")
        return None


async def update_priority_analysis_supabase(supabase_client, user_id: str, analysis_data: Dict[str, Any]) -> bool:
    """Update or create priority analysis"""
    try:
        data = dict(analysis_data or {})
        data["user_id"] = user_id
        data["analyzed_at"] = datetime.now(timezone.utc).isoformat()

        # Try modern schema first (analysis JSON column)
        try:
            result = supabase_client.table("email_priority_analysis").upsert(data, on_conflict="user_id").execute()
            return bool(result.data)
        except Exception as modern_err:
            # Legacy schema fallback: write direct priority columns
            if "PGRST204" not in str(modern_err):
                raise

            analysis_payload = data.get("analysis") or {}
            legacy_data = {
                "user_id": user_id,
                "high_priority": analysis_payload.get("high_priority") or [],
                "medium_priority": analysis_payload.get("medium_priority") or [],
                "low_priority": analysis_payload.get("low_priority") or [],
                "strategic_insights": analysis_payload.get("strategic_insights") or "",
                "analyzed_at": data["analyzed_at"],
            }
            result = supabase_client.table("email_priority_analysis").upsert(legacy_data, on_conflict="user_id").execute()
            return bool(result.data)

        
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error updating priority analysis: {e}")
        return False


# =============================================
# CHAT HISTORY
# =============================================

async def create_chat_message_supabase(supabase_client, chat_data: Dict[str, Any]) -> bool:
    """Create chat history entry"""
    try:
        result = supabase_client.table("chat_history").insert(chat_data).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error creating chat message: {e}")
        return False


async def get_chat_history_supabase(supabase_client, user_id: str, session_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Get chat history for user"""
    try:
        query = supabase_client.table("chat_history").select("*").eq("user_id", user_id)
        
        if session_id:
            query = query.eq("session_id", session_id)
        
        result = query.order("created_at", desc=True).limit(limit).execute()
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        return []


async def delete_user_chats_supabase(supabase_client, user_id: str) -> int:
    """Delete all chat history for user"""
    try:
        result = supabase_client.table("chat_history").delete().eq("user_id", user_id).execute()
        return len(result.data) if result.data else 0
    except Exception as e:
        logger.error(f"Error deleting chat history: {e}")
        return 0


# =============================================
# SOUNDBOARD CONVERSATIONS
# =============================================

async def get_soundboard_conversation_supabase(supabase_client, session_id: str) -> Optional[Dict[str, Any]]:
    """Get soundboard conversation by session"""
    try:
        result = supabase_client.table("soundboard_conversations").select("*").eq("session_id", session_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        if "PGRST116" in str(e):
            return None
        logger.error(f"Error fetching soundboard conversation: {e}")
        return None


async def update_soundboard_conversation_supabase(supabase_client, conversation_id: str, updates: Dict[str, Any]) -> bool:
    """Update soundboard conversation"""
    try:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = supabase_client.table("soundboard_conversations").update(updates).eq("id", conversation_id).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error updating soundboard conversation: {e}")
        return False


async def create_soundboard_conversation_supabase(supabase_client, conv_data: Dict[str, Any]) -> bool:
    """Create new soundboard conversation"""
    try:
        result = supabase_client.table("soundboard_conversations").insert(conv_data).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error creating soundboard conversation: {e}")
        return False


# =============================================
# DATA FILES
# =============================================

async def create_data_file_supabase(supabase_client, file_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Create data file entry"""
    try:
        result = supabase_client.table("data_files").insert(file_data).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Error creating data file: {e}")
        return None


async def get_user_data_files_supabase(supabase_client, user_id: str, category: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Get user's data files"""
    try:
        query = supabase_client.table("data_files").select("*").eq("user_id", user_id)
        
        if category:
            query = query.eq("category", category)
        
        result = query.order("created_at", desc=True).limit(limit).execute()
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching data files: {e}")
        return []


async def count_user_data_files_supabase(supabase_client, user_id: str) -> int:
    """Count user's data files"""
    try:
        result = supabase_client.table("data_files").select("id", count="exact").eq("user_id", user_id).execute()
        return result.count if result.count is not None else 0
    except Exception as e:
        logger.error(f"Error counting data files: {e}")
        return 0


# =============================================
# ANALYSES
# =============================================

async def create_analysis_supabase(supabase_client, analysis_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Create analysis entry"""
    try:
        result = supabase_client.table("analyses").insert(analysis_data).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Error creating analysis: {e}")
        return None


async def get_user_analyses_supabase(supabase_client, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Get user's analyses"""
    try:
        result = supabase_client.table("analyses").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching analyses: {e}")
        return []


# =============================================
# BUSINESS PROFILES
# =============================================

async def get_business_profile_supabase(supabase_client, user_id: str) -> Optional[Dict[str, Any]]:
    """Get business profile for user"""
    try:
        result = supabase_client.table("business_profiles").select("*").eq("user_id", user_id).limit(1).execute()
        if result and result.data:
            return result.data[0]
        return None
    except Exception as e:
        if "PGRST116" in str(e):
            return None
        logger.error(f"Error fetching business profile: {e}")
        return None


async def update_business_profile_supabase(supabase_client, user_id: str, profile_data: Dict[str, Any]) -> bool:
    """Update or create business profile"""
    try:
        profile_data["user_id"] = user_id
        profile_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = supabase_client.table("business_profiles").upsert(profile_data, on_conflict="user_id").execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error updating business profile: {e}")
        return False
