"""
Merge.dev Integration Health Check
Runs every 4 hours via pg_cron to validate account tokens are still active.
Marks stale integrations as 'needs_reconnect' so frontend can prompt user.
"""
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MERGE_BASE_URL = "https://api.merge.dev/api"


async def run_merge_health_check(sb, merge_api_key: str | None = None):
    """Validate all Merge.dev account tokens by pinging their APIs."""
    if not merge_api_key:
        merge_api_key = os.environ.get("MERGE_API_KEY", "")
    if not merge_api_key:
        logger.warning("[merge_health] MERGE_API_KEY not set, skipping")
        return {"checked": 0, "healthy": 0, "stale": 0, "errors": []}

    result = sb.table("integration_accounts").select(
        "id, user_id, provider, category, account_token, connected_at"
    ).not_("account_token", "is", "null").execute()

    accounts = result.data or []
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
            category = acct.get("category", "crm")

            if category == "crm":
                test_url = f"{MERGE_BASE_URL}/crm/v1/contacts?page_size=1"
            elif category in ("accounting", "financial"):
                test_url = f"{MERGE_BASE_URL}/accounting/v1/invoices?page_size=1"
            else:
                test_url = f"{MERGE_BASE_URL}/crm/v1/contacts?page_size=1"

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
                        sb.table("integration_accounts").update({
                            "connected_at": datetime.now(timezone.utc).isoformat(),
                        }).eq("id", acct["id"]).execute()
                    except Exception:
                        pass
                elif resp.status_code in (401, 403):
                    stale += 1
                    logger.warning(
                        "[merge_health] Stale token: %s/%s (user %s) → %s",
                        acct.get("provider"), category, acct.get("user_id"), resp.status_code,
                    )
                    try:
                        sb.table("workspace_integrations").update({
                            "status": "needs_reconnect",
                            "last_sync_at": datetime.now(timezone.utc).isoformat(),
                        }).eq("workspace_id", acct.get("user_id")).eq(
                            "integration_type", category
                        ).execute()
                    except Exception as e:
                        logger.warning("[merge_health] Mark stale failed: %s", e)
                else:
                    errors.append(f"{acct.get('provider')}: HTTP {resp.status_code}")
            except Exception as e:
                errors.append(f"{acct.get('provider')}: {str(e)[:100]}")

    summary = {
        "checked": checked,
        "healthy": healthy,
        "stale": stale,
        "errors": errors,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("[merge_health] %s", summary)
    return summary
