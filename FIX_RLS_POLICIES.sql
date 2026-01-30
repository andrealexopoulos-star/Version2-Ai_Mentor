-- ==========================================
-- EMAIL_CONNECTIONS RLS FIX
-- Ensures authenticated users can read their own connections
-- Ensures service role can write connections
-- ==========================================

-- STEP 1: Drop existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view own email connection" ON email_connections;
DROP POLICY IF EXISTS "Users can update own email connection" ON email_connections;
DROP POLICY IF EXISTS "Users can insert own email connection" ON email_connections;
DROP POLICY IF EXISTS "Service role has full access" ON email_connections;

-- STEP 2: Ensure RLS is enabled
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;

-- STEP 3: Create SELECT policy for authenticated users
CREATE POLICY "authenticated_users_select_own"
  ON email_connections
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- STEP 4: Create INSERT policy (allow service role only, not users directly)
CREATE POLICY "service_role_insert"
  ON email_connections
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- STEP 5: Create UPDATE policy (allow service role + users for their own row)
CREATE POLICY "service_role_update"
  ON email_connections
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_users_update_own"
  ON email_connections
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- STEP 6: Create DELETE policy (allow service role + users for their own row)
CREATE POLICY "service_role_delete"
  ON email_connections
  FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "authenticated_users_delete_own"
  ON email_connections
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- STEP 7: Verify policies are active
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'email_connections'
ORDER BY policyname;

-- STEP 8: Test SELECT access (run as authenticated user)
-- This should return rows if RLS is working correctly
SELECT * FROM email_connections WHERE user_id = auth.uid();

-- STEP 9: Show all rows (using service role to verify data exists)
SELECT user_id, provider, connected, connected_email, connected_at 
FROM email_connections 
ORDER BY connected_at DESC;
