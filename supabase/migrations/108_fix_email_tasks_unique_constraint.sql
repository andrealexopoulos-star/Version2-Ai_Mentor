-- 108_fix_email_tasks_unique_constraint.sql
-- Fix #7 (partial) from ship-gate non-blockers (2026-04-19):
--   The email_priority edge function upserts email_tasks with
--   ON CONFLICT (user_id, provider, email_id). email_tasks has only a
--   PK on id — no matching unique constraint — so every such upsert
--   raised "no unique or exclusion constraint matching the ON CONFLICT
--   specification". This index adds the matching unique constraint.
--
-- Partial fix: the same edge function also upserts email_intelligence
-- with the same ON CONFLICT, BUT email_intelligence has a DIFFERENT
-- schema — it is a per-user aggregate table (top_clients, communication_
-- patterns, client_insights, total_emails_analyzed) and does not have
-- provider / email_id columns at all. Fixing that is a schema-vs-code
-- mismatch that requires understanding what reads the table before
-- migrating. Left for a follow-up session. email_intelligence currently
-- has 0 rows so the errors are cron-observability only, not data loss.
--
-- Applied to prod via Supabase MCP 2026-04-19. Idempotent — safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS email_tasks_user_provider_email_uniq
  ON public.email_tasks (user_id, provider, email_id);

COMMENT ON INDEX public.email_tasks_user_provider_email_uniq IS
  'Supports ON CONFLICT (user_id, provider, email_id) upserts from supabase/functions/email_priority. Added 2026-04-19 — see ship-gate residual #7.';
