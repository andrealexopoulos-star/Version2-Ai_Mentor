"""
EMERGENCY DATA MIGRATION: MongoDB → Supabase outlook_emails
Bridges the gap between legacy storage and RPC-based intelligence
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from supabase_client import init_supabase
from datetime import datetime, timezone
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

async def migrate_emails_to_supabase():
    """
    One-time migration: MongoDB outlook_emails → Supabase outlook_emails
    
    Ensures RPCs have data to analyze
    """
    # Connect to MongoDB
    mongo_client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    mongo_db = mongo_client[os.environ['DB_NAME']]
    
    # Connect to Supabase
    supabase = init_supabase()
    
    logger.info("🔄 Starting email migration from MongoDB to Supabase")
    
    # Fetch all emails from MongoDB
    mongo_emails = await mongo_db.outlook_emails.find({}).to_list(None)
    total_emails = len(mongo_emails)
    
    logger.info(f"📊 Found {total_emails} emails in MongoDB")
    
    if total_emails == 0:
        logger.warning("⚠️ No emails to migrate")
        return
    
    migrated_count = 0
    error_count = 0
    batch_size = 100
    
    for i in range(0, total_emails, batch_size):
        batch = mongo_emails[i:i+batch_size]
        batch_data = []
        
        for email in batch:
            # Transform MongoDB document to Supabase schema
            supabase_email = {
                "user_id": email.get("user_id"),
                "graph_message_id": email.get("graph_message_id"),
                "subject": email.get("subject", ""),
                "from_address": email.get("from_address"),
                "from_name": email.get("from_name"),
                "received_date": email.get("received_date") or email.get("sent_date"),  # Handle both field names
                "body_preview": email.get("body_preview"),
                "body_content": email.get("body_content"),
                "is_read": email.get("is_read", False),
                "folder": email.get("folder", "inbox"),
                "synced_at": email.get("synced_at") or datetime.now(timezone.utc).isoformat(),
            }
            
            # Add optional fields if present
            if "conversation_id" in email:
                supabase_email["conversation_id"] = email["conversation_id"]
            if "to_recipients" in email:
                supabase_email["to_recipients"] = email["to_recipients"]
            if "is_external" in email:
                supabase_email["is_external"] = email["is_external"]
            if "metadata_only" in email:
                supabase_email["metadata_only"] = email["metadata_only"]
            
            batch_data.append(supabase_email)
        
        # Batch upsert to Supabase
        try:
            result = supabase.table("outlook_emails").upsert(
                batch_data,
                on_conflict="user_id,graph_message_id"
            ).execute()
            
            migrated_count += len(batch_data)
            logger.info(f"✅ Migrated batch {i//batch_size + 1}: {migrated_count}/{total_emails} emails")
            
        except Exception as e:
            error_count += len(batch_data)
            logger.error(f"❌ Batch {i//batch_size + 1} failed: {e}")
    
    logger.info(f"""
╔════════════════════════════════════════╗
║      MIGRATION COMPLETE                ║
╠════════════════════════════════════════╣
║  Total Emails:      {total_emails:>6}          ║
║  Migrated:          {migrated_count:>6}          ║
║  Errors:            {error_count:>6}          ║
╚════════════════════════════════════════╝
    """)
    
    # Verify migration
    try:
        supabase_count = supabase.table("outlook_emails").select("id", count="exact").execute()
        logger.info(f"✅ Supabase now contains {supabase_count.count} emails")
    except Exception as e:
        logger.error(f"Could not verify count: {e}")


if __name__ == "__main__":
    asyncio.run(migrate_emails_to_supabase())
