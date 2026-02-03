"""
Automated Email Sync Worker
Continuously syncs emails for all Outlook-connected users every 60 seconds
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from dotenv import load_dotenv
import os

# Import Supabase client
from supabase_client import init_supabase

# Import sync helpers
from supabase_email_helpers import (
    create_sync_job_supabase,
    find_user_sync_job_supabase,
    update_sync_job_supabase,
    store_email_supabase
)

# Import server functions
import sys
sys.path.append(os.path.dirname(__file__))

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [SYNC-WORKER] %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase_admin = init_supabase()

SYNC_INTERVAL_SECONDS = 60
LOOKBACK_DAYS = 7  # Only sync last 7 days in background (not full 36 months)


async def get_outlook_connected_users() -> List[Dict[str, Any]]:
    """Get all users who have Outlook connected (valid tokens)"""
    try:
        # Query outlook_oauth_tokens table for active tokens
        response = supabase_admin.table("outlook_oauth_tokens").select("user_id, access_token, refresh_token, expires_at").execute()
        
        if not response.data:
            logger.info("No Outlook-connected users found")
            return []
        
        active_users = []
        for token_record in response.data:
            user_id = token_record.get("user_id")
            access_token = token_record.get("access_token")
            
            if user_id and access_token:
                active_users.append({
                    "user_id": user_id,
                    "access_token": access_token,
                    "refresh_token": token_record.get("refresh_token"),
                    "expires_at": token_record.get("expires_at")
                })
        
        logger.info(f"✅ Found {len(active_users)} Outlook-connected users")
        return active_users
        
    except Exception as e:
        logger.error(f"Error fetching Outlook users: {e}")
        return []


async def fetch_recent_emails(access_token: str, folder: str, lookback_days: int = 7) -> List[Dict]:
    """Fetch recent emails from a specific folder"""
    import httpx
    
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        filter_query = f"receivedDateTime ge {cutoff_date.isoformat()}"
        
        url = f"https://graph.microsoft.com/v1.0/me/mailFolders/{folder}/messages"
        params = {
            "$filter": filter_query,
            "$top": 100,  # Fetch last 100 emails per folder per sync
            "$orderby": "receivedDateTime desc"
        }
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("value", [])
            else:
                logger.error(f"Error fetching emails from {folder}: {response.status_code}")
                return []
                
    except Exception as e:
        logger.error(f"Exception fetching emails: {e}")
        return []


async def sync_user_emails(user_id: str, access_token: str):
    """Sync emails for a single user (inbox + sent items)"""
    try:
        # Check if sync is already running for this user
        existing_job = await find_user_sync_job_supabase(supabase_admin, user_id, "running")
        if existing_job:
            logger.info(f"⏭️  User {user_id[:8]}... already has sync running, skipping")
            return
        
        logger.info(f"🔄 Starting sync for user {user_id[:8]}...")
        
        synced_count = 0
        
        # Sync inbox
        inbox_emails = await fetch_recent_emails(access_token, "inbox", LOOKBACK_DAYS)
        for email in inbox_emails:
            email_doc = {
                "user_id": user_id,
                "graph_message_id": email.get("id"),
                "subject": email.get("subject", ""),
                "from_address": email.get("from", {}).get("emailAddress", {}).get("address"),
                "from_name": email.get("from", {}).get("emailAddress", {}).get("name"),
                "received_date": email.get("receivedDateTime"),
                "body_preview": email.get("bodyPreview"),
                "body_content": email.get("body", {}).get("content", "")[:5000],
                "is_read": email.get("isRead", False),
                "folder": "inbox",
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            await store_email_supabase(supabase_admin, email_doc)
            synced_count += 1
        
        # Sync sent items (metadata only for Watchtower)
        sent_emails = await fetch_recent_emails(access_token, "sentitems", LOOKBACK_DAYS)
        for email in sent_emails:
            to_recipients = email.get("toRecipients", [])
            recipient_addresses = [r.get("emailAddress", {}).get("address", "") for r in to_recipients]
            
            email_doc = {
                "user_id": user_id,
                "graph_message_id": email.get("id"),
                "conversation_id": email.get("conversationId"),
                "to_recipients": recipient_addresses,
                "received_date": email.get("sentDateTime"),  # Use sentDateTime as received_date
                "subject": email.get("subject", "")[:200],
                "folder": "sentitems",  # Match RPC expectation
                "synced_at": datetime.now(timezone.utc).isoformat(),
                "metadata_only": True
            }
            await store_email_supabase(supabase_admin, email_doc)
            synced_count += 1
        
        logger.info(f"✅ User {user_id[:8]}... synced {synced_count} emails")
        
    except Exception as e:
        logger.error(f"❌ Error syncing user {user_id[:8]}...: {e}")


async def sync_loop():
    """Main sync loop - runs continuously"""
    logger.info("🚀 Email Sync Worker Started")
    logger.info(f"📅 Sync Interval: {SYNC_INTERVAL_SECONDS} seconds")
    logger.info(f"📊 Lookback Window: {LOOKBACK_DAYS} days")
    
    while True:
        try:
            logger.info("=" * 60)
            logger.info(f"🔄 Starting sync cycle at {datetime.now(timezone.utc).isoformat()}")
            
            # Get all Outlook-connected users
            users = await get_outlook_connected_users()
            
            if not users:
                logger.info("⏭️  No users to sync")
            else:
                # Sync each user
                for user in users:
                    await sync_user_emails(user["user_id"], user["access_token"])
            
            logger.info(f"✅ Sync cycle complete. Sleeping {SYNC_INTERVAL_SECONDS}s...")
            logger.info("=" * 60)
            
        except Exception as e:
            logger.error(f"❌ Error in sync loop: {e}")
        
        # Wait before next sync
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)


if __name__ == "__main__":
    logger.info("🎯 Initializing Automated Email Sync Worker...")
    asyncio.run(sync_loop())
