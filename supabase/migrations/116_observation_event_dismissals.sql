-- =============================================================================
-- Migration 116: observation_event_dismissals
--
-- Cross-surface dismissal consistency for the Live Signal Feed.
--
-- Problem: observation_events has no handled_at / dismissed_at column. Alerts
-- dismissal (POST /alerts/{id}/dismiss in backend/routes/alerts.py:167-177)
-- writes to alerts_queue.dismissed_at, which the feed does not read. As a
-- result a signal the user dismissed in Alerts keeps showing in the Live
-- Signal Feed rendered from observation_events.
--
-- Solution: a per-user, per-event dismissals table. Dismiss handlers write
-- here; get_recent_observation_events LEFT JOINs and filters.
--
-- This migration is additive. observation_events is not touched.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.observation_event_dismissals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.observation_events(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_surface TEXT,  -- e.g. 'alerts', 'advisor', 'live_feed' - for analytics
  CONSTRAINT observation_event_dismissals_unique UNIQUE (user_id, event_id)
);

-- Primary query pattern: "is this (user_id, event_id) dismissed?"
CREATE INDEX IF NOT EXISTS idx_obs_event_dismissals_user_event
  ON public.observation_event_dismissals (user_id, event_id);

-- Secondary: "all events dismissed by user X since T"
CREATE INDEX IF NOT EXISTS idx_obs_event_dismissals_user_time
  ON public.observation_event_dismissals (user_id, dismissed_at DESC);

-- RLS
ALTER TABLE public.observation_event_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on observation_event_dismissals"
  ON public.observation_event_dismissals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own observation_event_dismissals"
  ON public.observation_event_dismissals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own observation_event_dismissals"
  ON public.observation_event_dismissals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
