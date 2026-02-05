# THIRD-PARTY OAUTH CONFIGURATION CHECKLIST

**System:** BIQC (Business IQ Centre)  
**Environment:** intel-pipeline.preview.emergentagent.com  
**Architecture:** Email via Supabase Edge Functions, CRM via Merge.dev

---

## ✅ GOOGLE CLOUD CONSOLE CONFIGURATION

### Application 1: Supabase Auth (Account Login)

**Purpose:** User account authentication (login/signup with Google)

**Configuration Location:** Supabase Dashboard → Authentication → Providers → Google

**Supabase Manages:**
- ✅ Client ID
- ✅ Client Secret
- ✅ Redirect URIs
- ✅ OAuth flow

**Your Action:**
1. Go to Supabase Dashboard: https://app.supabase.com/project/[project-id]/auth/providers
2. Enable Google provider
3. Follow Supabase instructions for Google OAuth setup
4. Supabase will provide the callback URL (managed)

**No manual Google Console config needed** - Supabase handles this.

---

### Application 2: Gmail Integration (Email Sync)

**Purpose:** Gmail email integration for BIQC Intelligence

**Configuration Required:** Google Cloud Console

📋 **CHECKLIST:**

**Step 1: Create OAuth 2.0 Client**
- [ ] Go to: https://console.cloud.google.com/apis/credentials
- [ ] Click "Create Credentials" → "OAuth 2.0 Client ID"
- [ ] Application type: **Web application**
- [ ] Name: "BIQC Gmail Integration"

**Step 2: Configure Authorized Redirect URIs**
Add this EXACT URL:
```
https://watchtower-ai.preview.emergentagent.com/api/auth/gmail/callback
```

**Step 3: Configure OAuth Consent Screen**
- [ ] Go to: https://console.cloud.google.com/apis/credentials/consent
- [ ] User type: **External** (or Internal if Google Workspace)
- [ ] App name: "BIQC"
- [ ] User support email: [your email]
- [ ] Developer contact: [your email]

**Step 4: Add Required Scopes**
- [ ] https://www.googleapis.com/auth/gmail.readonly
- [ ] https://www.googleapis.com/auth/gmail.modify
- [ ] https://www.googleapis.com/auth/userinfo.email
- [ ] https://www.googleapis.com/auth/userinfo.profile

**Step 5: Copy Credentials to Backend**
After creating client:
- [ ] Copy Client ID
- [ ] Copy Client Secret
- [ ] Add to `/app/backend/.env`:
  ```
  GOOGLE_CLIENT_ID=[your-client-id]
  GOOGLE_CLIENT_SECRET=[your-client-secret]
  ```

**Step 6: Enable Gmail API**
- [ ] Go to: https://console.cloud.google.com/apis/library/gmail.googleapis.com
- [ ] Click "Enable"

---

## ✅ MICROSOFT AZURE AD CONFIGURATION

### Application 1: Supabase Auth (Account Login)

**Purpose:** User account authentication (login/signup with Microsoft)

**Configuration Location:** Supabase Dashboard → Authentication → Providers → Azure

**Supabase Manages:**
- ✅ Client ID configuration
- ✅ Redirect URIs
- ✅ OAuth flow

**Your Action:**
1. Go to Supabase Dashboard
2. Enable Azure provider
3. Follow Supabase instructions
4. Configure Azure AD app as directed by Supabase

**No manual Azure setup needed beyond Supabase instructions.**

---

### Application 2: Outlook Integration (Email + Calendar)

**Purpose:** Outlook email and calendar integration for BIQC Intelligence

**Configuration Required:** Azure AD Portal

📋 **CHECKLIST:**

**Step 1: Register Application**
- [ ] Go to: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps
- [ ] Click "New registration"
- [ ] Name: "BIQC Outlook Integration"
- [ ] Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
- [ ] Redirect URI:
  - Platform: **Web**
  - URI: `https://watchtower-ai.preview.emergentagent.com/api/auth/outlook/callback`

**Step 2: Create Client Secret**
- [ ] Go to: App → Certificates & secrets → Client secrets
- [ ] Click "New client secret"
- [ ] Description: "BIQC Production"
- [ ] Expires: 24 months (or never)
- [ ] **COPY THE VALUE IMMEDIATELY** (shown only once)

**Step 3: Configure API Permissions**
- [ ] Go to: App → API permissions
- [ ] Click "Add a permission" → Microsoft Graph → Delegated permissions
- [ ] Add these scopes:
  - [ ] **offline_access** (required for refresh tokens)
  - [ ] **User.Read** (basic profile)
  - [ ] **Mail.Read** (read emails)
  - [ ] **Mail.ReadBasic** (basic email info)
  - [ ] **Calendars.Read** (read calendar)
  - [ ] **Calendars.ReadBasic** (basic calendar info)
- [ ] Click "Grant admin consent" (if you have admin rights)

**Step 4: Copy Configuration to Backend**
- [ ] Copy Application (client) ID
- [ ] Copy Directory (tenant) ID
- [ ] Copy Client secret value
- [ ] Add to `/app/backend/.env`:
  ```
  AZURE_CLIENT_ID=[your-app-client-id]
  AZURE_CLIENT_SECRET=[your-client-secret-value]
  AZURE_TENANT_ID=[your-tenant-id or "common"]
  ```

**Step 5: Verify Redirect URI**
- [ ] Go to: App → Authentication → Platform configurations → Web
- [ ] Confirm redirect URI is: `https://watchtower-ai.preview.emergentagent.com/api/auth/outlook/callback`
- [ ] Ensure "Access tokens" and "ID tokens" are NOT checked (using code flow)

---

## ✅ SUPABASE CONFIGURATION

### Project Setup

**Supabase Project:** https://uxyqpdfftxpkzeppqtvk.supabase.co

📋 **CHECKLIST:**

**Step 1: Authentication Providers**
- [ ] Go to: https://app.supabase.com/project/[project-id]/auth/providers
- [ ] Enable Google provider
  - [ ] Follow Supabase instructions for Google OAuth
- [ ] Enable Azure provider
  - [ ] Follow Supabase instructions for Azure AD
- [ ] Confirm callback URL is added to providers

**Step 2: Edge Functions Deployment**

**Gmail Edge Function:**
- [ ] Verify deployed: `gmail_prod`
- [ ] Location: `/app/supabase_edge_functions/gmail_prod/`
- [ ] URL: `https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_prod`
- [ ] Environment: Service role key configured

**Priority Inbox Edge Function:**
- [ ] Verify deployed: `email_priority`
- [ ] Location: `/app/supabase_edge_functions/email_priority/`
- [ ] Purpose: Analyzes email priority
- [ ] Status: Should be deployed

**Step 3: Service Role Configuration**
- [ ] Go to: Project Settings → API
- [ ] Copy service_role key (secret)
- [ ] Ensure Edge Functions have access to this key
- [ ] Used for Gmail/Outlook integration checks

**Step 4: Database Tables**
Verify these tables exist:
- [ ] `outlook_oauth_tokens` (for Outlook tokens)
- [ ] `gmail_connections` (for Gmail tokens)
- [ ] `integration_accounts` (for integration state)
- [ ] `outlook_emails` (for synced emails)
- [ ] `accounts` (for workspaces)
- [ ] `users` (with account_id column)

**Step 5: URL Configuration**
- [ ] Confirm Site URL: `https://watchtower-ai.preview.emergentagent.com`
- [ ] Confirm Redirect URLs include: `https://watchtower-ai.preview.emergentagent.com/auth/callback`

---

## ✅ MERGE.DEV CONFIGURATION

### Merge Dashboard Setup

**Purpose:** CRM, Accounting, HRIS, ATS integrations (NOT email)

📋 **CHECKLIST:**

**Step 1: Get Merge Account**
- [ ] Sign up at: https://app.merge.dev/
- [ ] Create account or log in

**Step 2: Create Production API Key**
- [ ] Go to: Dashboard → Settings → API Keys
- [ ] Create Production API key
- [ ] Copy API key
- [ ] Add to `/app/backend/.env`:
  ```
  MERGE_API_KEY=[your-merge-production-key]
  ```

**Step 3: Configure Linked Account (Frontend)**
- [ ] Go to: Dashboard → Linked Accounts
- [ ] No callback URL needed (SDK-managed)
- [ ] Confirm categories enabled:
  - [ ] CRM (for HubSpot, Salesforce, Pipedrive)
  - [ ] Accounting (for Xero, QuickBooks)
  - [ ] HRIS (if needed)
  - [ ] ATS (if needed)
  - [ ] **DO NOT enable Ticketing** (not used for email)

**Step 4: Configure HubSpot App (If Using)**
- [ ] Go to Merge Dashboard → Integrations → HubSpot
- [ ] Follow Merge's instructions for HubSpot app setup
- [ ] Merge will handle OAuth redirect (no manual config needed)

---

## CURRENT CONFIGURATION STATUS

**From Logs/Environment:**

✅ **Backend URL:** `https://watchtower-ai.preview.emergentagent.com`
✅ **Frontend URL:** `https://watchtower-ai.preview.emergentagent.com`
✅ **Supabase URL:** `https://uxyqpdfftxpkzeppqtvk.supabase.co`
✅ **Merge API Key:** Present in environment

**Outlook Status (From Console Logs):**
- `connected: false`
- `message: "Outlook not connected"`
- **This is CORRECT behavior** - my fix is working (not showing false positive)

**Integration Status:**
- Connected Merge integrations: `{outlook: {...}, hubspot: {...}}`
- **Issue:** Outlook showing in Merge integrations (should not be there)

---

## CRITICAL FINDING FROM SCREENSHOTS

### 🔴 PROBLEM IDENTIFIED

**From logs:**
```
Connected Merge integrations: {
  outlook: { category: 'email', connected: true, ... },
  hubspot: { category: 'crm', connected: true, ... }
}
```

**This is WRONG!**
- Outlook should NOT appear in Merge integrations
- Outlook is NOT connected via Merge
- This is causing UI confusion

**Root Cause:** `/api/integrations/merge/connected` is returning Outlook from `integration_accounts` table even though it's not a Merge integration.

---

## IMMEDIATE ACTION REQUIRED

I need to:
1. ✅ Create endpoint checklist (THIS FILE)
2. 🔧 Fix `/api/integrations/merge/connected` to exclude non-Merge integrations (Outlook, Gmail)
3. 🔧 Separate email/calendar from CRM integrations in UI
4. 🔧 Ensure Supabase Edge Functions are the authority for email

**This requires a focused fix following the safe delivery protocol.**

---

## NEXT STEP

I should proceed with:
**Task:** Fix Merge endpoint to exclude email category + Separate email UI section

**Do you want me to proceed with this fix following the safe delivery protocol (one changeset, pre-checks, post-checks, rollback)?**
