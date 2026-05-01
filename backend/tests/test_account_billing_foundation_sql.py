"""Static assertions for PR-1.5 account-billing foundation migrations."""
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase" / "migrations"


def _read(name: str) -> str:
    return (MIGRATIONS / name).read_text(encoding="utf-8")


def test_128_guarantees_users_account_id_and_index():
    sql = _read("128_account_linkage_foundation.sql")
    assert "ADD COLUMN account_id uuid" in sql
    assert "idx_users_account_id" in sql
    assert "users_account_id_fkey" in sql


def test_129_creates_account_billing_policy_with_period_fields():
    sql = _read("129_account_billing_policy.sql")
    assert "CREATE TABLE IF NOT EXISTS public.account_billing_policy" in sql
    assert "current_period_start" in sql
    assert "current_period_end" in sql
    assert "monthly_topup_cap_override" in sql
    assert "auto_topup_enabled" in sql
    assert "payment_required" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "account_billing_policy_member_read" in sql
    assert "account_billing_policy_service_role" in sql


def test_130_adds_usage_ledger_account_scope_and_member_policy():
    sql = _read("130_usage_ledger_account_scope.sql")
    assert "ADD COLUMN account_id uuid" in sql
    assert "idx_usage_ledger_account_created" in sql
    assert "idx_usage_ledger_account_kind_created" in sql
    assert "stamp_usage_ledger_account_id" in sql
    assert "usage_ledger_account_member_read" in sql
