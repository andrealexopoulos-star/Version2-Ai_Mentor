-- BIQC CALIBRATION SYSTEM SCHEMA
-- Replaces legacy onboarding - Strategic partner calibration approach

-- 1. STRATEGY PROFILES (AI-Generated Drafts + Raw Inputs)
CREATE TABLE IF NOT EXISTS public.strategy_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    
    -- Raw User Inputs (source: user)
    raw_mission_input TEXT,
    raw_vision_input TEXT,
    short_term_goals_raw TEXT,
    long_term_goals_raw TEXT,
    main_challenges_raw TEXT,
    growth_strategy_raw TEXT,
    
    -- AI-Generated Drafts (source: ai_generated, regenerable)
    mission_statement TEXT,
    vision_statement TEXT,
    short_term_goals TEXT,
    long_term_goals TEXT,
    primary_challenges TEXT,
    growth_strategy TEXT,
    
    -- Regeneration tracking
    regeneration_version INT DEFAULT 1,
    last_generated_at TIMESTAMPTZ,
    
    -- Status
    calibration_status TEXT DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_strategy_profile UNIQUE (business_profile_id)
);

CREATE INDEX idx_strategy_user ON public.strategy_profiles(user_id);
CREATE INDEX idx_strategy_account ON public.strategy_profiles(account_id);

ALTER TABLE public.strategy_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own strategy" ON public.strategy_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role full access" ON public.strategy_profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. CALIBRATION SESSIONS (Audit Trail)
CREATE TABLE IF NOT EXISTS public.calibration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Session metadata
    calibration_version INT DEFAULT 1,
    session_type TEXT DEFAULT 'initial', -- initial | recalibration | update
    
    -- Completion
    questions_answered INT DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calibration_sessions_user ON public.calibration_sessions(user_id);
CREATE INDEX idx_calibration_sessions_profile ON public.calibration_sessions(business_profile_id);

ALTER TABLE public.calibration_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own calibration sessions" ON public.calibration_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role full access" ON public.calibration_sessions FOR ALL USING (true) WITH CHECK (true);

-- 3. 15-WEEK SCHEDULE SCAFFOLD
CREATE TABLE IF NOT EXISTS public.working_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    
    -- Schedule metadata
    schedule_type TEXT DEFAULT '15_week_scaffold',
    week_number INT NOT NULL CHECK (week_number >= 1 AND week_number <= 15),
    
    -- Week content (initially empty placeholders)
    focus_area TEXT,
    planned_activities JSONB DEFAULT '[]'::jsonb,
    milestones JSONB DEFAULT '[]'::jsonb,
    
    -- Progress tracking
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'deferred')),
    completion_percentage INT DEFAULT 0,
    
    -- Timestamps
    week_start_date DATE,
    week_end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_week_per_profile UNIQUE (business_profile_id, week_number)
);

CREATE INDEX idx_schedule_profile ON public.working_schedules(business_profile_id);
CREATE INDEX idx_schedule_week ON public.working_schedules(week_number);

ALTER TABLE public.working_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own schedules" ON public.working_schedules FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role full access" ON public.working_schedules FOR ALL USING (true) WITH CHECK (true);

-- 4. INTELLIGENCE PRIORITY HIERARCHY
CREATE TABLE IF NOT EXISTS public.intelligence_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Priority configuration
    priority_rank INT NOT NULL CHECK (priority_rank >= 1 AND priority_rank <= 10),
    signal_category TEXT NOT NULL, -- revenue_sales | team_capacity | delivery_ops | strategy_drift
    
    -- Configuration
    enabled BOOLEAN DEFAULT true,
    threshold_sensitivity TEXT DEFAULT 'medium' CHECK (threshold_sensitivity IN ('low', 'medium', 'high')),
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_priority_per_profile UNIQUE (business_profile_id, signal_category)
);

CREATE INDEX idx_intelligence_priority_profile ON public.intelligence_priorities(business_profile_id);
CREATE INDEX idx_intelligence_priority_rank ON public.intelligence_priorities(priority_rank);

ALTER TABLE public.intelligence_priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own priorities" ON public.intelligence_priorities FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role full access" ON public.intelligence_priorities FOR ALL USING (true) WITH CHECK (true);

-- 5. PROGRESS TRACKING CADENCE
CREATE TABLE IF NOT EXISTS public.progress_cadence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Cadence configuration
    frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    next_check_in_date TIMESTAMPTZ,
    
    -- Tracking markers
    confidence_markers JSONB DEFAULT '[]'::jsonb,
    friction_markers JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    status TEXT DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_check_in_at TIMESTAMPTZ,
    
    CONSTRAINT unique_cadence_per_profile UNIQUE (business_profile_id)
);

CREATE INDEX idx_progress_cadence_profile ON public.progress_cadence(business_profile_id);

ALTER TABLE public.progress_cadence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own cadence" ON public.progress_cadence FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role full access" ON public.progress_cadence FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.strategy_profiles IS 'Strategic calibration data - raw inputs + AI-generated drafts';
COMMENT ON TABLE public.calibration_sessions IS 'Calibration session audit trail';
COMMENT ON TABLE public.working_schedules IS '15-week schedule scaffold created post-calibration';
COMMENT ON TABLE public.intelligence_priorities IS 'Signal priority hierarchy per business';
COMMENT ON TABLE public.progress_cadence IS 'Weekly/monthly progress tracking configuration';
