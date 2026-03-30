-- ============================================================
-- Grant Super Admin to 3 Test Accounts
-- Run in Supabase SQL Editor
-- ============================================================

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

-- Also set calibration complete for test1 (Campos Coffee — already calibrated)
DO $$
BEGIN
  IF to_regclass('public.user_operator_profile') IS NOT NULL THEN
    UPDATE public.user_operator_profile
    SET persona_calibration_status = 'complete'
    WHERE user_id IN (
      SELECT id FROM auth.users
      WHERE email IN ('trent-test1@biqc-test.com','trent-test2@biqc-test.com','trent-test3@biqc-test.com')
    );
  END IF;
END $$;
