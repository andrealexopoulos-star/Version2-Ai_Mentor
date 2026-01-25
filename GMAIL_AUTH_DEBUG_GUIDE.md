# GMAIL EDGE FUNCTION 401 ERROR - DEBUG GUIDE

## THE ISSUE:

Browser → Edge Function calls returning 401 "Invalid or expired token"

This means the session token being sent from browser is not valid.

---

## ROOT CAUSE ANALYSIS:

The 401 error happens at this step:
1. Frontend gets session: `supabase.auth.getSession()`
2. Frontend sends token: `Authorization: Bearer ${session.access_token}`
3. Edge Function validates: `supabaseAnon.auth.getUser(supabaseToken)`
4. **Validation fails → 401 error**

**Possible causes:**
1. Session token is expired/invalid
2. SUPABASE_ANON_KEY mismatch between frontend and Edge Function
3. Token was invalidated by previous OAuth attempts
4. Browser has stale/corrupt session data

---

## VERIFICATION STEPS (DO THESE IN ORDER):

### **STEP 1: Verify Session Token Exists**

1. **Open your BIQC app** in browser
2. **Press F12** → Console tab
3. **Paste this command and press Enter:**
   ```javascript
   (async () => {
     const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
     const supabase = createClient(
       'https://uxyqpdfftxpkzeppqtvk.supabase.co',
       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k'
     );
     const { data: { session }, error } = await supabase.auth.getSession();
     console.log('SESSION CHECK:', {
       hasSession: !!session,
       hasAccessToken: !!session?.access_token,
       userEmail: session?.user?.email,
       error: error?.message
     });
   })();
   ```

4. **Check the output:**

**Good Result:**
```json
{
  hasSession: true,
  hasAccessToken: true,
  userEmail: "andre.alexopoulos@gmail.com"
}
```

**Bad Result:**
```json
{
  hasSession: false,
  hasAccessToken: false,
  error: "..."
}
```

**If BAD:** Sign out completely, clear browser data, sign in fresh

---

### **STEP 2: Test Edge Function with Live Token**

1. **In browser console, paste:**
   ```javascript
   (async () => {
     const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
     const supabase = createClient(
       'https://uxyqpdfftxpkzeppqtvk.supabase.co',
       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k'
     );
     const { data: { session } } = await supabase.auth.getSession();
     
     if (!session) {
       console.error('❌ No session found');
       return;
     }
     
     console.log('Testing Edge Function with token...');
     
     const response = await fetch('https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/gmail_prod', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${session.access_token}`,
         'Content-Type': 'application/json'
       }
     });
     
     console.log('Response status:', response.status);
     const data = await response.json();
     console.log('Response data:', data);
   })();
   ```

2. **Check the result:**

**Expected if working:**
```
Response status: 200
Response data: { ok: true, connected: true, ... }
```

**If you get 401:**
```
Response status: 401
Response data: { ok: false, error_stage: "auth", error_message: "..." }
```

**Copy the EXACT error_message and send it to me**

---

### **STEP 3: Verify Anon Key Matches**

**Frontend anon key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k
```

**Edge Function anon key (from secrets):**
Should be EXACTLY the same.

**If different → 401 errors**

---

### **STEP 4: Check Edge Function Logs**

1. **Supabase Dashboard** → **Edge Functions** → **gmail_prod** → **Logs** tab
2. **Keep this tab open**
3. **In your app, click "Test Gmail Connection"**
4. **Watch logs appear in real-time**

**Look for:**
```
✅ Supabase JWT extracted
❌ Failed to verify user: [ERROR MESSAGE HERE]
```

**Send me the EXACT error message from the logs**

---

## LIKELY CAUSES & FIXES:

### **Cause 1: Invalid Session (Most Likely)**

**Symptom:** Token exists but validation fails with "Invalid Refresh Token: Already Used"

**Fix:**
1. Sign out completely from BIQC
2. Close ALL browser tabs
3. Clear browser data (Ctrl+Shift+Delete → Cookies)
4. Open new tab
5. Sign in with Google
6. Test again

---

### **Cause 2: Anon Key Mismatch**

**Symptom:** "Invalid JWT signature" or "Unable to verify signature"

**Fix:**
- Verify Edge Function `SUPABASE_ANON_KEY` secret matches `/app/frontend/.env`
- Both must be EXACTLY the same

---

### **Cause 3: Supabase Project Issue**

**Symptom:** All tokens fail validation

**Fix:**
- Verify Supabase project is active (not paused)
- Check Supabase status page

---

## TESTING CHECKLIST:

Run these tests IN ORDER and tell me results:

- [ ] Step 1: Session exists? (YES/NO)
- [ ] Step 2: Edge Function response status? (200/401/500)
- [ ] Step 2: Exact error message? (copy from console)
- [ ] Step 4: Edge Function logs exact error? (copy from Supabase)

**After I see these results, I can pinpoint the exact fix.**

---

## DO NOT:

- ❌ Change Gmail logic
- ❌ Change Priority Inbox logic
- ❌ Deploy new Edge Functions
- ❌ Modify database

## DO:

- ✅ Run the 4 verification steps above
- ✅ Send me the exact error messages
- ✅ Let me fix the 401 issue first

---

**Run Step 1 and Step 2 in browser console and send me the results!** 🔍
