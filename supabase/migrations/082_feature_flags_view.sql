-- 082_feature_flags_view.sql
-- Public-facing view on intelligence_core.feature_flags for frontend access.
-- The base table exists from migration 037 (cognition platform).
-- This creates a safe, read-only view for authenticated users.

DO $$
BEGIN
    -- Only create the view if the source table exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'intelligence_core'
          AND table_name = 'feature_flags'
    ) THEN
        EXECUTE '
            CREATE OR REPLACE VIEW public.active_feature_flags AS
            SELECT flag_key, flag_value, description, is_enabled
            FROM intelligence_core.feature_flags
            WHERE is_enabled = true
        ';
        EXECUTE 'GRANT SELECT ON public.active_feature_flags TO authenticated';
        EXECUTE 'GRANT SELECT ON public.active_feature_flags TO anon';
    END IF;
END $$;
