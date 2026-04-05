"""
Automated Email Sync Worker - PROVIDER AGNOSTIC
Continuously syncs emails for ALL connected email accounts (Outlook, Gmail, etc.)
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import os

from supabase_client import init_supabase
from supabase_email_helpers import store_email_supabase
from workspace_helpers import get_user_account

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [SYNC-WORKER] %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

supabase_admin = init_supabase()

SYNC_INTERVAL_SECONDS = 60
LOOKBACK_DAYS = 7


async def get_all_connected_accounts() -> List[Dict[str, Any]]:
    """Get ALL connected email accounts (Outlook, Gmail) for ALL users"""
    try:
        # Query Outlook token table (primary source for Microsoft accounts).
        response = supabase_admin.table("outlook_oauth_tokens").select(
            "user_id, access_token, refresh_token, expires_at, provider, account_email"
        ).execute()

        active_accounts = []
        for token_record in response.data:
            user_id = token_record.get("user_id")
            access_token = token_record.get("access_token")
            provider = token_record.get("provider", "outlook")  # Default to outlook for backward compat
            
            # Normalize provider names
            if provider in ["microsoft", "azure"]:
                provider = "outlook"
            elif provider == "google":
                provider = "gmail"
            
            if user_id and access_token:
                active_accounts.append({
                    "user_id": user_id,
                    "access_token": access_token,
                    "refresh_token": token_record.get("refresh_token"),
                    "expires_at": token_record.get("expires_at"),
                    "provider": provider,
                    "account_email": token_record.get("account_email")
                })

        # Query Gmail token table as authoritative source for Google accounts.
        gmail_response = supabase_admin.table("gmail_connections").select(
            "user_id, email, access_token, refresh_token, token_expiry"
        ).execute()
        for row in (gmail_response.data or []):
            user_id = row.get("user_id")
            access_token = row.get("access_token")
            if not user_id or not access_token:
                continue
            active_accounts.append({
                "user_id": user_id,
                "access_token": access_token,
                "refresh_token": row.get("refresh_token"),
                "expires_at": row.get("token_expiry"),
                "provider": "gmail",
                "account_email": row.get("email"),
            })

        if not active_accounts:
            logger.info("No connected email accounts found")
            return []

        logger.info(f"✅ Found {len(active_accounts)} connected email accounts")
        return active_accounts
        
    except Exception as e:
        logger.error(f"Error fetching connected accounts: {e}")
        return []


async def fetch_outlook_emails(access_token: str, folder: str, lookback_days: int = 7) -> List[Dict]:
    """Fetch recent emails from Outlook/Microsoft Graph API"""
    import httpx
    
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        filter_query = f"receivedDateTime ge {cutoff_date.isoformat()}"
        
        url = f"https://graph.microsoft.com/v1.0/me/mailFolders/{folder}/messages"
        params = {
            "$filter": filter_query,
            "$top": 100,
            "$orderby": "receivedDateTime desc"
        }
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("value", [])
            else:
                logger.error(f"Error fetching Outlook emails from {folder}: {response.status_code}")
                return []
                
    except Exception as e:
        logger.error(f"Exception fetching Outlook emails: {e}")
        return []


async def fetch_gmail_emails(access_token: str, label: str, lookback_days: int = 7) -> List[Dict]:
    """Fetch recent emails from Gmail API"""
    import httpx
    
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        # Gmail uses Unix timestamp for 'after' query
        after_timestamp = int(cutoff_date.timestamp())
        
        # Map folder names to Gmail labels
        label_map = {
            "inbox": "INBOX",
            "sentitems": "SENT"
        }
        gmail_label = label_map.get(label, "INBOX")
        
        # Get message IDs
        list_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
        params = {
            "labelIds": gmail_label,
            "q": f"after:{after_timestamp}",
            "maxResults": 100
        }
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with httpx.AsyncClient(timeout=30) as client:
            list_response = await client.get(list_url, headers=headers, params=params)
            
            if list_response.status_code != 200:
                logger.error(f"Error listing Gmail messages: {list_response.status_code}")
                return []
            
            messages = list_response.json().get("messages", [])
            if not messages:
                return []
            
            # Fetch full message details (batch would be better for production)
            full_messages = []
            for msg in messages[:100]:  # Limit to 100
                msg_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}"
                msg_response = await client.get(msg_url, headers=headers)
                
                if msg_response.status_code == 200:
                    full_messages.append(msg_response.json())
            
            return full_messages
                
    except Exception as e:
        logger.error(f"Exception fetching Gmail emails: {e}")
        return []


async def trigger_biqc_intelligence(user_id: str):
    """
    Closes the 24-hour Intelligence Gap.
    Triggers deep-web-recon Edge Function after email sync completes.
    Uses httpx (async) — NOT requests.
    """
    import httpx

    edge_url = f"{os.environ.get('SUPABASE_URL')}/functions/v1/deep-web-recon"
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not edge_url or not service_key:
        logger.warning("[INTEL] Missing SUPABASE_URL or SERVICE_ROLE_KEY — skipping trigger")
        return

    # Get social handles + website from business_profiles
    website = ""
    handles = {}
    try:
        bp = supabase_admin.table("business_profiles").select(
            "website, social_handles"
        ).eq("user_id", user_id).maybe_single().execute()
        if bp.data:
            website = bp.data.get("website") or ""
            handles = bp.data.get("social_handles") or {}
    except Exception:
        pass

    payload = {
        "user_id": user_id,
        "trigger_source": "real_time_email_sync",
        "website": website,
        "linkedin": handles.get("linkedin", ""),
        "twitter": handles.get("twitter", ""),
        "instagram": handles.get("instagram", ""),
        "facebook": handles.get("facebook", ""),
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                edge_url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 200:
                result = response.json()
                if result.get("suppressed"):
                    logger.info(f"[INTEL] Signal Stable for {user_id[:8]}... — Executive Attention Preserved")
                else:
                    logger.info(f"[INTEL] Intelligence triggered for {user_id[:8]}... — {result.get('signals_created', 0)} signals")
            else:
                logger.warning(f"[INTEL] Edge Function returned {response.status_code}: {response.text[:100]}")
    except Exception as e:
        logger.error(f"[INTEL] Edge Function call failed for {user_id[:8]}...: {e}")


async def _record_email_source_run(user_id: str, provider: str, synced_count: int):
    """Record a source_runs entry so the truth gate knows email data is fresh."""
    connector_type = f"email:{provider.lower()}"
    status = "completed" if synced_count > 0 else "partial"
    try:
        supabase_admin.schema("business_core").table("source_runs").insert({
            "tenant_id": user_id,
            "connector_type": connector_type,
            "status": status,
            "ingested_at": datetime.now(timezone.utc).isoformat(),
            "run_meta": {
                "provider": provider,
                "category": "email",
                "synced_count": synced_count,
                "trigger": "email_sync_worker",
            },
        }).execute()
        logger.info(f"[SOURCE_RUN] Recorded email source_run for {user_id[:8]}... ({connector_type}, {status})")
    except Exception as e:
        logger.warning(f"[SOURCE_RUN] Failed to record email source_run: {e}")


async def sync_account_emails(account: Dict[str, Any]):
    """Sync emails for a single connected account (provider-agnostic)"""
    try:
        user_id = account["user_id"]
        provider = account["provider"]
        access_token = account["access_token"]
        account_email = account.get("account_email", "unknown")
        
        # Get account_id for tenant scope
        user_account = await get_user_account(supabase_admin, user_id)
        if not user_account:
            logger.warning(f"⚠️ No workspace found for user {user_id[:8]}..., skipping")
            return
        
        account_id = user_account["id"]
        
        logger.info(f"🔄 Syncing {provider} account: {account_email} (user {user_id[:8]}...)")
        
        synced_count = 0
        
        # Sync inbox
        if provider == "outlook":
            inbox_emails = await fetch_outlook_emails(access_token, "inbox", LOOKBACK_DAYS)
        elif provider == "gmail":
            inbox_emails = await fetch_gmail_emails(access_token, "inbox", LOOKBACK_DAYS)
        else:
            logger.error(f"Unknown provider: {provider}")
            return
        
        for email in inbox_emails:
            email_doc = transform_email_to_storage(
                email, user_id, account_id, provider, "inbox"
            )
            if email_doc:
                await store_email_supabase(supabase_admin, email_doc)
                synced_count += 1
        
        # Sync sent items
        if provider == "outlook":
            sent_emails = await fetch_outlook_emails(access_token, "sentitems", LOOKBACK_DAYS)
        elif provider == "gmail":
            sent_emails = await fetch_gmail_emails(access_token, "sentitems", LOOKBACK_DAYS)
        else:
            sent_emails = []
        
        for email in sent_emails:
            email_doc = transform_email_to_storage(
                email, user_id, account_id, provider, "sentitems"
            )
            if email_doc:
                await store_email_supabase(supabase_admin, email_doc)
                synced_count += 1
        
        logger.info(f"✅ {provider.upper()} {account_email}: synced {synced_count} emails")

        await _record_email_source_run(user_id, provider, synced_count)

        if synced_count > 0:
            await trigger_biqc_intelligence(user_id)
        
    except Exception as e:
        logger.error(f"❌ Error syncing account {account.get('account_email', 'unknown')}: {e}")


def transform_email_to_storage(
    email: Dict,
    user_id: str,
    account_id: str,
    provider: str,
    folder: str
) -> Optional[Dict]:
    """Transform provider-specific email format to unified storage format"""
    try:
        if provider == "outlook":
            return {
                "user_id": user_id,
                "account_id": account_id,
                "provider": provider,
                "graph_message_id": email.get("id"),
                "conversation_id": email.get("conversationId"),
                "subject": email.get("subject", ""),
                "from_address": email.get("from", {}).get("emailAddress", {}).get("address"),
                "from_name": email.get("from", {}).get("emailAddress", {}).get("name"),
                "received_date": email.get("receivedDateTime") or email.get("sentDateTime"),
                "body_preview": email.get("bodyPreview"),
                "body_content": email.get("body", {}).get("content", "")[:5000],
                "is_read": email.get("isRead", False),
                "folder": folder,
                "synced_at": datetime.now(timezone.utc).isoformat(),
                "metadata_only": (folder == "sentitems")
            }
        
        elif provider == "gmail":
            # Parse Gmail message format
            headers = {h["name"]: h["value"] for h in email.get("payload", {}).get("headers", [])}
            
            return {
                "user_id": user_id,
                "account_id": account_id,
                "provider": provider,
                "graph_message_id": email.get("id"),
                "conversation_id": email.get("threadId"),
                "subject": headers.get("Subject", ""),
                "from_address": extract_email_address(headers.get("From", "")),
                "from_name": headers.get("From", ""),
                "received_date": datetime.fromtimestamp(
                    int(email.get("internalDate", 0)) / 1000,
                    tz=timezone.utc
                ).isoformat(),
                "body_preview": email.get("snippet", ""),
                "body_content": "",  # Would need to parse payload for full content
                "is_read": "UNREAD" not in email.get("labelIds", []),
                "folder": folder,
                "synced_at": datetime.now(timezone.utc).isoformat(),
                "metadata_only": (folder == "sentitems")
            }
        
        return None
        
    except Exception as e:
        logger.error(f"Error transforming email: {e}")
        return None


def extract_email_address(from_string: str) -> str:
    """Extract email address from 'Name <email>' format"""
    import re
    match = re.search(r'<(.+?)>', from_string)
    if match:
        return match.group(1)
    return from_string


async def sync_loop():
    """Main sync loop - runs continuously for ALL providers"""
    logger.info("🚀 Email Sync Worker Started (Provider-Agnostic)")
    logger.info(f"📅 Sync Interval: {SYNC_INTERVAL_SECONDS} seconds")
    logger.info(f"📊 Lookback Window: {LOOKBACK_DAYS} days")
    logger.info("🌐 Supported Providers: Outlook, Gmail")
    
    while True:
        try:
            logger.info("=" * 60)
            logger.info(f"🔄 Starting sync cycle at {datetime.now(timezone.utc).isoformat()}")
            
            # Get all connected accounts (Outlook + Gmail)
            accounts = await get_all_connected_accounts()
            
            if not accounts:
                logger.info("⏭️  No connected accounts to sync")
            else:
                # Group by provider for logging
                by_provider = {}
                for acc in accounts:
                    provider = acc["provider"]
                    by_provider[provider] = by_provider.get(provider, 0) + 1
                
                logger.info(f"📊 Accounts by provider: {dict(by_provider)}")
                
                # Sync each account
                for account in accounts:
                    await sync_account_emails(account)
            
            logger.info(f"✅ Sync cycle complete. Sleeping {SYNC_INTERVAL_SECONDS}s...")
            logger.info("=" * 60)
            
        except Exception as e:
            logger.error(f"❌ Error in sync loop: {e}")
        
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)


if __name__ == "__main__":
    logger.info("🎯 Initializing Provider-Agnostic Email Sync Worker...")
    asyncio.run(sync_loop())
