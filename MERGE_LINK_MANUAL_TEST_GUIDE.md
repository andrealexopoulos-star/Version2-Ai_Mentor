# Merge Link Integration - Manual Testing Guide

## Test Objective
Verify Merge Link modal opens using the React hook pattern (@mergeapi/react-merge-link@2.2.3)

## Prerequisites
- User: **andre.alexopoulos@gmail.com**
- Browser: Chrome, Firefox, or Safari (latest version)
- Internet connection

---

## Test Steps

### Step 1: Log In
1. Navigate to: https://biqc-integrity.preview.emergentagent.com/login-supabase
2. Log in with your credentials (andre.alexopoulos@gmail.com)
3. Complete OAuth authentication if prompted
4. Verify you're redirected to the dashboard or advisor page

### Step 2: Navigate to Integrations Page
1. Click on "Integrations" in the sidebar navigation
2. OR directly navigate to: https://biqc-integrity.preview.emergentagent.com/integrations
3. Wait for the page to fully load

### Step 3: Open Browser Console
1. Press `F12` (Windows/Linux) or `Cmd+Option+I` (Mac) to open Developer Tools
2. Click on the "Console" tab
3. Keep this open to monitor console logs during testing

### Step 4: Locate Merge Integration Card
1. Scroll down to find the **"Merge Unified Integrations"** card
2. This card should have:
   - A purple/indigo gradient background
   - Title: "Merge Unified Integrations"
   - Description: "Connect to 200+ business tools through a single unified integration"
   - Tags: Accounting, CRM, HRIS, ATS
   - Button: **"Connect via Merge"**

### Step 5: Click "Connect via Merge" Button
1. Click the **"Connect via Merge"** button
2. The button should change to show "Opening Merge..." with a loading spinner

### Step 6: Monitor Console Logs
Watch for these console messages in order:

✅ **Expected Console Logs:**
```
🔗 Opening Merge Link...
✅ Session validated, requesting link token...
✅ Link token received: lt_xxxxxxxxxxxxx
✅ Merge Link modal opened
```

❌ **Error Scenarios:**
- If you see "❌ No active session found" → You're not logged in properly
- If you see "❌ Backend error" → Backend API issue (check Network tab)
- If you see "❌ Merge Link not ready" → Hook initialization issue

### Step 7: Verify Merge Link Modal Opens
1. A modal/dialog should appear on the screen
2. The modal should display:
   - Merge.dev branding
   - A list of integration providers (e.g., QuickBooks, Xero, Salesforce, etc.)
   - Search functionality to find providers
   - Categories to filter providers

### Step 8: Select a Sandbox Provider
1. In the Merge Link modal, look for any provider marked as "Sandbox" or "Test"
2. Click on a sandbox provider (e.g., "QuickBooks Sandbox", "Xero Sandbox")
3. You should be redirected to a sandbox authentication page

### Step 9: Complete Sandbox Authentication
1. Follow the sandbox provider's authentication flow
2. Use test credentials if provided by the sandbox
3. Grant permissions when prompted
4. You should be redirected back to the BIQC application

### Step 10: Verify onSuccess Callback
After completing authentication, check the console for:

✅ **Expected Console Logs:**
```
✅ Merge onboarding success
📦 Public Token: pt_xxxxxxxxxxxxx
```

### Step 11: Verify Toast Notification
1. A toast notification should appear in the top-right corner
2. Message: **"Integration connected successfully!"**
3. The toast should be green/success colored

### Step 12: Verify No Token Storage
1. Open the "Application" tab in Developer Tools
2. Check "Local Storage" and "Session Storage"
3. Verify that the public_token is **NOT stored** (only logged to console)

---

## Expected Results Summary

| Test Step | Expected Result | Status |
|-----------|----------------|--------|
| 1. Login | Successfully authenticated | ⬜ |
| 2. Navigate to /integrations | Page loads without errors | ⬜ |
| 3. Merge card visible | Card displays with correct content | ⬜ |
| 4. Button visible | "Connect via Merge" button present | ⬜ |
| 5. Button clickable | Button responds to click | ⬜ |
| 6. Loading state | Button shows "Opening Merge..." | ⬜ |
| 7. Console: Opening Merge | Log appears | ⬜ |
| 8. Console: Session validated | Log appears | ⬜ |
| 9. Console: Link token received | Log appears with token | ⬜ |
| 10. Backend returns 200 | Check Network tab | ⬜ |
| 11. Merge modal opens | Modal displays provider list | ⬜ |
| 12. Provider selection | Can click on provider | ⬜ |
| 13. Sandbox auth | Redirects to provider auth | ⬜ |
| 14. onSuccess fires | Console shows success message | ⬜ |
| 15. Public token logged | Console shows token | ⬜ |
| 16. Toast notification | Success toast appears | ⬜ |
| 17. No token stored | Token not in storage | ⬜ |

---

## Troubleshooting

### Issue: Not Authenticated
**Symptom:** Redirected to /login-supabase when accessing /integrations

**Solution:**
1. Log in at https://biqc-integrity.preview.emergentagent.com/login-supabase
2. Complete OAuth authentication
3. Try accessing /integrations again

### Issue: Backend Returns Error
**Symptom:** Console shows "❌ Backend error" or Network tab shows 500/403 error

**Solution:**
1. Check Network tab for the request to `/api/integrations/merge/link-token`
2. Look at the response body for error details
3. Verify you're logged in (check for Authorization header in request)
4. Report the error message to the development team

### Issue: Merge Modal Doesn't Open
**Symptom:** Console shows "✅ Link token received" but modal doesn't appear

**Possible Causes:**
1. Modal rendering delay (wait 2-3 seconds)
2. Modal rendered outside viewport (try scrolling)
3. useMergeLink hook not triggering openMergeLinkModal()
4. Browser popup blocker (check browser settings)

**Solution:**
1. Wait a few seconds after clicking the button
2. Check browser console for any JavaScript errors
3. Try disabling browser extensions temporarily
4. Report the issue with console logs and screenshots

### Issue: onSuccess Doesn't Fire
**Symptom:** Completed sandbox auth but no success message in console

**Possible Causes:**
1. Sandbox authentication failed
2. Callback not properly configured
3. Network issue during token exchange

**Solution:**
1. Try a different sandbox provider
2. Check Network tab for failed requests
3. Report the issue with console logs

---

## Alternative Testing Method

If the UI test fails, you can test the backend endpoint directly:

### Browser Console Test
```javascript
// Get your session token
const session = JSON.parse(localStorage.getItem('sb-uxyqpdfftxpkzeppqtvk-auth-token'));
const token = session.access_token;

// Call the backend endpoint
fetch('https://biqc-integrity.preview.emergentagent.com/api/integrations/merge/link-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Backend Response:', data);
  if (data.link_token) {
    console.log('✅ Link Token:', data.link_token);
  }
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Response:**
```json
{
  "link_token": "lt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

---

## Reporting Results

After completing the test, please report:

1. **Overall Status:** ✅ Success / ⚠️ Partial Success / ❌ Failed
2. **Which steps passed/failed** (use the checklist above)
3. **Console logs** (copy all Merge-related logs)
4. **Screenshots:**
   - Merge Unified Integrations card
   - Merge Link modal (if it opens)
   - Console logs
   - Toast notification (if it appears)
5. **Any error messages** encountered
6. **Browser and OS** used for testing

---

## Technical Details

### Frontend Implementation
- **File:** `/app/frontend/src/pages/Integrations.js`
- **Hook:** `useMergeLink` from `@mergeapi/react-merge-link@2.2.3`
- **Function:** `openMergeLink()` (lines 732-811)
- **Button:** Lines 1029-1046

### Backend Implementation
- **File:** `/app/backend/server.py`
- **Endpoint:** `POST /api/integrations/merge/link-token` (lines 7317-7349)
- **Authentication:** Required (Supabase session token)
- **Merge API:** `https://api.merge.dev/api/integrations/create-link-token`

### Environment Variables
- **Backend:** `MERGE_API_KEY` (configured in `/app/backend/.env`)
- **Frontend:** `REACT_APP_BACKEND_URL` (configured in `/app/frontend/.env`)

---

## Success Criteria

The integration is considered **fully functional** if:

1. ✅ "Connect via Merge" button is visible and clickable
2. ✅ Button shows "Opening Merge..." loading state
3. ✅ Backend returns HTTP 200 with link_token
4. ✅ All expected console logs appear in order
5. ✅ Merge Link modal opens with provider selection screen
6. ✅ Can select and authenticate with a sandbox provider
7. ✅ onSuccess callback fires with console logs
8. ✅ public_token is logged to console
9. ✅ Toast notification appears with success message
10. ✅ No errors in console or Network tab

---

## Contact

If you encounter any issues or have questions, please provide:
- Screenshots of the issue
- Console logs (full output)
- Network tab requests/responses
- Steps to reproduce the issue

This will help the development team diagnose and fix any problems quickly.
