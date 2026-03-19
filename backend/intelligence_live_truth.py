"""Live integration + signal truth helpers for BIQc.

These helpers provide deterministic, non-LLM truth derived from Supabase tables.
They are used to reconcile stale SQL/RPC outputs with the actual connected state.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

STALE_SOURCE_HOURS = 48.0
STALE_WARNING_HOURS = 24.0
LIVE_SYNC_TARGET_MINUTES = 15


def parse_json_field(value: Any) -> Optional[Dict[str, Any]]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


def normalize_category(raw_category: Any, provider: Any = None, integration_slug: Any = None) -> str:
    raw = str(raw_category or "").strip().lower()
    provider_name = str(provider or "").strip().lower()
    slug = str(integration_slug or "").strip().lower()

    alias_map = {
        "financial": "accounting",
        "finance": "accounting",
        "accountancy": "accounting",
        "mail": "email",
        "messaging": "email",
    }
    raw = alias_map.get(raw, raw)

    if raw:
        return raw

    combined = f"{provider_name} {slug}".strip()
    if any(k in combined for k in ("xero", "quickbooks", "netsuite", "sage")):
        return "accounting"
    if any(k in combined for k in ("hubspot", "salesforce", "pipedrive", "zoho", "crm")):
        return "crm"
    if any(k in combined for k in ("outlook", "gmail", "mail", "email")):
        return "email"
    return "unknown"


def parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def age_hours(value: Any) -> Optional[float]:
    parsed = parse_dt(value)
    if not parsed:
        return None
    return round(max(0.0, (datetime.now(timezone.utc) - parsed).total_seconds() / 3600.0), 2)


def next_expected_update(value: Any, interval_minutes: int = LIVE_SYNC_TARGET_MINUTES) -> Optional[str]:
    parsed = parse_dt(value)
    if not parsed:
        return None
    return (parsed + timedelta(minutes=max(1, interval_minutes))).isoformat()


def normalize_connector_type(raw_value: Any) -> str:
    text = str(raw_value or "").strip().lower()
    if any(token in text for token in ("accounting", "xero", "quickbooks", "netsuite", "sage")):
        return "accounting"
    if any(token in text for token in ("crm", "hubspot", "salesforce", "pipedrive", "zoho")):
        return "crm"
    if any(token in text for token in ("email", "outlook", "gmail", "mail")):
        return "email"
    if "calendar" in text:
        return "calendar"
    if "marketing" in text:
        return "marketing"
    return "unknown"


def get_connector_truth_summary(sb, user_id: str) -> Dict[str, Dict[str, Any]]:
    categories = ("crm", "accounting", "email", "calendar", "marketing")
    summary: Dict[str, Dict[str, Any]] = {
        category: {
            "category": category,
            "truth_state": "unverified",
            "last_verified_at": None,
            "age_hours": None,
            "next_expected_update": None,
            "status": "not_observed",
            "error_message": None,
            "truth_reason": f"No verified {category} data has been synced yet. Connect your {category} tool in Integrations to get started.",
        }
        for category in categories
    }

    try:
        rows = (
            sb.schema("business_core")
            .table("source_runs")
            .select("connector_type,status,error_message,ingested_at,updated_at,created_at")
            .eq("tenant_id", user_id)
            .order("ingested_at", desc=True)
            .limit(100)
            .execute()
            .data
            or []
        )
        for row in rows:
            category = normalize_connector_type(row.get("connector_type"))
            if category not in summary:
                continue

            candidate_ts = row.get("ingested_at") or row.get("updated_at") or row.get("created_at")
            current_ts = summary[category].get("last_verified_at")
            if parse_dt(current_ts) and parse_dt(candidate_ts) and parse_dt(candidate_ts) <= parse_dt(current_ts):
                continue

            run_status = str(row.get("status") or "unknown").lower()
            current_age_hours = age_hours(candidate_ts)
            if run_status in {"completed", "partial"}:
                if current_age_hours is not None and current_age_hours > STALE_SOURCE_HOURS:
                    truth_state = "stale"
                    truth_reason = f"Last verified {category} data sync is {current_age_hours:.1f}h old. Reconnect or resync to restore live data."
                elif current_age_hours is not None and current_age_hours > STALE_WARNING_HOURS:
                    truth_state = "live"
                    truth_reason = f"{category.title()} data was last synced {current_age_hours:.1f}h ago. A fresh sync is recommended."
                else:
                    truth_state = "live"
                    truth_reason = f"{category.title()} data is up to date (synced {current_age_hours:.1f}h ago)." if current_age_hours is not None else f"{category.title()} data is verified and current."
            else:
                truth_state = "error"
                truth_reason = str(row.get("error_message") or f"Latest {category} data sync failed. Check the integration connection.")

            summary[category] = {
                "category": category,
                "truth_state": truth_state,
                "last_verified_at": candidate_ts,
                "age_hours": current_age_hours,
                "next_expected_update": next_expected_update(candidate_ts),
                "status": run_status,
                "error_message": row.get("error_message"),
                "truth_reason": truth_reason,
            }
    except Exception as e:
        logger.warning(f"[live-truth] source-runs truth lookup failed: {e}")

    return summary


def merge_row_is_connected(row: Dict[str, Any]) -> bool:
    status_values = {
        str(row.get("status") or "").strip().lower(),
        str(row.get("sync_status") or "").strip().lower(),
        str(row.get("connection_status") or "").strip().lower(),
        str(row.get("state") or "").strip().lower(),
    }
    positive_status = {"connected", "active", "synced", "complete", "ok", "healthy"}
    negative_status = {"disconnected", "deleted", "revoked", "inactive", "failed", "error", "token_expired", "expired"}

    has_auth_artifact = bool(
        row.get("merge_account_id")
        or row.get("account_token")
        or row.get("connected_at")
        or row.get("connected") is True
        or row.get("is_connected") is True
        or row.get("active") is True
    )

    # Explicit negative states must win (prevents stale "connected" when old tokens/connected_at still exist).
    if any(s in negative_status for s in status_values):
        return False

    if row.get("connected") is False or row.get("is_connected") is False or row.get("active") is False:
        return False

    if any(s in positive_status for s in status_values):
        return True

    return has_auth_artifact


def email_row_is_connected(row: Dict[str, Any]) -> bool:
    status = str(row.get("status") or row.get("sync_status") or "").strip().lower()
    return (
        row.get("connected") is True
        or row.get("is_connected") is True
        or row.get("active") is True
        or bool(row.get("access_token"))
        or bool(row.get("refresh_token"))
        or status in {"connected", "active", "complete", "synced"}
        or bool(row.get("connected_at"))
    )


def get_live_integration_truth(sb, user_id: str) -> Dict[str, Any]:
    integrations: List[Dict[str, Any]] = []
    dedupe: Dict[str, Dict[str, Any]] = {}
    connector_truth = get_connector_truth_summary(sb, user_id)

    def upsert_integration(item: Dict[str, Any]):
        category = normalize_category(item.get("category"), item.get("provider"), item.get("integration_slug"))
        item["category"] = category
        provider_key = str(item.get("provider") or item.get("integration_name") or category).strip().lower()
        key = f"{category}:{provider_key}"
        existing = dedupe.get(key)
        if not existing:
            dedupe[key] = item
            return

        existing_connected_at = existing.get("connected_at") or ""
        incoming_connected_at = item.get("connected_at") or ""
        if incoming_connected_at >= existing_connected_at:
            dedupe[key] = {**existing, **item}

    try:
        merge_result = sb.table("integration_accounts").select("*").eq("user_id", user_id).execute()
        for row in (merge_result.data or []):
            category = normalize_category(row.get("category"), row.get("provider"), row.get("integration_slug"))
            if not merge_row_is_connected(row):
                continue

            provider_label = row.get("provider") or row.get("integration_slug") or category
            upsert_integration({
                "integration_name": row.get("provider") or category,
                "provider": provider_label,
                "category": category,
                "connected": True,
                "connected_at": row.get("connected_at") or row.get("created_at"),
                "updated_at": row.get("updated_at"),
                "account_token": row.get("account_token"),
                "merge_account_id": row.get("merge_account_id"),
                "integration_slug": row.get("integration_slug"),
            })
    except Exception as e:
        logger.warning(f"[live-truth] merge integration lookup failed: {e}")

    try:
        email_result = sb.table("email_connections").select("*").eq("user_id", user_id).execute()
        for row in (email_result.data or []):
            if not email_row_is_connected(row):
                continue
            provider_raw = (row.get("provider") or "email").lower()
            upsert_integration({
                "integration_name": provider_raw,
                "provider": {"outlook": "Microsoft Outlook", "gmail": "Gmail"}.get(provider_raw, provider_raw.title()),
                "category": "email",
                "connected": True,
                "connected_at": row.get("connected_at") or row.get("updated_at"),
                "connected_email": row.get("connected_email"),
                "updated_at": row.get("updated_at"),
                "records_count": 0,
            })
    except Exception as e:
        logger.warning(f"[live-truth] email integration lookup failed: {e}")

    try:
        token_result = sb.table("outlook_oauth_tokens").select("*").eq("user_id", user_id).execute()
        now_utc = datetime.now(timezone.utc)
        for row in (token_result.data or []):
            if not email_row_is_connected(row):
                continue

            provider_raw = str(row.get("provider") or "outlook").lower()
            expires_at = row.get("expires_at")
            expired = False
            if expires_at:
                try:
                    expires_dt = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
                    expired = expires_dt <= now_utc and not row.get("refresh_token")
                except Exception:
                    expired = False

            if expired:
                continue

            upsert_integration({
                "integration_name": provider_raw,
                "provider": {"outlook": "Microsoft Outlook", "gmail": "Gmail"}.get(provider_raw, provider_raw.title()),
                "category": "email",
                "connected": True,
                "connected_at": row.get("updated_at") or row.get("created_at"),
                "connected_email": row.get("microsoft_email") or row.get("email"),
                "updated_at": row.get("updated_at"),
                "records_count": 0,
            })
    except Exception:
        # Optional table in some environments
        pass

    integrations = []
    for item in dedupe.values():
        category = normalize_category(item.get("category"), item.get("provider"), item.get("integration_slug"))
        truth_meta = dict(connector_truth.get(category) or {})

        if truth_meta.get("truth_state") == "unverified":
            connected_at = item.get("updated_at") or item.get("connected_at")
            derived_age_hours = age_hours(connected_at)
            if derived_age_hours is not None:
                truth_meta = {
                    "category": category,
                    "truth_state": "stale" if derived_age_hours > STALE_SOURCE_HOURS else "live",
                    "last_verified_at": connected_at,
                    "age_hours": derived_age_hours,
                    "next_expected_update": next_expected_update(connected_at),
                    "status": "connection_only",
                    "error_message": None,
                    "truth_reason": (
                        f"Connected {derived_age_hours:.1f}h ago, but the first full data sync hasn't completed yet. This usually resolves automatically."
                    ),
                }

        # After Merge relink, integration_accounts.updated_at moves forward but business_core.source_runs
        # may still reflect an old ingest → UI stayed "stale" forever. If the connection row is newer than
        # the last verified ingest for this category, treat as live while sync catches up.
        if truth_meta.get("truth_state") in {"stale", "error"}:
            row_updated = item.get("updated_at") or item.get("connected_at")
            row_dt = parse_dt(row_updated)
            ingest_dt = parse_dt(truth_meta.get("last_verified_at"))
            if row_dt and (not ingest_dt or row_dt > ingest_dt):
                truth_meta = {
                    **truth_meta,
                    "truth_state": "live",
                    "truth_reason": (
                        "Integration was recently reconnected. BIQc treats this source as current while "
                        "Merge finishes syncing; you may see fresh counts within a few minutes."
                    ),
                    "last_verified_at": row_updated,
                    "age_hours": age_hours(row_updated),
                    "status": "relinked_pending_sync",
                }

        integrations.append({
            **item,
            "truth_state": truth_meta.get("truth_state", "unverified"),
            "last_verified_at": truth_meta.get("last_verified_at"),
            "truth_reason": truth_meta.get("truth_reason"),
            "age_hours": truth_meta.get("age_hours"),
            "source_run_status": truth_meta.get("status"),
            "next_expected_update": next_expected_update(truth_meta.get("last_verified_at")),
        })

<<<<<<< Current (Your changes)
    def _category_state_from_integrations(category_key: str) -> Optional[str]:
        """If any connected row in this category is live (e.g. after relink), surface live at canonical level."""
        for row in integrations:
            if normalize_category(row.get("category")) != category_key:
                continue
            if row.get("connected") and row.get("truth_state") == "live":
                return "live"
        return None

    def _effective_domain_state(category_key: str) -> str:
        base = (connector_truth.get(category_key) or {}).get("truth_state", "unverified")
        promoted = _category_state_from_integrations(category_key)
        if promoted == "live":
            return "live"
        return base
=======
    freshness_map = {
        key: {
            "state": (connector_truth.get(key) or {}).get("truth_state", "unverified"),
            "last_synced_at": (connector_truth.get(key) or {}).get("last_verified_at"),
            "next_expected_update": next_expected_update((connector_truth.get(key) or {}).get("last_verified_at")),
            "age_hours": (connector_truth.get(key) or {}).get("age_hours"),
        }
        for key in ("crm", "accounting", "email", "calendar", "marketing")
    }
>>>>>>> Incoming (Background Agent changes)

    canonical_truth = {
        "crm_connected": any(normalize_category(i.get("category")) == "crm" and i.get("connected") for i in integrations),
        "accounting_connected": any(normalize_category(i.get("category")) == "accounting" and i.get("connected") for i in integrations),
        "email_connected": any(normalize_category(i.get("category")) == "email" and i.get("connected") for i in integrations),
        "hris_connected": any(normalize_category(i.get("category")) == "hris" and i.get("connected") for i in integrations),
        "total_connected": len([i for i in integrations if i.get("connected")]),
        "crm_state": _effective_domain_state("crm"),
        "accounting_state": _effective_domain_state("accounting"),
        "email_state": _effective_domain_state("email"),
        "verified_live_count": len([item for item in integrations if item.get("truth_state") == "live"]),
        "freshness": freshness_map,
        "live_sync_target_minutes": LIVE_SYNC_TARGET_MINUTES,
        "webhook_enabled": True,
    }

    return {"integrations": integrations, "canonical_truth": canonical_truth, "connector_truth": connector_truth}


def get_latest_snapshot_context(sb, user_id: str) -> Dict[str, Any]:
    try:
        snap = sb.table("intelligence_snapshots").select(
            "summary, executive_memo, generated_at"
        ).eq("user_id", user_id).order("generated_at", desc=True).limit(1).execute()
        if not snap.data:
            return {"summary": {}, "executive_memo": None, "generated_at": None}

        row = snap.data[0]
        summary = parse_json_field(row.get("summary")) or {}
        executive_memo = row.get("executive_memo")
        if not executive_memo and isinstance(summary, dict):
            executive_memo = summary.get("executive_memo") or ((summary.get("system_state") or {}).get("interpretation"))
        return {
            "summary": summary,
            "executive_memo": executive_memo,
            "generated_at": row.get("generated_at"),
        }
    except Exception as e:
        logger.warning(f"[live-truth] snapshot context lookup failed: {e}")
        return {"summary": {}, "executive_memo": None, "generated_at": None}


def get_recent_observation_events(sb, user_id: str, limit: int = 25) -> Dict[str, Any]:
    try:
        result = sb.table("observation_events").select(
            "id, signal_name, domain, severity, source, observed_at, payload, executive_summary", count="exact"
        ).eq("user_id", user_id).order("observed_at", desc=True).limit(limit).execute()
        events = []
        for row in (result.data or []):
            payload = parse_json_field(row.get("payload")) or {}
            events.append({**row, "signal_payload": payload})
        return {
            "events": events,
            "count": result.count or len(events),
            "last_signal_at": events[0].get("observed_at") if events else None,
        }
    except Exception as e:
        logger.warning(f"[live-truth] observation event lookup failed: {e}")
        return {"events": [], "count": 0, "last_signal_at": None}


def build_watchtower_events(observation_events: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
    severity_rank = {"critical": 0, "high": 1, "medium": 2, "moderate": 2, "low": 3, "info": 4}
    mapped: List[Dict[str, Any]] = []

    for row in observation_events:
        signal_name = str(row.get("signal_name") or "signal").strip()
        payload = row.get("signal_payload") or {}
        severity = str(row.get("severity") or payload.get("severity") or "medium").lower()
        if severity not in severity_rank:
            severity = "medium"

        detail = payload.get("detail") or payload.get("message") or payload.get("reason") or row.get("executive_summary")
        if not detail:
            if signal_name == "thread_silence":
                hours = payload.get("silence_hours") or payload.get("hours")
                detail = f"No reply activity detected for {hours} hours." if hours else "No reply activity detected in an active thread."
            elif signal_name == "response_delay":
                hours = payload.get("response_delay_hours") or payload.get("hours")
                detail = f"Response delay detected at {hours} hours." if hours else "Response delay detected in recent communications."
            else:
                detail = f"{signal_name.replace('_', ' ').title()} detected from {row.get('source') or 'live data'}."

        title = payload.get("title") or signal_name.replace("_", " ").title()
        recommendation = payload.get("recommendation") or payload.get("action") or "Review signal and take corrective action."

        mapped.append({
            "id": row.get("id") or f"obs-{signal_name}",
            "signal": signal_name,
            "event": signal_name,
            "title": title,
            "detail": detail,
            "impact": detail,
            "description": detail,
            "action": recommendation,
            "recommendation": recommendation,
            "severity": severity,
            "domain": row.get("domain") or payload.get("domain") or "general",
            "source": row.get("source") or payload.get("source") or "observation_events",
            "created_at": row.get("observed_at"),
        })

    deduped: List[Dict[str, Any]] = []
    seen_keys = set()
    for event in sorted(mapped, key=lambda item: (severity_rank.get(item.get("severity"), 9), item.get("created_at") or "")):
        dedupe_key = (event.get("signal"), event.get("title"), event.get("detail"))
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)
        deduped.append(event)
        if len(deduped) >= limit:
            break

    return deduped