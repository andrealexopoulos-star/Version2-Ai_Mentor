-- Integration Status Table
-- Tracks per-user, per-integration connection state, record counts, last sync, and errors
-- Used by /api/user/integration-status endpoint

CREATE TABLE IF NOT EXISTS integration_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  integration_name TEXT NOT NULL,         -- 'HubSpot', 'Xero', 'Gmail', etc.
  category TEXT NOT NULL,                  -- 'crm', 'accounting', 'email', 'hris', 'ats', 'file_storage'
  connected BOOLEAN DEFAULT false,
  provider TEXT,                           -- canonical provider name
  last_sync_at TIMESTAMPTZ,
  records_count INTEGER DEFAULT 0,         -- deals, invoices, emails, etc.
  record_type TEXT,                        -- 'deals', 'invoices', 'emails', 'files'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, integration_name)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_integration_status_user_id ON integration_status(user_id);

-- RLS: Users can only see their own records
ALTER TABLE integration_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_status_user_policy" ON integration_status;
CREATE POLICY "integration_status_user_policy"
  ON integration_status
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass
DROP POLICY IF EXISTS "integration_status_service_policy" ON integration_status;
CREATE POLICY "integration_status_service_policy"
  ON integration_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
