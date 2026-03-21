-- 064_business_profiles_prereq_hotfix.sql
-- Forward-only production hotfix:
-- Ensure business_profiles exists and carries columns required by prior migrations.

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

    -- 021_trust_reconstruction.sql
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'source_map'
    ) THEN
        ALTER TABLE public.business_profiles ADD COLUMN source_map JSONB;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'confidence_map'
    ) THEN
        ALTER TABLE public.business_profiles ADD COLUMN confidence_map JSONB;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'timestamp_map'
    ) THEN
        ALTER TABLE public.business_profiles ADD COLUMN timestamp_map JSONB;
    END IF;

    -- 027_ingestion_engine.sql
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'dna_trace'
    ) THEN
        ALTER TABLE public.business_profiles ADD COLUMN dna_trace JSONB;
    END IF;

    -- 028_access_control.sql
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE public.business_profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'monthly_snapshot_count'
    ) THEN
        ALTER TABLE public.business_profiles ADD COLUMN monthly_snapshot_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'monthly_audit_refresh_count'
    ) THEN
        ALTER TABLE public.business_profiles ADD COLUMN monthly_audit_refresh_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'billing_cycle_start'
    ) THEN
        ALTER TABLE public.business_profiles ADD COLUMN billing_cycle_start DATE DEFAULT CURRENT_DATE;
    END IF;

    -- 035_risk_baseline_hardening.sql
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'industry_code'
    ) THEN
        ALTER TABLE public.business_profiles ADD COLUMN industry_code TEXT;
    END IF;
END $$;

