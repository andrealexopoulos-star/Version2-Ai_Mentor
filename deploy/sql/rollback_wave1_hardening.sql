-- rollback_wave1_hardening.sql
-- Emergency rollback for migrations:
--   065_rls_tenant_lockdown.sql
--   066_subscription_tier_source_of_truth.sql
--   067_super_admin_rpc_authorization.sql
--
-- WARNING:
-- This rollback restores prior behavior, including weaker read policies.
-- Use only for emergency recovery during failed rollout, then re-apply hardening.

BEGIN;

-- ============================================================
-- Roll back 065 policy changes
-- ============================================================

-- workspace_integrations
DROP POLICY IF EXISTS "workspace_integrations_tenant_read" ON public.workspace_integrations;
CREATE POLICY "Users read own workspace_integrations"
ON public.workspace_integrations
FOR SELECT
USING (true);

-- governance_events
DROP POLICY IF EXISTS "governance_events_tenant_read" ON public.governance_events;
DROP POLICY IF EXISTS "governance_events_service_read" ON public.governance_events;
DROP POLICY IF EXISTS "governance_events_service_insert" ON public.governance_events;
CREATE POLICY "Users read own governance_events"
ON public.governance_events
FOR SELECT
USING (true);
CREATE POLICY "service_insert_governance_events"
ON public.governance_events
FOR INSERT TO service_role
WITH CHECK (true);

-- report_exports
DROP POLICY IF EXISTS "report_exports_tenant_read" ON public.report_exports;
CREATE POLICY "Users read own report_exports"
ON public.report_exports
FOR SELECT
USING (true);

-- generated_files
DROP POLICY IF EXISTS "generated_files_tenant_read" ON public.generated_files;
CREATE POLICY "tenant_read_files"
ON public.generated_files
FOR SELECT
USING (true);

-- enterprise_contact_requests
DROP POLICY IF EXISTS "enterprise_contact_requests_user_insert" ON public.enterprise_contact_requests;
DROP POLICY IF EXISTS "enterprise_contact_requests_user_read" ON public.enterprise_contact_requests;
CREATE POLICY "Anyone can submit enterprise_contact_requests"
ON public.enterprise_contact_requests
FOR INSERT
WITH CHECK (true);
CREATE POLICY "Admins see all enterprise_contact_requests"
ON public.enterprise_contact_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Roll back 066 subscription canonicalization logic
-- ============================================================

-- Remove sync trigger and helper functions introduced in 066.
DROP TRIGGER IF EXISTS trg_sync_business_profile_tier_from_users ON public.users;
DROP FUNCTION IF EXISTS public.sync_business_profile_tier_from_users();
DROP FUNCTION IF EXISTS public.normalize_subscription_tier(TEXT);

-- Restore pre-066 admin subscription RPC behavior (business_profiles-backed).
CREATE OR REPLACE FUNCTION public.admin_update_subscription(p_admin_id UUID, p_target_id UUID, p_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev TEXT;
BEGIN
    SELECT COALESCE(subscription_tier, 'free') INTO v_prev FROM public.business_profiles WHERE user_id = p_target_id;
    UPDATE public.business_profiles SET subscription_tier = p_tier WHERE user_id = p_target_id;
    INSERT INTO public.admin_actions (admin_user_id, target_user_id, action_type, previous_value, new_value)
    VALUES (
        p_admin_id,
        p_target_id,
        'update_subscription',
        jsonb_build_object('tier', v_prev),
        jsonb_build_object('tier', p_tier)
    );
    RETURN jsonb_build_object('status', 'ok', 'previous_tier', v_prev, 'new_tier', p_tier);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_subscription(UUID, UUID, TEXT) TO authenticated;
ALTER FUNCTION public.admin_update_subscription(UUID, UUID, TEXT) SET search_path = '';

-- ============================================================
-- Roll back 067 super-admin RPC authorization hardening
-- ============================================================

DROP POLICY IF EXISTS "superadmin_read" ON public.admin_actions;
CREATE POLICY "superadmin_read" ON public.admin_actions FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'full_name', u.full_name,
            'role', u.role,
            'is_disabled', COALESCE(u.is_disabled, false),
            'business_name', bp.business_name,
            'subscription_tier', COALESCE(bp.subscription_tier, 'free'),
            'industry', bp.industry,
            'created_at', u.created_at
        ) ORDER BY u.created_at DESC), '[]'::JSONB)
        FROM public.users u
        LEFT JOIN public.business_profiles bp ON bp.user_id = u.id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_user(p_admin_id UUID, p_target_id UUID, p_disable BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev BOOLEAN;
BEGIN
    SELECT COALESCE(is_disabled, false) INTO v_prev FROM public.users WHERE id = p_target_id;
    UPDATE public.users SET is_disabled = p_disable WHERE id = p_target_id;
    INSERT INTO public.admin_actions (admin_user_id, target_user_id, action_type, previous_value, new_value)
    VALUES (
        p_admin_id,
        p_target_id,
        CASE WHEN p_disable THEN 'disable_user' ELSE 'enable_user' END,
        jsonb_build_object('is_disabled', v_prev),
        jsonb_build_object('is_disabled', p_disable)
    );
    RETURN jsonb_build_object('status', 'ok', 'is_disabled', p_disable);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user(UUID, UUID, BOOLEAN) TO authenticated;
ALTER FUNCTION public.admin_list_users() SET search_path = '';
ALTER FUNCTION public.admin_toggle_user(UUID, UUID, BOOLEAN) SET search_path = '';

COMMIT;
