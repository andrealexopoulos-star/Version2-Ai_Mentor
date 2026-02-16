-- RLS POLICY ENFORCEMENT FOR EMAIL_CONNECTIONS

-- Ensure RLS is enabled
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start clean
DROP POLICY IF EXISTS "Users can read own email connections" ON email_connections;
DROP POLICY IF EXISTS "authenticated_users_select_own" ON email_connections;
DROP POLICY IF EXISTS "service_role_insert" ON email_connections;
DROP POLICY IF EXISTS "service_role_update" ON email_connections;
DROP POLICY IF EXISTS "authenticated_users_update_own" ON email_connections;

-- CANONICAL SELECT POLICY
CREATE POLICY "Users can read own email connections"
  ON email_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role full access (for Edge Functions)
CREATE POLICY "Service role full access"
  ON email_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify policies
SELECT 
  policyname,
  cmd,
  roles::text,
  qual::text as using_clause
FROM pg_policies 
WHERE tablename = 'email_connections';
