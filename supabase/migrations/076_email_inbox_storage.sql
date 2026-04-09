-- 076_email_inbox_storage.sql
-- Creates the outlook_emails table that backend/email_sync_worker.py
-- and backend/supabase_email_helpers.py write to and read from.
-- Despite the name, this table stores messages from BOTH Gmail and
-- Outlook (provider-agnostic). Name retained for backward compat with
-- existing backend code. Rename is tracked as separate tech debt.

CREATE TABLE IF NOT EXISTS public.outlook_emails (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id          uuid,
    provider            text NOT NULL CHECK (provider IN ('gmail', 'outlook', 'microsoft', 'google')),
    graph_message_id    text NOT NULL,
    conversation_id     text,
    subject             text,
    from_address        text,
    from_name           text,
    received_date       timestamptz,
    body_preview        text,
    body_content        text,
    is_read             boolean DEFAULT false,
    folder              text DEFAULT 'inbox',
    web_link            text,
    synced_at           timestamptz DEFAULT now(),
    metadata_only       boolean DEFAULT false,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),
    CONSTRAINT outlook_emails_unique_per_account UNIQUE (user_id, provider, graph_message_id)
);

ALTER TABLE public.outlook_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own outlook_emails" ON public.outlook_emails;
CREATE POLICY "Users read own outlook_emails" ON public.outlook_emails
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role writes outlook_emails" ON public.outlook_emails;
CREATE POLICY "Service role writes outlook_emails" ON public.outlook_emails
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_outlook_emails_user_folder
    ON public.outlook_emails(user_id, folder, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_outlook_emails_user_provider
    ON public.outlook_emails(user_id, provider, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_outlook_emails_user_unread
    ON public.outlook_emails(user_id, is_read)
    WHERE is_read = false;

GRANT SELECT ON public.outlook_emails TO authenticated;
GRANT ALL ON public.outlook_emails TO service_role;

COMMENT ON TABLE public.outlook_emails IS
    'Provider-agnostic email inbox storage. Written by email_sync_worker.py, read by /api/email/messages.';
