# Merge.dev Phase 1 - End-to-End Testing Guide

## ✅ Implementation Complete

All code has been implemented with proper timing guards and session validation.

---

## 🧪 Testing Instructions for User (andre.alexopoulos@gmail.com)

### Step 1: Log In
1. Navigate to: https://intel-pipeline.preview.emergentagent.com/login-supabase
2. Log in using your Google account (Continue with Google)
3. Wait for authentication to complete

### Step 2: Access Integrations Page
1. Navigate to: https://intel-pipeline.preview.emergentagent.com/integrations
2. You should see the Integrations page load successfully
3. Look for a **"Merge.dev Integration Test"** section at the top of the page
4. You will see a button labeled **"Test Merge Link Token"**

### Step 3: Run the Test
1. Open browser console (Press F12 → Console tab)
2. Click the **"Test Merge Link Token"** button
3. The button will show "Testing..." while running

### Step 4: Check Results

#### Expected Console Output:
```
🔍 Testing Merge.dev link token endpoint...
✅ Active session found with valid token
📊 Response Status: 200
📦 Response Data: {link_token: "lt_xxxxxxxxxxxxx"}
✅ SUCCESS! Link token: lt_xxxxxxxxxxxxx
```

#### Expected Toast Notification:
- Green success toast: **"Merge.dev link token retrieved successfully!"**

#### If There Are Errors:
- Console will show detailed error messages
- Toast will show error notification
- Share the full console output for debugging

---

## 🎯 Success Criteria

✅ Button click triggers the test  
✅ Console shows: "✅ Active session found with valid token"  
✅ HTTP Response Status: 200  
✅ Response contains `link_token` field  
✅ Toast notification appears  
✅ No console errors  
✅ No 401/403 authentication errors  

---

## 🔧 Implementation Details

### What Was Fixed:
1. **Removed auto-run on page load** - Test only runs when button is clicked
2. **Added session validation guards** - Multiple checks ensure session exists before accessing token
3. **Added explicit access_token check** - Ensures token is present before use
4. **Added loading state** - Button shows "Testing..." during execution
5. **Improved error handling** - Clear error messages for each failure scenario

### Code Location:
- File: `/app/frontend/src/pages/Integrations.js`
- Test Function: Lines 646-705
- Test Button: Lines 878-899

### Session Validation Flow:
```javascript
1. Button clicked
2. Get Supabase session
3. Check for sessionError → exit if error
4. Check session !== null → exit if null
5. Check session.access_token exists → exit if missing
6. Call backend endpoint with Bearer token
7. Show results
```

---

## 📋 What to Report

After testing, please share:

1. **Did the button appear?** (Yes/No)
2. **Console output** (copy full text from console)
3. **HTTP status code** (should be 200)
4. **Did you receive a link_token?** (Yes/No)
5. **Toast notification** (what message appeared?)
6. **Any errors?** (if yes, full error text)

---

## 🚀 Next Steps (After Successful Test)

Once the test succeeds:
1. ✅ Phase 1 is COMPLETE
2. Ready to proceed to Phase 2 (if required)
3. No further code changes needed for Phase 1

---

## ⚠️ Troubleshooting

### If button doesn't appear:
- Ensure you're logged in
- Check that you're on /integrations page
- Hard refresh (Ctrl+Shift+R)

### If test returns 401:
- Session may have expired
- Log out and log back in
- Try again

### If test returns 400:
- This was the original error (missing email field)
- Should be fixed now with email field added
- Share console output if this occurs

---

**Ready to test!** Please follow the steps above and report your results.
