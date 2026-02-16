-- SUPABASE SCHEMA FIX: Working Version
-- Run in Supabase SQL Editor (must be logged in as project owner/admin)
-- This version fixes: schema qualification, DO block issues, and RLS interference

-- =============================================
-- PART 1: Add Missing Columns (Simplified)
-- =============================================

-- Add context_type to chat_history
ALTER TABLE public.chat_history 
ADD COLUMN IF NOT EXISTS context_type TEXT;

-- Add target_country to business_profiles  
ALTER TABLE public.business_profiles 
ADD COLUMN IF NOT EXISTS target_country TEXT DEFAULT 'Australia';

-- Add analysis_type to analyses
ALTER TABLE public.analyses 
ADD COLUMN IF NOT EXISTS analysis_type TEXT;

-- =============================================
-- PART 2: Sync Auth Users (With Conflict Handling)
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
WHERE au.id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- VERIFICATION
-- =============================================
SELECT 
    'Schema fixes completed' as status,
    (SELECT COUNT(*) FROM public.users) as total_users,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'chat_history' AND column_name = 'context_type') as has_context_type,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'target_country') as has_target_country,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'analyses' AND column_name = 'analysis_type') as has_analysis_type;
