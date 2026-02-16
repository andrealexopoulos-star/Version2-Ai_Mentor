# HubSpot Merge.dev Routing - Manual Testing Guide

## Test Objective
Verify that clicking "Connect" on HubSpot card now opens the Merge Link modal instead of showing an upgrade modal.

## Test Credentials
- **Email:** andre@thestrategysquad.com.au
- **Login Method:** Google OAuth

## Code Implementation Verification ✅

### 1. HubSpot Configuration (Integrations.js lines 377-386)
```javascript
{
  id: 'hubspot',
  name: 'HubSpot',
  description: 'Sync contacts, deals, and customer data',
  category: 'crm',
  logo: 'HS',
  color: '#FF7A59',
  tier: 'free',  // ✅ Changed from 'pro' - HubSpot connects via Merge.dev
  popular: true,
  viaMerge: true  // ✅ Indicates this integration uses Merge.dev
}
```
**Status:** ✅ CORRECT - HubSpot is marked as `tier: 'free'` with `viaMerge: true`

### 2. handleConnect Routing Logic (Integrations.js lines 519-559)
```javascript
const handleConnect = (integration) => {
  // Special handling for Outlook
  if (integration.isOutlook || integration.id === 'outlook') {
    handleOutlookConnect();
    return;
  }
  
  // Special handling for Gmail
  if (integration.isGmail || integration.id === 'gmail') {
    handleGmailConnect();
    return;
  }
  
  // ✅ Special handling for Merge.dev integrations (HubSpot, Salesforce, Xero, QuickBooks, etc.)
  if (integration.viaMerge) {
    openMergeLink();  // ✅ Routes to Merge Link modal
    return;
  }
  
  // Upgrade modal logic (should NOT be reached for HubSpot)
  if (integration.tier === 'enterprise') {
    setShowModal({ type: 'enterprise', integration });
  } else if (integration.tier === 'pro') {
    setShowModal({ type: 'upgrade', integration });
  } else {
    // Free tier - show connecting flow
    setConnecting(integration.id);
    setTimeout(() => {
      setConnecting(null);
      setShowModal({ type: 'coming-soon', integration });
    }, 1500);
  }
};
```
**Status:** ✅ CORRECT - `viaMerge` integrations are routed to `openMergeLink()` before tier checks

### 3. Button Text Logic (Integrations.js line 1258)
```javascript
{isConnected ? (
  <>
    <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
    <span className="hidden sm:inline">Connected</span>
    <span className="sm:hidden">✓</span>
  </>
) : needsReconnect ? (
  <>
    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
    <span>Reconnect</span>
  </>
) : connecting === integration.id ? (
  <span className="animate-pulse">Connecting...</span>
) : (
  integration.tier === 'free' ? 'Connect' : 'Upgrade'  // ✅ Shows 'Connect' for free tier
)}
```
**Status:** ✅ CORRECT - Free tier integrations show "Connect" button

### 4. openMergeLink Function (Integrations.js lines 791-870)
```javascript
const openMergeLink = async () => {
  try {
    setOpeningMergeLink(true);
    console.log('🔗 Opening Merge Link...');  // ✅ Expected console log
    
    // Step 1: Get active Supabase session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // ... validation ...
    
    console.log('✅ Session validated, requesting link token...');
    
    // Step 2: Call backend to get link_token
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/integrations/merge/link-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    // ... error handling ...
    
    const { link_token } = await response.json();
    console.log('✅ Link token received:', link_token);
    
    // Step 3: Set link token and trigger modal
    setMergeLinkToken(link_token);
    
    // Step 4: Open modal after token is set
    setTimeout(() => {
      if (mergeLinkReady) {
        openMergeLinkModal();
        console.log('✅ Merge Link modal opened');  // ✅ Expected console log
      }
      setOpeningMergeLink(false);
    }, 100);
    
  } catch (error) {
    console.error('❌ Error opening Merge Link:', error);
    toast.error('Failed to open Merge Link');
    setOpeningMergeLink(false);
  }
};
```
**Status:** ✅ CORRECT - Comprehensive logging and error handling

## Manual Testing Steps

### Pre-Test Verification
1. ✅ Code review confirms HubSpot is `tier: 'free'` with `viaMerge: true`
2. ✅ Code review confirms `handleConnect` routes `viaMerge` to `openMergeLink()`
3. ✅ Code review confirms button text shows "Connect" for free tier
4. ✅ Code review confirms `openMergeLink()` has comprehensive logging

### Test Procedure

#### Step 1: Login
1. Navigate to: https://beta-ready-deploy.preview.emergentagent.com/login-supabase
2. Click "Continue with Google"
3. Login with: **andre@thestrategysquad.com.au**
4. Verify successful login and redirect

#### Step 2: Navigate to Integrations
1. Navigate to: https://beta-ready-deploy.preview.emergentagent.com/integrations
2. Verify page loads successfully
3. **OPEN BROWSER CONSOLE** (F12 → Console tab) - CRITICAL for debugging

#### Step 3: Locate HubSpot Card
1. Look for HubSpot integration card in the grid
2. **Verify the following:**
   - ✅ Name: "HubSpot"
   - ✅ Description: "Sync contacts, deals, and customer data"
   - ✅ Category: CRM (filter by CRM to confirm)
   - ✅ Button text: **"Connect"** (NOT "Upgrade")
   - ✅ No "Pro" or "Enterprise" badge visible

#### Step 4: Click Connect Button (CRITICAL TEST)
1. Click the **"Connect"** button on HubSpot card
2. **Monitor console logs** - you should see:
   ```
   🔗 Opening Merge Link...
   ✅ Session validated, requesting link token...
   ✅ Link token received: lt_xxxxxxxxxxxxx
   ✅ Merge Link modal opened
   ```

#### Step 5: Verify Merge Modal Opens
1. **Expected:** Merge Link modal/iframe should open
2. **Expected:** Modal shows "Connect to 200+ business tools" or similar Merge branding
3. **Expected:** HubSpot appears in the provider list
4. **NOT Expected:** "Upgrade to Pro" modal should NOT appear

#### Step 6: Verify Other Merge Integrations
Test the same flow for other Merge integrations:
- Salesforce (CRM)
- Xero (Financial)
- QuickBooks (Financial)
- Pipedrive (CRM)

All should:
- Show "Connect" button (not "Upgrade")
- Open Merge Link modal when clicked
- NOT show upgrade modal

#### Step 7: Verify Direct OAuth Integrations Still Work
Test that Gmail and Outlook still use their direct OAuth flows:
- Gmail: Should redirect to Google OAuth (NOT Merge)
- Outlook: Should redirect to Microsoft OAuth (NOT Merge)

## Expected Console Logs

### Success Flow:
```
🔗 Opening Merge Link...
✅ Session validated, requesting link token...
📊 Response Status: 200
✅ Link token received: lt_xxxxxxxxxxxxx
✅ Merge Link modal opened
```

### If Upgrade Modal Appears (BUG):
```
(No Merge-related logs)
```
This would indicate `handleConnect` is routing to upgrade modal instead of `openMergeLink()`

## Success Criteria

### ✅ PASS Conditions:
1. HubSpot card shows "Connect" button (not "Upgrade")
2. No "Pro" or "Enterprise" badge on HubSpot card
3. Clicking "Connect" triggers console log: `🔗 Opening Merge Link...`
4. Merge Link modal opens successfully
5. HubSpot appears in Merge provider list
6. No "Upgrade to Pro" modal appears

### ❌ FAIL Conditions:
1. HubSpot button says "Upgrade" instead of "Connect"
2. "Pro" or "Enterprise" badge visible on HubSpot card
3. "Upgrade to Pro" modal appears when clicking button
4. Console shows no Merge-related logs
5. Merge modal does NOT open

## Troubleshooting

### Issue: Button says "Upgrade" instead of "Connect"
**Root Cause:** HubSpot `tier` is not set to 'free' in code
**Fix:** Verify line 383 in Integrations.js has `tier: 'free'`

### Issue: Upgrade modal appears instead of Merge modal
**Root Cause:** `handleConnect` is not routing `viaMerge` integrations correctly
**Fix:** Verify lines 533-536 in Integrations.js route `viaMerge` to `openMergeLink()`

### Issue: No console logs appear
**Root Cause:** `openMergeLink()` is not being called
**Fix:** Verify `handleConnect` logic and button onClick handler

### Issue: Console shows "No active session"
**Root Cause:** User is not authenticated
**Fix:** Ensure user is logged in via Google OAuth

## Backend Verification

If frontend appears correct but Merge modal doesn't open, check backend:

```bash
# Check backend logs for Merge API calls
tail -n 100 /var/log/supervisor/backend.*.log | grep -i merge

# Expected logs:
# POST /api/integrations/merge/link-token
# Calling Merge API: https://api.merge.dev/api/integrations/create-link-token
# Response status: 200
```

## Code Quality Assessment

✅ **Implementation Quality: EXCELLENT**
- Proper separation of concerns (Gmail/Outlook vs Merge integrations)
- Comprehensive error handling and logging
- Clear console messages for debugging
- Proper session validation
- Correct routing logic

✅ **Expected Outcome: FIX SHOULD WORK**
Based on code review, the implementation is correct and should route HubSpot to Merge Link modal instead of upgrade modal.

## Next Steps

1. **User andre@thestrategysquad.com.au** should follow this guide
2. Capture console logs and screenshots
3. Report results:
   - ✅ If HubSpot opens Merge modal: **FIX VERIFIED**
   - ❌ If HubSpot shows upgrade modal: **FIX NOT WORKING** (provide console logs)
   - ⚠️ If other issues: **PROVIDE DETAILS** (console logs, screenshots, error messages)
