-- CRITICAL SECURITY FIX - Row Level Security Policies

-- Check current RLS status on email_connections
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'email_connections';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'email_connections';

-- ENABLE RLS if not enabled
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;

-- DROP existing policies (if any are incorrect)
DROP POLICY IF EXISTS "Users can view own email connection" ON public.email_connections;
DROP POLICY IF EXISTS "Users can update own email connection" ON public.email_connections;
DROP POLICY IF EXISTS "Users can insert own email connection" ON public.email_connections;
DROP POLICY IF EXISTS "Users can delete own email connection" ON public.email_connections;

-- CREATE CORRECT RLS POLICIES
-- Policy 1: SELECT (read own connection only)
CREATE POLICY "Users can view own email connection"
ON public.email_connections
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: INSERT (create own connection only)
CREATE POLICY "Users can insert own email connection"
ON public.email_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 3: UPDATE (update own connection only)
CREATE POLICY "Users can update own email connection"
ON public.email_connections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: DELETE (delete own connection only)
CREATE POLICY "Users can delete own email connection"
ON public.email_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Verify RLS is now enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'email_connections';

-- Verify policies are correct
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'email_connections';

-- Test query (should only return current user's connection)
SELECT * FROM email_connections WHERE user_id = auth.uid();
