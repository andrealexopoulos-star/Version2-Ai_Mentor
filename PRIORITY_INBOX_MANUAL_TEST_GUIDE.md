# Priority Inbox E2E Manual Testing Guide

## User Information
- **Test User**: andre.alexopoulos@gmail.com
- **Connected Provider**: Gmail
- **Application URL**: https://boardroom-console.preview.emergentagent.com
- **Test Page**: /email-inbox

---

## Pre-Test Verification Checklist

Before starting the test, verify the following:

- [ ] User andre.alexopoulos@gmail.com has successfully connected Gmail account
- [ ] User can log in to the application via Google OAuth
- [ ] Browser console is open (F12) to capture logs
- [ ] Network tab is open to monitor API calls

---

## Test Scenario 1: Navigate to Priority Inbox

### Steps:
1. Open browser and navigate to: https://boardroom-console.preview.emergentagent.com/login-supabase
2. Click "Continue with Google" button
3. Complete Google OAuth authentication
4. After successful login, navigate to: https://boardroom-console.preview.emergentagent.com/email-inbox

### Expected Results:
- ✅ Page loads without errors
- ✅ Page title shows "Priority Inbox"
- ✅ No red error screen
- ✅ No console errors in browser console

### What to Capture:
- Screenshot of the Priority Inbox page after loading
- Any console errors (if present)

---

## Test Scenario 2: Verify Gmail Connection Detection

### Steps:
1. On the Priority Inbox page, look for the Gmail badge
2. Check if your connected email address is displayed

### Expected Results:
- ✅ Gmail badge visible: "📧 Gmail" (blue badge near page title)
- ✅ Connected email address displayed (may be in UI or just in browser console logs)
- ✅ "Analyze Inbox" button is visible and enabled (not grayed out)
- ✅ NO "No Email Provider Connected" message

### What to Capture:
- Screenshot showing Gmail badge
- Console logs showing connection detection (look for "Querying email_connections" or "Email connection found")

---

## Test Scenario 3: Click Analyze Inbox Button

### Steps:
1. Click the "Analyze Inbox" button
2. Observe the loading state
3. Wait for analysis to complete (max 30 seconds)

### Expected Results:
- ✅ Button text changes to "Analyzing..." with spinner icon
- ✅ Button becomes disabled during analysis
- ✅ Toast notification appears: "Analyzing your inbox with AI... This may take a moment."
- ✅ Loading completes within 30 seconds

### What to Capture:
- Screenshot of loading state (button showing "Analyzing...")
- Console logs during analysis
- Network requests to Edge Function (look for `/functions/v1/email_priority?provider=gmail`)

---

## Test Scenario 4: Verify Email Categorization

### Steps:
1. After analysis completes, scroll through the page
2. Check for three priority sections: High Priority, Medium Priority, Low Priority
3. Expand each section by clicking on it

### Expected Results:
- ✅ Three priority sections visible:
  - **High Priority** (red icon, AlertCircle)
  - **Medium Priority** (yellow icon, Clock)
  - **Low Priority** (green icon, CheckCircle2)
- ✅ Each section shows email count (e.g., "5 emails need attention")
- ✅ Sections are collapsible/expandable
- ✅ At least some emails are displayed in one or more sections

### What to Capture:
- Screenshot showing all three priority sections
- Screenshot of expanded High Priority section with emails

---

## Test Scenario 5: Verify Email Display Fields

### Steps:
1. Expand the High Priority section
2. Look at the first email card
3. Verify all required fields are present

### Expected Results:
Each email card should display:
- ✅ **From address** (sender name or email)
- ✅ **Subject line** (email subject)
- ✅ **Email snippet/preview** (first few lines of email body)
- ✅ **Received date** (when email was received)
- ✅ **Priority reason** (why this email is high/medium/low priority)
- ✅ **Suggested action** (what to do with this email)

### What to Capture:
- Screenshot of a single email card showing all fields clearly
- Note if any fields are missing

---

## Test Scenario 6: Verify Strategic Insights

### Steps:
1. Scroll to the top of the page after analysis completes
2. Look for a blue/purple gradient banner with strategic insights

### Expected Results:
- ✅ Strategic Insights banner visible at top of page
- ✅ Banner has TrendingUp icon
- ✅ Banner contains text describing overall inbox insights
- ✅ Text is relevant to your emails (e.g., "Analyzed 20 Gmail messages. Prioritization based on recency and unread status.")

### What to Capture:
- Screenshot of Strategic Insights banner

---

## Test Scenario 7: Verify Success Toast

### Steps:
1. After analysis completes, look for a toast notification in the top-right corner

### Expected Results:
- ✅ Success toast appears: "Gmail inbox analyzed! Your emails are now prioritized."
- ✅ Toast has green checkmark icon
- ✅ Toast disappears after a few seconds

### What to Capture:
- Screenshot of success toast (if you can capture it before it disappears)
- Note if toast appeared or not

---

## Test Scenario 8: Check Console for Errors

### Steps:
1. Open browser console (F12)
2. Look for any errors, especially 401 authentication errors
3. Filter console by "error" to see only errors

### Expected Results:
- ✅ NO 401 errors (authentication errors)
- ✅ NO 403 errors (permission errors)
- ✅ NO 500 errors (server errors)
- ✅ Console logs show successful Edge Function execution

### Console Logs to Look For:
```
Querying email_connections for user: <user_id>
Email connection found: {provider: 'gmail', ...}
```

### What to Capture:
- Screenshot of console showing no errors
- Copy/paste any error messages if present

---

## Test Scenario 9: Check Edge Function Logs

### Steps:
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to: Edge Functions → email_priority → Logs
3. Look for recent logs from your test

### Expected Logs:
```
🚀 [EDGE] email_priority invoked for provider: gmail
✅ User verified: andre.alexopoulos@gmail.com
📧 Processing Gmail...
🤖 Prioritizing 20 emails...
✅ Priority analysis complete
```

### What to Capture:
- Screenshot of Edge Function logs showing successful execution
- Note the timestamp to confirm it matches your test time

---

## Test Scenario 10: Verify Network Requests

### Steps:
1. Open browser Network tab (F12 → Network)
2. Filter by "email_priority" or "functions"
3. Look for the Edge Function request

### Expected Results:
- ✅ POST request to: `https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/email_priority?provider=gmail`
- ✅ Request has Authorization header with Bearer token
- ✅ Response status: 200 OK
- ✅ Response body contains: `{ok: true, provider: "gmail", high_priority: [...], medium_priority: [...], low_priority: [...], strategic_insights: "...", total_analyzed: 20}`

### What to Capture:
- Screenshot of Network tab showing the Edge Function request
- Screenshot of Response body (if possible)

---

## Common Issues and Troubleshooting

### Issue 1: "No Email Provider Connected" message appears
**Cause**: Gmail connection not detected in `email_connections` table
**Solution**: 
1. Go to /integrations page
2. Click "Connect" on Gmail card
3. Complete OAuth flow
4. Return to /email-inbox and retry

### Issue 2: 401 Authentication Error
**Cause**: User session expired or invalid
**Solution**:
1. Log out and log back in via Google OAuth
2. Clear browser cache and cookies
3. Retry test

### Issue 3: Analysis takes longer than 30 seconds
**Cause**: Large inbox or slow API response
**Solution**:
1. Wait up to 60 seconds
2. Check Edge Function logs for errors
3. Check Gmail API quota limits

### Issue 4: No emails displayed after analysis
**Cause**: Empty inbox or API error
**Solution**:
1. Check browser console for errors
2. Check Edge Function logs for error messages
3. Verify Gmail connection has valid access token

---

## Test Results Summary

After completing all test scenarios, fill out this summary:

### Overall Test Result:
- [ ] ✅ PASS - All scenarios passed
- [ ] ⚠️ PARTIAL - Some scenarios passed, some failed
- [ ] ❌ FAIL - Critical scenarios failed

### Scenarios Passed:
- [ ] Navigate to Priority Inbox
- [ ] Verify Gmail Connection Detection
- [ ] Click Analyze Inbox Button
- [ ] Verify Email Categorization
- [ ] Verify Email Display Fields
- [ ] Verify Strategic Insights
- [ ] Verify Success Toast
- [ ] Check Console for Errors
- [ ] Check Edge Function Logs
- [ ] Verify Network Requests

### Issues Found:
(List any issues, errors, or unexpected behavior)

1. 
2. 
3. 

### Screenshots Captured:
- [ ] Priority Inbox page after loading
- [ ] Gmail badge visible
- [ ] Loading state (Analyzing...)
- [ ] Three priority sections
- [ ] Email card with all fields
- [ ] Strategic Insights banner
- [ ] Success toast (if captured)
- [ ] Console showing no errors
- [ ] Edge Function logs
- [ ] Network tab with Edge Function request

---

## Reporting Results

Please provide the following to the development team:

1. **Test Results Summary** (from above)
2. **All screenshots** captured during testing
3. **Console logs** (copy/paste from browser console)
4. **Edge Function logs** (from Supabase Dashboard)
5. **Network requests** (screenshot or HAR file export)
6. **Any error messages** encountered
7. **Overall feedback** on Priority Inbox functionality

---

## Expected Timeline

- **Test Duration**: 15-20 minutes
- **Analysis Time**: 10-30 seconds per analysis
- **Total Time**: ~30 minutes including documentation

---

## Contact

If you encounter any issues or have questions during testing, please:
1. Document the issue with screenshots
2. Note the exact steps that led to the issue
3. Check browser console and Edge Function logs
4. Report findings to the development team

---

**Thank you for testing the Priority Inbox feature!**
