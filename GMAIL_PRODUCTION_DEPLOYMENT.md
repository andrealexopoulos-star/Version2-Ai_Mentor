# GMAIL INTEGRATION - PRODUCTION DEPLOYMENT GUIDE

**Function Name:** `gmail_prod`  
**Live Account:** Founder's Gmail  
**Goal:** Outlook-level parity with Priority Inbox support

---

## COMPLETE EDGE FUNCTION CODE (UPDATED)

**Copy this ENTIRE code and paste into Supabase Edge Function editor:**

---

## DEPLOYMENT STEPS

### **STEP 1: Deploy Updated Edge Function**

1. Go to: **Supabase Dashboard** → **Edge Functions**
2. Click on **`gmail_prod`** (your existing function)
3. Click **"Code"** tab
4. **DELETE ALL** existing code
5. **COPY** the code from `/app/supabase_edge_functions/gmail_prod/index.ts`
6. **PASTE** into the editor
7. Click **"Deploy"** (bottom right)
8. Wait for "Deployed successfully"

✅ **Edge Function now detects Priority Inbox**

---

### **STEP 2: Verify Secrets Are Set**

1. In `gmail_prod` function, click **"Secrets"** tab
2. Verify these 4 secrets exist:
   - ✅ `SUPABASE_URL`
   - ✅ `SUPABASE_ANON_KEY`
   - ✅ `GOOGLE_CLIENT_ID`
   - ✅ `GOOGLE_CLIENT_SECRET`

(You said they're already there from Microsoft - perfect!)

---

### **STEP 3: Test From Your App**

**DO THIS FIRST - Fix Your Session:**

1. **Go to:** `https://calibration-hub-9.preview.emergentagent.com`

2. **Sign out completely:**
   - Click profile → Sign Out
   - Confirm you're on landing page

3. **Clear browser cache:**
   - Press `Ctrl + Shift + Delete`
   - Check "Cookies and site data"
   - Click "Clear"

4. **Close ALL BIQC tabs**

5. **Open NEW tab and go to:**
   ```
   https://calibration-hub-9.preview.emergentagent.com/login-supabase
   ```

6. **Click "Continue with Google"**

7. **Sign in with your LIVE Gmail account** (the one you want to test with)

8. **Complete authentication**

---

### **STEP 4: Test Gmail Connection**

1. **After logging in, go to:**
   ```
   https://calibration-hub-9.preview.emergentagent.com/integrations
   ```

2. **Find the Gmail card** (it should be next to Outlook)

3. **Click "Connect Gmail"** (if not already connected)
   - Google will ask for permission
   - Approve Gmail access

4. **After connection, click "Test Gmail Connection"** (refresh icon button)

5. **Check the results**

---

## EXPECTED RESULTS

### **SUCCESS - Priority Inbox Enabled:**
```json
{
  "ok": true,
  "connected": true,
  "provider": "gmail",
  "inbox_type": "priority",
  "labels_count": 23
}
```

**UI Should Show:**
- ✅ Green dot next to Gmail
- ✅ "Connected" badge
- ✅ Gmail card in "Connected Tools" section
- ✅ Shows: "23 labels • Priority Inbox"
- ✅ No warnings

---

### **SUCCESS - Standard Inbox (No Priority):**
```json
{
  "ok": true,
  "connected": true,
  "provider": "gmail",
  "inbox_type": "standard",
  "labels_count": 18,
  "remediation": "Enable Priority Inbox in Gmail settings"
}
```

**UI Should Show:**
- ✅ Green dot next to Gmail
- ✅ "Connected" badge
- ✅ Shows: "18 labels • Standard Inbox"
- ⚠️ **Warning:** "Priority Inbox is disabled in Gmail. BIQC recommendations may be reduced."

---

### **NOT CONNECTED:**
```json
{
  "ok": true,
  "connected": false,
  "provider": "gmail"
}
```

**UI Should Show:**
- ⚪ Grey dot (no status indicator)
- ✅ "Connect Gmail" button
- ❌ NOT in "Connected Tools" section

---

### **ERROR:**
```json
{
  "ok": false,
  "connected": false,
  "provider": "gmail",
  "error_stage": "gmail_api",
  "error_message": "Gmail API returned 403: Insufficient permissions"
}
```

**This means:** Gmail scope is missing - need to add it

---

## PRIORITY INBOX DETECTION LOGIC

The Edge Function detects Priority Inbox by checking for these Gmail labels:

1. **Primary Detection:**
   - `CATEGORY_PRIMARY` or `CATEGORY_PERSONAL` (Google's category labels)

2. **Secondary Detection:**
   - `IMPORTANT` label exists AND
   - (`CATEGORY_SOCIAL` OR `CATEGORY_PROMOTIONS`) exist

**Result:**
- If detected → `inbox_type: "priority"`
- If not detected → `inbox_type: "standard"` + remediation message

---

## UI PARITY WITH OUTLOOK

### **Gmail Card Features (Matches Outlook Exactly):**

✅ **When Disconnected:**
- Grey card (no border)
- "Connect Gmail" button
- Status: No indicator

✅ **When Connected:**
- Green border (border-2 border-green-500)
- Shows in "Connected Tools" section
- Green pulsing dot
- "Connected" badge
- Shows email address
- Shows: "{count} labels • {inbox_type}"
- Two buttons: Disconnect (logout icon) + Test (refresh icon)

✅ **Priority Inbox Warning:**
- If inbox_type === 'standard'
- Shows amber warning box
- Message: "Priority Inbox is disabled in Gmail. BIQC recommendations may be reduced."

---

## VALIDATION CHECKLIST

Before marking as complete:

- [ ] Edge Function deployed successfully
- [ ] All 4 secrets are set
- [ ] You've signed out and back in with fresh session
- [ ] Gmail card appears in Integrations page
- [ ] "Connect Gmail" button works
- [ ] Google asks for Gmail permission
- [ ] After OAuth, redirects back to /integrations
- [ ] Gmail card moves to "Connected Tools" section
- [ ] Green border appears around Gmail card
- [ ] Shows correct inbox type ("Priority" or "Standard")
- [ ] "Test Gmail Connection" button works
- [ ] Shows real label count from YOUR Gmail
- [ ] Priority Inbox detection is accurate
- [ ] Warning shows if using Standard Inbox
- [ ] Disconnect button works
- [ ] Mobile and desktop behave identically

---

## TROUBLESHOOTING

### **"No active session found"**
**Fix:** Sign out, clear cache, sign in with Google again

### **"User has not connected Google account"**
**Fix:** Sign in using "Continue with Google" (not email/password)

### **"Gmail API returned 403"**
**Fix:** Add Gmail scope via Google Cloud Console (see separate guide)

### **Gmail card doesn't show as connected**
**Fix:** Click "Test Gmail Connection" to force verification

---

## CONFIRMATION STATEMENT

After successful test with founder's live Gmail account:

✅ **"Gmail now supports Priority Inbox detection with Outlook-level parity. Connected state is driven by Edge Function verification only. UI matches Outlook card structure exactly. No mock data. No silent failures."**

---

## FILES UPDATED:

1. `/app/frontend/src/pages/Integrations.js` - Gmail card UI + handlers
2. `/app/supabase_edge_functions/gmail_prod/index.ts` - Priority Inbox detection
3. `/app/frontend/src/pages/GmailTest.js` - Updated to call gmail_prod

---

**STATUS:** Ready for live account testing  
**NEXT:** Deploy Edge Function code and test with founder's Gmail
