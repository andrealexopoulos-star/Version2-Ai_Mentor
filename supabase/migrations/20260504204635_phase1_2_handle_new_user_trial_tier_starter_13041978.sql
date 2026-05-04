-- Phase 1.2 — RC-7: Stop hardcoding trial_tier='pro' on every signup
-- Code: 13041978
-- Per project_track_b_decisions_2026_04_20.md: starter = Growth (canonical entry-level paid tier)
-- Trial users should default into the Growth conversion path, not Pro.
-- The signup flow can override trial_tier if user explicitly picks Pro/Business at checkout.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  provider_name text;
  is_oauth boolean := false;
  resolved_trial_tier text;
BEGIN
  provider_name := COALESCE(NEW.raw_app_meta_data ->> 'provider', '');
  IF provider_name IN ('google', 'azure', 'apple', 'github') THEN
    is_oauth := true;
  END IF;

  -- Resolve trial_tier from raw_user_meta_data if signup flow specified one explicitly
  -- (frontend can pass desired_trial_tier via signUp options.data).
  -- Default: 'starter' (= Growth, canonical entry-level paid tier per Track-B decisions).
  resolved_trial_tier := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'desired_trial_tier', ''),
    'starter'
  );

  -- Validate against known tier set; reject unknown values silently and fall back to starter.
  IF resolved_trial_tier NOT IN ('starter', 'pro', 'business', 'enterprise', 'specialist') THEN
    resolved_trial_tier := 'starter';
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
    resolved_trial_tier,
    'trial',
    is_oauth,
    CASE WHEN is_oauth THEN NOW() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    trial_expires_at = COALESCE(public.users.trial_expires_at, NOW() + INTERVAL '14 days'),
    trial_tier       = COALESCE(public.users.trial_tier, resolved_trial_tier),
    email_verified_by_user = GREATEST(public.users.email_verified_by_user, is_oauth),
    email_verified_at      = CASE
      WHEN is_oauth AND public.users.email_verified_at IS NULL THEN NOW()
      ELSE public.users.email_verified_at
    END;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger on auth.users INSERT. trial_tier defaults to starter (Growth). Override via raw_user_meta_data.desired_trial_tier. Hardened 2026-05-05 phase 1.2 RC-7 code 13041978.';
