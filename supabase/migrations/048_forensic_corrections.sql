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
DECLARE
  v_set_clause TEXT := '';
BEGIN
  IF to_regclass('public.business_profiles') IS NOT NULL THEN
    SELECT string_agg(format('%I = NULL', c.column_name), ', ')
      INTO v_set_clause
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'business_profiles'
      AND c.column_name IN (
        'market_position',
        'main_products_services',
        'unique_value_proposition',
        'competitive_advantages',
        'target_market',
        'ideal_customer_profile',
        'geographic_focus',
        'abn',
        'competitor_scan_result',
        'cached_market_intel',
        'competitor_scan_last',
        'last_market_scraped_at'
      );

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'updated_at'
    ) THEN
      v_set_clause := COALESCE(v_set_clause || ', ', '') || 'updated_at = now()';
    END IF;

    IF COALESCE(v_set_clause, '') <> '' THEN
      EXECUTE format(
        'UPDATE public.business_profiles SET %s WHERE user_id IN (
           SELECT id FROM auth.users
           WHERE email IN (''trent-test1@biqc-test.com'',''trent-test2@biqc-test.com'',''trent-test3@biqc-test.com'')
         )',
        v_set_clause
      );
    END IF;
  END IF;
END $$;
