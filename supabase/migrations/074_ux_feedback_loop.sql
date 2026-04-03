-- 074_ux_feedback_loop.sql
-- Structured UX feedback and usability checkpoint storage.

CREATE TABLE IF NOT EXISTS public.ux_feedback_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    route TEXT,
    feedback_type TEXT NOT NULL,
    rating INTEGER,
    sentiment TEXT,
    message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ux_feedback_events_user ON public.ux_feedback_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ux_feedback_events_route ON public.ux_feedback_events(route, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ux_feedback_events_type ON public.ux_feedback_events(feedback_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.usability_test_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_key TEXT NOT NULL,
    checkpoint_key TEXT NOT NULL,
    target_metric TEXT NOT NULL,
    baseline_value NUMERIC,
    target_value NUMERIC,
    current_value NUMERIC,
    status TEXT NOT NULL DEFAULT 'planned',
    notes TEXT,
    owner_user_id UUID,
    due_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (milestone_key, checkpoint_key)
);

CREATE INDEX IF NOT EXISTS idx_usability_checkpoints_status ON public.usability_test_checkpoints(status, due_at);
CREATE INDEX IF NOT EXISTS idx_usability_checkpoints_milestone ON public.usability_test_checkpoints(milestone_key, updated_at DESC);

-- RLS baseline
ALTER TABLE public.ux_feedback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usability_test_checkpoints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'ux_feedback_events' AND policyname = 'service_manage_ux_feedback_events'
    ) THEN
        CREATE POLICY service_manage_ux_feedback_events ON public.ux_feedback_events
            FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'usability_test_checkpoints' AND policyname = 'service_manage_usability_test_checkpoints'
    ) THEN
        CREATE POLICY service_manage_usability_test_checkpoints ON public.usability_test_checkpoints
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
