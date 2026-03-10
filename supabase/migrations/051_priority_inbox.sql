-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 051: Priority Inbox + iCloud/IMAP + Tasks
-- Scope: New tables for email_priority system
-- ═══════════════════════════════════════════════════════════════

-- ── iCloud connections (App-Specific Password + IMAP) ──────────
CREATE TABLE IF NOT EXISTS public.icloud_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  apple_id_email  text NOT NULL,
  app_password    text NOT NULL,           -- encrypted Apple app-specific password
  display_name    text,
  connected       boolean DEFAULT true,
  connected_at    timestamptz DEFAULT now(),
  last_sync_at    timestamptz,
  sync_status     text DEFAULT 'idle',
  CONSTRAINT icloud_connections_user_id_key UNIQUE (user_id)
);
ALTER TABLE public.icloud_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own icloud_connections" ON public.icloud_connections
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_icloud_connections_user ON public.icloud_connections(user_id);

-- ── Generic IMAP connections ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.imap_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  imap_host       text NOT NULL,
  imap_port       integer NOT NULL DEFAULT 993,
  username        text NOT NULL,
  password        text NOT NULL,           -- encrypted
  use_ssl         boolean DEFAULT true,
  display_name    text,
  connected       boolean DEFAULT true,
  connected_at    timestamptz DEFAULT now(),
  last_sync_at    timestamptz,
  sync_status     text DEFAULT 'idle',
  CONSTRAINT imap_connections_user_id_host UNIQUE (user_id, imap_host)
);
ALTER TABLE public.imap_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own imap_connections" ON public.imap_connections
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_imap_connections_user ON public.imap_connections(user_id);

-- ── Priority inbox results cache ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.priority_inbox (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         text NOT NULL,           -- gmail | outlook | icloud | imap
  email_id         text NOT NULL,           -- provider-native message ID
  thread_id        text,
  from_address     text,
  subject          text,
  snippet          text,
  received_date    timestamptz,
  priority_level   text NOT NULL CHECK (priority_level IN ('high','medium','low')),
  reason           text,
  suggested_action text,
  user_override    text,                    -- user reclassification (high|medium|low|null)
  ai_model         text DEFAULT 'gpt-4o-mini',
  analyzed_at      timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now(),
  CONSTRAINT priority_inbox_user_email UNIQUE (user_id, provider, email_id)
);
ALTER TABLE public.priority_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own priority_inbox" ON public.priority_inbox
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_priority_inbox_user_provider ON public.priority_inbox(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_priority_inbox_priority ON public.priority_inbox(user_id, priority_level, analyzed_at DESC);

-- ── Action items extracted from emails ─────────────────────────
CREATE TABLE IF NOT EXISTS public.email_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inbox_id        uuid REFERENCES public.priority_inbox(id) ON DELETE SET NULL,
  provider        text,
  email_id        text,
  task_text       text NOT NULL,
  due_date        date,
  status          text DEFAULT 'pending' CHECK (status IN ('pending','done','dismissed')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.email_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own email_tasks" ON public.email_tasks
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_email_tasks_user ON public.email_tasks(user_id, status);

-- ── strategic_insights cache (per-run summaries) ───────────────
CREATE TABLE IF NOT EXISTS public.email_intelligence_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider            text NOT NULL,
  total_analyzed      integer DEFAULT 0,
  high_count          integer DEFAULT 0,
  medium_count        integer DEFAULT 0,
  low_count           integer DEFAULT 0,
  strategic_insights  text,
  ran_at              timestamptz DEFAULT now()
);
ALTER TABLE public.email_intelligence_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own email_intelligence_runs" ON public.email_intelligence_runs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_email_intel_runs_user ON public.email_intelligence_runs(user_id, ran_at DESC);

-- ── Grant service role access (for edge functions) ─────────────
GRANT ALL ON public.priority_inbox TO service_role;
GRANT ALL ON public.email_tasks TO service_role;
GRANT ALL ON public.email_intelligence_runs TO service_role;
GRANT ALL ON public.icloud_connections TO service_role;
GRANT ALL ON public.imap_connections TO service_role;
