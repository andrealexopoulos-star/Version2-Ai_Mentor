-- Migration 049: Fix fn_compute_propagation_map column references
-- The function was referencing pr.probability and pr.lag_days which don't exist
-- Actual columns: pr.base_probability, pr.time_horizon, pr.mechanism
-- Run this in Supabase SQL Editor to fix the cognition/overview 500 error

CREATE OR REPLACE FUNCTION fn_compute_propagation_map(p_tenant_id UUID, p_active_risks TEXT[]) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chains JSONB := '[]';
  r RECORD;
BEGIN
  IF array_length(p_active_risks, 1) IS NULL THEN RETURN '[]'; END IF;
  FOR r IN
    SELECT pr.source_domain, pr.target_domain, pr.base_probability, pr.time_horizon, pr.mechanism
    FROM propagation_rules pr
    WHERE pr.source_domain = ANY(p_active_risks) AND pr.is_active = true
    ORDER BY pr.base_probability DESC LIMIT 5
  LOOP
    v_chains := v_chains || jsonb_build_object(
      'source', r.source_domain,
      'target', r.target_domain,
      'probability', r.base_probability,
      'window', r.time_horizon || ' days',
      'description', r.mechanism,
      'chain', jsonb_build_array(r.source_domain, r.target_domain)
    );
  END LOOP;
  RETURN v_chains;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_compute_propagation_map(UUID, TEXT[]) TO authenticated, service_role;
