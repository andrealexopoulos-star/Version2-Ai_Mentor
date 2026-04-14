-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 083: Create 14 Missing Tables
-- These tables are actively referenced in the BIQc codebase but had no CREATE TABLE.
-- Generated from forensic code analysis of all .from() / .table() / .select() /
-- .insert() / .upsert() / .update() calls across frontend, backend, and edge functions.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. integration_accounts
-- Purpose: Stores Merge.dev integration connections (CRM, accounting, HRIS, marketing).
-- Referenced by: 13+ edge functions, AdminDashboard, Advisor, integrations.py
-- Columns from code: id, user_id, provider, category, account_token,
--   merge_account_id, status, connected_at, created_at, updated_at
-- Upsert on_conflict: user_id,category  (also account_id,category as fallback)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.integration_accounts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider        text NOT NULL,              -- e.g. 'hubspot', 'xero', 'quickbooks', 'myob'
    category        text NOT NULL,              -- e.g. 'crm', 'accounting', 'hris', 'marketing'
    account_token   text,                       -- Merge.dev account_token
    merge_account_id text,                      -- Merge.dev account ID
    status          text DEFAULT 'active',      -- 'active', 'disconnected', etc.
    connected_at    timestamptz DEFAULT now(),
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_integration_accounts_user_id ON public.integration_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_accounts_provider ON public.integration_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_integration_accounts_category ON public.integration_accounts(category);

ALTER TABLE public.integration_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integration_accounts"
    ON public.integration_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integration_accounts"
    ON public.integration_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integration_accounts"
    ON public.integration_accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integration_accounts"
    ON public.integration_accounts FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass integration_accounts"
    ON public.integration_accounts FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. email_connections
-- Purpose: Canonical email connection state (provider-agnostic).
-- Referenced by: outlook_auth, gmail_prod, ConnectEmail, EmailInbox, Advisor,
--   CalendarView, Integrations, email.py
-- Columns from code: id, user_id, provider, connected, connected_email,
--   inbox_type, sync_status, connected_at, updated_at
-- Upsert on_conflict: user_id (outlook_auth), id (gmail_prod)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_connections (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider        text NOT NULL,              -- 'outlook', 'gmail', 'icloud'
    connected       boolean DEFAULT false,
    connected_email text,                       -- the email address connected
    inbox_type      text DEFAULT 'standard',    -- 'standard', 'focused'
    sync_status     text DEFAULT 'active',      -- 'active', 'paused', 'error'
    connected_at    timestamptz,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_connections_user_id ON public.email_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_provider ON public.email_connections(provider);

ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email_connections"
    ON public.email_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email_connections"
    ON public.email_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email_connections"
    ON public.email_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email_connections"
    ON public.email_connections FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass email_connections"
    ON public.email_connections FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. outlook_oauth_tokens
-- Purpose: Microsoft/Outlook OAuth token storage.
-- Referenced by: outlook_auth, refresh_tokens, integration-status, gmail_prod,
--   email_priority, email_sync_worker.py
-- Columns from code: user_id, access_token, refresh_token, expires_at,
--   account_email, account_name, provider, created_at, updated_at
-- Upsert on_conflict: user_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outlook_oauth_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    access_token    text,
    refresh_token   text,
    expires_at      timestamptz,
    account_email   text,
    account_name    text,
    provider        text DEFAULT 'microsoft',   -- 'microsoft'
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outlook_oauth_tokens_user_id ON public.outlook_oauth_tokens(user_id);

ALTER TABLE public.outlook_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outlook_oauth_tokens"
    ON public.outlook_oauth_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outlook_oauth_tokens"
    ON public.outlook_oauth_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outlook_oauth_tokens"
    ON public.outlook_oauth_tokens FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outlook_oauth_tokens"
    ON public.outlook_oauth_tokens FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass outlook_oauth_tokens"
    ON public.outlook_oauth_tokens FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. gmail_connections
-- Purpose: Gmail/Google OAuth token storage.
-- Referenced by: gmail_prod, refresh_tokens, integration-status, email_priority,
--   email.py, email_sync_worker.py, integrations.py
-- Columns from code: user_id, email, access_token, refresh_token, token_expiry,
--   scopes, created_at, updated_at
-- Upsert on_conflict: user_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gmail_connections (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email           text,                       -- Gmail address
    access_token    text,
    refresh_token   text,
    token_expiry    timestamptz,
    scopes          text,                       -- OAuth scopes granted
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id ON public.gmail_connections(user_id);

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gmail_connections"
    ON public.gmail_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail_connections"
    ON public.gmail_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail_connections"
    ON public.gmail_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail_connections"
    ON public.gmail_connections FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass gmail_connections"
    ON public.gmail_connections FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. watchtower_events
-- Purpose: Authoritative intelligence events — anomalies, position changes,
--   metric alerts. Supports realtime subscriptions (postgres_changes).
-- Referenced by: business-brain-metrics-cron, useWatchtowerRealtime,
--   watchtower_store.py, silence_detection.py, DashboardLayout.js,
--   intelligence_live_truth.py, regeneration_governance.py
-- Columns from code: id, tenant_id, account_id, event_type, severity, source,
--   payload, observed_at, headline, fingerprint, status, handled_at,
--   handled_by_user_id, created_at, updated_at
-- Upsert on_conflict: account_id,fingerprint
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watchtower_events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid,                           -- maps to user_id in some contexts
    account_id          uuid,                           -- workspace/account scope
    event_type          text NOT NULL,                  -- 'metric_anomaly', 'position_change', etc.
    severity            text DEFAULT 'medium',          -- 'critical', 'high', 'medium', 'low', 'info'
    source              text,                           -- 'business-brain-metrics-cron', 'watchtower', etc.
    payload             jsonb DEFAULT '{}'::jsonb,      -- event-specific data
    observed_at         timestamptz DEFAULT now(),
    headline            text,                           -- human-readable event title
    fingerprint         text,                           -- deduplication key
    status              text DEFAULT 'active',          -- 'active', 'handled', 'dismissed'
    handled_at          timestamptz,
    handled_by_user_id  uuid,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),
    UNIQUE (account_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_watchtower_events_tenant_id ON public.watchtower_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_watchtower_events_account_id ON public.watchtower_events(account_id);
CREATE INDEX IF NOT EXISTS idx_watchtower_events_status ON public.watchtower_events(status);
CREATE INDEX IF NOT EXISTS idx_watchtower_events_severity ON public.watchtower_events(severity);
CREATE INDEX IF NOT EXISTS idx_watchtower_events_created_at ON public.watchtower_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchtower_events_source ON public.watchtower_events(source);

ALTER TABLE public.watchtower_events ENABLE ROW LEVEL SECURITY;

-- Watchtower uses tenant_id or account_id; realtime also reads by user context.
-- RLS is permissive for reads (filtered in app) and enforced for writes via service role.
CREATE POLICY "Users can view watchtower_events"
    ON public.watchtower_events FOR SELECT
    USING (true);

CREATE POLICY "Service role bypass watchtower_events"
    ON public.watchtower_events FOR ALL
    USING (auth.role() = 'service_role');

-- Enable realtime for this table (required for useWatchtowerRealtime hook)
ALTER PUBLICATION supabase_realtime ADD TABLE public.watchtower_events;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. strategic_console_state
-- Purpose: Authoritative calibration/console state — determines whether user
--   has completed calibration. Single row per user.
-- Referenced by: calibration-engine, checkin-manager, useCalibrationState,
--   calibration.py (3+ upsert sites)
-- Columns from code: user_id, status, is_complete, current_step, updated_at
-- Upsert on_conflict: user_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.strategic_console_state (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    status          text DEFAULT 'PENDING',         -- 'PENDING', 'IN_PROGRESS', 'COMPLETE', 'COMPLETED'
    is_complete     boolean DEFAULT false,
    current_step    integer DEFAULT 0,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategic_console_state_user_id ON public.strategic_console_state(user_id);

ALTER TABLE public.strategic_console_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategic_console_state"
    ON public.strategic_console_state FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategic_console_state"
    ON public.strategic_console_state FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategic_console_state"
    ON public.strategic_console_state FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategic_console_state"
    ON public.strategic_console_state FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass strategic_console_state"
    ON public.strategic_console_state FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. chat_history
-- Purpose: Stores AI chat conversation history between user and BIQc advisor.
-- Referenced by: generation.py (insert, select, delete), profile.py,
--   truth_engine_rpc.py, core/scoring.py
-- Columns from code: id, user_id, session_id, message, response,
--   context_type, created_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_history (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id      text,                       -- groups messages into sessions
    message         text,                       -- user message
    response        text,                       -- AI response
    context_type    text,                       -- 'general', 'proactive', 'intel', etc.
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON public.chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON public.chat_history(created_at DESC);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat_history"
    ON public.chat_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat_history"
    ON public.chat_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat_history"
    ON public.chat_history FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat_history"
    ON public.chat_history FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass chat_history"
    ON public.chat_history FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. system_prompts
-- Purpose: Database-managed AI system prompts. Versioned, editable via
--   PromptLab admin UI. Queried by prompt_registry.py on every AI call.
-- Referenced by: prompt_registry.py, admin.py, PromptLab.js,
--   core/prompt_builder.py, routes/calibration.py, soundboard.py
-- Columns from code: prompt_key, content, version, agent_identity,
--   is_active, description, updated_at
-- NOT user-scoped — global system table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_prompts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_key      text NOT NULL UNIQUE,        -- e.g. 'biqc_constitution_v1', 'myadvisor_v2'
    content         text NOT NULL DEFAULT '',     -- the full system prompt text
    version         text DEFAULT '1.0',
    agent_identity  text,                         -- e.g. 'MyAdvisor', 'MyIntel', 'BoardRoom'
    description     text,                         -- human description of this prompt
    is_active       boolean DEFAULT true,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_prompts_prompt_key ON public.system_prompts(prompt_key);
CREATE INDEX IF NOT EXISTS idx_system_prompts_agent_identity ON public.system_prompts(agent_identity);
CREATE INDEX IF NOT EXISTS idx_system_prompts_is_active ON public.system_prompts(is_active);

ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

-- System prompts are read by all authenticated users (via prompt_registry),
-- but only writable by service role (admin routes use service key).
CREATE POLICY "Authenticated users can read system_prompts"
    ON public.system_prompts FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role bypass system_prompts"
    ON public.system_prompts FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. intelligence_actions
-- Purpose: Actionable items derived from intelligence analysis — risks,
--   contradictions, competitor alerts, CFO alerts, watchtower findings.
-- Referenced by: intelligence_bridge.py, competitor-monitor, cfo-cash-analysis,
--   calibration.py, deep-web-recon, rapid-task
-- Columns from code: id, user_id, source, source_id, domain, severity, title,
--   description, suggested_action, status, created_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.intelligence_actions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source              text NOT NULL,              -- 'watchtower', 'competitor_monitor', 'cfo_agent', etc.
    source_id           text,                       -- deduplication key within source
    domain              text,                       -- 'market', 'finance', 'calibration', 'general', etc.
    severity            text DEFAULT 'medium',      -- 'critical', 'high', 'medium', 'low'
    title               text NOT NULL,
    description         text,
    suggested_action    text,
    status              text DEFAULT 'action_required', -- 'action_required', 'in_progress', 'resolved', 'dismissed'
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_actions_user_id ON public.intelligence_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_source ON public.intelligence_actions(source);
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_source_id ON public.intelligence_actions(source_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_status ON public.intelligence_actions(status);
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_domain ON public.intelligence_actions(domain);
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_created_at ON public.intelligence_actions(created_at DESC);

ALTER TABLE public.intelligence_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intelligence_actions"
    ON public.intelligence_actions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intelligence_actions"
    ON public.intelligence_actions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intelligence_actions"
    ON public.intelligence_actions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own intelligence_actions"
    ON public.intelligence_actions FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass intelligence_actions"
    ON public.intelligence_actions FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. usage_tracking
-- Purpose: Tracks AI API usage (OpenAI, Perplexity) per edge function call.
--   Used for cost monitoring and rate limiting.
-- Referenced by: 8+ edge functions (strategic-console-ai, sop-generator,
--   competitor-monitor, cfo-cash-analysis, calibration-sync, calibration-psych,
--   boardroom-diagnosis, biqc-insights-cognitive)
-- Columns from code: user_id, function_name, api_provider, model,
--   tokens_in, tokens_out, created_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    function_name   text NOT NULL,              -- 'strategic-console-ai', 'boardroom-diagnosis', etc.
    api_provider    text,                       -- 'openai', 'perplexity'
    model           text,                       -- 'gpt-5.4-pro', 'gpt-5.3', 'sonar', etc.
    tokens_in       integer DEFAULT 0,
    tokens_out      integer DEFAULT 0,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON public.usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_function_name ON public.usage_tracking(function_name);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_created_at ON public.usage_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_api_provider ON public.usage_tracking(api_provider);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Usage tracking is written by edge functions (service role) and read by admins.
-- Users can read their own usage.
CREATE POLICY "Users can view own usage_tracking"
    ON public.usage_tracking FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass usage_tracking"
    ON public.usage_tracking FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. cognitive_profiles
-- Purpose: 4-layer cognitive model — immutable reality, behavioural truth,
--   delivery preference, consequence memory. Created on user signup.
-- Referenced by: intelligence-snapshot, biqc-insights-cognitive, auth_supabase.py,
--   cognitive_core_supabase.py
-- Columns from code: user_id, immutable_reality (jsonb), behavioural_truth (jsonb),
--   delivery_preference (jsonb), consequence_memory (jsonb), last_updated
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cognitive_profiles (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    immutable_reality       jsonb DEFAULT '{}'::jsonb,      -- Layer 1: facts that don't change
    behavioural_truth       jsonb DEFAULT '{}'::jsonb,      -- Layer 2: observed behaviour patterns
    delivery_preference     jsonb DEFAULT '{}'::jsonb,      -- Layer 3: how user prefers communication
    consequence_memory      jsonb DEFAULT '{}'::jsonb,      -- Layer 4: outcomes of past decisions
    last_updated            timestamptz DEFAULT now(),
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cognitive_profiles_user_id ON public.cognitive_profiles(user_id);

ALTER TABLE public.cognitive_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cognitive_profiles"
    ON public.cognitive_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cognitive_profiles"
    ON public.cognitive_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cognitive_profiles"
    ON public.cognitive_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cognitive_profiles"
    ON public.cognitive_profiles FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass cognitive_profiles"
    ON public.cognitive_profiles FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. strategy_profiles
-- Purpose: User's strategic framework — mission, vision, goals, challenges.
--   Created during calibration Q7-Q9. Can be AI-generated.
-- Referenced by: intelligence-snapshot, calibration-sync, calibration.py,
--   regeneration_governance.py, boardroom-diagnosis, biqc-insights-cognitive
-- Columns from code: id, user_id, business_profile_id, account_id,
--   mission_statement, vision_statement, short_term_goals, long_term_goals,
--   primary_challenges, growth_strategy, raw_mission_input, raw_challenges_input,
--   raw_growth_input, source, regenerable, created_at, updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.strategy_profiles (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_profile_id     uuid,                           -- FK to business_profiles
    account_id              uuid,
    mission_statement       text,
    vision_statement        text,
    short_term_goals        text,
    long_term_goals         text,
    primary_challenges      text,
    growth_strategy         text,
    raw_mission_input       text,                           -- user's raw input before AI processing
    raw_challenges_input    text,
    raw_growth_input        text,
    source                  text DEFAULT 'user',            -- 'user', 'ai_generated'
    regenerable             boolean DEFAULT true,
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_profiles_user_id ON public.strategy_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_profiles_business_profile_id ON public.strategy_profiles(business_profile_id);

ALTER TABLE public.strategy_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategy_profiles"
    ON public.strategy_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategy_profiles"
    ON public.strategy_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategy_profiles"
    ON public.strategy_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategy_profiles"
    ON public.strategy_profiles FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass strategy_profiles"
    ON public.strategy_profiles FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 13. onboarding
-- Purpose: Tracks onboarding progress — flexible JSONB data upserted by
--   supabase_remaining_helpers.py. Single row per user.
-- Referenced by: supabase_remaining_helpers.py, routes/onboarding.py,
--   routes/calibration.py, routes/profile.py
-- Columns from code: user_id, data (upserted as arbitrary dict),
--   updated_at. Upsert on_conflict: user_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    completed       boolean DEFAULT false,
    current_step    integer DEFAULT 0,
    completed_at    timestamptz,
    data            jsonb DEFAULT '{}'::jsonb,   -- flexible onboarding state
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON public.onboarding(user_id);

ALTER TABLE public.onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding"
    ON public.onboarding FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding"
    ON public.onboarding FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding"
    ON public.onboarding FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own onboarding"
    ON public.onboarding FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass onboarding"
    ON public.onboarding FOR ALL
    USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 14. documents
-- Purpose: User-uploaded or AI-generated documents (SOPs, reports, analyses).
-- Referenced by: supabase_document_helpers.py, routes/generation.py,
--   routes/file_service.py, sop-generator edge function
-- Columns from code: id, user_id, title, document_type, content, tags,
--   created_at, updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           text NOT NULL DEFAULT '',
    document_type   text,                       -- 'sop', 'report', 'analysis', etc.
    content         text DEFAULT '',             -- document body text
    tags            text[] DEFAULT '{}',         -- array of tags
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
    ON public.documents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
    ON public.documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
    ON public.documents FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
    ON public.documents FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass documents"
    ON public.documents FOR ALL
    USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════════════════
-- Updated_at trigger function (shared)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all 14 tables
DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'integration_accounts', 'email_connections', 'outlook_oauth_tokens',
        'gmail_connections', 'watchtower_events', 'strategic_console_state',
        'chat_history', 'system_prompts', 'intelligence_actions',
        'usage_tracking', 'cognitive_profiles', 'strategy_profiles',
        'onboarding', 'documents'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trigger_set_updated_at ON public.%I; '
            'CREATE TRIGGER trigger_set_updated_at '
            'BEFORE UPDATE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            tbl, tbl
        );
    END LOOP;
END;
$$;
