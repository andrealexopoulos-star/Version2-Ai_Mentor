# 🔐 MERGE.DEV AUTHENTICATION - How It Works

## ✅ **CONFIRMED: Merge.dev Handles ALL Authentication**

BIQC **NEVER** authenticates directly with HubSpot, Salesforce, or any CRM. Merge.dev handles everything.

---

## 🎯 **AUTHENTICATION FLOW (Step-by-Step):**

### **Step 1: User Initiates Connection in BIQC**

1. User clicks "Connect HubSpot" in BIQC
2. BIQC backend calls Merge.dev API:
   ```
   POST https://api.merge.dev/api/integrations/create-link-token
   Headers: Authorization: Bearer {MERGE_API_KEY}
   Body: {
     "end_user_origin_id": "workspace_id",
     "end_user_organization_name": "User's Workspace",
     "end_user_email_address": "user@example.com",
     "categories": ["crm"]
   }
   ```
3. Merge.dev returns a **link_token** (temporary, one-time use)
4. BIQC opens Merge.dev modal with this link_token

---

### **Step 2: Merge.dev Handles OAuth (NOT BIQC)**

5. **Merge.dev modal shows**: "Select your CRM"
6. User selects **HubSpot**
7. **Merge.dev redirects** user to HubSpot OAuth page
8. **User logs in to HubSpot** (HubSpot's login page, NOT BIQC)
9. **HubSpot asks**: "Allow Merge.dev to access your data?"
10. **User authorizes** (clicking "Allow")

---

### **Step 3: Merge.dev Stores Credentials (NOT BIQC)**

11. **HubSpot sends OAuth tokens** to Merge.dev
12. **Merge.dev securely stores**:
    - HubSpot access token
    - HubSpot refresh token
    - Token expiration
13. **Merge.dev creates** an `account_token` (permanent token for BIQC to use)
14. **Merge.dev returns** this `account_token` to BIQC

---

### **Step 4: BIQC Receives and Stores Account Token**

15. **BIQC backend receives** the `account_token` from Merge.dev
16. **BIQC stores** in `integration_accounts` table:
    ```sql
    {
      "account_id": "workspace_id",
      "provider": "HubSpot",
      "category": "crm",
      "account_token": "merge_account_token_here",
      "merge_account_id": "merge_internal_id"
    }
    ```
17. **Connection complete!** ✅

---

## 🔑 **WHO STORES WHAT:**

| Data | Stored By | Location |
|------|-----------|----------|
| **HubSpot OAuth tokens** | Merge.dev | Merge.dev servers (NOT BIQC) |
| **HubSpot credentials** | Merge.dev | Merge.dev servers (NOT BIQC) |
| **Merge account_token** | BIQC | `integration_accounts` table |
| **Connection status** | BIQC | `integration_accounts` table |

**Key Point**: BIQC **NEVER** sees your HubSpot password or OAuth tokens. Only Merge.dev has them.

---

## 📊 **HOW BIQC ACCESSES HUBSPOT DATA:**

### **When BIQC Needs HubSpot Data:**

1. **BIQC backend** reads `account_token` from database
2. **BIQC calls Merge.dev API**:
   ```
   GET https://api.merge.dev/api/crm/v1/contacts
   Headers: 
     Authorization: Bearer {MERGE_API_KEY}
     X-Account-Token: {account_token_from_database}
   ```
3. **Merge.dev** uses stored HubSpot OAuth tokens
4. **Merge.dev** fetches data from HubSpot API
5. **Merge.dev** returns standardized data to BIQC
6. **BIQC** receives and uses the data

**Security**: HubSpot OAuth tokens never leave Merge.dev servers!

---

## 🔐 **AUTHENTICATION SUMMARY:**

### **What BIQC Has:**
- ✅ Merge.dev API Key (production): `vVXg9EXkp7_MhXeo4JYJNcpIVJcFaXXAQmXZW7WJMrrXC6H3clsnfQ`
- ✅ Merge account_token (after user connects HubSpot)
- ✅ Permission to fetch data via Merge Unified API

### **What BIQC Does NOT Have:**
- ❌ HubSpot username/password
- ❌ HubSpot OAuth access tokens
- ❌ HubSpot OAuth refresh tokens
- ❌ Direct HubSpot API access

### **What Merge.dev Has:**
- ✅ HubSpot OAuth tokens (access + refresh)
- ✅ HubSpot API credentials
- ✅ Token refresh logic
- ✅ Rate limiting and retry logic

---

## 🎯 **BENEFITS OF THIS APPROACH:**

1. **Security**: BIQC never handles sensitive HubSpot credentials
2. **Simplicity**: One integration (Merge.dev) works with 200+ platforms
3. **Maintenance**: Merge.dev handles API changes, not BIQC
4. **Standardization**: Same API for HubSpot, Salesforce, Pipedrive, etc.

---

## 🔄 **TOKEN LIFECYCLE:**

```
User connects HubSpot
  ↓
Merge.dev receives OAuth tokens from HubSpot
  ↓
Merge.dev stores tokens securely (encrypted)
  ↓
Merge.dev gives BIQC an account_token
  ↓
BIQC stores account_token in database
  ↓
When BIQC needs data:
  → BIQC sends account_token to Merge.dev
  → Merge.dev uses stored HubSpot OAuth tokens
  → Merge.dev fetches from HubSpot
  → Merge.dev returns data to BIQC
  ↓
If HubSpot token expires:
  → Merge.dev automatically refreshes it
  → BIQC doesn't need to do anything
  → Data fetching continues seamlessly
```

---

## ✅ **VERIFICATION CHECKLIST:**

After connecting HubSpot:

- [ ] HubSpot card in BIQC is green
- [ ] Database has row in `integration_accounts` with `provider='HubSpot'`
- [ ] BIQC can fetch contacts: `GET /api/integrations/crm/contacts`
- [ ] BIQC can fetch companies: `GET /api/integrations/crm/companies`
- [ ] BIQC can fetch deals: `GET /api/integrations/crm/deals`
- [ ] MyAdvisor references HubSpot data in conversations

---

## 🚀 **READY TO CONNECT HUBSPOT:**

**Production Merge API Key**: ✅ Updated and backend restarted

**Next Steps:**
1. Go to: https://watchtower-ai.preview.emergentagent.com/integrations
2. Click "Connect" on HubSpot card
3. Select HubSpot in Merge.dev modal
4. Log in to HubSpot and authorize
5. Done! HubSpot data will be accessible to BIQC via Merge.dev

---

## 🔒 **SECURITY GUARANTEE:**

- ✅ Merge.dev is SOC 2 Type II certified
- ✅ OAuth tokens encrypted at rest
- ✅ BIQC never sees your HubSpot password
- ✅ You can revoke access anytime from HubSpot settings
- ✅ Merge.dev handles token refresh automatically

---

**Your production Merge API key is now active. Try connecting HubSpot!** 🚀
