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
MERGE_INGEST_INTERVAL = 900  # 15 minutes baseline polling fallback
WEBHOOK_POLL_INTERVAL = 60
QUEUE_POLL_INTERVAL = 30  # Poll intelligence_queue every 30s
WORKER_LOOP_INTERVAL = 60
MAX_WEBHOOK_RETRIES = 5
WEBHOOK_RETRY_BASE_SECONDS = 30
WEEKLY_SYNTHESIS_DAY = 0
FEATURE_MERGE_WEBHOOK_ENABLED = os.environ.get("FEATURE_MERGE_WEBHOOK_ENABLED", "true").lower() in {"1", "true", "yes"}
QUEUE_BATCH_SIZE = 10  # Process up to 10 queue items per poll


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
    """Daily scan for all active users — includes supernatural engines"""
    logger.info("Starting daily intelligence scan")

    users = await get_active_users_with_email()

    for user_id in users:
        await run_automatic_intelligence(user_id)
        # Run supernatural engines after standard intelligence
        await _run_supernatural_engines(user_id)
        await asyncio.sleep(1)

    logger.info(f"Daily scan complete. Processed {len(users)} users")


async def _run_supernatural_engines(user_id: str):
    """Run proactive + predictive + narrative engines for a user."""
    try:
        from proactive_intelligence import ProactiveIntelligenceEngine
        engine = ProactiveIntelligenceEngine(supabase_admin)
        result = engine.run_full_scan(user_id)
        if result.get("alerts_created", 0) > 0:
            logger.info(f"[PROACTIVE] {result['alerts_created']} alerts for user {user_id[:8]}...")
    except Exception as e:
        logger.error(f"[PROACTIVE] Error for user {user_id[:8]}...: {e}")

    try:
        from predictive_intelligence import PredictiveIntelligenceEngine
        engine = PredictiveIntelligenceEngine(supabase_admin)
        result = engine.run_all_predictions(user_id)
        if result.get("predictions_created", 0) > 0:
            logger.info(f"[PREDICTIVE] {result['predictions_created']} predictions for user {user_id[:8]}...")
    except Exception as e:
        logger.error(f"[PREDICTIVE] Error for user {user_id[:8]}...: {e}")

    try:
        from narrative_synthesis import NarrativeSynthesisEngine
        engine = NarrativeSynthesisEngine(supabase_admin)
        result = engine.generate_weekly_narrative(user_id)
        if result.get("narrative_id"):
            logger.info(f"[NARRATIVE] Generated narrative for user {user_id[:8]}...")
    except Exception as e:
        logger.error(f"[NARRATIVE] Error for user {user_id[:8]}...: {e}")


# ═══ INTELLIGENCE QUEUE PROCESSING ═══

SCHEDULE_DISPATCH = {
    # schedule_key -> (module, class, method)
    "proactive_scan":       ("proactive_intelligence",  "ProactiveIntelligenceEngine",  "run_full_scan"),
    "predictive_models":    ("predictive_intelligence", "PredictiveIntelligenceEngine", "run_all_predictions"),
    "weekly_narrative":     ("narrative_synthesis",      "NarrativeSynthesisEngine",     "generate_weekly_narrative"),
    "monthly_narrative":    ("narrative_synthesis",      "NarrativeSynthesisEngine",     "generate_weekly_narrative"),
    "calendar_intelligence":("calendar_intelligence",   "CalendarIntelligenceEngine",   "store_intelligence"),
}


async def process_intelligence_queue():
    """Poll intelligence_queue for queued items and dispatch to handlers."""
    try:
        # Fetch next batch of queued items (oldest first, highest priority first)
        result = supabase_admin.table("intelligence_queue") \
            .select("*") \
            .eq("status", "queued") \
            .order("priority") \
            .order("queued_at") \
            .limit(QUEUE_BATCH_SIZE) \
            .execute()

        items = result.data or []
        if not items:
            return 0

        processed = 0
        for item in items:
            queue_id = item["id"]
            user_id = item["user_id"]
            schedule_key = item["schedule_key"]

            # Mark as processing
            supabase_admin.table("intelligence_queue").update({
                "status": "processing",
                "started_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", queue_id).execute()

            try:
                dispatch_info = SCHEDULE_DISPATCH.get(schedule_key)
                if dispatch_info:
                    module_name, class_name, method_name = dispatch_info
                    import importlib
                    mod = importlib.import_module(module_name)
                    cls = getattr(mod, class_name)
                    instance = cls(supabase_admin)
                    method = getattr(instance, method_name)
                    method(user_id)
                else:
                    # For schedule_keys without local dispatch, just run standard intelligence
                    await run_automatic_intelligence(user_id)

                # Mark completed
                supabase_admin.table("intelligence_queue").update({
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", queue_id).execute()
                processed += 1

            except Exception as e:
                logger.error(f"[QUEUE] Failed {schedule_key} for user {user_id[:8]}...: {e}")
                supabase_admin.table("intelligence_queue").update({
                    "status": "failed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "error_detail": str(e)[:500],
                }).eq("id", queue_id).execute()

        if processed > 0:
            logger.info(f"[QUEUE] Processed {processed}/{len(items)} queue items")

        return processed

    except Exception as e:
        logger.error(f"[QUEUE] Error polling queue: {e}")
        return 0


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


async def trigger_merge_ingest():
    """Trigger the Merge data ingest edge function to pull fresh CRM/accounting data."""
    import httpx

    edge_url = f"{os.environ.get('SUPABASE_URL')}/functions/v1/business-brain-merge-ingest"
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not edge_url or not service_key:
        logger.warning("[MERGE_INGEST] Missing SUPABASE_URL or SERVICE_ROLE_KEY — skipping")
        return

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                edge_url,
                json={"trigger_source": "intelligence_automation_worker"},
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 200:
                result = response.json()
                logger.info(f"[MERGE_INGEST] Data sync complete: {result.get('summaries', [])}")
            else:
                logger.warning(f"[MERGE_INGEST] Edge function returned {response.status_code}: {response.text[:200]}")
    except Exception as e:
        logger.error(f"[MERGE_INGEST] Failed to trigger data sync: {e}")


def _next_retry_timestamp(attempts: int) -> str:
    delay_seconds = min(1800, WEBHOOK_RETRY_BASE_SECONDS * (2 ** max(0, attempts - 1)))
    return (datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)).isoformat()


async def process_merge_webhook_events() -> Dict[str, Any]:
    """Drain queued Merge webhook events and enqueue selective sync jobs."""
    if not FEATURE_MERGE_WEBHOOK_ENABLED:
        return {"processed": 0, "queued_sync_jobs": 0, "feature_enabled": False}

    rows_resp = (
        supabase_admin.schema("business_core")
        .table("webhook_events")
        .select("id,tenant_id,category,status,attempts,next_retry_at,event_id")
        .in_("status", ["received", "failed", "validated"])
        .order("received_at", desc=False)
        .limit(100)
        .execute()
    )
    rows = rows_resp.data or []
    if not rows:
        return {"processed": 0, "queued_sync_jobs": 0, "feature_enabled": True}

    from biqc_jobs import enqueue_job

    now = datetime.now(timezone.utc)
    grouped_categories: Dict[str, set] = {}
    grouped_rows: Dict[str, list] = {}
    processed = 0
    queued_jobs = 0
    failed = 0
    dead_letter = 0

    for row in rows:
        next_retry_raw = row.get("next_retry_at")
        if next_retry_raw:
            try:
                next_retry_dt = datetime.fromisoformat(str(next_retry_raw).replace("Z", "+00:00"))
                if next_retry_dt > now:
                    continue
            except Exception:
                pass

        tenant_id = row.get("tenant_id")
        category = str(row.get("category") or "").lower()
        event_row_id = row.get("id")
        attempts = int(row.get("attempts") or 0)
        if not tenant_id or category not in {"crm", "accounting", "marketing", "calendar"}:
            supabase_admin.schema("business_core").table("webhook_events").update({
                "status": "processed",
                "processed_at": now.isoformat(),
                "last_error": "unsupported category or missing tenant",
            }).eq("id", event_row_id).execute()
            processed += 1
            continue

        tenant_key = str(tenant_id)
        grouped_categories.setdefault(tenant_key, set()).add(category)
        grouped_rows.setdefault(tenant_key, []).append({
            "id": event_row_id,
            "attempts": attempts,
        })
        supabase_admin.schema("business_core").table("webhook_events").update({
            "status": "validated",
            "attempts": attempts + 1,
            "last_error": None,
        }).eq("id", event_row_id).execute()
        processed += 1

    for tenant_id, tenant_rows in grouped_rows.items():
        categories = sorted(list(grouped_categories.get(tenant_id) or []))
        try:
            enqueue_result = await enqueue_job(
                job_type="merge-webhook-sync",
                payload={
                    "tenant_id": tenant_id,
                    "categories": categories,
                    "trigger_source": "merge_webhook_event",
                },
                company_id=f"{tenant_id}:merge:{'-'.join(categories)}",
                window_seconds=60,
            )
            if enqueue_result.get("queued") or enqueue_result.get("duplicate"):
                queued_jobs += 1
                for row_meta in tenant_rows:
                    supabase_admin.schema("business_core").table("webhook_events").update({
                        "status": "queued",
                        "processed_at": now.isoformat(),
                        "last_error": None,
                        "next_retry_at": None,
                    }).eq("id", row_meta["id"]).execute()
            else:
                raise RuntimeError(enqueue_result.get("reason") or "queue enqueue rejected")
        except Exception as exc:
            failed += len(tenant_rows)
            for row_meta in tenant_rows:
                current_attempts = int(row_meta.get("attempts") or 0) + 1
                if current_attempts >= MAX_WEBHOOK_RETRIES:
                    dead_letter += 1
                    supabase_admin.schema("business_core").table("webhook_events").update({
                        "status": "dead_letter",
                        "last_error": str(exc)[:500],
                        "dead_letter_at": now.isoformat(),
                        "processed_at": now.isoformat(),
                    }).eq("id", row_meta["id"]).execute()
                else:
                    supabase_admin.schema("business_core").table("webhook_events").update({
                        "status": "failed",
                        "last_error": str(exc)[:500],
                        "next_retry_at": _next_retry_timestamp(current_attempts),
                    }).eq("id", row_meta["id"]).execute()

    return {
        "processed": processed,
        "queued_sync_jobs": queued_jobs,
        "failed": failed,
        "dead_letter": dead_letter,
        "feature_enabled": True,
    }


async def intelligence_loop():
    """Main automatic intelligence loop"""
    logger.info("Automatic Intelligence Worker Started")
    logger.info("Emission Cycle: Every 15 minutes")
    logger.info("Merge Data Sync Fallback: Every 15 minutes")
    logger.info("Merge Webhook Poll: Every 60 seconds")
    logger.info("Intelligence Queue Poll: Every 30 seconds")
    logger.info("Daily Scan: Every 24 hours")

    last_daily = datetime.min.replace(tzinfo=timezone.utc)
    last_merge_ingest = datetime.min.replace(tzinfo=timezone.utc)
    last_emission = datetime.min.replace(tzinfo=timezone.utc)
    last_webhook_poll = datetime.min.replace(tzinfo=timezone.utc)
    last_queue_poll = datetime.min.replace(tzinfo=timezone.utc)
    
    while True:
        try:
            now = datetime.now(timezone.utc)

            # ═══ INTELLIGENCE QUEUE (every 30s) ═══
            if (now - last_queue_poll).total_seconds() >= QUEUE_POLL_INTERVAL:
                await process_intelligence_queue()
                last_queue_poll = now

            # ═══ WEBHOOK EVENT DRAIN (every 60s) ═══
            if (now - last_webhook_poll).total_seconds() >= WEBHOOK_POLL_INTERVAL:
                webhook_result = await process_merge_webhook_events()
                if webhook_result.get("processed", 0) > 0:
                    logger.info(f"[MERGE_WEBHOOK] processed={webhook_result.get('processed')} queued={webhook_result.get('queued_sync_jobs')} failed={webhook_result.get('failed')} dead_letter={webhook_result.get('dead_letter')}")
                last_webhook_poll = now

            # ═══ MERGE DATA INGEST (every 15m fallback) ═══
            if (now - last_merge_ingest).total_seconds() >= MERGE_INGEST_INTERVAL:
                logger.info(f"[MERGE_INGEST] Triggering data sync at {now.isoformat()}")
                await trigger_merge_ingest()
                last_merge_ingest = now
            
            # ═══ EMISSION CYCLE (every 15 min) ═══
            if (now - last_emission).total_seconds() >= EMISSION_INTERVAL:
                logger.info(f"[EMISSION_SCHEDULER] Running emission cycle at {now.isoformat()}")
                try:
                    from merge_client import MergeClient
                    from merge_emission_layer import MergeEmissionLayer
                    
                    merge_key = os.environ.get("MERGE_API_KEY")
                    if merge_key:
                        merge = MergeClient(merge_api_key=merge_key)
                        emission = MergeEmissionLayer(supabase_client=supabase_admin, merge_client=merge)
                        
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
                last_emission = now
            
            # ═══ DAILY SCAN (once per 24h) ═══
            if (now - last_daily).total_seconds() >= DAILY_SCAN_INTERVAL:
                await daily_intelligence_scan()
                if now.weekday() == WEEKLY_SYNTHESIS_DAY:
                    await weekly_synthesis()
                last_daily = now
            
        except Exception as e:
            logger.error(f"Intelligence loop error: {e}")
        
        await asyncio.sleep(WORKER_LOOP_INTERVAL)


if __name__ == "__main__":
    logger.info("🎯 Initializing Automatic Intelligence Worker...")
    asyncio.run(intelligence_loop())
