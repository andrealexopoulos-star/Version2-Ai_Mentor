# 🚨 CRITICAL FIXES NEEDED

## ✅ **WHAT'S WORKING:**

1. ✅ HubSpot connected in backend (`{HubSpot: {...}}`)
2. ✅ Database updated with `merge_account_id`
3. ✅ Tab renamed to "Data Connections"
4. ✅ Frontend resolver fixed to detect HubSpot

---

## ❌ **REMAINING ISSUES:**

### Issue 1: HubSpot Card Not Green
**Cause**: Frontend integration list not refreshing after connection
**Fix**: Hard refresh page (Ctrl+Shift+R)

If still gray after refresh, check console for what `mergeIntegrations` contains.

### Issue 2: Priority Inbox 500 Error
**Error**: `POST /functions/v1/email_priority 500 (Internal Server Error)`  
**Supabase logs show**: `"Invalid session"`

**Cause**: The `email_priority` Edge Function is rejecting the Supabase auth token

**Your improved code** (that reads provider from database) needs to be deployed to Supabase:
- Go to: Supabase Dashboard → Edge Functions → `email_priority`
- Deploy your code that has:
  ```typescript
  const { data: connection } = await supabaseService
    .from("email_connections")
    .select("provider")
    .eq("user_id", user.id)
    .eq("connected", true)
    .maybeSingle();
  ```

### Issue 3: Data Connections Tab Shows Nothing
**Status**: Code is updated to show connected integrations
**Expected after page refresh**:
- Email section showing Outlook
- Business Systems section showing HubSpot

---

## 📋 **IMMEDIATE ACTIONS:**

### 1. Hard Refresh Browser
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

This will:
- ✅ Reload updated frontend JavaScript
- ✅ Show HubSpot in Data Connections tab
- ✅ Potentially turn HubSpot card green

### 2. Deploy Your Improved email_priority Code
**Deploy to**: Supabase Dashboard → Edge Functions → email_priority

**Your code** (the one you showed me earlier):
- Reads provider from `email_connections` table
- Doesn't rely on URL parameter
- More robust and accurate

### 3. Test Priority Inbox
After deploying email_priority:
- Go to `/email-inbox`
- Click "Analyze Inbox"
- Should work without 500 errors

---

## ✅ **EXPECTED AFTER FIXES:**

**HubSpot Card:**
- 🟢 Green border
- ✅ Checkmark icon
- ✅ "Connected" badge

**Data Connections Tab:**
```
Email Providers:
  - Microsoft Outlook (andre@thestrategysquad.com.au) ✓

Business Systems:
  - HubSpot (CRM • via Merge.dev) ✓
```

**Priority Inbox:**
- No 500 errors
- Emails load and categorize correctly

---

**Hard refresh browser now, then deploy your email_priority code to fix the 500 error!** 🚀
