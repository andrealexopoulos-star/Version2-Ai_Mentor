-- Business Core access bridge
-- Purpose:
-- 1. Grant actual table privileges across business_core objects so RLS policies can work.
-- 2. Expose a public RPC wrapper for brain_initial_calibration because current API calls
--    use the public schema path.

CREATE SCHEMA IF NOT EXISTS business_core;

GRANT USAGE ON SCHEMA business_core TO authenticated;
GRANT USAGE ON SCHEMA business_core TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA business_core TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA business_core TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA business_core TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA business_core TO service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA business_core TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA business_core TO service_role;

CREATE OR REPLACE FUNCTION public.brain_initial_calibration(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, business_core
AS $$
    SELECT business_core.brain_initial_calibration(p_tenant_id);
$$;

GRANT EXECUTE ON FUNCTION public.brain_initial_calibration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.brain_initial_calibration(UUID) TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA business_core
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA business_core
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA business_core
GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA business_core
GRANT USAGE, SELECT ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA business_core
GRANT EXECUTE ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA business_core
GRANT EXECUTE ON FUNCTIONS TO service_role;