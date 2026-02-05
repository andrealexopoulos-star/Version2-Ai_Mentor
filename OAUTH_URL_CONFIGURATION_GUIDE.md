# BIQC OAUTH CONFIGURATION GUIDE - COMPLETE URL LIST

## ✅ BACKEND UPDATED WITH YOUR CREDENTIALS

**Azure Client ID corrected:**
- Old: `AZURE_CLIENT_ID=biqc-advisor` ❌
- New: `AZURE_CLIENT_ID=biqc-advisor-1` ✅

**Azure Tenant ID corrected:**
- Old: `AZURE_TENANT_ID=biqc-advisor` ❌
- New: `AZURE_TENANT_ID=biqc-advisor-1` ✅

Backend restarted successfully.

---

## YOUR PRODUCTION URL
```
https://calibration-hub-9.preview.emergentagent.com
```

---

## 1. SUPABASE CONFIGURATION

### Location:
**Supabase Dashboard** → **Authentication** → **URL Configuration**

### Site URL:
```
https://calibration-hub-9.preview.emergentagent.com
```

### Redirect URLs (add ALL of these):
```
https://calibration-hub-9.preview.emergentagent.com/**
https://calibration-hub-9.preview.emergentagent.com/auth/callback
https://calibration-hub-9.preview.emergentagent.com/auth-callback-supabase
https://calibration-hub-9.preview.emergentagent.com/connect-email
https://calibration-hub-9.preview.emergentagent.com/integrations
```

---

## 2. AZURE AD (MICROSOFT OUTLOOK) CONFIGURATION

### Location:
**Azure Portal** → **App Registrations** → App ID: `5d6e3cbb-cd88-4694-aa19-9b7115666866`

### Authentication → Redirect URIs:
```
https://calibration-hub-9.preview.emergentagent.com/api/auth/outlook/callback
```

### Supported account types:
**Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts**

### API Permissions Required:
- `User.Read` (Microsoft Graph)
- `Mail.Read` (Microsoft Graph)
- `Calendars.Read` (Microsoft Graph)
- `offline_access` (for refresh tokens)

Click "Grant admin consent" after adding permissions.

---

## 3. GOOGLE OAUTH (GMAIL) CONFIGURATION

### Location:
**Google Cloud Console** → **APIs & Services** → **Credentials** → OAuth Client: `903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10`

### Authorized JavaScript origins:
```
https://calibration-hub-9.preview.emergentagent.com
```

### Authorized redirect URIs:
```
https://calibration-hub-9.preview.emergentagent.com/api/auth/gmail/callback
```

---

## 4. SUPABASE EDGE FUNCTIONS (if you're using them)

### Location:
**Supabase Dashboard** → **Edge Functions** → **Secrets**

### Update these secrets:
```
AZURE_CLIENT_ID=biqc-advisor-1
AZURE_CLIENT_SECRET=3co8Q~PnscNo_dvuAw~HnlhhJzJsP~7sj3X3tc0E
AZURE_TENANT_ID=biqc-advisor-1
```

---

## TESTING PROCEDURE

1. **Clear browser cache completely**
2. **Test login**: Go to your app → Click "Log In" → Should work without looping
3. **Test Outlook**: Go to `/connect-email` → Click "Connect Outlook" → Should redirect and callback successfully
4. **Test Gmail**: Click "Connect Gmail" → Should redirect and callback successfully

---

## IF STILL LOOPING - CHECK:

1. **Supabase redirect URLs**: Make sure you added the wildcard `/**` pattern
2. **Azure redirect URI**: Must match EXACTLY (case-sensitive, no trailing slash)
3. **Google redirect URI**: Must match EXACTLY
4. **Browser cache**: Must be completely cleared

**Backend is now configured correctly. The looping should stop once you update Supabase and Azure Portal with the URLs above.**
