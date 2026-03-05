-- ============================================================
-- Grant Super Admin to 3 Test Accounts
-- Run in Supabase SQL Editor
-- ============================================================

UPDATE public.users
SET subscription_tier = 'super_admin', role = 'super_admin'
WHERE email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);

-- Also set calibration complete for test1 (Campos Coffee — already calibrated)
UPDATE public.user_operator_profile
SET persona_calibration_status = 'complete'
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('trent-test1@biqc-test.com','trent-test2@biqc-test.com','trent-test3@biqc-test.com')
);

-- Verify
SELECT au.email, u.subscription_tier, u.role, op.persona_calibration_status
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
LEFT JOIN public.user_operator_profile op ON op.user_id = au.id
WHERE au.email IN ('trent-test1@biqc-test.com','trent-test2@biqc-test.com','trent-test3@biqc-test.com');
