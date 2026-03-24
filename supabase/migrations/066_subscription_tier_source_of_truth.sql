-- 066_subscription_tier_source_of_truth.sql
-- P0 hardening migration:
-- Canonicalize subscription tier in public.users and mirror to business_profiles.

-- Ensure required columns exist.
ALTER TABLE IF EXISTS public.users
    ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

ALTER TABLE IF EXISTS public.business_profiles
    ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

-- Normalize tier values to the currently supported model.
CREATE OR REPLACE FUNCTION public.normalize_subscription_tier(p_tier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v TEXT;
BEGIN
    v := lower(trim(coalesce(p_tier, 'free')));
    IF v IN ('superadmin', 'super_admin') THEN
        RETURN 'super_admin';
    ELSIF v IN ('starter', 'foundation', 'growth', 'professional', 'enterprise', 'custom', 'pro') THEN
        RETURN 'starter';
    ELSIF v = 'free' THEN
        RETURN 'free';
    ELSE
        RETURN 'free';
    END IF;
END;
$$;

-- Backfill canonical users.subscription_tier, preferring existing users value, then business_profiles.
UPDATE public.users u
SET subscription_tier = public.normalize_subscription_tier(
    COALESCE(NULLIF(u.subscription_tier, ''), bp.subscription_tier, 'free')
)
FROM public.business_profiles bp
WHERE bp.user_id = u.id;

UPDATE public.users
SET subscription_tier = public.normalize_subscription_tier(subscription_tier)
WHERE subscription_tier IS NOT NULL;

UPDATE public.users
SET subscription_tier = 'free'
WHERE subscription_tier IS NULL OR trim(subscription_tier) = '';

-- Mirror users tier to business_profiles for compatibility with legacy code paths.
UPDATE public.business_profiles bp
SET subscription_tier = public.normalize_subscription_tier(u.subscription_tier)
FROM public.users u
WHERE u.id = bp.user_id;

-- Trigger: keep business_profiles.subscription_tier synced from users updates.
CREATE OR REPLACE FUNCTION public.sync_business_profile_tier_from_users()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
        INSERT INTO public.business_profiles (user_id, subscription_tier)
        VALUES (NEW.id, public.normalize_subscription_tier(NEW.subscription_tier))
        ON CONFLICT (user_id)
        DO UPDATE SET subscription_tier = EXCLUDED.subscription_tier;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_business_profile_tier_from_users ON public.users;
CREATE TRIGGER trg_sync_business_profile_tier_from_users
AFTER INSERT OR UPDATE OF subscription_tier ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_business_profile_tier_from_users();

-- Replace admin subscription RPC to update canonical users tier, then mirror.
CREATE OR REPLACE FUNCTION public.admin_update_subscription(p_admin_id UUID, p_target_id UUID, p_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev TEXT;
    v_new  TEXT;
    v_actor_id UUID;
    v_actor_role TEXT;
    v_actor_master BOOLEAN;
    v_actor_auth_role TEXT;
BEGIN
    v_actor_auth_role := COALESCE(auth.role(), '');
    v_actor_id := auth.uid();
    IF v_actor_auth_role = 'service_role' THEN
        -- Service-role calls are allowed (backend trust boundary). Validate
        -- that the referenced admin id is truly super admin in users table.
        SELECT role, COALESCE(is_master_account, false)
        INTO v_actor_role, v_actor_master
        FROM public.users
        WHERE id = p_admin_id;
    ELSE
        IF v_actor_id IS NULL OR v_actor_id <> p_admin_id THEN
            RAISE EXCEPTION 'Unauthorized subscription update request';
        END IF;
        SELECT role, COALESCE(is_master_account, false)
        INTO v_actor_role, v_actor_master
        FROM public.users
        WHERE id = v_actor_id;
    END IF;

    IF COALESCE(v_actor_role, '') NOT IN ('super_admin', 'superadmin')
       AND COALESCE(v_actor_master, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Super admin access required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_target_id) THEN
        RAISE EXCEPTION 'Target user not found';
    END IF;

    v_new := public.normalize_subscription_tier(p_tier);

    SELECT COALESCE(subscription_tier, 'free')
    INTO v_prev
    FROM public.users
    WHERE id = p_target_id;

    UPDATE public.users
    SET subscription_tier = v_new
    WHERE id = p_target_id;

    INSERT INTO public.business_profiles (user_id, subscription_tier)
    VALUES (p_target_id, v_new)
    ON CONFLICT (user_id)
    DO UPDATE SET subscription_tier = EXCLUDED.subscription_tier;

    INSERT INTO public.admin_actions (admin_user_id, target_user_id, action_type, previous_value, new_value)
    VALUES (
        p_admin_id,
        p_target_id,
        'update_subscription',
        jsonb_build_object('tier', public.normalize_subscription_tier(v_prev)),
        jsonb_build_object('tier', v_new)
    );

    RETURN jsonb_build_object(
        'status', 'ok',
        'previous_tier', public.normalize_subscription_tier(v_prev),
        'new_tier', v_new
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_subscription(UUID, UUID, TEXT) TO authenticated;
ALTER FUNCTION public.admin_update_subscription(UUID, UUID, TEXT) SET search_path = '';
