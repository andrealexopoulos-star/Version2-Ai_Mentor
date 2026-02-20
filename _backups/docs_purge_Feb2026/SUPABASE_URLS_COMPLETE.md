# 🔵 COMPLETE SUPABASE URLS REFERENCE

**Project ID:** uxyqpdfftxpkzeppqtvk  
**Project Reference:** uxyqpdfftxpkzeppqtvk  
**Region:** US East (default)

---

## 🌐 SUPABASE BASE URLS

### Main Project URL
```
https://uxyqpdfftxpkzeppqtvk.supabase.co
```

### Supabase Dashboard (Admin Interface)
```
https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk
```

**Quick Links:**
- Dashboard Home: https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk
- Database: https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/editor
- Authentication: https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/auth/users
- Edge Functions: https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/functions
- Storage: https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/storage/buckets
- API Settings: https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/settings/api

---

## 🔐 SUPABASE AUTH URLS

### Authentication Configuration

**Site URL (Primary App URL):**
```
https://biqc-production-fix.preview.emergentagent.com
```

**Where to Set:**
- Supabase Dashboard → Authentication → URL Configuration → Site URL

**Redirect URLs (OAuth Callbacks):**
```
https://biqc-production-fix.preview.emergentagent.com/auth/callback
https://biqc-production-fix.preview.emergentagent.com/**
```

**Where to Set:**
- Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

**OAuth Provider Configuration Page:**
```
https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/auth/providers
```

**Providers to Enable:**
1. **Google** (for account login via Supabase)
2. **Azure** (for account login via Supabase)

**Note:** These are DIFFERENT from Gmail/Outlook integrations which use direct OAuth.

---

## 🔌 SUPABASE API ENDPOINTS

### REST API Base URL
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/rest/v1
```

**Usage:** Database table operations (select, insert, update, delete)

**Authentication:** Requires `apikey` header + `Authorization: Bearer [token]`

---

### Auth API Base URL
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/auth/v1
```

**Endpoints:**
- Sign up: `/auth/v1/signup`
- Sign in: `/auth/v1/token?grant_type=password`
- OAuth: `/auth/v1/authorize`
- Session: `/auth/v1/user`

**Usage:** Managed by Supabase JavaScript SDK, not called directly

---

### Realtime API (WebSocket)
```
wss://uxyqpdfftxpkzeppqtvk.supabase.co/realtime/v1/websocket
```

**Usage:** Real-time database subscriptions (if used)

---

### Storage API
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/storage/v1
```

**Usage:** File uploads/downloads (if used)

---

## ⚡ SUPABASE EDGE FUNCTIONS

### Base URL
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1
```

### Deployed Edge Functions

**1. Gmail Production Function**
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_prod
```
- **Purpose:** Check Gmail connection status, verify tokens
- **Location:** `/app/supabase_edge_functions/gmail_prod/`
- **Called By:** Frontend Integrations.js (line ~235)
- **Method:** POST
- **Auth:** Requires `Authorization: Bearer [user_token]`

**2. Email Priority Function**
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/email_priority
```
- **Purpose:** Analyze email priority for Priority Inbox
- **Location:** `/app/supabase_edge_functions/email_priority/`
- **Called By:** Backend (priority inbox logic)
- **Method:** POST

**3. Gmail Test Function** (Development Only)
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_test
```
- **Purpose:** Testing Gmail integration
- **Location:** `/app/supabase_edge_functions/gmail_test/`
- **Status:** Development/testing only

**4. Integration Status Function**
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/integration-status
```
- **Purpose:** Check integration status
- **Location:** `/app/supabase_edge_functions/integration-status/`
- **Status:** Unknown usage (needs verification)

---

## 🔑 SUPABASE API KEYS

### Anon Key (Public - Safe for Frontend)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k
```

**Used By:**
- Frontend SDK initialization
- Public API calls
- Client-side auth

### Service Role Key (Secret - Backend Only)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQzNzA0NywiZXhwIjoyMDg0MDEzMDQ3fQ.Of8sBhmza-QMmtlQ-EN7kpqcDuiy512TlY2Gku9YuX4
```

**Used By:**
- Backend server
- Edge Functions
- Admin operations
- Bypasses Row Level Security (RLS)

**⚠️ NEVER expose this in frontend code**

---

## 📋 SUPABASE DASHBOARD CONFIGURATION CHECKLIST

### Step 1: URL Configuration

**Navigate to:** Authentication → URL Configuration

**Settings to Configure:**

| Setting | Value | Status |
|---------|-------|--------|
| **Site URL** | `https://biqc-production-fix.preview.emergentagent.com` | ⏳ Verify |
| **Redirect URLs** | See below | ⏳ Verify |

**Redirect URLs (Add All):**
```
https://biqc-production-fix.preview.emergentagent.com/auth/callback
https://biqc-production-fix.preview.emergentagent.com/**
```

**Screenshot for Reference:**
- URL Configuration page should show both URLs listed

---

### Step 2: OAuth Providers

**Navigate to:** Authentication → Providers

**Enable These Providers:**

#### ✅ Google Provider (Account Login)
- [ ] Click "Google" in providers list
- [ ] Enable provider
- [ ] **DO NOT need to configure Client ID/Secret** (Supabase manages)
- [ ] OR use your own: Client ID from Google Console
- [ ] Scopes: Managed by Supabase

**Supabase Generated OAuth URL:**
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/auth/v1/authorize?provider=google
```

#### ✅ Azure Provider (Account Login)
- [ ] Click "Azure" in providers list
- [ ] Enable provider
- [ ] **May need to configure:**
  - Azure Application (client) ID
  - Azure Application Secret
  - Tenant ID: `common`
- [ ] Scopes: Managed by Supabase

**Supabase Generated OAuth URL:**
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/auth/v1/authorize?provider=azure
```

**⚠️ IMPORTANT:** This Azure app may be DIFFERENT from Outlook integration app.
- **Supabase Auth Azure:** For account login (different app)
- **Outlook Integration:** For email sync (uses `5d6e3cbb-cd88-4694-aa19-9b7115666866`)

---

### Step 3: Edge Functions

**Navigate to:** Edge Functions

**Verify Deployed Functions:**

| Function Name | URL | Status | Purpose |
|---------------|-----|--------|---------|
| **gmail_prod** | `https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_prod` | ⏳ Check | Gmail connection check |
| **email_priority** | `https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/email_priority` | ⏳ Check | Priority inbox analysis |
| **gmail_test** | `https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_test` | ⏳ Optional | Testing only |
| **integration-status** | `https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/integration-status` | ⏳ Check | Integration status |

**How to Deploy Edge Functions (If Not Deployed):**

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref uxyqpdfftxpkzeppqtvk

# Deploy all functions
supabase functions deploy gmail_prod
supabase functions deploy email_priority
```

**Verify Deployment:**
```bash
# Test gmail_prod
curl -i https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_prod \
  -H "Authorization: Bearer [user-token]" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** 200 OK (or 401 if token invalid)

---

### Step 4: Edge Function Secrets

**Navigate to:** Edge Functions → Edge Function Secrets

**Set These Secrets:**

```
SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
GOOGLE_CLIENT_ID=903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

**Why Needed:** Edge Functions need these to access Gmail API and Supabase database

---

### Step 5: Database Tables

**Navigate to:** Database → Tables

**Verify These Tables Exist:**

- [ ] `users` (has `account_id` column)
- [ ] `accounts` (workspaces)
- [ ] `integration_accounts` (integration state)
- [ ] `outlook_oauth_tokens` (Outlook tokens)
- [ ] `gmail_connections` (Gmail tokens)
- [ ] `outlook_emails` (synced emails)
- [ ] `outlook_calendar_events` (synced calendar)
- [ ] All other app tables

**How to Check:**
- Click each table name
- Verify schema matches app needs

---

## 🔧 SUPABASE CONFIGURATION COMMANDS

### Check Current Configuration

**From your local machine (with Supabase CLI):**

```bash
# Get project info
supabase projects list

# Get project settings
supabase projects api-keys --project-ref uxyqpdfftxpkzeppqtvk
```

### Verify Edge Functions Deployed

```bash
# List deployed functions
supabase functions list --project-ref uxyqpdfftxpkzeppqtvk
```

**Expected Output:**
```
gmail_prod (deployed)
email_priority (deployed)
gmail_test (deployed - optional)
integration-status (deployed - optional)
```

---

## 📊 SUPABASE URL SUMMARY

### For Google Cloud Console (If Using Custom OAuth):
**Authorized Redirect URIs:**
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/auth/v1/callback
```
**Note:** Only needed if configuring custom Google OAuth in Supabase (not using Supabase-managed)

### For Your Application Code:
**Already Configured:**
- Frontend env: `REACT_APP_SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co` ✅
- Backend env: `SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co` ✅

### For Third-Party Callbacks:
**Your app redirects users back to:**
```
https://biqc-production-fix.preview.emergentagent.com/auth/callback
```
**NOT** to Supabase URLs directly.

---

## ✅ WHAT TO CONFIGURE IN SUPABASE DASHBOARD

### 1. Authentication → URL Configuration
- [x] Site URL: `https://biqc-production-fix.preview.emergentagent.com`
- [ ] **ADD** Redirect URL: `https://biqc-production-fix.preview.emergentagent.com/auth/callback`
- [ ] **ADD** Redirect URL: `https://biqc-production-fix.preview.emergentagent.com/**`

### 2. Authentication → Providers
- [ ] **Enable Google** (for account login)
  - Option A: Use Supabase-managed OAuth (easiest)
  - Option B: Bring your own Google Client ID
- [ ] **Enable Azure** (for account login)
  - Configure Azure Application ID
  - Configure Azure Secret
  - Set Tenant ID: `common`

### 3. Edge Functions
- [ ] Verify `gmail_prod` is deployed
- [ ] Verify `email_priority` is deployed
- [ ] Configure Edge Function secrets (see below)

### 4. Edge Function Secrets
**Navigate to:** Edge Functions → Edge Function Secrets

**Click "Add Secret" for each:**
```
Name: SUPABASE_URL
Value: https://uxyqpdfftxpkzeppqtvk.supabase.co

Name: SUPABASE_SERVICE_ROLE_KEY  
Value: [your-service-role-key]

Name: GOOGLE_CLIENT_ID
Value: 903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com

Name: GOOGLE_CLIENT_SECRET
Value: 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
```

**Why:** Edge Functions need these to call Gmail API

---

## 🧪 VERIFICATION TESTS

### Test 1: Supabase Auth Works
```bash
# From frontend, initiate Google login
# Should redirect to Supabase OAuth URL
# Then redirect back to /auth/callback
```

### Test 2: Edge Function Reachable
```bash
curl -i https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_prod \
  -H "Authorization: Bearer [user-jwt-token]" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** 200 OK or 401 (if token invalid)

### Test 3: Database Access
```bash
curl https://uxyqpdfftxpkzeppqtvk.supabase.co/rest/v1/users?select=id,email&limit=1 \
  -H "apikey: [anon-key]" \
  -H "Authorization: Bearer [service-role-key]"
```

**Expected:** JSON response with user data

---

## 📝 CONFIGURATION STATUS

### ✅ Already Configured (From Env Files)
- Supabase URL in frontend ✅
- Supabase URL in backend ✅
- Anon key in frontend ✅
- Service role key in backend ✅

### ⏳ Need to Verify in Supabase Dashboard
- [ ] Site URL matches your domain
- [ ] Redirect URLs include `/auth/callback`
- [ ] Google provider enabled
- [ ] Azure provider enabled
- [ ] Edge Functions deployed
- [ ] Edge Function secrets configured

---

## 🚨 CRITICAL ACTIONS REQUIRED

### Immediate (Must Do):
1. **Go to Supabase Dashboard:**
   ```
   https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/auth/url-configuration
   ```

2. **Verify/Add Site URL:**
   ```
   https://biqc-production-fix.preview.emergentagent.com
   ```

3. **Verify/Add Redirect URLs:**
   ```
   https://biqc-production-fix.preview.emergentagent.com/auth/callback
   https://biqc-production-fix.preview.emergentagent.com/**
   ```

4. **Check Edge Functions:**
   ```
   https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/functions
   ```
   - Confirm `gmail_prod` is deployed
   - Confirm `email_priority` is deployed

5. **Configure Edge Function Secrets:**
   ```
   https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/functions
   ```
   - Click "Edge Function Secrets"
   - Add all 4 secrets listed above

---

## 📖 QUICK REFERENCE

**Project:** `uxyqpdfftxpkzeppqtvk`

**All Supabase URLs you need:**
```
Dashboard: https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk
API: https://uxyqpdfftxpkzeppqtvk.supabase.co
Edge Functions: https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1
Gmail Check: https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_prod
```

**Your App URLs:**
```
Site URL: https://biqc-production-fix.preview.emergentagent.com
Auth Callback: https://biqc-production-fix.preview.emergentagent.com/auth/callback
```

---

**ALL SUPABASE URLS DOCUMENTED. PLEASE VERIFY DASHBOARD SETTINGS MATCH.**
