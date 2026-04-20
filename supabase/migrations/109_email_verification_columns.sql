-- 109_email_verification_columns.sql
-- BIQc-custom email verification state on public.users.
--
-- Why a separate flag from Supabase's email_confirmed_at: the Stripe
-- signup flow uses admin.create_user(email_confirm=True) so Supabase
-- considers the email confirmed immediately (necessary for the auto
-- sign_in_with_password step). That leaves us with NO record of
-- whether the user actually clicked a verification link. This column
-- is BIQc's independent confirmation layer — a user is only
-- "authorised" once they've clicked the link in the verification
-- email we send via Resend.
--
-- Gate: the frontend's ProtectedRoute checks email_verified_by_user;
-- false routes through /verify-email-sent. Login still succeeds so
-- the user can reach the verify-email-sent page and retry send.
--
-- Applied to prod via Supabase MCP 2026-04-20. Idempotent.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified_by_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash text,
  ADD COLUMN IF NOT EXISTS email_verification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz;

-- Backfill: every existing user is considered verified (they've been
-- using the platform). Only NEW signups post-this-migration will hit
-- the unverified gate.
UPDATE public.users
SET email_verified_by_user = true,
    email_verified_at = COALESCE(email_verified_at, NOW())
WHERE email_verified_by_user = false;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
  ON public.users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;

COMMENT ON COLUMN public.users.email_verified_by_user IS
  'BIQc-custom verification: true once the user clicks the link in our Resend verification email. Distinct from auth.users.email_confirmed_at which is set by admin.create_user(email_confirm=True) during signup.';
