# ROOT CAUSE ANALYSIS - OUTLOOK SYNC 400

## C. ROOT CAUSE (BASED ON INVENTORY)

### Finding 1: Why UI Shows "Connected" But Sync Fails

**UI Connection State:**
- **Source:** `/api/outlook/status` endpoint (Line 3391-3444)
- **Logic:** 
  1. Checks `integration_accounts` table for `category='email'` (Line 3373)
  2. If found → Returns `connected: True`
  3. Fallback: Checks `outlook_oauth_tokens` table
  4. If tokens exist → Returns `connected: True` AND migrates to integration_accounts

**Problem:** `/api/outlook/status` returns `connected: True` based on:
- `integration_accounts` row exists (even if token is invalid/expired)
- OR `outlook_oauth_tokens` row exists (doesn't validate token expiry)

**Sync Endpoint State:**
- **Source:** `/api/outlook/emails/sync` Line 2904-2965
- **Logic:**
  1. Calls `get_outlook_tokens(user_id)` (Line 2914)
  2. Checks if tokens exist
  3. Uses `access_token` directly (no expiry validation until recent fix)
  4. Calls Microsoft Graph API
  
**Problem:** Even with recent token expiry fix, Graph may still return 400 if:
- Token has invalid scopes
- Token was revoked
- Graph API parameters are malformed

### Finding 2: Why Sync Returns 400

**Potential Causes (Need Graph Error to Confirm):**

**Theory 1: Expired/Invalid Token**
- Token in DB is expired
- Recent fix added expiry check, but refresh may fail
- Graph returns 401/400 with "InvalidAuthenticationToken"

**Theory 2: Invalid Folder ID**
- Code uses `folder="inbox"` (well-known name)
- Should work, but may fail if mailbox has custom folder structure

**Theory 3: Malformed Query Parameters**
- `$select` fields may include unsupported fields
- `$top=25` is safe (recent fix)
- `$orderby` is standard

**Theory 4: Scope Issues**
- Token may not have `Mail.Read` scope
- Token may have been granted with different scopes than requested

**Theory 5: Account/License Issues**
- Microsoft account may not have valid license
- Mailbox may be disabled/archived

**CRITICAL:** Without Graph error payload, this is speculative.

### Finding 3: Why `/auth/callback` May Fire Repeatedly

**NOT AN ISSUE** - This is Supabase auth callback (different from Outlook)

**Flow:**
1. User logs in with Google/Microsoft (account auth)
2. Supabase redirects to `/auth/callback` (React route)
3. `AuthCallbackSupabase.js` runs `useEffect` once
4. Calls `/api/auth/check-profile`
5. Redirects to `/onboarding` or `/advisor`

**May fire multiple times if:**
- React strict mode (development)
- Component re-mounts
- Profile check fails → triggers navigation → component re-mounts

**Not harmful** - Separate concern from Outlook integration

---

## TRUTH DETERMINATION LOGIC COMPARISON

### Backend `/api/outlook/status` Says "Connected" When:
```python
# Line 3373-3395:
integration_record exists (category='email') 
  → Returns connected: True

# OR Line 3398-3438:
outlook_oauth_tokens row exists
  → Migrates to integration_accounts
  → Returns connected: True
```

**Issues:**
- ❌ Doesn't validate token expiry before returning True
- ❌ Doesn't check if access_token is still valid with Microsoft
- ❌ Returns True even if refresh_token is missing

### Sync Endpoint `/api/outlook/emails/sync` Fails When:
```python
# Line 2914-2917:
tokens = await get_outlook_tokens(user_id)
if not tokens:
    raise 400 "Outlook not connected"

# Line 2930-2934:
Graph API call fails
  → Returns 400 with Graph error text (but not structured)
```

**Issues:**
- ❌ Graph error not parsed into structured format
- ❌ No differentiation between "not connected" vs "token expired" vs "Graph API error"

### UI Shows "Connected" When:
```javascript
// Integrations.js Line 252:
setOutlookStatus({
  ...response.data,  // Includes connected: boolean from /api/outlook/status
})

// resolveIntegrationState() also checks:
if (outlookStatus.connected) {
  return { connected: true, source: 'edge' };
}
```

**Issues:**
- ❌ UI trusts backend `/api/outlook/status` unconditionally
- ❌ No client-side validation of token validity
- ❌ "Fail open" on errors means stale "connected" state can persist

---

## SUMMARY OF ROOT CAUSES

**Problem:** "Connected" UI but 400 sync error

**Cause 1:** `/api/outlook/status` returns `connected: True` based on database row existence, NOT token validity

**Cause 2:** Sync endpoint doesn't return structured errors, making debugging impossible

**Cause 3:** Token expiry/refresh flow recently added but may have issues (refresh function, scope validation, etc.)

**Required Fix:** Make connection state reflect token validity, not just row existence.
