-- Migration 123: Sprint C #22 — tracked account deletion with a 30-day abort window.
-- users.deletion_requested_at lets backend + ops distinguish a user who asked to
-- be deleted (and can still undo) from a user who is merely disabled.
--
-- Applied via MCP 2026-04-22 (commit ccf58b2e shipped the routes); this file
-- is the durable repo copy for disaster recovery + fresh-env provisioning.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_deletion_requested_at
  ON public.users (deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

COMMENT ON COLUMN public.users.deletion_requested_at IS
  'Sprint C #22 (2026-04-22): timestamp the user requested account deletion. '
  'Null = active account. Non-null = user asked to delete; hard-purge worker '
  'processes rows older than 30 days. User can POST /user/account/undo-delete '
  'within the 30-day window to clear this column and restore service.';
