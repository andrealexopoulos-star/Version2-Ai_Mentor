"""
Supabase Helper Functions for Remaining Collections
Completes the migration to 100%
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# =============================================
# ONBOARDING
# =============================================

async def get_onboarding_supabase(supabase_client, user_id: str) -> Optional[Dict[str, Any]]:
    onboarding_row = None
    operator_onboarding = None
    console_onboarding = None

    try:
        result = supabase_client.table("onboarding").select("*").eq("user_id", user_id).limit(1).execute()
        if result.data:
            onboarding_row = result.data[0]
    except Exception:
        pass

    try:
        op_result = supabase_client.table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybe_single().execute()
        if op_result.data:
            operator_profile = op_result.data.get("operator_profile") or {}
            onboarding_state = operator_profile.get("onboarding_state")
            if isinstance(onboarding_state, dict):
                operator_onboarding = {
                    "user_id": user_id,
                    "completed": bool(onboarding_state.get("completed")),
                    "current_step": onboarding_state.get("current_step", 0),
                    "business_stage": onboarding_state.get("business_stage"),
                    "onboarding_data": onboarding_state.get("data") or {},
                    "source": "user_operator_profile",
                }
    except Exception:
        pass

    try:
        console_result = supabase_client.table("strategic_console_state").select(
            "status, current_step, is_complete"
        ).eq("user_id", user_id).maybe_single().execute()
        if console_result.data and (
            console_result.data.get("is_complete") or str(console_result.data.get("status") or "").upper() == "COMPLETED"
        ):
            console_onboarding = {
                "user_id": user_id,
                "completed": True,
                "current_step": console_result.data.get("current_step", 0),
                "business_stage": None,
                "onboarding_data": {},
                "source": "strategic_console_state",
            }
    except Exception:
        pass

    if onboarding_row or operator_onboarding or console_onboarding:
        onboarding_completed = any([
            bool((onboarding_row or {}).get("completed")),
            bool((operator_onboarding or {}).get("completed")),
            bool((console_onboarding or {}).get("completed")),
        ])

        return {
            "user_id": user_id,
            "completed": onboarding_completed,
            "current_step": (onboarding_row or {}).get("current_step")
            or (operator_onboarding or {}).get("current_step")
            or (console_onboarding or {}).get("current_step")
            or 0,
            "business_stage": (onboarding_row or {}).get("business_stage")
            or (operator_onboarding or {}).get("business_stage"),
            "onboarding_data": (onboarding_row or {}).get("onboarding_data")
            or (operator_onboarding or {}).get("onboarding_data")
            or {},
            "source": "reconciled",
        }

    return None

async def update_onboarding_supabase(supabase_client, user_id: str, data: Dict[str, Any]) -> bool:
    try:
        data["user_id"] = user_id
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase_client.table("onboarding").upsert(data, on_conflict="user_id").execute()
        return True
    except Exception as e:
        logger.error(f"Error updating onboarding: {e}")
        return False

# =============================================
# WEB SOURCES
# =============================================

async def get_web_sources_supabase(supabase_client, user_id: str) -> List[Dict[str, Any]]:
    try:
        result = supabase_client.table("web_sources").select("*").eq("user_id", user_id).execute()
        return result.data if result.data else []
    except:
        return []

async def update_web_source_supabase(supabase_client, url: str, data: Dict[str, Any]) -> bool:
    try:
        supabase_client.table("web_sources").update(data).eq("url", url).execute()
        return True
    except:
        return False

# =============================================
# SOPS
# =============================================

async def create_sop_supabase(supabase_client, sop_data: Dict[str, Any]) -> bool:
    try:
        supabase_client.table("sops").insert(sop_data).execute()
        return True
    except:
        return False

async def get_sops_supabase(supabase_client, user_id: str) -> List[Dict[str, Any]]:
    try:
        result = supabase_client.table("sops").select("*").eq("user_id", user_id).execute()
        return result.data if result.data else []
    except:
        return []

async def count_sops_supabase(supabase_client, user_id: str) -> int:
    try:
        result = supabase_client.table("sops").select("id", count="exact").eq("user_id", user_id).execute()
        return result.count if result.count else 0
    except:
        return 0

# =============================================
# INVITES
# =============================================

async def create_invite_supabase(supabase_client, invite_data: Dict[str, Any]) -> bool:
    try:
        supabase_client.table("invites").insert(invite_data).execute()
        return True
    except:
        return False

async def get_invite_supabase(supabase_client, token: str) -> Optional[Dict[str, Any]]:
    try:
        result = supabase_client.table("invites").select("*").eq("token", token).single().execute()
        return result.data if result.data else None
    except:
        return None

async def delete_invite_supabase(supabase_client, token: str) -> bool:
    try:
        supabase_client.table("invites").delete().eq("token", token).execute()
        return True
    except:
        return False

# =============================================
# DIAGNOSES
# =============================================

async def create_diagnosis_supabase(supabase_client, diagnosis_data: Dict[str, Any]) -> bool:
    try:
        supabase_client.table("diagnoses").insert(diagnosis_data).execute()
        return True
    except:
        return False

async def get_diagnoses_supabase(supabase_client, user_id: str) -> List[Dict[str, Any]]:
    try:
        result = supabase_client.table("diagnoses").select("*").eq("user_id", user_id).execute()
        return result.data if result.data else []
    except:
        return []

# =============================================
# OAC (Operations Advisory Centre)
# =============================================

async def get_oac_usage_supabase(supabase_client, user_id: str, month_key: str) -> Optional[Dict[str, Any]]:
    try:
        result = supabase_client.table("oac_usage").select("*").eq("user_id", user_id).eq("month_key", month_key).single().execute()
        return result.data if result.data else None
    except:
        return None

async def update_oac_usage_supabase(supabase_client, user_id: str, month_key: str, data: Dict[str, Any]) -> bool:
    try:
        data["user_id"] = user_id
        data["month_key"] = month_key
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase_client.table("oac_usage").upsert(data, on_conflict="user_id,month_key").execute()
        return True
    except:
        return False

async def get_oac_recommendations_supabase(supabase_client, user_id: str, month_key: str) -> Optional[Dict[str, Any]]:
    try:
        result = supabase_client.table("oac_recommendations").select("*").eq("user_id", user_id).eq("month_key", month_key).single().execute()
        return result.data if result.data else None
    except:
        return None

async def update_oac_recommendations_supabase(supabase_client, user_id: str, month_key: str, data: Dict[str, Any]) -> bool:
    try:
        data["user_id"] = user_id
        data["month_key"] = month_key
        supabase_client.table("oac_recommendations").upsert(data, on_conflict="user_id,month_key").execute()
        return True
    except:
        return False

# =============================================
# SETTINGS
# =============================================

async def get_setting_supabase(supabase_client, key: str) -> Optional[Dict[str, Any]]:
    try:
        result = supabase_client.table("settings").select("*").eq("key", key).single().execute()
        return result.data if result.data else None
    except:
        return None

async def update_setting_supabase(supabase_client, key: str, value: Any) -> bool:
    try:
        data = {"key": key, "value": value, "updated_at": datetime.now(timezone.utc).isoformat()}
        supabase_client.table("settings").upsert(data, on_conflict="key").execute()
        return True
    except:
        return False

# =============================================
# DISMISSED NOTIFICATIONS
# =============================================

async def dismiss_notification_supabase(supabase_client, user_id: str, notification_id: str) -> bool:
    try:
        data = {"user_id": user_id, "notification_id": notification_id}
        supabase_client.table("dismissed_notifications").upsert(data, on_conflict="user_id,notification_id").execute()
        return True
    except:
        return False

# =============================================
# ACCOUNTS
# =============================================

async def get_account_supabase(supabase_client, account_id: str) -> Optional[Dict[str, Any]]:
    try:
        result = supabase_client.table("accounts").select("*").eq("id", account_id).single().execute()
        return result.data if result.data else None
    except:
        return None

async def create_account_supabase(supabase_client, account_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        result = supabase_client.table("accounts").insert(account_data).execute()
        return result.data[0] if result.data else None
    except:
        return None
