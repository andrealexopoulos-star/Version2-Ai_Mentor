-- Add merge_linked_account_token column and clarify data model
-- This makes the integration_accounts table properly store Merge.dev linked account tokens

-- Note: account_token currently stores the Merge linked account token
-- We'll add merge_linked_account_token as the canonical field name

-- Add the new column
ALTER TABLE integration_accounts 
ADD COLUMN IF NOT EXISTS merge_linked_account_token TEXT;

-- Migrate existing Merge integrations: copy account_token to merge_linked_account_token
UPDATE integration_accounts
SET merge_linked_account_token = account_token
WHERE provider IN ('HubSpot', 'Salesforce', 'Xero', 'QuickBooks', 'Pipedrive')
  AND merge_linked_account_token IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN integration_accounts.merge_linked_account_token IS 'Merge.dev Linked Account Token (X-Account-Token header for Unified API calls)';
COMMENT ON COLUMN integration_accounts.account_token IS 'Legacy field or direct integration token (for Gmail/Outlook)';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_integration_accounts_workspace_category 
ON integration_accounts(account_id, category);
