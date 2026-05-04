"""
business_dna_persistence — single-chokepoint integrity layer for the
`public.business_dna_enrichment` table.

Issued under: P0 Marjo Critical Incident, 2026-05-04 (E5 mission).
Cites: BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2,
       feedback_zero_401_tolerance, ops_daily_calibration_check.

CONTRACT
========

Every successful URL-scan MUST persist exactly one row to
`business_dna_enrichment` keyed on (user_id, business_profile_id) where
the JSONB `enrichment` payload satisfies:

    1.  enrichment.business_name         non-empty string
    2.  enrichment.industry              non-empty string
    3.  enrichment.core_signals          JSONB array, len >= 1
                                          OR
        enrichment.truth_state == "INSUFFICIENT_SIGNAL"
                                          (with truth_reason populated)
    4.  enrichment.ai_errors             absent, or empty array []

Required FK-equivalent fields on the row itself:

    - user_id                            uuid (auth.users)
    - business_profile_id                uuid (business_profiles.id)
    - created_at                         timestamptz (auto-defaulted)

NOTE on `scan_id`: the mission brief listed `scan_id (FK)` as a required
contract field. Live schema audit (E5, 2026-05-04) confirms
`business_dna_enrichment` has no `scan_id` column — uniqueness is
enforced via `(user_id, business_profile_id)` in production. Adding a
new column would be schema-breaking outside this hotfix's scope. The
documented FK is therefore `business_profile_id`. Daily-check SQL
keys off `business_profile_id` for the same reason.

WHY THIS LAYER EXISTS
=====================

Pre-fix audit (2026-05-04, evidence/dna-table-state.txt) found that the
single live row in `business_dna_enrichment` had:

    - ai_errors populated   (Contract v2 violation)
    - industry empty        (required-field violation)
    - core_signals absent   (required-field violation)

Yet the row was returned to the CMO Report. Sanitization only happened
on the OUTBOUND response — the persisted row was still contaminated,
and any subsequent reader bypassing the sanitizer (e.g. a future
analytics worker) would read garbage as truth.

This module gates the WRITE so the DB row itself is the source of truth.

DUPLICATE-WRITE GUARD
=====================

The table has UNIQUE(user_id, business_profile_id). Both call sites in
`backend/routes/calibration.py` call `.upsert(..., on_conflict="user_id,
business_profile_id")` so concurrent / repeat scans for the same user
collapse to a single row (latest-scan-wins). This module preserves that
contract by funnelling all writes through `safe_upsert_business_dna()`
which forwards the same `on_conflict` clause. No new code path may
INSERT directly.

INCIDENT EMISSION
=================

If a scan attempts to persist with `ai_errors` populated, this module:

    1. STRIPS ai_errors from the persisted enrichment payload (the
       sanitizer already strips them from external responses, but the
       DB copy was previously tainted).
    2. Sets enrichment.truth_state = "DEGRADED" + truth_reason.
    3. Writes a row to `public.business_dna_persistence_incidents`
       (created by migration 135) with the redacted ai_errors detail
       for backend audit + the daily check script to alert on.
    4. Best-effort emits a row to `public.alerts_queue` so the user-
       facing alert pipeline picks it up if wired.

Step (3) NEVER raises — incident emission is a side-channel; it cannot
fail the scan. Step (1) is the protective action; step (4) is for
operator visibility.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────

REQUIRED_FIELDS: Tuple[str, ...] = (
    "business_name",
    "industry",
    "core_signals",
)

# Fields used to derive `core_signals` when the enrichment doesn't carry it
# explicitly. core_signals is a synthesised aggregate (per E5 mission spec)
# but the upstream calibration pipeline emits the underlying sections, not
# the aggregate. We compute it here so external readers have one canonical
# place to look.
CORE_SIGNAL_SOURCE_FIELDS: Tuple[str, ...] = (
    "competitors",
    "market_position",
    "swot",
    "executive_summary",
    "trust_signals",
    "seo_html_hygiene",
    "digital_footprint",
    "google_reviews",
    "competitor_swot",
)

INSUFFICIENT_SIGNAL = "INSUFFICIENT_SIGNAL"
DATA_AVAILABLE = "DATA_AVAILABLE"
DEGRADED = "DEGRADED"

INCIDENT_TABLE = "business_dna_persistence_incidents"


# ─── Helpers ──────────────────────────────────────────────────────────────

def _is_empty(value: Any) -> bool:
    """Signal-level emptiness: matches response_sanitizer._is_empty_or_zero
    so the validator agrees with the contract sanitizer downstream."""
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, tuple, dict)) and len(value) == 0:
        return True
    return False


def derive_core_signals(enrichment: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """Build a `core_signals` array from the enrichment sections that
    actually carried evidence. Each element is `{field, present}`.

    A signal is "present" when the source section has non-empty content.
    Returned list is the union of NON-EMPTY signals only — empty sections
    are not represented (so an empty list means truly no signals were
    captured, which then forces INSUFFICIENT_SIGNAL).
    """
    if not isinstance(enrichment, Mapping):
        return []
    signals: List[Dict[str, Any]] = []
    for field in CORE_SIGNAL_SOURCE_FIELDS:
        if field not in enrichment:
            continue
        value = enrichment.get(field)
        if _is_empty(value):
            continue
        # For dict-shaped sections, count any non-empty sub-field as evidence.
        if isinstance(value, dict):
            non_empty_subs = [k for k, v in value.items() if not _is_empty(v)]
            if not non_empty_subs:
                continue
            signals.append({"field": field, "present": True, "evidence_keys": sorted(non_empty_subs)})
        elif isinstance(value, list):
            signals.append({"field": field, "present": True, "evidence_count": len(value)})
        else:
            signals.append({"field": field, "present": True})
    return signals


def validate_required(enrichment: Mapping[str, Any]) -> Tuple[bool, List[str]]:
    """Return (ok, missing_field_names).

    `core_signals` is treated as satisfied when EITHER the array has >=1
    element OR `truth_state == INSUFFICIENT_SIGNAL` (which is the
    explicit contract escape valve for "we tried and got nothing").
    """
    if not isinstance(enrichment, Mapping):
        return False, list(REQUIRED_FIELDS)
    missing: List[str] = []

    if _is_empty(enrichment.get("business_name")):
        missing.append("business_name")
    if _is_empty(enrichment.get("industry")):
        missing.append("industry")

    core_signals = enrichment.get("core_signals")
    truth_state = (enrichment.get("truth_state") or "").strip().upper()
    has_signals = isinstance(core_signals, list) and len(core_signals) >= 1
    insufficient_signal_acknowledged = truth_state == INSUFFICIENT_SIGNAL
    if not has_signals and not insufficient_signal_acknowledged:
        missing.append("core_signals")

    return (len(missing) == 0, missing)


def extract_ai_errors(enrichment: Mapping[str, Any]) -> List[Any]:
    """Return the ai_errors list from an enrichment payload, or [] if absent.

    Accepts both the well-formed list shape and string/dict variants seen
    in production (e.g. `["SEMrush supplier API failed for every call"]`,
    `[{"error": "...", "status": 401, "function": "..."}]`).
    """
    if not isinstance(enrichment, Mapping):
        return []
    raw = enrichment.get("ai_errors")
    if raw is None:
        return []
    if isinstance(raw, list):
        return list(raw)
    # Defensive: other shapes get wrapped so the truth-check still flags them.
    return [raw]


# ─── Incident emission ────────────────────────────────────────────────────

def _redact_ai_error_entry(entry: Any) -> Dict[str, Any]:
    """Trim an ai_errors entry to a fixed-shape, supplier-name-free row
    suitable for the incidents table.

    External-state-shaped, never includes raw upstream messages. Per
    Contract v2 §3 (Backend is the boundary): the incidents table is
    INTERNAL — it WILL keep status codes + function names because the
    operator needs them to triage. But customer-facing surfaces never
    read from this table; if a daily check or alert template ever has
    to render incident contents to the operator, the row is already
    structured and safe.
    """
    if isinstance(entry, dict):
        return {
            "function": str(entry.get("function") or "")[:80],
            "status": entry.get("status"),
            # Cap free-text to 200 chars to avoid unbounded growth
            "error": str(entry.get("error") or "")[:200],
        }
    return {"error": str(entry)[:200]}


def record_incident(
    sb: Any,
    *,
    user_id: str,
    business_profile_id: Optional[str],
    incident_type: str,
    detail: Mapping[str, Any],
) -> None:
    """Write an incident row to `business_dna_persistence_incidents`.

    Best-effort: if the table doesn't exist yet (migration not applied)
    we log + return. Never raises.

    Also best-effort emits to alerts_queue with type='persistence_incident'.
    """
    if sb is None:
        return
    try:
        sb.table(INCIDENT_TABLE).insert({
            "user_id": user_id,
            "business_profile_id": business_profile_id,
            "incident_type": incident_type,
            "detail": dict(detail),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        logger.warning(
            "[business_dna_persistence] incident recorded type=%s user=%s profile=%s",
            incident_type, user_id, business_profile_id,
        )
    except Exception as incident_err:
        logger.error(
            "[business_dna_persistence] incident write FAILED type=%s user=%s err=%s",
            incident_type, user_id, incident_err,
        )

    # Side-channel: also publish to alerts_queue if available so existing
    # ops dashboards pick it up. Failure here is silent — alerts_queue
    # uptime is independent of this code path.
    try:
        sb.table("alerts_queue").insert({
            "user_id": user_id,
            "type": "persistence_incident",
            "source": "business_dna_persistence",
            "payload": {
                "incident_type": incident_type,
                "business_profile_id": business_profile_id,
                **{k: v for k, v in detail.items() if k != "ai_errors_raw"},
            },
            "priority": 1,  # P1 by default; daily check upgrades to P0 if pattern detected
        }).execute()
    except Exception:
        # alerts_queue may not be wired or may have evolved schema —
        # the persistence_incidents row above is the authoritative record.
        pass


# ─── The single write chokepoint ──────────────────────────────────────────

def safe_upsert_business_dna(
    sb: Any,
    *,
    user_id: str,
    business_profile_id: str,
    website_url: Optional[str],
    enrichment: Mapping[str, Any],
    digital_footprint: Optional[Mapping[str, Any]] = None,
    source: str = "calibration_scan",
) -> Dict[str, Any]:
    """Validate → enrich-with-derived-fields → strip-ai_errors → upsert.

    Returns a small report dict the caller can log:
        {
            "ok": bool,
            "wrote_row": bool,
            "stripped_ai_errors": int,
            "missing_required": List[str],
            "core_signals_count": int,
            "truth_state": str,
            "incident_recorded": bool,
        }

    NEVER raises — persistence failure must not crash the scan response.
    The caller still gets its sanitized response; this module is the
    DB-side guarantee.

    Duplicate-write guarantee: forwards `on_conflict='user_id,
    business_profile_id'` so the existing UNIQUE index collapses repeat
    scans into one row. The returned report carries `wrote_row=True` for
    both insert and update — the chokepoint is one Supabase call.
    """
    report: Dict[str, Any] = {
        "ok": False,
        "wrote_row": False,
        "stripped_ai_errors": 0,
        "missing_required": [],
        "core_signals_count": 0,
        "truth_state": DATA_AVAILABLE,
        "incident_recorded": False,
    }

    if not isinstance(enrichment, Mapping):
        logger.error("[business_dna_persistence] enrichment is not a Mapping; abort")
        return report

    # Take a shallow copy so we don't mutate the caller's object.
    payload: Dict[str, Any] = dict(enrichment)

    # ─── 1. Strip ai_errors from the persisted payload + record incident ──
    ai_errors = extract_ai_errors(payload)
    if ai_errors:
        report["stripped_ai_errors"] = len(ai_errors)
        report["truth_state"] = DEGRADED
        # Side-channel incident before strip so the operator sees the redacted
        # detail; the DB row keeps no trace of supplier names.
        record_incident(
            sb,
            user_id=user_id,
            business_profile_id=business_profile_id,
            incident_type="ai_errors_present_at_persistence",
            detail={
                "source": source,
                "website_url": website_url,
                "ai_errors_count": len(ai_errors),
                "ai_errors_redacted": [_redact_ai_error_entry(e) for e in ai_errors[:10]],
                "truth_state": DEGRADED,
            },
        )
        report["incident_recorded"] = True
        # Keep payload free of ai_errors at the DB layer too.
        payload.pop("ai_errors", None)
        # Mark the persisted row so any reader can see degradation without
        # the leak. truth_reason is operator-readable but supplier-free.
        payload["truth_state"] = DEGRADED
        payload.setdefault(
            "truth_reason",
            "One or more upstream intelligence signals could not be confirmed for this scan.",
        )

    # ─── 2. Derive core_signals if not present ───────────────────────────
    if "core_signals" not in payload or not isinstance(payload.get("core_signals"), list):
        derived = derive_core_signals(payload)
        payload["core_signals"] = derived
    report["core_signals_count"] = len(payload.get("core_signals") or [])

    # ─── 3. Validate required fields BEFORE the upsert ────────────────────
    ok, missing = validate_required(payload)
    report["missing_required"] = missing
    if not ok:
        # Per the v2 contract: missing data is uncertainty, not failure.
        # If business_name OR industry is empty, the scan didn't capture
        # the basics — surface as INSUFFICIENT_SIGNAL with reason. The
        # row STILL gets written so we have an audit trail of the attempt.
        payload["truth_state"] = INSUFFICIENT_SIGNAL
        payload.setdefault(
            "truth_reason",
            "Insufficient public signal to confirm this business profile from the URL provided.",
        )
        report["truth_state"] = INSUFFICIENT_SIGNAL
        record_incident(
            sb,
            user_id=user_id,
            business_profile_id=business_profile_id,
            incident_type="required_fields_missing",
            detail={
                "source": source,
                "website_url": website_url,
                "missing_fields": missing,
                "truth_state": INSUFFICIENT_SIGNAL,
            },
        )
        report["incident_recorded"] = True

    # ─── 4. The upsert (single chokepoint, on_conflict guarded) ──────────
    try:
        sb.table("business_dna_enrichment").upsert(
            {
                "user_id": user_id,
                "business_profile_id": business_profile_id,
                "website_url": website_url,
                "enrichment": payload,
                "digital_footprint": dict(digital_footprint or {}),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="user_id,business_profile_id",
        ).execute()
        report["wrote_row"] = True
        report["ok"] = True
        logger.info(
            "[business_dna_persistence] upserted user=%s profile=%s "
            "truth_state=%s missing=%s stripped_ai_errors=%d core_signals=%d",
            user_id,
            business_profile_id,
            report["truth_state"],
            missing,
            report["stripped_ai_errors"],
            report["core_signals_count"],
        )
    except Exception as upsert_err:
        logger.error(
            "[business_dna_persistence] upsert FAILED user=%s profile=%s err=%s",
            user_id, business_profile_id, upsert_err,
        )
        record_incident(
            sb,
            user_id=user_id,
            business_profile_id=business_profile_id,
            incident_type="upsert_exception",
            detail={
                "source": source,
                "website_url": website_url,
                "error_message": str(upsert_err)[:500],
            },
        )
        report["incident_recorded"] = True

    return report


__all__ = [
    "REQUIRED_FIELDS",
    "CORE_SIGNAL_SOURCE_FIELDS",
    "INSUFFICIENT_SIGNAL",
    "DATA_AVAILABLE",
    "DEGRADED",
    "INCIDENT_TABLE",
    "derive_core_signals",
    "validate_required",
    "extract_ai_errors",
    "record_incident",
    "safe_upsert_business_dna",
]
