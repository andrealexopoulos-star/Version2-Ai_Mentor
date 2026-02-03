-- PROVIDER-AGNOSTIC EMAIL TABLE (TRUTH ENGINE FUEL)
-- Ensures ALL connected email accounts feed the intelligence engine

-- Add missing columns for provider-agnostic operation
ALTER TABLE public.outlook_emails 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'outlook';

-- Update constraint to be provider-agnostic
-- Drop old constraint
ALTER TABLE public.outlook_emails DROP CONSTRAINT IF EXISTS unique_email_per_user;

-- Add new provider-agnostic constraint
-- Uses: workspace (account_id) + provider + provider_message_id
ALTER TABLE public.outlook_emails 
ADD CONSTRAINT unique_email_per_account_provider 
UNIQUE (account_id, provider, graph_message_id);

-- Create index for provider queries
CREATE INDEX IF NOT EXISTS idx_outlook_emails_provider ON public.outlook_emails(provider);
CREATE INDEX IF NOT EXISTS idx_outlook_emails_account ON public.outlook_emails(account_id);

-- Update comment
COMMENT ON TABLE public.outlook_emails IS 'Provider-agnostic email data for intelligence analysis (Outlook, Gmail, future providers)';
COMMENT ON COLUMN public.outlook_emails.provider IS 'Email provider: outlook, gmail, etc';
COMMENT ON COLUMN public.outlook_emails.account_id IS 'Workspace/account scope for multi-tenancy';
COMMENT ON COLUMN public.outlook_emails.graph_message_id IS 'Provider-native message ID (Graph API for Outlook, Gmail API for Gmail)';
