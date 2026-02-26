# P0 Fix Deployment Guide: Workspace-Scoped Merge.dev Integration

## 🎯 Objective
Transform BIQC's Merge.dev integration from user-scoped to workspace-scoped, making it multi-tenant safe and deterministic.

## ✅ What Was Fixed (P0)

### Before (BROKEN):
- ❌ All users sent as `"BIQC User Org"` to Merge (hardcoded)
- ❌ `end_user_origin_id` was user_id (not workspace_id)
- ❌ Integrations stored per-user (not per-workspace)
- ❌ No `merge_account_id` persistence
- ❌ No multi-tenancy support

### After (CORRECT):
- ✅ Each workspace has unique name sent to Merge
- ✅ `end_user_origin_id` is workspace_id
- ✅ Integrations stored per-workspace with `UNIQUE(account_id, category)`
- ✅ `merge_account_id` persisted for future data fetching
- ✅ Multi-tenant architecture in place

---

## 📋 Deployment Steps (MANDATORY ORDER)

### Step 1: Execute Schema Migration

**File**: `/app/supabase_migrations/add_workspace_scoped_integrations.sql`

**Execute in**: Supabase Dashboard → SQL Editor

```sql
-- This adds:
-- 1. users.account_id (links user to workspace)
-- 2. integration_accounts.account_id (workspace owner of integration)
-- 3. integration_accounts.merge_account_id (Merge's internal ID)
-- 4. Updates unique constraint from (user_id, category) to (account_id, category)
```

**Verification**:
```bash
python3 /app/check_and_migrate_schema.py
```

Expected output: "✅ All required columns exist"

---

### Step 2: Execute Data Migration

**File**: `/app/supabase_migrations/migrate_existing_data_to_workspaces.sql`

**What it does**:
1. Creates a default workspace for existing users
2. Links all users to default workspace
3. Migrates existing integrations to workspace-scoped

**Execute in**: Supabase Dashboard → SQL Editor

**Verification**:
```sql
-- Check all users have workspace
SELECT COUNT(*) as users_without_workspace 
FROM users 
WHERE account_id IS NULL;
-- Expected: 0

-- Check all integrations have workspace
SELECT COUNT(*) as integrations_without_workspace 
FROM integration_accounts 
WHERE account_id IS NULL;
-- Expected: 0
```

---

### Step 3: Restart Backend

```bash
sudo supervisorctl restart backend
```

**Verification**:
```bash
# Check backend logs for workspace helper import
tail -n 50 /var/log/supervisor/backend.*.log | grep -i "workspace"

# Check endpoint is accessible
curl -X POST https://biqc-ai-insights.preview.emergentagent.com/api/integrations/merge/link-token \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 🔍 Verification Checklist

### 1. Schema Verification
```bash
cd /app && python3 check_and_migrate_schema.py
```
Expected: "✅ All required columns exist"

### 2. Code Verification
```bash
# Check workspace helpers are imported
grep -n "from workspace_helpers import" /app/backend/server.py
# Expected: Line numbers showing imports in both endpoints

# Check Merge endpoints use account_id
grep -n "end_user_origin_id.*account_id" /app/backend/server.py
# Expected: Line showing account_id is used (not user_id)
```

### 3. Runtime Verification
After deployment, test with a user:

```bash
# 1. Login as user andre@thestrategysquad.com.au
# 2. Navigate to /integrations
# 3. Click "Connect via Merge"
# 4. Check backend logs:

tail -f /var/log/supervisor/backend.*.log | grep "workspace"
```

Expected logs:
```
🔗 Creating Merge link token for workspace: [Workspace Name] ([workspace-id])
   Requested by user: andre@... ([user-id])
✅ Link token created for workspace [Workspace Name]
```

### 4. Database Verification
```python
from supabase import create_client
import os

supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Check integration record structure
result = supabase.table('integration_accounts').select('*').limit(1).execute()
integration = result.data[0] if result.data else None

# Verify required fields exist:
assert 'account_id' in integration  # Workspace ID
assert 'user_id' in integration     # User who connected (audit trail)
assert 'merge_account_id' in integration  # Merge's account ID
assert 'provider' in integration    # e.g., "HubSpot"
assert 'category' in integration    # e.g., "crm"
assert 'account_token' in integration  # Merge account token

print("✅ Integration record structure is correct")
```

---

## 🎯 Success Criteria

After deployment, BIQC must prove:

### 1. Workspace Mapping
```sql
-- Every user belongs to a workspace
SELECT u.email, a.name as workspace_name, a.id as workspace_id
FROM users u
JOIN accounts a ON u.account_id = a.id
LIMIT 5;
```

### 2. Workspace-Scoped Integrations
```sql
-- Integrations are anchored to workspaces (not users)
SELECT 
  a.name as workspace_name,
  ia.provider,
  ia.category,
  ia.merge_account_id,
  u.email as connected_by
FROM integration_accounts ia
JOIN accounts a ON ia.account_id = a.id
JOIN users u ON ia.user_id = u.id;
```

### 3. Merge Receives Workspace Data
Check backend logs when creating link token:
```
📡 Calling Merge API with:
  end_user_origin_id: [workspace-uuid]
  end_user_organization_name: [Workspace Name]
```

### 4. Uniqueness is Enforced
```sql
-- Only one integration per workspace per category
SELECT category, COUNT(*) as count_per_category
FROM integration_accounts
WHERE account_id = '[workspace-id]'
GROUP BY category;
-- Each category should have count = 1
```

---

## 🚨 Rollback Plan

If deployment fails:

### 1. Schema Rollback
```sql
-- Remove new columns
ALTER TABLE users DROP COLUMN IF EXISTS account_id;
ALTER TABLE integration_accounts DROP COLUMN IF EXISTS account_id;
ALTER TABLE integration_accounts DROP COLUMN IF EXISTS merge_account_id;

-- Restore old unique constraint
ALTER TABLE integration_accounts DROP CONSTRAINT IF EXISTS integration_accounts_account_category_unique;
ALTER TABLE integration_accounts ADD CONSTRAINT integration_accounts_user_id_category_key UNIQUE(user_id, category);
```

### 2. Code Rollback
```bash
git revert [commit-hash]
sudo supervisorctl restart backend
```

---

## 📊 Monitoring

### Key Metrics to Watch:

1. **Workspace Creation Rate**
```sql
SELECT DATE(created_at), COUNT(*) as new_workspaces
FROM accounts
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

2. **Integration Connection Rate**
```sql
SELECT 
  DATE(connected_at) as date,
  category,
  COUNT(*) as connections
FROM integration_accounts
GROUP BY DATE(connected_at), category
ORDER BY date DESC;
```

3. **Multi-User Workspaces**
```sql
SELECT 
  a.name as workspace_name,
  COUNT(u.id) as user_count
FROM accounts a
JOIN users u ON u.account_id = a.id
GROUP BY a.name
HAVING COUNT(u.id) > 1;
```

---

## 🔧 Troubleshooting

### Issue: "User workspace not initialized"
**Cause**: User has no account_id
**Fix**:
```sql
-- Assign user to default workspace
UPDATE users 
SET account_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE email = '[user-email]';
```

### Issue: "Failed to store account_token"
**Cause**: Unique constraint violation
**Fix**: Check if integration already exists for workspace
```sql
-- Check existing integration
SELECT * FROM integration_accounts 
WHERE account_id = '[workspace-id]' AND category = '[category]';

-- Delete if needed
DELETE FROM integration_accounts 
WHERE account_id = '[workspace-id]' AND category = '[category]';
```

### Issue: Merge API returns wrong data
**Cause**: `end_user_origin_id` mismatch
**Fix**: Verify logs show workspace_id (not user_id)
```bash
tail -f /var/log/supervisor/backend.*.log | grep "end_user_origin_id"
```

---

## 📝 Files Modified

### Backend Files:
1. `/app/backend/server.py`
   - `create_merge_link_token()` - Uses workspace_id
   - `exchange_merge_account_token()` - Stores workspace-scoped
   - `get_connected_merge_integrations()` - Returns workspace integrations

2. `/app/backend/workspace_helpers.py` (NEW)
   - `get_or_create_user_account()` - Ensures user has workspace
   - `get_user_account()` - Fetches user's workspace
   - `get_account_integrations()` - Fetches workspace integrations
   - `get_account_integration_by_category()` - Gets specific integration

### Migration Files:
1. `/app/supabase_migrations/add_workspace_scoped_integrations.sql`
   - Schema changes (columns, constraints, indexes)

2. `/app/supabase_migrations/migrate_existing_data_to_workspaces.sql`
   - Data migration for existing users/integrations

3. `/app/check_and_migrate_schema.py`
   - Verification script

---

## ✅ Post-Deployment Validation

Run this after deployment:

```bash
# 1. Schema check
python3 /app/check_and_migrate_schema.py

# 2. Backend check
curl -I https://biqc-ai-insights.preview.emergentagent.com/api/health

# 3. Integration test (requires auth token)
# Login as user, then:
curl -X POST https://biqc-ai-insights.preview.emergentagent.com/api/integrations/merge/link-token \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# 4. Database check
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE account_id IS NULL;"
# Expected: 0
```

---

## 🎉 Deployment Complete

Once all steps are verified:
1. ✅ Schema migrated
2. ✅ Data migrated
3. ✅ Backend restarted
4. ✅ Integrations are workspace-scoped
5. ✅ Merge receives workspace data
6. ✅ Multi-tenancy is enforced

**The integration is now correct and ready for P1 (data fetching).**
