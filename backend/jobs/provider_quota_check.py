"""Daily cross-provider quota / credit-exhaustion check.

Context
-------
On 2026-04-22 Firecrawl silently hit 0 credits on the Hobby plan
(used 3,952 / 3,000) and nothing in BIQc surfaced it — scraping just
started failing with per-call errors. This module is the remediation:
once a day, poll every external provider that has a public billing
/ usage API, upsert the result into `public.provider_quotas` (see
migration 125), and fire an alert into `alerts_queue` when any
provider crosses 80 % (warning) or 100 % (critical) usage.

Design rules
------------
• Best-effort per provider. A provider outage / 5xx must NOT crash the
  worker or fail the whole sweep — the other providers still get
  checked, the failed one gets `last_check_error` stamped, and the next
  sweep tries again.
• Missing env var → skip silently. Don't bloat logs with warnings for
  providers we haven't wired a key for yet.
• Don't invent API shapes. Where a provider's usage endpoint response
  shape is uncertain (e.g. Perplexity), the adapter logs the raw body
  and leaves quota_used / quota_total NULL. Andreas can tune the parser
  later once a real response is observable.
• Alerts are written only when pct_used crosses a threshold AND the
  previous row was below that threshold — no every-day spam once we're
  at 95 %. (Simple state check against the pre-upsert row.)

CLI
---
    python -m backend.jobs.provider_quota_check

Prints the sweep summary as JSON and exits 0 on success (even if
individual adapters failed), 1 only if the sweep itself blew up before
it could write anything.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ─── Thresholds ─────────────────────────────────────────────────────
#
# Keep these as module-level constants so tests can patch them if
# needed. Values locked with Andreas 2026-04-22: 80 % = warning, 100 %
# = critical. No intermediate tier.
WARNING_THRESHOLD_PCT = 80.0
CRITICAL_THRESHOLD_PCT = 100.0


# ─── Service client resolution (same pattern as hard_delete_worker) ─

def _get_service_client():
    """Resolve a Supabase service-role client.

    Prefer the initialised routes.deps client (production path). Fall
    back to supabase_client.init_supabase() for CLI invocation before
    FastAPI boots.
    """
    try:
        from routes.deps import get_sb  # type: ignore
        return get_sb()
    except Exception:
        pass
    try:
        from supabase_client import init_supabase  # type: ignore
        return init_supabase()
    except Exception as exc:
        logger.error("[provider_quota_check] no supabase client available: %s", exc)
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Per-provider adapters ──────────────────────────────────────────
#
# Each adapter returns a dict shaped like:
#   {
#     "provider": str,                       # slug matching provider_quotas PK
#     "plan_name": str | None,               # e.g. 'Hobby'
#     "quota_period": str | None,            # e.g. 'monthly'
#     "quota_total": int | None,
#     "quota_used": int | None,
#     "last_check_error": str | None,
#     "skipped_reason": str | None,          # e.g. 'env_not_set'
#     "raw_response_excerpt": str | None,    # debug aid when parsing uncertain
#   }
#
# The dispatcher (run_quota_check) takes each adapter's return dict
# and merges it into the provider_quotas row. No adapter writes to
# the DB directly — they return, and the dispatcher persists.

async def _check_firecrawl(http_client: Any) -> Dict[str, Any]:
    """Poll Firecrawl's credit-usage endpoint.

    Verified 2026-04-22 against docs.firecrawl.dev:
      • v2 path: GET /v2/team/credit-usage  (camelCase response)
      • v1 path: GET /v1/team/credit-usage  (snake_case response)
      Both return { success, data: { remaining[_]Credits, plan[_]Credits,
                                      billing_period_start, billing_period_end } }

    The `/v1/credit-usage` path in the original task brief is NOT the
    real endpoint — flagged in report. We default to /v1/team/credit-usage
    for continuity with the existing v1 Firecrawl clients in the repo,
    and fall back to v2 if v1 returns 404. Either way we parse both
    response shapes.
    """
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        return {"provider": "firecrawl", "skipped_reason": "env_not_set"}

    headers = {"Authorization": f"Bearer {api_key}"}
    urls_in_order = (
        "https://api.firecrawl.dev/v1/team/credit-usage",
        "https://api.firecrawl.dev/v2/team/credit-usage",
    )

    last_err: Optional[str] = None
    for url in urls_in_order:
        try:
            resp = await http_client.get(url, headers=headers, timeout=15.0)
        except Exception as exc:
            last_err = f"{type(exc).__name__}: {str(exc)[:200]}"
            continue

        status = getattr(resp, "status_code", 0)
        if status == 404:
            # endpoint moved — try the next URL in the fallback chain
            last_err = f"http_404 at {url}"
            continue
        if status >= 400:
            body = _safe_body_excerpt(resp)
            return {
                "provider": "firecrawl",
                "last_check_error": f"http_{status}: {body}",
            }

        try:
            body = resp.json() if callable(getattr(resp, "json", None)) else {}
        except Exception as exc:
            return {
                "provider": "firecrawl",
                "last_check_error": f"json_parse_error: {exc}",
                "raw_response_excerpt": _safe_body_excerpt(resp),
            }

        data = (body or {}).get("data") or {}
        # Tolerant parsing: accept camelCase (v2) OR snake_case (v1)
        remaining = data.get("remainingCredits")
        if remaining is None:
            remaining = data.get("remaining_credits")
        plan_total = data.get("planCredits")
        if plan_total is None:
            plan_total = data.get("plan_credits")

        if plan_total is None or remaining is None:
            return {
                "provider": "firecrawl",
                "last_check_error": "unexpected_response_shape",
                "raw_response_excerpt": json.dumps(body)[:500],
            }

        try:
            plan_total_int = int(plan_total)
            remaining_int = int(remaining)
        except (TypeError, ValueError):
            return {
                "provider": "firecrawl",
                "last_check_error": "non_integer_credits",
                "raw_response_excerpt": json.dumps(body)[:500],
            }

        return {
            "provider": "firecrawl",
            "plan_name": None,  # Firecrawl API doesn't expose plan name in this response
            "quota_period": "monthly",
            "quota_total": plan_total_int,
            "quota_used": plan_total_int - remaining_int,
        }

    return {
        "provider": "firecrawl",
        "last_check_error": last_err or "no_firecrawl_url_responded",
    }


async def _check_perplexity(http_client: Any) -> Dict[str, Any]:
    """Poll Perplexity — best-effort.

    As of 2026-04-22 the Perplexity docs (docs.perplexity.ai) do not
    advertise a public usage / credit-remaining endpoint. We keep the
    adapter as a stub that attempts a handful of plausible paths and
    logs whatever it gets so Andreas can tune the parser when / if
    Perplexity ships one. NO parsing assumptions — we only record
    `last_check_error` if every candidate URL 4xx / 5xx's, and
    `raw_response_excerpt` if any URL responds.
    """
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        return {"provider": "perplexity", "skipped_reason": "env_not_set"}

    headers = {"Authorization": f"Bearer {api_key}"}
    candidates = (
        "https://api.perplexity.ai/v1/usage",
        "https://api.perplexity.ai/v1/credit-usage",
    )

    observed: List[str] = []
    for url in candidates:
        try:
            resp = await http_client.get(url, headers=headers, timeout=15.0)
        except Exception as exc:
            observed.append(f"{url}: {type(exc).__name__}")
            continue
        status = getattr(resp, "status_code", 0)
        if 200 <= status < 300:
            # We don't know the shape — log and leave quota fields NULL.
            logger.info(
                "[provider_quota_check] Perplexity responded at %s: %s",
                url, _safe_body_excerpt(resp),
            )
            return {
                "provider": "perplexity",
                "last_check_error": "shape_unknown_see_notes",
                "raw_response_excerpt": _safe_body_excerpt(resp),
            }
        observed.append(f"{url}: http_{status}")

    return {
        "provider": "perplexity",
        "last_check_error": f"no_public_usage_endpoint ({'; '.join(observed)})",
    }


async def _check_openai(http_client: Any) -> Dict[str, Any]:
    """Poll OpenAI usage endpoint — requires the admin key.

    The app-level OPENAI_API_KEY returned 404 on /v1/usage as of
    2026-04-22. Only the organisation admin key unlocks this path, so
    the adapter is opt-in via a distinct env var OPENAI_ADMIN_KEY.
    When absent we skip — no error, no log spam.
    """
    admin_key = os.environ.get("OPENAI_ADMIN_KEY")
    if not admin_key:
        return {"provider": "openai", "skipped_reason": "env_not_set"}

    # Conservative: log the body but don't attempt to parse until
    # Andreas confirms the exact response shape for this account.
    url = "https://api.openai.com/v1/usage"
    try:
        resp = await http_client.get(
            url,
            headers={"Authorization": f"Bearer {admin_key}"},
            timeout=15.0,
        )
    except Exception as exc:
        return {
            "provider": "openai",
            "last_check_error": f"{type(exc).__name__}: {str(exc)[:200]}",
        }

    status = getattr(resp, "status_code", 0)
    if status >= 400:
        return {
            "provider": "openai",
            "last_check_error": f"http_{status}: {_safe_body_excerpt(resp)}",
        }

    logger.info(
        "[provider_quota_check] OpenAI usage responded: %s",
        _safe_body_excerpt(resp),
    )
    return {
        "provider": "openai",
        "last_check_error": "shape_unknown_see_notes",
        "raw_response_excerpt": _safe_body_excerpt(resp),
    }


# Providers without a public usage API — intentionally no adapter.
# Migration 125 seeds rows for these with explanatory `notes`. The
# super-admin dashboard shows them with "—" for usage, which is the
# correct signal: "we know this provider exists; we can't measure it
# programmatically".
_NO_ADAPTER_PROVIDERS: Tuple[str, ...] = (
    "anthropic",
    "supabase",
    "browse_ai",
    "semrush",
    "serper",
)


_ADAPTERS = (
    _check_firecrawl,
    _check_perplexity,
    _check_openai,
)


# ─── Helpers ────────────────────────────────────────────────────────

def _safe_body_excerpt(resp: Any, limit: int = 500) -> str:
    """Extract a short response body excerpt for logging / error fields.

    Defensive: accepts anything with .text (httpx.Response), falls back
    to str(resp). Truncates to `limit` chars.
    """
    try:
        text = getattr(resp, "text", None)
        if callable(text):
            text = text()
        if text is None:
            text = str(resp)
    except Exception:
        text = "<unreadable>"
    return str(text)[:limit]


def _compute_pct(quota_total: Optional[int], quota_used: Optional[int]) -> Optional[float]:
    """Compute pct_used client-side for alert-threshold comparison.

    The DB generates this column too, but we need it BEFORE the upsert
    to decide whether to fire an alert, so we replicate the math here.
    Zero-total providers return None (dashboard shows "—").
    """
    if quota_total is None or quota_used is None:
        return None
    if quota_total == 0:
        return None
    return round((float(quota_used) / float(quota_total)) * 100.0, 2)


def _resolve_super_admin_user_id(sb: Any) -> Optional[str]:
    """Find the super-admin user id to route alerts_queue rows to.

    Best-effort: query `users` for tier='super_admin'. If multiple rows
    exist (staging + prod canaries), pick the oldest created_at so the
    alert always lands on the same inbox. If zero rows exist, return
    None and the dispatcher logs-and-skips the alert write (migration
    125 still records the quota, and the super-admin dashboard still
    lights up red on next load — alerts are the belt, the dashboard
    is the braces).
    """
    try:
        res = (
            sb.table("users")
            .select("id, created_at, tier")
            .eq("tier", "super_admin")
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res else []
        if rows:
            return rows[0].get("id")
    except Exception as exc:
        logger.warning("[provider_quota_check] super-admin lookup failed: %s", exc)
    return None


def _fetch_existing_row(sb: Any, provider: str) -> Dict[str, Any]:
    """Fetch the pre-upsert provider_quotas row (so we can decide
    whether the threshold was already crossed)."""
    try:
        res = (
            sb.table("provider_quotas")
            .select("provider, quota_total, quota_used, last_checked_at")
            .eq("provider", provider)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res else []
        return rows[0] if rows else {}
    except Exception as exc:
        logger.warning(
            "[provider_quota_check] pre-upsert select failed for %s: %s",
            provider, exc,
        )
        return {}


def _upsert_row(sb: Any, provider: str, adapter_result: Dict[str, Any]) -> Dict[str, Any]:
    """Upsert the result into provider_quotas. Returns the merged row.

    Always stamps last_checked_at = now(). Preserves existing `notes`
    (worker should never clobber admin-authored notes).
    """
    row: Dict[str, Any] = {
        "provider": provider,
        "last_checked_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    # Only set fields the adapter actually reported. Unknown-shape
    # responses leave quota_* NULL.
    for field in ("plan_name", "quota_period", "quota_total", "quota_used"):
        if field in adapter_result:
            row[field] = adapter_result[field]

    # Clear or set last_check_error based on adapter outcome. Skips
    # ('env_not_set') don't count as errors.
    if adapter_result.get("last_check_error"):
        row["last_check_error"] = adapter_result["last_check_error"]
    elif adapter_result.get("skipped_reason"):
        row["last_check_error"] = None  # keep clean — skipped isn't errored
    else:
        # Successful parse — explicitly clear the error field.
        row["last_check_error"] = None

    try:
        sb.table("provider_quotas").upsert(row, on_conflict="provider").execute()
    except Exception as exc:
        logger.error(
            "[provider_quota_check] upsert failed for %s: %s",
            provider, exc, exc_info=True,
        )
        return {**row, "_upsert_error": str(exc)}
    return row


def _emit_alert(
    sb: Any,
    *,
    provider: str,
    pct_used: float,
    severity: str,
    quota_used: Optional[int],
    quota_total: Optional[int],
    super_admin_user_id: Optional[str],
) -> Dict[str, Any]:
    """Write a row into alerts_queue for the super admin.

    severity: 'warning' (>= 80 %) | 'critical' (>= 100 %).
    Returns {emitted: bool, reason?: str} — never raises.
    """
    if not super_admin_user_id:
        return {"emitted": False, "reason": "no_super_admin_user"}

    priority = 1 if severity == "critical" else 2  # alerts_queue 1=urgent, 2=high
    title = (
        f"{provider.title()} quota {'EXHAUSTED' if severity == 'critical' else 'nearing exhaustion'}"
    )
    body = (
        f"{provider} usage at {pct_used:.1f}% "
        f"({quota_used} / {quota_total})."
    )
    payload = {
        "title": title,
        "body": body,
        "severity": severity,
        "provider": provider,
        "pct_used": pct_used,
        "quota_used": quota_used,
        "quota_total": quota_total,
        "cta_label": "Open provider dashboard",
        "cta_href": "/super-admin/providers",
    }

    try:
        sb.table("alerts_queue").insert({
            "user_id": super_admin_user_id,
            "type": "system",          # alerts_queue type check allows 'system'
            "source": "provider_quota_check",
            "target_page": "/super-admin/providers",
            "payload": payload,
            "priority": priority,
            "weight": 1.0 if severity == "critical" else 0.8,
        }).execute()
        return {"emitted": True}
    except Exception as exc:
        logger.error(
            "[provider_quota_check] alert insert failed for %s: %s",
            provider, exc, exc_info=True,
        )
        return {"emitted": False, "reason": f"insert_error: {exc}"}


def _classify_threshold(pct_used: Optional[float]) -> Optional[str]:
    """Return 'critical' | 'warning' | None based on pct_used."""
    if pct_used is None:
        return None
    if pct_used >= CRITICAL_THRESHOLD_PCT:
        return "critical"
    if pct_used >= WARNING_THRESHOLD_PCT:
        return "warning"
    return None


def _previously_crossed(prev_row: Dict[str, Any], threshold_pct: float) -> bool:
    """Decide whether the PREVIOUS row already sat above a given
    threshold. Used to dedupe daily spam: only alert when we NEWLY
    cross, not on every subsequent day we're still above.
    """
    prev_total = prev_row.get("quota_total")
    prev_used = prev_row.get("quota_used")
    if prev_total is None or prev_used is None or prev_total == 0:
        return False
    try:
        prev_pct = (float(prev_used) / float(prev_total)) * 100.0
    except (TypeError, ValueError, ZeroDivisionError):
        return False
    return prev_pct >= threshold_pct


# ─── Top-level sweep ────────────────────────────────────────────────

async def run_quota_check(sb: Any = None, *, http_client: Any = None) -> Dict[str, Any]:
    """Run one pass of the quota sweep.

    Parameters
    ----------
    sb
        Optional service-role Supabase client. When None, resolves via
        _get_service_client() (CLI path).
    http_client
        Optional httpx.AsyncClient-compatible mock. Tests pass a stub
        here; production lets us construct our own.

    Returns
    -------
    dict with:
        started_at / finished_at, providers_checked,
        providers_skipped, providers_errored, alerts_emitted,
        per_provider: list of merged result dicts
    """
    started_at = _now_iso()
    summary: Dict[str, Any] = {
        "started_at": started_at,
        "providers_checked": 0,
        "providers_skipped": 0,
        "providers_errored": 0,
        "alerts_emitted": 0,
        "per_provider": [],
    }

    sb = sb or _get_service_client()
    if sb is None:
        summary["error"] = "no_supabase_client"
        summary["finished_at"] = _now_iso()
        return summary

    super_admin_id = _resolve_super_admin_user_id(sb)
    if not super_admin_id:
        logger.warning(
            "[provider_quota_check] no super-admin user found — alerts will be skipped"
        )

    # Own the httpx client lifecycle only if one wasn't injected.
    owned_client: Any = None
    client: Any = http_client
    if client is None:
        try:
            import httpx  # late import so tests can stub sys.modules['httpx']
            owned_client = httpx.AsyncClient()
            client = owned_client
        except Exception as exc:
            logger.error(
                "[provider_quota_check] could not create httpx client: %s", exc
            )
            summary["error"] = f"httpx_unavailable: {exc}"
            summary["finished_at"] = _now_iso()
            return summary

    try:
        for adapter in _ADAPTERS:
            try:
                result = await adapter(client)
            except Exception as exc:
                # Defensive: never let an adapter crash the whole sweep.
                logger.error(
                    "[provider_quota_check] adapter %s raised: %s",
                    adapter.__name__, exc, exc_info=True,
                )
                result = {
                    "provider": adapter.__name__.replace("_check_", ""),
                    "last_check_error": f"adapter_exception: {type(exc).__name__}: {exc}",
                }

            provider = result.get("provider", "unknown")

            # Route 1: adapter skipped silently (env not set) — don't
            # touch the row, don't count as error.
            if result.get("skipped_reason") == "env_not_set":
                summary["providers_skipped"] += 1
                summary["per_provider"].append({
                    "provider": provider,
                    "skipped_reason": "env_not_set",
                })
                continue

            # Fetch the pre-upsert row for threshold-crossing dedup.
            prev_row = _fetch_existing_row(sb, provider)
            merged_row = _upsert_row(sb, provider, result)

            summary["providers_checked"] += 1
            if result.get("last_check_error"):
                summary["providers_errored"] += 1

            # Alert decision: only for rows where we got real numbers.
            pct = _compute_pct(
                merged_row.get("quota_total"),
                merged_row.get("quota_used"),
            )
            severity = _classify_threshold(pct)

            alert_emitted = False
            if severity is not None and pct is not None:
                threshold = (
                    CRITICAL_THRESHOLD_PCT
                    if severity == "critical"
                    else WARNING_THRESHOLD_PCT
                )
                # Dedup: only alert when we newly crossed. If we were
                # already above, skip — the dashboard is the ongoing
                # signal and daily re-alerts would just be noise.
                if not _previously_crossed(prev_row, threshold):
                    alert_result = _emit_alert(
                        sb,
                        provider=provider,
                        pct_used=pct,
                        severity=severity,
                        quota_used=merged_row.get("quota_used"),
                        quota_total=merged_row.get("quota_total"),
                        super_admin_user_id=super_admin_id,
                    )
                    if alert_result.get("emitted"):
                        summary["alerts_emitted"] += 1
                        alert_emitted = True

            summary["per_provider"].append({
                "provider": provider,
                "quota_total": merged_row.get("quota_total"),
                "quota_used": merged_row.get("quota_used"),
                "pct_used": pct,
                "severity": severity,
                "alert_emitted": alert_emitted,
                "last_check_error": merged_row.get("last_check_error"),
                "raw_response_excerpt": result.get("raw_response_excerpt"),
            })

        # Providers with no adapter: stamp last_checked_at and clear
        # any stale error so the dashboard shows "recently reviewed".
        for provider in _NO_ADAPTER_PROVIDERS:
            try:
                sb.table("provider_quotas").upsert({
                    "provider": provider,
                    "last_checked_at": _now_iso(),
                    "last_check_error": None,
                    "updated_at": _now_iso(),
                }, on_conflict="provider").execute()
                summary["providers_skipped"] += 1
                summary["per_provider"].append({
                    "provider": provider,
                    "skipped_reason": "no_public_usage_api",
                })
            except Exception as exc:
                logger.warning(
                    "[provider_quota_check] no-adapter stamp failed for %s: %s",
                    provider, exc,
                )

    finally:
        # Always close the client we own.
        if owned_client is not None:
            close = getattr(owned_client, "aclose", None)
            if callable(close):
                try:
                    await close()
                except Exception:
                    pass

    summary["finished_at"] = _now_iso()
    logger.info(
        "[provider_quota_check] sweep done: checked=%d skipped=%d errored=%d alerts=%d",
        summary["providers_checked"],
        summary["providers_skipped"],
        summary["providers_errored"],
        summary["alerts_emitted"],
    )
    return summary


# ─── CLI entry ──────────────────────────────────────────────────────

def _cli_main() -> int:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    try:
        summary = asyncio.run(run_quota_check())
    except Exception as exc:
        logger.error("[provider_quota_check] CLI run failed: %s", exc, exc_info=True)
        print(json.dumps({"error": str(exc)}))
        return 1
    print(json.dumps(summary, indent=2, default=str))
    # Return 0 even when individual adapters errored — one provider being
    # down is not a worker failure, and we don't want Azure Logic Apps
    # treating a single upstream outage as a full-job crash.
    if "error" in summary:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(_cli_main())
