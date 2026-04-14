-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 089: Security Hardening — Views & Function Search Paths
--
-- Fixes 3 ERROR-level and 11 WARNING-level findings from Supabase security linter:
--
-- ERRORs (SECURITY DEFINER views → SECURITY INVOKER):
--   1. users_safe — was bypassing RLS on users table
--   2. v_governance_summary — was bypassing RLS on governance_events
--   3. v_integration_status — was bypassing RLS on workspace_integrations
--
-- WARNINGs (mutable search_path → fixed search_path):
--   8 public functions + 2 business_core functions had NULL proconfig,
--   allowing potential search_path injection attacks.
--
-- Applied to live DB on 2026-04-15. This file records the changes for repo tracking.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── Fix SECURITY DEFINER views → SECURITY INVOKER ──────────────────────────

CREATE OR REPLACE VIEW public.users_safe
WITH (security_invoker = true) AS
SELECT id, email, full_name, company_name, industry, role,
       subscription_tier, is_master_account, microsoft_user_id,
       created_at, updated_at, account_id, is_disabled,
       tutorials_disabled, trial_expires_at, trial_tier
FROM users;

CREATE OR REPLACE VIEW public.v_governance_summary
WITH (security_invoker = true) AS
SELECT workspace_id, source_system,
       count(*) AS event_count,
       count(*) FILTER (WHERE confidence_score >= 0.8) AS high_confidence,
       count(*) FILTER (WHERE confidence_score >= 0.5 AND confidence_score < 0.8) AS medium_confidence,
       count(*) FILTER (WHERE confidence_score < 0.5) AS low_confidence,
       round(avg(confidence_score), 2) AS avg_confidence,
       max(signal_timestamp) AS latest_signal,
       min(signal_timestamp) AS earliest_signal
FROM governance_events
WHERE signal_timestamp > (now() - interval '30 days')
GROUP BY workspace_id, source_system;

CREATE OR REPLACE VIEW public.v_integration_status
WITH (security_invoker = true) AS
SELECT workspace_id,
       jsonb_object_agg(integration_type, status) AS integrations,
       jsonb_object_agg(integration_type, last_sync_at) AS last_syncs,
       count(*) FILTER (WHERE status = 'connected') AS connected_count,
       count(*) AS total_count
FROM workspace_integrations
GROUP BY workspace_id;


-- ─── Fix mutable search_path on functions ───────────────────────────────────

-- public schema functions
ALTER FUNCTION public.fn_map_observation_domain(p_domain text) SET search_path = public;
ALTER FUNCTION public.fn_map_observation_type(p_event_type text) SET search_path = public;
ALTER FUNCTION public.normalize_subscription_tier(p_tier text) SET search_path = public;
ALTER FUNCTION public.sync_business_profile_tier_from_users() SET search_path = public;
ALTER FUNCTION public.touch_evidence_freshness_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_outlook_emails_updated_at() SET search_path = public;
ALTER FUNCTION public.trg_boardroom_message_upsert() SET search_path = public;
ALTER FUNCTION public.trg_observation_to_watchtower() SET search_path = public;

-- business_core schema functions
ALTER FUNCTION business_core.touch_updated_at() SET search_path = business_core, public;
ALTER FUNCTION business_core.prune_webhook_events(retention_days integer) SET search_path = business_core, public;
