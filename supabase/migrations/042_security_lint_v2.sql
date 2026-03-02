-- ═══════════════════════════════════════════════════════════════
-- BIQc SECURITY LINT FIXES v2 — Remaining 7 issues
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1-5: Functions with mutable search_path (safe — wraps in exception handler)
DO $$ BEGIN ALTER FUNCTION public.compute_market_risk_weight() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.calibrate_pressure() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.decay_evidence() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.compute_forensic_score() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ic_calculate_risk_baseline has two signatures — fix both
DO $$ BEGIN ALTER FUNCTION public.ic_calculate_risk_baseline(UUID) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.ic_calculate_risk_baseline(UUID, UUID) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- 6: intelligence_core schema function
DO $$ BEGIN ALTER FUNCTION intelligence_core.is_spine_enabled() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- 7: Move vector extension to dedicated schema
-- NOTE: This is a WARN not an ERROR. Moving pgvector to another schema
-- requires updating all references. Safe to leave in public for now.
-- To fix properly (optional):
-- CREATE SCHEMA IF NOT EXISTS extensions;
-- ALTER EXTENSION vector SET SCHEMA extensions;
-- Then update rag_search() to reference extensions.vector
