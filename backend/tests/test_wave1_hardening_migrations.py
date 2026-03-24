"""
Static assertions for Wave 1 hardening migrations.
These checks are offline and prevent accidental policy/function regressions.
"""

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"


def _read(name: str) -> str:
    return (MIGRATIONS_DIR / name).read_text(encoding="utf-8")


def test_065_contains_tenant_lockdown_policies():
    sql = _read("065_rls_tenant_lockdown.sql")
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "workspace_integrations_tenant_read" in sql
    assert "governance_events_tenant_read" in sql
    assert "report_exports_tenant_read" in sql
    assert "generated_files_tenant_read" in sql
    assert "enterprise_contact_requests_user_read" in sql
    assert "auth.uid()" in sql


def test_066_contains_tier_canonicalization_and_sync():
    sql = _read("066_subscription_tier_source_of_truth.sql")
    assert "normalize_subscription_tier" in sql
    assert "sync_business_profile_tier_from_users" in sql
    assert "trg_sync_business_profile_tier_from_users" in sql
    assert "admin_update_subscription" in sql
    assert "auth.role()" in sql
    assert "service_role" in sql
    assert "SET search_path = ''" in sql


def test_067_contains_super_admin_rpc_hardening():
    sql = _read("067_super_admin_rpc_authorization.sql")
    assert "CREATE POLICY \"superadmin_read\"" in sql
    assert "admin_list_users" in sql
    assert "admin_toggle_user" in sql
    assert "Not authorized" in sql
    assert "auth.role()" in sql
    assert "service_role" in sql
    assert "SET search_path = ''" in sql
