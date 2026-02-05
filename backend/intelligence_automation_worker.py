"""
Automatic Intelligence Generation Worker
Runs continuous intelligence generation without user interaction
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from dotenv import load_dotenv
import os

from supabase_client import init_supabase
from truth_engine_rpc import generate_cold_read
from silence_detection import evaluate_silence_intervention
from watchtower_store import init_watchtower_store
from workspace_helpers import get_user_account

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [INTELLIGENCE] %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

supabase_admin = init_supabase()
watchtower_store = init_watchtower_store(supabase_admin)

DAILY_SCAN_INTERVAL = 86400
WEEKLY_SYNTHESIS_DAY = 0


async def get_active_users_with_email():
    """Get users who have email connected and active accounts"""
    try:
        emails = supabase_admin.table("outlook_emails").select("user_id").execute()
        
        if not emails.data:
            return []
        
        unique_users = list(set([e['user_id'] for e in emails.data]))
        logger.info(f"Found {len(unique_users)} users with email data")
        return unique_users
        
    except Exception as e:
        logger.error(f"Error fetching active users: {e}")
        return []


async def run_automatic_intelligence(user_id: str):
    """Generate intelligence for a single user"""
    try:
        account = await get_user_account(supabase_admin, user_id)
        if not account:
            logger.debug(f"No account for user {user_id[:8]}..., skipping")
            return
        
        account_id = account["id"]
        
        logger.info(f"Running automatic intelligence for user {user_id[:8]}...")
        
        result = await generate_cold_read(
            user_id=user_id,
            account_id=account_id,
            supabase_admin=supabase_admin,
            watchtower_store=watchtower_store
        )

        
        if result.get('events_created', 0) > 0:
            logger.info(f"✅ {result['events_created']} events created for user {user_id[:8]}...")
        else:
            logger.debug(f"No patterns detected for user {user_id[:8]}...")
            
        await evaluate_silence_intervention(user_id, account_id, supabase_admin, watchtower_store)

    except Exception as e:
        logger.error(f"Error generating intelligence for user {user_id[:8]}...: {e}")


async def daily_intelligence_scan():
    """Daily scan for all active users"""
    logger.info("Starting daily intelligence scan")
    
    users = await get_active_users_with_email()
    
    for user_id in users:
        await run_automatic_intelligence(user_id)
        await asyncio.sleep(1)
    
    logger.info(f"Daily scan complete. Processed {len(users)} users")


async def weekly_synthesis():
    """Weekly synthesis aligned to working schedules"""
    logger.info("Running weekly synthesis")
    
    try:
        schedules = supabase_admin.table("progress_cadence").select("*").eq("status", "active").execute()
        
        for cadence in (schedules.data or []):
            user_id = cadence['user_id']
            next_check = cadence.get('next_check_in_date')
            
            if next_check:
                next_dt = datetime.fromisoformat(next_check.replace('Z', '+00:00'))
                if next_dt <= datetime.now(timezone.utc):
                    await run_automatic_intelligence(user_id)
                    
                    supabase_admin.table("progress_cadence").update({
                        "last_check_in_at": datetime.now(timezone.utc).isoformat(),
                        "next_check_in_date": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
                    }).eq("business_profile_id", cadence['business_profile_id']).execute()
                    
    except Exception as e:
        logger.error(f"Weekly synthesis error: {e}")


async def intelligence_loop():
    """Main automatic intelligence loop"""
    logger.info("🚀 Automatic Intelligence Worker Started")
    logger.info("📅 Daily Scan: Every 24 hours")
    logger.info("📊 Weekly Synthesis: Aligned to progress_cadence")
    
    while True:
        try:
            logger.info("=" * 60)
            logger.info(f"Intelligence cycle at {datetime.now(timezone.utc).isoformat()}")
            
            await daily_intelligence_scan()
            
            if datetime.now(timezone.utc).weekday() == WEEKLY_SYNTHESIS_DAY:
                await weekly_synthesis()
            
            logger.info("✅ Intelligence cycle complete")
            logger.info("=" * 60)
            
        except Exception as e:
            logger.error(f"Intelligence loop error: {e}")
        
        await asyncio.sleep(DAILY_SCAN_INTERVAL)


if __name__ == "__main__":
    logger.info("🎯 Initializing Automatic Intelligence Worker...")
    asyncio.run(intelligence_loop())
