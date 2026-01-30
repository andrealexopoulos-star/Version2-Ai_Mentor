# DEPLOYMENT INSTRUCTIONS - COPY/PASTE READY

## STEP-BY-STEP DEPLOYMENT

### STEP 1: Deploy outlook-auth Edge Function

**Go to:** https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/functions

**Click:** "Deploy new function" or find existing `outlook-auth` and click it

**Copy the entire outlook-auth code** (372 lines - shown in previous message)

**Paste into editor**

**Function name:** `outlook-auth`

**Click:** "Deploy"

---

### STEP 2: Deploy gmail_prod Edge Function

**In same Supabase Functions page**

**Find:** `gmail_prod` function (should already exist)

**Click:** "Redeploy" or "Edit"

**Copy the entire gmail_prod code** (398 lines - shown in previous message)

**Paste into editor** (replace existing code)

**Click:** "Deploy"

---

### STEP 3: Verify Deployment

**In Supabase Dashboard:**

Functions page should show:
- ✅ `outlook-auth` - Deployed
- ✅ `gmail_prod` - Deployed

---

### STEP 4: Test outlook-auth

**Click:** outlook-auth → "Test" tab

**Method:** POST

**Headers:** Click "Add header"
- Key: `Authorization`
- Value: `Bearer [paste-your-jwt-token-here]`

**Body:** `{}`

**Click:** "Send Request"

**Expected Response:**
```json
{
  "ok": true,
  "connected": false,
  "provider": "outlook"
}
```
(Or connected: true if you have Outlook already connected)

**Should NOT see:** 404 or CORS error

---

### STEP 5: Test in BIQC App

1. Login to BIQC
2. Navigate to: /connect-email
3. Open console (F12)
4. Click "Connect Outlook"
5. **Expected in console:**
   ```
   📧 Email connect provider: outlook
   🔍 Checking email_connections (canonical source)...
   ✅ Active email provider: outlook
   ```
6. **NOT expected:**
   - CORS errors
   - Gmail references
   - 404 errors

---

### STEP 6: Verify Database

**In Supabase SQL Editor:**

```sql
SELECT user_id, provider, connected, connected_email, inbox_type 
FROM email_connections;
```

**Expected:** ONE row per user with active provider

---

## IF YOU DON'T HAVE SUPABASE CLI

**All deployment can be done via Dashboard** (steps above)

No CLI needed!

---

## TROUBLESHOOTING

**If 404 persists:**
- Ensure function name is exactly `outlook-auth` (no typos)
- Ensure code starts with `import { serve }...`
- Check Edge Function logs for errors

**If CORS persists:**
- Verify corsHeaders are at top of code
- Verify OPTIONS handler is before try block
- Check browser console for specific CORS error

**If "Not Found" in database:**
- Ensure email_connections table exists
- Run verification query above
- Check RLS policies allow insert

---

## SUMMARY

**What You're Deploying:**
1. outlook-auth: 372 lines (with email_connections upsert)
2. gmail_prod: 398 lines (with email_connections upsert)

**Expected Result:**
- ✅ No CORS errors
- ✅ No 404 errors
- ✅ Outlook connects successfully
- ✅ Gmail connects successfully
- ✅ Only ONE can be active at a time
- ✅ email_connections table shows which provider is active

---

**ALL CODE IS READY - JUST COPY/PASTE INTO SUPABASE DASHBOARD!**
