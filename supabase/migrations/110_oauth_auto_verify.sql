-- 110_oauth_auto_verify.sql
-- Auto-mark OAuth-originated users as email-verified on creation.
--
-- Why: Google and Microsoft already prove the user owns the inbox as part of
-- their OAuth consent flow. Sending them our E1 verification email is pure
-- friction for zero gain. By detecting the provider in raw_app_meta_data at
-- the moment auth.users is inserted, we can skip the verify-email-sent page
-- entirely and land the OAuth user straight on /complete-signup → /advisor
-- once their card is captured.
--
-- Manual email+password signups still get the E1 flow (email not yet
-- verified — they could have typed anyone's address).
--
-- Applied via Supabase MCP 2026-04-20.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_name text;
  is_oauth boolean := false;
BEGIN
  -- Supabase populates raw_app_meta_data.provider with the auth source:
  --   'email'   → email + password signup (needs E1 verification)
  --   'google'  → Google OAuth (email inherently verified)
  --   'azure'   → Microsoft OAuth (email inherently verified)
  --   other     → treat as non-OAuth to be safe
  provider_name := COALESCE(NEW.raw_app_meta_data ->> 'provider', '');
  IF provider_name IN ('google', 'azure', 'apple', 'github') THEN
    is_oauth := true;
  END IF;

  INSERT INTO public.users (
    id,
    email,
    created_at,
    trial_expires_at,
    trial_tier,
    subscription_tier,
    email_verified_by_user,
    email_verified_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW() + INTERVAL '14 days',
    'pro',
    'trial',
    is_oauth,                 -- flipped true for OAuth users
    CASE WHEN is_oauth THEN NOW() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    trial_expires_at = COALESCE(public.users.trial_expires_at, NOW() + INTERVAL '14 days'),
    trial_tier       = COALESCE(public.users.trial_tier, 'pro'),
    -- Only flip verified→true on conflict if it isn't already true
    -- (don't accidentally un-verify someone during re-insert).
    email_verified_by_user = GREATEST(public.users.email_verified_by_user, is_oauth),
    email_verified_at      = CASE
      WHEN is_oauth AND public.users.email_verified_at IS NULL THEN NOW()
      ELSE public.users.email_verified_at
    END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
  'Auto-creates a public.users row for every new auth.users entry. OAuth-originated users (google/azure/apple/github) are auto-marked email_verified_by_user=true since the provider already proved inbox ownership. Email+password signups retain the default false and go through the /verify-email-sent E1 flow.';
