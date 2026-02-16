# OUTLOOK ENDPOINT INVENTORY - COMPLETE

## 1. AUTH INITIATION ENDPOINTS

### ✅ CANONICAL (ACTIVE)
**Endpoint:** `GET /api/auth/outlook/login`
- **File:** `/app/backend/server.py` Line 2447-2491
- **Middleware:** `Depends(get_current_user)` - Requires authenticated user
- **UI Entry Point:** YES - `Integrations.js` line 467
- **Function:** Initiates Microsoft OAuth, redirects to Microsoft login
- **Redirect URI:** `/api/auth/outlook/callback`
- **State:** HMAC-signed with user_id and returnTo

### ❌ ALTERNATIVE
**None found** - Only ONE login endpoint exists

---

## 2. OAUTH CALLBACK ENDPOINTS

### ✅ CANONICAL (ACTIVE)
**Endpoint:** `GET /api/auth/outlook/callback`
- **File:** `/app/backend/server.py` Line 2734-2880
- **Middleware:** None (public callback from Microsoft)
- **Auth Method:** Validates HMAC-signed state parameter
- **Function:**
  1. Validates state signature
  2. Exchanges code for tokens
  3. Calls Microsoft Graph `/me` for user info
  4. Stores tokens via `store_outlook_tokens()` → `outlook_oauth_tokens` table
  5. Persists integration state → `integration_accounts` table
  6. Redirects to frontend with success parameter
- **Token Storage:** `outlook_oauth_tokens` (PRIMARY)
- **Integration State:** `integration_accounts`
- **Status:** ACTIVE, workspace-scoped

### ❌ ALTERNATIVE CALLBACKS
**None found** - Only ONE Outlook callback exists

**Note:** Generic `/auth/callback` does NOT handle Outlook (checked - not found)

---

## 3. TOKEN STORAGE & RETRIEVAL

### ✅ PRIMARY
**Function:** `get_outlook_tokens(user_id)` - Line 2366-2410
- **Tables Checked:** 
  1. `outlook_oauth_tokens` (PRIMARY)
  2. `m365_tokens` (FALLBACK for backwards compat)
- **Returns:** access_token, refresh_token, expires_at, microsoft_email
- **Used By:** ALL sync and status endpoints

### ✅ PRIMARY
**Function:** `store_outlook_tokens(...)` - Line 2414-2445
- **Table:** `outlook_oauth_tokens`
- **Operation:** UPSERT on conflict user_id
- **Fields:** access_token, refresh_token, expires_at, account_email, account_name, etc.

### ✅ NEW (Just Added)
**Function:** `refresh_outlook_token_supabase(user_id, refresh_token)` - Line ~3297
- **Purpose:** Refresh expired tokens and persist to Supabase
- **Table:** `outlook_oauth_tokens`
- **Used By:** `/api/outlook/emails/sync`

### ❌ LEGACY (MongoDB - NOT USED)
**Function:** `refresh_outlook_token(user_id, refresh_token)` - Line 3360
- **Table:** MongoDB `db.users` ❌ WRONG DATABASE
- **Status:** DEAD CODE - not called anywhere
- **Action Required:** DELETE or disable

---

## 4. EMAIL SYNC ENDPOINTS

### ✅ CANONICAL (ACTIVE)
**Endpoint:** `GET /api/outlook/emails/sync`
- **File:** `/app/backend/server.py` Line 2904-2965
- **Middleware:** `Depends(get_current_user)`
- **Auth:** Uses `get_outlook_tokens()` → Microsoft Graph API
- **Function:** Fetch emails from Graph, store in Supabase
- **UI Entry Point:** YES - Integrations.js "Refresh" button
- **Token Source:** `outlook_oauth_tokens` table
- **Recently Fixed:** Token expiry check, diagnostic logging, safe params

### ✅ COMPREHENSIVE SYNC (ACTIVE)
**Endpoint:** `POST /api/outlook/comprehensive-sync`
- **File:** `/app/backend/server.py` Line 3023
- **Purpose:** Full 36-month email analysis (background job)
- **UI Entry Point:** NO (internal/admin use)
- **Status:** Separate from basic sync

---

## 5. STATUS & UTILITY ENDPOINTS

### ✅ CANONICAL STATUS
**Endpoint:** `GET /api/outlook/status`
- **File:** `/app/backend/server.py` Line 3391
- **Middleware:** `Depends(get_current_user)`
- **Function:** Check if Outlook connected
- **Returns:** connected boolean, email count, metadata
- **UI Entry Point:** YES - Called on Integrations page load
- **Recently Fixed:** Uses workspace-scoped integration_accounts

### ⚠️ DEBUG ENDPOINT
**Endpoint:** `GET /api/outlook/debug-tokens`
- **File:** `/app/backend/server.py` Line 3487
- **Purpose:** Debug token state
- **UI Entry Point:** NO
- **Status:** Should be dev-only

### ✅ DISCONNECT
**Endpoint:** `POST /api/outlook/disconnect`
- **File:** `/app/backend/server.py` Line 3530
- **Middleware:** `Depends(get_current_user)`
- **Function:** Remove tokens and integration state
- **UI Entry Point:** YES - "Disconnect" button

### ✅ SYNC STATUS
**Endpoint:** `GET /api/outlook/sync-status/{job_id}`
- **File:** `/app/backend/server.py` Line 3273
- **Purpose:** Check comprehensive sync job status
- **UI Entry Point:** NO (related to background jobs)

### ✅ INTELLIGENCE
**Endpoint:** `GET /api/outlook/intelligence`
- **File:** `/app/backend/server.py` Line 3284
- **Purpose:** Get email intelligence insights
- **UI Entry Point:** NO (internal)

---

## 6. CALENDAR ENDPOINTS (SEPARATE CONCERN)

### ℹ️ CALENDAR SYNC (OUT OF SCOPE)
**Endpoints:**
- `GET /api/outlook/calendar/events` - Line 3575
- `POST /api/outlook/calendar/sync` - Line 3658
**Status:** Use same OAuth tokens, separate sync logic
**Note:** NOT part of this consolidation task

---

## INVENTORY SUMMARY

### ✅ CANONICAL FLOW (SINGLE PATH)
```
UI "Connect Outlook" button
    ↓
GET /api/auth/outlook/login (requires auth)
    ↓
Redirect to Microsoft OAuth
    ↓
GET /api/auth/outlook/callback (public)
    ↓
Store tokens → outlook_oauth_tokens
    ↓
Store integration state → integration_accounts
    ↓
Redirect to /integrations?outlook_connected=true
```

### ✅ SYNC FLOW (SINGLE PATH)
```
UI "Refresh" button
    ↓
GET /api/outlook/emails/sync (requires auth)
    ↓
get_outlook_tokens(user_id)
    ↓
Check expiry → refresh if needed
    ↓
Microsoft Graph API call
    ↓
Store emails → Supabase
    ↓
Return count
```

### ❌ NO DUPLICATE PATHS FOUND
- Only ONE login endpoint
- Only ONE callback endpoint
- Only ONE basic sync endpoint
- Only ONE token storage table (primary)

### ⚠️ FOUND ISSUES
1. **Legacy MongoDB token refresh** (line 3360) - Dead code, not called
2. **Debug endpoint** (line 3487) - Should be dev-only
3. **Fallback to m365_tokens** in `get_outlook_tokens()` - Backwards compat, not harmful

---

## CONCLUSION

**Good News:** No competing Outlook OAuth flows detected.

**Minor Cleanup Needed:**
- Remove/guard debug endpoint
- Delete MongoDB token refresh function (dead code)
- Optional: Remove m365_tokens fallback if migration complete

**Current State:** Architecture is already consolidated. Only minor cleanup required.
