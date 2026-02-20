# 📋 Copy-Paste URLs & Configuration

## 🔵 Microsoft Azure App Registration (Outlook)

### Redirect URI
```
https://biqc-production-fix.preview.emergentagent.com/api/auth/outlook/callback
```

**Where to paste**: Azure Portal → App Registrations → Your App → Authentication → Platform configurations → Web → Redirect URIs

### Required API Permissions
- `offline_access`
- `User.Read`
- `Mail.Read`
- `Mail.ReadBasic`
- `Calendars.Read`
- `Calendars.ReadBasic`

---

## 🔴 Google Cloud Console (Gmail)

### Authorized Redirect URI
```
https://biqc-production-fix.preview.emergentagent.com/api/auth/gmail/callback
```

**Where to paste**: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → Your Web Client → Authorized redirect URIs

### Required Scopes
- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.readonly`

---

## 🟢 Supabase Edge Function Secrets

### For `outlook-auth` Edge Function

Go to: Supabase Dashboard → Edge Functions → outlook-auth → Settings → Secrets

Add these secrets (one by one):

**Secret Name**: `AZURE_CLIENT_ID`  
**Secret Value**: `[Your Azure Client ID from Azure Portal]`

**Secret Name**: `AZURE_CLIENT_SECRET`  
**Secret Value**: `[Your Azure Client Secret from Azure Portal]`

**Secret Name**: `BACKEND_URL`  
**Secret Value**: 
```
https://biqc-production-fix.preview.emergentagent.com
```

---

### For `gmail_prod` Edge Function

Go to: Supabase Dashboard → Edge Functions → gmail_prod → Settings → Secrets

Add these secrets (one by one):

**Secret Name**: `GOOGLE_CLIENT_ID`  
**Secret Value**: `[Your Google Client ID from Google Cloud Console]`

**Secret Name**: `GOOGLE_CLIENT_SECRET`  
**Secret Value**: `[Your Google Client Secret from Google Cloud Console]`

**Secret Name**: `BACKEND_URL`  
**Secret Value**: 
```
https://biqc-production-fix.preview.emergentagent.com
```

---

## 🔧 Backend Environment Variables

Your `/app/backend/.env` should have these (already configured):

```env
BACKEND_URL=https://biqc-production-fix.preview.emergentagent.com
FRONTEND_URL=https://biqc-production-fix.preview.emergentagent.com
SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co

# Microsoft OAuth (get from Azure Portal)
AZURE_CLIENT_ID=your_azure_client_id_here
AZURE_CLIENT_SECRET=your_azure_client_secret_here
AZURE_TENANT_ID=common

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

---

## 📱 Frontend Environment Variables

Your `/app/frontend/.env` should have these (already configured):

```env
REACT_APP_BACKEND_URL=https://biqc-production-fix.preview.emergentagent.com
REACT_APP_SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
```

---

## 🧪 Testing URLs

### Connect Email Page
```
https://biqc-production-fix.preview.emergentagent.com/connect-email
```

### Priority Inbox Page (after connection)
```
https://biqc-production-fix.preview.emergentagent.com/email-inbox
```

---

## 🗄️ Supabase Database Tables

### Check Connection State (SQL Editor)
```sql
SELECT * FROM email_connections WHERE user_id = auth.uid();
```

### Check Outlook Tokens
```sql
SELECT user_id, account_email, expires_at 
FROM outlook_oauth_tokens 
WHERE user_id = auth.uid();
```

### Check Gmail Tokens
```sql
SELECT user_id, email, token_expiry 
FROM gmail_connections 
WHERE user_id = auth.uid();
```

---

## 📋 Quick Checklist

### Microsoft Azure Configuration
- [ ] Redirect URI added: `https://biqc-production-fix.preview.emergentagent.com/api/auth/outlook/callback`
- [ ] All 6 API permissions added
- [ ] Admin consent granted (if required)
- [ ] Client ID copied to backend `.env`
- [ ] Client Secret copied to backend `.env`

### Google Cloud Configuration
- [ ] Redirect URI added: `https://biqc-production-fix.preview.emergentagent.com/api/auth/gmail/callback`
- [ ] All 4 scopes configured
- [ ] OAuth consent screen published
- [ ] Client ID copied to backend `.env`
- [ ] Client Secret copied to backend `.env`

### Supabase Edge Functions
- [ ] `outlook-auth` Edge Function deployed with latest code
- [ ] `outlook-auth` secrets configured (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, BACKEND_URL)
- [ ] `gmail_prod` Edge Function deployed with latest code
- [ ] `gmail_prod` secrets configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKEND_URL)

### Database Tables
- [ ] `email_connections` table exists with RLS policies
- [ ] `outlook_oauth_tokens` table exists
- [ ] `gmail_connections` table exists

---

## 🚀 Deployment Steps Summary

### 1. Copy Edge Function Code

**For Outlook**:
1. Open `/app/supabase_edge_functions/outlook-auth/index.ts` in your code editor
2. Select all (Ctrl+A or Cmd+A)
3. Copy (Ctrl+C or Cmd+C)
4. Go to Supabase Dashboard → Edge Functions → outlook-auth
5. Paste and deploy

**For Gmail**:
1. Open `/app/supabase_edge_functions/gmail_prod/index.ts` in your code editor
2. Select all (Ctrl+A or Cmd+A)
3. Copy (Ctrl+C or Cmd+C)
4. Go to Supabase Dashboard → Edge Functions → gmail_prod
5. Paste and deploy

### 2. Configure Secrets

Use the values from the "Supabase Edge Function Secrets" section above.

### 3. Test Connection

1. Navigate to: `https://biqc-production-fix.preview.emergentagent.com/connect-email`
2. Click "Connect Outlook" or "Connect Gmail"
3. Authorize
4. Verify "Connected" status appears

---

## 🔍 Quick Debug Commands

### Check if backend is running
```bash
sudo supervisorctl status backend
```

### View backend logs
```bash
tail -f /var/log/supervisor/backend.out.log | grep -i "outlook\|gmail"
```

### Check Supabase connection
```bash
curl -X GET "https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/outlook-auth" \
  -H "Authorization: Bearer YOUR_SUPABASE_USER_TOKEN"
```

---

## 📞 Support

If you get stuck:
1. Check `/app/DEPLOYMENT_INSTRUCTIONS.md` for detailed instructions
2. Check `/app/OAUTH_SETUP_GUIDE.md` for OAuth setup help
3. Share Supabase Edge Function logs for debugging
4. Share backend logs if connection fails

---

**Environment**: Production (inbox-sync-3.preview.emergentagent.com)  
**Last Updated**: December 2025  
**Status**: Ready for deployment ✅
