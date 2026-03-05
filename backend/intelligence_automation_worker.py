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
from regeneration_governance import evaluate_regeneration
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
EMISSION_INTERVAL = 900  # 15 minutes
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
        await evaluate_regeneration(user_id, account_id, supabase_admin, watchtower_store)

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
    logger.info("Automatic Intelligence Worker Started")
    logger.info("Emission Cycle: Every 15 minutes")
    logger.info("Daily Scan: Every 24 hours")
    
    last_daily = datetime.min.replace(tzinfo=timezone.utc)
    
    while True:
        try:
            now = datetime.now(timezone.utc)
            
            # ═══ EMISSION CYCLE (every 15 min) ═══
            logger.info(f"[EMISSION_SCHEDULER] Running emission cycle at {now.isoformat()}")
            try:
                from merge_client import MergeClient
                from merge_emission_layer import MergeEmissionLayer
                
                merge_key = os.environ.get("MERGE_API_KEY")
                if merge_key:
                    merge = MergeClient(merge_api_key=merge_key)
                    emission = MergeEmissionLayer(supabase_client=supabase_admin, merge_client=merge)
                    
                    # Get all users with integration accounts
                    accounts = supabase_admin.table("integration_accounts").select(
                        "user_id, account_id"
                    ).execute()
                    
                    seen = set()
                    emitted_total = 0
                    for acc in (accounts.data or []):
                        key = (acc["user_id"], acc["account_id"])
                        if key in seen:
                            continue
                        seen.add(key)
                        try:
                            result = await emission.run_emission(acc["user_id"], acc["account_id"])
                            emitted_total += result.get("signals_emitted", 0)
                            logger.info(f"[EMISSION_SCHEDULER] user={acc['user_id'][:8]}... signals={result.get('signals_emitted',0)}")
                        except Exception as e:
                            logger.error(f"[EMISSION_SCHEDULER] user={acc['user_id'][:8]}... error={e}")
                    
                    logger.info(f"[EMISSION_SCHEDULER] Complete: {emitted_total} signals emitted for {len(seen)} workspaces")
                else:
                    logger.warning("[EMISSION_SCHEDULER] MERGE_API_KEY not set — skipping")
            except Exception as e:
                logger.error(f"[EMISSION_SCHEDULER] Error: {e}")
            
            # ═══ DAILY SCAN (once per 24h) ═══
            if (now - last_daily).total_seconds() >= DAILY_SCAN_INTERVAL:
                await daily_intelligence_scan()
                if now.weekday() == WEEKLY_SYNTHESIS_DAY:
                    await weekly_synthesis()
                last_daily = now
            
        except Exception as e:
            logger.error(f"Intelligence loop error: {e}")
        
        await asyncio.sleep(EMISSION_INTERVAL)


if __name__ == "__main__":
    logger.info("🎯 Initializing Automatic Intelligence Worker...")
    asyncio.run(intelligence_loop())
