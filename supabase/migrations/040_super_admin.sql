-- ═══════════════════════════════════════════════════════════════
-- BIQc SUPER ADMIN + SUPPORT CONSOLE
-- Migration: 040_super_admin.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. Admin actions audit table
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL,
    target_user_id UUID,
    action_type TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_user_id);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_read" ON admin_actions FOR SELECT USING (true);
CREATE POLICY "service_manage" ON admin_actions FOR ALL USING (true) WITH CHECK (true);

-- Backward-compat table used by legacy admin RPCs.
-- Fresh preview branches may not have this relation, so define a safe baseline.
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    is_disabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure role column on users (legacy/public users table may be absent in fresh previews)
DO $$
BEGIN
    IF to_regclass('public.users') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
        ) THEN
            ALTER TABLE public.users ADD COLUMN role TEXT DEFAULT 'user';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_disabled'
        ) THEN
            ALTER TABLE public.users ADD COLUMN is_disabled BOOLEAN DEFAULT false;
        END IF;

        -- 3. Set andre as super_admin
        UPDATE public.users SET role = 'super_admin' WHERE email = 'andre@thestrategysquad.com.au';
        UPDATE public.users SET role = 'super_admin' WHERE email = 'andre@thestrategysquad.com';
    ELSE
        RAISE NOTICE 'Skipping role/is_disabled bootstrap: public.users not present';
    END IF;
END $$;

-- 4. Feature flags
INSERT INTO ic_feature_flags (flag_name, enabled, description) VALUES
    ('super_admin_enabled', true, 'Super admin role and test page'),
    ('support_page_enabled', true, 'Internal support user management console'),
    ('legal_menu_enabled', true, 'Trust & Legal dropdown menu')
ON CONFLICT (flag_name) DO UPDATE SET enabled = true;

-- 5. Admin user list RPC (secure — only returns non-sensitive fields)
CREATE OR REPLACE FUNCTION admin_list_users()
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
        FROM users u
        LEFT JOIN business_profiles bp ON bp.user_id = u.id
    );
END;
$$;

-- 6. Admin disable/enable user
CREATE OR REPLACE FUNCTION admin_toggle_user(p_admin_id UUID, p_target_id UUID, p_disable BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev BOOLEAN;
BEGIN
    SELECT COALESCE(is_disabled, false) INTO v_prev FROM users WHERE id = p_target_id;
    UPDATE users SET is_disabled = p_disable WHERE id = p_target_id;
    INSERT INTO admin_actions (admin_user_id, target_user_id, action_type, previous_value, new_value)
    VALUES (p_admin_id, p_target_id, CASE WHEN p_disable THEN 'disable_user' ELSE 'enable_user' END,
            jsonb_build_object('is_disabled', v_prev), jsonb_build_object('is_disabled', p_disable));
    RETURN jsonb_build_object('status', 'ok', 'is_disabled', p_disable);
END;
$$;

-- 7. Admin update subscription
CREATE OR REPLACE FUNCTION admin_update_subscription(p_admin_id UUID, p_target_id UUID, p_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev TEXT;
BEGIN
    SELECT COALESCE(subscription_tier, 'free') INTO v_prev FROM business_profiles WHERE user_id = p_target_id;
    UPDATE business_profiles SET subscription_tier = p_tier WHERE user_id = p_target_id;
    INSERT INTO admin_actions (admin_user_id, target_user_id, action_type, previous_value, new_value)
    VALUES (p_admin_id, p_target_id, 'update_subscription',
            jsonb_build_object('tier', v_prev), jsonb_build_object('tier', p_tier));
    RETURN jsonb_build_object('status', 'ok', 'previous_tier', v_prev, 'new_tier', p_tier);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_user(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_subscription(UUID, UUID, TEXT) TO authenticated;
