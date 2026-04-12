-- 077_microsoft_connection_tier.sql
-- Persist Microsoft consent level for BIQc OAuth integration tiers.

ALTER TABLE IF EXISTS public.email_connections
    ADD COLUMN IF NOT EXISTS microsoft_connection_tier text NOT NULL DEFAULT 'basic';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'email_connections'
          AND constraint_name = 'email_connections_microsoft_connection_tier_check'
    ) THEN
        ALTER TABLE public.email_connections
            DROP CONSTRAINT email_connections_microsoft_connection_tier_check;
    END IF;
END $$;

ALTER TABLE IF EXISTS public.email_connections
    ADD CONSTRAINT email_connections_microsoft_connection_tier_check
    CHECK (microsoft_connection_tier IN ('basic', 'admin'));

ALTER TABLE IF EXISTS public.outlook_oauth_tokens
    ADD COLUMN IF NOT EXISTS microsoft_connection_tier text NOT NULL DEFAULT 'basic';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'outlook_oauth_tokens'
          AND constraint_name = 'outlook_oauth_tokens_microsoft_connection_tier_check'
    ) THEN
        ALTER TABLE public.outlook_oauth_tokens
            DROP CONSTRAINT outlook_oauth_tokens_microsoft_connection_tier_check;
    END IF;
END $$;

ALTER TABLE IF EXISTS public.outlook_oauth_tokens
    ADD CONSTRAINT outlook_oauth_tokens_microsoft_connection_tier_check
    CHECK (microsoft_connection_tier IN ('basic', 'admin'));
