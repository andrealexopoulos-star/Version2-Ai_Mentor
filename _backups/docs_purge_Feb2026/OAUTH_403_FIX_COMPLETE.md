# OUTLOOK/GMAIL OAUTH 403 FIX - COMPLETE

## A. GOAL
Fix "not authorised" 403 error preventing Outlook and Gmail OAuth connections.

---

## B. ROOT CAUSE (Via Triage Agent)

**Problem:** OAuth endpoints blocked with 403 Forbidden

**Cause:** 
- Endpoints use `Depends(get_current_user)` requiring Authorization header
- Frontend uses `window.location.assign()` for OAuth redirect
- **Browser redirects cannot send custom HTTP headers**
- Result: 403 at FastAPI level, OAuth never reaches Microsoft/Google

**Evidence:**
- Backend logs: `403 Forbidden` on `/api/auth/outlook/login`
- Both Outlook and Gmail affected

---

## C. CHANGES APPLIED

### Backend Changes (2 endpoints)

**File:** `/app/backend/server.py`

**Fix 1: Outlook Login (Line 2447-2469)**
- Removed: `Depends(get_current_user)`
- Added: `token: Optional[str] = None` query parameter
- Added: Manual token validation (Supabase JWT decode)
- Returns 401 if token invalid/missing

**Fix 2: Gmail Login (Line 2495-2517)**
- Removed: `Depends(get_current_user_supabase)`
- Added: `token: Optional[str] = None` query parameter
- Added: Manual token validation (same pattern)
- Returns 401 if token invalid/missing

### Frontend Changes (2 handlers)

**File:** `/app/frontend/src/pages/Integrations.js`

**Fix 3: handleOutlookConnect (Line 465-479)**
- Changed to async function
- Gets session token from Supabase
- Appends `?token=${token}` to URL
- Shows error if no token

**Fix 4: handleGmailConnect (Line 481-495)**
- Changed to async function  
- Gets session token from Supabase
- Appends `?token=${token}` to URL
- Shows error if no token

---

## D. POST-CHECKS

✅ **Backend restarted:** Successfully
✅ **Health check:** Passing
✅ **No startup errors:** Clean

### User Testing Required:

**Test Outlook OAuth:**
1. Login to BIQC
2. Navigate to /integrations
3. Click "Email & Communication" category
4. Click on Outlook card
5. Click "Connect" button
6. **Expected:** Redirects to Microsoft OAuth (no 403 error)
7. Complete OAuth
8. **Expected:** Returns to /integrations with "Connected" status

**Test Gmail OAuth:**
1. Click on Gmail card
2. Click "Connect" button
3. **Expected:** Redirects to Google OAuth (no 403 error)
4. Complete OAuth
5. **Expected:** Returns to /integrations with "Connected" status

**Check Logs During Test:**
```bash
tail -f /var/log/supervisor/backend.out.log | grep -E "Outlook OAuth initiated|Gmail OAuth initiated|403"
```

**Expected Log:**
```
INFO:server:Outlook OAuth initiated for user: [email] (ID: [user_id])
```

**NOT:**
```
INFO: "GET /api/auth/outlook/login HTTP/1.1" 403 Forbidden
```

---

## E. ROLLBACK

### Backend Rollback

**File:** `/app/backend/server.py`

**Revert Line 2447-2448:**
```python
@api_router.get("/auth/outlook/login")
async def outlook_login(returnTo: str = "/integrations", current_user: dict = Depends(get_current_user)):
```

**Revert Line 2495:**
```python
@api_router.get("/auth/gmail/login")
async def gmail_login(returnTo: str = "/integrations", current_user: dict = Depends(get_current_user_supabase)):
```

### Frontend Rollback

**File:** `/app/frontend/src/pages/Integrations.js`

**Revert handleOutlookConnect:**
```javascript
const handleOutlookConnect = () => {
  setConnecting('outlook');
  window.location.assign(`${process.env.REACT_APP_BACKEND_URL}/api/auth/outlook/login?returnTo=/integrations`);
};
```

**Revert handleGmailConnect:**
```javascript
const handleGmailConnect = () => {
  setConnecting('gmail');
  window.location.assign(`${process.env.REACT_APP_BACKEND_URL}/api/auth/gmail/login?returnTo=/integrations`);
};
```

---

## SUMMARY

**Problem:** 403 Forbidden blocking OAuth before reaching provider
**Root Cause:** Browser redirects can't send Authorization headers
**Fix:** Pass token as query parameter, validate manually
**Impact:** OAuth flows should now work for both Outlook and Gmail
**Risk:** LOW - Standard OAuth pattern, minimal change

**Files Modified:**
- `/app/backend/server.py` (2 endpoints)
- `/app/frontend/src/pages/Integrations.js` (2 handlers)

---

**READY FOR NEXT PROMPT** (Phase 2: Sidebar Communications Section)
