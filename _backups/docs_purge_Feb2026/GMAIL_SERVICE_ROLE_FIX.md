# GMAIL EDGE FUNCTION - SERVICE ROLE FIX

## ISSUE FIXED:
Edge Function was using anon key which couldn't bypass RLS to read gmail_connections table.

## SOLUTION APPLIED:
Updated Edge Function to use **SUPABASE_SERVICE_ROLE_KEY** for database operations.

---

## WHAT CHANGED:

### **File:** `/app/supabase_edge_functions/gmail_prod/index.ts`

**Changes:**
1. Added `SUPABASE_SERVICE_ROLE_KEY` environment variable
2. Created two Supabase clients:
   - `supabaseAnon` - For user authentication (JWT verification)
   - `supabaseService` - For database operations (bypasses RLS)
3. All `gmail_connections` queries now use `supabaseService`
4. Added detailed logging to prove token retrieval works

**Key Lines Changed:**
- Line 67-90: Initialize both anon and service clients
- Line 92-94: Use `supabaseAnon` for user verification
- Line 116-120: Use `supabaseService` for gmail_connections query
- Line 147-149: Log retrieved email + token_expiry (proof of success)
- Line 315-317: Use `supabaseService` for token upsert

---

## DEPLOYMENT STEPS:

### **STEP 1: Add Service Role Key Secret**

1. Go to: **Supabase Dashboard** → **Edge Functions** → **Secrets**

2. Click **"Add new secret"**

3. **Name:** `SUPABASE_SERVICE_ROLE_KEY`

4. **Value:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQzNzA0NywiZXhwIjoyMDg0MDEzMDQ3fQ.Of8sBhmza-QMmtlQ-EN7kpqcDuiy512TlY2Gku9YuX4
   ```

5. Click **"Save"**

6. **Verify:** You should now have 5 secrets total:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY ← NEW
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET

---

### **STEP 2: Re-deploy Edge Function**

1. Go to: **Edge Functions** → **gmail_prod** → **Code** tab

2. **Delete ALL existing code**

3. **Copy** the entire updated code from `/app/supabase_edge_functions/gmail_prod/index.ts`

4. **Paste** into editor

5. Click **"Deploy"**

6. Wait for "Deployed successfully"

---

### **STEP 3: Hard Refresh Browser**

1. **In your BIQC app**, press:
   - `Ctrl + Shift + R` (Windows)
   - `Cmd + Shift + R` (Mac)

2. This clears cached JavaScript

---

### **STEP 4: Test**

1. Go to: `/integrations`

2. Gmail card should NOW show as **Connected** automatically
   - Green border
   - "Connected" badge
   - Your email
   - Label count
   - Inbox type

3. If not showing yet, click **"Test Gmail Connection"** (refresh icon)

---

## EXPECTED EDGE FUNCTION LOGS:

After deploying and testing, check Supabase Edge Function logs. You should see:

```
✅ User verified: andre.alexopoulos@gmail.com (1970c00c-ce88-472b-b811-9c65c696f91c)
🔍 Checking gmail_connections table for tokens (using service role)...
✅ Gmail connection retrieved from database:
  - Email: andre.alexopoulos@gmail.com
  - Token Expiry: 2026-01-25T05:30:00.000Z
  - Scopes: https://www.googleapis.com/auth/gmail.readonly
✅ Gmail tokens retrieved from database
  - Access token: Present
  - Refresh token: Present
📧 Calling Gmail API...
✅ Gmail API success - received 23 labels
🔍 Detecting Priority Inbox...
📊 Priority Inbox detection:
  - CATEGORY_PRIMARY: true/false
  - IMPORTANT: true/false
  - CATEGORY_SOCIAL: true/false
  - CATEGORY_PROMOTIONS: true/false
  - Inbox Type: priority/standard
✅ SUCCESS: {ok: true, connected: true, ...}
```

---

## PROOF OF SUCCESS:

The logs will show:
- ✅ Email retrieved from database
- ✅ Token expiry timestamp
- ✅ Successful Gmail API call
- ✅ Real label count
- ✅ Priority Inbox detection result

This proves the Edge Function can now:
- Read gmail_connections table (bypassing RLS)
- Retrieve stored tokens
- Call Gmail API successfully
- Detect Priority Inbox configuration

---

## WHY THIS FIXES THE 401 ERROR:

**Before:**
```
Edge Function (anon key) → gmail_connections table
  ↓
RLS checks: auth.uid() = user_id
  ↓
auth.uid() is NULL (Edge Function doesn't have auth context)
  ↓
RLS BLOCKS query → Empty result → "Not connected"
```

**After:**
```
Edge Function (service role key) → gmail_connections table
  ↓
Service role BYPASSES RLS entirely
  ↓
Query succeeds → Tokens retrieved → Gmail API call works
```

---

## VALIDATION:

After deployment, verify:
- [ ] 5 secrets exist in Edge Functions → Secrets
- [ ] Edge Function deployed successfully
- [ ] Hard refresh browser completed
- [ ] Gmail card shows as "Connected"
- [ ] Edge Function logs show email + token_expiry
- [ ] No 401 errors in Edge Function logs
- [ ] No RLS errors in logs
- [ ] Priority Inbox detection working

---

**STATUS:** Code updated and ready for deployment  
**BLOCKERS:** None - just need to add secret and redeploy  
**TIME:** ~5 minutes total
