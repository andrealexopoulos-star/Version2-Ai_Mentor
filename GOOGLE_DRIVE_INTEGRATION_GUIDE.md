# ============================================================
# GOOGLE DRIVE INTEGRATION VIA MERGE.DEV
# Complete Setup Guide for BIQC
# ============================================================

## PART 1: MERGE.DEV CONFIGURATION
## ============================================================

### 1.1 CREATE MERGE.DEV ACCOUNT
- Go to: https://app.merge.dev
- Sign up / Log in
- Create new project: "BIQC"

### 1.2 ENABLE FILE STORAGE CATEGORY
- In Merge.dev dashboard → Categories
- Enable: "File Storage"
- Add Integration: "Google Drive"

### 1.3 CONFIGURE REDIRECT URIs
Add these URLs to Merge.dev dashboard → Settings → Redirect URIs:

PRIMARY:
https://beta.thestrategysquad.com/api/integrations/merge/callback

DEVELOPMENT (if needed):
http://localhost:3000/integrations/callback

### 1.4 CONFIGURE WEBHOOK URL
Add this to Merge.dev → Webhooks:

WEBHOOK URL:
https://beta.thestrategysquad.com/api/integrations/merge/webhook

EVENTS TO SUBSCRIBE:
- file.created
- file.updated
- file.deleted
- folder.created
- folder.updated

### 1.5 GET YOUR CREDENTIALS
From Merge.dev dashboard → API Keys:

✅ MERGE_API_KEY: <your-production-key>
✅ MERGE_ACCOUNT_TOKEN: <generated-per-user>


## PART 2: BACKEND .ENV CONFIGURATION
## ============================================================

Add these to /app/backend/.env:

# Merge.dev File Storage Integration
MERGE_API_KEY=your_merge_production_key_here
MERGE_ENVIRONMENT=production
MERGE_REDIRECT_URI=https://beta.thestrategysquad.com/api/integrations/merge/callback
MERGE_WEBHOOK_SECRET=your_webhook_secret_here


## PART 3: SUPABASE DATABASE SCHEMA
## ============================================================

Execute this SQL in Supabase SQL Editor:

-- GOOGLE DRIVE FILES TABLE
CREATE TABLE IF NOT EXISTS public.google_drive_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant scope
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Merge.dev identifiers
    merge_file_id TEXT NOT NULL,
    merge_account_token TEXT NOT NULL,
    
    -- File metadata
    file_name TEXT NOT NULL,
    file_type TEXT,
    mime_type TEXT,
    file_size BIGINT,
    
    -- Google Drive specific
    drive_id TEXT,
    drive_name TEXT,
    parent_folder_id TEXT,
    parent_folder_name TEXT,
    web_view_link TEXT,
    download_url TEXT,
    
    -- Ownership & permissions
    owner_email TEXT,
    shared_with JSONB DEFAULT '[]'::jsonb,
    permissions TEXT, -- viewer, commenter, editor, owner
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Content analysis (for Watchtower)
    content_summary TEXT,
    document_type TEXT, -- proposal, contract, report, presentation, etc.
    business_relevance TEXT, -- client_deliverable, internal_doc, external_resource
    analyzed_at TIMESTAMPTZ,
    
    -- Unique constraint
    CONSTRAINT unique_merge_file UNIQUE (account_id, merge_file_id)
);

-- Indexes for performance
CREATE INDEX idx_gdrive_files_account ON public.google_drive_files(account_id);
CREATE INDEX idx_gdrive_files_user ON public.google_drive_files(user_id);
CREATE INDEX idx_gdrive_files_type ON public.google_drive_files(document_type);
CREATE INDEX idx_gdrive_files_modified ON public.google_drive_files(modified_at DESC);

-- RLS Policies
ALTER TABLE public.google_drive_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own files"
    ON public.google_drive_files FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
    ON public.google_drive_files FOR ALL
    USING (true) WITH CHECK (true);

COMMENT ON TABLE public.google_drive_files IS 
'Google Drive files synced via Merge.dev for document intelligence';


-- MERGE.DEV ACCOUNT TOKENS TABLE
CREATE TABLE IF NOT EXISTS public.merge_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Merge.dev credentials
    account_token TEXT NOT NULL UNIQUE,
    integration TEXT NOT NULL, -- 'google_drive'
    integration_name TEXT, -- User-friendly name
    
    -- Status
    status TEXT DEFAULT 'active', -- active, expired, revoked
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT unique_merge_account UNIQUE (account_id, integration, account_token)
);

CREATE INDEX idx_merge_accounts_user ON public.merge_accounts(user_id);
CREATE INDEX idx_merge_accounts_token ON public.merge_accounts(account_token);

ALTER TABLE public.merge_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own merge accounts"
    ON public.merge_accounts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
    ON public.merge_accounts FOR ALL
    USING (true) WITH CHECK (true);


## PART 4: WATCHTOWER INTELLIGENCE RPC
## ============================================================

-- Extend Watchtower to analyze Google Drive activity

CREATE OR REPLACE FUNCTION analyze_document_activity(
  target_user_id UUID,
  analysis_window_days INT DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  insights JSONB;
  total_docs INT;
  client_deliverables INT;
  recent_activity INT;
BEGIN
  -- Count documents by type
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE business_relevance = 'client_deliverable')::INT,
    COUNT(*) FILTER (WHERE modified_at > NOW() - (analysis_window_days || ' days')::INTERVAL)::INT
  INTO total_docs, client_deliverables, recent_activity
  FROM google_drive_files
  WHERE user_id = target_user_id;
  
  -- Build insights
  insights := jsonb_build_object(
    'total_documents', total_docs,
    'client_deliverables', client_deliverables,
    'recent_activity', recent_activity,
    'interpretation', 
      CASE
        WHEN client_deliverables > 10 THEN 'Active client work. High deliverable volume detected.'
        WHEN client_deliverables > 0 THEN 'Moderate client work. Documents are being created.'
        ELSE 'No client deliverables identified yet.'
      END
  );
  
  RETURN insights;
END;
$$;

GRANT EXECUTE ON FUNCTION analyze_document_activity TO authenticated;


## PART 5: REQUIRED PYTHON PACKAGES
## ============================================================

Add to /app/backend/requirements.txt:

mergeapi==1.0.0


## PART 6: SUMMARY - WHAT YOU NEED TO PROVIDE
## ============================================================

✅ IN MERGE.DEV DASHBOARD:
   1. Redirect URI: https://beta.thestrategysquad.com/api/integrations/merge/callback
   2. Webhook URL: https://beta.thestrategysquad.com/api/integrations/merge/webhook
   3. Copy your MERGE_API_KEY

✅ IN GOOGLE CLOUD CONSOLE (if custom OAuth):
   1. Authorized redirect URIs: (Merge.dev will provide their OAuth proxy URL)
   2. Enable Google Drive API

✅ BACKEND ENVIRONMENT VARIABLES:
   - MERGE_API_KEY
   - MERGE_WEBHOOK_SECRET

✅ RUN SQL IN SUPABASE:
   - Execute the schema SQL above
   - Creates google_drive_files table
   - Creates merge_accounts table
   - Creates analyze_document_activity RPC


## PART 7: INTEGRATION FLOW
## ============================================================

USER CONNECTS GOOGLE DRIVE:
1. User clicks "Connect Google Drive" in BIQC
2. Frontend calls: GET /api/integrations/merge/link-token
3. Backend generates Merge Link Token
4. Frontend opens Merge Link (popup/modal)
5. User authenticates with Google
6. Merge.dev redirects to: /api/integrations/merge/callback
7. Backend stores account_token in merge_accounts table
8. Background sync starts immediately

REAL-TIME SYNC:
1. User creates/modifies file in Google Drive
2. Merge.dev sends webhook to: /api/integrations/merge/webhook
3. Backend fetches file metadata from Merge API
4. Backend stores in google_drive_files table
5. Watchtower analyzes document for intelligence

WATCHTOWER INTEGRATION:
- Documents analyzed for business relevance
- Client deliverables tracked
- Document activity feeds into business vitals
- Alerts for missing/outdated deliverables


## PART 8: NEXT STEPS
## ============================================================

1. ✅ Configure Merge.dev (URIs above)
2. ✅ Add MERGE_API_KEY to backend/.env
3. ✅ Run SQL schema in Supabase
4. ⏭️ I will implement:
   - Backend API endpoints
   - Webhook handler
   - Sync logic
   - Watchtower integration
   - Frontend UI component

REPLY "CONFIGURED" when you've completed steps 1-3.
