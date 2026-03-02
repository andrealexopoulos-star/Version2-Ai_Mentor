# 🔐 OAuth Setup Guide - Email Integration

## 📋 Overview

BIQC email integration requires OAuth apps to be configured with Microsoft and Google. This document provides the **exact redirect URLs** you need to configure in your OAuth applications.

---

## 🎯 Current Environment URLs

Based on your deployment configuration:

- **Backend URL**: `https://beta.thestrategysquad.com`
- **Frontend URL**: `https://beta.thestrategysquad.com`
- **Supabase URL**: `https://uxyqpdfftxpkzeppqtvk.supabase.co`

---

## 1️⃣ Microsoft Outlook OAuth Setup

### Azure App Registration

1. **Go to**: [Azure Portal - App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)

2. **Select your app** or create a new one if needed

3. **Navigate to**: Authentication → Platform configurations → Web

4. **Add Redirect URI**:
   ```
   https://beta.thestrategysquad.com/api/auth/outlook/callback
   ```

5. **API Permissions Required**:
   - `offline_access` (to get refresh token)
   - `User.Read` (to get user profile)
   - `Mail.Read` (to read emails)
   - `Mail.ReadBasic` (to read basic email metadata)
   - `Calendars.Read` (to read calendar events)
   - `Calendars.ReadBasic` (to read basic calendar metadata)

6. **Save Configuration**

### Environment Variables Needed

Ensure these are set in `/app/backend/.env`:

```bash
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=common  # or your specific tenant ID
```

---

## 2️⃣ Gmail OAuth Setup

### Google Cloud Console

1. **Go to**: [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)

2. **Select your project**

3. **Navigate to**: OAuth 2.0 Client IDs → Select your Web application

4. **Add Authorized Redirect URI**:
   ```
   https://beta.thestrategysquad.com/api/auth/gmail/callback
   ```

5. **Scopes Required**:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/gmail.readonly`

6. **Save Configuration**

### Environment Variables Needed

Ensure these are set in `/app/backend/.env`:

```bash
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## 3️⃣ Supabase Edge Functions Setup

### Required Secrets

Both Edge Functions need access to OAuth credentials. Set these in Supabase Dashboard:

**For `outlook-auth` function**:
1. Go to: Supabase Dashboard → Edge Functions → outlook-auth → Settings
2. Add secrets:
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `BACKEND_URL` = `https://beta.thestrategysquad.com`

**For `gmail_prod` function**:
1. Go to: Supabase Dashboard → Edge Functions → gmail_prod → Settings
2. Add secrets:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `BACKEND_URL` = `https://beta.thestrategysquad.com`

---

## 🔄 Complete OAuth Flow

### For Outlook:

```
1. User clicks "Connect Outlook" in UI
   ↓
2. Frontend redirects to: /api/auth/outlook/login
   ↓
3. Backend redirects to: Microsoft OAuth
   ↓
4. User authorizes app
   ↓
5. Microsoft redirects to: /api/auth/outlook/callback (with code)
   ↓
6. Backend exchanges code for tokens
   ↓
7. Backend sends tokens to Supabase Edge Function (outlook-auth)
   ↓
8. Edge Function writes to:
   - outlook_oauth_tokens (token storage)
   - email_connections (connection state - CANONICAL)
   ↓
9. User redirected back to: /connect-email?outlook_connected=true
```

### For Gmail:

```
1. User clicks "Connect Gmail" in UI
   ↓
2. Frontend redirects to: /api/auth/gmail/login
   ↓
3. Backend redirects to: Google OAuth
   ↓
4. User authorizes app
   ↓
5. Google redirects to: /api/auth/gmail/callback (with code)
   ↓
6. Backend exchanges code for tokens
   ↓
7. Backend sends tokens to Supabase Edge Function (gmail_prod)
   ↓
8. Edge Function writes to:
   - gmail_connections (token storage)
   - email_connections (connection state - CANONICAL)
   ↓
9. User redirected back to: /connect-email?gmail_connected=true
```

---

## 🗄️ Database Tables

### `email_connections` (Single Source of Truth)

This is the **CANONICAL** table that the frontend queries to check connection status.

```sql
CREATE TABLE email_connections (
  user_id UUID PRIMARY KEY,
  provider TEXT NOT NULL,  -- 'outlook' or 'gmail'
  connected BOOLEAN NOT NULL DEFAULT true,
  connected_email TEXT,
  inbox_type TEXT,  -- 'focused', 'priority', or 'standard'
  connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT
);

-- RLS Policy: Users can only access their own connection
CREATE POLICY "Users can view own email connection"
  ON email_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own email connection"
  ON email_connections FOR UPDATE
  USING (auth.uid() = user_id);
```

### `outlook_oauth_tokens` (Token Storage)

```sql
CREATE TABLE outlook_oauth_tokens (
  user_id UUID PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  account_email TEXT,
  account_name TEXT,
  provider TEXT DEFAULT 'microsoft',
  updated_at TIMESTAMPTZ
);
```

### `gmail_connections` (Token Storage)

```sql
CREATE TABLE gmail_connections (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  scopes TEXT,
  updated_at TIMESTAMPTZ
);
```

---

## ✅ Verification Checklist

Before testing the OAuth flow, verify:

- [ ] Microsoft redirect URI added to Azure App Registration
- [ ] Google redirect URI added to Google Cloud Console
- [ ] Backend `.env` has all OAuth credentials
- [ ] Supabase Edge Functions have secrets configured
- [ ] `email_connections` table exists with RLS policies
- [ ] `outlook_oauth_tokens` table exists
- [ ] `gmail_connections` table exists
- [ ] Backend service is running (`sudo supervisorctl status backend`)
- [ ] Edge Functions are deployed (check Supabase Dashboard)

---

## 🐛 Debugging

### Check Backend Logs
```bash
tail -f /var/log/supervisor/backend.out.log
```

### Check Supabase Edge Function Logs
1. Go to Supabase Dashboard
2. Navigate to: Edge Functions → outlook-auth (or gmail_prod)
3. Click "Logs" tab
4. Trigger OAuth flow
5. Check for errors

### Test Connection Status

```bash
# Get session token from browser localStorage
curl -X GET "https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/outlook-auth" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json"
```

### Check Database

From Supabase SQL Editor:
```sql
-- Check if connection state is persisting
SELECT * FROM email_connections WHERE user_id = 'YOUR_USER_ID';

-- Check if tokens are stored
SELECT user_id, account_email, expires_at FROM outlook_oauth_tokens WHERE user_id = 'YOUR_USER_ID';
SELECT user_id, email, token_expiry FROM gmail_connections WHERE user_id = 'YOUR_USER_ID';
```

---

## 📝 Notes

- Only **ONE** email provider can be connected per user at a time (enforced by `user_id` as primary key in `email_connections`)
- Tokens are automatically refreshed when they expire
- Connection state in `email_connections` is the single source of truth for the UI
- Edge Functions handle all OAuth token storage and connection state persistence
- Backend acts as a thin proxy for the initial OAuth redirect

---

## 🆘 Common Issues

### "No email provider connected" after successful OAuth

**Cause**: Edge Function failed to write to `email_connections` table

**Fix**:
1. Check Supabase Edge Function logs
2. Verify RLS policies allow inserts
3. Ensure SUPABASE_SERVICE_ROLE_KEY is correct

### "Invalid redirect_uri" error from Microsoft/Google

**Cause**: Redirect URI mismatch

**Fix**:
1. Verify exact URL in Azure/Google Console matches:
   - Outlook: `https://beta.thestrategysquad.com/api/auth/outlook/callback`
   - Gmail: `https://beta.thestrategysquad.com/api/auth/gmail/callback`
2. No trailing slashes
3. HTTPS required (not HTTP)

### Edge Function timeout

**Cause**: Network issues or slow API responses

**Fix**:
1. Check Supabase Edge Function logs
2. Verify BACKEND_URL secret is correct
3. Test Microsoft/Google API connectivity manually

---

**Last Updated**: December 2025  
**Architecture Version**: Edge Function-First (v2.0)
