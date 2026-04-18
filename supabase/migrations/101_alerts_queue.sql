-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 101: alerts_queue — Phase 6.5 alert flow system
-- ═══════════════════════════════════════════════════════════════════
-- Per Andreas direction: emit alerts when business data changes or market
-- insights update. Clear alerts when user visits the target page. Every
-- lifecycle timestamp becomes training signal for the cognitive learner
-- (Phase 6.14 — personalized alert routing per user).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.alerts_queue (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Alert metadata
    type              text NOT NULL,          -- 'market_change' | 'data_change' | 'churn_risk' | 'revenue_risk' | 'compliance_gap' | 'onboarding' | 'system'
    source            text NOT NULL,          -- 'market_scanner' | 'hubspot' | 'xero' | 'outlook' | 'email_signal' | 'cognitive_core' | ...
    target_page       text,                   -- page path that auto-clears this alert when visited (e.g. '/market', '/advisor')

    -- Content — rendered by AlertBanner component
    payload           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { title, body, cta_label, cta_href, icon, severity }

    -- Importance (set by AI when emitting; users' feedback trains the weight over time — 6.14)
    priority          integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),  -- 1 = urgent, 5 = info
    weight            real NOT NULL DEFAULT 0.5,                                     -- 0.0-1.0 importance weight

    -- Lifecycle timestamps — ALL of these are learning signals for the cognitive layer
    created_at        timestamptz NOT NULL DEFAULT now(),
    delivered_at      timestamptz,    -- first time the alert was pulled by the frontend
    viewed_at         timestamptz,    -- user visited target_page OR explicitly acknowledged
    dismissed_at      timestamptz,    -- user explicitly dismissed (X button)
    actioned_at       timestamptz,    -- user clicked the CTA and took the suggested action
    action_taken      text,           -- free-form description of what the user did

    -- Feedback signal (Phase 6.14) — user can thumbs-up / thumbs-down an alert
    feedback          integer CHECK (feedback IS NULL OR feedback IN (-1, 0, 1)),

    -- Indexing
    CONSTRAINT alerts_queue_lifecycle_coherent CHECK (
        -- If viewed/dismissed/actioned, must have been delivered first
        (viewed_at IS NULL OR delivered_at IS NOT NULL)
        AND (dismissed_at IS NULL OR delivered_at IS NOT NULL)
        AND (actioned_at IS NULL OR delivered_at IS NOT NULL)
    )
);

-- Fast "active alerts for user" query — used every page load by useAlerts hook
CREATE INDEX IF NOT EXISTS idx_alerts_queue_active
    ON public.alerts_queue (user_id, priority, created_at DESC)
    WHERE viewed_at IS NULL AND dismissed_at IS NULL;

-- Fast "alerts targeting this page" — used by visit-page clearer
CREATE INDEX IF NOT EXISTS idx_alerts_queue_target_page
    ON public.alerts_queue (user_id, target_page, viewed_at)
    WHERE viewed_at IS NULL AND target_page IS NOT NULL;

-- Learning-signal index (6.14 — nightly learner scans these)
CREATE INDEX IF NOT EXISTS idx_alerts_queue_feedback
    ON public.alerts_queue (user_id, type, created_at DESC)
    WHERE feedback IS NOT NULL OR actioned_at IS NOT NULL;

-- Type + source index for segmented analytics
CREATE INDEX IF NOT EXISTS idx_alerts_queue_type_source
    ON public.alerts_queue (user_id, type, source);

-- Row-level security
ALTER TABLE public.alerts_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alerts_queue_owner_select ON public.alerts_queue;
CREATE POLICY alerts_queue_owner_select ON public.alerts_queue
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS alerts_queue_owner_update ON public.alerts_queue;
CREATE POLICY alerts_queue_owner_update ON public.alerts_queue
    FOR UPDATE USING (user_id = auth.uid());

-- Service role bypasses RLS for emit (backend workers inserting alerts for users)
DROP POLICY IF EXISTS alerts_queue_service_role ON public.alerts_queue;
CREATE POLICY alerts_queue_service_role ON public.alerts_queue
    FOR ALL
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role')
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

GRANT SELECT, UPDATE ON public.alerts_queue TO authenticated;
GRANT ALL ON public.alerts_queue TO service_role;

COMMENT ON TABLE public.alerts_queue IS
    'Phase 6.5 — user-facing alerts. Backend workers emit via /api/alerts/emit. Frontend useAlerts hook polls /api/alerts/active. Lifecycle timestamps feed Phase 6.14 cognitive learner for personalized routing.';
COMMENT ON COLUMN public.alerts_queue.target_page IS
    'If set, visiting this page path auto-marks the alert as viewed. Used for "alert appears on Market data change, disappears when user visits /market" pattern.';
COMMENT ON COLUMN public.alerts_queue.priority IS
    'Rendering priority. 1=urgent (red banner), 2=high (orange), 3=medium (default), 4=low (info), 5=ambient (toast).';
COMMENT ON COLUMN public.alerts_queue.weight IS
    'AI-computed importance 0.0-1.0 at emit time. Phase 6.14 learner adjusts via feedback/actioned outcomes.';
COMMENT ON COLUMN public.alerts_queue.feedback IS
    '-1 = not useful, 0 = neutral, 1 = useful. Trained alert routing: repeated -1 on type X from source Y demotes that combination for this user.';
