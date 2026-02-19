# OAUTH CALLBACK REGISTRY - AUTHORITATIVE

**Generated:** January 29, 2026  
**System:** BIQC (Business IQ Centre)  
**Environment:** intel-pipeline.preview.emergentagent.com

---

## CANONICAL CALLBACK URLS (FOR THIRD-PARTY CONSOLES)

### 1. SUPABASE AUTH (Google OAuth & Microsoft Azure OAuth - ACCOUNT LOGIN)

**Provider:** Supabase Managed OAuth  
**Providers Supported:** Google, Microsoft Azure  
**Purpose:** User account authentication (login/signup)

**Login Initiation:**
- **UI Button:** LoginSupabase.js → "Continue with Google" / "Continue with Microsoft"
- **Method:** `signInWithOAuth('google')` or `signInWithOAuth('azure')`
- **Handler:** Supabase SDK `supabase.auth.signInWithOAuth()`
- **Redirect To:** Managed by Supabase

**Callback URL (Frontend):**
```
https://ai-strategic-hub.preview.emergentagent.com/auth/callback
```

**Callback Handler:**
- **File:** `/app/frontend/src/pages/AuthCallbackSupabase.js`
- **Route:** `/auth/callback` (React Router)
- **Function:**
  1. Extracts access_token from URL (hash or query params)
  2. Calls `supabase.auth.setSession()`
  3. Checks profile via `/api/auth/check-profile`
  4. Redirects to `/onboarding` or `/advisor`

**Supabase Configuration:**
- **Callback URL in Supabase Dashboard:** Must include `https://ai-strategic-hub.preview.emergentagent.com/auth/callback`
- **OAuth Flow:** Authorization Code with PKCE
- **Scopes:** Managed by Supabase
- **Refresh Token:** Yes

**UI Entry Point:** Login page OAuth buttons

---

### 2. MICROSOFT OUTLOOK (Email Integration - Direct OAuth)

**Provider:** Microsoft Azure AD / Microsoft Graph  
**Purpose:** Outlook email integration (separate from login)

**Login Initiation:**
- **UI Button:** Integrations.js → "Connect Outlook"
- **Endpoint:** `GET /api/auth/outlook/login`
- **File:** `/app/backend/server.py` Line 2447

**Callback URL (Backend):**
```
https://ai-strategic-hub.preview.emergentagent.com/api/auth/outlook/callback
```

**Callback Handler:**
- **File:** `/app/backend/server.py` Line 2734
- **Function:** `outlook_callback(code, state, error, error_description)`
- **Auth:** HMAC-signed state parameter validation
- **Token Exchange:** Calls Microsoft token endpoint
- **Storage:** 
  - Tokens → `outlook_oauth_tokens` table (Supabase)
  - Integration state → `integration_accounts` table
- **Redirect:** Returns to `/integrations?outlook_connected=true`

**Microsoft Azure App Registration:**
- **Redirect URI:** `https://ai-strategic-hub.preview.emergentagent.com/api/auth/outlook/callback`
- **Application Type:** Web
- **OAuth Flow:** Authorization Code (not PKCE)
- **Scopes:** `offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic`
- **Refresh Token:** Yes
- **Client Secret:** Required

**Token Storage:**
- **Primary Table:** `outlook_oauth_tokens`
- **Columns:** user_id, access_token, refresh_token, expires_at, account_email, account_name
- **Fallback Table:** `m365_tokens` (legacy, for backwards compatibility)

**Sync Endpoint:**
- **URL:** `GET /api/outlook/emails/sync`
- **File:** `/app/backend/server.py` Line 2904
- **Auth:** Microsoft Graph API (direct)
- **Token:** Uses `get_outlook_tokens()` from database

**UI Entry Point:** Integrations page → Outlook card → "Connect" / "Refresh"

---

### 3. GOOGLE GMAIL (Email Integration - Direct OAuth)

**Provider:** Google OAuth 2.0  
**Purpose:** Gmail email integration (separate from login)

**Login Initiation:**
- **UI Button:** Integrations.js → "Connect Gmail"
- **Endpoint:** `GET /api/auth/gmail/login`
- **File:** `/app/backend/server.py` Line 2494

**Callback URL (Backend):**
```
https://ai-strategic-hub.preview.emergentagent.com/api/auth/gmail/callback
```

**Callback Handler:**
- **File:** `/app/backend/server.py` Line 2545
- **Function:** `gmail_callback(code, state, error, error_description)`
- **Auth:** HMAC-signed state parameter validation
- **Token Exchange:** Calls Google token endpoint
- **Storage:** 
  - Tokens → `gmail_connections` table (Supabase)
  - Integration state → `integration_accounts` table
- **Redirect:** Returns to `/integrations?gmail_connected=true`

**Google Cloud Console:**
- **Redirect URI:** `https://ai-strategic-hub.preview.emergentagent.com/api/auth/gmail/callback`
- **Application Type:** Web application
- **OAuth Flow:** Authorization Code
- **Scopes:** (Check backend for exact scopes)
- **Refresh Token:** Yes

**Token Storage:**
- **Table:** `gmail_connections`
- **Columns:** user_id, access_token, refresh_token, expires_at, scopes

**Status Check:**
- **Method:** Calls Supabase Edge Function `gmail_prod`
- **No direct API endpoint** - uses Edge Function

**UI Entry Point:** Integrations page → Gmail card → "Connect"

---

### 4. MERGE.DEV (Unified CRM/Accounting/HRIS/ATS)

**Provider:** Merge.dev  
**Purpose:** Unified API for CRM (HubSpot, Salesforce), Accounting (Xero, QuickBooks), HRIS, ATS

**Login Initiation:**
- **UI Component:** Integrations.js → Merge Link React component
- **Method:** `useMergeLink()` hook from `@mergeapi/react-merge-link`
- **Trigger:** User clicks "Connect via Merge" or clicks integration card (HubSpot, etc.)

**Flow:**
1. Frontend calls `POST /api/integrations/merge/link-token` to get link_token
2. Merge Link modal opens (managed by Merge SDK)
3. User completes OAuth in Merge modal
4. Merge SDK calls `onSuccess(public_token, metadata)`
5. Frontend calls `POST /api/integrations/merge/exchange-account-token`
6. Backend exchanges public_token for permanent account_token
7. Backend stores in `integration_accounts` table

**Callback/Webhook URL:**
- **N/A** - Merge uses SDK callback, not HTTP redirect
- **Frontend Handler:** `onSuccess` callback in Integrations.js Line 80
- **Backend Exchange Endpoint:** `POST /api/integrations/merge/exchange-account-token` Line 7508

**Token Storage:**
- **Table:** `integration_accounts`
- **Columns:** account_id, category, provider, account_token (Merge's Linked Account Token), merge_account_id

**Sync/Data Endpoints:**
- `GET /api/integrations/crm/contacts` (Line 7657)
- `GET /api/integrations/crm/companies` (Line 7698)
- `GET /api/integrations/crm/deals` (Line 7739)
- `GET /api/integrations/crm/owners` (Line 7801)

**Merge.dev Dashboard Configuration:**
- **No redirect URI needed** - uses SDK-managed flow
- **Link Token:** Short-lived, generated server-side
- **Account Token:** Long-lived, exchanged and stored
- **Workspace Scoped:** Yes (account_id level)

**UI Entry Point:** Integrations page → CRM/Finance cards → Opens Merge modal

---

## PROVIDER SUMMARY TABLE

| Provider | Purpose | Login Endpoint | Callback URL | Token Table | UI Entry |
|----------|---------|----------------|--------------|-------------|----------|
| **Supabase (Google)** | Account Auth | Supabase SDK | `/auth/callback` (frontend) | Supabase managed | Login page |
| **Supabase (Azure)** | Account Auth | Supabase SDK | `/auth/callback` (frontend) | Supabase managed | Login page |
| **Microsoft Outlook** | Email Integration | `/api/auth/outlook/login` | `/api/auth/outlook/callback` | `outlook_oauth_tokens` | Integrations |
| **Google Gmail** | Email Integration | `/api/auth/gmail/login` | `/api/auth/gmail/callback` | `gmail_connections` | Integrations |
| **Merge.dev** | CRM/Finance/HR | SDK (no login endpoint) | SDK callback (no URL) | `integration_accounts` | Integrations |

---

## ENVIRONMENT CONFIGURATION

**Current Environment:** intel-pipeline.preview.emergentagent.com

**From `/app/backend/.env`:**
```
BACKEND_URL=https://ai-strategic-hub.preview.emergentagent.com
FRONTEND_URL=https://ai-strategic-hub.preview.emergentagent.com
SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
```

**Derived Callback URLs:**
- Supabase OAuth: `https://ai-strategic-hub.preview.emergentagent.com/auth/callback` (React route)
- Outlook: `https://ai-strategic-hub.preview.emergentagent.com/api/auth/outlook/callback`
- Gmail: `https://ai-strategic-hub.preview.emergentagent.com/api/auth/gmail/callback`
- Merge: N/A (SDK-managed)

---

## NOTES & WARNINGS

### ⚠️ Outlook vs Azure Confusion
- **Microsoft Azure OAuth (Supabase):** Used for ACCOUNT LOGIN
- **Microsoft Outlook OAuth (Direct):** Used for EMAIL INTEGRATION
- **CRITICAL:** These are SEPARATE OAuth apps with SEPARATE callback URLs
- Both use Azure AD, but serve different purposes

### ⚠️ Gmail Integration Method
- Uses **Supabase Edge Function** (`gmail_prod`) for connection checks
- Direct Google OAuth for initial connection
- Token stored in `gmail_connections` table
- Different pattern from Outlook (no /gmail/sync endpoint in backend)

### ⚠️ Merge.dev Architecture
- Does NOT use traditional OAuth callbacks
- Uses React SDK (`@mergeapi/react-merge-link`)
- Callbacks happen in frontend JavaScript, not HTTP redirects
- Backend only handles token exchange

### ⚠️ Legacy References (May Still Exist)
- `m365_tokens` table (fallback for Outlook)
- MongoDB references in old code
- Backup files may have outdated callback URLs

---

## VERIFICATION CHECKLIST

For each provider, verify in third-party console:

**Microsoft Azure AD (Supabase Auth):**
- [ ] Redirect URI: `https://ai-strategic-hub.preview.emergentagent.com/auth/callback`
- [ ] Application ID matches `GOOGLE_CLIENT_ID` / Azure equiv in env
- [ ] Client secret configured

**Microsoft Azure AD (Outlook Integration - SEPARATE APP):**
- [ ] Redirect URI: `https://ai-strategic-hub.preview.emergentagent.com/api/auth/outlook/callback`
- [ ] Application ID matches `AZURE_CLIENT_ID` in env
- [ ] Client secret matches `AZURE_CLIENT_SECRET`
- [ ] Scopes granted: `offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic`

**Google Cloud Console (Supabase Auth):**
- [ ] Redirect URI: Managed by Supabase (check Supabase dashboard)
- [ ] Client ID matches Supabase config

**Google Cloud Console (Gmail Integration):**
- [ ] Redirect URI: `https://ai-strategic-hub.preview.emergentagent.com/api/auth/gmail/callback`
- [ ] Client ID configured in backend env
- [ ] Scopes configured

**Merge.dev Dashboard:**
- [ ] No redirect URI needed
- [ ] API key matches `MERGE_API_KEY` in env
- [ ] Link Token endpoint configured

---

## DUPLICATE / CONFLICT CHECK

✅ **No duplicate Outlook callbacks found**
✅ **No duplicate Gmail callbacks found**
✅ **Supabase auth uses separate `/auth/callback` route** (no conflict)
✅ **Merge uses SDK, not HTTP callbacks** (no conflict)

**Conclusion:** NO OAuth callback conflicts detected.

---

## RECOMMENDED ACTIONS

1. ✅ **Registry Created:** This file serves as authoritative source
2. ⏭️ **Next Task:** Fix Outlook connection state determination (see Part C)
3. ⏭️ **Future:** Verify all callback URLs in provider consoles match this registry

---

**Registry Complete. Ready for Root Cause Analysis.**
