# 🐛 Priority Inbox Error Diagnosis

## Errors Observed

From your screenshot:
1. ❌ **Gmail priority analysis failed: 500**
2. ❌ **POST https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/email_priority?provider=gmail 500 (Internal Server Error)**
3. ❌ **POST https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_prod 401 (Unauthorized)**
4. ⚠️ **Gmail Edge Function check failed - failing open, maintaining current state**

---

## Root Cause Analysis

### Issue 1: `email_priority` returning 500

**Most Likely Causes:**
1. **Gmail access token expired** - The token stored in `gmail_connections` table is no longer valid
2. **Gmail API rate limit** - Too many requests to Gmail API
3. **Gmail API permission issue** - Missing scopes or permissions

**What's happening:**
- The Edge Function successfully authenticates the user
- It retrieves the Gmail access token from the database
- When it tries to call Gmail API with that token, Gmail rejects it (401 or 403)
- The Edge Function catches this and returns 500

### Issue 2: `gmail_prod` returning 401

**Most Likely Cause:**
- Frontend is calling `gmail_prod` for a status check WITHOUT passing the Supabase auth token
- The Edge Function requires `Authorization: Bearer <token>` header for status checks

---

## Immediate Solutions

### Solution 1: Reconnect Gmail (Quick Fix)

The access token has likely expired. You need to:

1. **Disconnect Gmail**:
   - Go to: https://biqc-unblock-prod.preview.emergentagent.com/connect-email
   - Click "Disconnect" on Gmail

2. **Reconnect Gmail**:
   - Click "Connect Gmail" again
   - Authorize again
   - This will store a fresh access token

3. **Test Priority Inbox**:
   - Go to: https://biqc-unblock-prod.preview.emergentagent.com/email-inbox
   - Should now load successfully

---

### Solution 2: Check Supabase Edge Function Logs (For Diagnosis)

To see the exact error:

1. **Go to Supabase Dashboard**
2. **Navigate to**: Edge Functions → email_priority → Logs
3. **Look for recent invocations** with status 500
4. **Check the error message** - it will tell you exactly what Gmail API returned

**Common error messages:**
- `"Invalid Credentials"` → Token expired, need to reconnect
- `"Insufficient Permission"` → Missing Gmail scopes
- `"Rate Limit Exceeded"` → Too many requests

---

### Solution 3: Verify Gmail Connection in Database

Run this query in Supabase SQL Editor:

```sql
-- Check if Gmail token exists and when it expires
SELECT 
  user_id, 
  email, 
  token_expiry,
  (token_expiry < NOW()) as is_expired,
  updated_at
FROM gmail_connections 
WHERE user_id = auth.uid();
```

**If `is_expired = true`:**
- The token has expired
- You MUST reconnect Gmail (Solution 1)

**If `token_expiry` is NULL:**
- Token storage didn't complete properly
- You MUST reconnect Gmail

---

### Solution 4: Check Gmail API Permissions

Verify your Google Cloud Console OAuth scopes include:

```
https://www.googleapis.com/auth/gmail.readonly
```

**Steps:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Under "Scopes", verify `gmail.readonly` is included
4. If missing, add it and reconnect Gmail

---

## Why This Happens

### Gmail Access Tokens Expire

Gmail access tokens are **SHORT-LIVED** (typically 1 hour). The application should:

1. **Use refresh tokens** to get new access tokens automatically
2. **Detect expired tokens** and trigger re-authentication
3. **Handle token refresh in Edge Functions**

### Current State

Your application stores refresh tokens but doesn't automatically refresh them yet. This is a **known limitation** mentioned in previous documentation.

**Workaround**: Manually reconnect Gmail when tokens expire (every ~1 hour of inactivity)

**Permanent Fix**: Implement automatic token refresh logic (future enhancement)

---

## Testing Steps After Reconnecting

1. **Disconnect Gmail**:
   ```
   https://biqc-unblock-prod.preview.emergentagent.com/connect-email
   ```
   Click "Disconnect Gmail"

2. **Reconnect Gmail**:
   - Click "Connect Gmail"
   - Authorize
   - Wait for "Connected" status

3. **Go to Priority Inbox**:
   ```
   https://biqc-unblock-prod.preview.emergentagent.com/email-inbox
   ```

4. **Expected Result**:
   - ✅ No 500 errors
   - ✅ Emails load successfully
   - ✅ Priority analysis completes

---

## Verify Connection State

After reconnecting, run this in Supabase SQL Editor:

```sql
-- Check connection state
SELECT * FROM email_connections WHERE user_id = auth.uid();

-- Check Gmail tokens
SELECT 
  user_id,
  email,
  LEFT(access_token, 20) || '...' as token_preview,
  token_expiry,
  (token_expiry > NOW()) as is_valid,
  updated_at
FROM gmail_connections 
WHERE user_id = auth.uid();
```

**Expected:**
- `email_connections.connected = true`
- `email_connections.provider = 'gmail'`
- `gmail_connections.access_token` exists
- `gmail_connections.token_expiry` is in the future (`is_valid = true`)

---

## Long-Term Fix Required

To prevent this issue from recurring every hour, the application needs:

### 1. Automatic Token Refresh Logic

Add this to `email_priority` Edge Function:

```typescript
// Before calling Gmail API, check if token is expired
if (new Date(gmailConnection.token_expiry) < new Date()) {
  // Token expired - refresh it
  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: gmailConnection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const newTokens = await refreshResponse.json();
  
  // Update database with new access token
  await supabaseService.from("gmail_connections").update({
    access_token: newTokens.access_token,
    token_expiry: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
  }).eq("user_id", user.id);
  
  // Use the new token
  accessToken = newTokens.access_token;
}
```

### 2. Graceful Error Handling

When Gmail API returns 401, the Edge Function should:
- Detect it's a token issue
- Return a specific error code
- Frontend should prompt user to reconnect

---

## Summary

**Immediate Action Required:**
1. ✅ **Reconnect Gmail** at `/connect-email`
2. ✅ **Test Priority Inbox** at `/email-inbox`

**NOT a Redirect URI Issue:**
- All redirect URIs are correctly configured
- OAuth flow completes successfully
- The issue is token expiration, not authentication setup

**Future Enhancement:**
- Implement automatic token refresh
- This will prevent the need to manually reconnect every hour

---

## Quick Command Reference

### Check Token Expiry
```sql
SELECT 
  email,
  token_expiry,
  (token_expiry < NOW()) as expired,
  AGE(token_expiry, NOW()) as time_remaining
FROM gmail_connections 
WHERE user_id = auth.uid();
```

### Force Disconnect (if UI fails)
```sql
DELETE FROM gmail_connections WHERE user_id = auth.uid();
DELETE FROM email_connections WHERE user_id = auth.uid() AND provider = 'gmail';
```

### Check Edge Function Logs
1. Supabase Dashboard → Edge Functions → email_priority → Logs
2. Look for the most recent 500 error
3. Check the error message for Gmail API response

---

**Status**: Token expired - requires reconnection  
**Fix Time**: 30 seconds (disconnect + reconnect)  
**Permanent Fix**: Requires token refresh implementation (future task)
