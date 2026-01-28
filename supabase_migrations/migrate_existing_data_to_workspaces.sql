-- Data Migration: Assign existing users to default workspace
-- Run this AFTER the schema migration (add_workspace_scoped_integrations.sql)

-- Step 1: Create a default workspace/account for existing users
INSERT INTO accounts (id, name, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Default Workspace',
  now()
)
ON CONFLICT DO NOTHING;

-- Step 2: Assign all existing users without account_id to default workspace
UPDATE users
SET account_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE account_id IS NULL;

-- Step 3: Migrate existing integration_accounts to use account_id from their user
UPDATE integration_accounts ia
SET account_id = u.account_id
FROM users u
WHERE ia.user_id = u.id
AND ia.account_id IS NULL;

-- Step 4: Verification queries
-- Verify all users have account_id
SELECT COUNT(*) as users_without_account FROM users WHERE account_id IS NULL;

-- Verify all integrations have account_id
SELECT COUNT(*) as integrations_without_account FROM integration_accounts WHERE account_id IS NULL;

-- Show integration distribution by account
SELECT 
  a.name as workspace_name,
  ia.category,
  ia.provider,
  COUNT(*) as connection_count
FROM integration_accounts ia
JOIN accounts a ON ia.account_id = a.id
GROUP BY a.name, ia.category, ia.provider
ORDER BY a.name, ia.category;
