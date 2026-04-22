-- =============================================================================
-- Migration 122: signal_snoozes + signal_feedback
--
-- Sprint B #17 (2026-04-22) — feedback taxonomy on top of observation_events.
-- Complements migration 116 (dismissals) and the Sprint B #15 priority scorer.
--
-- Problem: The Advisor only offers "dismiss" as feedback today — a single
-- binary. Users need gradations:
--   - "Remind me later" (snooze) — suppress until a specific time
--   - "Not relevant"            — signal is real but doesn't apply to me
--   - "Already done"            — signal is real and I've handled it
--   - "Incorrect"               — the signal itself is wrong (training signal)
--   - "Need more info"          — can't act without additional context
--
-- These feed the priority scorer (backend/services/priority_scorer.py): snoozed
-- events are hidden until snoozed_until, "not_relevant" / "already_done" events
-- are down-weighted on re-emission, "incorrect" flags raise a quality-review
-- signal for the content team.
--
-- Design: two small tables mirroring the observation_event_dismissals pattern
--   - signal_snoozes:  one row per (user, event) with snoozed_until timestamp
--   - signal_feedback: append-only; supports multiple feedback entries per event
-- =============================================================================

-- ── signal_snoozes ──────────────────────────────────────────────────────────
-- Single row per (user, event). Second snooze extends the current one.
CREATE TABLE IF NOT EXISTS public.signal_snoozes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.observation_events(id) ON DELETE CASCADE,
  snoozed_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_surface TEXT,  -- e.g. 'advisor', 'alerts', 'market'
  CONSTRAINT signal_snoozes_unique UNIQUE (user_id, event_id),
  CONSTRAINT signal_snoozes_future_only CHECK (snoozed_until > created_at)
);

-- (user_id, snoozed_until) covers "events snoozed for user X that aren't yet
-- expired" — the read-path filter is `snoozed_until > now()` but we cannot
-- use that in the index predicate (Postgres requires IMMUTABLE functions in
-- index predicates and now() is STABLE). A plain composite index is enough:
-- the planner range-scans snoozed_until efficiently.
CREATE INDEX IF NOT EXISTS idx_signal_snoozes_user_active
  ON public.signal_snoozes (user_id, snoozed_until);

CREATE INDEX IF NOT EXISTS idx_signal_snoozes_event
  ON public.signal_snoozes (event_id);

ALTER TABLE public.signal_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on signal_snoozes"
  ON public.signal_snoozes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own signal_snoozes"
  ON public.signal_snoozes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signal_snoozes"
  ON public.signal_snoozes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signal_snoozes"
  ON public.signal_snoozes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own signal_snoozes"
  ON public.signal_snoozes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── signal_feedback ─────────────────────────────────────────────────────────
-- Append-only. Users can leave multiple pieces of feedback on the same event
-- across time ("not_relevant" then later "incorrect" as they learn more).
--
-- feedback_key is constrained to a closed enum so the priority scorer + QA
-- pipeline have deterministic buckets.
CREATE TABLE IF NOT EXISTS public.signal_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.observation_events(id) ON DELETE CASCADE,
  feedback_key TEXT NOT NULL,
  note TEXT,
  source_surface TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signal_feedback_key_allowed CHECK (
    feedback_key IN (
      'not_relevant',
      'already_done',
      'incorrect',
      'need_more_info'
    )
  ),
  CONSTRAINT signal_feedback_note_length CHECK (
    note IS NULL OR char_length(note) <= 1000
  )
);

CREATE INDEX IF NOT EXISTS idx_signal_feedback_user_event
  ON public.signal_feedback (user_id, event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_feedback_key_time
  ON public.signal_feedback (feedback_key, created_at DESC);

ALTER TABLE public.signal_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on signal_feedback"
  ON public.signal_feedback FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own signal_feedback"
  ON public.signal_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signal_feedback"
  ON public.signal_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── Trigger: keep signal_snoozes.updated_at fresh ───────────────────────────
CREATE OR REPLACE FUNCTION public.tg_signal_snoozes_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_signal_snoozes_touch ON public.signal_snoozes;
CREATE TRIGGER trg_signal_snoozes_touch
  BEFORE UPDATE ON public.signal_snoozes
  FOR EACH ROW EXECUTE FUNCTION public.tg_signal_snoozes_touch();

-- =============================================================================
-- POST-DEPLOY VERIFICATION (run via MCP execute_sql after applying):
--
--   -- 1) Tables exist with expected columns
--   SELECT table_name, column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name IN ('signal_snoozes', 'signal_feedback')
--   ORDER BY table_name, ordinal_position;
--
--   -- 2) RLS enabled
--   SELECT c.relname, c.relrowsecurity
--   FROM pg_class c
--   WHERE c.relname IN ('signal_snoozes', 'signal_feedback');
--
--   -- 3) Constraints catch bad data
--   INSERT INTO public.signal_feedback (user_id, event_id, feedback_key)
--   VALUES (gen_random_uuid(), gen_random_uuid(), 'made_up_bucket');
--   -- EXPECT: ERROR (check constraint signal_feedback_key_allowed)
-- =============================================================================
