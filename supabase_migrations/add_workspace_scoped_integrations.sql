-- P0 Fix: Make Merge.dev integration workspace-scoped
-- This migration adds the necessary fields to support multi-tenant integrations

-- Step 1: Add account_id to users table (links user to workspace/account)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

-- Step 2: Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);

-- Step 3: Add workspace/account reference to integration_accounts
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

-- Step 4: Add merge_account_id to track Merge's internal account identifier
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS merge_account_id TEXT;

-- Step 5: Add index for integration_accounts.account_id
CREATE INDEX IF NOT EXISTS idx_integration_accounts_account_id ON integration_accounts(account_id);

-- Step 6: Drop old unique constraint (user_id, category)
ALTER TABLE integration_accounts DROP CONSTRAINT IF EXISTS integration_accounts_user_id_category_key;

-- Step 7: Add new unique constraint (account_id, category) for workspace-level uniqueness
-- Note: Keep user_id for backwards compatibility and tracking who connected
ALTER TABLE integration_accounts ADD CONSTRAINT integration_accounts_account_category_unique 
  UNIQUE(account_id, category);

-- Step 8: Add comment for documentation
COMMENT ON COLUMN integration_accounts.account_id IS 'Workspace/organization that owns this integration (multi-tenant key)';
COMMENT ON COLUMN integration_accounts.merge_account_id IS 'Merge.dev internal account identifier for this integration';
COMMENT ON COLUMN integration_accounts.user_id IS 'User who connected this integration (for audit trail)';
