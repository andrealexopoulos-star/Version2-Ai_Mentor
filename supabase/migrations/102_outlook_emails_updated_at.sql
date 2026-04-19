-- 102_outlook_emails_updated_at.sql
-- P0-a fix (2026-04-19): outlook_emails UPSERT 400s because trigger touches a
-- non-existent column. `trg_outlook_emails_updated_at` BEFORE UPDATE runs
-- NEW.updated_at = now() but the column was never defined.
--
-- Applied to prod via Supabase MCP on 2026-04-19 (ledger version
-- 20260419065211, name `077_outlook_emails_updated_at`). This file
-- documents the change for repo/infra parity and is idempotent, so a
-- later `supabase db push` re-running it is safe.

ALTER TABLE public.outlook_emails
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_outlook_emails_updated_at
  ON public.outlook_emails(updated_at DESC);

COMMENT ON COLUMN public.outlook_emails.updated_at IS
  'Auto-maintained by trigger touch_outlook_emails_updated_at. Added 2026-04-19 to fix trigger that referenced missing column.';
