# HubSpot Merge.dev Connection Testing Guide

## 🎯 Test Objective
Capture detailed diagnostic logs for the HubSpot Merge.dev integration to identify the root cause of the "Failed to connect" error.

## ✅ Pre-Test Verification (Completed by Testing Agent)

### Infrastructure Status
- ✅ **Authentication System**: Working correctly (Supabase OAuth)
- ✅ **Protected Routes**: Properly secured and redirecting to login
- ✅ **User Account**: andre@thestrategysquad.com.au exists and has authenticated successfully
- ✅ **Merge API Key**: Configured in backend environment
- ✅ **Backend Endpoint**: `/api/integrations/merge/link-token` responding with 200 OK
- ✅ **Frontend Logging**: Comprehensive logging implemented (lines 31-95 in Integrations.js)
- ✅ **Backend Logging**: Comprehensive logging implemented (lines 7467-7546 in server.py)

### Code Review Findings
**Frontend Enhanced Logging (Integrations.js):**
- Line 31: `'✅ Merge onboarding success'` with public_token and metadata
- Line 46: `'🔄 Exchanging token...'` with category and provider
- Line 60: `'📊 Exchange response status: XXX'`
- Line 64: `'✅ Token exchange successful'` with result
- Line 71: `'❌ Token exchange failed'` with error details
- Line 89: `'❌ Merge onboarding error'` if modal exits with error

**Backend Enhanced Logging (server.py):**
- Line 7467: `'🔄 Exchanging Merge token for user {user_id}, category: {category}'`
- Line 7473: `'📡 Calling Merge API: {exchange_url}'`
- Line 7480: `'📊 Merge API response status: {response.status_code}'`
- Line 7491: `'📦 Merge API response: {data}'`
- Line 7500: `'✅ Received account_token for integration: {integration_name}'`
- Line 7511: `'💾 Storing integration account: user={user_id}, provider={integration_name}, category={category}'`
- Line 7536: `'✅ Integration account stored successfully: {result.data}'`
- Error logs at lines 7463, 7484, 7497, 7503, 7506, 7533, 7545

## 📋 Manual Testing Steps

### Step 1: Login
1. Navigate to: https://market-cognitive.preview.emergentagent.com/login-supabase
2. Click **"Continue with Google"**
3. Login with: **andre@thestrategysquad.com.au**
4. Wait for redirect to dashboard/advisor page

### Step 2: Open Browser Developer Tools
**CRITICAL: Do this BEFORE navigating to integrations page**

1. Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
2. Go to the **Console** tab
3. Clear any existing logs (click the 🚫 icon)
4. Keep the console open throughout the test

### Step 3: Navigate to Integrations Page
1. Navigate to: https://market-cognitive.preview.emergentagent.com/integrations
2. Wait for page to fully load
3. Verify you see the "Merge Unified Integrations" card

### Step 4: Open Merge Link Modal
1. Locate the **"Connect via Merge"** button (should be in a purple/indigo card)
2. **BEFORE CLICKING**: Ensure console is visible and ready to capture logs
3. Click **"Connect via Merge"**
4. **Watch the console** for these logs:
   - `'🔗 Opening Merge Link...'`
   - `'✅ Session validated, requesting link token...'`
   - `'✅ Link token received: lt_xxxxx'`
   - `'✅ Merge Link modal opened'`

### Step 5: Connect HubSpot (CRITICAL - CAPTURE ALL LOGS)
1. In the Merge modal that appears, use the search box to find **"HubSpot"**
2. Click on the **HubSpot** option
3. **IMMEDIATELY WATCH THE CONSOLE** for these logs:
   - `'✅ Merge onboarding success'` - Should include `public_token` and `metadata`
   - `'🔄 Exchanging token...'` - Should show category (e.g., 'crm') and provider ('HubSpot')
   - `'📊 Exchange response status: XXX'` - Note the status code
   - Either:
     - `'✅ Token exchange successful'` with result data, OR
     - `'❌ Token exchange failed'` with error details

4. **If HubSpot OAuth page opens:**
   - Complete the HubSpot authentication
   - Return to the application
   - Continue monitoring console logs

5. **If error occurs:**
   - Take a screenshot of the console
   - Copy ALL console messages (right-click in console → Save as...)
   - Note the exact error message

### Step 6: Check Backend Logs
After the connection attempt (success or failure), check backend logs:

```bash
tail -n 200 /var/log/supervisor/backend.*.log | grep -E "(🔄|📡|📊|💾|✅|❌)" | grep -i merge
```

**Look for these specific log entries:**
- `'🔄 Exchanging Merge token for user...'`
- `'📡 Calling Merge API: https://api.merge.dev/api/integrations/account-token/...'`
- `'📊 Merge API response status: XXX'`
- `'📦 Merge API response: {...}'`
- `'✅ Received account_token for integration: HubSpot'`
- `'💾 Storing integration account...'`
- `'✅ Integration account stored successfully'`
- Any `'❌'` error messages

### Step 7: Verify UI State
1. Check if HubSpot appears in the "Connected Tools" section at the top of the integrations page
2. Check for any toast notifications (top-right corner)
3. Take a screenshot of the integrations page after the connection attempt

## 📊 Expected Results

### Success Scenario
**Frontend Console:**
```
✅ Merge onboarding success {public_token: "pt_xxxxx", metadata: {...}}
🔄 Exchanging token... {category: "crm", provider: "HubSpot"}
📊 Exchange response status: 200
✅ Token exchange successful: {success: true, provider: "HubSpot", category: "crm"}
```

**Backend Logs:**
```
🔄 Exchanging Merge token for user c80b456f-..., category: crm
📡 Calling Merge API: https://api.merge.dev/api/integrations/account-token/pt_xxxxx
📊 Merge API response status: 200
📦 Merge API response: {account_token: "at_xxxxx", integration: {name: "HubSpot"}}
✅ Received account_token for integration: HubSpot
💾 Storing integration account: user=c80b456f-..., provider=HubSpot, category=crm
✅ Integration account stored successfully
```

**UI:**
- Toast notification: "HubSpot connected successfully!"
- HubSpot appears in "Connected Tools" section

### Failure Scenario - What to Capture
**Frontend Console:**
- Exact error message from `'❌ Token exchange failed'` log
- Response status code from `'📊 Exchange response status: XXX'`
- Any additional error details

**Backend Logs:**
- Which step failed (token exchange, API call, database storage)
- Exact error message with `'❌'` prefix
- HTTP status code from Merge API
- Any exception stack traces

## 🔍 Common Failure Points to Investigate

### 1. Merge API Authentication Error
**Symptoms:**
- Backend log: `'❌ Merge API error (401): ...'`
- Frontend: `'❌ Token exchange failed: Merge API error: ...'`

**Cause:** Invalid or expired Merge API key

### 2. Token Exchange Timeout
**Symptoms:**
- Frontend: `'❌ Error during token exchange: Network error'`
- Backend: `'❌ HTTP error calling Merge API: ...'`

**Cause:** Network connectivity issue or Merge API downtime

### 3. Database Storage Error
**Symptoms:**
- Backend: `'❌ Database error storing integration: ...'`
- Frontend: `'❌ Token exchange failed: Database error: ...'`

**Cause:** Supabase table schema issue or RLS policy violation

### 4. Invalid Public Token
**Symptoms:**
- Backend: `'❌ Merge API error (400): Invalid public_token'`

**Cause:** Token expired or malformed

### 5. Missing Account Token in Response
**Symptoms:**
- Backend: `'❌ No account_token in Merge API response'`

**Cause:** Merge API returned unexpected response format

## 📝 What to Report

Please provide:

1. **Console Logs** (copy all text from browser console)
2. **Backend Logs** (output from the grep command in Step 6)
3. **Screenshots:**
   - Browser console showing error messages
   - Integrations page after connection attempt
   - Any error dialogs or toast notifications
4. **Exact Error Message** (if any)
5. **Response Status Code** (from console log)
6. **Network Tab** (optional but helpful):
   - Filter for "merge" or "integrations"
   - Show request/response for failed calls

## 🎯 Success Criteria

✅ Modal opens successfully
✅ HubSpot appears in the Merge modal
✅ OAuth flow initiates
✅ Detailed logs captured in console
✅ Backend logs show the token exchange process
✅ Error messages (if any) are clear and actionable
✅ Toast notifications appear with appropriate messages

## ⚠️ Important Notes

- **Do NOT close the browser console** during testing
- **Capture logs IMMEDIATELY** after clicking HubSpot (they may scroll quickly)
- **Complete the test in one session** (don't refresh the page mid-test)
- **If the modal doesn't open**, check console for errors and report them
- **If HubSpot OAuth fails**, note whether it's a HubSpot error or application error

## 🔧 Troubleshooting

### Modal doesn't open
- Check console for `'❌ Error opening Merge Link'`
- Verify link token was received: `'✅ Link token received'`
- Check if Merge Link library loaded correctly

### Can't find HubSpot in modal
- Try scrolling in the modal
- Try searching for "hub" or "spot"
- Check if modal shows "No integrations found"

### OAuth redirect fails
- Check if popup blocker is enabled
- Verify HubSpot account credentials
- Check for CORS errors in console

---

**Testing Agent Notes:**
- Infrastructure verified and working correctly
- All logging is in place and comprehensive
- User authentication confirmed working
- Merge API key configured
- Ready for manual testing by user andre@thestrategysquad.com.au
