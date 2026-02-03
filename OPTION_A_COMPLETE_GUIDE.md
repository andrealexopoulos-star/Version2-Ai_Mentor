# OPTION A: COMPLETE STEP-BY-STEP GUIDE
## Using beta.thestrategysquad.com (No www)

---

## ✅ STEP 1: BACKEND CONFIGURATION (DONE)

**I've updated `/app/backend/.env`:**
```
BACKEND_URL=https://beta.thestrategysquad.com
FRONTEND_URL=https://beta.thestrategysquad.com
```

**Status**: ✅ Complete

---

## ✅ STEP 2: FRONTEND CONFIGURATION (DONE)

**I've updated `/app/frontend/.env`:**
```
REACT_APP_BACKEND_URL=https://beta.thestrategysquad.com
```

**Status**: ✅ Complete

---

## ✅ STEP 3: SERVICES RESTARTED (DONE)

**Both services restarted successfully:**
- Backend: Running (pid 284)
- Frontend: Running (pid 288)

**Status**: ✅ Complete

---

## 📋 STEP 4: UPDATE SUPABASE (YOU DO THIS)

### Go to: Supabase Dashboard → Authentication → URL Configuration

### A. Change Site URL:

**FROM:**
```
https://www.beta.thestrategysquad.com
```

**TO:**
```
https://beta.thestrategysquad.com
```

**How:**
1. Click in the "Site URL" field
2. Delete the current URL
3. Type: `https://beta.thestrategysquad.com`
4. Click "Save changes"

---

### B. Update Redirect URLs:

**DELETE these old URLs** (click trash icon next to each):
- All URLs with `www.beta.thestrategysquad.com`
- All URLs with `beta.thestrategysquad.com.au`
- All URLs with `biqc-advisor.preview.emergentagent.com`
- All URLs with `biqc-auth-edge`
- Keep `localhost:3000/**` only if you test locally

**ADD these new URLs** (click "+ Add URL" for each):

1. First URL:
```
https://beta.thestrategysquad.com/**
```

2. Second URL:
```
https://beta.thestrategysquad.com/auth/callback
```

3. Third URL:
```
https://beta.thestrategysquad.com/auth-callback-supabase
```

**How:**
1. Click "+ Add URL" button
2. Paste the URL exactly as shown
3. Press Enter or click Add
4. Repeat for each URL
5. Click "Save changes" at bottom

**After this step, you should have:**
- Site URL: `https://beta.thestrategysquad.com`
- 3 Redirect URLs (+ localhost if you kept it)

---

## 📋 STEP 5: UPDATE AZURE AD (YOU DO THIS)

### Go to: Azure Portal → App Registrations

### A. Find your app:
1. Search for Client ID: `5d6e3cbb-cd88-4694-aa19-9b7115666866`
2. Or search for "BIQC" or "Strategy Squad"
3. Click on the app to open it

### B. Go to Authentication:
1. In left sidebar, click "Authentication"
2. You'll see "Platform configurations" section

### C. Update Redirect URI:

**Under "Web" platform:**

**DELETE old redirect URIs:**
- `https://www.beta.thestrategysquad.com/api/auth/outlook/callback`
- Any URLs with `biqc-advisor.preview.emergentagent.com`
- Any URLs with `.com.au`

**ADD new redirect URI:**

1. Click "+ Add URI" button
2. Paste this EXACTLY:
```
https://beta.thestrategysquad.com/api/auth/outlook/callback
```
3. Click "Save" at top of page

### D. Verify API Permissions:

1. Click "API permissions" in left sidebar
2. Verify these are present:
   - Microsoft Graph → User.Read (Delegated)
   - Microsoft Graph → Mail.Read (Delegated)
   - Microsoft Graph → Calendars.Read (Delegated)
   - Microsoft Graph → offline_access (Delegated)

3. If any are missing, click "+ Add a permission"
4. After adding all, click "Grant admin consent for [your tenant]"

**After this step:**
- Redirect URI should be: `https://beta.thestrategysquad.com/api/auth/outlook/callback`
- All permissions granted

---

## 📋 STEP 6: UPDATE GOOGLE CLOUD (YOU DO THIS)

### Go to: Google Cloud Console → APIs & Services → Credentials

### A. Find your OAuth Client:
1. Look for Client ID: `903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com`
2. Click on it to edit

### B. Update Authorized JavaScript origins:

**DELETE old origins:**
- `https://www.beta.thestrategysquad.com`
- Any `biqc-advisor.preview.emergentagent.com`
- Any `.com.au` URLs

**ADD new origin:**

1. Under "Authorized JavaScript origins" click "+ ADD URI"
2. Paste EXACTLY:
```
https://beta.thestrategysquad.com
```
3. Press Enter

### C. Update Authorized redirect URIs:

**DELETE old redirect URIs:**
- `https://www.beta.thestrategysquad.com/api/auth/gmail/callback`
- Any old Emergent URLs

**ADD new redirect URI:**

1. Under "Authorized redirect URIs" click "+ ADD URI"
2. Paste EXACTLY:
```
https://beta.thestrategysquad.com/api/auth/gmail/callback
```
3. Press Enter
4. Click "SAVE" at bottom

**After this step:**
- JavaScript origin: `https://beta.thestrategysquad.com`
- Redirect URI: `https://beta.thestrategysquad.com/api/auth/gmail/callback`

---

## 🚀 STEP 7: DEPLOY (YOU DO THIS)

### In Emergent Dashboard:

1. Click the **"Deploy"** button
2. Click **"Deploy Now"** to confirm
3. Wait 10-15 minutes for deployment to complete
4. You'll see a success message when done

**Do NOT test yet - wait for Step 8**

---

## 🔗 STEP 8: VERIFY DOMAIN LINKING (YOU DO THIS)

### In Emergent Dashboard:

1. After deployment completes, find "Custom Domain" or "Domain" settings
2. Verify `beta.thestrategysquad.com` is linked to the new deployment
3. If NOT linked:
   - Click "Link Domain"
   - Enter: `beta.thestrategysquad.com`
   - Follow the wizard
   - Emergent will tell you what DNS record to add

**Check your DNS:** From Screenshot 3, I see you already have:
```
CNAME  app1  →  beta.thestrategysquad.com
```

This might need to point to Emergent's URL instead. Emergent will tell you the exact value.

**Wait 5-15 minutes for DNS to propagate**

---

## 🧹 STEP 9: CLEAR BROWSER CACHE (YOU DO THIS)

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "All time"
3. Check "Cookies and other site data"
4. Check "Cached images and files"
5. Click "Clear data"

**Safari:**
1. Safari → Settings → Privacy
2. Click "Manage Website Data"
3. Remove all for `beta.thestrategysquad.com`

**OR use Incognito/Private browsing mode**

---

## ✅ STEP 10: TEST LOGIN (YOU DO THIS)

### Test Supabase Login:

1. Go to: `https://beta.thestrategysquad.com`
2. Click "Log In"
3. Enter email/password
4. Should land on `/advisor` page without looping

**If it works:** ✅ Proceed to Step 11

**If it loops:** ❌ Double-check Supabase Site URL and Redirect URLs

---

## ✅ STEP 11: TEST OUTLOOK CONNECTION (YOU DO THIS)

1. Navigate to: `https://beta.thestrategysquad.com/connect-email`
2. Click "Connect Outlook"
3. Login with your Microsoft account
4. Should redirect back to `/connect-email?outlook_connected=true`
5. Should see "Outlook connected successfully" message

**If it works:** ✅ Outlook integration working!

**If it fails:** ❌ Double-check Azure AD redirect URI

---

## ✅ STEP 12: TEST GMAIL CONNECTION (YOU DO THIS)

1. On `/connect-email` page
2. Click "Connect Gmail"
3. Login with your Google account
4. Should redirect back to `/connect-email?gmail_connected=true`
5. Should see "Gmail connected successfully" message

**If it works:** ✅ Gmail integration working!

**If it fails:** ❌ Double-check Google Cloud redirect URI

---

## ✅ STEP 13: TEST MERGE.DEV (YOU DO THIS)

1. Navigate to: `https://beta.thestrategysquad.com/integrations`
2. Try connecting HubSpot or Xero
3. Complete the Merge.dev Link flow
4. Should see integration connected

**If it works:** ✅ All integrations working!

**If it fails:** Check browser console for errors and share with me

---

## 📊 VERIFICATION CHECKLIST

**Before deployment:**
- [x] Backend .env updated (done by me)
- [x] Frontend .env updated (done by me)
- [x] Services restarted (done by me)
- [ ] Supabase Site URL updated (you do)
- [ ] Supabase Redirect URLs updated (you do)
- [ ] Azure AD Redirect URI updated (you do)
- [ ] Google Cloud URIs updated (you do)

**After deployment:**
- [ ] Deployment completed successfully
- [ ] Domain linked in Emergent
- [ ] Browser cache cleared
- [ ] Login tested and working
- [ ] Outlook connection tested
- [ ] Gmail connection tested
- [ ] Merge.dev integration tested

---

## 🎯 QUICK REFERENCE - ALL URLS

**Your production domain:**
```
https://beta.thestrategysquad.com
```

**Supabase:**
- Site URL: `https://beta.thestrategysquad.com`
- Redirect: `https://beta.thestrategysquad.com/**`

**Azure AD:**
- Redirect URI: `https://beta.thestrategysquad.com/api/auth/outlook/callback`

**Google Cloud:**
- Origin: `https://beta.thestrategysquad.com`
- Redirect: `https://beta.thestrategysquad.com/api/auth/gmail/callback`

---

## 🆘 IF SOMETHING FAILS

**Login loops:**
- Verify Supabase Site URL is EXACTLY `https://beta.thestrategysquad.com`
- Verify wildcard redirect `/**` is added
- Clear cookies and try incognito mode

**Outlook fails:**
- Verify Azure redirect URI matches exactly
- Check API permissions are granted
- Check Azure Client ID is the GUID (not "biqc-advisor")

**Gmail fails:**
- Verify Google redirect URI matches exactly
- Check Gmail API is enabled in Google Cloud

**Merge.dev fails:**
- Check browser console for specific error
- Verify you're logged in
- Try different integration (HubSpot vs Xero)

---

**Start with Step 4 (Supabase) and work through each step in order.**