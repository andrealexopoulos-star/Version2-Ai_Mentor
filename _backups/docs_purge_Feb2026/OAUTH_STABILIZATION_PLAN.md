# BIQC OAuth Stabilization Checklist
# Priority: Get ALL OAuth flows working reliably

## 🎯 GOAL
Stabilize all authentication and integration OAuth flows before implementing data fetching.

---

## 📋 OAUTH FLOWS TO STABILIZE

### 1. ✅ User Authentication (Supabase OAuth)
**Status:** Working
**Providers:** Google, Microsoft
**Evidence:** Users can login successfully
**Action:** None required

---

### 2. 🔧 Email Integration OAuth (Direct)

#### Gmail Connection
**Current Status:** Fixed (awaiting verification)
**Fix Applied:** Changed from axios to window.location.assign()
**Endpoint:** `/api/auth/gmail/login`
**Flow:** BIQC → Google OAuth → BIQC callback
**Test Required:** Yes

#### Outlook Connection  
**Current Status:** Fixed (awaiting verification)
**Fix Applied:** Changed from axios to window.location.assign()
**Endpoint:** `/api/auth/outlook/login`
**Flow:** BIQC → Microsoft OAuth → BIQC callback
**Test Required:** Yes

**Critical Issue Fixed:**
- OLD: axios call → 401 interceptor → logout
- NEW: Direct browser navigation → OAuth → callback (no logout)

---

### 3. 🚨 HubSpot Integration OAuth (Via Merge.dev)

**Current Status:** Connection fails at redirect
**Error:** "Authorization failed in the redirection"
**Root Cause:** Merge.dev OAuth configuration issue (NOT BIQC code)

**BIQC Implementation:** ✅ Correct
- No direct HubSpot OAuth code
- All via Merge.dev
- Workspace-scoped
- Proper token exchange logic

**External Blocker:**
- Merge.dev HubSpot OAuth app redirect URI mismatch
- Requires Merge dashboard configuration fix

---

## 🧪 STABILIZATION TESTING PLAN

### Phase 1: Test Direct OAuth Flows (Gmail/Outlook)

**Test 1: Gmail Connection**
1. Login as andre@thestrategysquad.com.au
2. Navigate to /integrations
3. Click "Connect" on Gmail
4. Expected: Navigate to accounts.google.com (NO logout)
5. Complete OAuth
6. Expected: Return to /integrations with success message

**Test 2: Outlook Connection**
1. Stay on /integrations (if still logged in)
2. Click "Connect" on Outlook
3. Expected: Navigate to login.microsoftonline.com (NO logout)
4. Complete OAuth
5. Expected: Return to /integrations with success message

**Success Criteria:**
- ✅ No logout during connection
- ✅ OAuth screens appear
- ✅ Callbacks work correctly
- ✅ Connections persist in database

---

### Phase 2: Fix & Test Merge.dev OAuth Flow (HubSpot)

**Pre-Test: Fix Merge Configuration**

Option A (Recommended): Use Merge's OAuth App
1. Login to https://app.merge.dev
2. Configuration → Integrations → HubSpot
3. Select "Use Merge OAuth Application"
4. Ensure Status: "Enabled"

Option B: Fix Custom OAuth App
1. Get Merge's redirect URI from support@merge.dev
2. Update HubSpot OAuth app redirect URI
3. Verify scopes are correct

**Test 3: HubSpot via Merge**
1. Login to BIQC
2. Navigate to /integrations
3. Click "Connect" on HubSpot card
4. Expected: Merge Link modal opens (NOT upgrade modal)
5. Click HubSpot in Merge modal
6. Expected: HubSpot OAuth screen (NOT error)
7. Complete authorization
8. Expected: Success callback, HubSpot shows as connected

**Success Criteria:**
- ✅ Merge modal opens when clicking HubSpot
- ✅ HubSpot OAuth completes without redirect error
- ✅ Token exchange succeeds
- ✅ HubSpot appears in "Connected Tools"
- ✅ Database has workspace-scoped HubSpot integration

---

## 🔍 CURRENT VERIFICATION

Let me check the current state of all OAuth implementations:

### Backend OAuth Endpoints:
- `/api/auth/gmail/login` - Direct Google OAuth
- `/api/auth/gmail/callback` - Google callback
- `/api/auth/outlook/login` - Direct Microsoft OAuth
- `/api/auth/outlook/callback` - Microsoft callback
- `/api/integrations/merge/link-token` - Merge.dev broker
- `/api/integrations/merge/exchange-account-token` - Merge token exchange

### Frontend OAuth Triggers:
- Gmail: window.location.assign() to /api/auth/gmail/login
- Outlook: window.location.assign() to /api/auth/outlook/login
- HubSpot: openMergeLink() → Merge handles OAuth

---

## ✅ WHAT'S WORKING

1. **User Login (Supabase OAuth):** Working ✅
2. **Workspace Architecture:** Deployed ✅
3. **Merge Link Token Generation:** Working ✅
4. **Code Structure:** Correct ✅

## ⚠️ WHAT NEEDS VERIFICATION

1. **Gmail OAuth:** Code fixed, needs user testing
2. **Outlook OAuth:** Code fixed, needs user testing

## 🚨 WHAT NEEDS EXTERNAL FIX

1. **HubSpot via Merge:** Requires Merge.dev OAuth configuration fix

---

## 🎯 RECOMMENDED TESTING ORDER

1. **First:** Test Gmail connection (verify no logout)
2. **Second:** Test Outlook connection (verify no logout)
3. **Third:** Fix Merge HubSpot OAuth config
4. **Fourth:** Test HubSpot connection
5. **Once all working:** Proceed to data fetching (P1)

---

## 📊 TRACKING

**OAuth Flows Status:**
- ✅ Supabase OAuth (Google/Microsoft login): STABLE
- 🔧 Gmail integration: FIXED (needs verification)
- 🔧 Outlook integration: FIXED (needs verification)  
- 🚨 HubSpot via Merge: BLOCKED (external config)

**Next Milestone:** All OAuth flows working reliably
**Then:** Implement data fetching and intelligence generation
