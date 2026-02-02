# HubSpot CRM Data Fetching Test Guide
## Manual Testing Instructions for andre@thestrategysquad.com.au

---

## 🎯 Test Objective
Verify that all 4 CRM endpoints successfully fetch real HubSpot data via Merge.dev Unified API.

---

## ✅ Infrastructure Verification (Already Completed)

The following has been verified by the testing agent:

1. **User Account**: ✅
   - Email: andre@thestrategysquad.com.au
   - User ID: c80b456f-1e3e-4a07-ac89-68eec7355e3b
   - Created: 2026-01-23

2. **Workspace**: ✅
   - Account ID: 00000000-0000-0000-0000-000000000001
   - Name: Default Workspace

3. **HubSpot Integration**: ✅
   - Provider: HubSpot
   - Category: crm
   - Has Account Token: Yes
   - Token: 0b1-LJ48DTvYSoS_6btI... (valid)

4. **Backend Endpoints**: ✅
   - GET /api/integrations/crm/contacts (implemented)
   - GET /api/integrations/crm/companies (implemented)
   - GET /api/integrations/crm/deals (implemented)
   - GET /api/integrations/crm/owners (implemented)

5. **Code Quality**: ✅
   - Proper authentication required
   - Workspace-scoped integration
   - Error handling (401, 409, 502)
   - Pagination support
   - Comprehensive logging

---

## 📋 Manual Testing Steps

### Step 1: Log In
1. Navigate to: https://biqc-advisor.preview.emergentagent.com/login-supabase
2. Click "Continue with Google"
3. Sign in with: andre@thestrategysquad.com.au

### Step 2: Open Browser Console
1. Press F12 (or Cmd+Option+I on Mac)
2. Click on the "Console" tab
3. Clear any existing messages

### Step 3: Run Test Commands

Copy and paste each test command below into the browser console and press Enter.

#### Test 1: Fetch Contacts (Default Page Size = 100)
```javascript
fetch('https://biqc-advisor.preview.emergentagent.com/api/integrations/crm/contacts', {
  headers: {
    'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sb-uxyqpdfftxpkzeppqtvk-auth-token')).access_token
  }
})
.then(r => {
  console.log('📊 Response Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('✅ TEST 1: Contacts (default page_size)');
  console.log('   Results count:', data.results?.length);
  console.log('   Has "next" field:', 'next' in data);
  console.log('   Has "previous" field:', 'previous' in data);
  console.log('   Sample contact:', data.results?.[0]);
  console.log('   Full response:', data);
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Result:**
- Status: 200
- Results array with contacts
- Pagination fields (next, previous)
- Sample contact data with fields like: id, first_name, last_name, email_addresses

---

#### Test 2: Fetch Contacts (Custom Page Size = 10)
```javascript
fetch('https://biqc-advisor.preview.emergentagent.com/api/integrations/crm/contacts?page_size=10', {
  headers: {
    'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sb-uxyqpdfftxpkzeppqtvk-auth-token')).access_token
  }
})
.then(r => {
  console.log('📊 Response Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('✅ TEST 2: Contacts (page_size=10)');
  console.log('   Results count:', data.results?.length);
  console.log('   Page size respected:', data.results?.length <= 10 ? 'YES ✅' : 'NO ❌');
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Result:**
- Status: 200
- Results array with ≤10 contacts
- Page size parameter respected

---

#### Test 3: Fetch Companies
```javascript
fetch('https://biqc-advisor.preview.emergentagent.com/api/integrations/crm/companies', {
  headers: {
    'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sb-uxyqpdfftxpkzeppqtvk-auth-token')).access_token
  }
})
.then(r => {
  console.log('📊 Response Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('✅ TEST 3: Companies');
  console.log('   Results count:', data.results?.length);
  console.log('   Sample company:', data.results?.[0]);
  console.log('   Full response:', data);
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Result:**
- Status: 200
- Results array with companies
- Sample company data with fields like: id, name, domain

---

#### Test 4: Fetch Deals
```javascript
fetch('https://biqc-advisor.preview.emergentagent.com/api/integrations/crm/deals', {
  headers: {
    'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sb-uxyqpdfftxpkzeppqtvk-auth-token')).access_token
  }
})
.then(r => {
  console.log('📊 Response Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('✅ TEST 4: Deals');
  console.log('   Results count:', data.results?.length);
  console.log('   Sample deal:', data.results?.[0]);
  console.log('   Full response:', data);
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Result:**
- Status: 200
- Results array with deals/opportunities
- Sample deal data with fields like: id, name, amount, stage

---

#### Test 5: Fetch Owners
```javascript
fetch('https://biqc-advisor.preview.emergentagent.com/api/integrations/crm/owners', {
  headers: {
    'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sb-uxyqpdfftxpkzeppqtvk-auth-token')).access_token
  }
})
.then(r => {
  console.log('📊 Response Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('✅ TEST 5: Owners');
  console.log('   Results count:', data.results?.length);
  console.log('   Sample owner:', data.results?.[0]);
  console.log('   Full response:', data);
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Result:**
- Status: 200
- Results array with CRM users/owners
- Sample owner data with fields like: id, name, email

---

#### Test 6: Error Handling (Invalid Token)
```javascript
fetch('https://biqc-advisor.preview.emergentagent.com/api/integrations/crm/contacts', {
  headers: {
    'Authorization': 'Bearer invalid_token_12345'
  }
})
.then(r => {
  console.log('📊 Response Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('✅ TEST 6: Error Handling');
  console.log('   Expected 401:', r.status === 401 ? 'YES ✅' : 'NO ❌');
  console.log('   Error response:', data);
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Result:**
- Status: 401 Unauthorized
- Error message: "Invalid token"

---

## 📊 Success Criteria

All tests should pass with the following results:

- ✅ Test 1: Contacts (default) - 200 OK, results array, pagination fields
- ✅ Test 2: Contacts (page_size=10) - 200 OK, ≤10 records
- ✅ Test 3: Companies - 200 OK, results array
- ✅ Test 4: Deals - 200 OK, results array
- ✅ Test 5: Owners - 200 OK, results array
- ✅ Test 6: Error handling - 401 Unauthorized

---

## 🔍 Backend Logs Verification

After running the tests, check backend logs to verify proper logging:

```bash
tail -n 100 /var/log/supervisor/backend.*.log | grep -E '(📇|📡|📊|✅|❌)' | grep -i crm
```

**Expected Log Messages:**
```
📇 Fetching CRM contacts for workspace: Default Workspace
📡 Merge API: GET /crm/v1/contacts
📊 Merge API response: 200
✅ Retrieved X contacts
```

---

## 📝 What to Report

Please provide the following:

1. **Console Output**: Screenshot or copy-paste of all test results from browser console
2. **Backend Logs**: Output from the backend logs command above
3. **Data Verification**: Confirm if the data returned matches what's in your HubSpot account
4. **Any Errors**: Full error messages if any test fails

---

## ❓ Troubleshooting

### If you get 401 Unauthorized:
- Make sure you're logged in
- Try refreshing the page and logging in again
- Check if localStorage has the auth token: `localStorage.getItem('sb-uxyqpdfftxpkzeppqtvk-auth-token')`

### If you get 409 IntegrationNotConnected:
- The HubSpot integration may have been disconnected
- Go to /integrations page and reconnect HubSpot

### If you get 502 IntegrationUpstreamError:
- Merge.dev service may be experiencing issues
- Wait a few minutes and try again
- Check Merge.dev status page

---

## 📞 Support

If you encounter any issues or have questions, please provide:
- Screenshots of console output
- Backend logs
- Exact error messages
- Steps you took before the error occurred

---

**Testing Agent**: Ready for manual testing
**Date**: 2026-01-23
**Status**: Infrastructure verified ✅, awaiting manual test results
