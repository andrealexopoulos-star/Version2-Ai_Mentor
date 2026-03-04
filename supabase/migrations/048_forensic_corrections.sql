-- ============================================================
-- FORENSIC CORRECTION PROTOCOLS 1 + 7
-- Run in Supabase SQL Editor
-- ============================================================

-- PROTOCOL 1: Delete old SoundBoard prompt from system_prompts
-- This forces the backend to use the new Strategic Advisor _SOUNDBOARD_FALLBACK
DELETE FROM system_prompts WHERE prompt_key = 'mysoundboard_v1';

-- Verify deleted
SELECT COUNT(*) as remaining_old_prompts FROM system_prompts WHERE prompt_key = 'mysoundboard_v1';

-- PROTOCOL 7: Grant super_admin to all 3 test accounts
UPDATE public.users
SET subscription_tier = 'super_admin', role = 'super_admin'
WHERE email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);

-- Set calibration complete for test accounts so they can access internal pages
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

-- PROTOCOL 2: Clear contaminated intelligence cache for test accounts
-- Clears market_position and intelligence fields that may have bled from previous calibrations
UPDATE public.business_profiles
SET
  market_position = NULL,
  market_intelligence_data = NULL,
  digital_footprint_data = NULL,
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'trent-test1@biqc-test.com',
    'trent-test2@biqc-test.com',
    'trent-test3@biqc-test.com'
  )
);

-- Verify test accounts
SELECT
  au.email,
  u.subscription_tier,
  u.role,
  op.persona_calibration_status,
  bp.business_name,
  bp.abn,
  bp.website
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
LEFT JOIN public.user_operator_profile op ON op.user_id = au.id
LEFT JOIN public.business_profiles bp ON bp.user_id = au.id
WHERE au.email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);
