# Merge.dev Integration Endpoint - Manual Testing Guide

## Test Objective
Verify that the Merge.dev link token endpoint works end-to-end with proper Supabase authentication for user: **andre.alexopoulos@gmail.com**

## What Has Been Verified ✅

### 1. Frontend Implementation (Integrations.js lines 645-708)
- ✅ Test function `testMergeLinkToken()` properly implemented
- ✅ Gets Supabase session using `supabase.auth.getSession()`
- ✅ Calls backend endpoint with Bearer token authentication
- ✅ Logs detailed console messages for debugging
- ✅ Shows toast notifications for success/failure
- ✅ Auto-executes on component mount (once per session via sessionStorage)

### 2. Backend Endpoint (server.py line 7317)
- ✅ Endpoint exists: `POST /api/integrations/merge/link-token`
- ✅ Properly protected with authentication (returns 403 without token)
- ✅ MERGE_API_KEY configured in environment
- ✅ Correct implementation:
  - Checks for MERGE_API_KEY
  - Calls Merge.dev API: `https://api.merge.dev/api/integrations/create-link-token`
  - Sends user_id, email, organization name, and categories
  - Returns `{link_token: "lt_xxxxx"}`

### 3. User Account
- ✅ User andre.alexopoulos@gmail.com exists in Supabase
- ✅ User has successfully authenticated in the past (confirmed in backend logs)
- ✅ User is a legacy MongoDB user with existing profile

### 4. Infrastructure
- ✅ Backend is healthy and running
- ✅ Frontend routes correctly to /integrations
- ✅ Protected route authentication working (redirects to login when not authenticated)

## Manual Testing Instructions

### Step 1: Log In
1. Open browser and navigate to: https://ai-strategic-hub.preview.emergentagent.com/login-supabase
2. Log in using one of these methods:
   - **Google OAuth**: Click "Continue with Google" and use andre.alexopoulos@gmail.com
   - **Microsoft OAuth**: Click "Continue with Microsoft" and use andre.alexopoulos@gmail.com
   - **Email/Password**: If you have password credentials

### Step 2: Navigate to Integrations Page
1. After successful login, navigate to: https://ai-strategic-hub.preview.emergentagent.com/integrations
2. The page should load without redirecting to login

### Step 3: Open Browser Console
1. Open browser Developer Tools (F12 or Right-click → Inspect)
2. Go to the **Console** tab
3. Clear any existing logs for clarity

### Step 4: Check for Test Execution
The test should run automatically when the page loads. Look for these console messages:

**Expected Console Output (Success):**
```
🔍 Testing Merge.dev link token endpoint...
✅ Active session found
📊 Response Status: 200
📦 Response Data: {link_token: "lt_xxxxxxxxxxxxx"}
✅ SUCCESS! Link token: lt_xxxxxxxxxxxxx
```

**Expected Console Output (Failure):**
```
🔍 Testing Merge.dev link token endpoint...
❌ No active session: [error details]
```
OR
```
🔍 Testing Merge.dev link token endpoint...
✅ Active session found
📊 Response Status: [non-200 status]
❌ Failed: [error details]
```

### Step 5: Check Toast Notification
- **Success**: You should see a green toast notification: "Merge.dev link token retrieved successfully!"
- **Failure**: You should see a red toast notification with error details

### Step 6: Verify Network Request (Optional)
1. Go to the **Network** tab in Developer Tools
2. Filter by "merge" or "link-token"
3. Look for: `POST /api/integrations/merge/link-token`
4. Check:
   - Request Headers should include: `Authorization: Bearer [token]`
   - Response Status should be: `200`
   - Response Body should contain: `{"link_token": "lt_xxxxxxxxxxxxx"}`

### Step 7: Force Re-run Test (If Needed)
If the test doesn't run automatically (because it already ran in this session):

1. Open browser console
2. Clear sessionStorage flag:
   ```javascript
   sessionStorage.removeItem('merge_test_run');
   ```
3. Refresh the page (F5)
4. The test should run again

### Step 8: Manual API Test (Alternative Method)
If you want to test the API directly from console:

```javascript
// Get current session token
const token = JSON.parse(localStorage.getItem('sb-uxyqpdfftxpkzeppqtvk-auth-token')).access_token;

// Call API
fetch('https://ai-strategic-hub.preview.emergentagent.com/api/integrations/merge/link-token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Response:', data);
  if (data.link_token) {
    console.log('✅ SUCCESS! Link token:', data.link_token);
  } else {
    console.error('❌ No link token in response');
  }
})
.catch(err => console.error('❌ Error:', err));
```

## Expected Results

### Success Criteria ✅
- Console shows: "✅ SUCCESS! Link token: lt_xxxxxxxxxxxxx"
- HTTP Response Status: `200`
- Response contains valid `link_token` string starting with "lt_"
- Toast notification appears: "Merge.dev link token retrieved successfully!"
- No console errors
- No 401/403 authentication errors

### Failure Indicators ❌
- Console shows: "❌ No active session" → User not authenticated
- Console shows: "❌ Failed" → Backend or Merge.dev API error
- HTTP Response Status: `401` or `403` → Authentication issue
- HTTP Response Status: `500` → Backend error
- HTTP Response Status: `4xx` from Merge.dev → API configuration issue
- No link_token in response → Merge.dev API error

## What to Report Back

Please provide the following information:

1. **Was the test function called automatically?**
   - Yes/No
   - If no, did you see any console errors?

2. **What was the HTTP response status?**
   - 200, 401, 403, 500, or other?

3. **Did the response contain a link_token?**
   - Yes/No
   - If yes, what was the format? (e.g., "lt_xxxxxxxxxxxxx")

4. **Full console output related to Merge test**
   - Copy all console messages containing "Merge", "link token", or "merge.dev"

5. **Any errors encountered?**
   - Console errors
   - Network errors
   - Toast error messages

6. **Screenshots (if possible)**
   - Browser console showing test execution
   - Network tab showing API request/response
   - Toast notification (if visible)

## Troubleshooting

### Issue: Test doesn't run automatically
**Solution**: 
- Check if sessionStorage flag is set: `sessionStorage.getItem('merge_test_run')`
- If it returns "true", clear it: `sessionStorage.removeItem('merge_test_run')`
- Refresh the page

### Issue: "No active session" error
**Solution**:
- You're not logged in
- Log out and log back in
- Check if session exists: `localStorage.getItem('sb-uxyqpdfftxpkzeppqtvk-auth-token')`

### Issue: 401/403 authentication error
**Solution**:
- Session token may be expired
- Log out and log back in
- Try the manual API test method to verify token

### Issue: 500 backend error
**Solution**:
- Check backend logs for detailed error
- Verify MERGE_API_KEY is configured
- Contact support with error details

## Technical Details

### Frontend Code Location
- File: `/app/frontend/src/pages/Integrations.js`
- Lines: 645-708
- Function: `testMergeLinkToken()`

### Backend Code Location
- File: `/app/backend/server.py`
- Line: 7317
- Endpoint: `POST /api/integrations/merge/link-token`

### Environment Variables
- Frontend: `REACT_APP_BACKEND_URL=https://ai-strategic-hub.preview.emergentagent.com`
- Backend: `MERGE_API_KEY=7JIdThF2Hd92_B_rmlRWI8djXlCHeI0bJ6LhQfWdL0mge4mYt9l9cw`

### Merge.dev API Endpoint
- URL: `https://api.merge.dev/api/integrations/create-link-token`
- Method: POST
- Authentication: Bearer token (MERGE_API_KEY)
- Categories: accounting, crm, hris, ats

---

**Note**: This test is designed to verify the complete integration flow from frontend → backend → Merge.dev API. All code implementation has been verified as correct. The only remaining step is to test with an authenticated user session.
