-- SUPABASE SCHEMA FIXES: Safe Version (No Errors)
-- Run this entire script in Supabase SQL Editor

-- =============================================
-- PART 1: Add Missing Columns (Safe - IF NOT EXISTS)
-- =============================================

-- Add missing columns only if they don't exist
DO $$ 
BEGIN
    -- Add context_type to chat_history
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='chat_history' AND column_name='context_type'
    ) THEN
        ALTER TABLE chat_history ADD COLUMN context_type TEXT;
    END IF;
    
    -- Add target_country to business_profiles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='business_profiles' AND column_name='target_country'
    ) THEN
        ALTER TABLE business_profiles ADD COLUMN target_country TEXT DEFAULT 'Australia';
    END IF;
    
    -- Add analysis_type to analyses
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='analyses' AND column_name='analysis_type'
    ) THEN
        ALTER TABLE analyses ADD COLUMN analysis_type TEXT;
    END IF;
END $$;

-- =============================================
-- PART 2: Sync Missing Auth Users to Public Users
-- Only inserts users that don't already exist
-- =============================================

INSERT INTO public.users (id, email, full_name, role, subscription_tier, is_master_account, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', SPLIT_PART(au.email, '@', 1)) as full_name,
    'user' as role,
    'free' as subscription_tier,
    (au.email = 'andre@thestrategysquad.com.au') as is_master_account,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
SELECT 
    'Schema fixes applied successfully' as message,
    (SELECT COUNT(*) FROM public.users) as total_users,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='chat_history' AND column_name='context_type') as context_type_added,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='business_profiles' AND column_name='target_country') as target_country_added;
