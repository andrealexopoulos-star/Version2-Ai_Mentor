# Gmail Console References Root Cause Analysis

## Investigation Summary
**Date:** January 30, 2026  
**Issue:** Gmail console references appearing when Outlook should be the active provider  
**User Scenario:** User has deployed `outlook-auth` Edge Function and expects Outlook to work through Edge Function (not backend OAuth)

---

## Root Cause Identified

### 1. **Hardcoded Gmail Edge Function Calls**

The frontend code is **hardcoded** to check `gmail_prod` Edge Function regardless of which provider should be active:

#### EmailInbox.js (Priority Inbox Page)
```javascript
// Lines 48-73: ALWAYS checks Gmail via Edge Function
const edgeFunctionUrl = `${supabaseUrl}/functions/v1/gmail_prod`;

const gmailResponse = await fetch(edgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
});
```

#### ConnectEmail.js (Connect Email Page)
```javascript
// Lines 38-70: ALWAYS checks Gmail via Edge Function
const edgeFunctionUrl = `${supabaseUrl}/functions/v1/gmail_prod`;

const gmailResponse = await fetch(edgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
});
```

**Impact:** Every time these pages load, they call `gmail_prod` Edge Function, causing Gmail references in console logs.

---

### 2. **Gmail Preference Over Outlook**

When both providers are connected, the code **prefers Gmail**:

#### EmailInbox.js Lines 98-110
```javascript
// Determine active provider (prefer Gmail if both connected)
if (hasGmail) {
  setActiveProvider('gmail');
  setConnectedEmail(gmailData.email);
  fetchPriorityInbox('gmail');
} else if (hasOutlook) {
  setActiveProvider('outlook');
  setConnectedEmail(outlookData.account_email);
  fetchPriorityInbox('outlook');
}
```

**Impact:** Even if user has Outlook connected via Edge Function, Gmail will be selected as active provider if both are connected.

---

### 3. **Different Connection Detection Methods**

Gmail and Outlook use **completely different** connection detection approaches:

| Provider | Detection Method | Location |
|----------|-----------------|----------|
| **Gmail** | Edge Function `gmail_prod` | Supabase Edge Functions |
| **Outlook** | Direct Supabase table query `outlook_oauth_tokens` | Frontend direct query |

**Impact:** Inconsistent architecture makes it unclear which provider is truly active.

---

### 4. **No Check for `outlook-auth` Edge Function**

The user has deployed `outlook-auth` Edge Function (confirmed at `/app/supabase_edge_functions/outlook-auth/index.ts`), but the frontend code **never calls it**.

**Current Outlook Detection:**
```javascript
// EmailInbox.js Lines 76-90
const { data, error } = await supabase
  .from('outlook_oauth_tokens')
  .select('account_email')
  .eq('user_id', session.user.id)
  .eq('provider', 'microsoft')
  .maybeSingle();
```

**Expected Outlook Detection (using Edge Function):**
```javascript
// Should call outlook-auth Edge Function instead
const edgeFunctionUrl = `${supabaseUrl}/functions/v1/outlook-auth`;

const outlookResponse = await fetch(edgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
});
```

**Impact:** Outlook Edge Function is deployed but unused, causing confusion about which authentication method is active.

---

## Files Affected

### Frontend Files with Gmail Hardcoding
1. `/app/frontend/src/pages/EmailInbox.js` - Lines 51, 146
2. `/app/frontend/src/pages/ConnectEmail.js` - Lines 43
3. `/app/frontend/src/pages/Integrations.js` - Line 278
4. `/app/frontend/src/pages/GmailTest.js` - Line 49

### Edge Functions
1. `/app/supabase_edge_functions/gmail_prod/index.ts` - Gmail Edge Function (actively used)
2. `/app/supabase_edge_functions/outlook-auth/index.ts` - Outlook Edge Function (deployed but NOT used)
3. `/app/supabase_edge_functions/email_priority/index.ts` - Priority analysis (supports both providers)

---

## Network Requests Analysis

### Current Behavior (What User Sees)

When navigating to `/email-inbox`:
1. ✅ `POST /functions/v1/gmail_prod` - **Gmail Edge Function called**
2. ✅ Direct Supabase query to `outlook_oauth_tokens` table
3. ❌ `POST /functions/v1/outlook-auth` - **NOT called** (even though deployed)

When navigating to `/connect-email`:
1. ✅ `GET /api/outlook/status` - Backend Outlook status check
2. ✅ `POST /functions/v1/gmail_prod` - **Gmail Edge Function called**
3. ❌ `POST /functions/v1/outlook-auth` - **NOT called**

---

## Console Log References

### Gmail References Found
- `📊 Gmail Edge Function response:` (EmailInbox.js line 63)
- `Gmail Edge Function error:` (EmailInbox.js line 69)
- `Gmail check error:` (EmailInbox.js line 72)
- `Gmail priority analysis failed:` (EmailInbox.js line 157)
- `Gmail inbox analyzed!` (EmailInbox.js line 196)

### Outlook References Found
- `Outlook check error:` (EmailInbox.js line 89)
- `Outlook inbox analyzed!` (EmailInbox.js line 200)
- `Outlook status check failed:` (ConnectEmail.js line 33)
- `Gmail status check failed:` (ConnectEmail.js line 68)

---

## Why This Happens

1. **Legacy Architecture:** Code was originally built with Gmail as primary provider
2. **Incremental Outlook Addition:** Outlook was added later using different architecture (backend OAuth vs Edge Function)
3. **Edge Function Deployment Mismatch:** `outlook-auth` Edge Function was deployed but frontend was never updated to use it
4. **No Provider Priority Configuration:** No way for user to specify which provider should be primary

---

## Expected vs Actual Behavior

### Expected (User's Expectation)
- User deploys `outlook-auth` Edge Function
- Frontend detects Outlook via Edge Function
- Outlook becomes active provider
- No Gmail references in console

### Actual (Current Behavior)
- Frontend always calls `gmail_prod` Edge Function
- Frontend checks Outlook via direct table query (not Edge Function)
- Gmail preferred if both connected
- Gmail console references appear even when Outlook should be active

---

## Recommended Fixes

### Option 1: Use Outlook Edge Function (Recommended)
Update frontend to call `outlook-auth` Edge Function instead of direct table queries:

```javascript
// EmailInbox.js - Replace lines 76-90
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const outlookEdgeFunctionUrl = `${supabaseUrl}/functions/v1/outlook-auth`;

const outlookResponse = await fetch(outlookEdgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
});

if (outlookResponse.ok) {
  const data = await outlookResponse.json();
  if (data.ok && data.connected) {
    outlookData = { 
      email: data.connected_email || session.user?.email,
      inbox_type: data.inbox_type 
    };
  }
}
```

### Option 2: Add Provider Priority Configuration
Allow users to set which provider should be primary:

```javascript
// Check user preference for primary provider
const primaryProvider = userSettings.primary_email_provider; // 'gmail' or 'outlook'

if (primaryProvider === 'outlook' && hasOutlook) {
  setActiveProvider('outlook');
} else if (primaryProvider === 'gmail' && hasGmail) {
  setActiveProvider('gmail');
} else if (hasOutlook) {
  setActiveProvider('outlook');
} else if (hasGmail) {
  setActiveProvider('gmail');
}
```

### Option 3: Remove Gmail Hardcoding
Only check providers that are actually configured:

```javascript
// Only check Gmail if user has Gmail OAuth configured
if (userHasGmailOAuth) {
  // Check Gmail via Edge Function
}

// Only check Outlook if user has Outlook OAuth configured
if (userHasOutlookOAuth) {
  // Check Outlook via Edge Function
}
```

---

## Testing Recommendations

### Manual Testing Required
Since automated testing cannot complete OAuth flows, user should:

1. **Login via Google OAuth** at `/login-supabase`
2. **Open Browser Console** (F12)
3. **Navigate to `/email-inbox`**
4. **Capture console logs** - Look for:
   - `gmail_prod` Edge Function calls
   - `outlook-auth` Edge Function calls (should be present but currently missing)
   - Which provider is detected as "active"
5. **Navigate to `/connect-email`**
6. **Capture console logs** - Look for:
   - Status check API calls
   - Which provider shows as "connected"
7. **Check Network Tab** - Filter for:
   - `gmail` requests
   - `outlook` requests
   - `functions/v1` requests

### Expected Results After Fix
- ✅ `outlook-auth` Edge Function called when checking Outlook connection
- ✅ No `gmail_prod` calls if user only has Outlook connected
- ✅ Outlook detected as active provider when it's the only connection
- ✅ Console logs show "Outlook" references, not "Gmail"

---

## Conclusion

**Root Cause:** Frontend code is hardcoded to always check `gmail_prod` Edge Function and prefer Gmail over Outlook, even though user has deployed `outlook-auth` Edge Function expecting it to be used.

**Impact:** Gmail console references appear regardless of which provider should be active, causing confusion about which email provider is actually being used.

**Solution:** Update frontend to call `outlook-auth` Edge Function for Outlook connection detection and remove Gmail preference logic.

---

## Files to Update

1. `/app/frontend/src/pages/EmailInbox.js` - Lines 48-90, 98-110
2. `/app/frontend/src/pages/ConnectEmail.js` - Lines 29-70
3. `/app/frontend/src/pages/Integrations.js` - Line 278 (if applicable)

---

**Investigation Complete**  
**Next Steps:** Main agent should implement recommended fixes to use `outlook-auth` Edge Function and remove Gmail hardcoding.
