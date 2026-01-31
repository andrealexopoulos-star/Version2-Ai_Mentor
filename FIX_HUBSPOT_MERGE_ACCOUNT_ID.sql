-- Fix existing HubSpot connection with missing merge_account_id
-- Run this in Supabase SQL Editor

-- First, check current state
SELECT 
  provider,
  category,
  merge_account_id,
  connected_at
FROM integration_accounts
WHERE provider ILIKE '%hubspot%';

-- Update the HubSpot record with the correct merge_account_id
-- (from Merge.dev API response in logs: 584a5411-addc-461b-87a7-6d439adb982b)
UPDATE integration_accounts
SET merge_account_id = '584a5411-addc-461b-87a7-6d439adb982b'
WHERE provider ILIKE '%hubspot%'
  AND merge_account_id IS NULL;

-- Verify the update
SELECT 
  provider,
  category,
  merge_account_id,
  connected_at,
  account_id
FROM integration_accounts
WHERE provider ILIKE '%hubspot%';
