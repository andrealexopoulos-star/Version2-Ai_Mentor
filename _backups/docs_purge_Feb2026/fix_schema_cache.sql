-- ============================================================
-- FIX: Schema Cache & Missing Column Issue
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Check if account_name column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'outlook_oauth_tokens' 
  AND table_schema = 'public';

-- Step 2: Add account_name column if it doesn't exist
ALTER TABLE public.outlook_oauth_tokens 
ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Step 3: Reload the schema cache
NOTIFY pgrst, 'reload schema';

-- Step 4: Verify the column now exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'outlook_oauth_tokens' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
