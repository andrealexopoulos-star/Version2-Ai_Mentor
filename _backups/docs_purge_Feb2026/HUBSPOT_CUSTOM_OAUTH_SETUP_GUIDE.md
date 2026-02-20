# HubSpot Custom OAuth Configuration Guide for Merge.dev
# App ID: 29819397

## 🎯 YOUR HUBSPOT OAUTH APP CREDENTIALS

**App ID:** 29819397  
**Client ID:** 275da85b-1e52-4677-9fe7-5ce78800f8da  
**Client Secret:** 6afd0d24-a5fc-409e-8811-84e12bcaf20e  

---

## ✅ STEP-BY-STEP CONFIGURATION

### PART A: Configure HubSpot App (FIRST)

**1. Login to HubSpot**
   - Navigate to: https://app.hubspot.com
   - Login with your HubSpot admin account

**2. Access Your Private App**
   - Click Settings (gear icon in top right)
   - Navigate to: **Integrations → Private Apps**
   - Find app: **29819397**

**3. Go to "Auth" Tab**
   - Click on the **"Auth"** tab in your app settings

**4. Add Merge Redirect URI**
   - Find **"Redirect URLs"** section
   - Click **"Add redirect URL"**
   - Enter EXACTLY: `https://api.merge.dev/oauth/callback`
   - Click **"Add"** or **"Save"**

**5. Configure Scopes**
   - Still in your app settings, go to **"Scopes"** tab
   - Enable the following scopes:

   **CRM Read (Required):**
   ```
   ☑ crm.objects.contacts.read
   ☑ crm.objects.companies.read
   ☑ crm.objects.deals.read
   ☑ crm.objects.owners.read
   ```

   **CRM Write (Required by Merge for verification):**
   ```
   ☑ crm.objects.contacts.write
   ☑ crm.objects.companies.write
   ☑ crm.objects.deals.write
   ☑ crm.objects.owners.write
   ```

   **Optional (if Merge requests):**
   ```
   ☑ sales-email-read
   ```

**6. Save All Changes in HubSpot**

---

### PART B: Configure Merge.dev Dashboard (SECOND)

**1. Login to Merge**
   - Navigate to: https://app.merge.dev
   - Login with your Merge account

**2. Navigate to HubSpot Settings**
   - Click **"Integrations"** in left sidebar
   - Find **"CRM"** category
   - Click **"HubSpot"**

**3. Select Custom OAuth**
   - Find the OAuth configuration section
   - Select: **"Use Custom OAuth Application"** (or "Custom OAuth")

**4. Enter Your Credentials**
   - **Client ID:** 
     ```
     275da85b-1e52-4677-9fe7-5ce78800f8da
     ```
   
   - **Client Secret:**
     ```
     6afd0d24-a5fc-409e-8811-84e12bcaf20e
     ```

**5. Verify Redirect URI**
   - Should show: `https://api.merge.dev/oauth/callback`
   - This must match what you added in HubSpot (Part A, Step 4)

**6. Configure Scopes (if field exists)**
   - Enter: `crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read crm.objects.owners.read crm.objects.contacts.write crm.objects.companies.write crm.objects.deals.write crm.objects.owners.write`

**7. Enable Integration**
   - Toggle to **"Enabled"** or **"Active"**

**8. Save Configuration**
   - Click **"Save"** or **"Update"**
   - Wait for confirmation message

---

### PART C: Verify Configuration

**In Merge Dashboard, confirm:**
```
HubSpot Integration
├── OAuth Type: Custom ✅
├── Status: Enabled ✅
├── Client ID: 275da85b-... ✅
├── Client Secret: ********** (hidden) ✅
└── Redirect URI: https://api.merge.dev/oauth/callback ✅
```

**In HubSpot App, confirm:**
```
App 29819397
├── Redirect URLs: https://api.merge.dev/oauth/callback ✅
├── Scopes: 
│   ├── crm.objects.contacts.read ✅
│   ├── crm.objects.companies.read ✅
│   ├── crm.objects.deals.read ✅
│   ├── crm.objects.owners.read ✅
│   └── (write scopes as needed) ✅
└── Status: Active ✅
```

---

## 🧪 TEST THE CONNECTION (AFTER CONFIGURATION)

**Test in BIQC:**

1. Navigate to: https://biqc-production-fix.preview.emergentagent.com/integrations
2. Login as: andre@thestrategysquad.com.au
3. Click **"Connect"** on HubSpot card
4. Merge modal should open
5. Click **"HubSpot"** in provider list
6. **Expected:** HubSpot OAuth screen with your app name
7. Click **"Authorize"** or **"Connect"**
8. **Expected:** Redirect back to BIQC
9. **Expected Toast:** "HubSpot connected successfully!"
10. **Expected UI:** HubSpot in "Connected Tools" section

---

## 🔍 TROUBLESHOOTING

### Error: "Scope mismatch"
**Fix:** Ensure scopes in HubSpot app match scopes in Merge config

### Error: "Redirect URI mismatch"  
**Fix:** Verify `https://api.merge.dev/oauth/callback` is in HubSpot app redirect URLs

### Error: "Invalid client credentials"
**Fix:** Double-check Client ID and Secret were entered correctly in Merge

### Error: "Authorization failed"
**Fix:** Ensure HubSpot app is "Active" (not archived or disabled)

---

## ✅ VERIFICATION COMMAND

After successful connection, run:
```bash
python3 /app/verify_hubspot_connection.py
```

**Expected output:**
```
✅ HUBSPOT INTEGRATION FOUND!
✅ Workspace-scoped: True
✅ Merge Account ID stored: True
✅ Ready for data fetching: True
```

---

## 📊 WHAT HAPPENS NEXT (P1)

Once HubSpot is connected:

1. **Data Fetching:** Implement Merge Unified API calls
   ```python
   GET https://api.merge.dev/api/crm/v1/contacts
   Header: X-Account-Token: {account_token}
   ```

2. **Data Persistence:** Create tables for contacts, deals, companies

3. **Intelligence Generation:** Analyze CRM data for BIQC insights

But FIRST: OAuth must complete successfully.
