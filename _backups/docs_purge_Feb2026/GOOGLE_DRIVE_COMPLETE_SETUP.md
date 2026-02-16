# ============================================================
# GOOGLE DRIVE → SUPABASE COMPLETE SETUP GUIDE
# 100% Supabase | Zero MongoDB | Production Ready
# ============================================================

## ARCHITECTURE DECISION
## ============================================================

You have 2 options for Google Drive integration:

### OPTION A: MERGE.DEV (RECOMMENDED - YOU ALREADY HAVE THIS)
- ✅ No Google Cloud Console setup needed
- ✅ Merge.dev handles OAuth proxy
- ✅ Multi-provider support (Drive, OneDrive, Dropbox, Box)
- ✅ Unified API across providers
- ✅ Webhook support for real-time sync
- ❌ Additional cost (Merge.dev pricing)

### OPTION B: DIRECT GOOGLE DRIVE API
- ✅ No third-party dependency
- ✅ Free (just Google API quotas)
- ❌ Requires Google Cloud Console setup
- ❌ Need to manage OAuth flow yourself
- ❌ Provider-specific code

**RECOMMENDATION: Use Merge.dev (Option A) - You already have account**


## PART 1: MERGE.DEV CONFIGURATION (RECOMMENDED)
## ============================================================

### 1.1 ENABLE FILE STORAGE CATEGORY
Login to: https://app.merge.dev

1. Navigate: **Integrations** → **Categories**
2. Find: **"File Storage"**
3. Click: **"Enable"** (if not already enabled)
4. Add Integration: **"Google Drive"**
5. Status should show: ✅ Enabled

### 1.2 CONFIGURE REDIRECT URI
Go to: **Configuration** → **Redirects** (or **Settings** → **Redirect URIs**)

**Add this URL:**
```
https://beta.thestrategysquad.com/api/integrations/merge/callback
```

### 1.3 CONFIGURE WEBHOOK
Go to: **Configuration** → **Webhooks**

**Webhook URL:**
```
https://beta.thestrategysquad.com/api/integrations/merge/webhook
```

**Enable these events:**
- ✅ `file.created`
- ✅ `file.updated`
- ✅ `file.deleted`
- ✅ `folder.created`
- ✅ `folder.updated`

**Webhook Security:**
- Copy the **Webhook Secret** shown in dashboard
- You'll provide this to me for .env file

### 1.4 CREDENTIALS STATUS
**Already configured:**
✅ `MERGE_API_KEY=vVXg9EXkp7_MhXeo4JYJNcpIVJcFaXXAQmXZW7WJMrrXC6H3clsnfQ`

**Still needed:**
❓ `MERGE_WEBHOOK_SECRET` (provide this)


## PART 2: GOOGLE CLOUD CONSOLE (ONLY FOR DIRECT API)
## ============================================================

**⚠️ SKIP THIS SECTION IF USING MERGE.DEV (RECOMMENDED)**

If you decide NOT to use Merge.dev and want direct Google Drive API:

### 2.1 CREATE GOOGLE CLOUD PROJECT
1. Go to: https://console.cloud.google.com
2. Click: **"Select a project"** → **"New Project"**
3. Project Name: **"BIQC Production"**
4. Click: **"Create"**

### 2.2 ENABLE GOOGLE DRIVE API
1. In project dashboard → **"APIs & Services"** → **"Library"**
2. Search: **"Google Drive API"**
3. Click: **"Enable"**

### 2.3 CONFIGURE OAUTH CONSENT SCREEN
1. Go to: **"APIs & Services"** → **"OAuth consent screen"**
2. User Type: **"External"**
3. Fill in:
   - App Name: **BIQC**
   - User Support Email: *your email*
   - Developer Email: *your email*
4. Authorized Domains:
   ```
   beta.thestrategysquad.com
   ```
5. Scopes: Add these Google Drive scopes:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.metadata.readonly`

### 2.4 CREATE OAUTH CREDENTIALS
1. Go to: **"APIs & Services"** → **"Credentials"**
2. Click: **"Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Application Type: **"Web Application"**
4. Name: **"BIQC Google Drive Integration"**

**Authorized JavaScript Origins:**
```
https://beta.thestrategysquad.com
```

**Authorized Redirect URIs:**
```
https://beta.thestrategysquad.com/api/integrations/google-drive/callback
```

5. Click **"Create"**
6. Copy:
   - Client ID
   - Client Secret

### 2.5 BACKEND ENVIRONMENT VARIABLES (DIRECT API)
**Add to /app/backend/.env:**
```bash
GOOGLE_DRIVE_CLIENT_ID=your_client_id_here
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret_here
GOOGLE_DRIVE_REDIRECT_URI=https://beta.thestrategysquad.com/api/integrations/google-drive/callback
```


## PART 3: SUPABASE DATABASE SCHEMA (REQUIRED FOR BOTH OPTIONS)
## ============================================================

Run this SQL in **Supabase SQL Editor**:

```sql
-- GOOGLE DRIVE FILES TABLE (100% SUPABASE)
CREATE TABLE IF NOT EXISTS public.google_drive_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    merge_file_id TEXT NOT NULL,
    merge_account_token TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    mime_type TEXT,
    file_size BIGINT,
    drive_id TEXT,
    parent_folder_id TEXT,
    parent_folder_name TEXT,
    web_view_link TEXT,
    download_url TEXT,
    owner_email TEXT,
    shared_with JSONB DEFAULT '[]'::jsonb,
    permissions TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    content_summary TEXT,
    document_type TEXT,
    business_relevance TEXT,
    key_topics TEXT[],
    mentioned_clients TEXT[],
    analyzed_at TIMESTAMPTZ,
    CONSTRAINT unique_merge_file UNIQUE (account_id, merge_file_id)
);

CREATE INDEX idx_gdrive_account ON public.google_drive_files(account_id);
CREATE INDEX idx_gdrive_user ON public.google_drive_files(user_id);
CREATE INDEX idx_gdrive_modified ON public.google_drive_files(modified_at DESC);

ALTER TABLE public.google_drive_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own files" ON public.google_drive_files FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role full access" ON public.google_drive_files FOR ALL USING (true) WITH CHECK (true);

-- MERGE INTEGRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.merge_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_token TEXT NOT NULL UNIQUE,
    integration_category TEXT NOT NULL,
    integration_slug TEXT NOT NULL,
    integration_name TEXT,
    status TEXT DEFAULT 'active',
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    last_webhook_at TIMESTAMPTZ,
    end_user_email TEXT,
    end_user_name TEXT,
    integration_metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_merge_integration UNIQUE (account_id, integration_slug, account_token)
);

CREATE INDEX idx_merge_int_account ON public.merge_integrations(account_id);
CREATE INDEX idx_merge_int_token ON public.merge_integrations(account_token);

ALTER TABLE public.merge_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own integrations" ON public.merge_integrations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role full access" ON public.merge_integrations FOR ALL USING (true) WITH CHECK (true);

-- DOCUMENT INTELLIGENCE RPC
CREATE OR REPLACE FUNCTION analyze_document_intelligence(
  target_user_id UUID,
  analysis_window_days INT DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
  total_docs INT;
  client_docs INT;
  recent_docs INT;
  stale_docs INT;
BEGIN
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE business_relevance = 'client_deliverable')::INT,
    COUNT(*) FILTER (WHERE modified_at > NOW() - (30 || ' days')::INTERVAL)::INT,
    COUNT(*) FILTER (WHERE business_relevance = 'client_deliverable' AND modified_at < NOW() - (60 || ' days')::INTERVAL)::INT
  INTO total_docs, client_docs, recent_docs, stale_docs
  FROM google_drive_files
  WHERE user_id = target_user_id
    AND created_at > NOW() - (analysis_window_days || ' days')::INTERVAL;
  
  result := jsonb_build_object(
    'total_documents', total_docs,
    'client_deliverables', client_docs,
    'recent_activity', recent_docs,
    'stale_deliverables', stale_docs,
    'interpretation', 
      CASE
        WHEN stale_docs > 3 THEN 'Warning: Multiple client deliverables have not been updated in 60+ days.'
        WHEN client_docs > 10 THEN 'Active client work. High deliverable volume detected.'
        WHEN client_docs > 0 THEN 'Moderate client work. Documents are being created.'
        ELSE 'No client deliverables identified yet.'
      END,
    'analysis_window_days', analysis_window_days,
    'generated_at', NOW()
  );
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION analyze_document_intelligence TO authenticated;
```


## PART 4: EDGE FUNCTIONS? (ANSWER)
## ============================================================

**QUESTION:** Do I need to set this up in Supabase Edge Functions?

**ANSWER: NO**

**Why:**
- ✅ Your backend is FastAPI (Python) - already running
- ✅ Merge.dev client code already exists
- ✅ Faster implementation in existing stack
- ✅ No need for separate TypeScript/Deno deployment

**What we'll use:**
- Regular FastAPI endpoints in `/app/backend/server.py`
- Supabase PostgreSQL for storage (via Python client)
- Existing supervisor service management

**Edge Functions are optional for:**
- Serverless workloads
- Geographic distribution
- Different tech stack preference

**For this integration: FastAPI backend is the right choice.**


## PART 5: COMPLETE URL/URI REFERENCE
## ============================================================

### MERGE.DEV DASHBOARD SETTINGS:

**Redirect URI:**
```
https://beta.thestrategysquad.com/api/integrations/merge/callback
```

**Webhook URL:**
```
https://beta.thestrategysquad.com/api/integrations/merge/webhook
```

### GOOGLE CLOUD CONSOLE (ONLY IF DIRECT API - OPTION B):

**Authorized JavaScript Origins:**
```
https://beta.thestrategysquad.com
```

**Authorized Redirect URIs:**
```
https://beta.thestrategysquad.com/api/integrations/google-drive/callback
```

### BACKEND API ENDPOINTS (I WILL CREATE):

**Link Token Generation:**
```
GET /api/integrations/merge/link-token?category=file_storage
```

**OAuth Callback:**
```
GET /api/integrations/merge/callback?public_token=<token>
```

**Webhook Receiver:**
```
POST /api/integrations/merge/webhook
```

**Sync Trigger:**
```
POST /api/integrations/google-drive/sync
```

**Get Files:**
```
GET /api/integrations/google-drive/files
```


## PART 6: MONGODB ELIMINATION CHECKLIST
## ============================================================

✅ **Storage:** All Google Drive files → `google_drive_files` table (Supabase PostgreSQL)
✅ **Credentials:** Merge account tokens → `merge_integrations` table (Supabase PostgreSQL)
✅ **Intelligence:** Document analysis → Supabase RPC (PostgreSQL function)
✅ **Watchtower:** Intelligence events → `watchtower_events` table (Supabase PostgreSQL)

**MongoDB usage: ZERO**
**Supabase usage: 100%**


## PART 7: WHAT YOU NEED TO PROVIDE
## ============================================================

### IMMEDIATELY:
1. ✅ **Merge.dev Redirect URI configured:** Reply "Redirect added"
2. ✅ **Merge.dev Webhook URL configured:** Reply "Webhook added"
3. ❓ **Webhook Secret:** Provide the secret from Merge.dev dashboard

### IN SUPABASE:
4. ✅ **Execute SQL:** Run the schema SQL (Part 3 above)

### OPTIONAL (ONLY IF USING DIRECT GOOGLE API):
5. ❌ **Google Cloud Console:** Setup OAuth credentials (skip if using Merge.dev)


## PART 8: WHAT I WILL BUILD
## ============================================================

Once you provide the webhook secret and confirm SQL is executed:

### Backend (FastAPI - NOT Edge Functions):
- ✅ `/api/integrations/merge/link-token` - Generate Merge Link
- ✅ `/api/integrations/merge/callback` - Handle OAuth completion
- ✅ `/api/integrations/merge/webhook` - Real-time file sync
- ✅ `/api/integrations/google-drive/sync` - Manual sync trigger
- ✅ `/api/integrations/google-drive/files` - List user files
- ✅ Supabase storage helpers (100% PostgreSQL, zero MongoDB)
- ✅ Background worker for periodic sync

### Watchtower Intelligence:
- ✅ Document activity analysis
- ✅ Client deliverable tracking
- ✅ Stale document alerts
- ✅ Integration with existing Watchtower events

### Frontend:
- ✅ "Connect Google Drive" button
- ✅ Merge Link modal integration
- ✅ Files list UI component
- ✅ Watchtower document insights display


## QUICK START SUMMARY
## ============================================================

**YOUR ACTION ITEMS (5 MINUTES):**

1. **Merge.dev Dashboard:**
   - Add Redirect: `https://beta.thestrategysquad.com/api/integrations/merge/callback`
   - Add Webhook: `https://beta.thestrategysquad.com/api/integrations/merge/webhook`
   - Enable events: file.created, file.updated, file.deleted, folder.created, folder.updated
   - Copy Webhook Secret

2. **Supabase SQL Editor:**
   - Run the SQL from Part 3 above

3. **Provide Me:**
   - Your Webhook Secret: `MERGE_WEBHOOK_SECRET=<paste here>`

**MY ACTION ITEMS (15 MINUTES):**
- Implement all backend endpoints
- Create Supabase storage helpers
- Build webhook handler
- Integrate with Watchtower
- Create frontend UI

---

**ANSWER TO YOUR QUESTIONS:**

✅ **Google Console URIs needed?** NO (if using Merge.dev)
✅ **Supabase Edge Functions?** NO (using FastAPI backend)
✅ **100% in Supabase?** YES (zero MongoDB)
✅ **Immediately in Watchtower?** YES (via webhook + RPC)

---

**📤 REPLY WITH:**
1. "Merge.dev configured" (when URIs added)
2. Your webhook secret
3. "SQL executed" (when Supabase schema created)

**Then I'll implement the complete integration in one execution.**