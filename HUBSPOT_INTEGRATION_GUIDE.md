# 🚀 HubSpot Integration Guide - Complete Setup

## 📋 **OVERVIEW**

BIQC uses **Merge.dev Unified API** to connect to HubSpot. This means:
- ✅ Merge.dev handles all OAuth and authentication
- ✅ BIQC gets standardized access to HubSpot data
- ✅ No direct HubSpot API keys needed in BIQC
- ✅ Works the same way for Salesforce, Pipedrive, etc.

---

## 🚨 **STEP 1: Fix Merge.dev Account Limit (CRITICAL)**

**Current Error**: `"Organization has already reached their maximum number of test accounts"`

### **Solution A: Delete Old Test Accounts (Recommended)**

1. **Go to**: https://app.merge.dev/dashboard
2. **Log in** to your Merge.dev account
3. **Navigate to**: "Linked Accounts" or "Test Accounts" (left sidebar)
4. **You'll see a list** of all test accounts created
5. **Delete unused accounts**:
   - Look for old test accounts
   - Click the trash/delete icon
   - Confirm deletion
6. **Verify**: Should see "X accounts remaining" increase

### **Solution B: Upgrade Merge.dev Plan**

1. **Go to**: https://app.merge.dev/dashboard
2. **Navigate to**: Billing or Settings → Plans
3. **Upgrade** to Production plan
   - Removes test account limits
   - Typical cost: $250-500/month
4. **Complete payment**
5. **Verify**: Test account limit should be removed

### **Solution C: Contact Merge.dev Support**

1. **Email**: support@merge.dev
2. **Request**: Temporary increase in test account limit
3. **Explain**: You're testing BIQC integration

---

## 🔗 **STEP 2: Connect HubSpot to BIQC**

### **Prerequisites:**
- ✅ Merge.dev account limit fixed (Step 1)
- ✅ Active HubSpot account with data
- ✅ Logged into BIQC as user

### **Connection Flow:**

**A. In BIQC Application:**

1. **Navigate to**: https://biqc-auth-edge.preview.emergentagent.com/integrations

2. **Find HubSpot card**:
   - Should be in the "CRM" category
   - Gray card (not connected yet)
   - Description: "Customer relationship management and sales data"

3. **Click "Connect" button** on HubSpot card

4. **Merge.dev modal opens**:
   - You'll see a modal titled "Connect to HubSpot"
   - Should show Merge.dev branding

5. **Select HubSpot** from the integration list

6. **Click "Connect" or "Continue"**

**B. HubSpot OAuth (Handled by Merge.dev):**

7. **Redirected to HubSpot login page**
   - URL: `app.hubspot.com` or similar
   - This is HubSpot's official OAuth page

8. **Log in to HubSpot**:
   - Enter your HubSpot credentials
   - Or select an account if already logged in

9. **Authorize BIQC**:
   - HubSpot will ask: "Allow BIQC to access your data?"
   - Click **"Authorize"** or **"Allow"**
   - Permissions requested:
     - Read contacts
     - Read companies
     - Read deals
     - Read notes/activities

10. **Redirected back to BIQC**:
    - Should return to `/integrations` page
    - HubSpot card should now be **green**
    - Should show "✓ Connected" badge

---

## ✅ **STEP 3: Verify HubSpot Connection**

### **In BIQC UI:**

1. **Check the HubSpot card**:
   - ✅ Border should be green
   - ✅ "Connected" badge visible
   - ✅ Checkmark icon present
   - ✅ Shows connection date

2. **Click on the card** to see details:
   - Should show "Connection Type: Merge.dev Unified API"
   - Should show connected date/time
   - Should have "Disconnect" button

### **In Browser Console (F12):**

Look for:
```javascript
✅ Merge onboarding success
📊 Connected Merge integrations: { hubspot: true }
```

### **In Database (Optional):**

Run in Supabase SQL Editor:
```sql
-- Check if HubSpot is connected
SELECT 
  provider,
  category,
  connected_at,
  merge_account_id
FROM integration_accounts
WHERE provider ILIKE '%hubspot%';
```

Should return a row with your HubSpot connection.

---

## 📊 **STEP 4: Access HubSpot Data in BIQC**

Once connected, BIQC can fetch your HubSpot data.

### **Available Data:**

**From HubSpot via Merge.dev:**
- 📇 **Contacts**: Customer/lead information
- 🏢 **Companies**: Organization records
- 💼 **Deals**: Sales pipeline and opportunities
- 📝 **Notes/Activities**: Interaction history

### **How BIQC Uses This Data:**

1. **MyAdvisor Chat**: 
   - References your actual customer data
   - Provides specific advice based on your pipeline

2. **Business Profile**:
   - Auto-fills customer count, revenue patterns
   - Enriches business context

3. **Strategic Insights**:
   - Analyzes customer retention patterns
   - Identifies high-value customer segments

### **API Endpoints Available:**

Your backend has these endpoints to access HubSpot data:

```
GET /api/integrations/merge/crm/contacts
GET /api/integrations/merge/crm/companies
GET /api/integrations/merge/crm/deals
GET /api/integrations/merge/crm/notes
```

---

## 🔄 **STEP 5: Sync HubSpot Data**

### **Manual Sync:**

1. **Go to**: `/integrations` page
2. **Click on HubSpot card** (to open details)
3. **Click "Sync Now"** button (if available)
4. **Wait for sync** to complete
5. **Check success message**: "HubSpot data synced successfully"

### **Automatic Sync:**

BIQC automatically syncs HubSpot data:
- When you first connect
- When you open MyAdvisor
- Periodically in the background (if configured)

---

## 🐛 **TROUBLESHOOTING:**

### **Issue 1: "Merge Link not ready"**

**Fix**:
- Refresh the page
- Try connecting again
- Check browser console for errors

### **Issue 2: HubSpot card stays gray**

**Possible causes**:
1. Merge.dev modal didn't open (popup blocked?)
   - **Fix**: Allow popups from BIQC domain
   
2. OAuth not completed
   - **Fix**: Complete the full HubSpot authorization flow
   
3. Frontend not refreshing connection status
   - **Fix**: Refresh the page after connecting

### **Issue 3: "Test account limit reached"**

**Fix**: Complete Step 1 above (delete old accounts or upgrade plan)

### **Issue 4: HubSpot card turns green but no data**

**Possible causes**:
1. HubSpot account is empty (no contacts/deals)
   - **Fix**: Add some data in HubSpot first
   
2. Permissions not granted properly
   - **Fix**: Disconnect and reconnect, ensuring you grant all permissions

---

## 🔍 **VERIFICATION CHECKLIST:**

After completing all steps:

- [ ] Merge.dev account limit fixed (no more "test account" errors)
- [ ] HubSpot card in BIQC is green with "Connected" badge
- [ ] Browser console shows: `{ hubspot: true }`
- [ ] Database shows HubSpot in `integration_accounts` table
- [ ] Can fetch HubSpot data via backend APIs (optional test)

---

## 📞 **STILL NOT WORKING?**

**Share these details:**
1. Screenshot of Merge.dev dashboard showing account limit
2. Browser console logs when clicking "Connect"
3. Backend logs: `tail -100 /var/log/supervisor/backend.err.log | grep -i merge`
4. Screenshot of HubSpot card status

---

## 🎯 **QUICK START (After Fixing Limit):**

1. Go to: `/integrations`
2. Find HubSpot card
3. Click "Connect"
4. Complete OAuth flow
5. HubSpot card turns green
6. Done! ✅

---

**Current Status**: Merge.dev test account limit blocking HubSpot connection
**Next Action**: Fix Merge.dev account limit using Step 1 above
