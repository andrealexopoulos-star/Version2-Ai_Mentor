# 🚀 COPY-PASTE DEPLOYMENT URLS - READY TO USE

## Your Production URL
```
https://html-bug-fixed.preview.emergentagent.com
```

---

## 📍 STEP 1: Microsoft Azure App Registration

### Navigate Here:
```
https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
```

### Redirect URI to Add (Copy-Paste):
```
https://html-bug-fixed.preview.emergentagent.com/api/auth/outlook/callback
```

**Where to paste**: 
1. Click your app
2. Click "Authentication" (left sidebar)
3. Under "Platform configurations" → "Web" → Click "+ Add URI"
4. Paste the URL above
5. Click "Save"

---

## 📍 STEP 2: Google Cloud Console

### Navigate Here:
```
https://console.cloud.google.com/apis/credentials
```

### Authorized Redirect URI to Add (Copy-Paste):
```
https://html-bug-fixed.preview.emergentagent.com/api/auth/gmail/callback
```

**Where to paste**:
1. Click on your OAuth 2.0 Client ID
2. Under "Authorized redirect URIs", click "+ ADD URI"
3. Paste the URL above
4. Click "SAVE"

---

## 📍 STEP 3: Supabase URL Configuration

### Navigate Here:
```
Supabase Dashboard → Authentication → URL Configuration
```

### Site URL (Copy-Paste):
```
https://html-bug-fixed.preview.emergentagent.com
```

### Redirect URLs - Add ALL of these (Copy-Paste one by one):

```
https://html-bug-fixed.preview.emergentagent.com/**
```

```
https://html-bug-fixed.preview.emergentagent.com/auth/callback
```

```
https://html-bug-fixed.preview.emergentagent.com/connect-email
```

```
https://html-bug-fixed.preview.emergentagent.com/integrations
```

```
https://html-bug-fixed.preview.emergentagent.com/dashboard
```

```
http://localhost:3000/**
```

**Where to paste**:
1. Go to Supabase Dashboard
2. Click "Authentication" (left sidebar)
3. Click "URL Configuration" tab
4. Set "Site URL" to first value
5. Under "Redirect URLs", click "+ Add URL" for each URL above
6. Click "Save"

---

## 📍 STEP 4: Supabase Edge Function Secrets

### For `outlook-auth` Edge Function

**Navigate to**: Supabase Dashboard → Edge Functions → outlook-auth → Settings → Secrets

Add/Update these secrets:

#### BACKEND_URL
```
https://html-bug-fixed.preview.emergentagent.com
```

#### AZURE_CLIENT_ID
```
[Paste your Azure Application (client) ID from Azure Portal]
Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

#### AZURE_CLIENT_SECRET
```
[Paste your Azure Client Secret from Azure Portal]
```

---

### For `gmail_prod` Edge Function

**Navigate to**: Supabase Dashboard → Edge Functions → gmail_prod → Settings → Secrets

Add/Update these secrets:

#### BACKEND_URL
```
https://html-bug-fixed.preview.emergentagent.com
```

#### GOOGLE_CLIENT_ID
```
[Paste your Google Client ID from Google Cloud Console]
Format: xxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

#### GOOGLE_CLIENT_SECRET
```
[Paste your Google Client Secret from Google Cloud Console]
```

---

### For `email_priority` Edge Function

**Navigate to**: Supabase Dashboard → Edge Functions → email_priority → Settings → Secrets

Add/Update this secret:

#### BACKEND_URL
```
https://html-bug-fixed.preview.emergentagent.com
```

---

### For `integration-status` Edge Function

**Navigate to**: Supabase Dashboard → Edge Functions → integration-status → Settings → Secrets

Add/Update this secret:

#### BACKEND_URL
```
https://html-bug-fixed.preview.emergentagent.com
```

---

## 📍 STEP 5: Merge.dev Configuration

### Navigate Here:
```
https://app.merge.dev/configuration/link
```

### Redirect URI (Copy-Paste):
```
https://html-bug-fixed.preview.emergentagent.com/integrations
```

**Where to paste**:
1. Go to Merge.dev Dashboard
2. Click "Configuration" → "Link"
3. Find "Redirect URI" field
4. Paste the URL above
5. Click "Save"

---

## 📍 STEP 6: Testing URLs

### Login Page
```
https://html-bug-fixed.preview.emergentagent.com/login
```

### Connect Email Page
```
https://html-bug-fixed.preview.emergentagent.com/connect-email
```

### Email Inbox Page
```
https://html-bug-fixed.preview.emergentagent.com/email-inbox
```

### Integrations Page
```
https://html-bug-fixed.preview.emergentagent.com/integrations
```

### Dashboard
```
https://html-bug-fixed.preview.emergentagent.com/dashboard
```

---

## 📋 QUICK CHECKLIST

### Microsoft Azure
- [ ] Redirect URI added: `https://html-bug-fixed.preview.emergentagent.com/api/auth/outlook/callback`
- [ ] Clicked "Save"

### Google Cloud Console
- [ ] Redirect URI added: `https://html-bug-fixed.preview.emergentagent.com/api/auth/gmail/callback`
- [ ] Clicked "SAVE"

### Supabase URL Configuration
- [ ] Site URL set: `https://html-bug-fixed.preview.emergentagent.com`
- [ ] All 6 redirect URLs added
- [ ] Clicked "Save"

### Supabase Edge Functions - outlook-auth
- [ ] BACKEND_URL: `https://html-bug-fixed.preview.emergentagent.com`
- [ ] AZURE_CLIENT_ID: [Your Azure ID]
- [ ] AZURE_CLIENT_SECRET: [Your Azure Secret]

### Supabase Edge Functions - gmail_prod
- [ ] BACKEND_URL: `https://html-bug-fixed.preview.emergentagent.com`
- [ ] GOOGLE_CLIENT_ID: [Your Google ID]
- [ ] GOOGLE_CLIENT_SECRET: [Your Google Secret]

### Supabase Edge Functions - email_priority
- [ ] BACKEND_URL: `https://html-bug-fixed.preview.emergentagent.com`

### Supabase Edge Functions - integration-status
- [ ] BACKEND_URL: `https://html-bug-fixed.preview.emergentagent.com`

### Merge.dev
- [ ] Redirect URI: `https://html-bug-fixed.preview.emergentagent.com/integrations`
- [ ] Clicked "Save"

---

## 🧪 VERIFICATION TESTS

### Test 1: Outlook Connection
1. Go to: `https://html-bug-fixed.preview.emergentagent.com/connect-email`
2. Click "Connect Outlook"
3. ✅ Should authorize and redirect back successfully

### Test 2: Gmail Connection
1. Go to: `https://html-bug-fixed.preview.emergentagent.com/connect-email`
2. Click "Connect Gmail"
3. ✅ Should authorize and redirect back successfully

### Test 3: HubSpot Integration
1. Go to: `https://html-bug-fixed.preview.emergentagent.com/integrations`
2. Click "Connect HubSpot"
3. ✅ Should complete Merge.dev flow successfully

### Test 4: Data Isolation (Security)
1. Log in as User A → note connections
2. Log out
3. Log in as User B
4. ✅ Should NOT see User A's connections

---

## 🚨 TROUBLESHOOTING

### If Outlook fails with "invalid redirect_uri"
- Double-check Azure redirect URI is EXACTLY: `https://html-bug-fixed.preview.emergentagent.com/api/auth/outlook/callback`
- No trailing slash, no extra characters
- Wait 2-3 minutes after saving (Azure propagation delay)

### If Gmail fails with "redirect_uri_mismatch"
- Double-check Google redirect URI is EXACTLY: `https://html-bug-fixed.preview.emergentagent.com/api/auth/gmail/callback`
- Click SAVE in Google Cloud Console
- Wait 1-2 minutes

### If Edge Functions return "Unauthorized"
- Check that BACKEND_URL secret is set to: `https://html-bug-fixed.preview.emergentagent.com`
- Redeploy the Edge Function after updating secrets

---

## ✅ YOU'RE DONE WHEN:

✅ All checkboxes above are checked  
✅ Outlook connection test passes  
✅ Gmail connection test passes  
✅ HubSpot integration test passes  
✅ Data isolation test passes  
✅ No redirect errors appear  

---

**Production URL**: https://html-bug-fixed.preview.emergentagent.com  
**Last Updated**: January 2025  
**Ready to Deploy**: YES ✅
