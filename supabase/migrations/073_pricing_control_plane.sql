-- 073_pricing_control_plane.sql
-- Admin-adjustable pricing control plane foundation.

-- Plans (versioned)
CREATE TABLE IF NOT EXISTS public.pricing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'AUD',
    monthly_price_cents INTEGER NOT NULL DEFAULT 0,
    annual_price_cents INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT false,
    is_draft BOOLEAN NOT NULL DEFAULT true,
    effective_from TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (plan_key, version)
);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON public.pricing_plans(plan_key, is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_draft ON public.pricing_plans(plan_key, is_draft);

-- Feature entitlements per plan version
CREATE TABLE IF NOT EXISTS public.pricing_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_key TEXT NOT NULL,
    plan_version INTEGER NOT NULL,
    feature_key TEXT NOT NULL,
    min_tier TEXT,
    launch_type TEXT,
    usage_limit_monthly INTEGER,
    overage_unit TEXT,
    overage_price_cents NUMERIC(12,2),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (plan_key, plan_version, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_pricing_features_plan ON public.pricing_features(plan_key, plan_version);

-- Account/user specific overrides
CREATE TABLE IF NOT EXISTS public.pricing_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID,
    user_id UUID,
    feature_key TEXT,
    override_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active',
    reason TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_overrides_account ON public.pricing_overrides(account_id, status);
CREATE INDEX IF NOT EXISTS idx_pricing_overrides_user ON public.pricing_overrides(user_id, status);

-- Publish/rollback lifecycle
CREATE TABLE IF NOT EXISTS public.pricing_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_key TEXT NOT NULL,
    from_version INTEGER,
    to_version INTEGER NOT NULL,
    published_by UUID NOT NULL,
    approved_by UUID NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    rollback_of UUID REFERENCES public.pricing_releases(id),
    rollback_reason TEXT,
    status TEXT NOT NULL DEFAULT 'published'
);

CREATE INDEX IF NOT EXISTS idx_pricing_releases_plan ON public.pricing_releases(plan_key, published_at DESC);

-- Immutable audit trail
CREATE TABLE IF NOT EXISTS public.pricing_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    before_state JSONB,
    after_state JSONB,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_audit_log_created ON public.pricing_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_audit_log_actor ON public.pricing_audit_log(actor_user_id, created_at DESC);

-- RLS baseline
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'pricing_plans' AND policyname = 'service_manage_pricing_plans'
    ) THEN
        CREATE POLICY service_manage_pricing_plans ON public.pricing_plans
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'pricing_features' AND policyname = 'service_manage_pricing_features'
    ) THEN
        CREATE POLICY service_manage_pricing_features ON public.pricing_features
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'pricing_overrides' AND policyname = 'service_manage_pricing_overrides'
    ) THEN
        CREATE POLICY service_manage_pricing_overrides ON public.pricing_overrides
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'pricing_releases' AND policyname = 'service_manage_pricing_releases'
    ) THEN
        CREATE POLICY service_manage_pricing_releases ON public.pricing_releases
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'pricing_audit_log' AND policyname = 'service_manage_pricing_audit_log'
    ) THEN
        CREATE POLICY service_manage_pricing_audit_log ON public.pricing_audit_log
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
