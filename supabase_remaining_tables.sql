-- COMPLETE REMAINING TABLES FOR 100% MIGRATION

-- Onboarding table
CREATE TABLE IF NOT EXISTS onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 0,
    business_stage TEXT,
    onboarding_data JSONB DEFAULT '{}'::jsonb,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Business profiles versioned (for profile history)
CREATE TABLE IF NOT EXISTS business_profiles_versioned (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    profile_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Web sources
CREATE TABLE IF NOT EXISTS web_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    content TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOPs (Standard Operating Procedures)
CREATE TABLE IF NOT EXISTS sops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invites
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Diagnoses
CREATE TABLE IF NOT EXISTS diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diagnosis_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAC (Operations Advisory Centre) tables
CREATE TABLE IF NOT EXISTS oac_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_key TEXT NOT NULL,
    usage_data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month_key)
);

CREATE TABLE IF NOT EXISTS oac_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_key TEXT NOT NULL,
    recommendations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month_key)
);

-- Dismissed notifications
CREATE TABLE IF NOT EXISTS dismissed_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, notification_id)
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts (if multi-tenant needed)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_bp_versioned_user ON business_profiles_versioned(user_id);
CREATE INDEX IF NOT EXISTS idx_web_sources_user ON web_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_sops_user ON sops(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_user ON diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_oac_usage_user ON oac_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_oac_recs_user ON oac_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_user ON dismissed_notifications(user_id);

-- RLS Policies
ALTER TABLE onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles_versioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE oac_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE oac_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dismissed_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_user_policy ON onboarding FOR ALL USING (auth.uid() = user_id);
CREATE POLICY bp_versioned_user_policy ON business_profiles_versioned FOR ALL USING (auth.uid() = user_id);
CREATE POLICY web_sources_user_policy ON web_sources FOR ALL USING (auth.uid() = user_id);
CREATE POLICY sops_user_policy ON sops FOR ALL USING (auth.uid() = user_id);
CREATE POLICY diagnoses_user_policy ON diagnoses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY oac_usage_user_policy ON oac_usage FOR ALL USING (auth.uid() = user_id);
CREATE POLICY oac_recs_user_policy ON oac_recommendations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY dismissed_user_policy ON dismissed_notifications FOR ALL USING (auth.uid() = user_id);
