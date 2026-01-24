-- =====================================================
-- GMAIL CONNECTIONS TABLE
-- Stores Google OAuth tokens for Gmail API access
-- =====================================================

-- Create the table
CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  scopes text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one connection per user
  CONSTRAINT gmail_connections_user_id_key UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own connections
CREATE POLICY "Users can insert their own gmail connections"
  ON public.gmail_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own gmail connections"
  ON public.gmail_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own gmail connections"
  ON public.gmail_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gmail connections"
  ON public.gmail_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id ON public.gmail_connections(user_id);

-- Add comment
COMMENT ON TABLE public.gmail_connections IS 'Stores Google OAuth tokens for Gmail API access per user';
