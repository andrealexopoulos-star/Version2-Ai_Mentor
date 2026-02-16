-- ============================================================
-- DIAGNOSTIC: Check Email Connection State
-- ============================================================

-- Check all email connections (as admin)
-- Run this to see ACTUAL database state
SELECT 
  user_id,
  provider,
  connected,
  connected_email,
  inbox_type,
  connected_at,
  updated_at
FROM email_connections
ORDER BY updated_at DESC;

-- Check how many connections each user has
SELECT 
  user_id,
  COUNT(*) as connection_count,
  STRING_AGG(provider, ', ') as providers
FROM email_connections
GROUP BY user_id;

-- Check if there are duplicate connections
SELECT 
  user_id,
  provider,
  COUNT(*) as duplicates
FROM email_connections
GROUP BY user_id, provider
HAVING COUNT(*) > 1;

-- ============================================================
-- FIX: Ensure only ONE connection per user
-- ============================================================

-- The email_connections table should have PRIMARY KEY on user_id
-- This ensures only ONE provider per user

-- Check current constraint
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'email_connections'
  AND table_schema = 'public';

-- If user_id is PRIMARY KEY, upsert should automatically replace
-- If not, we need to ensure it is

-- ============================================================
-- CLEAN UP: Remove all connections for fresh start (OPTIONAL)
-- ============================================================

-- Only run this if you want to start completely fresh
-- DELETE FROM email_connections;
-- DELETE FROM outlook_oauth_tokens;
-- DELETE FROM gmail_connections;

-- ============================================================
-- VERIFY: Check RLS is working
-- ============================================================

-- This query should only show YOUR connections (not other users)
SELECT * FROM email_connections;

-- If you see other users' connections, RLS is NOT working correctly
