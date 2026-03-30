-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 053: Fix email_connections unique constraint
-- Allows multiple providers per user (gmail + outlook per user)
-- ═══════════════════════════════════════════════════════════════

-- Add unique constraint on (user_id, provider) if not exists
DO $$
BEGIN
  IF to_regclass('public.email_connections') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'email_connections_user_provider_key'
    ) THEN
      ALTER TABLE public.email_connections 
      ADD CONSTRAINT email_connections_user_provider_key UNIQUE (user_id, provider);
    END IF;
  END IF;
END $$;

-- Add missing columns if not present
DO $$
BEGIN
  IF to_regclass('public.email_connections') IS NOT NULL THEN
    ALTER TABLE public.email_connections 
      ADD COLUMN IF NOT EXISTS email_address text,  -- alias for connected_email
      ADD COLUMN IF NOT EXISTS is_connected boolean GENERATED ALWAYS AS (connected) STORED,
      ADD COLUMN IF NOT EXISTS last_refreshed timestamptz;
  END IF;
END $$;

-- Index for fast provider lookups
DO $$
BEGIN
  IF to_regclass('public.email_connections') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_email_connections_user_provider 
      ON public.email_connections(user_id, provider);
  END IF;
END $$;

-- Ensure service_role has access
DO $$
BEGIN
  IF to_regclass('public.email_connections') IS NOT NULL THEN
    GRANT ALL ON public.email_connections TO service_role;
  END IF;
END $$;

-- ── outlook_oauth_tokens: add unique constraint if missing ──────
DO $$
BEGIN
  IF to_regclass('public.outlook_oauth_tokens') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'outlook_oauth_tokens_user_id_key'
    ) THEN
      ALTER TABLE public.outlook_oauth_tokens 
      ADD CONSTRAINT outlook_oauth_tokens_user_id_key UNIQUE (user_id);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.outlook_oauth_tokens') IS NOT NULL THEN
    GRANT ALL ON public.outlook_oauth_tokens TO service_role;
  END IF;
END $$;

-- ── gmail_connections: ensure updated_at has default ───────────
DO $$
BEGIN
  IF to_regclass('public.gmail_connections') IS NOT NULL THEN
    ALTER TABLE public.gmail_connections 
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    GRANT ALL ON public.gmail_connections TO service_role;
  END IF;
END $$;
