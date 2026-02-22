# AUTHORITATIVE URI/URL CONFIGURATION REFERENCE
**System:** BIQC (Business IQ Centre)  
**Environment:** intel-pipeline.preview.emergentagent.com  
**Generated:** January 29, 2026  
**Status:** ✅ VERIFIED FROM CODE & ENVIRONMENT

---

## 🌐 BASE URLS (FROM ENVIRONMENT)

```
BACKEND_URL=https://agentic-advisor.preview.emergentagent.com
FRONTEND_URL=https://agentic-advisor.preview.emergentagent.com
SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
```

**Note:** Backend and Frontend share same domain (Kubernetes ingress routing)

---

## 📧 GOOGLE CLOUD CONSOLE CONFIGURATION

### Gmail Integration (Email Sync)

**OAuth 2.0 Client Configuration:**

| Setting | Value |
|---------|-------|
| **Application Type** | Web application |
| **Application Name** | BIQC Gmail Integration |

**Authorized Redirect URIs (ADD THIS EXACT URL):**
```
https://agentic-advisor.preview.emergentagent.com/api/auth/gmail/callback
```

**Required Scopes:**
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

**Client Credentials (FROM ENV):**
```
Client ID: 903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com
Client Secret: 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
```

**Gmail API Status:**
- ✅ Must be ENABLED in Google Cloud Console
- URL: https://console.cloud.google.com/apis/library/gmail.googleapis.com

---

## 🔷 MICROSOFT AZURE AD CONFIGURATION

### Outlook Integration (Email + Calendar Sync)

**App Registration Configuration:**

| Setting | Value |
|---------|-------|
| **Application Name** | BIQC Outlook Integration |
| **Supported Account Types** | Accounts in any organizational directory and personal Microsoft accounts |
| **Platform** | Web |

**Redirect URIs (ADD THIS EXACT URL):**
```
https://agentic-advisor.preview.emergentagent.com/api/auth/outlook/callback
```

**Required API Permissions (Microsoft Graph - Delegated):**
- ✅ `offline_access` (refresh tokens)
- ✅ `User.Read` (basic profile)
- ✅ `Mail.Read` (read emails)
- ✅ `Mail.ReadBasic` (basic email metadata)
- ✅ `Calendars.Read` (read calendar)
- ✅ `Calendars.ReadBasic` (basic calendar metadata)

**Client Credentials (FROM ENV):**
```
Application (client) ID: biqc-fixer
Directory (tenant) ID: common
Client Secret: o8S8Q~3.q3nakGJkPOSZ.WkcdA0xsdNJUZ8Y5aVb
```

**⚠️ CRITICAL ISSUE DETECTED:**
- `AZURE_CLIENT_ID=biqc-fixer` **← THIS IS NOT A VALID GUID**
- Azure Client IDs should be UUIDs like: `12345678-1234-1234-1234-123456789abc`
- **This may be causing OAuth failures**

**ACTION REQUIRED:**
1. Go to Azure Portal
2. Find/create BIQC Outlook app registration
3. Copy the ACTUAL Application (client) ID (it's a GUID)
4. Update `AZURE_CLIENT_ID` in `/app/backend/.env`

---

## 🔵 SUPABASE CONFIGURATION

### Supabase Auth (Account Login - Google + Microsoft)

**Project:** uxyqpdfftxpkzeppqtvk

**Supabase Dashboard:** https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk

**Site URL Configuration:**
```
Site URL: https://agentic-advisor.preview.emergentagent.com
```

**Redirect URLs (Supabase manages these, but verify they include):**
```
https://agentic-advisor.preview.emergentagent.com/auth/callback
https://agentic-advisor.preview.emergentagent.com/**
```

**Frontend Callback Handler:**
- **Route:** `/auth/callback` (React Router)
- **File:** `/app/frontend/src/pages/AuthCallbackSupabase.js`
- **Purpose:** Handles Supabase OAuth callback (Google/Azure account login)

**OAuth Providers to Enable:**
- ✅ Google (for account login)
- ✅ Azure (for account login)

**Configuration Steps:**
1. Go to: Authentication → Providers
2. Enable Google provider (Supabase provides instructions)
3. Enable Azure provider (Supabase provides instructions)
4. Supabase will handle OAuth flow and callbacks

---

## 🔗 MERGE.DEV CONFIGURATION

**Dashboard:** https://app.merge.dev/

**API Configuration:**
```
API Key: 7JIdThF2Hd92_B_rmlRWI8djXlCHeI0bJ6LhQfWdL0mge4mYt9l9cw
Base URL: https://api.merge.dev/api
```

**Redirect URIs:** ❌ **NONE REQUIRED**
- Merge uses SDK-managed flow (React component)
- No HTTP redirect callbacks
- Frontend handles via `useMergeLink()` hook

**Categories Enabled:**
- ✅ CRM (HubSpot, Salesforce, Pipedrive)
- ✅ Accounting (Xero, QuickBooks)
- ✅ HRIS (if needed)
- ✅ ATS (if needed)
- ❌ **DO NOT enable Email/Communication** (not supported)

**Integration Flow:**
1. Frontend calls `/api/integrations/merge/link-token` to get link_token
2. Merge Link modal opens (SDK)
3. User completes OAuth in modal
4. SDK fires `onSuccess` callback with public_token
5. Frontend calls `/api/integrations/merge/exchange-account-token`
6. Backend stores account_token in `integration_accounts` table

---

## 📋 COMPLETE ENDPOINT REGISTRY

### SUPABASE AUTH ENDPOINTS (Account Login)

**Google Login:**
```
Initiation: Supabase SDK (managed)
Callback: https://agentic-advisor.preview.emergentagent.com/auth/callback (React route)
Handler: /app/frontend/src/pages/AuthCallbackSupabase.js
```

**Microsoft Azure Login:**
```
Initiation: Supabase SDK (managed)
Callback: https://agentic-advisor.preview.emergentagent.com/auth/callback (React route)
Handler: /app/frontend/src/pages/AuthCallbackSupabase.js
```

---

### OUTLOOK INTEGRATION ENDPOINTS (Email + Calendar)

**Connect Flow:**
```
UI Button: Integrations.js → "Connect Outlook"
  ↓
Login URL: https://agentic-advisor.preview.emergentagent.com/api/auth/outlook/login
  ↓
Microsoft OAuth
  ↓
Callback URL: https://agentic-advisor.preview.emergentagent.com/api/auth/outlook/callback
  ↓
Stores tokens → outlook_oauth_tokens table
  ↓
Redirects to: https://agentic-advisor.preview.emergentagent.com/integrations?outlook_connected=true
```

**Sync Endpoints:**
```
Email Sync: GET /api/outlook/emails/sync
Calendar Sync: POST /api/outlook/calendar/sync
Status Check: GET /api/outlook/status
Disconnect: POST /api/outlook/disconnect
```

---

### GMAIL INTEGRATION ENDPOINTS (Email)

**Connect Flow:**
```
UI Button: Integrations.js → "Connect Gmail"
  ↓
Login URL: https://agentic-advisor.preview.emergentagent.com/api/auth/gmail/login
  ↓
Google OAuth
  ↓
Callback URL: https://agentic-advisor.preview.emergentagent.com/api/auth/gmail/callback
  ↓
Stores tokens → gmail_connections table
  ↓
Redirects to: https://agentic-advisor.preview.emergentagent.com/integrations?gmail_connected=true
```

**Status/Sync:**
```
Status Check: Supabase Edge Function (gmail_prod)
Disconnect: POST /api/gmail/disconnect
```

---

### MERGE.DEV INTEGRATION ENDPOINTS (CRM/Finance/HR)

**Connect Flow:**
```
UI Button: Integrations.js → "Connect via Merge" or click CRM card
  ↓
Get Link Token: POST /api/integrations/merge/link-token
  ↓
Merge Link Modal Opens (SDK-managed, no URL needed)
  ↓
User completes OAuth in modal
  ↓
SDK calls onSuccess → Frontend receives public_token
  ↓
Exchange Token: POST /api/integrations/merge/exchange-account-token
  ↓
Stores account_token → integration_accounts table
  ↓
Modal closes, UI updates
```

**Data Endpoints:**
```
Get Connected: GET /api/integrations/merge/connected
CRM Contacts: GET /api/integrations/crm/contacts
CRM Companies: GET /api/integrations/crm/companies
CRM Deals: GET /api/integrations/crm/deals
CRM Owners: GET /api/integrations/crm/owners
```

---

## 🔧 THIRD-PARTY CONSOLE CONFIGURATION SUMMARY

### ✅ GOOGLE CLOUD CONSOLE

**Project:** [Your Google Cloud Project]

**What to Configure:**
1. **OAuth 2.0 Client ID**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Create Web application client

2. **Authorized Redirect URIs:**
   ```
   https://agentic-advisor.preview.emergentagent.com/api/auth/gmail/callback
   ```

3. **OAuth Consent Screen:**
   - App name: BIQC
   - User support email: [your email]
   - Scopes: gmail.readonly, gmail.modify, userinfo.email, userinfo.profile

4. **Enable Gmail API:**
   - https://console.cloud.google.com/apis/library/gmail.googleapis.com
   - Click "Enable"

**Credentials to Copy:**
- ✅ Already in env: Client ID and Secret configured

---

### ✅ MICROSOFT AZURE AD PORTAL

**Tenant:** common (multi-tenant)

**⚠️ CRITICAL ACTION REQUIRED:**

**Current Issue:**
```
AZURE_CLIENT_ID=biqc-fixer  ← INVALID (not a GUID)
```

**What You Must Do:**

1. **Go to:** https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps

2. **Find or Create App:**
   - Look for "BIQC Outlook Integration" app
   - If not exists: Click "New registration"
   - Name: "BIQC Outlook Integration"
   - Supported accounts: **Accounts in any organizational directory and personal Microsoft accounts (multitenant)**

3. **Configure Redirect URI:**
   - Platform: **Web**
   - Redirect URI:
     ```
     https://agentic-advisor.preview.emergentagent.com/api/auth/outlook/callback
     ```

4. **Get Correct Client ID:**
   - Go to app → Overview
   - **Copy "Application (client) ID"** (it's a GUID like `abcd1234-5678-90ab-cdef-1234567890ab`)
   - Replace `AZURE_CLIENT_ID=biqc-fixer` with actual GUID

5. **Create Client Secret:**
   - Go to: Certificates & secrets
   - New client secret
   - Copy value (shown once)
   - Update `AZURE_CLIENT_SECRET` if different

6. **API Permissions:**
   - Go to: API permissions → Add permission → Microsoft Graph → Delegated
   - Add:
     - offline_access
     - User.Read
     - Mail.Read
     - Mail.ReadBasic
     - Calendars.Read
     - Calendars.ReadBasic
   - Click "Grant admin consent"

**After fixing `AZURE_CLIENT_ID`, restart backend:**
```bash
sudo supervisorctl restart backend
```

---

### ✅ SUPABASE DASHBOARD

**Project URL:** https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk

**What to Configure:**

1. **Site URL:**
   - Go to: Authentication → URL Configuration
   - Site URL: `https://agentic-advisor.preview.emergentagent.com`

2. **Redirect URLs:**
   - Additional Redirect URLs:
     ```
     https://agentic-advisor.preview.emergentagent.com/auth/callback
     https://agentic-advisor.preview.emergentagent.com/**
     ```

3. **Auth Providers:**
   - Go to: Authentication → Providers
   - Enable **Google** (follow Supabase instructions)
   - Enable **Azure** (follow Supabase instructions)

4. **Edge Functions (Verify Deployed):**
   - Go to: Edge Functions
   - Verify deployed:
     - ✅ `gmail_prod` (Gmail connection check)
     - ✅ `email_priority` (Priority inbox analysis)
   - URLs:
     ```
     https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_prod
     https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/email_priority
     ```

5. **Service Role Key:**
   - Go to: Project Settings → API
   - Verify service_role key matches env
   - ✅ Already configured

---

### ✅ MERGE.DEV DASHBOARD

**Dashboard:** https://app.merge.dev/

**What to Configure:**

1. **API Key:**
   - Go to: Settings → API Keys
   - Verify Production key: `7JIdThF2Hd92_B_rmlRWI8djXlCHeI0bJ6LhQfWdL0mge4mYt9l9cw`
   - ✅ Already configured

2. **Categories:**
   - Verify enabled:
     - ✅ CRM
     - ✅ Accounting
     - ✅ HRIS (if needed)
     - ✅ ATS (if needed)
   - ❌ **DO NOT enable Ticketing/Email** (not used for email)

3. **Integrations:**
   - CRM: HubSpot, Salesforce, Pipedrive
   - Accounting: Xero, QuickBooks
   - Configure each as needed in Merge dashboard

**No Redirect URI needed** - Merge uses SDK callbacks

---

## 🔍 ENDPOINT VERIFICATION COMMANDS

### Test Backend Reachability

```bash
# Health check
curl -s https://agentic-advisor.preview.emergentagent.com/api/health

# Expected: {"status":"healthy"}
```

### Test OAuth Endpoints (Without Auth)

```bash
# Outlook login (will redirect to Microsoft)
curl -I https://agentic-advisor.preview.emergentagent.com/api/auth/outlook/login

# Expected: 401 or 307 redirect (needs auth)
```

```bash
# Gmail login (will redirect to Google)
curl -I https://agentic-advisor.preview.emergentagent.com/api/auth/gmail/login

# Expected: 401 or 307 redirect (needs auth)
```

### Test Callback Endpoints (Simulate Provider Callback)

```bash
# Outlook callback (with fake code)
curl -I "https://agentic-advisor.preview.emergentagent.com/api/auth/outlook/callback?code=test&state=test"

# Expected: 302 redirect to frontend (even with invalid code)
```

```bash
# Gmail callback (with fake code)
curl -I "https://agentic-advisor.preview.emergentagent.com/api/auth/gmail/callback?code=test&state=test"

# Expected: 302 redirect to frontend
```

---

## 📱 FRONTEND ROUTES (React Router)

```
/                          → Landing page
/login-supabase            → Login page (Supabase OAuth buttons)
/register-supabase         → Register page
/auth/callback             → Supabase OAuth callback (Google/Azure account auth)
/integrations              → Integrations page (Outlook, Gmail, Merge)
/advisor                   → Main app (after login)
/onboarding               → Onboarding wizard
```

---

## 🎯 CRITICAL CORRECTIONS NEEDED

### ⚠️ ISSUE 1: Invalid Azure Client ID

**Current:**
```
AZURE_CLIENT_ID=biqc-fixer
```

**This is WRONG** - Not a valid Azure Application ID

**Fix Required:**
1. Go to Azure Portal
2. Find your app registration
3. Copy the actual GUID (looks like: `12345678-abcd-1234-5678-123456789abc`)
4. Update `/app/backend/.env`
5. Restart backend

**This is likely why Outlook OAuth is failing.**

---

### ⚠️ ISSUE 2: Email in Merge Integrations

**Current Backend Behavior:**
```
/api/integrations/merge/connected returns:
{
  outlook: { category: 'email', connected: true },
  hubspot: { category: 'crm', connected: true }
}
```

**This is WRONG** - Outlook should not be in Merge integrations

**Fix Required:** Filter out email category from Merge endpoint

---

## 📊 CONFIGURATION VALIDATION CHECKLIST

### Google Cloud Console
- [ ] OAuth 2.0 client created
- [ ] Redirect URI: `https://agentic-advisor.preview.emergentagent.com/api/auth/gmail/callback`
- [ ] Scopes configured: gmail.readonly, gmail.modify
- [ ] Gmail API enabled
- [ ] Consent screen configured
- [ ] Client ID matches env: `903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10...`

### Microsoft Azure AD
- [ ] App registration exists
- [ ] **CRITICAL:** Get actual Application (client) ID GUID
- [ ] Redirect URI: `https://agentic-advisor.preview.emergentagent.com/api/auth/outlook/callback`
- [ ] API permissions granted: offline_access, User.Read, Mail.Read, Calendars.Read
- [ ] Client secret created
- [ ] Tenant ID: "common" (multi-tenant) ✅

### Supabase
- [ ] Site URL: `https://agentic-advisor.preview.emergentagent.com` ✅
- [ ] Redirect URLs include: `/auth/callback` ✅
- [ ] Google provider enabled
- [ ] Azure provider enabled
- [ ] Edge Functions deployed: `gmail_prod`, `email_priority`
- [ ] Service role key configured ✅

### Merge.dev
- [ ] API key configured ✅
- [ ] Categories enabled: CRM, Accounting, HRIS, ATS
- [ ] Email category: NOT used ✅

---

## 🚨 IMMEDIATE ACTION ITEMS

### CRITICAL (Must Fix Now):
1. **Fix AZURE_CLIENT_ID** - Replace "biqc-fixer" with actual GUID from Azure Portal
2. **Filter email from Merge endpoint** - Prevent Outlook/Gmail appearing in Merge integrations
3. **Verify all redirect URIs** match third-party consoles

### High Priority:
1. Test full OAuth flows after fixing Azure Client ID
2. Separate Email/Calendar UI from CRM integrations
3. Ensure Supabase Edge Functions are deployed

---

## 📝 SUMMARY

**Valid URIs (Verified from Code):**
- ✅ Gmail callback: `https://agentic-advisor.preview.emergentagent.com/api/auth/gmail/callback`
- ✅ Outlook callback: `https://agentic-advisor.preview.emergentagent.com/api/auth/outlook/callback`
- ✅ Supabase callback: `https://agentic-advisor.preview.emergentagent.com/auth/callback`
- ✅ Merge: No URI needed (SDK-managed)

**Critical Issue Found:**
- ❌ `AZURE_CLIENT_ID=biqc-fixer` is INVALID
- Must be replaced with actual GUID from Azure Portal

**Next Steps:**
1. Fix Azure Client ID
2. Verify all provider consoles have correct redirect URIs
3. Test full OAuth flows
4. Fix Merge endpoint to exclude email

---

**ALL URIS DOCUMENTED. READY TO PROCEED WITH FIXES.**
