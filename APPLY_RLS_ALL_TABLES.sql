-- CRITICAL SECURITY FIX - Apply to ALL Email Tables

-- ============================================================
-- 1. email_connections table (CANONICAL)
-- ============================================================

ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email connection" ON public.email_connections;
DROP POLICY IF EXISTS "Users can insert own email connection" ON public.email_connections;
DROP POLICY IF EXISTS "Users can update own email connection" ON public.email_connections;
DROP POLICY IF EXISTS "Users can delete own email connection" ON public.email_connections;

CREATE POLICY "Users can view own email connection"
ON public.email_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email connection"
ON public.email_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email connection"
ON public.email_connections FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own email connection"
ON public.email_connections FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================
-- 2. outlook_oauth_tokens table
-- ============================================================

ALTER TABLE public.outlook_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own outlook tokens" ON public.outlook_oauth_tokens;
DROP POLICY IF EXISTS "Users can insert own outlook tokens" ON public.outlook_oauth_tokens;
DROP POLICY IF EXISTS "Users can update own outlook tokens" ON public.outlook_oauth_tokens;
DROP POLICY IF EXISTS "Users can delete own outlook tokens" ON public.outlook_oauth_tokens;

CREATE POLICY "Users can view own outlook tokens"
ON public.outlook_oauth_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outlook tokens"
ON public.outlook_oauth_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outlook tokens"
ON public.outlook_oauth_tokens FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own outlook tokens"
ON public.outlook_oauth_tokens FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================
-- 3. gmail_connections table
-- ============================================================

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gmail tokens" ON public.gmail_connections;
DROP POLICY IF EXISTS "Users can insert own gmail tokens" ON public.gmail_connections;
DROP POLICY IF EXISTS "Users can update own gmail tokens" ON public.gmail_connections;
DROP POLICY IF EXISTS "Users can delete own gmail tokens" ON public.gmail_connections;

CREATE POLICY "Users can view own gmail tokens"
ON public.gmail_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail tokens"
ON public.gmail_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail tokens"
ON public.gmail_connections FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail tokens"
ON public.gmail_connections FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Verify RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('email_connections', 'outlook_oauth_tokens', 'gmail_connections')
ORDER BY tablename;

-- Verify all policies exist
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('email_connections', 'outlook_oauth_tokens', 'gmail_connections')
ORDER BY tablename, cmd;

-- Test that current user can only see their own data
SELECT 'email_connections' as table_name, COUNT(*) as visible_rows
FROM email_connections
UNION ALL
SELECT 'outlook_oauth_tokens', COUNT(*)
FROM outlook_oauth_tokens
UNION ALL
SELECT 'gmail_connections', COUNT(*)
FROM gmail_connections;
