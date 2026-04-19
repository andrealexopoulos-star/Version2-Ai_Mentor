-- 107_signup_flow_p0_fix.sql
-- P0 signup flow fix (2026-04-19 late afternoon AEST).
--
-- Context: Andreas tested the prod signup flow (andre.alexopoulos@outlook.com)
-- and found it completely broken across 4 layers:
--   - auth user created, but email_confirmed_at=null → user can't log in
--   - no Stripe SetupIntent, no customer, no subscription, no receipt
--   - no stripe_subscription_id column existed on public.users so there
--     was nowhere to store the sub link even if it had been created
--   - the handle_new_user trigger still inserted subscription_tier='free',
--     stale post-migration 106 which renamed free → trial
--
-- Root cause of the Stripe miss: backend auth_supabase.signup_with_email
-- called auth.sign_up(), which respects the project-level "Confirm email"
-- setting. With that ON, signUp returned session=null, and the client-side
-- trial flow early-exited before reaching Stripe. Every trial signup since
-- confirm-email was enabled was silently failing.
--
-- This migration covers the DB half of the fix. The Python and React
-- halves ship in the same commit:
--   - backend/auth_supabase.py: switch to supabase_admin.auth.admin.create_user
--     with email_confirm=True, then sign the user in with the password they
--     just chose to produce a real session.
--   - frontend/src/pages/RegisterSupabase.js: if the session is somehow
--     still missing (belt-and-braces), retry signInWithPassword with the
--     form credentials before falling through to the login page.
--
-- Applied to prod via Supabase MCP on 2026-04-19 (name matches ledger entry).
-- Idempotent: safe to re-run.

-- 1. Add stripe_subscription_id so the webhook has somewhere to store it.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id
  ON public.users (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.users.stripe_subscription_id IS
  'Stripe subscription id (sub_...) for the active or most recent subscription. Written by Stripe webhook handlers on customer.subscription.created and related events. Paired with stripe_customer_id.';

-- 2. Update handle_new_user() trigger to match migration 106 intent.
-- Previously inserted 'free' for new rows; now inserts 'trial' so new
-- signups are consistent with the no-free-tier rename.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    created_at,
    trial_expires_at,
    trial_tier,
    subscription_tier
  )
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW() + INTERVAL '14 days',
    'pro',
    'trial'
  )
  ON CONFLICT (id) DO UPDATE SET
    trial_expires_at = COALESCE(public.users.trial_expires_at, NOW() + INTERVAL '14 days'),
    trial_tier       = COALESCE(public.users.trial_tier, 'pro');
  RETURN NEW;
END;
$function$;
