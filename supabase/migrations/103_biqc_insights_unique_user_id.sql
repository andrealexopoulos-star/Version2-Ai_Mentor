-- 103_biqc_insights_unique_user_id.sql
-- P0-b fix (2026-04-19): biqc_insights UPSERT with on_conflict=user_id fails
-- because the existing idx_biqc_insights_user_id is NOT a unique index.
-- Pre-checked: zero duplicate user_id rows at apply time.
--
-- Applied to prod via Supabase MCP on 2026-04-19 (ledger version
-- 20260419065225, name `078_biqc_insights_unique_user_id`). This file
-- documents the change for repo/infra parity and is idempotent.

DROP INDEX IF EXISTS public.idx_biqc_insights_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_biqc_insights_user_id_uniq
  ON public.biqc_insights(user_id);

COMMENT ON INDEX public.idx_biqc_insights_user_id_uniq IS
  'Unique index on user_id enables ON CONFLICT (user_id) upserts. Replaces non-unique idx_biqc_insights_user_id on 2026-04-19.';
