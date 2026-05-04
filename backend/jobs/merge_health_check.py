"""
Merge.dev Integration Health Check
Runs every 4 hours via pg_cron to validate account tokens are still active.
Marks stale integrations as 'needs_reconnect' so frontend can prompt user.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

MERGE_BASE_URL = "https://api.merge.dev/api"
AUTH_EXPIRED_MESSAGE = "Connection authorisation has expired. Please reconnect."
SERVICE_UNAVAILABLE_MESSAGE = "Connection service is temporarily unavailable."


def _probe_url_for_category(category: str) -> str:
    cat = str(category or "").lower()
    if cat == "crm":
        return f"{MERGE_BASE_URL}/crm/v1/contacts?page_size=1"
    if cat in ("accounting", "financial"):
        return f"{MERGE_BASE_URL}/accounting/v1/invoices?page_size=1"
    if cat in ("file_storage", "filestorage"):
        return f"{MERGE_BASE_URL}/filestorage/v1/files?page_size=1"
    if cat == "ticketing":
        return f"{MERGE_BASE_URL}/ticketing/v1/tickets?page_size=1"
    if cat == "hris":
        return f"{MERGE_BASE_URL}/hris/v1/employees?page_size=1"
    if cat == "ats":
        return f"{MERGE_BASE_URL}/ats/v1/candidates?page_size=1"
    return f"{MERGE_BASE_URL}/crm/v1/contacts?page_size=1"


async def run_merge_health_check(sb, merge_api_key: Optional[str] = None):
    """Validate all Merge.dev account tokens by pinging their APIs."""
    if not merge_api_key:
        merge_api_key = os.environ.get("MERGE_API_KEY", "")
    if not merge_api_key:
        logger.warning("[merge_health] MERGE_API_KEY not set, skipping")
        return {"checked": 0, "healthy": 0, "stale": 0, "errors": []}

    result = sb.table("integration_accounts").select(
        "id, user_id, provider, category, account_token, connected_at"
    ).not_("account_token", "is", "null").execute()

    accounts: List[Dict[str, Any]] = []
    for row in result.data or []:
        entry = dict(row)
        entry["_source_table"] = "integration_accounts"
        entry["_source_id"] = row.get("id")
        entry["category"] = row.get("category") or "crm"
        accounts.append(entry)

    try:
        merge_rows = (
            sb.table("merge_integrations")
            .select("id, user_id, integration_category, integration_slug, account_token")
            .not_("account_token", "is", "null")
            .execute()
            .data
            or []
        )
        for row in merge_rows:
            entry = dict(row)
            entry["_source_table"] = "merge_integrations"
            entry["_source_id"] = row.get("id")
            entry["category"] = row.get("integration_category") or "file_storage"
            accounts.append(entry)
    except Exception as exc:
        logger.warning("[merge_health] merge_integrations read skipped: %s", exc)

    if not accounts:
        return {"checked": 0, "healthy": 0, "stale": 0, "errors": []}

    import httpx

    checked = 0
    healthy = 0
    stale = 0
    errors = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for acct in accounts:
            checked += 1
            token = acct.get("account_token", "")
            category = str(acct.get("category") or "crm").lower()
            test_url = _probe_url_for_category(category)
            now_iso = datetime.now(timezone.utc).isoformat()

            try:
                resp = await client.get(
                    test_url,
                    headers={
                        "Authorization": f"Bearer {merge_api_key}",
                        "X-Account-Token": token,
                    },
                )
                if resp.status_code == 200:
                    healthy += 1
                    try:
                        if acct.get("_source_table") == "merge_integrations":
                            sb.table("merge_integrations").update({
                                "status": "connected",
                                "sync_status": "active",
                                "error_message": None,
                                "last_sync_at": now_iso,
                            }).eq("id", acct["_source_id"]).execute()
                        else:
                            sb.table("integration_accounts").update({
                                "connected_at": now_iso,
                                "status": "connected",
                                "sync_status": "active",
                                "error_message": None,
                            }).eq("id", acct["_source_id"]).execute()
                    except Exception as exc:
                        logger.warning("[merge_health] healthy update failed: %s", exc)
                elif resp.status_code in (401, 403):
                    stale += 1
                    logger.warning(
                        "[merge_health] Stale token: %s/%s (user %s) → %s",
                        acct.get("provider"), category, acct.get("user_id"), resp.status_code,
                    )
                    try:
                        if acct.get("_source_table") == "merge_integrations":
                            sb.table("merge_integrations").update({
                                "status": "needs_reconnect",
                                "sync_status": "token_expired",
                                "error_message": AUTH_EXPIRED_MESSAGE,
                                "last_sync_at": now_iso,
                            }).eq("id", acct["_source_id"]).execute()
                        else:
                            sb.table("integration_accounts").update({
                                "status": "needs_reconnect",
                                "sync_status": "token_expired",
                                "error_message": AUTH_EXPIRED_MESSAGE,
                                "connected_at": now_iso,
                            }).eq("id", acct["_source_id"]).execute()
                            sb.table("workspace_integrations").update({
                                "status": "needs_reconnect",
                                "last_sync_at": now_iso,
                            }).eq("workspace_id", acct.get("user_id")).eq(
                                "integration_type", category
                            ).execute()
                    except Exception as e:
                        logger.warning("[merge_health] Mark stale failed: %s", e)
                else:
                    errors.append(f"{category}: HTTP {resp.status_code}")
            except Exception as e:
                logger.warning("[merge_health] probe failure category=%s user=%s err=%s", category, acct.get("user_id"), e)
                errors.append(f"{category}: {SERVICE_UNAVAILABLE_MESSAGE}")

    summary = {
        "checked": checked,
        "healthy": healthy,
        "stale": stale,
        "errors": errors,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("[merge_health] %s", summary)
    return summary
