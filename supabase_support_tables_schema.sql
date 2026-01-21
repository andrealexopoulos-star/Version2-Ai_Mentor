-- SUPABASE SCHEMA: Intelligence & Support Collections
-- Purpose: Migrate intelligence and support data from MongoDB

-- =============================================
-- TABLE 1: email_intelligence
-- Stores business intelligence extracted from emails
-- =============================================
CREATE TABLE IF NOT EXISTS email_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    top_clients JSONB DEFAULT '[]'::jsonb,
    communication_patterns JSONB DEFAULT '{}'::jsonb,
    client_insights JSONB DEFAULT '[]'::jsonb,
    total_emails_analyzed INTEGER DEFAULT 0,
    last_analysis_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX idx_email_intelligence_user ON email_intelligence(user_id);

-- =============================================
-- TABLE 2: calendar_intelligence
-- Stores calendar insights and meeting patterns
-- =============================================
CREATE TABLE IF NOT EXISTS calendar_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_events INTEGER DEFAULT 0,
    upcoming_meetings INTEGER DEFAULT 0,
    meeting_load TEXT,
    top_collaborators JSONB DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX idx_calendar_intelligence_user ON calendar_intelligence(user_id);

-- =============================================
-- TABLE 3: email_priority_analysis
-- Stores AI-generated email priority analysis
-- =============================================
CREATE TABLE IF NOT EXISTS email_priority_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    high_priority JSONB DEFAULT '[]'::jsonb,
    medium_priority JSONB DEFAULT '[]'::jsonb,
    low_priority JSONB DEFAULT '[]'::jsonb,
    strategic_insights TEXT,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX idx_email_priority_user ON email_priority_analysis(user_id);

-- =============================================
-- TABLE 4: chat_history
-- Stores chat conversation history
-- =============================================
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_history_user ON chat_history(user_id);
CREATE INDEX idx_chat_history_session ON chat_history(session_id);
CREATE INDEX idx_chat_history_created ON chat_history(created_at DESC);

-- =============================================
-- TABLE 5: soundboard_conversations
-- Stores MySoundboard voice/thinking partner conversations
-- =============================================
CREATE TABLE IF NOT EXISTS soundboard_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb,
    topic TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_soundboard_user ON soundboard_conversations(user_id);
CREATE INDEX idx_soundboard_session ON soundboard_conversations(session_id);

-- =============================================
-- TABLE 6: data_files
-- Stores uploaded file metadata and extracted text
-- =============================================
CREATE TABLE IF NOT EXISTS data_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    category TEXT,
    description TEXT,
    extracted_text TEXT,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_data_files_user ON data_files(user_id);
CREATE INDEX idx_data_files_category ON data_files(category);

-- =============================================
-- TABLE 7: analyses
-- Stores business analysis results
-- =============================================
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis TEXT NOT NULL,
    insights JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyses_user ON analyses(user_id);
CREATE INDEX idx_analyses_created ON analyses(created_at DESC);

-- =============================================
-- TABLE 8: business_profiles
-- Stores business profile data
-- =============================================
CREATE TABLE IF NOT EXISTS business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT,
    industry TEXT,
    business_type TEXT,
    business_stage TEXT,
    year_founded INTEGER,
    website TEXT,
    location TEXT,
    employee_count TEXT,
    annual_revenue_range TEXT,
    target_market TEXT,
    value_proposition TEXT,
    main_challenges TEXT,
    short_term_goals TEXT,
    long_term_goals TEXT,
    profile_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX idx_business_profiles_user ON business_profiles(user_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE email_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_priority_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE soundboard_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_intelligence_user_policy ON email_intelligence FOR ALL USING (auth.uid() = user_id);
CREATE POLICY calendar_intelligence_user_policy ON calendar_intelligence FOR ALL USING (auth.uid() = user_id);
CREATE POLICY email_priority_user_policy ON email_priority_analysis FOR ALL USING (auth.uid() = user_id);
CREATE POLICY chat_history_user_policy ON chat_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY soundboard_user_policy ON soundboard_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY data_files_user_policy ON data_files FOR ALL USING (auth.uid() = user_id);
CREATE POLICY analyses_user_policy ON analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY business_profiles_user_policy ON business_profiles FOR ALL USING (auth.uid() = user_id);
