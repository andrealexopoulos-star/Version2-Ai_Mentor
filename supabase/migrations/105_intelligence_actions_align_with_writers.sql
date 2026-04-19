-- 105_intelligence_actions_align_with_writers.sql
-- P0-c fix (2026-04-19): intelligence_actions schema drifted from every
-- writer. All 5 edge functions (rapid-task, deep-web-recon,
-- intelligence-bridge, competitor-monitor, cfo-cash-analysis) AND two
-- backend modules (proactive_intelligence.py, intelligence_bridge.py)
-- pass {source, title, description}. Schema had {signal_source,
-- content_summary} and was missing `title`. Every insert was 400.
--
-- Verified NO readers of signal_source / content_summary anywhere in
-- the codebase. Verified NO views / policies / indexes depend on either
-- column name. Rename is safe.
--
-- Applied to prod via Supabase MCP on 2026-04-19 (ledger version
-- 20260419065428, name `080_intelligence_actions_align_with_writers`).
-- This file documents the change for repo/infra parity. Wrapped in
-- DO-blocks so it is idempotent — safe to re-run after the MCP apply.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='intelligence_actions'
      AND column_name='signal_source'
  ) THEN
    ALTER TABLE public.intelligence_actions
      RENAME COLUMN signal_source TO source;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='intelligence_actions'
      AND column_name='content_summary'
  ) THEN
    ALTER TABLE public.intelligence_actions
      RENAME COLUMN content_summary TO description;
  END IF;
END $$;

ALTER TABLE public.intelligence_actions
  ADD COLUMN IF NOT EXISTS title TEXT;

COMMENT ON COLUMN public.intelligence_actions.source IS
  'Origin of the signal (e.g. "watchtower", "cfo_agent", "deep-web-recon", "proactive_engine"). Renamed from signal_source 2026-04-19.';
COMMENT ON COLUMN public.intelligence_actions.description IS
  'Narrative body of the action. Renamed from content_summary 2026-04-19.';
COMMENT ON COLUMN public.intelligence_actions.title IS
  'Short action headline. Added 2026-04-19 to match writer expectations across edge functions + backend.';
