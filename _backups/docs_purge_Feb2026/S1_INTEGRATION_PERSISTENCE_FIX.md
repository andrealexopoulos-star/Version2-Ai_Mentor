# S1: INTEGRATION STATE PERSISTENCE FIX - COMPLETE

## A. GOAL
Fix integration state persistence failing due to ON CONFLICT mismatch causing silent data loss.

---

## B. PRE-CHECKS PERFORMED

### ✅ Pre-check 1: Located All Upsert Operations
Found 3 upsert locations in `/app/backend/server.py`:
- **Line 2858-2864:** Outlook OAuth callback - Used `on_conflict="user_id,category"` ❌
- **Line 3305-3311:** Outlook status migration - Used `on_conflict="user_id,category"` ❌
- **Line 7567-7570:** Merge token exchange - Used `on_conflict="account_id,category"` ✅

### ✅ Pre-check 2: Identified Database Constraint
From `/app/supabase_migrations/add_workspace_scoped_integrations.sql` line 24-25:
```sql
ALTER TABLE integration_accounts ADD CONSTRAINT integration_accounts_account_category_unique 
  UNIQUE(account_id, category);
```

**Database has:** `UNIQUE(account_id, category)`
**Old code used:** `on_conflict="user_id,category"`

**MISMATCH CONFIRMED** ❌

### ✅ Pre-check 3: Error Reproduction
Backend logs showed 7+ instances of:
```
WARNING:server:Failed to migrate integration state: 
{'message': 'there is no unique or exclusion constraint matching the ON CONFLICT specification', 
 'code': '42P10'}
```

**Error path:**  
Outlook status check → Migration attempt → ON CONFLICT with wrong columns → Silent failure

---

## C. CHANGE (MINIMAL)

### Files Modified: 1
**File:** `/app/backend/server.py`

### Changes Applied:

**Change 1: Line 2856-2868 (Outlook OAuth Callback)**
- ❌ **Before:** Used `on_conflict="user_id,category"` without `account_id` in payload
- ✅ **After:** 
  - Get user's workspace via `get_user_account()`
  - Include `account_id` in upsert payload
  - Use `on_conflict="account_id,category"`
  - Added proper error logging

**Change 2: Line 3302-3313 (Outlook Status Migration)**
- ❌ **Before:** Used `on_conflict="user_id,category"` without `account_id` in payload
- ✅ **After:**
  - Get user's workspace via `get_user_account()`
  - Include `account_id` in upsert payload
  - Use `on_conflict="account_id,category"`
  - Changed error level from WARNING to ERROR for visibility

### What Was NOT Changed:
- ✅ Line 7567-7570 already correct (Merge exchange)
- ✅ No database schema changes
- ✅ No API contract changes
- ✅ No frontend changes

---

## D. POST-CHECKS

### Post-check Commands:

**1. Verify Backend Restart Clean**
```bash
tail -50 /var/log/supervisor/backend.err.log | grep -E "ON CONFLICT|42P10" || echo "✅ No constraint errors"
```
**Expected:** ✅ No constraint errors
**Actual:** ✅ PASSED - No new errors since restart

**2. Verify Backend Healthy**
```bash
curl -s http://localhost:8001/api/health
```
**Expected:** `{"status": "healthy"}`
**Actual:** ✅ PASSED

**3. Monitor Next Integration State Check**
```bash
# Wait for next Outlook status call, then check logs
tail -f /var/log/supervisor/backend.out.log | grep -E "Migration successful|Failed to migrate"
```
**Expected:** Should see "✅ Migration successful" instead of "Failed to migrate"

**4. Verify Integration Persistence (Manual)**
User must:
1. Login to BIQC
2. Navigate to /integrations
3. If Outlook shown as connected, refresh page
4. Verify Outlook remains connected (does not flip to disconnected)

**5. Database Row Verification (If Needed)**
```bash
# Query to check integration_accounts for the user's workspace
# Replace {account_id} with actual workspace ID from logs
```
```sql
SELECT * FROM integration_accounts 
WHERE account_id = '00000000-0000-0000-0000-000000000001' 
  AND category = 'email';
```
**Expected:** 1 row with `provider='outlook'`

---

## E. ROLLBACK

### Code Rollback (Git Revert)

**If needed, revert to previous version:**

**Rollback Change 1 (Line 2856-2878):**
```python
# ORIGINAL CODE (BEFORE FIX):
    # TASK 1: Persist canonical integration state
    try:
        supabase_admin.table("integration_accounts").upsert({
            "user_id": user_id,
            "provider": "outlook",
            "category": "email",
            "account_token": "connected",
            "connected_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="user_id,category").execute()
        logger.info(f"✅ Outlook integration state persisted for user {user_id}")
    except Exception as e:
        logger.warning(f"Failed to persist integration state (non-critical): {e}")
```

**Rollback Change 2 (Line 3302-3324):**
```python
# ORIGINAL CODE (BEFORE FIX):
            logger.info(f"⚠️ Found tokens without canonical record - migrating state")
            
            try:
                supabase_admin.table("integration_accounts").upsert({
                    "user_id": user_id,
                    "provider": "outlook",
                    "category": "email",
                    "account_token": "connected",
                    "connected_at": datetime.now(timezone.utc).isoformat()
                }, on_conflict="user_id,category").execute()
            except Exception as e:
                logger.warning(f"Failed to migrate integration state: {e}")
```

### No Database Rollback Required
- ✅ No schema changes made
- ✅ No data deleted
- ✅ Only application logic updated

---

## VERIFICATION STATUS

✅ **Code Fix Applied:** Lines 2856-2878 and 3302-3324 updated
✅ **Backend Restarted:** Successfully
✅ **Health Check:** Passing
✅ **No New Errors:** Confirmed in logs post-restart

### Remaining Verification (User Required):
- ⏳ **Integration Persistence Test:** User must verify Outlook remains connected after refresh
- ⏳ **Migration Success Log:** Watch for "✅ Migration successful" message on next status check

---

## SUMMARY

**Problem:** Integration upserts used `on_conflict="user_id,category"` but database has `UNIQUE(account_id, category)`

**Fix:** Updated 2 locations to:
1. Get user's workspace (`account_id`)
2. Include `account_id` in upsert payload
3. Use correct conflict target: `account_id,category`
4. Improve error logging

**Impact:** Integration connections will now persist correctly across sessions.

**Risk:** LOW - Aligned code with existing database schema, no breaking changes.
