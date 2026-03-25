-- Harden super-admin RPC authorization and audit-log visibility.

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    is_master_account BOOLEAN DEFAULT false,
    is_disabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE IF EXISTS public.users
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS is_master_account BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_read" ON public.admin_actions;
CREATE POLICY "superadmin_read" ON public.admin_actions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                  COALESCE(u.role, '') IN ('super_admin', 'superadmin')
                  OR COALESCE(u.is_master_account, false) = true
              )
        )
    );

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_is_super_admin BOOLEAN := false;
    v_actor_auth_role TEXT := COALESCE(auth.role(), '');
BEGIN
    IF v_actor_auth_role <> 'service_role' THEN
        IF v_actor_id IS NULL THEN
            RAISE EXCEPTION 'Not authenticated';
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = v_actor_id
              AND (
                  COALESCE(u.role, '') IN ('super_admin', 'superadmin')
                  OR COALESCE(u.is_master_account, false) = true
              )
        ) INTO v_is_super_admin;

        IF NOT v_is_super_admin THEN
            RAISE EXCEPTION 'Not authorized';
        END IF;
    END IF;

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
    v_actor_id UUID := auth.uid();
    v_prev BOOLEAN;
    v_is_super_admin BOOLEAN := false;
    v_actor_auth_role TEXT := COALESCE(auth.role(), '');
BEGIN
    IF v_actor_auth_role <> 'service_role' THEN
        IF v_actor_id IS NULL THEN
            RAISE EXCEPTION 'Not authenticated';
        END IF;
        IF p_admin_id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'Not authorized';
        END IF;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_admin_id
          AND (
              COALESCE(u.role, '') IN ('super_admin', 'superadmin')
              OR COALESCE(u.is_master_account, false) = true
          )
    ) INTO v_is_super_admin;

    IF NOT v_is_super_admin THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT COALESCE(is_disabled, false)
    INTO v_prev
    FROM public.users
    WHERE id = p_target_id;

    UPDATE public.users
    SET is_disabled = p_disable
    WHERE id = p_target_id;

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

ALTER FUNCTION public.admin_list_users() SET search_path = '';
ALTER FUNCTION public.admin_toggle_user(UUID, UUID, BOOLEAN) SET search_path = '';

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user(UUID, UUID, BOOLEAN) TO authenticated;
