# 🚀 POST-DEPLOYMENT URL UPDATE GUIDE

## 📋 Overview

After deploying your BIQC application to production, you **MUST** update all OAuth redirect URLs and configuration settings across multiple platforms. This guide provides a step-by-step checklist with exact copy-paste values.

---

## 🎯 What You Need

Your **production deployment URL**. This guide assumes:

```
YOUR_PRODUCTION_URL = https://your-app.emergentagent.com
```

**⚠️ IMPORTANT**: Replace `https://your-app.emergentagent.com` with your actual Emergent deployment URL throughout this guide.

---

## 📍 Step 1: Microsoft Azure App Registration (Outlook Integration)

### 1.1 Navigate to Azure Portal

Go to: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

### 1.2 Find Your App Registration

Look for your app (likely named "BIQC" or "The Strategy Squad")

### 1.3 Update Redirect URIs

1. Click on your app
2. Navigate to: **Authentication** (left sidebar)
3. Under **Platform configurations → Web → Redirect URIs**
4. Click **+ Add URI**
5. Add this exact URL:

```
https://your-app.emergentagent.com/api/auth/outlook/callback
```

### 1.4 Verify API Permissions

Ensure these permissions are granted:
- ✅ `offline_access`
- ✅ `User.Read`
- ✅ `Mail.Read`
- ✅ `Mail.ReadBasic`
- ✅ `Calendars.Read`
- ✅ `Calendars.ReadBasic`

### 1.5 Get Your Credentials

You'll need these for later steps:

**Application (client) ID**: 
```
Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Location: Azure Portal → Your App → Overview → Application (client) ID
```

**Client Secret**: 
```
Location: Azure Portal → Your App → Certificates & secrets → Client secrets
⚠️ If you don't have one, create a new secret NOW (you can't retrieve old ones)
```

---

## 📍 Step 2: Google Cloud Console (Gmail Integration)

### 2.1 Navigate to Google Cloud Console

Go to: https://console.cloud.google.com/apis/credentials

### 2.2 Find Your OAuth 2.0 Client ID

Look for your Web client (e.g., "BIQC Web Client")

### 2.3 Update Authorized Redirect URIs

1. Click on your OAuth 2.0 Client ID
2. Under **Authorized redirect URIs**, click **+ ADD URI**
3. Add this exact URL:

```
https://your-app.emergentagent.com/api/auth/gmail/callback
```

4. Click **SAVE**

### 2.4 Verify OAuth Consent Screen

1. Navigate to: **OAuth consent screen** (left sidebar)
2. Ensure your app is **Published** (not in testing mode)
3. Verify these scopes are configured:
   - ✅ `openid`
   - ✅ `email`
   - ✅ `profile`
   - ✅ `https://www.googleapis.com/auth/gmail.readonly`

### 2.5 Get Your Credentials

**Client ID**:
```
Format: xxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
Location: Google Cloud Console → Credentials → OAuth 2.0 Client IDs → Client ID
```

**Client Secret**:
```
Location: Google Cloud Console → Credentials → OAuth 2.0 Client IDs → Client secret
```

---

## 📍 Step 3: Supabase Configuration

### 3.1 Update Supabase URL Configuration

1. Go to: **Supabase Dashboard → Authentication → URL Configuration**

2. Set **Site URL**:
```
https://your-app.emergentagent.com
```

3. Add **ALL** of these to **Redirect URLs** (one per line):

```
https://your-app.emergentagent.com/**
https://your-app.emergentagent.com/auth/callback
https://your-app.emergentagent.com/connect-email
https://your-app.emergentagent.com/integrations
https://your-app.emergentagent.com/dashboard
http://localhost:3000/**
```

4. Click **SAVE**

### 3.2 Update Edge Function Secrets

#### For `outlook-auth` Edge Function:

1. Go to: **Supabase Dashboard → Edge Functions → outlook-auth → Settings → Secrets**
2. Update or add these secrets:

| Secret Name | Secret Value |
|-------------|--------------|
| `AZURE_CLIENT_ID` | `[Your Azure Application (client) ID from Step 1.5]` |
| `AZURE_CLIENT_SECRET` | `[Your Azure Client Secret from Step 1.5]` |
| `BACKEND_URL` | `https://your-app.emergentagent.com` |

**Note**: The following secrets should already exist (auto-configured by Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

#### For `gmail_prod` Edge Function:

1. Go to: **Supabase Dashboard → Edge Functions → gmail_prod → Settings → Secrets**
2. Update or add these secrets:

| Secret Name | Secret Value |
|-------------|--------------|
| `GOOGLE_CLIENT_ID` | `[Your Google Client ID from Step 2.5]` |
| `GOOGLE_CLIENT_SECRET` | `[Your Google Client Secret from Step 2.5]` |
| `BACKEND_URL` | `https://your-app.emergentagent.com` |

#### For `email_priority` Edge Function:

1. Go to: **Supabase Dashboard → Edge Functions → email_priority → Settings → Secrets**
2. Verify `BACKEND_URL` is set:

| Secret Name | Secret Value |
|-------------|--------------|
| `BACKEND_URL` | `https://your-app.emergentagent.com` |

---

## 📍 Step 4: Emergent Platform Environment Variables

### 4.1 Backend Environment Variables

These should be configured in your Emergent deployment settings (NOT in your codebase):

```env
# Backend URL (your production deployment)
BACKEND_URL=https://your-app.emergentagent.com
FRONTEND_URL=https://your-app.emergentagent.com

# Supabase (already configured)
SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
SUPABASE_KEY=[Your existing Supabase anon key]
SUPABASE_SERVICE_KEY=[Your existing Supabase service role key]

# Microsoft Azure OAuth
AZURE_CLIENT_ID=[From Step 1.5]
AZURE_CLIENT_SECRET=[From Step 1.5]
AZURE_TENANT_ID=common

# Google OAuth
GOOGLE_CLIENT_ID=[From Step 2.5]
GOOGLE_CLIENT_SECRET=[From Step 2.5]

# JWT Secret (already configured)
JWT_SECRET_KEY=[Your existing JWT secret]

# MongoDB (already configured)
MONGO_URL=[Your existing MongoDB URL]
DB_NAME=[Your existing DB name]

# AI Keys (already configured)
EMERGENT_LLM_KEY=[Your existing Emergent LLM key]
OPENAI_API_KEY=[Your existing OpenAI key]

# Other integrations (already configured)
SERPER_API_KEY=[Your existing Serper key]
MERGE_API_KEY=[Your existing Merge.dev key]
```

### 4.2 Frontend Environment Variables

These should be configured in your Emergent deployment settings:

```env
REACT_APP_BACKEND_URL=https://your-app.emergentagent.com
REACT_APP_SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=[Your existing Supabase anon key]
```

---

## 📍 Step 5: Merge.dev Configuration (HubSpot Integration)

### 5.1 Update Redirect URI

1. Go to: https://app.merge.dev/configuration/link
2. Navigate to your **Link Configuration**
3. Update **Redirect URI** to:

```
https://your-app.emergentagent.com/integrations
```

4. Save changes

---

## 📍 Step 6: Verification & Testing

### 6.1 Test Supabase Authentication

1. Navigate to: `https://your-app.emergentagent.com/login`
2. Try logging in with test credentials
3. ✅ Should successfully authenticate and redirect

### 6.2 Test Outlook Connection

1. Navigate to: `https://your-app.emergentagent.com/connect-email`
2. Click **"Connect Outlook"**
3. Authorize with Microsoft
4. ✅ Should redirect back to `/connect-email?outlook_connected=true`
5. ✅ UI should show "Connected to Outlook"

**Debug if it fails**:
```sql
-- Check connection state in Supabase SQL Editor
SELECT * FROM email_connections WHERE user_id = auth.uid();
```

### 6.3 Test Gmail Connection

1. Navigate to: `https://your-app.emergentagent.com/connect-email`
2. Click **"Connect Gmail"**
3. Authorize with Google
4. ✅ Should redirect back to `/connect-email?gmail_connected=true`
5. ✅ UI should show "Connected to Gmail"

**Debug if it fails**:
```sql
-- Check connection state in Supabase SQL Editor
SELECT * FROM gmail_connections WHERE user_id = auth.uid();
```

### 6.4 Test HubSpot Integration

1. Navigate to: `https://your-app.emergentagent.com/integrations`
2. Click **"Connect HubSpot"**
3. Complete Merge.dev authorization flow
4. ✅ Should redirect back and show "Connected"

### 6.5 Test Priority Inbox

1. Ensure email is connected (Outlook or Gmail)
2. Navigate to: `https://your-app.emergentagent.com/email-inbox`
3. ✅ Should load inbox with priority analysis

---

## 📍 Step 7: Security Verification

### 7.1 Verify RLS Policies (CRITICAL)

Run this in Supabase SQL Editor:

```sql
-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('email_connections', 'outlook_oauth_tokens', 'gmail_connections')
ORDER BY tablename;

-- Expected result: All should show rowsecurity = true
```

### 7.2 Test Data Isolation

1. Log in as User A
2. Note their email connections
3. Log out
4. Log in as User B
5. ✅ Should NOT see User A's connections

---

## 📋 Complete Checklist

### Microsoft Azure
- [ ] Redirect URI updated: `https://your-app.emergentagent.com/api/auth/outlook/callback`
- [ ] All 6 API permissions verified
- [ ] Application (client) ID copied
- [ ] Client Secret copied or created

### Google Cloud Console
- [ ] Redirect URI updated: `https://your-app.emergentagent.com/api/auth/gmail/callback`
- [ ] All 4 scopes verified
- [ ] OAuth consent screen published
- [ ] Client ID copied
- [ ] Client Secret copied

### Supabase
- [ ] Site URL updated: `https://your-app.emergentagent.com`
- [ ] All redirect URLs added
- [ ] `outlook-auth` Edge Function secrets updated (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, BACKEND_URL)
- [ ] `gmail_prod` Edge Function secrets updated (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKEND_URL)
- [ ] `email_priority` Edge Function BACKEND_URL updated
- [ ] RLS policies verified (all 3 tables)

### Emergent Platform
- [ ] Backend environment variables updated
- [ ] Frontend environment variables updated
- [ ] Application redeployed with new environment variables

### Merge.dev
- [ ] Redirect URI updated: `https://your-app.emergentagent.com/integrations`

### Testing
- [ ] Login/authentication works
- [ ] Outlook connection works
- [ ] Gmail connection works
- [ ] HubSpot integration works
- [ ] Priority Inbox loads
- [ ] Data isolation verified (RLS)

---

## 🚨 Common Issues & Solutions

### Issue 1: "Invalid redirect_uri" from Microsoft

**Cause**: Azure redirect URI doesn't match exactly

**Fix**:
1. Check the exact URL in your browser when the error occurs
2. Ensure Azure redirect URI is: `https://your-app.emergentagent.com/api/auth/outlook/callback`
3. Ensure there are no trailing slashes or extra characters
4. Wait 2-3 minutes after updating (Azure has propagation delay)

### Issue 2: "redirect_uri_mismatch" from Google

**Cause**: Google redirect URI doesn't match exactly

**Fix**:
1. Check Google Cloud Console → Credentials → Your OAuth Client → Authorized redirect URIs
2. Ensure it matches: `https://your-app.emergentagent.com/api/auth/gmail/callback`
3. Click SAVE and wait 1-2 minutes

### Issue 3: "Unauthorized" when calling Edge Functions

**Cause**: Edge Function secrets not updated

**Fix**:
1. Go to Supabase Dashboard → Edge Functions
2. Check EACH function's secrets
3. Ensure `BACKEND_URL` matches your production URL
4. Redeploy the Edge Function after updating secrets

### Issue 4: Connection shows "Connected" but no emails

**Cause**: Tokens are stored but email sync hasn't run yet

**Fix**: This is expected behavior. Email sync runs in the background. Wait 1-2 minutes and refresh.

### Issue 5: "User can see other user's data"

**Cause**: RLS policies not applied

**Fix**: Run the RLS policy script from earlier (already provided to you)

---

## 📞 Need Help?

### Check Logs

**Backend logs** (if you have access to pod):
```bash
tail -f /var/log/supervisor/backend.out.log | grep -i "outlook\|gmail\|error"
```

**Edge Function logs**:
1. Supabase Dashboard → Edge Functions → [Function Name] → Logs
2. Look for errors or failed invocations

### Check Database State

```sql
-- Check email connections
SELECT * FROM email_connections WHERE user_id = auth.uid();

-- Check Outlook tokens
SELECT user_id, account_email, expires_at 
FROM outlook_oauth_tokens 
WHERE user_id = auth.uid();

-- Check Gmail tokens
SELECT user_id, email, token_expiry 
FROM gmail_connections 
WHERE user_id = auth.uid();
```

---

## 🎯 Quick Reference: URLs to Update

| Platform | What to Update | New Value |
|----------|----------------|-----------|
| **Azure Portal** | Redirect URI | `https://your-app.emergentagent.com/api/auth/outlook/callback` |
| **Google Cloud** | Authorized Redirect URI | `https://your-app.emergentagent.com/api/auth/gmail/callback` |
| **Supabase** | Site URL | `https://your-app.emergentagent.com` |
| **Supabase** | Redirect URLs | `https://your-app.emergentagent.com/**` (+ others) |
| **Supabase Edge Functions** | BACKEND_URL secret | `https://your-app.emergentagent.com` |
| **Emergent Backend .env** | BACKEND_URL | `https://your-app.emergentagent.com` |
| **Emergent Backend .env** | FRONTEND_URL | `https://your-app.emergentagent.com` |
| **Emergent Frontend .env** | REACT_APP_BACKEND_URL | `https://your-app.emergentagent.com` |
| **Merge.dev** | Redirect URI | `https://your-app.emergentagent.com/integrations` |

---

## ✅ Success Criteria

After completing all steps, you should be able to:

✅ Log in to the application  
✅ Connect Outlook and see your email  
✅ Connect Gmail and see your email  
✅ Switch between email providers  
✅ View Priority Inbox with AI analysis  
✅ Connect HubSpot via Merge.dev  
✅ Each user sees ONLY their own data (RLS working)  
✅ No "redirect_uri" errors  
✅ No "unauthorized" errors  

---

**Last Updated**: January 2025  
**Status**: Production Deployment Ready ✅  
**Critical**: Complete ALL steps before testing in production
