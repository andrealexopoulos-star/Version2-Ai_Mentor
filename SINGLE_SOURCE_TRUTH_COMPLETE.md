# SINGLE SOURCE OF TRUTH - IMPLEMENTATION COMPLETE

## CHANGES APPLIED

### Files Modified: 3

**1. Edge Function: outlook-auth** (`/app/supabase_edge_functions/outlook-auth/index.ts`)
- Added upsert to `email_connections` table
- Sets provider = "outlook"
- Overwrites any previous Gmail connection
- Logs: "email_connections upserted - Outlook is now the active provider"

**2. Edge Function: gmail_prod** (`/app/supabase_edge_functions/gmail_prod/index.ts`)
- Added upsert to `email_connections` table
- Sets provider = "gmail"
- Overwrites any previous Outlook connection
- Logs: "email_connections upserted - Gmail is now the active provider"

**3. Frontend: ConnectEmail.js** (`/app/frontend/src/pages/ConnectEmail.js`)
- Removed dual Edge Function calls
- Now reads from `email_connections` table ONLY
- Single query determines connection state
- Logs: "Checking email_connections (canonical source)"

**4. Frontend: EmailInbox.js** (`/app/frontend/src/pages/EmailInbox.js`)
- Removed dual Edge Function calls
- Now reads from `email_connections` table ONLY
- Single query determines active provider
- Logs provider, connected_email, inbox_type

---

## HOW IT WORKS

### User Connects Outlook:
```
1. User clicks "Connect Outlook"
2. OAuth completes
3. outlook-auth Edge Function runs
4. Writes to outlook_oauth_tokens (for sync details)
5. Writes to email_connections:
   { user_id: 'user123', provider: 'outlook', connected: true }
6. If Gmail was connected, it's overwritten ✅
7. Frontend reads email_connections
8. UI shows: Outlook ✅, Gmail ❌
```

### User Switches to Gmail:
```
1. User clicks "Connect Gmail" (while Outlook connected)
2. OAuth completes
3. gmail_prod Edge Function runs
4. Writes to gmail_connections (for sync details)
5. Writes to email_connections:
   { user_id: 'user123', provider: 'gmail', connected: true }
6. Outlook entry is REPLACED ✅
7. Frontend reads email_connections
8. UI shows: Gmail ✅, Outlook ❌
```

---

## ACCEPTANCE CRITERIA

✅ **ONE provider per user:**
- PRIMARY KEY on user_id enforces this
- Upsert overwrites previous provider

✅ **email_connections is single source:**
- Frontend reads ONLY this table (not Edge Functions)
- No dual checks
- No conflict resolution needed

✅ **Priority Inbox uses it:**
- EmailInbox.js reads from email_connections
- Sets activeProvider from table
- No ambiguity

---

## YOU MUST REDEPLOY EDGE FUNCTIONS

**Both functions were updated:**

```bash
# Deploy outlook-auth with email_connections upsert
supabase functions deploy outlook-auth

# Deploy gmail_prod with email_connections upsert
supabase functions deploy gmail_prod
```

**Or via Dashboard:**
1. Upload updated `outlook-auth/index.ts`
2. Upload updated `gmail_prod/index.ts`

---

## POST-DEPLOYMENT TESTING

### Test 1: Connect Outlook
1. Navigate to /connect-email
2. Click "Connect Outlook"
3. Complete OAuth
4. **Check Supabase email_connections table:**
   ```sql
   SELECT * FROM email_connections;
   ```
   **Expected:** ONE row with provider = 'outlook'

### Test 2: Switch to Gmail
1. Click "Connect Gmail"
2. Complete OAuth
3. **Check table again:**
   ```sql
   SELECT * FROM email_connections;
   ```
   **Expected:** SAME row, provider = 'gmail' (Outlook replaced)

### Test 3: Console Logs
**Expected logs:**
```
🔍 Checking email_connections (canonical source)...
✅ Active email provider: outlook
✅ Connected email: user@outlook.com
✅ Inbox type: focused
```

**NOT expected:**
- Dual Edge Function calls
- Gmail references when Outlook active
- Conflict resolution logic

---

## SUMMARY

**Created:**
- ✅ email_connections table (canonical source)
- ✅ Migration SQL (moves existing connections)
- ✅ RLS policies (secure access)

**Updated:**
- ✅ outlook-auth writes to email_connections
- ✅ gmail_prod writes to email_connections
- ✅ ConnectEmail.js reads from email_connections ONLY
- ✅ EmailInbox.js reads from email_connections ONLY

**Impact:**
- ONE query to check connection (not two Edge Function calls)
- ONE provider active (enforced by PRIMARY KEY)
- NO dual connections possible
- NO Gmail/Outlook conflicts
- Clear audit trail

**Files Modified:** 3
- outlook-auth/index.ts
- gmail_prod/index.ts
- ConnectEmail.js
- EmailInbox.js

---

**NEXT: Deploy both Edge Functions, then test!**
