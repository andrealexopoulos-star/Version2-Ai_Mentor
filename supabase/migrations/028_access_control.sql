-- ═══════════════════════════════════════════════════════════════
-- BIQc ACCESS CONTROL SCHEMA
-- Migration: 028_access_control.sql
-- Adds subscription tier, usage counters to auth.users metadata
-- ═══════════════════════════════════════════════════════════════

-- Add subscription columns to users table (if using custom users table)
-- Note: Supabase auth.users is managed — we store tier in business_profiles
DO $$
BEGIN
    IF to_regclass('public.business_profiles') IS NULL THEN
        CREATE TABLE IF NOT EXISTS public.business_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
            business_name TEXT,
            industry TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'subscription_tier') THEN
        ALTER TABLE business_profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'monthly_snapshot_count') THEN
        ALTER TABLE business_profiles ADD COLUMN monthly_snapshot_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'monthly_audit_refresh_count') THEN
        ALTER TABLE business_profiles ADD COLUMN monthly_audit_refresh_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'billing_cycle_start') THEN
        ALTER TABLE business_profiles ADD COLUMN billing_cycle_start DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Monthly counter reset function (called by pg_cron)
CREATE OR REPLACE FUNCTION reset_monthly_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE business_profiles
    SET monthly_snapshot_count = 0,
        monthly_audit_refresh_count = 0,
        billing_cycle_start = CURRENT_DATE
    WHERE billing_cycle_start < CURRENT_DATE - INTERVAL '30 days';
END;
$$;

-- pg_cron job: reset monthly counters daily at midnight UTC
-- (Uncomment after pg_cron is enabled)
-- SELECT cron.schedule('biqc-monthly-reset', '0 0 * * *', $$SELECT reset_monthly_counters()$$);

-- Atomic snapshot counter increment
CREATE OR REPLACE FUNCTION increment_snapshot_counter(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tier TEXT;
    v_count INT;
    v_cycle_start DATE;
BEGIN
    SELECT subscription_tier, monthly_snapshot_count, billing_cycle_start
    INTO v_tier, v_count, v_cycle_start
    FROM business_profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Reset if cycle expired
    IF v_cycle_start < CURRENT_DATE - INTERVAL '30 days' THEN
        v_count := 0;
        UPDATE business_profiles
        SET monthly_snapshot_count = 0, monthly_audit_refresh_count = 0, billing_cycle_start = CURRENT_DATE
        WHERE user_id = p_user_id;
    END IF;

    -- Check limit for free tier
    IF COALESCE(v_tier, 'free') = 'free' AND v_count >= 3 THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Monthly snapshot limit reached (3/3)', 'current_count', v_count);
    END IF;

    -- Increment
    UPDATE business_profiles
    SET monthly_snapshot_count = COALESCE(monthly_snapshot_count, 0) + 1
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('allowed', true, 'current_count', v_count + 1);
END;
$$;

-- Atomic audit counter increment
CREATE OR REPLACE FUNCTION increment_audit_counter(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tier TEXT;
    v_count INT;
    v_cycle_start DATE;
BEGIN
    SELECT subscription_tier, monthly_audit_refresh_count, billing_cycle_start
    INTO v_tier, v_count, v_cycle_start
    FROM business_profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_cycle_start < CURRENT_DATE - INTERVAL '30 days' THEN
        v_count := 0;
        UPDATE business_profiles
        SET monthly_snapshot_count = 0, monthly_audit_refresh_count = 0, billing_cycle_start = CURRENT_DATE
        WHERE user_id = p_user_id;
    END IF;

    IF COALESCE(v_tier, 'free') = 'free' AND v_count >= 1 THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Monthly audit limit reached (1/1)', 'current_count', v_count);
    END IF;

    UPDATE business_profiles
    SET monthly_audit_refresh_count = COALESCE(monthly_audit_refresh_count, 0) + 1
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('allowed', true, 'current_count', v_count + 1);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_snapshot_counter(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_audit_counter(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_monthly_counters() TO postgres;
