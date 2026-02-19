# 🚀 Email Integration - Deployment & Testing Instructions

## 🔧 What Was Fixed

### Root Cause Identified ✅
The email connection state was not persisting because of an **OAuth Code Reuse Bug**:

**BROKEN FLOW** (before fix):
1. Backend receives OAuth code from Microsoft/Google ✅
2. Backend exchanges code for tokens ✅
3. Backend sends **CODE** to Edge Function ❌
4. Edge Function tries to exchange **same code** again ❌
5. OAuth provider rejects (code already used) ❌
6. Database write never happens ❌

**FIXED FLOW** (after fix):
1. Backend receives OAuth code from Microsoft/Google ✅
2. Backend exchanges code for tokens ✅
3. Backend sends **TOKENS** to Edge Function ✅
4. Edge Function writes tokens to database ✅
5. Edge Function writes connection state to `email_connections` ✅
6. UI shows "Connected" ✅

---

## 📦 Files Modified

### Backend Changes
- **`/app/backend/server.py`**:
  - `outlook_callback()`: Now sends tokens (not code) with `action: "store_tokens"`
  - `gmail_callback()`: Now sends tokens (not code) with `action: "store_tokens"`

### Edge Function Changes
- **`/app/supabase_edge_functions/outlook-auth/index.ts`**: Added `store_tokens` action handler
- **`/app/supabase_edge_functions/gmail_prod/index.ts`**: Added `store_tokens` action handler

### New Documentation
- **`/app/OAUTH_SETUP_GUIDE.md`**: Complete OAuth setup guide with exact redirect URLs
- **`/app/DEPLOYMENT_INSTRUCTIONS.md`**: This file

---

## 📋 Pre-Deployment Checklist

Before deploying Edge Functions, ensure:

- [ ] OAuth apps configured correctly (see `/app/OAUTH_SETUP_GUIDE.md`)
- [ ] Backend OAuth credentials in `/app/backend/.env`:
  - `AZURE_CLIENT_ID`
  - `AZURE_CLIENT_SECRET`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
- [ ] Database tables exist:
  - `email_connections` (with RLS policies)
  - `outlook_oauth_tokens`
  - `gmail_connections`

---

## 🚀 Step 1: Deploy Updated Edge Functions

### Deploy `outlook-auth` Edge Function

1. **Go to Supabase Dashboard**
2. **Navigate to**: Edge Functions → outlook-auth
3. **Replace the entire code** with the content from:
   ```
   /app/supabase_edge_functions/outlook-auth/index.ts
   ```
4. **Deploy the function**
5. **Verify Secrets** are configured:
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `BACKEND_URL` = `https://biqc-performance-hub.preview.emergentagent.com`
   - `SUPABASE_URL` (should be auto-configured)
   - `SUPABASE_SERVICE_ROLE_KEY` (should be auto-configured)
   - `SUPABASE_ANON_KEY` (should be auto-configured)

### Deploy `gmail_prod` Edge Function

1. **Go to Supabase Dashboard**
2. **Navigate to**: Edge Functions → gmail_prod
3. **Replace the entire code** with the content from:
   ```
   /app/supabase_edge_functions/gmail_prod/index.ts
   ```
4. **Deploy the function**
5. **Verify Secrets** are configured:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `BACKEND_URL` = `https://biqc-performance-hub.preview.emergentagent.com`
   - `SUPABASE_URL` (should be auto-configured)
   - `SUPABASE_SERVICE_ROLE_KEY` (should be auto-configured)
   - `SUPABASE_ANON_KEY` (should be auto-configured)

---

## 🧪 Step 2: Test Outlook Connection

### Test Flow:

1. **Open the app**: Navigate to `/connect-email`
2. **Click "Connect Outlook"**
3. **Authorize the app** on Microsoft login page
4. **Wait for redirect** back to `/connect-email?outlook_connected=true`
5. **Check UI**: Should show "Connected to Outlook"

### Debug if it fails:

**Check Backend Logs**:
```bash
tail -f /var/log/supervisor/backend.out.log | grep -i outlook
```

Look for:
- ✅ "Token exchange successful"
- ✅ "Proxying tokens to outlook-auth Edge Function"
- ✅ "Edge Function stored Outlook tokens successfully"

**Check Supabase Edge Function Logs**:
1. Go to Supabase Dashboard → Edge Functions → outlook-auth → Logs
2. Look for:
   - `[EDGE] store_tokens action`
   - `[EDGE] ✅ Tokens written successfully`
   - `[EDGE] ✅ Connection state written successfully`

**Check Database**:
```sql
-- Check connection state (this is what UI queries)
SELECT * FROM email_connections WHERE user_id = 'YOUR_USER_ID';

-- Check token storage
SELECT user_id, account_email, expires_at 
FROM outlook_oauth_tokens 
WHERE user_id = 'YOUR_USER_ID';
```

**Expected Result**: Both queries should return rows.

---

## 🧪 Step 3: Test Gmail Connection

### Test Flow:

1. **First, disconnect Outlook** (if connected) - only one provider at a time
2. **Open the app**: Navigate to `/connect-email`
3. **Click "Connect Gmail"**
4. **Authorize the app** on Google login page
5. **Wait for redirect** back to `/connect-email?gmail_connected=true`
6. **Check UI**: Should show "Connected to Gmail"

### Debug if it fails:

**Check Backend Logs**:
```bash
tail -f /var/log/supervisor/backend.out.log | grep -i gmail
```

Look for:
- ✅ "Successfully exchanged code for Gmail tokens"
- ✅ "Proxying tokens to gmail_prod Edge Function"
- ✅ "Edge Function stored Gmail tokens successfully"

**Check Supabase Edge Function Logs**:
1. Go to Supabase Dashboard → Edge Functions → gmail_prod → Logs
2. Look for:
   - `[EDGE] store_tokens action`
   - `[EDGE] ✅ Tokens written successfully`
   - `[EDGE] ✅ Connection state written successfully`

**Check Database**:
```sql
-- Check connection state (this is what UI queries)
SELECT * FROM email_connections WHERE user_id = 'YOUR_USER_ID';

-- Check token storage
SELECT user_id, email, token_expiry 
FROM gmail_connections 
WHERE user_id = 'YOUR_USER_ID';
```

**Expected Result**: Both queries should return rows.

---

## 🔍 Step 4: Verify Connection Persistence

### Test UI State Persistence:

1. **Refresh the page** (`/connect-email`)
2. **UI should still show "Connected"** (not asking to connect again)
3. **Click "View Inbox"** button
4. **Should navigate to** `/email-inbox`

### Test Disconnect:

1. **Click "Disconnect"** button for connected provider
2. **Confirm the disconnect**
3. **UI should show connection options** again
4. **Database check**:
   ```sql
   SELECT * FROM email_connections WHERE user_id = 'YOUR_USER_ID';
   ```
   Should return no rows after disconnect.

---

## 📊 Step 5: Test Priority Inbox (Once Connected)

### Prerequisites:
- Outlook OR Gmail must be successfully connected
- `email_priority` Edge Function should be deployed (future task)

### Test Flow:
1. Navigate to `/email-inbox`
2. Should see emails from connected provider
3. AI should prioritize emails based on business context

**Note**: This feature is blocked until email connection is stable.

---

## 🐛 Common Issues & Solutions

### Issue 1: "Edge Function invoked but no logs"

**Cause**: Function not deployed or secrets missing

**Fix**:
1. Verify function is deployed in Supabase Dashboard
2. Check all secrets are configured
3. Redeploy the function

### Issue 2: "Token write failed: permission denied"

**Cause**: RLS policies blocking service role

**Fix**:
```sql
-- Service role should bypass RLS, but verify:
SELECT * FROM pg_policies WHERE tablename = 'email_connections';

-- If needed, temporarily disable RLS for testing:
ALTER TABLE email_connections DISABLE ROW LEVEL SECURITY;
```

### Issue 3: "Connection shows 'Connected' but no emails"

**Cause**: Tokens stored but email sync not implemented

**Fix**: This is expected for now. Email sync and Priority Inbox are the next tasks after connection is stable.

### Issue 4: "Invalid redirect_uri error"

**Cause**: OAuth app redirect URI doesn't match

**Fix**: See `/app/OAUTH_SETUP_GUIDE.md` for exact redirect URIs to configure.

---

## ✅ Success Criteria

### Outlook Connection Success:
- ✅ UI shows "Connected to Outlook (user@example.com)"
- ✅ `email_connections` table has a row with `provider = 'outlook'`
- ✅ `outlook_oauth_tokens` table has access_token
- ✅ Page refresh still shows "Connected"
- ✅ Disconnect button works

### Gmail Connection Success:
- ✅ UI shows "Connected to Gmail (user@gmail.com)"
- ✅ `email_connections` table has a row with `provider = 'gmail'`
- ✅ `gmail_connections` table has access_token
- ✅ Page refresh still shows "Connected"
- ✅ Disconnect button works

---

## 📝 Next Steps After Email Connection Works

1. **Test Priority Inbox**: Verify `email_priority` Edge Function works
2. **Email Sync**: Implement background sync jobs
3. **UI Polish**: Add loading states, better error messages
4. **Token Refresh**: Implement automatic token refresh logic
5. **Multi-Account**: Allow multiple email accounts per user (future)

---

## 📞 Need Help?

If you encounter issues:

1. **Check logs first**:
   - Backend: `tail -f /var/log/supervisor/backend.out.log`
   - Edge Functions: Supabase Dashboard → Logs

2. **Verify database state**:
   ```sql
   SELECT * FROM email_connections;
   SELECT * FROM outlook_oauth_tokens;
   SELECT * FROM gmail_connections;
   ```

3. **Check OAuth configuration**: See `/app/OAUTH_SETUP_GUIDE.md`

4. **Share specific error messages** with logs for debugging

---

**Last Updated**: December 2025  
**Status**: ⚠️ AWAITING USER DEPLOYMENT OF EDGE FUNCTIONS  
**Blocker**: User must deploy updated Edge Function code to Supabase before testing
