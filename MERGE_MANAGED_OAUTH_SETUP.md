# HubSpot Merge.dev Configuration Guide
# Using Merge-Managed OAuth (Recommended)

## 🎯 YOUR HUBSPOT APP CREDENTIALS

**App ID:** 27819377  
**Client ID:** 275da85b-1e52-4677-9fe7-5ce78800f8da  
**Client Secret:** [Hidden in HubSpot dashboard - retrieve if needed]

---

## ✅ OPTION SELECTED: MERGE-MANAGED OAUTH

**This means:** You will use Merge's HubSpot OAuth app (NOT your app 27819377)

**Benefit:** Your app credentials above are NOT needed for Merge-managed OAuth.

---

## 📋 CONFIGURATION STEPS IN MERGE.DEV

### Step 1: Navigate to HubSpot Integration Settings

In Merge Dashboard (https://app.merge.dev):

1. Click **"Integrations"** in left sidebar
2. Find **"CRM"** category
3. Click on **"HubSpot"**

### Step 2: Select OAuth Type

Look for a section that says:
- **"OAuth Configuration"** or
- **"Authentication Method"** or
- **"OAuth Provider"**

You should see options like:
```
○ Use Custom OAuth Application
● Use Merge OAuth Application  ← SELECT THIS
```

**Select:** "Use Merge OAuth Application"

### Step 3: Verify Auto-Configuration

After selecting Merge-managed, you should see:

**Client ID:** (Auto-filled by Merge)  
**Client Secret:** (Managed by Merge)  
**Scopes:** (Auto-configured)  
**Redirect URI:** (Pre-configured by Merge)  

**All fields should be grayed out or auto-filled** - you don't edit them.

### Step 4: Enable the Integration

Toggle switch or button to **"Enable"** or **"Activate"** HubSpot integration.

### Step 5: Save Changes

Click **"Save"** or **"Update"** button.

---

## 🧪 TEST THE CONNECTION

1. Navigate to: https://auth-loop-fix-4.preview.emergentagent.com/integrations
2. Click "Connect" on HubSpot
3. Merge modal opens
4. Click HubSpot
5. Authorize
6. Should see: "HubSpot connected successfully!"

---

## ✅ VERIFY SUCCESS

Run: `python3 /app/verify_hubspot_connection.py`

Expected: "✅ HUBSPOT CONNECTION SUCCESSFUL!"
