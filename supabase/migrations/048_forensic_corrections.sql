-- ============================================================
-- FORENSIC CORRECTIONS 048 — CORRECTED (uses real columns)
-- Run in Supabase SQL Editor
-- ============================================================

-- PROTOCOL 1: Delete old SoundBoard prompt
DO $$
BEGIN
  IF to_regclass('public.system_prompts') IS NOT NULL THEN
    DELETE FROM public.system_prompts WHERE prompt_key = 'mysoundboard_v1';
  END IF;
END $$;

-- PROTOCOL 7: Grant super_admin to test accounts
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'subscription_tier'
    ) THEN
      ALTER TABLE public.users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
    ) THEN
      ALTER TABLE public.users ADD COLUMN role TEXT DEFAULT 'user';
    END IF;

    UPDATE public.users
    SET subscription_tier = 'super_admin', role = 'super_admin'
    WHERE email IN (
      'trent-test1@biqc-test.com',
      'trent-test2@biqc-test.com',
      'trent-test3@biqc-test.com'
    );
  END IF;
END $$;

-- Set calibration complete for test accounts
DO $$
BEGIN
  IF to_regclass('public.user_operator_profile') IS NOT NULL THEN
    UPDATE public.user_operator_profile
    SET persona_calibration_status = 'complete'
    WHERE user_id IN (
      SELECT id FROM auth.users
      WHERE email IN (
        'trent-test1@biqc-test.com',
        'trent-test2@biqc-test.com',
        'trent-test3@biqc-test.com'
      )
    );
  END IF;
END $$;

-- PROTOCOL 2: Clear contaminated intelligence fields (verified real columns)
DO $$
BEGIN
  IF to_regclass('public.business_profiles') IS NOT NULL THEN
    UPDATE public.business_profiles
    SET
      market_position           = NULL,
      main_products_services    = NULL,
      unique_value_proposition  = NULL,
      competitive_advantages    = NULL,
      target_market             = NULL,
      ideal_customer_profile    = NULL,
      geographic_focus          = NULL,
      abn                       = NULL,
      competitor_scan_result    = NULL,
      cached_market_intel       = NULL,
      competitor_scan_last      = NULL,
      last_market_scraped_at    = NULL,
      updated_at                = now()
    WHERE user_id IN (
      SELECT id FROM auth.users
      WHERE email IN (
        'trent-test1@biqc-test.com',
        'trent-test2@biqc-test.com',
        'trent-test3@biqc-test.com'
      )
    );
  END IF;
END $$;
