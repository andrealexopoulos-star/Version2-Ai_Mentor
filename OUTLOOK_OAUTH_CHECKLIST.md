# 🔍 OUTLOOK OAUTH COMPLETE CONFIGURATION CHECKLIST

## ROOT CAUSE IDENTIFIED ✅

**The issue is NOT in your code** - it's in Azure Portal configuration.

Your Azure App Registration is **missing the redirect URI** for the current deployment environment.

---

## ✅ STEP 1: AZURE PORTAL CONFIGURATION (CRITICAL)

### 1.1 Add Redirect URI

**Navigate to**:
```
Azure Portal → Microsoft Entra ID → App registrations
```

**Search for**:
- Application (client) ID: `5d6e3cbb-cd88-4694-aa19-9b7115666866`
- Or Display Name: "V2 TheStrategySquad ai"

**Go to**: **Authentication** blade (left sidebar)

**Under Platform configurations → Web**:
- Click **"+ Add URI"**
- Paste this EXACT value:
```
https://biqc-integrity.preview.emergentagent.com/api/auth/outlook/callback
```
- Click **"Save"**

**Wait 2-3 minutes** for Azure to propagate the change.

---

### 1.2 Verify API Permissions

**Go to**: **API permissions** blade (left sidebar)

**Confirm these Microsoft Graph Delegated permissions exist**:
- [ ] `User.Read`
- [ ] `Mail.Read`
- [ ] `Mail.ReadBasic`
- [ ] `Calendars.Read`
- [ ] `Calendars.ReadBasic`
- [ ] `offline_access`

**If "Admin consent required" shows**:
- Click **"Grant admin consent for [The Strategy Squad]"**
- Confirm the action

---

### 1.3 Verify Supported Account Types

**In Authentication blade**:
- Check **"Supported account types"**
- Should be: **"Accounts in this organizational directory only (The Strategy Squad only - Single tenant)"**

---

## ✅ STEP 2: BACKEND CONFIGURATION (ALREADY UPDATED)

Your backend `.env` file now has the correct credentials:

```env
AZURE_TENANT_ID=biqc-advisor
AZURE_CLIENT_ID=biqc-advisor
AZURE_CLIENT_SECRET=biqc-advisor
```

✅ Backend has been restarted

---

## ✅ STEP 3: SUPABASE EDGE FUNCTION SECRETS

**Navigate to**: Supabase Dashboard → Edge Functions → **outlook-auth** → Settings → Secrets

**Update/Add these secrets** (one by one):

### Secret 1: AZURE_CLIENT_ID
```
5d6e3cbb-cd88-4694-aa19-9b7115666866
```

### Secret 2: AZURE_CLIENT_SECRET
```
2f5697f4-5a3a-4aca-893a-6a40334c579f
```

### Secret 3: BACKEND_URL
```
https://biqc-integrity.preview.emergentagent.com
```

### Secret 4: AZURE_TENANT_ID (if exists)
```
a75a808f-8c78-46dd-bda8-faa925d316d9
```

**Note**: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY should already exist (auto-configured).

After updating secrets, **redeploy the Edge Function** (click Deploy button).

---

## ✅ STEP 4: CLEAR ALL CACHES

### Browser Cache
1. **Hard refresh**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. **Or clear cache**:
   - Chrome: Settings → Privacy and security → Clear browsing data → Cached images and files
   - Firefox: Settings → Privacy & Security → Cookies and Site Data → Clear Data
3. **Or use Incognito/Private mode** for testing

### Service Worker Cache
Open browser console and run:
```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  console.log('Service workers cleared');
  location.reload();
});
```

---

## ✅ STEP 5: VERIFICATION CHECKLIST

### Azure Portal Verification
- [ ] Redirect URI added: `https://biqc-integrity.preview.emergentagent.com/api/auth/outlook/callback`
- [ ] Redirect URI saved (clicked Save button)
- [ ] All 6 API permissions present
- [ ] Admin consent granted (if required)
- [ ] Account type is "Single tenant"

### Supabase Edge Function Verification
- [ ] `outlook-auth` function exists
- [ ] AZURE_CLIENT_ID secret = `5d6e3cbb-cd88-4694-aa19-9b7115666866`
- [ ] AZURE_CLIENT_SECRET secret = `2f5697f4-5a3a-4aca-893a-6a40334c579f`
- [ ] BACKEND_URL secret = `https://biqc-integrity.preview.emergentagent.com`
- [ ] Edge Function redeployed after secret updates

### Backend Verification
- [ ] Backend .env has correct credentials (already verified ✅)
- [ ] Backend service restarted (already done ✅)

### Browser/Cache Verification
- [ ] Browser cache cleared OR using Incognito mode
- [ ] Service worker unregistered
- [ ] Hard refresh performed

---

## ✅ STEP 6: TEST OUTLOOK CONNECTION

**After completing ALL above steps**:

1. Navigate to: `https://biqc-integrity.preview.emergentagent.com/connect-email`

2. Click **"Connect Outlook"**

3. **Expected behavior**:
   - Redirects to Microsoft login page
   - URL should show: `login.microsoftonline.com/a75a808f-8c78-46dd-bda8-faa925d316d9/...`
   - NO error about application not found
   - Can complete login and authorize

4. **After authorization**:
   - Redirects back to `/connect-email?outlook_connected=true`
   - Shows "Connected to Outlook" status
   - Email address displayed

---

## 🚨 IF STILL FAILING

### Check Azure Portal (Most Likely Issue)

**Verify Redirect URI is EXACTLY**:
```
https://biqc-integrity.preview.emergentagent.com/api/auth/outlook/callback
```

**Common mistakes**:
- Missing `/api/auth/outlook/callback` path
- Trailing slash: `...callback/` ❌
- HTTP instead of HTTPS: `http://...` ❌
- Wrong domain
- Typo in path

**Wait 2-5 minutes** after adding redirect URI for Azure to propagate.

### Check Backend Logs

```bash
tail -100 /var/log/supervisor/backend.out.log | grep -i "outlook\|azure"
```

Look for:
- OAuth URL being constructed
- Client ID value being used
- Any error messages

### Check Browser Console

Open Developer Tools → Console tab

Look for:
- Any redirect errors
- Any CORS errors
- OAuth callback errors

---

## 📋 QUICK REFERENCE - YOUR CREDENTIALS

**Application (client) ID**:
```
5d6e3cbb-cd88-4694-aa19-9b7115666866
```

**Directory (tenant) ID**:
```
a75a808f-8c78-46dd-bda8-faa925d316d9
```

**Client Secret**:
```
2f5697f4-5a3a-4aca-893a-6a40334c579f
```

**Redirect URI** (must be in Azure Portal):
```
https://biqc-integrity.preview.emergentagent.com/api/auth/outlook/callback
```

---

## 🎯 PRIORITY ACTIONS

**Priority 1 (CRITICAL)**: Add redirect URI in Azure Portal  
**Priority 2**: Update Supabase Edge Function secrets  
**Priority 3**: Clear browser cache  
**Priority 4**: Test connection  

**Estimated time**: 5-10 minutes

---

**Last Updated**: January 31, 2025  
**Status**: Backend credentials correct ✅ | Azure Portal configuration pending ⏳
