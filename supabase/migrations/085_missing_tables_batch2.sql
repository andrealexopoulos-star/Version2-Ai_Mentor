-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 085: Create 8 Missing Tables (Batch 2)
--
-- These tables are actively referenced in the BIQc codebase but had no
-- CREATE TABLE in the numbered migration series.  Batch 1 (migration 083)
-- already covered 14 tables; this batch covers the remaining 8.
--
-- Generated from forensic code analysis of:
--   backend/boardroom_conversations.py, backend/routes/boardroom.py,
--   backend/intelligence_baseline.py, backend/supabase_intelligence_helpers.py,
--   backend/supabase_remaining_helpers.py, backend/workspace_helpers.py,
--   backend/routes/profile.py, backend/routes/integrations.py,
--   supabase/functions/email_priority/index.ts,
--   supabase_migrations/20260408_boardroom_conversations.sql,
--   supabase_migrations/20260408_email_intelligence_ai_columns.sql,
--   _backups/docs_purge_Feb2026/supabase_support_tables_schema.sql,
--   _backups/docs_purge_Feb2026/supabase_remaining_tables.sql,
--   backend/migrations/001_watchtower_events.sql (account_id FK reference),
--   backend/migrations/008_calibration_schedules.sql (account_id FK reference)
--
-- Every table uses CREATE TABLE IF NOT EXISTS for idempotency.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. accounts
-- Purpose: Organisation/workspace-level business account (NOT auth.users).
--          Acts as the multi-tenant parent for integrations, watchtower, etc.
-- Referenced by: workspace_helpers.py (select *, insert {name}),
--   supabase_remaining_helpers.py (select *, insert account_data),
--   backend/migrations/001_watchtower_events.sql (FK account_id),
--   backend/migrations/008_calibration_schedules.sql (FK account_id),
--   backend/migrations/009_calibration_system.sql (FK account_id),
--   performance_indexes.sql (idx on business_profiles.account_id,
--     strategy_profiles.account_id, integration_accounts.account_id)
-- Columns from code: id, name, owner_id, created_at
-- Note: Must be created FIRST because other tables reference it via FK.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    owner_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_owner_id
    ON public.accounts(owner_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Users can view accounts they own
CREATE POLICY "accounts_select_own"
    ON public.accounts FOR SELECT TO authenticated
    USING (owner_id = auth.uid());

-- Users can create accounts (owner_id set to self)
CREATE POLICY "accounts_insert_own"
    ON public.accounts FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Users can update accounts they own
CREATE POLICY "accounts_update_own"
    ON public.accounts FOR UPDATE TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Users can delete accounts they own
CREATE POLICY "accounts_delete_own"
    ON public.accounts FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- Service role bypass (backend operations)
CREATE POLICY "accounts_service_role"
    ON public.accounts FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. boardroom_conversations
-- Purpose: Persists BoardRoom / WarRoom chat sessions.
-- Referenced by: backend/boardroom_conversations.py (insert, select, update),
--   backend/routes/boardroom.py (full CRUD via DAL),
--   backend/tests/test_boardroom_conversations.py,
--   supabase_migrations/20260408_boardroom_conversations.sql (reference schema)
-- Columns from code: id, user_id, mode ('boardroom'|'war_room'),
--   title, focus_area, status ('active'|'archived'), message_count,
--   last_message_at, metadata (jsonb), created_at, updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.boardroom_conversations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode            text NOT NULL CHECK (mode IN ('boardroom', 'war_room')),
    title           text,
    focus_area      text,
    status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    message_count   integer NOT NULL DEFAULT 0,
    last_message_at timestamptz,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boardroom_conversations_user_updated
    ON public.boardroom_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_boardroom_conversations_user_mode_status
    ON public.boardroom_conversations(user_id, mode, status);

ALTER TABLE public.boardroom_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "br_conv_select_own"
    ON public.boardroom_conversations FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "br_conv_insert_own"
    ON public.boardroom_conversations FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "br_conv_update_own"
    ON public.boardroom_conversations FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "br_conv_delete_own"
    ON public.boardroom_conversations FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "br_conv_service_role"
    ON public.boardroom_conversations FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. boardroom_messages
-- Purpose: Individual messages within a boardroom/war_room conversation.
-- Referenced by: backend/boardroom_conversations.py (insert, select),
--   supabase_migrations/20260408_boardroom_conversations.sql (reference schema)
-- Columns from code: id, conversation_id (FK), user_id, role ('user'|'advisor'|'system'),
--   content, focus_area, explainability (jsonb), evidence_chain (jsonb),
--   priority_compression (jsonb), lineage (jsonb), confidence_score (numeric),
--   degraded (bool), source_response (jsonb), created_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.boardroom_messages (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id       uuid NOT NULL REFERENCES public.boardroom_conversations(id) ON DELETE CASCADE,
    user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role                  text NOT NULL CHECK (role IN ('user', 'advisor', 'system')),
    content               text NOT NULL,
    focus_area            text,
    explainability        jsonb DEFAULT '{}'::jsonb,
    evidence_chain        jsonb DEFAULT '[]'::jsonb,
    priority_compression  jsonb DEFAULT '{}'::jsonb,
    lineage               jsonb DEFAULT '{}'::jsonb,
    confidence_score      numeric(4,3),
    degraded              boolean DEFAULT false,
    source_response       jsonb DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boardroom_messages_conv_created
    ON public.boardroom_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_user_created
    ON public.boardroom_messages(user_id, created_at DESC);

ALTER TABLE public.boardroom_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "br_msg_select_own"
    ON public.boardroom_messages FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "br_msg_insert_own"
    ON public.boardroom_messages FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "br_msg_service_role"
    ON public.boardroom_messages FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Auto-update conversation counters on new message
CREATE OR REPLACE FUNCTION public.trg_boardroom_message_upsert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.boardroom_conversations
    SET message_count   = message_count + 1,
        last_message_at = NEW.created_at,
        updated_at      = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_boardroom_messages_after_insert ON public.boardroom_messages;
CREATE TRIGGER trg_boardroom_messages_after_insert
    AFTER INSERT ON public.boardroom_messages
    FOR EACH ROW EXECUTE FUNCTION public.trg_boardroom_message_upsert();


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. sops
-- Purpose: Standard Operating Procedure document storage.
-- Referenced by: backend/supabase_remaining_helpers.py
--   (insert sop_data, select * eq user_id, select id count=exact),
--   backend/routes/profile.py (via import),
--   performance_indexes.sql (idx_sops_user_id)
-- Columns from code: id, user_id, title, content, category, created_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sops (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           text NOT NULL,
    content         text NOT NULL,
    category        text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sops_user_id
    ON public.sops(user_id);
CREATE INDEX IF NOT EXISTS idx_sops_user_category
    ON public.sops(user_id, category);

ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sops_select_own"
    ON public.sops FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "sops_insert_own"
    ON public.sops FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sops_update_own"
    ON public.sops FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sops_delete_own"
    ON public.sops FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "sops_service_role"
    ON public.sops FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. intelligence_baseline
-- Purpose: User-explicit intelligence configuration — monitored domains,
--          alert tolerance, escalation thresholds, briefing preferences.
-- Referenced by: backend/intelligence_baseline.py
--   (select * eq user_id, insert {id, user_id, baseline, created_at, updated_at},
--    update {baseline, updated_at} eq id),
--   backend/routes/intelligence.py, backend/routes/onboarding.py,
--   backend/fact_resolution.py,
--   backend/core/config.py,
--   performance_indexes.sql (idx + GIN on baseline jsonb)
-- Columns from code: id, user_id, baseline (jsonb), created_at, updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.intelligence_baseline (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    baseline        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_baseline_user_id
    ON public.intelligence_baseline(user_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_baseline_user_updated
    ON public.intelligence_baseline(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_baseline_baseline_gin
    ON public.intelligence_baseline USING GIN (baseline);

ALTER TABLE public.intelligence_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intel_baseline_select_own"
    ON public.intelligence_baseline FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "intel_baseline_insert_own"
    ON public.intelligence_baseline FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "intel_baseline_update_own"
    ON public.intelligence_baseline FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "intel_baseline_delete_own"
    ON public.intelligence_baseline FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "intel_baseline_service_role"
    ON public.intelligence_baseline FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. email_intelligence
-- Purpose: Business intelligence extracted from emails — per-email AI
--          classification and aggregate user-level intelligence.
-- Referenced by: supabase/functions/email_priority/index.ts
--   (upsert {user_id, provider, email_id, urgency, category,
--    business_impact_score, ai_summary, action_required, analyzed_at}
--    on_conflict: user_id,provider,email_id),
--   backend/supabase_intelligence_helpers.py
--   (select * eq user_id single, upsert on_conflict: user_id),
--   supabase_migrations/20260408_email_intelligence_ai_columns.sql
--   (ALTER ADD urgency, category, business_impact_score, ai_summary,
--    action_required),
--   _backups/supabase_support_tables_schema.sql (top_clients,
--    communication_patterns, client_insights, total_emails_analyzed,
--    last_analysis_at),
--   performance_indexes.sql (idx_email_intelligence_user_id)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_intelligence (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider                text,                                -- 'gmail', 'outlook', etc.
    email_id                text,                                -- provider-native message ID
    -- Aggregate intelligence fields (user-level)
    top_clients             jsonb DEFAULT '[]'::jsonb,
    communication_patterns  jsonb DEFAULT '{}'::jsonb,
    client_insights         jsonb DEFAULT '[]'::jsonb,
    total_emails_analyzed   integer DEFAULT 0,
    last_analysis_at        timestamptz DEFAULT now(),
    -- Per-email AI classification fields (added by 20260408 migration)
    urgency                 text,                                -- 'urgent', 'high', 'medium', 'low'
    category                text,                                -- 'sales', 'finance', 'operations', etc.
    business_impact_score   integer,                             -- 0-100
    ai_summary              text,
    action_required         boolean DEFAULT false,
    analyzed_at             timestamptz DEFAULT now(),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    -- Supports both user-level upsert and per-email upsert
    UNIQUE (user_id, provider, email_id)
);

CREATE INDEX IF NOT EXISTS idx_email_intelligence_user_id
    ON public.email_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_email_intelligence_user_email
    ON public.email_intelligence(user_id, email_id);
CREATE INDEX IF NOT EXISTS idx_email_intelligence_user_created
    ON public.email_intelligence(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_intelligence_user_provider
    ON public.email_intelligence(user_id, provider);

ALTER TABLE public.email_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_intel_select_own"
    ON public.email_intelligence FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "email_intel_insert_own"
    ON public.email_intelligence FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "email_intel_update_own"
    ON public.email_intelligence FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "email_intel_delete_own"
    ON public.email_intelligence FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "email_intel_service_role"
    ON public.email_intelligence FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. calendar_intelligence
-- Purpose: Calendar insights — meeting patterns, collaborators, load analysis.
-- Referenced by: backend/supabase_intelligence_helpers.py
--   (select * eq user_id single, upsert on_conflict: user_id),
--   backend/routes/integrations.py
--   (select top_collaborators eq user_id order synced_at desc limit 1),
--   backend/routes/profile.py (via import of get_calendar_intelligence_supabase),
--   _backups/supabase_support_tables_schema.sql (total_events,
--    upcoming_meetings, meeting_load, top_collaborators, synced_at),
--   performance_indexes.sql (idx_calendar_intelligence_user_id)
-- Columns from code: id, user_id, total_events, upcoming_meetings,
--   meeting_load, top_collaborators (jsonb), synced_at, created_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_intelligence (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_events        integer DEFAULT 0,
    upcoming_meetings   integer DEFAULT 0,
    meeting_load        text,                    -- e.g. 'heavy', 'moderate', 'light'
    top_collaborators   jsonb DEFAULT '[]'::jsonb,
    synced_at           timestamptz DEFAULT now(),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_intelligence_user_id
    ON public.calendar_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_intelligence_synced
    ON public.calendar_intelligence(user_id, synced_at DESC);

ALTER TABLE public.calendar_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cal_intel_select_own"
    ON public.calendar_intelligence FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "cal_intel_insert_own"
    ON public.calendar_intelligence FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cal_intel_update_own"
    ON public.calendar_intelligence FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cal_intel_delete_own"
    ON public.calendar_intelligence FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "cal_intel_service_role"
    ON public.calendar_intelligence FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. web_sources
-- Purpose: Web source tracking for business profile building — stores
--          SERP results and scraped page content for citation/audit trail.
-- Referenced by: backend/supabase_remaining_helpers.py
--   (select * eq user_id, update data eq url),
--   backend/routes/profile.py (upsert_web_sources — inserts {id, user_id,
--     source_type, title, url, snippet, created_at, updated_at}),
--   _backups/supabase_remaining_tables.sql (id, user_id, url, title,
--     content, scraped_at, created_at),
--   performance_indexes.sql (idx_web_sources_user_id)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.web_sources (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type     text DEFAULT 'web',          -- 'web', 'serp', etc.
    url             text NOT NULL,
    title           text,
    snippet         text,                        -- SERP snippet / short extract
    content         text,                        -- full scraped page text
    scraped_at      timestamptz DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_sources_user_id
    ON public.web_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_web_sources_user_url
    ON public.web_sources(user_id, url);

ALTER TABLE public.web_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "web_sources_select_own"
    ON public.web_sources FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "web_sources_insert_own"
    ON public.web_sources FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "web_sources_update_own"
    ON public.web_sources FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "web_sources_delete_own"
    ON public.web_sources FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "web_sources_service_role"
    ON public.web_sources FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════════
-- updated_at auto-touch triggers for tables that have updated_at
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;

-- accounts
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- boardroom_conversations (already handled by message trigger, but cover direct updates)
DROP TRIGGER IF EXISTS trg_boardroom_conversations_updated_at ON public.boardroom_conversations;
CREATE TRIGGER trg_boardroom_conversations_updated_at
    BEFORE UPDATE ON public.boardroom_conversations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- sops
DROP TRIGGER IF EXISTS trg_sops_updated_at ON public.sops;
CREATE TRIGGER trg_sops_updated_at
    BEFORE UPDATE ON public.sops
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- intelligence_baseline
DROP TRIGGER IF EXISTS trg_intelligence_baseline_updated_at ON public.intelligence_baseline;
CREATE TRIGGER trg_intelligence_baseline_updated_at
    BEFORE UPDATE ON public.intelligence_baseline
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- email_intelligence
DROP TRIGGER IF EXISTS trg_email_intelligence_updated_at ON public.email_intelligence;
CREATE TRIGGER trg_email_intelligence_updated_at
    BEFORE UPDATE ON public.email_intelligence
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- calendar_intelligence
DROP TRIGGER IF EXISTS trg_calendar_intelligence_updated_at ON public.calendar_intelligence;
CREATE TRIGGER trg_calendar_intelligence_updated_at
    BEFORE UPDATE ON public.calendar_intelligence
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- web_sources
DROP TRIGGER IF EXISTS trg_web_sources_updated_at ON public.web_sources;
CREATE TRIGGER trg_web_sources_updated_at
    BEFORE UPDATE ON public.web_sources
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
