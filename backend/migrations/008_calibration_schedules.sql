-- CALIBRATION SCHEDULE TABLE
-- Post-induction monitoring schedule (structure only, no execution logic)

CREATE TABLE IF NOT EXISTS public.calibration_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to business profile
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    
    -- Schedule status
    schedule_status TEXT NOT NULL DEFAULT 'active' CHECK (schedule_status IN ('active', 'paused', 'cancelled')),
    
    -- Feature flags
    weekly_pulse_enabled BOOLEAN NOT NULL DEFAULT true,
    quarterly_calibration_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_weekly_due_at TIMESTAMPTZ NOT NULL,
    next_quarterly_due_at TIMESTAMPTZ NOT NULL,
    
    -- Execution tracking (for future use)
    last_weekly_completed_at TIMESTAMPTZ,
    last_quarterly_completed_at TIMESTAMPTZ,
    weekly_completion_count INT DEFAULT 0,
    quarterly_completion_count INT DEFAULT 0,
    
    -- Deduplication
    CONSTRAINT unique_schedule_per_profile UNIQUE (business_profile_id)
);

-- Indexes
CREATE INDEX idx_calibration_user ON public.calibration_schedules(user_id);
CREATE INDEX idx_calibration_account ON public.calibration_schedules(account_id);
CREATE INDEX idx_calibration_status ON public.calibration_schedules(schedule_status);
CREATE INDEX idx_calibration_weekly_due ON public.calibration_schedules(next_weekly_due_at) WHERE schedule_status = 'active';
CREATE INDEX idx_calibration_quarterly_due ON public.calibration_schedules(next_quarterly_due_at) WHERE schedule_status = 'active';

-- RLS
ALTER TABLE public.calibration_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own schedules"
    ON public.calibration_schedules FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
    ON public.calibration_schedules FOR ALL
    USING (true) WITH CHECK (true);

COMMENT ON TABLE public.calibration_schedules IS 'Post-induction monitoring schedule - structure only, execution logic separate';
