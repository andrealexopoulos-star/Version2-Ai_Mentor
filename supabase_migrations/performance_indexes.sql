-- ═══════════════════════════════════════════════════════════════
-- BIQc PERFORMANCE INDEX MIGRATION — Sovereign Edition
-- Run in Supabase SQL Editor
-- Safe to run multiple times (IF NOT EXISTS on all)
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════
-- LAYER 1: CORE IDENTITY INDEXES (user_id)
-- Every table queried by user_id must resolve in <5ms
-- ═══════════════════════════════════════════

-- Core Tables
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON public.business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_operator_profile_user_id ON public.user_operator_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_strategic_console_state_user_id ON public.strategic_console_state(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_profiles_user_id ON public.strategy_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_cognitive_profiles_user_id ON public.cognitive_profiles(user_id);

-- Intelligence Tables
CREATE INDEX IF NOT EXISTS idx_intelligence_baseline_user_id ON public.intelligence_baseline(user_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_user_id ON public.intelligence_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_watchtower_insights_user_id ON public.watchtower_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_observation_events_user_id ON public.observation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_escalation_memory_user_id ON public.escalation_memory(user_id);

-- Content Tables
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_user_id ON public.diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_sops_user_id ON public.sops(user_id);
CREATE INDEX IF NOT EXISTS idx_data_files_user_id ON public.data_files(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_soundboard_conversations_user_id ON public.soundboard_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_advisory_log_user_id ON public.advisory_log(user_id);

-- Integration Tables
CREATE INDEX IF NOT EXISTS idx_integration_accounts_user_id ON public.integration_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_merge_integrations_user_id ON public.merge_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id ON public.gmail_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_oauth_tokens_user_id ON public.outlook_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_m365_tokens_user_id ON public.m365_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_google_drive_files_user_id ON public.google_drive_files(user_id);

-- Email & Calendar
CREATE INDEX IF NOT EXISTS idx_email_intelligence_user_id ON public.email_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_email_priority_analysis_user_id ON public.email_priority_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_intelligence_user_id ON public.calendar_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_emails_user_id ON public.outlook_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_calendar_events_user_id ON public.outlook_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_sync_jobs_user_id ON public.outlook_sync_jobs(user_id);

-- OAC, Onboarding, Scheduling
CREATE INDEX IF NOT EXISTS idx_oac_recommendations_user_id ON public.oac_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_oac_usage_user_id ON public.oac_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON public.onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_web_sources_user_id ON public.web_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_cadence_user_id ON public.progress_cadence(user_id);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_user_id ON public.calibration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_calibration_schedules_user_id ON public.calibration_schedules(user_id);

-- Account-scoped
CREATE INDEX IF NOT EXISTS idx_business_profiles_account_id ON public.business_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_strategy_profiles_account_id ON public.strategy_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_integration_accounts_account_id ON public.integration_accounts(account_id);


-- ═══════════════════════════════════════════
-- LAYER 2: JSONB DEEP-SEARCH (Intelligence Sovereignty)
-- Allows the AI to instantly query data INSIDE JSON blobs
-- GIN indexes enable @>, ?, ?& operators on JSONB columns
-- ═══════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_observation_events_payload_gin ON public.observation_events USING GIN (payload);
CREATE INDEX IF NOT EXISTS idx_cognitive_profiles_reality_gin ON public.cognitive_profiles USING GIN (immutable_reality);
CREATE INDEX IF NOT EXISTS idx_cognitive_profiles_behaviour_gin ON public.cognitive_profiles USING GIN (behavioural_truth);
CREATE INDEX IF NOT EXISTS idx_business_profiles_social_gin ON public.business_profiles USING GIN (social_handles);
CREATE INDEX IF NOT EXISTS idx_business_profiles_intel_config_gin ON public.business_profiles USING GIN (intelligence_configuration);
CREATE INDEX IF NOT EXISTS idx_user_operator_profile_op_gin ON public.user_operator_profile USING GIN (operator_profile);
CREATE INDEX IF NOT EXISTS idx_intelligence_baseline_baseline_gin ON public.intelligence_baseline USING GIN (baseline);


-- ═══════════════════════════════════════════
-- LAYER 3: CHRONOLOGICAL SPEED (The Latest Signal)
-- Ensures Strategic Console loads NEWEST data first in <10ms
-- DESC ordering = most recent rows at the top of the index
-- ═══════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_observation_events_recent ON public.observation_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchtower_insights_recent ON public.watchtower_insights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_recent ON public.chat_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_memory_recent ON public.escalation_memory(user_id, last_detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_outlook_emails_recent ON public.outlook_emails(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soundboard_recent ON public.soundboard_conversations(user_id, updated_at DESC);


-- ═══════════════════════════════════════════
-- LAYER 4: CONTENT INTELLIGENCE (Full-Text Search)
-- Enables text search across SOPs, Documents, Analyses
-- tsvector indexes power PostgreSQL full-text search
-- ═══════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_sops_content_search ON public.sops USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON public.documents USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_analyses_content_search ON public.analyses USING GIN (to_tsvector('english', content));


-- ═══════════════════════════════════════════
-- LAYER 5: COMPOSITE HOT-PATH INDEXES
-- Multi-column indexes for the most frequent query patterns
-- ═══════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_observation_events_user_signal ON public.observation_events(user_id, signal_name);
CREATE INDEX IF NOT EXISTS idx_escalation_memory_user_active ON public.escalation_memory(user_id, active);
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_user_status ON public.intelligence_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_integration_accounts_user_provider ON public.integration_accounts(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_watchtower_insights_user_status ON public.watchtower_insights(user_id, status);
