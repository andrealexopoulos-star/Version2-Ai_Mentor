# AZURE CLIENT ID FIX - CRITICAL CORRECTION

## A. GOAL
Fix invalid Azure Client ID causing Outlook OAuth failures.

---

## B. ISSUE IDENTIFIED

**From environment file:**
```
AZURE_CLIENT_ID=biqc-fixer  ← INVALID (not a GUID)
```

**User confirmed correct value:**
```
AZURE_CLIENT_ID=5d6e3cbb-cd88-4694-aa19-9b7115666866 ✅
```

**Impact:** All Outlook OAuth flows were failing because Microsoft rejected invalid Client ID.

---

## C. CHANGE APPLIED

**File:** `/app/backend/.env`

**Before:**
```
AZURE_CLIENT_ID=biqc-fixer
```

**After:**
```
AZURE_CLIENT_ID=5d6e3cbb-cd88-4694-aa19-9b7115666866
```

**Backend restarted:** ✅

---

## D. POST-CHECKS COMPLETED

✅ **Environment updated:** Correct GUID now in place
✅ **Backend restarted:** Successfully
✅ **Health check:** Passing
✅ **No errors:** Clean startup

---

## E. USER TESTING REQUIRED

**Test Outlook OAuth flow:**

1. Navigate to /integrations
2. If Outlook connected, click "Disconnect"
3. Click "Connect" on Outlook card
4. Complete Microsoft OAuth
5. Verify returns to /integrations with "Connected" status
6. Click "Refresh" to test sync

**Expected:** OAuth completes successfully, sync works

---

## F. ROLLBACK

Revert to: `AZURE_CLIENT_ID=biqc-fixer` and restart backend

---

**READY FOR NEXT PROMPT**
