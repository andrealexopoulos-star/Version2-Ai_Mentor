from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"


def _read(name: str) -> str:
    return (MIGRATIONS_DIR / name).read_text(encoding="utf-8")


def test_068_soundboard_flagship_contract_migration_present():
    sql = _read("068_soundboard_flagship_contract.sql")
    assert "CREATE TABLE IF NOT EXISTS public.soundboard_conversations" in sql
    assert "CREATE TABLE IF NOT EXISTS public.soundboard_messages" in sql
    assert "contract_version" in sql
    assert "mode_effective" in sql
    assert "boardroom_trace" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "sb_conversations_select_own" in sql
    assert "sb_messages_select_own" in sql
