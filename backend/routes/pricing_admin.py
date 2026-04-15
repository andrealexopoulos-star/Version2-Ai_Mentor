"""Admin pricing control-plane routes (plans, entitlements, publish, rollback)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator

from routes.deps import get_super_admin, get_sb


router = APIRouter()


PLAN_KEY_ALIASES = {
    "foundation": "starter",
    "growth": "starter",
    "professional": "pro",
    "custom": "custom_build",
}
ALLOWED_PLAN_KEYS = {"free", "starter", "pro", "business", "enterprise", "custom_build"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_plan_key(value: str) -> str:
    normalized = str(value or "").strip().lower()
    normalized = PLAN_KEY_ALIASES.get(normalized, normalized)
    if normalized not in ALLOWED_PLAN_KEYS:
        raise ValueError(f"plan_key must be one of {sorted(ALLOWED_PLAN_KEYS)}")
    return normalized


def _validate_override_window(starts_at: Optional[str], ends_at: Optional[str]) -> None:
    if not starts_at or not ends_at:
        return
    try:
        start_dt = datetime.fromisoformat(str(starts_at).replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(str(ends_at).replace("Z", "+00:00"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="starts_at and ends_at must be valid ISO datetime values") from exc
    if end_dt < start_dt:
        raise HTTPException(status_code=400, detail="ends_at must be greater than or equal to starts_at")


def _validate_override_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    data = payload or {}
    try:
        encoded = json.dumps(data, separators=(",", ":"), default=str)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="override_payload must be JSON-serializable") from exc
    if len(encoded.encode("utf-8")) > 32768:
        raise HTTPException(status_code=400, detail="override_payload exceeds 32KB limit")
    return data


def _audit_log(actor_user_id: str, action: str, entity_type: str, entity_id: str, before_state: Any, after_state: Any, context: Optional[Dict[str, Any]] = None) -> None:
    sb = get_sb()
    try:
        sb.table("pricing_audit_log").insert(
            {
                "actor_user_id": actor_user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "before_state": before_state,
                "after_state": after_state,
                "context": context or {},
                "created_at": _now_iso(),
            }
        ).execute()
    except Exception:
        # Audit write should not block admin operation in this skeleton.
        pass


class PricingPlanUpsert(BaseModel):
    plan_key: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=128)
    currency: str = Field(default="AUD", min_length=3, max_length=3)
    monthly_price_cents: int = Field(ge=0)
    annual_price_cents: Optional[int] = Field(default=None, ge=0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("plan_key")
    @classmethod
    def validate_plan_key(cls, value: str) -> str:
        v = _normalize_plan_key(value)
        if not all(ch.isalnum() or ch in {"-", "_"} for ch in v):
            raise ValueError("plan_key must be alphanumeric with - or _")
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return value.strip().upper()


class FeatureEntitlement(BaseModel):
    feature_key: str = Field(min_length=2, max_length=128)
    min_tier: Optional[str] = None
    launch_type: Optional[str] = None
    usage_limit_monthly: Optional[int] = Field(default=None, ge=0)
    overage_unit: Optional[str] = None
    overage_price_cents: Optional[float] = Field(default=None, ge=0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("feature_key")
    @classmethod
    def normalize_feature_key(cls, value: str) -> str:
        return value.strip().lower()


class EntitlementsUpsert(BaseModel):
    plan_key: str
    plan_version: Optional[int] = None
    features: List[FeatureEntitlement] = Field(default_factory=list)

    @field_validator("plan_key")
    @classmethod
    def normalize_plan_key(cls, value: str) -> str:
        return _normalize_plan_key(value)


class PricingPublishRequest(BaseModel):
    plan_key: str
    product_approver_user_id: str = Field(min_length=8)
    finance_approver_user_id: str = Field(min_length=8)
    legal_approver_user_id: str = Field(min_length=8)
    effective_from: Optional[str] = None

    @field_validator("plan_key")
    @classmethod
    def normalize_plan_key(cls, value: str) -> str:
        return _normalize_plan_key(value)


class PricingRollbackRequest(BaseModel):
    plan_key: str
    target_version: int = Field(ge=1)
    product_approver_user_id: str = Field(min_length=8)
    finance_approver_user_id: str = Field(min_length=8)
    legal_approver_user_id: str = Field(min_length=8)
    reason: str = Field(min_length=4, max_length=512)

    @field_validator("plan_key")
    @classmethod
    def normalize_plan_key(cls, value: str) -> str:
        return _normalize_plan_key(value)


class PricingOverrideUpsert(BaseModel):
    id: Optional[str] = None
    account_id: Optional[str] = None
    user_id: Optional[str] = None
    feature_key: Optional[str] = None
    override_payload: Dict[str, Any] = Field(default_factory=dict)
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    status: str = "active"
    reason: Optional[str] = None

    @field_validator("feature_key")
    @classmethod
    def normalize_feature_key(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().lower()
        if normalized and not all(ch.isalnum() or ch in {"-", "_", "."} for ch in normalized):
            raise ValueError("feature_key must be alphanumeric with -, _, or .")
        return normalized

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: str) -> str:
        normalized = str(value or "").strip().lower()
        allowed = {"active", "inactive", "expired", "scheduled"}
        if normalized not in allowed:
            raise ValueError(f"status must be one of {sorted(allowed)}")
        return normalized

    @field_validator("override_payload")
    @classmethod
    def validate_override_payload_size(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        try:
            encoded = json.dumps(value or {}, separators=(",", ":"), default=str)
        except Exception as exc:
            raise ValueError("override_payload must be JSON-serializable") from exc
        if len(encoded.encode("utf-8")) > 32768:
            raise ValueError("override_payload exceeds 32KB limit")
        return value or {}

    @model_validator(mode="after")
    def validate_window(self):
        if self.starts_at and self.ends_at:
            try:
                start_dt = datetime.fromisoformat(str(self.starts_at).replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(str(self.ends_at).replace("Z", "+00:00"))
            except Exception as exc:
                raise ValueError("starts_at and ends_at must be valid ISO datetime values") from exc
            if end_dt < start_dt:
                raise ValueError("ends_at must be greater than or equal to starts_at")
        return self


@router.get("/admin/pricing/plans")
async def admin_pricing_plans(admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    plans = (
        sb.table("pricing_plans")
        .select("*")
        .order("plan_key")
        .order("version", desc=True)
        .execute()
    )
    return {"plans": plans.data or []}


@router.get("/admin/pricing/releases")
async def admin_pricing_releases(
    plan_key: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    admin: dict = Depends(get_super_admin),
):
    sb = get_sb()
    q = sb.table("pricing_releases").select("*").order("published_at", desc=True).limit(limit)
    if plan_key:
        q = q.eq("plan_key", plan_key.strip().lower())
    rows = q.execute()
    return {"releases": rows.data or []}


@router.get("/admin/pricing/audit-log")
async def admin_pricing_audit_log(
    plan_key: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    admin: dict = Depends(get_super_admin),
):
    sb = get_sb()
    q = sb.table("pricing_audit_log").select("*").order("created_at", desc=True).limit(limit)
    rows = q.execute()
    data = rows.data or []
    if plan_key:
        pk = plan_key.strip().lower()
        data = [
            row for row in data
            if str(((row.get("context") or {}).get("plan_key") or "")).strip().lower() == pk
            or str(row.get("entity_id") or "").strip().lower().startswith(f"{pk}:")
        ]
    return {"audit_log": data}


@router.put("/admin/pricing/plans")
async def admin_upsert_pricing_plan(payload: PricingPlanUpsert, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    existing = (
        sb.table("pricing_plans")
        .select("version")
        .eq("plan_key", payload.plan_key)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    current_version = int((existing.data or [{}])[0].get("version") or 0)
    new_version = current_version + 1
    row = {
        "plan_key": payload.plan_key,
        "version": new_version,
        "name": payload.name,
        "currency": payload.currency,
        "monthly_price_cents": payload.monthly_price_cents,
        "annual_price_cents": payload.annual_price_cents,
        "is_active": False,
        "is_draft": True,
        "metadata": payload.metadata or {},
        "created_by": admin.get("id"),
        "updated_by": admin.get("id"),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    created = sb.table("pricing_plans").insert(row).execute()
    if not created.data:
        raise HTTPException(status_code=500, detail="Failed to save pricing plan draft")

    _audit_log(
        actor_user_id=admin.get("id"),
        action="upsert_plan_draft",
        entity_type="pricing_plan",
        entity_id=f"{payload.plan_key}:{new_version}",
        before_state={"latest_version": current_version},
        after_state=row,
    )
    return {"ok": True, "plan": created.data[0]}


@router.get("/admin/pricing/entitlements")
async def admin_pricing_entitlements(plan_key: str, plan_version: Optional[int] = None, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    pk = plan_key.strip().lower()

    version = plan_version
    if version is None:
        latest = (
            sb.table("pricing_plans")
            .select("version")
            .eq("plan_key", pk)
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        if not latest.data:
            raise HTTPException(status_code=404, detail=f"No pricing plan found for {pk}")
        version = int(latest.data[0]["version"])

    features = (
        sb.table("pricing_features")
        .select("*")
        .eq("plan_key", pk)
        .eq("plan_version", version)
        .order("feature_key")
        .execute()
    )
    return {"plan_key": pk, "plan_version": version, "features": features.data or []}


@router.put("/admin/pricing/entitlements")
async def admin_upsert_pricing_entitlements(payload: EntitlementsUpsert, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    pk = payload.plan_key

    version = payload.plan_version
    if version is None:
        latest = (
            sb.table("pricing_plans")
            .select("version")
            .eq("plan_key", pk)
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        if not latest.data:
            raise HTTPException(status_code=404, detail=f"No pricing plan found for {pk}")
        version = int(latest.data[0]["version"])

    before = (
        sb.table("pricing_features")
        .select("*")
        .eq("plan_key", pk)
        .eq("plan_version", version)
        .execute()
    )

    # Replace full entitlement set for the target version.
    sb.table("pricing_features").delete().eq("plan_key", pk).eq("plan_version", version).execute()
    rows = []
    now = _now_iso()
    for feature in payload.features:
        rows.append(
            {
                "plan_key": pk,
                "plan_version": version,
                "feature_key": feature.feature_key,
                "min_tier": feature.min_tier,
                "launch_type": feature.launch_type,
                "usage_limit_monthly": feature.usage_limit_monthly,
                "overage_unit": feature.overage_unit,
                "overage_price_cents": feature.overage_price_cents,
                "metadata": feature.metadata or {},
                "created_by": admin.get("id"),
                "updated_by": admin.get("id"),
                "created_at": now,
                "updated_at": now,
            }
        )
    if rows:
        sb.table("pricing_features").insert(rows).execute()

    _audit_log(
        actor_user_id=admin.get("id"),
        action="replace_entitlements",
        entity_type="pricing_features",
        entity_id=f"{pk}:{version}",
        before_state=before.data or [],
        after_state=rows,
        context={"feature_count": len(rows)},
    )
    return {"ok": True, "plan_key": pk, "plan_version": version, "feature_count": len(rows)}


def _is_super_admin_user(sb, user_id: str) -> bool:
    row = (
        sb.table("users")
        .select("role,is_master_account")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    data = row.data or {}
    role = str(data.get("role") or "").lower()
    is_master = bool(data.get("is_master_account"))
    return role in {"super_admin", "superadmin"} or is_master


def _validate_release_approvers(sb, actor_id: str, *, product_id: str, finance_id: str, legal_id: str) -> None:
    approvers = [str(product_id or "").strip(), str(finance_id or "").strip(), str(legal_id or "").strip()]
    if any(not item for item in approvers):
        raise HTTPException(status_code=400, detail="Product, finance, and legal approvers are required")
    if actor_id in approvers:
        raise HTTPException(
            status_code=400,
            detail="Separation of duties violation: actor cannot self-approve product/finance/legal controls",
        )
    if len(set(approvers)) != 3:
        raise HTTPException(status_code=400, detail="Product, finance, and legal approvers must be distinct users")
    missing = [uid for uid in approvers if not _is_super_admin_user(sb, uid)]
    if missing:
        raise HTTPException(status_code=403, detail=f"All approvers must be super admin users: {missing}")


@router.post("/admin/pricing/publish")
async def admin_publish_pricing(payload: PricingPublishRequest, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    actor_id = str(admin.get("id") or "")
    _validate_release_approvers(
        sb,
        actor_id,
        product_id=payload.product_approver_user_id,
        finance_id=payload.finance_approver_user_id,
        legal_id=payload.legal_approver_user_id,
    )

    latest_draft = (
        sb.table("pricing_plans")
        .select("*")
        .eq("plan_key", payload.plan_key)
        .eq("is_draft", True)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    if not latest_draft.data:
        raise HTTPException(status_code=404, detail="No draft plan to publish")
    draft = latest_draft.data[0]

    active = (
        sb.table("pricing_plans")
        .select("*")
        .eq("plan_key", payload.plan_key)
        .eq("is_active", True)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    from_version = int((active.data or [{}])[0].get("version") or 0) if active.data else None

    # deactivate existing active
    sb.table("pricing_plans").update({"is_active": False, "updated_by": actor_id, "updated_at": _now_iso()}).eq(
        "plan_key", payload.plan_key
    ).eq("is_active", True).execute()

    # activate draft
    sb.table("pricing_plans").update(
        {
            "is_active": True,
            "is_draft": False,
            "effective_from": payload.effective_from or _now_iso(),
            "updated_by": actor_id,
            "updated_at": _now_iso(),
        }
    ).eq("id", draft["id"]).execute()

    release = (
        sb.table("pricing_releases")
        .insert(
            {
                "plan_key": payload.plan_key,
                "from_version": from_version,
                "to_version": int(draft["version"]),
                "published_by": actor_id,
                # Keep compatibility with existing schema where approved_by is a single UUID.
                "approved_by": payload.finance_approver_user_id,
                "published_at": _now_iso(),
                "status": "published",
            }
        )
        .execute()
    )

    _audit_log(
        actor_user_id=actor_id,
        action="publish_pricing",
        entity_type="pricing_release",
        entity_id=str((release.data or [{}])[0].get("id") or ""),
        before_state={"active_version": from_version},
        after_state={"active_version": int(draft["version"])},
        context={
            "plan_key": payload.plan_key,
            "approval_contract": {
                "version": "v1_triple_signoff",
                "to_version": int(draft["version"]),
                "actor_user_id": actor_id,
                "product_approver_user_id": payload.product_approver_user_id,
                "finance_approver_user_id": payload.finance_approver_user_id,
                "legal_approver_user_id": payload.legal_approver_user_id,
                "separation_of_duties_validated": True,
            },
        },
    )
    return {
        "ok": True,
        "plan_key": payload.plan_key,
        "from_version": from_version,
        "to_version": int(draft["version"]),
        "approval_summary": {
            "actor_user_id": actor_id,
            "product_approver_user_id": payload.product_approver_user_id,
            "finance_approver_user_id": payload.finance_approver_user_id,
            "legal_approver_user_id": payload.legal_approver_user_id,
        },
        "release": (release.data or [None])[0],
    }


@router.post("/admin/pricing/rollback")
async def admin_rollback_pricing(payload: PricingRollbackRequest, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    actor_id = str(admin.get("id") or "")
    _validate_release_approvers(
        sb,
        actor_id,
        product_id=payload.product_approver_user_id,
        finance_id=payload.finance_approver_user_id,
        legal_id=payload.legal_approver_user_id,
    )

    target = (
        sb.table("pricing_plans")
        .select("*")
        .eq("plan_key", payload.plan_key)
        .eq("version", payload.target_version)
        .limit(1)
        .execute()
    )
    if not target.data:
        raise HTTPException(status_code=404, detail="Target version not found")
    target_row = target.data[0]

    current = (
        sb.table("pricing_plans")
        .select("*")
        .eq("plan_key", payload.plan_key)
        .eq("is_active", True)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    current_version = int((current.data or [{}])[0].get("version") or 0) if current.data else None

    sb.table("pricing_plans").update({"is_active": False, "updated_by": actor_id, "updated_at": _now_iso()}).eq(
        "plan_key", payload.plan_key
    ).eq("is_active", True).execute()

    sb.table("pricing_plans").update(
        {"is_active": True, "is_draft": False, "updated_by": actor_id, "updated_at": _now_iso()}
    ).eq("id", target_row["id"]).execute()

    release = (
        sb.table("pricing_releases")
        .insert(
            {
                "plan_key": payload.plan_key,
                "from_version": current_version,
                "to_version": payload.target_version,
                "published_by": actor_id,
                "approved_by": payload.finance_approver_user_id,
                "published_at": _now_iso(),
                "rollback_reason": payload.reason,
                "status": "rolled_back",
            }
        )
        .execute()
    )

    _audit_log(
        actor_user_id=actor_id,
        action="rollback_pricing",
        entity_type="pricing_release",
        entity_id=str((release.data or [{}])[0].get("id") or ""),
        before_state={"active_version": current_version},
        after_state={"active_version": payload.target_version},
        context={
            "plan_key": payload.plan_key,
            "reason": payload.reason,
            "approval_contract": {
                "version": "v1_triple_signoff",
                "to_version": int(payload.target_version),
                "actor_user_id": actor_id,
                "product_approver_user_id": payload.product_approver_user_id,
                "finance_approver_user_id": payload.finance_approver_user_id,
                "legal_approver_user_id": payload.legal_approver_user_id,
                "separation_of_duties_validated": True,
            },
        },
    )
    return {
        "ok": True,
        "plan_key": payload.plan_key,
        "from_version": current_version,
        "to_version": payload.target_version,
        "approval_summary": {
            "actor_user_id": actor_id,
            "product_approver_user_id": payload.product_approver_user_id,
            "finance_approver_user_id": payload.finance_approver_user_id,
            "legal_approver_user_id": payload.legal_approver_user_id,
        },
        "release": (release.data or [None])[0],
    }


@router.get("/admin/pricing/overrides")
async def admin_pricing_overrides(
    user_id: Optional[str] = Query(default=None),
    account_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    admin: dict = Depends(get_super_admin),
):
    sb = get_sb()
    q = sb.table("pricing_overrides").select("*").order("created_at", desc=True).limit(200)
    if user_id:
        q = q.eq("user_id", user_id)
    if account_id:
        q = q.eq("account_id", account_id)
    if status:
        q = q.eq("status", status)
    rows = q.execute()
    return {"overrides": rows.data or []}


@router.put("/admin/pricing/overrides")
async def admin_upsert_pricing_override(payload: PricingOverrideUpsert, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    actor_id = str(admin.get("id") or "")
    now = _now_iso()

    if not payload.account_id and not payload.user_id:
        raise HTTPException(status_code=400, detail="account_id or user_id is required")
    _validate_override_window(payload.starts_at, payload.ends_at)

    row = {
        "account_id": payload.account_id,
        "user_id": payload.user_id,
        "feature_key": payload.feature_key,
        "override_payload": _validate_override_payload(payload.override_payload),
        "starts_at": payload.starts_at,
        "ends_at": payload.ends_at,
        "status": payload.status,
        "reason": payload.reason,
        "updated_by": actor_id,
        "updated_at": now,
    }

    if payload.id:
        before = sb.table("pricing_overrides").select("*").eq("id", payload.id).maybe_single().execute()
        updated = sb.table("pricing_overrides").update(row).eq("id", payload.id).execute()
        if not updated.data:
            raise HTTPException(status_code=404, detail="Override not found")
        _audit_log(
            actor_user_id=actor_id,
            action="update_pricing_override",
            entity_type="pricing_override",
            entity_id=str(payload.id),
            before_state=before.data if before else None,
            after_state=updated.data[0],
        )
        return {"ok": True, "override": updated.data[0]}

    row["created_by"] = actor_id
    row["created_at"] = now
    created = sb.table("pricing_overrides").insert(row).execute()
    if not created.data:
        raise HTTPException(status_code=500, detail="Failed to create override")
    _audit_log(
        actor_user_id=actor_id,
        action="create_pricing_override",
        entity_type="pricing_override",
        entity_id=str(created.data[0].get("id")),
        before_state=None,
        after_state=created.data[0],
    )
    return {"ok": True, "override": created.data[0]}
