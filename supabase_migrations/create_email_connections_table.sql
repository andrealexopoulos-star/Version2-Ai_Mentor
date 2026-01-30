-- ==========================================
-- EMAIL_CONNECTIONS TABLE
-- Single Source of Truth for Email Provider
-- ==========================================

-- Drop existing table if recreating (CAREFUL - data loss!)
-- DROP TABLE IF EXISTS email_connections;

CREATE TABLE IF NOT EXISTS email_connections (
  -- Primary identifier
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider information (ONLY ONE can be active)
  provider TEXT NOT NULL CHECK (provider IN ('outlook', 'gmail')),
  
  -- Connection status
  connected BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  connected_email TEXT,
  inbox_type TEXT CHECK (inbox_type IN ('focused', 'standard', 'priority')),
  
  -- Timestamps
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Additional context
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'active',
  
  -- Constraints
  CONSTRAINT valid_provider CHECK (provider IN ('outlook', 'gmail')),
  CONSTRAINT connected_requires_provider CHECK (connected = true OR provider IS NOT NULL)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_connections_user_id ON email_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_provider ON email_connections(provider);
CREATE INDEX IF NOT EXISTS idx_email_connections_connected ON email_connections(connected);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_email_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_connections_updated_at
  BEFORE UPDATE ON email_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_email_connections_updated_at();

-- Comments for documentation
COMMENT ON TABLE email_connections IS 'Single source of truth for email provider connections. ONE provider per user enforced by PRIMARY KEY.';
COMMENT ON COLUMN email_connections.user_id IS 'User UUID - PRIMARY KEY enforces one provider per user';
COMMENT ON COLUMN email_connections.provider IS 'Active email provider: outlook or gmail (mutually exclusive)';
COMMENT ON COLUMN email_connections.connected IS 'Connection status - true if provider is connected';
COMMENT ON COLUMN email_connections.inbox_type IS 'Inbox type: focused (Outlook), priority (Gmail), or standard';

-- Grant permissions (adjust based on your RLS policies)
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own connection
CREATE POLICY "Users can view own email connection"
  ON email_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own connection
CREATE POLICY "Users can update own email connection"
  ON email_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own connection
CREATE POLICY "Users can insert own email connection"
  ON email_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can do anything (for Edge Functions)
CREATE POLICY "Service role has full access"
  ON email_connections
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ==========================================
-- MIGRATION: Move existing connections
-- ==========================================

-- Migrate existing Outlook connections
INSERT INTO email_connections (user_id, provider, connected, connected_email, connected_at)
SELECT 
  user_id,
  'outlook' as provider,
  true as connected,
  account_email as connected_email,
  created_at as connected_at
FROM outlook_oauth_tokens
WHERE access_token IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  provider = 'outlook',
  connected = true,
  connected_email = EXCLUDED.connected_email,
  updated_at = NOW();

-- Migrate existing Gmail connections
INSERT INTO email_connections (user_id, provider, connected, connected_email, connected_at)
SELECT 
  user_id,
  'gmail' as provider,
  true as connected,
  email as connected_email,
  created_at as connected_at
FROM gmail_connections
WHERE access_token IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  provider = 'gmail',
  connected = true,
  connected_email = EXCLUDED.connected_email,
  updated_at = NOW();

-- Note: If user has BOTH, Gmail will overwrite Outlook (last INSERT wins)
-- This is intentional - enforces single provider

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Check all connections
SELECT user_id, provider, connected, connected_email, connected_at 
FROM email_connections 
ORDER BY connected_at DESC;

-- Count connections by provider
SELECT provider, COUNT(*) as count 
FROM email_connections 
WHERE connected = true 
GROUP BY provider;

-- Verify no user has multiple rows (should return 0)
SELECT user_id, COUNT(*) 
FROM email_connections 
GROUP BY user_id 
HAVING COUNT(*) > 1;
