# GMAIL EDGE FUNCTION - QUICK DEPLOYMENT GUIDE

## 🚀 3-STEP DEPLOYMENT

### **STEP 1: Create Database Table (2 minutes)**

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy entire contents of `/app/supabase_migrations/create_gmail_connections.sql`
4. Paste and click **Run**
5. Verify: Should see "Success. No rows returned"

---

### **STEP 2: Deploy Edge Function (5 minutes)**

1. Go to **Edge Functions** → **Create a new function**
2. Function name: `gmail_test`
3. Copy entire contents of `/app/supabase_edge_functions/gmail_test/index.ts`
4. Paste into editor
5. Click **Deploy function**
6. Wait for "Deployed successfully" message

---

### **STEP 3: Set Secrets (3 minutes)**

1. Go to **Edge Functions** → **Secrets**
2. Click **Add new secret** (4 times)

Add these:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://uxyqpdfftxpkzeppqtvk.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k` |
| `GOOGLE_CLIENT_ID` | `903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `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` |

---

### **STEP 4: Update Google OAuth Scopes (CRITICAL)**

1. Go to **Authentication** → **Providers** → **Google**
2. Find **Scopes** field
3. **Add** to existing scopes:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   ```
4. Full scopes should look like:
   ```
   openid email profile https://www.googleapis.com/auth/gmail.readonly
   ```
5. Click **Save**

**⚠️ IMPORTANT:** After changing scopes:
- Existing users must sign out and re-authenticate
- Google will show new permission request for Gmail access
- This is expected behavior

---

### **STEP 5: Test the Integration (2 minutes)**

1. **Sign out** from your BIQC app (to pick up new Gmail scope)
2. **Sign in** again with Google
3. Google will show: "BIQC wants to access your Gmail" (approve this)
4. Navigate to: `https://intel-pipeline.preview.emergentagent.com/gmail-test`
5. Click: **Test Gmail Connection**

**Expected Result:**
```json
{
  "ok": true,
  "gmail_connected": true,
  "labels_count": 15,
  "sample_labels": ["INBOX", "SENT", "DRAFT"]
}
```

**If you see `labels_count > 0` and real Gmail labels → ✅ SUCCESS**

---

## VALIDATION CHECKLIST

After deployment, verify:

- [ ] Database table `gmail_connections` exists
- [ ] RLS policies are enabled on `gmail_connections`
- [ ] Edge Function `gmail_test` shows "Active" status
- [ ] All 4 secrets are set in Edge Functions
- [ ] Google provider scopes include `gmail.readonly`
- [ ] You've signed out and back in (to get new scope)
- [ ] `/gmail-test` page loads without errors
- [ ] Test button calls Edge Function
- [ ] Response shows `ok: true`
- [ ] `labels_count` is a number > 0
- [ ] `sample_labels` contains real Gmail label names
- [ ] No console errors
- [ ] Works on both desktop and mobile

---

## TROUBLESHOOTING

### **Error: "User has not connected Google account"**
- **Fix:** Sign in with Google (not email/password)

### **Error: "Missing Google access token"**
- **Fix:** Update Google provider scopes, then re-authenticate

### **Error: "Gmail API returned 403"**
- **Fix:** Scopes not granted. Sign out, sign in, approve Gmail permission

### **Error: "Edge Function not found"**
- **Fix:** Verify function name is exactly `gmail_test`, redeploy if needed

### **Error: "Supabase configuration error"**
- **Fix:** Check all 4 Edge Function secrets are set correctly

---

## QUICK TEST COMMAND (Alternative)

You can also test via curl:

```bash
# Get your Supabase session token (from browser console):
# await supabase.auth.getSession()

# Then:
curl -X POST https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_test \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected:** JSON response with `ok: true` and real labels

---

## FILES TO DEPLOY

1. **Copy to Supabase SQL Editor:**
   - `/app/supabase_migrations/create_gmail_connections.sql`

2. **Copy to Edge Function:**
   - `/app/supabase_edge_functions/gmail_test/index.ts`

3. **Frontend (Already Added):**
   - `/app/frontend/src/pages/GmailTest.js`
   - Route added to `/app/frontend/src/App.js`

---

**Total deployment time: ~15 minutes**  
**Ready to deploy!** 🚀
