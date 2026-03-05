-- ============================================================
-- FORENSIC CORRECTIONS 048 — CORRECTED (uses real columns)
-- Run in Supabase SQL Editor
-- ============================================================

-- PROTOCOL 1: Delete old SoundBoard prompt
DELETE FROM system_prompts WHERE prompt_key = 'mysoundboard_v1';

-- PROTOCOL 7: Grant super_admin to test accounts
UPDATE public.users
SET subscription_tier = 'super_admin', role = 'super_admin'
WHERE email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);

-- Set calibration complete for test accounts
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

-- PROTOCOL 2: Clear contaminated intelligence fields (verified real columns)
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

-- Verify everything
SELECT
  au.email,
  u.subscription_tier,
  u.role,
  op.persona_calibration_status,
  bp.business_name,
  bp.abn,
  bp.market_position
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
LEFT JOIN public.user_operator_profile op ON op.user_id = au.id
LEFT JOIN public.business_profiles bp ON bp.user_id = au.id
WHERE au.email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);
