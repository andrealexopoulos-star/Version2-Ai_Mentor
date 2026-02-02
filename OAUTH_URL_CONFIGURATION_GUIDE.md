# BIQC OAUTH CONFIGURATION GUIDE - COMPLETE URL LIST

## YOUR PRODUCTION URL
```
https://biqc-advisor.preview.emergentagent.com
```

---

## 1. SUPABASE CONFIGURATION

### Location:
**Supabase Dashboard** → **Authentication** → **URL Configuration**

### Site URL:
```
https://biqc-advisor.preview.emergentagent.com
```

### Redirect URLs (add ALL of these):
```
https://biqc-advisor.preview.emergentagent.com
https://biqc-advisor.preview.emergentagent.com/
https://biqc-advisor.preview.emergentagent.com/auth/callback
https://biqc-advisor.preview.emergentagent.com/auth-callback-supabase
https://biqc-advisor.preview.emergentagent.com/**
```

### Additional Redirect URLs (Email/Social Auth):
```
https://biqc-advisor.preview.emergentagent.com/connect-email
https://biqc-advisor.preview.emergentagent.com/integrations
```

### Email Templates (if using magic links):
Confirm email contains: `https://biqc-advisor.preview.emergentagent.com/auth/callback`

---

## 2. AZURE AD (MICROSOFT OUTLOOK) CONFIGURATION

### Location:
**Azure Portal** → **App Registrations** → Select your app → **Authentication**

### Current Azure App Details (from your .env):
- **Tenant ID**: `af75a88f-8c78-46dd-bda8-faa925d316d9`
- **Client ID**: `biqc-advisor` (⚠️ This looks wrong - should be a GUID)
- **Client Secret**: `3co8Q~PnscNo_dvuAw~HnlhhJzJsP~7sj3X3tc0E`

### Redirect URIs (Platform: Web):
```
https://biqc-advisor.preview.emergentagent.com/api/auth/outlook/callback
```

### Front-channel logout URL:
```
https://biqc-advisor.preview.emergentagent.com
```

### Supported account types:
- Select: **Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts**

### API Permissions Required:
- `User.Read` (Microsoft Graph)
- `Mail.Read` (Microsoft Graph)
- `Calendars.Read` (Microsoft Graph)
- `offline_access` (for refresh tokens)

**⚠️ CRITICAL ISSUE**: Your `AZURE_CLIENT_ID` is set to `biqc-advisor` but it should be a GUID like `12345678-1234-1234-1234-123456789abc`

**ACTION REQUIRED**:
1. Go to Azure Portal → App Registrations
2. Find your BIQC app
3. Copy the **Application (client) ID** (it's a GUID)
4. Update `/app/backend/.env`: `AZURE_CLIENT_ID=<the-actual-guid>`

---

## 3. GOOGLE OAUTH (GMAIL) CONFIGURATION

### Location:
**Google Cloud Console** → **APIs & Services** → **Credentials** → Select your OAuth 2.0 Client

### Current Google Client Details (from your .env):
- **Client ID**: `903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com`
- **Client Secret**: `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`

### Authorized JavaScript origins:
```
https://biqc-advisor.preview.emergentagent.com
```

### Authorized redirect URIs:
```
https://biqc-advisor.preview.emergentagent.com/api/auth/gmail/callback
```

### Scopes enabled (Google Workspace APIs):
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

---

## 4. SUPABASE EDGE FUNCTIONS (if applicable)

### Location:
**Supabase Dashboard** → **Edge Functions** → **Secrets**

### Required secrets (match backend .env):
```
AZURE_CLIENT_ID=<YOUR-ACTUAL-AZURE-CLIENT-ID-GUID>
AZURE_CLIENT_SECRET=3co8Q~PnscNo_dvuAw~HnlhhJzJsP~7sj3X3tc0E
AZURE_TENANT_ID=af75a88f-8c78-46dd-bda8-faa925d316d9
GOOGLE_CLIENT_ID=903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

---

## 5. CHECKLIST - VERIFY EACH PLATFORM

### ✅ SUPABASE
- [ ] Site URL = `https://biqc-advisor.preview.emergentagent.com`
- [ ] All redirect URLs added (see section 1)
- [ ] Email confirmation enabled/disabled (your choice)
- [ ] RLS policies enabled on relevant tables

### ✅ AZURE AD
- [ ] Redirect URI = `https://biqc-advisor.preview.emergentagent.com/api/auth/outlook/callback`
- [ ] **Fix Client ID** - Should be a GUID, not "biqc-advisor"
- [ ] Client Secret matches: `3co8Q~PnscNo_dvuAw~HnlhhJzJsP~7sj3X3tc0E`
- [ ] Tenant ID matches: `af75a88f-8c78-46dd-bda8-faa925d316d9`
- [ ] API permissions granted (Mail.Read, Calendars.Read, offline_access)
- [ ] Multitenant support enabled

### ✅ GOOGLE CLOUD
- [ ] Authorized redirect URI = `https://biqc-advisor.preview.emergentagent.com/api/auth/gmail/callback`
- [ ] JavaScript origin = `https://biqc-advisor.preview.emergentagent.com`
- [ ] Gmail API enabled
- [ ] OAuth consent screen configured

---

## 6. COMMON LOOPING CAUSES & FIXES

### Issue 1: Infinite Redirect Loop
**Cause**: Supabase Site URL doesn't match your actual domain
**Fix**: Set Supabase Site URL to exactly `https://biqc-advisor.preview.emergentagent.com` (no trailing slash)

### Issue 2: Azure OAuth Loop
**Cause**: Wrong Client ID (you have "biqc-advisor" instead of GUID)
**Fix**: 
1. Azure Portal → App Registrations → Your app → Overview
2. Copy "Application (client) ID" (looks like: `12345678-1234-1234-1234-123456789abc`)
3. Update backend .env: `AZURE_CLIENT_ID=<that-guid>`
4. Restart backend: `sudo supervisorctl restart backend`

### Issue 3: Gmail OAuth Loop
**Cause**: Redirect URI mismatch
**Fix**: Ensure Google Console has EXACTLY: `https://biqc-advisor.preview.emergentagent.com/api/auth/gmail/callback`

### Issue 4: Supabase Auth Loop
**Cause**: Missing redirect URL in allowed list
**Fix**: Add `https://biqc-advisor.preview.emergentagent.com/**` to Supabase redirect URLs (wildcard pattern)

---

## 7. TESTING PROCEDURE

After updating all URLs:

1. **Clear browser cache completely**
2. **Try login flow**:
   - Go to `https://biqc-advisor.preview.emergentagent.com`
   - Click "Log In"
   - Should redirect to Supabase auth
   - Should land on `/advisor` after successful login

3. **Try Outlook connect**:
   - Go to `/connect-email`
   - Click "Connect Outlook"
   - Should redirect to Microsoft login
   - Should callback to `/api/auth/outlook/callback`
   - Should redirect back to `/connect-email?outlook_connected=true`

4. **Try Gmail connect**:
   - Click "Connect Gmail"
   - Should redirect to Google login
   - Should callback to `/api/auth/gmail/callback`
   - Should redirect back to `/connect-email?gmail_connected=true`

---

## 8. EMERGENCY: IF STILL LOOPING

**Check browser console for errors**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors containing "redirect", "callback", or "CORS"
4. Share the error message

**Check backend logs**:
```bash
tail -n 100 /var/log/supervisor/backend.err.log | grep -E "callback|redirect|ERROR"
```

**Force clear all sessions**:
1. Browser: Settings → Clear all cookies and site data
2. Supabase Dashboard → Authentication → Users → Delete test user → Re-register
3. Try login again

---

## QUICK REFERENCE - ALL URLS IN ONE PLACE

```
PRODUCTION DOMAIN:
https://biqc-advisor.preview.emergentagent.com

SUPABASE SITE URL:
https://biqc-advisor.preview.emergentagent.com

SUPABASE REDIRECT URLs:
https://biqc-advisor.preview.emergentagent.com/**

AZURE REDIRECT URI:
https://biqc-advisor.preview.emergentagent.com/api/auth/outlook/callback

GOOGLE REDIRECT URI:
https://biqc-advisor.preview.emergentagent.com/api/auth/gmail/callback

GOOGLE JAVASCRIPT ORIGIN:
https://biqc-advisor.preview.emergentagent.com
```

**Copy these EXACTLY (no typos, no extra slashes)**
