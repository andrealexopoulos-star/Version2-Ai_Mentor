# BIQC BASELINE SNAPSHOT - STABILISATION FORK

**Date:** January 25, 2025  
**Fork:** mobile-auth-app-5  
**Objective:** Stabilize and complete BIQC intelligence pipeline WITHOUT OAuth/URL/secret changes

---

## CURRENT ENVIRONMENT

### **URLs (LOCKED - NO CHANGES)**
- **Frontend:** `https://biqc-ai-insights.preview.emergentagent.com`
- **Backend:** `https://biqc-ai-insights.preview.emergentagent.com/api`
- **Supabase:** `https://uxyqpdfftxpkzeppqtvk.supabase.co`

### **Supabase Project**
- **Project Ref:** `uxyqpdfftxpkzeppqtvk`
- **Anon Key:** Configured
- **Service Role Key:** Configured

### **Edge Functions (Existing in Supabase)**
1. `gmail_prod` - Gmail connection verification + Priority Inbox detection
2. `gmail_test` - Legacy testing function
3. `integration-status` - Unified status checker (Gmail/Outlook)
4. `email_priority` - Gmail Priority Inbox analysis

---

## API ROUTES INVENTORY

### **Gmail Integration**
- `GET /api/auth/gmail/login` - Initiate Gmail OAuth
- `GET /api/auth/gmail/callback` - Handle OAuth callback
- `GET /api/gmail/status` - Check connection status
- `POST /api/gmail/disconnect` - Remove connection

**Edge Function:** `/functions/v1/gmail_prod`
- Verifies Gmail connection
- Returns: `inbox_type: "priority"` or `"standard"`
- Uses: `gmail_connections` table

**Edge Function:** `/functions/v1/email_priority?provider=gmail`
- Fetches Gmail messages
- Returns prioritized email analysis

---

### **Outlook Integration**
- `GET /api/auth/outlook/login` - Initiate Outlook OAuth
- `GET /api/auth/outlook/callback` - Handle OAuth callback
- `GET /api/outlook/status` - Check connection status
- `POST /api/outlook/disconnect` - Remove connection
- `GET /api/outlook/emails/sync` - Sync emails
- `POST /api/outlook/comprehensive-sync` - Background sync
- `GET /api/outlook/calendar/events` - **400 ERROR**
- `POST /api/outlook/calendar/sync` - **400 ERROR**

---

### **Priority Inbox**
- `POST /api/email/analyze-priority` - Analyze Outlook emails (backend)
- `GET /api/email/priority-inbox` - Get cached analysis (backend)
- `/functions/v1/email_priority?provider=gmail` - Analyze Gmail (Edge Function)

---

### **Chat Endpoints**
- `POST /api/chat` - **500 ERROR**
- `GET /api/chat/history` - Chat history

**MyAdvisor:**
- Uses `/api/chat` endpoint

**MySoundBoard:**
- `GET /api/soundboard/conversations` - **500 ERROR**
- `GET /api/soundboard/conversations/{id}` - Get conversation
- `POST /api/soundboard/chat` - Send message
- `PATCH /api/soundboard/conversations/{id}` - Update conversation
- `DELETE /api/soundboard/conversations/{id}` - Delete conversation

---

## CURRENT STATE VERIFICATION

### **✅ WORKING**
- Backend health check: 200 OK
- Google Auth (login/signup)
- Gmail OAuth connection flow
- Gmail tokens stored in database
- Integrations page shows Gmail as connected
- Outlook email sync exists

### **❌ FAILING**
- `POST /api/chat` → 500 Internal Server Error
- `GET /api/soundboard/conversations` → 500 Internal Server Error
- `GET /api/outlook/calendar/events` → 400 Bad Request
- `POST /api/outlook/calendar/sync` → 400 Bad Request
- Priority Inbox: Shows empty state (no analysis displayed)
- MyAdvisor: Cannot chat (500 error)
- MySoundBoard: Cannot load conversations (500 error)

### **⚠️ PARTIALLY WORKING**
- Gmail Edge Functions: Deployed but returning 401 (token validation issues)
- Priority Inbox UI: Renders but shows "No Priority Analysis Yet"

---

## SECRETS STATUS (LOCKED - NO CHANGES)

**Backend Secrets:**
- GOOGLE_CLIENT_SECRET: `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`
- AZURE_CLIENT_SECRET: `o8S8Q~3.q3nakGJkPOSZ.WkcdA0xsdNJUZ8Y5aVb`
- SUPABASE keys: Configured
- EMERGENT_LLM_KEY: Configured

**Edge Function Secrets (User-Managed in Supabase):**
- May have stale GOOGLE_CLIENT_SECRET (user must verify/update)
- Cannot be changed from this environment

---

## CONFIRMATION

**I WILL NOT CHANGE:**
- ❌ Google OAuth settings or redirect URIs
- ❌ Azure/Microsoft OAuth settings
- ❌ Supabase Auth provider configs
- ❌ Any preview URLs (`mobile-auth-app-5.preview.emergentagent.com`)
- ❌ Backend secrets (already correct)
- ❌ Supabase project URL or keys

**I WILL ONLY FIX:**
- ✅ Code logic to make existing integrations work
- ✅ Intelligence pipeline (data flow)
- ✅ Chat endpoints (500 errors)
- ✅ Calendar endpoints (400 errors)
- ✅ Priority Inbox analysis display

---

**Baseline captured. Ready to proceed to Phase 1.**
