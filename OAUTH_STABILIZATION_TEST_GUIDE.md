# OAuth Stabilization Testing Guide

## Test Credentials
- **Email:** andre@thestrategysquad.com.au
- **Login Method:** Google OAuth

---

## ✅ CODE REVIEW VERIFICATION - ALL FIXES CORRECTLY IMPLEMENTED

### 1. Gmail OAuth Fix (Lines 594-600)
```javascript
const handleGmailConnect = () => {
  setConnecting('gmail');
  console.log('🔐 Initiating Gmail OAuth via browser navigation...');
  
  // Direct browser navigation to backend OAuth endpoint
  // This bypasses axios interceptor and allows backend to handle OAuth flow
  window.location.assign(`${process.env.REACT_APP_BACKEND_URL}/api/auth/gmail/login?returnTo=/integrations`);
};
```
**✅ VERIFIED:** Uses `window.location.assign()` instead of axios, bypassing interceptor that caused logout bug.

### 2. Outlook OAuth Fix (Lines 561-568)
```javascript
const handleOutlookConnect = () => {
  setConnecting('outlook');
  console.log('🔐 Initiating Outlook OAuth via browser navigation...');
  
  // Direct browser navigation to backend OAuth endpoint
  // This bypasses axios interceptor and allows backend to handle OAuth flow
  window.location.assign(`${process.env.REACT_APP_BACKEND_URL}/api/auth/outlook/login?returnTo=/integrations`);
};
```
**✅ VERIFIED:** Uses `window.location.assign()` instead of axios, bypassing interceptor that caused logout bug.

### 3. HubSpot Merge Routing Fix (Lines 377-386, 532-536)
```javascript
// HubSpot configuration
{
  id: 'hubspot',
  name: 'HubSpot',
  description: 'Sync contacts, deals, and customer data',
  category: 'crm',
  logo: 'HS',
  color: '#FF7A59',
  tier: 'free',  // Changed from 'pro' - HubSpot connects via Merge.dev
  popular: true,
  viaMerge: true  // Indicates this integration uses Merge.dev
}

// handleConnect routing logic
if (integration.viaMerge) {
  openMergeLink();
  return;
}
```
**✅ VERIFIED:** HubSpot marked as `tier:'free'` with `viaMerge:true`, routes to `openMergeLink()` before tier checks.

### 4. Other Merge Integrations (Salesforce, Xero, QuickBooks)
**✅ VERIFIED:** All marked with `viaMerge:true` flag and route to Merge modal.

---

## 🧪 MANUAL TESTING REQUIRED

### Prerequisites
1. Open browser in **Incognito/Private mode** (to start fresh)
2. Open **Developer Console** (F12) before starting
3. Keep console open throughout all tests to capture logs

---

## TEST 1: Login Stability Check

### Steps:
1. Navigate to: https://boardroom-console.preview.emergentagent.com/
2. Click **"Log In"** button
3. Click **"Continue with Google"**
4. Complete Google OAuth login with: **andre@thestrategysquad.com.au**
5. Verify you land on **/advisor** or **/dashboard**
6. Navigate to: https://boardroom-console.preview.emergentagent.com/integrations
7. Wait 5 seconds

### Expected Results:
- ✅ You remain on **/integrations** page
- ✅ No automatic redirect to **/login-supabase**
- ✅ Session remains stable

### Failure Indicators:
- ❌ Redirected to **/login-supabase** = session instability

---

## TEST 2: Gmail Connection OAuth Flow (CRITICAL)

### Steps:
1. On **/integrations** page
2. Scroll to **Gmail** integration card
3. **Check button text:** Should say **"Connect"** (or "Disconnect" if already connected)
4. If button says **"Connect"**, click it
5. **Monitor console** for log: `🔐 Initiating Gmail OAuth via browser navigation...`
6. **Observe URL change**

### Expected Results:
- ✅ Console shows: `🔐 Initiating Gmail OAuth via browser navigation...`
- ✅ Browser navigates to: **accounts.google.com**
- ✅ **NO LOGOUT** - you are NOT redirected to **/login-supabase**
- ✅ Google OAuth screen appears

### Failure Indicators:
- ❌ Redirected to **/login-supabase** = **LOGOUT BUG NOT FIXED**
- ❌ Error message appears
- ❌ Page stays on **/integrations** without navigating

### Console Logs to Capture:
```
🔐 Initiating Gmail OAuth via browser navigation...
```

### Screenshot Requests:
1. Gmail card showing button
2. Console logs during click
3. Google OAuth screen (if successful)
4. Any error messages

---

## TEST 3: Outlook Connection OAuth Flow (CRITICAL)

### Steps:
1. Return to **/integrations** page (or refresh if still there)
2. Scroll to **Microsoft Outlook** integration card
3. **Check button text:** Should say **"Connect"** (or "Disconnect" if already connected)
4. If button says **"Connect"**, click it
5. **Monitor console** for log: `🔐 Initiating Outlook OAuth via browser navigation...`
6. **Observe URL change**

### Expected Results:
- ✅ Console shows: `🔐 Initiating Outlook OAuth via browser navigation...`
- ✅ Browser navigates to: **login.microsoftonline.com**
- ✅ **NO LOGOUT** - you are NOT redirected to **/login-supabase**
- ✅ Microsoft OAuth screen appears

### Failure Indicators:
- ❌ Redirected to **/login-supabase** = **LOGOUT BUG NOT FIXED**
- ❌ Error message appears
- ❌ Page stays on **/integrations** without navigating

### Console Logs to Capture:
```
🔐 Initiating Outlook OAuth via browser navigation...
```

### Screenshot Requests:
1. Outlook card showing button
2. Console logs during click
3. Microsoft OAuth screen (if successful)
4. Any error messages

---

## TEST 4: HubSpot Merge.dev Routing (CRITICAL)

### Steps:
1. Return to **/integrations** page
2. Scroll to **HubSpot** integration card
3. **Verify button text:** Should say **"Connect"** (NOT "Upgrade")
4. **Verify NO badge:** Should NOT have "Pro" or "Enterprise" badge
5. Click **"Connect"** button
6. **Monitor console** for log: `🔗 Opening Merge Link...`

### Expected Results:
- ✅ Button text: **"Connect"** (NOT "Upgrade")
- ✅ NO "Pro" or "Enterprise" badge
- ✅ Console shows: `🔗 Opening Merge Link...`
- ✅ Console shows: `✅ Session validated, requesting link token...`
- ✅ Console shows: `✅ Link token received: lt_xxxxx`
- ✅ Console shows: `✅ Merge Link modal opened`
- ✅ **Merge Link modal/iframe opens** showing list of providers
- ✅ You can search for "HubSpot" in the modal

### Failure Indicators:
- ❌ Button says **"Upgrade"** instead of "Connect"
- ❌ **"Upgrade to Pro"** modal appears
- ❌ Redirected to **/pricing** page
- ❌ Error message appears
- ❌ No modal opens

### Console Logs to Capture:
```
🔗 Opening Merge Link...
✅ Session validated, requesting link token...
✅ Link token received: lt_xxxxxxxxxxxxx
✅ Merge Link modal opened
```

### Screenshot Requests:
1. HubSpot card showing button (verify "Connect" text and no badge)
2. Console logs during click
3. Merge modal opening (if successful)
4. Any error messages or upgrade modal (if failed)

---

## TEST 5: Other Merge Integrations Routing

### Integrations to Test:
- **Salesforce**
- **Xero**
- **QuickBooks**

### Steps (for each integration):
1. Return to **/integrations** page
2. Scroll to integration card
3. Verify button says **"Connect"**
4. Click **"Connect"** button
5. Verify **Merge modal opens** (same modal as HubSpot)

### Expected Results:
- ✅ All three integrations open **Merge Link modal**
- ✅ NO upgrade modal appears
- ✅ Console shows Merge Link logs

### Failure Indicators:
- ❌ Upgrade modal appears
- ❌ Error message
- ❌ No modal opens

---

## 📊 SUMMARY REPORT FORMAT

After completing all tests, please provide:

### Gmail OAuth:
- **Logout occurred:** Yes/No
- **Navigated to Google:** Yes/No
- **Errors:** Yes/No (provide details)
- **Console logs:** (paste relevant logs)

### Outlook OAuth:
- **Logout occurred:** Yes/No
- **Navigated to Microsoft:** Yes/No
- **Errors:** Yes/No (provide details)
- **Console logs:** (paste relevant logs)

### HubSpot Routing:
- **Button text:** "Connect" or "Upgrade"?
- **Badge present:** Yes/No
- **Merge modal opened:** Yes/No
- **Upgrade modal appeared:** Yes/No
- **Console logs:** (paste relevant logs)

### Other Merge Integrations:
- **Salesforce:** Merge modal opened? Yes/No
- **Xero:** Merge modal opened? Yes/No
- **QuickBooks:** Merge modal opened? Yes/No

### Screenshots:
Please provide screenshots of:
1. HubSpot card showing button
2. Merge modal (if opened)
3. Console logs during tests
4. Any error messages or upgrade modals

---

## 🔍 WHAT TO LOOK FOR IN CONSOLE

### Success Indicators:
```
🔐 Initiating Gmail OAuth via browser navigation...
🔐 Initiating Outlook OAuth via browser navigation...
🔗 Opening Merge Link...
✅ Session validated, requesting link token...
✅ Link token received: lt_xxxxx
✅ Merge Link modal opened
```

### Failure Indicators:
```
❌ No active session found
❌ Session error
❌ Failed to get link token
❌ Backend error
[ProtectedRoute] Not authenticated, redirecting to login
```

---

## 🎯 CRITICAL SUCCESS CRITERIA

The OAuth stabilization is successful if:

1. ✅ **NO LOGOUT** occurs when clicking Gmail or Outlook "Connect" buttons
2. ✅ Gmail button navigates to **accounts.google.com**
3. ✅ Outlook button navigates to **login.microsoftonline.com**
4. ✅ HubSpot button opens **Merge modal** (NOT upgrade modal)
5. ✅ HubSpot button says **"Connect"** (NOT "Upgrade")
6. ✅ Salesforce, Xero, QuickBooks all open **Merge modal**

---

## 📝 NOTES

- **OAuth flows cannot be automated** - they require real Google/Microsoft account login
- **Merge modal** may appear as an iframe or overlay with provider selection
- If already connected, buttons may say "Disconnect" or "Test Connection" - this is expected
- Console logs are critical for debugging - please capture them
- Test in **Incognito/Private mode** for clean session state

---

## 🚨 IF TESTS FAIL

If any test fails, please provide:
1. **Exact error message** (from UI or console)
2. **Console logs** (full logs, not just errors)
3. **Screenshots** of the failure
4. **Network tab** (if you see 401/403 errors)
5. **Current URL** when failure occurs

This information will help diagnose the root cause.
