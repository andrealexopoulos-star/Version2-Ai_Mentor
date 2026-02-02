"""
Watchtower Events - Supabase Store

Authoritative intelligence events storage
"""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)


class WatchtowerStore:
    """
    Watchtower events store using Supabase
    
    Single source of truth for all BIQc intelligence statements
    """
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    async def create_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create or update watchtower event
        
        Uses fingerprint for deduplication
        """
        # Ensure ID exists
        if 'id' not in event:
            event['id'] = str(uuid4())
        
        # Add timestamps
        if 'created_at' not in event:
            event['created_at'] = datetime.now(timezone.utc).isoformat()
        
        event['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        try:
            # Upsert by account_id + fingerprint
            result = self.supabase.table("watchtower_events").upsert(
                event,
                on_conflict="account_id,fingerprint"
            ).execute()
            
            logger.info(f"✅ Watchtower event persisted: {event['headline']}")
            
            return result.data[0] if result.data else event
            
        except Exception as e:
            logger.error(f"Failed to persist watchtower event: {e}")
            raise
    
    async def get_events(
        self,
        account_id: str,
        status: str = "active"
    ) -> List[Dict[str, Any]]:
        """
        Get watchtower events for workspace
        """
        query = self.supabase.table("watchtower_events") \
            .select("*") \
            .eq("account_id", account_id) \
            .order("created_at", desc=True)
        
        if status:
            query = query.eq("status", status)
        
        result = query.execute()
        
        return result.data or []
    
    async def handle_event(self, event_id: str, user_id: str) -> bool:
        """
        Mark event as handled
        """
        result = self.supabase.table("watchtower_events").update({
            "status": "handled",
            "handled_at": datetime.now(timezone.utc).isoformat(),
            "handled_by_user_id": user_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", event_id).execute()
        
        return len(result.data) > 0 if result.data else False


# Singleton
_watchtower_store: Optional[WatchtowerStore] = None


def init_watchtower_store(supabase_client):
    """Initialize watchtower store with Supabase client"""
    global _watchtower_store
    _watchtower_store = WatchtowerStore(supabase_client)
    return _watchtower_store


def get_watchtower_store() -> WatchtowerStore:
    """Get watchtower store instance"""
    if _watchtower_store is None:
        raise RuntimeError("Watchtower store not initialized")
    return _watchtower_store
