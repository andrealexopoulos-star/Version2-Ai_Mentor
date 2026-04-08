-- Operation OMEGA Wave 1 — Signal enrichment columns (additive)
-- All columns NULLable so existing rows are unaffected.
-- Safe to apply to production: zero risk to current queries.

ALTER TABLE public.watchtower_insights
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS urgency_tier TEXT,
  ADD COLUMN IF NOT EXISTS next_best_action TEXT,
  ADD COLUMN IF NOT EXISTS signal_group_id UUID,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_model TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watchtower_insights_urgency_tier_check'
  ) THEN
    ALTER TABLE public.watchtower_insights
      ADD CONSTRAINT watchtower_insights_urgency_tier_check
      CHECK (urgency_tier IS NULL OR urgency_tier IN (
        'CRITICAL_IMMEDIATE',
        'CRITICAL_WEEK',
        'ELEVATED_MONITOR',
        'STABLE_WATCH'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_watchtower_insights_signal_group
  ON public.watchtower_insights (signal_group_id)
  WHERE signal_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_watchtower_insights_unenriched
  ON public.watchtower_insights (created_at)
  WHERE explanation IS NULL;
