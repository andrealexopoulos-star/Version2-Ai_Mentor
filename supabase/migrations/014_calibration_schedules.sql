-- Calibration Schedules — Recalibration + Video Check-In tracking
CREATE TABLE IF NOT EXISTS calibration_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    type TEXT NOT NULL, -- recalibration | video_checkin | recalibration_dismissed
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending', -- pending | completed | dismissed | cancelled
    notes TEXT,
    completed_at TIMESTAMPTZ,
    postponed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cal_sched_user ON calibration_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_cal_sched_status ON calibration_schedules(user_id, status);
