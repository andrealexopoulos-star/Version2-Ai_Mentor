"""
Watchtower Events - In-Memory Store (Supabase table pending)

Temporary implementation until watchtower_events table is created in Supabase.
Stores events in MongoDB as fallback.
"""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class WatchtowerStore:
    """
    Temporary watchtower events store using MongoDB
    
    Will be replaced with Supabase watchtower_events table
    """
    
    def __init__(self, db):
        self.db = db
        self.collection = db.watchtower_events
    
    async def create_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create or update watchtower event
        
        Uses fingerprint for deduplication
        """
        # Add timestamp
        event["created_at"] = event.get("created_at", datetime.now(timezone.utc).isoformat())
        event["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Upsert by fingerprint
        filter_query = {
            "account_id": event["account_id"],
            "fingerprint": event["fingerprint"]
        }
        
        result = await self.collection.update_one(
            filter_query,
            {"$set": event},
            upsert=True
        )
        
        logger.info(f"✅ Watchtower event persisted: {event['headline']}")
        
        return event
    
    async def get_events(
        self,
        account_id: str,
        status: str = "active"
    ) -> List[Dict[str, Any]]:
        """
        Get watchtower events for workspace
        """
        query = {"account_id": account_id}
        if status:
            query["status"] = status
        
        cursor = self.collection.find(query, {"_id": 0}).sort("created_at", -1)
        events = await cursor.to_list(length=100)
        
        return events
    
    async def handle_event(self, event_id: str, user_id: str) -> bool:
        """
        Mark event as handled
        """
        result = await self.collection.update_one(
            {"id": event_id},
            {
                "$set": {
                    "status": "handled",
                    "handled_at": datetime.now(timezone.utc).isoformat(),
                    "handled_by_user_id": user_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return result.modified_count > 0


# Singleton (will be initialized with MongoDB client)
_watchtower_store: Optional[WatchtowerStore] = None


def init_watchtower_store(db):
    """Initialize watchtower store with MongoDB client"""
    global _watchtower_store
    _watchtower_store = WatchtowerStore(db)
    return _watchtower_store


def get_watchtower_store() -> WatchtowerStore:
    """Get watchtower store instance"""
    if _watchtower_store is None:
        raise RuntimeError("Watchtower store not initialized")
    return _watchtower_store
