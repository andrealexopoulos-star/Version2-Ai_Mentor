-- SUPABASE SCHEMA FIXES: Complete Migration Fix
-- Run this entire script in Supabase SQL Editor

-- =============================================
-- PART 1: Add Missing Columns to Existing Tables
-- =============================================

ALTER TABLE chat_history 
ADD COLUMN IF NOT EXISTS context_type TEXT;

ALTER TABLE business_profiles 
ADD COLUMN IF NOT EXISTS target_country TEXT DEFAULT 'Australia';

ALTER TABLE analyses 
ADD COLUMN IF NOT EXISTS analysis_type TEXT;

-- =============================================
-- PART 2: Sync Auth Users to Public Users Table
-- Fixes foreign key constraint violations
-- =============================================

INSERT INTO public.users (id, email, full_name, role, subscription_tier, is_master_account, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
    'user' as role,
    'free' as subscription_tier,
    (au.email = 'andre@thestrategysquad.com.au') as is_master_account,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
);

-- =============================================
-- VERIFICATION QUERIES (Optional - Run After)
-- =============================================

-- Check how many users were synced
-- SELECT COUNT(*) as users_synced FROM public.users;

-- Verify all auth users now exist in public.users
-- SELECT COUNT(*) as missing_users 
-- FROM auth.users au 
-- WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id);
-- Should return 0

-- =============================================
-- EXPECTED RESULT
-- =============================================
-- Success message showing:
-- - Columns added (or already exist)
-- - X rows inserted into public.users
-- =============================================
