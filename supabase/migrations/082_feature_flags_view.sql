-- 082_feature_flags_view.sql
-- Public-facing view on intelligence_core.feature_flags for frontend access.
-- The base table exists from migration 037 (cognition platform).
-- Actual table columns: id, flag_name, enabled, description, created_at
-- Maps to view columns: flag_key, flag_value, is_enabled, description

CREATE OR REPLACE VIEW public.active_feature_flags AS
SELECT
    flag_name AS flag_key,
    CASE WHEN enabled THEN 'true' ELSE 'false' END AS flag_value,
    description,
    enabled AS is_enabled
FROM intelligence_core.feature_flags
WHERE enabled = true;

GRANT SELECT ON public.active_feature_flags TO authenticated;
GRANT SELECT ON public.active_feature_flags TO anon;
