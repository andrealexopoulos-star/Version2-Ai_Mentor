-- OUTLOOK EMAILS TABLE SCHEMA
-- Stores email data for intelligence analysis

-- Drop and recreate to ensure clean schema
DROP TABLE IF EXISTS public.outlook_emails CASCADE;

CREATE TABLE public.outlook_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Microsoft Graph identifiers
    graph_message_id TEXT NOT NULL,
    conversation_id TEXT,
    
    -- Email metadata
    subject TEXT,
    from_address TEXT,
    from_name TEXT,
    to_recipients JSONB,
    
    -- Timestamps
    received_date TIMESTAMPTZ,
    
    -- Content
    body_preview TEXT,
    body_content TEXT,
    
    -- Classification
    folder TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    is_external BOOLEAN,
    metadata_only BOOLEAN DEFAULT false,
    
    -- Sync tracking
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint for upsert
    CONSTRAINT unique_email_per_user UNIQUE (user_id, graph_message_id)
);

-- Indexes for RPC performance
CREATE INDEX idx_outlook_emails_user_received ON public.outlook_emails(user_id, received_date DESC);
CREATE INDEX idx_outlook_emails_user_folder ON public.outlook_emails(user_id, folder);
CREATE INDEX idx_outlook_emails_from_address ON public.outlook_emails(from_address);

-- RLS Policies
ALTER TABLE public.outlook_emails ENABLE ROW LEVEL SECURITY;

-- Users can read their own emails
CREATE POLICY "Users can read own emails"
    ON public.outlook_emails
    FOR SELECT
    USING (user_id = auth.uid());

-- Service role can do anything
CREATE POLICY "Service role full access"
    ON public.outlook_emails
    FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.outlook_emails IS 'Email data for intelligence analysis';
