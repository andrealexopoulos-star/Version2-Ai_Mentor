-- CHUNK 1: Core Tables
-- 001_watchtower_events.sql
-- WATCHTOWER EVENTS TABLE
-- Single source of truth for all BIQc intelligence statements
-- Stores conclusions, not raw data

CREATE TABLE IF NOT EXISTS public.watchtower_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    
    -- Classification
    domain TEXT NOT NULL CHECK (domain IN (
        'communications',
        'pipeline',
        'financial',
        'operations',
        'calendar',
        'marketing'
    )),
    type TEXT NOT NULL CHECK (type IN (
        'risk',
        'drift',
        'opportunity',
        'anomaly'
    )),
    severity TEXT NOT NULL CHECK (severity IN (
        'low',
        'medium',
        'high',
        'critical'
    )),
    
    -- The Truth
    headline TEXT NOT NULL,
    statement TEXT NOT NULL,
    
    -- Evidence (minimal, factual)
    evidence_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Temporal context
    consequence_window TEXT,
    
    -- Source attribution
    source TEXT NOT NULL,
    
    -- Deduplication
    fingerprint TEXT NOT NULL,
    
    -- Lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active',
        'handled',
        'resolved',
        'suppressed'
    )),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    handled_at TIMESTAMPTZ,
    handled_by_user_id UUID REFERENCES auth.users(id),
    
    -- Workspace isolation
    CONSTRAINT unique_event_per_workspace UNIQUE (account_id, fingerprint)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_watchtower_account_status ON public.watchtower_events(account_id, status);
CREATE INDEX IF NOT EXISTS idx_watchtower_domain ON public.watchtower_events(domain);
CREATE INDEX IF NOT EXISTS idx_watchtower_severity ON public.watchtower_events(severity);
CREATE INDEX IF NOT EXISTS idx_watchtower_created ON public.watchtower_events(created_at DESC);

-- RLS Policies
ALTER TABLE public.watchtower_events ENABLE ROW LEVEL SECURITY;

-- Users can read their workspace's events
DROP POLICY IF EXISTS "Users can read workspace watchtower events" ON public.watchtower_events;
CREATE POLICY "Users can read workspace watchtower events" ON public.watchtower_events
    FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Service role can do anything
DROP POLICY IF EXISTS "Service role full access" ON public.watchtower_events;
CREATE POLICY "Service role full access" ON public.watchtower_events
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_watchtower_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER watchtower_updated_at
    BEFORE UPDATE ON public.watchtower_events
    FOR EACH ROW
    EXECUTE FUNCTION update_watchtower_updated_at();

COMMENT ON TABLE public.watchtower_events IS 'Authoritative intelligence events - conclusions only, not raw data';

-- 002_watchtower_rpcs.sql
-- WATCHTOWER SERVER-SIDE INTELLIGENCE - SUPABASE RPCs
-- Execute this SQL in Supabase SQL Editor
-- Moves email analysis to PostgreSQL for performance

-- 1. ANALYZE GHOSTING (Server-Side)
CREATE OR REPLACE FUNCTION analyze_ghosted_vips(
  target_user_id UUID, 
  lookback_days INT DEFAULT 180,
  silence_threshold_days INT DEFAULT 21
)
RETURNS TABLE (sender_email TEXT, last_contact TIMESTAMPTZ, msg_count BIGINT) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    from_address as sender_email,
    MAX(received_date) as last_contact,
    COUNT(*) as msg_count
  FROM outlook_emails
  WHERE user_id = target_user_id
    AND received_date > NOW() - (lookback_days || ' days')::INTERVAL
    AND folder = 'inbox'
  GROUP BY from_address
  HAVING COUNT(*) > 5  -- Only significant relationships
     AND MAX(received_date) < NOW() - (silence_threshold_days || ' days')::INTERVAL
  ORDER BY msg_count DESC
  LIMIT 10;
END;
$$;

-- 2. ANALYZE BURNOUT (Server-Side)
CREATE OR REPLACE FUNCTION analyze_burnout_risk(
  target_user_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  late_night_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO late_night_count
  FROM outlook_emails
  WHERE user_id = target_user_id
    AND folder = 'sentitems'
    AND received_date > NOW() - INTERVAL '7 days'
    -- Check for hours between 11 PM (23) and 5 AM (5)
    AND (
      EXTRACT(HOUR FROM received_date AT TIME ZONE 'UTC') >= 23 
      OR 
      EXTRACT(HOUR FROM received_date AT TIME ZONE 'UTC') <= 5
    );
  
  RETURN late_night_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION analyze_ghosted_vips TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_burnout_risk TO authenticated;

-- 003_outlook_emails_schema.sql
-- OUTLOOK EMAILS TABLE SCHEMA
-- Stores email data for intelligence analysis

-- Drop and recreate to ensure clean schema
DROP TABLE IF EXISTS public.outlook_emails CASCADE;

CREATE TABLE IF NOT EXISTS public.outlook_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Microsoft Graph identifiers
    graph_message_id TEXT NOT NULL,
    conversation_id TEXT,
    
    -- Email metadata
    subject TEXT,
    from_address TEXT,
    from_name TEXT,
    to_recipients JSONB,
    
    -- Timestamps
    received_date TIMESTAMPTZ,
    
    -- Content
    body_preview TEXT,
    body_content TEXT,
    
    -- Classification
    folder TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    is_external BOOLEAN,
    metadata_only BOOLEAN DEFAULT false,
    
    -- Sync tracking
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint for upsert
    CONSTRAINT unique_email_per_user UNIQUE (user_id, graph_message_id)
);

-- Indexes for RPC performance
CREATE INDEX IF NOT EXISTS idx_outlook_emails_user_received ON public.outlook_emails(user_id, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_outlook_emails_user_folder ON public.outlook_emails(user_id, folder);
CREATE INDEX IF NOT EXISTS idx_outlook_emails_from_address ON public.outlook_emails(from_address);

-- RLS Policies
ALTER TABLE public.outlook_emails ENABLE ROW LEVEL SECURITY;

-- Users can read their own emails
DROP POLICY IF EXISTS "Users can read own emails" ON public.outlook_emails;
CREATE POLICY "Users can read own emails" ON public.outlook_emails
    FOR SELECT
    USING (user_id = auth.uid());

-- Service role can do anything
DROP POLICY IF EXISTS "Service role full access" ON public.outlook_emails;
CREATE POLICY "Service role full access" ON public.outlook_emails
    FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.outlook_emails IS 'Email data for intelligence analysis';

-- 004_emails_provider_agnostic.sql
-- PROVIDER-AGNOSTIC EMAIL TABLE (TRUTH ENGINE FUEL)
-- Ensures ALL connected email accounts feed the intelligence engine

-- Add missing columns for provider-agnostic operation
ALTER TABLE public.outlook_emails 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'outlook';

-- Update constraint to be provider-agnostic
-- Drop old constraint
ALTER TABLE public.outlook_emails DROP CONSTRAINT IF EXISTS unique_email_per_user;

-- Add new provider-agnostic constraint
-- Uses: workspace (account_id) + provider + provider_message_id
ALTER TABLE public.outlook_emails 
ADD CONSTRAINT unique_email_per_account_provider 
UNIQUE (account_id, provider, graph_message_id);

-- Create index for provider queries
CREATE INDEX IF NOT EXISTS idx_outlook_emails_provider ON public.outlook_emails(provider);
CREATE INDEX IF NOT EXISTS idx_outlook_emails_account ON public.outlook_emails(account_id);

-- Update comment
COMMENT ON TABLE public.outlook_emails IS 'Provider-agnostic email data for intelligence analysis (Outlook, Gmail, future providers)';
COMMENT ON COLUMN public.outlook_emails.provider IS 'Email provider: outlook, gmail, etc';
COMMENT ON COLUMN public.outlook_emails.account_id IS 'Workspace/account scope for multi-tenancy';
COMMENT ON COLUMN public.outlook_emails.graph_message_id IS 'Provider-native message ID (Graph API for Outlook, Gmail API for Gmail)';

-- 005_signal_to_noise_intelligence.sql
-- SIGNAL-TO-NOISE INTELLIGENCE LAYER
-- Implements advisory-aware classification and business vitals

-- 1. ADD ADVISORY MODE TO BUSINESS PROFILES
ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS advisory_mode TEXT DEFAULT 'crystal_ball' 
CHECK (advisory_mode IN ('mentor', 'advisor', 'intelligence', 'crystal_ball'));

COMMENT ON COLUMN public.business_profiles.advisory_mode IS 
'Advisory tone: mentor (guidance), advisor (recommendations), intelligence (insights), crystal_ball (predictions)';

-- 2. ADD BUSINESS DOMAINS FOR WORKSPACE-LEVEL CLASSIFICATION
ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS business_domains TEXT[] DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.business_profiles.business_domains IS 
'Workspace-owned domains for internal classification (e.g. ["company.com", "company.io"])';

-- 3. CREATE BUSINESS VITALS RPC (SIGNAL-TO-NOISE CLASSIFICATION)
CREATE OR REPLACE FUNCTION get_business_vitals(
  target_user_id UUID,
  analysis_window_days INT DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  business_domains TEXT[];
  vitals JSONB;
  network_health JSONB;
  inner_circle JSONB;
  workload JSONB;
  total_contacts INT;
  active_clients INT;
  internal_team INT;
  noise_sources INT;
  noise_ratio NUMERIC;
BEGIN
  -- Get business domains for the user's workspace
  SELECT COALESCE(bp.business_domains, ARRAY[]::TEXT[])
  INTO business_domains
  FROM business_profiles bp
  JOIN users u ON u.id = target_user_id
  WHERE bp.user_id = u.id
  LIMIT 1;
  
  -- If no domains configured, use user's email domain as fallback
  IF array_length(business_domains, 1) IS NULL THEN
    SELECT ARRAY[split_part(email, '@', 2)]
    INTO business_domains
    FROM users
    WHERE id = target_user_id;
  END IF;
  
  -- CLASSIFICATION QUERY: Analyze all contacts in window
  WITH contact_analysis AS (
    SELECT
      from_address as email,
      split_part(from_address, '@', 2) as sender_domain,
      
      -- Volume metrics
      COUNT(*) FILTER (WHERE folder = 'inbox') as inbound_count,
      COUNT(*) FILTER (WHERE folder = 'sentitems') as outbound_count,
      MAX(received_date) as last_activity_at,
      
      -- Bidirectional check
      (COUNT(*) FILTER (WHERE folder = 'inbox') > 0 AND 
       COUNT(*) FILTER (WHERE folder = 'sentitems') > 0) as bidirectional,
      
      -- Internal check (domain in business_domains)
      split_part(from_address, '@', 2) = ANY(business_domains) as is_internal,
      
      -- Noise patterns
      (
        from_address ILIKE '%noreply%' OR
        from_address ILIKE '%newsletter%' OR
        from_address ILIKE '%marketing%' OR
        from_address ILIKE '%support%' OR
        from_address ILIKE '%notification%' OR
        (COUNT(*) FILTER (WHERE folder = 'inbox') >= 5 AND 
         COUNT(*) FILTER (WHERE folder = 'sentitems') = 0)
      ) as matches_noise_pattern
      
    FROM outlook_emails
    WHERE user_id = target_user_id
      AND received_date > NOW() - (analysis_window_days || ' days')::INTERVAL
      AND from_address IS NOT NULL
      AND from_address != ''
    GROUP BY from_address
  ),
  
  classified_contacts AS (
    SELECT
      email,
      sender_domain,
      inbound_count,
      outbound_count,
      bidirectional,
      last_activity_at,
      
      -- CLASSIFICATION LOGIC
      CASE
        WHEN is_internal THEN 'INTERNAL'
        WHEN matches_noise_pattern AND NOT bidirectional THEN 'NOISE'
        WHEN bidirectional AND NOT is_internal THEN 'EXTERNAL_SIGNAL'
        ELSE 'UNKNOWN'
      END as classification,
      
      -- ENGAGEMENT TIER (for external signals only)
      CASE
        WHEN bidirectional AND NOT is_internal THEN
          CASE
            WHEN (inbound_count + outbound_count) >= 20 THEN 'High'
            WHEN (inbound_count + outbound_count) >= 8 THEN 'Medium'
            ELSE 'Low'
          END
        ELSE NULL
      END as engagement_tier
      
    FROM contact_analysis
  ),
  
  aggregated_metrics AS (
    SELECT
      COUNT(*) as total_contacts,
      COUNT(*) FILTER (WHERE classification = 'EXTERNAL_SIGNAL') as active_clients,
      COUNT(*) FILTER (WHERE classification = 'INTERNAL') as internal_team,
      COUNT(*) FILTER (WHERE classification = 'NOISE') as noise_sources
    FROM classified_contacts
  )
  
  SELECT
    total_contacts,
    active_clients,
    internal_team,
    noise_sources
  INTO total_contacts, active_clients, internal_team, noise_sources
  FROM aggregated_metrics;
  
  -- Calculate noise ratio
  IF total_contacts > 0 THEN
    noise_ratio := ROUND((noise_sources::NUMERIC / total_contacts::NUMERIC) * 100, 0);
  ELSE
    noise_ratio := 0;
  END IF;
  
  -- Build network_health object
  network_health := jsonb_build_object(
    'total_contacts', total_contacts,
    'active_clients', active_clients,
    'internal_team', internal_team,
    'noise_sources', noise_sources,
    'noise_ratio', noise_ratio || '%',
    'interpretation', 
      CASE
        WHEN noise_ratio > 80 THEN 'Most inbound volume is non-actionable. Business load is concentrated on a small group.'
        WHEN noise_ratio > 50 THEN 'Significant noise present. Focus on high-engagement contacts.'
        ELSE 'Healthy signal-to-noise ratio. Network is well-balanced.'
      END
  );
  
  -- Build inner_circle (EXTERNAL_SIGNAL only, ordered by engagement)
  SELECT jsonb_agg(
    jsonb_build_object(
      'email', email,
      'engagement', engagement_tier,
      'volume', inbound_count + outbound_count,
      'confidence', 
        CASE
          WHEN engagement_tier = 'High' THEN 'High'
          WHEN engagement_tier = 'Medium' THEN 'Medium'
          ELSE 'Low'
        END,
      'classification_reason', 'Bidirectional communication over analysis window',
      'last_activity', last_activity_at
    )
    ORDER BY (inbound_count + outbound_count) DESC
  )
  INTO inner_circle
  FROM classified_contacts
  WHERE classification = 'EXTERNAL_SIGNAL'
  LIMIT 20;
  
  -- Build workload metrics
  WITH email_volume AS (
    SELECT COUNT(*) as email_count
    FROM outlook_emails
    WHERE user_id = target_user_id
      AND received_date > NOW() - (analysis_window_days || ' days')::INTERVAL
  )
  SELECT jsonb_build_object(
    'email_volume', COALESCE(email_count, 0),
    'meeting_hours', 0  -- Placeholder for calendar integration
  )
  INTO workload
  FROM email_volume;
  
  -- Assemble final vitals
  vitals := jsonb_build_object(
    'network_health', network_health,
    'inner_circle', COALESCE(inner_circle, '[]'::jsonb),
    'workload', workload,
    'analysis_window_days', analysis_window_days,
    'generated_at', NOW()
  );
  
  RETURN vitals;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_business_vitals TO authenticated;

COMMENT ON FUNCTION get_business_vitals IS 
'Returns business vitals with signal-to-noise classification: network health, inner circle (clients), and workload metrics';

-- 006_fix_business_vitals_rpc.sql
-- FIX: SIGNAL-TO-NOISE RPC (Remove ambiguous column reference)

CREATE OR REPLACE FUNCTION get_business_vitals(
  target_user_id UUID,
  analysis_window_days INT DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  business_domains TEXT[];
  vitals JSONB;
  network_health JSONB;
  inner_circle JSONB;
  workload JSONB;
  v_total_contacts INT;
  v_active_clients INT;
  v_internal_team INT;
  v_noise_sources INT;
  noise_ratio NUMERIC;
BEGIN
  -- Get business domains for the user's workspace
  SELECT COALESCE(bp.business_domains, ARRAY[]::TEXT[])
  INTO business_domains
  FROM business_profiles bp
  JOIN users u ON u.id = target_user_id
  WHERE bp.user_id = u.id
  LIMIT 1;
  
  -- If no domains configured, use user's email domain as fallback
  IF array_length(business_domains, 1) IS NULL THEN
    SELECT ARRAY[split_part(email, '@', 2)]
    INTO business_domains
    FROM users
    WHERE id = target_user_id;
  END IF;
  
  -- CLASSIFICATION QUERY: Analyze all contacts in window
  WITH contact_analysis AS (
    SELECT
      from_address as email,
      split_part(from_address, '@', 2) as sender_domain,
      
      -- Volume metrics
      COUNT(*) FILTER (WHERE folder = 'inbox') as inbound_count,
      COUNT(*) FILTER (WHERE folder = 'sentitems') as outbound_count,
      MAX(received_date) as last_activity_at,
      
      -- Bidirectional check
      (COUNT(*) FILTER (WHERE folder = 'inbox') > 0 AND 
       COUNT(*) FILTER (WHERE folder = 'sentitems') > 0) as bidirectional,
      
      -- Internal check (domain in business_domains)
      split_part(from_address, '@', 2) = ANY(business_domains) as is_internal,
      
      -- Noise patterns
      (
        from_address ILIKE '%noreply%' OR
        from_address ILIKE '%newsletter%' OR
        from_address ILIKE '%marketing%' OR
        from_address ILIKE '%support%' OR
        from_address ILIKE '%notification%' OR
        (COUNT(*) FILTER (WHERE folder = 'inbox') >= 5 AND 
         COUNT(*) FILTER (WHERE folder = 'sentitems') = 0)
      ) as matches_noise_pattern
      
    FROM outlook_emails
    WHERE user_id = target_user_id
      AND received_date > NOW() - (analysis_window_days || ' days')::INTERVAL
      AND from_address IS NOT NULL
      AND from_address != ''
    GROUP BY from_address
  ),
  
  classified_contacts AS (
    SELECT
      email,
      sender_domain,
      inbound_count,
      outbound_count,
      bidirectional,
      last_activity_at,
      
      -- CLASSIFICATION LOGIC
      CASE
        WHEN is_internal THEN 'INTERNAL'
        WHEN matches_noise_pattern AND NOT bidirectional THEN 'NOISE'
        WHEN bidirectional AND NOT is_internal THEN 'EXTERNAL_SIGNAL'
        ELSE 'UNKNOWN'
      END as classification,
      
      -- ENGAGEMENT TIER (for external signals only)
      CASE
        WHEN bidirectional AND NOT is_internal THEN
          CASE
            WHEN (inbound_count + outbound_count) >= 20 THEN 'High'
            WHEN (inbound_count + outbound_count) >= 8 THEN 'Medium'
            ELSE 'Low'
          END
        ELSE NULL
      END as engagement_tier
      
    FROM contact_analysis
  ),
  
  aggregated_metrics AS (
    SELECT
      COUNT(*)::INT as total,
      COUNT(*) FILTER (WHERE classification = 'EXTERNAL_SIGNAL')::INT as clients,
      COUNT(*) FILTER (WHERE classification = 'INTERNAL')::INT as team,
      COUNT(*) FILTER (WHERE classification = 'NOISE')::INT as noise
    FROM classified_contacts
  )
  
  SELECT total, clients, team, noise
  INTO v_total_contacts, v_active_clients, v_internal_team, v_noise_sources
  FROM aggregated_metrics;
  
  -- Calculate noise ratio
  IF v_total_contacts > 0 THEN
    noise_ratio := ROUND((v_noise_sources::NUMERIC / v_total_contacts::NUMERIC) * 100, 0);
  ELSE
    noise_ratio := 0;
  END IF;
  
  -- Build network_health object
  network_health := jsonb_build_object(
    'total_contacts', v_total_contacts,
    'active_clients', v_active_clients,
    'internal_team', v_internal_team,
    'noise_sources', v_noise_sources,
    'noise_ratio', noise_ratio || '%',
    'interpretation', 
      CASE
        WHEN noise_ratio > 80 THEN 'Most inbound volume is non-actionable. Business load is concentrated on a small group.'
        WHEN noise_ratio > 50 THEN 'Significant noise present. Focus on high-engagement contacts.'
        ELSE 'Healthy signal-to-noise ratio. Network is well-balanced.'
      END
  );
  
  -- Build inner_circle (EXTERNAL_SIGNAL only, ordered by engagement)
  SELECT jsonb_agg(
    jsonb_build_object(
      'email', email,
      'engagement', engagement_tier,
      'volume', inbound_count + outbound_count,
      'confidence', 
        CASE
          WHEN engagement_tier = 'High' THEN 'High'
          WHEN engagement_tier = 'Medium' THEN 'Medium'
          ELSE 'Low'
        END,
      'classification_reason', 'Bidirectional communication over analysis window',
      'last_activity', last_activity_at
    )
    ORDER BY (inbound_count + outbound_count) DESC
  )
  INTO inner_circle
  FROM classified_contacts
  WHERE classification = 'EXTERNAL_SIGNAL'
  LIMIT 20;
  
  -- Build workload metrics
  WITH email_volume AS (
    SELECT COUNT(*)::INT as email_count
    FROM outlook_emails
    WHERE user_id = target_user_id
      AND received_date > NOW() - (analysis_window_days || ' days')::INTERVAL
  )
  SELECT jsonb_build_object(
    'email_volume', COALESCE(email_count, 0),
    'meeting_hours', 0
  )
  INTO workload
  FROM email_volume;
  
  -- Assemble final vitals
  vitals := jsonb_build_object(
    'network_health', network_health,
    'inner_circle', COALESCE(inner_circle, '[]'::jsonb),
    'workload', workload,
    'analysis_window_days', analysis_window_days,
    'generated_at', NOW()
  );
  
  RETURN vitals;
END;
$$;

-- 007_final_fix_business_vitals.sql
-- FINAL FIX: SIGNAL-TO-NOISE RPC (Fix CTE scope)

CREATE OR REPLACE FUNCTION get_business_vitals(
  target_user_id UUID,
  analysis_window_days INT DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  business_domains TEXT[];
  vitals JSONB;
  network_health JSONB;
  inner_circle JSONB;
  workload JSONB;
  v_total_contacts INT;
  v_active_clients INT;
  v_internal_team INT;
  v_noise_sources INT;
  noise_ratio NUMERIC;
BEGIN
  -- Get business domains for the user's workspace
  SELECT COALESCE(bp.business_domains, ARRAY[]::TEXT[])
  INTO business_domains
  FROM business_profiles bp
  JOIN users u ON u.id = target_user_id
  WHERE bp.user_id = u.id
  LIMIT 1;
  
  -- If no domains configured, use user's email domain as fallback
  IF array_length(business_domains, 1) IS NULL THEN
    SELECT ARRAY[split_part(email, '@', 2)]
    INTO business_domains
    FROM users
    WHERE id = target_user_id;
  END IF;
  
  -- AGGREGATE METRICS + BUILD INNER CIRCLE in single query
  WITH contact_analysis AS (
    SELECT
      from_address as email,
      split_part(from_address, '@', 2) as sender_domain,
      COUNT(*) FILTER (WHERE folder = 'inbox') as inbound_count,
      COUNT(*) FILTER (WHERE folder = 'sentitems') as outbound_count,
      MAX(received_date) as last_activity_at,
      (COUNT(*) FILTER (WHERE folder = 'inbox') > 0 AND 
       COUNT(*) FILTER (WHERE folder = 'sentitems') > 0) as bidirectional,
      split_part(from_address, '@', 2) = ANY(business_domains) as is_internal,
      (
        from_address ILIKE '%noreply%' OR
        from_address ILIKE '%newsletter%' OR
        from_address ILIKE '%marketing%' OR
        from_address ILIKE '%support%' OR
        from_address ILIKE '%notification%' OR
        (COUNT(*) FILTER (WHERE folder = 'inbox') >= 5 AND 
         COUNT(*) FILTER (WHERE folder = 'sentitems') = 0)
      ) as matches_noise_pattern
    FROM outlook_emails
    WHERE user_id = target_user_id
      AND received_date > NOW() - (analysis_window_days || ' days')::INTERVAL
      AND from_address IS NOT NULL
      AND from_address != ''
    GROUP BY from_address
  ),
  classified_contacts AS (
    SELECT
      email,
      sender_domain,
      inbound_count,
      outbound_count,
      bidirectional,
      last_activity_at,
      CASE
        WHEN is_internal THEN 'INTERNAL'
        WHEN matches_noise_pattern AND NOT bidirectional THEN 'NOISE'
        WHEN bidirectional AND NOT is_internal THEN 'EXTERNAL_SIGNAL'
        ELSE 'UNKNOWN'
      END as classification,
      CASE
        WHEN bidirectional AND NOT is_internal THEN
          CASE
            WHEN (inbound_count + outbound_count) >= 20 THEN 'High'
            WHEN (inbound_count + outbound_count) >= 8 THEN 'Medium'
            ELSE 'Low'
          END
        ELSE NULL
      END as engagement_tier
    FROM contact_analysis
  )
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE classification = 'EXTERNAL_SIGNAL')::INT,
    COUNT(*) FILTER (WHERE classification = 'INTERNAL')::INT,
    COUNT(*) FILTER (WHERE classification = 'NOISE')::INT
  INTO v_total_contacts, v_active_clients, v_internal_team, v_noise_sources
  FROM classified_contacts;
  
  -- Calculate noise ratio
  IF v_total_contacts > 0 THEN
    noise_ratio := ROUND((v_noise_sources::NUMERIC / v_total_contacts::NUMERIC) * 100, 0);
  ELSE
    noise_ratio := 0;
  END IF;
  
  -- Build network_health object
  network_health := jsonb_build_object(
    'total_contacts', v_total_contacts,
    'active_clients', v_active_clients,
    'internal_team', v_internal_team,
    'noise_sources', v_noise_sources,
    'noise_ratio', noise_ratio || '%',
    'interpretation', 
      CASE
        WHEN noise_ratio > 80 THEN 'Most inbound volume is non-actionable. Business load is concentrated on a small group.'
        WHEN noise_ratio > 50 THEN 'Significant noise present. Focus on high-engagement contacts.'
        ELSE 'Healthy signal-to-noise ratio. Network is well-balanced.'
      END
  );
  
  -- Build inner_circle (separate query with same CTEs)
  WITH contact_analysis AS (
    SELECT
      from_address as email,
      split_part(from_address, '@', 2) as sender_domain,
      COUNT(*) FILTER (WHERE folder = 'inbox') as inbound_count,
      COUNT(*) FILTER (WHERE folder = 'sentitems') as outbound_count,
      MAX(received_date) as last_activity_at,
      (COUNT(*) FILTER (WHERE folder = 'inbox') > 0 AND 
       COUNT(*) FILTER (WHERE folder = 'sentitems') > 0) as bidirectional,
      split_part(from_address, '@', 2) = ANY(business_domains) as is_internal,
      (
        from_address ILIKE '%noreply%' OR
        from_address ILIKE '%newsletter%' OR
        from_address ILIKE '%marketing%' OR
        from_address ILIKE '%support%' OR
        from_address ILIKE '%notification%' OR
        (COUNT(*) FILTER (WHERE folder = 'inbox') >= 5 AND 
         COUNT(*) FILTER (WHERE folder = 'sentitems') = 0)
      ) as matches_noise_pattern
    FROM outlook_emails
    WHERE user_id = target_user_id
      AND received_date > NOW() - (analysis_window_days || ' days')::INTERVAL
      AND from_address IS NOT NULL
      AND from_address != ''
    GROUP BY from_address
  ),
  classified_contacts AS (
    SELECT
      email,
      inbound_count,
      outbound_count,
      last_activity_at,
      CASE
        WHEN is_internal THEN 'INTERNAL'
        WHEN matches_noise_pattern AND NOT bidirectional THEN 'NOISE'
        WHEN bidirectional AND NOT is_internal THEN 'EXTERNAL_SIGNAL'
        ELSE 'UNKNOWN'
      END as classification,
      CASE
        WHEN bidirectional AND NOT is_internal THEN
          CASE
            WHEN (inbound_count + outbound_count) >= 20 THEN 'High'
            WHEN (inbound_count + outbound_count) >= 8 THEN 'Medium'
            ELSE 'Low'
          END
        ELSE NULL
      END as engagement_tier
    FROM contact_analysis
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'email', email,
      'engagement', engagement_tier,
      'volume', inbound_count + outbound_count,
      'confidence', 
        CASE
          WHEN engagement_tier = 'High' THEN 'High'
          WHEN engagement_tier = 'Medium' THEN 'Medium'
          ELSE 'Low'
        END,
      'classification_reason', 'Bidirectional communication over analysis window',
      'last_activity', last_activity_at
    )
    ORDER BY (inbound_count + outbound_count) DESC
  )
  INTO inner_circle
  FROM classified_contacts
  WHERE classification = 'EXTERNAL_SIGNAL'
  LIMIT 20;
  
  -- Build workload metrics
  SELECT jsonb_build_object(
    'email_volume', COUNT(*)::INT,
    'meeting_hours', 0
  )
  INTO workload
  FROM outlook_emails
  WHERE user_id = target_user_id
    AND received_date > NOW() - (analysis_window_days || ' days')::INTERVAL;
  
  -- Assemble final vitals
  vitals := jsonb_build_object(
    'network_health', network_health,
    'inner_circle', COALESCE(inner_circle, '[]'::jsonb),
    'workload', workload,
    'analysis_window_days', analysis_window_days,
    'generated_at', NOW()
  );
  
  RETURN vitals;
END;
$$;

-- 008_calibration_schedules.sql
-- CALIBRATION SCHEDULE TABLE
-- Post-induction monitoring schedule (structure only, no execution logic)

CREATE TABLE IF NOT EXISTS public.calibration_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to business profile
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    
    -- Schedule status
    schedule_status TEXT NOT NULL DEFAULT 'active' CHECK (schedule_status IN ('active', 'paused', 'cancelled')),
    
    -- Feature flags
    weekly_pulse_enabled BOOLEAN NOT NULL DEFAULT true,
    quarterly_calibration_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_weekly_due_at TIMESTAMPTZ NOT NULL,
    next_quarterly_due_at TIMESTAMPTZ NOT NULL,
    
    -- Execution tracking (for future use)
    last_weekly_completed_at TIMESTAMPTZ,
    last_quarterly_completed_at TIMESTAMPTZ,
    weekly_completion_count INT DEFAULT 0,
    quarterly_completion_count INT DEFAULT 0,
    
    -- Deduplication
    CONSTRAINT unique_schedule_per_profile UNIQUE (business_profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calibration_user ON public.calibration_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_calibration_account ON public.calibration_schedules(account_id);
CREATE INDEX IF NOT EXISTS idx_calibration_status ON public.calibration_schedules(schedule_status);
CREATE INDEX IF NOT EXISTS idx_calibration_weekly_due ON public.calibration_schedules(next_weekly_due_at) WHERE schedule_status = 'active';
CREATE INDEX IF NOT EXISTS idx_calibration_quarterly_due ON public.calibration_schedules(next_quarterly_due_at) WHERE schedule_status = 'active';

-- RLS
ALTER TABLE public.calibration_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own schedules" ON public.calibration_schedules;
CREATE POLICY "Users can read own schedules" ON public.calibration_schedules FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access" ON public.calibration_schedules;
CREATE POLICY "Service role full access" ON public.calibration_schedules FOR ALL
    USING (true) WITH CHECK (true);

COMMENT ON TABLE public.calibration_schedules IS 'Post-induction monitoring schedule - structure only, execution logic separate';

-- 009_calibration_system.sql
-- BIQC CALIBRATION SYSTEM SCHEMA
-- Replaces legacy onboarding - Strategic partner calibration approach

-- 1. STRATEGY PROFILES (AI-Generated Drafts + Raw Inputs)
CREATE TABLE IF NOT EXISTS public.strategy_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    
    -- Raw User Inputs (source: user)
    raw_mission_input TEXT,
    raw_vision_input TEXT,
    short_term_goals_raw TEXT,
    long_term_goals_raw TEXT,
    main_challenges_raw TEXT,
    growth_strategy_raw TEXT,
    
    -- AI-Generated Drafts (source: ai_generated, regenerable)
    mission_statement TEXT,
    vision_statement TEXT,
    short_term_goals TEXT,
    long_term_goals TEXT,
    primary_challenges TEXT,
    growth_strategy TEXT,
    
    -- Regeneration tracking
    regeneration_version INT DEFAULT 1,
    last_generated_at TIMESTAMPTZ,
    
    -- Status
    calibration_status TEXT DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_strategy_profile UNIQUE (business_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_strategy_user ON public.strategy_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_account ON public.strategy_profiles(account_id);

ALTER TABLE public.strategy_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own strategy" ON public.strategy_profiles;
CREATE POLICY "Users read own strategy" ON public.strategy_profiles FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access" ON public.strategy_profiles;
CREATE POLICY "Service role full access" ON public.strategy_profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. CALIBRATION SESSIONS (Audit Trail)
CREATE TABLE IF NOT EXISTS public.calibration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Session metadata
    calibration_version INT DEFAULT 1,
    session_type TEXT DEFAULT 'initial', -- initial | recalibration | update
    
    -- Completion
    questions_answered INT DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_sessions_user ON public.calibration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_profile ON public.calibration_sessions(business_profile_id);

ALTER TABLE public.calibration_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own calibration sessions" ON public.calibration_sessions;
CREATE POLICY "Users read own calibration sessions" ON public.calibration_sessions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access" ON public.calibration_sessions;
CREATE POLICY "Service role full access" ON public.calibration_sessions FOR ALL USING (true) WITH CHECK (true);

-- 3. 15-WEEK SCHEDULE SCAFFOLD
CREATE TABLE IF NOT EXISTS public.working_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    
    -- Schedule metadata
    schedule_type TEXT DEFAULT '15_week_scaffold',
    week_number INT NOT NULL CHECK (week_number >= 1 AND week_number <= 15),
    
    -- Week content (initially empty placeholders)
    focus_area TEXT,
    planned_activities JSONB DEFAULT '[]'::jsonb,
    milestones JSONB DEFAULT '[]'::jsonb,
    
    -- Progress tracking
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'deferred')),
    completion_percentage INT DEFAULT 0,
    
    -- Timestamps
    week_start_date DATE,
    week_end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_week_per_profile UNIQUE (business_profile_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_schedule_profile ON public.working_schedules(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_schedule_week ON public.working_schedules(week_number);

ALTER TABLE public.working_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own schedules" ON public.working_schedules;
CREATE POLICY "Users read own schedules" ON public.working_schedules FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access" ON public.working_schedules;
CREATE POLICY "Service role full access" ON public.working_schedules FOR ALL USING (true) WITH CHECK (true);

-- 4. INTELLIGENCE PRIORITY HIERARCHY
CREATE TABLE IF NOT EXISTS public.intelligence_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Priority configuration
    priority_rank INT NOT NULL CHECK (priority_rank >= 1 AND priority_rank <= 10),
    signal_category TEXT NOT NULL, -- revenue_sales | team_capacity | delivery_ops | strategy_drift
    
    -- Configuration
    enabled BOOLEAN DEFAULT true,
    threshold_sensitivity TEXT DEFAULT 'medium' CHECK (threshold_sensitivity IN ('low', 'medium', 'high')),
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_priority_per_profile UNIQUE (business_profile_id, signal_category)
);

CREATE INDEX IF NOT EXISTS idx_intelligence_priority_profile ON public.intelligence_priorities(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_priority_rank ON public.intelligence_priorities(priority_rank);

ALTER TABLE public.intelligence_priorities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own priorities" ON public.intelligence_priorities;
CREATE POLICY "Users read own priorities" ON public.intelligence_priorities FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access" ON public.intelligence_priorities;
CREATE POLICY "Service role full access" ON public.intelligence_priorities FOR ALL USING (true) WITH CHECK (true);

-- 5. PROGRESS TRACKING CADENCE
CREATE TABLE IF NOT EXISTS public.progress_cadence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    business_profile_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Cadence configuration
    frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    next_check_in_date TIMESTAMPTZ,
    
    -- Tracking markers
    confidence_markers JSONB DEFAULT '[]'::jsonb,
    friction_markers JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    status TEXT DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_check_in_at TIMESTAMPTZ,
    
    CONSTRAINT unique_cadence_per_profile UNIQUE (business_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_cadence_profile ON public.progress_cadence(business_profile_id);

ALTER TABLE public.progress_cadence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own cadence" ON public.progress_cadence;
CREATE POLICY "Users read own cadence" ON public.progress_cadence FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access" ON public.progress_cadence;
CREATE POLICY "Service role full access" ON public.progress_cadence FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.strategy_profiles IS 'Strategic calibration data - raw inputs + AI-generated drafts';
COMMENT ON TABLE public.calibration_sessions IS 'Calibration session audit trail';
COMMENT ON TABLE public.working_schedules IS '15-week schedule scaffold created post-calibration';
COMMENT ON TABLE public.intelligence_priorities IS 'Signal priority hierarchy per business';
COMMENT ON TABLE public.progress_cadence IS 'Weekly/monthly progress tracking configuration';

-- 010_fact_resolution_ledger.sql
-- BIQC Fact Resolution Ledger Schema
-- Run this in Supabase SQL Editor to create a dedicated fact resolution table.
-- Currently, facts are stored in user_operator_profile.operator_profile.fact_ledger (JSONB).
-- This table is for future migration to a normalized schema when needed.

CREATE TABLE IF NOT EXISTS fact_resolution_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    fact_key TEXT NOT NULL,
    fact_value JSONB,
    source TEXT DEFAULT 'user_confirmed',
    confidence NUMERIC DEFAULT 1.0,
    confirmed BOOLEAN DEFAULT FALSE,
    first_seen_at TIMESTAMPTZ DEFAULT now(),
    last_verified_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, fact_key)
);

-- Enable RLS
ALTER TABLE fact_resolution_ledger ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own facts
DROP POLICY IF EXISTS "Users can view own facts" ON fact_resolution_ledger;
CREATE POLICY "Users can view own facts" ON fact_resolution_ledger
    FOR SELECT USING (auth.uid() = user_id);

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access" ON fact_resolution_ledger;
CREATE POLICY "Service role full access" ON fact_resolution_ledger
    FOR ALL USING (auth.role() = 'service_role');

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_fact_ledger_user ON fact_resolution_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_ledger_key ON fact_resolution_ledger(user_id, fact_key);

-- 011_system_prompts_table.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQC SYSTEM PROMPTS TABLE — Phase 2 Migration Target
-- Run this in Supabase SQL Editor to create the table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_key TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL DEFAULT '1.0',
  agent TEXT NOT NULL,
  description TEXT,
  source_file TEXT,
  source_function TEXT,
  source_lines TEXT,
  dynamic_variables JSONB DEFAULT '[]'::jsonb,
  raw_content TEXT NOT NULL,
  system_message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS prompt_key TEXT;
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0';
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS agent TEXT DEFAULT 'system';
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS source_function TEXT;
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS source_lines TEXT;
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS dynamic_variables JSONB DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS raw_content TEXT;
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS system_message TEXT;
ALTER TABLE IF EXISTS system_prompts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_system_prompts_key ON system_prompts(prompt_key);
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS agent TEXT DEFAULT 'system';
CREATE INDEX IF NOT EXISTS idx_system_prompts_agent ON system_prompts(agent);
CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(is_active);

COMMENT ON TABLE system_prompts IS 'Central registry of all AI system prompts. Extracted from hardcoded strings in server.py and helper files. Enables A/B testing, versioning, and hot-swapping without redeployment.';

-- 012_prompt_audit_logs.sql
-- Prompt Audit Logs — tracks every prompt edit for compliance and rollback
CREATE TABLE IF NOT EXISTS prompt_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_key TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'update',
  old_version TEXT,
  new_version TEXT,
  old_content_preview TEXT,
  new_content_preview TEXT,
  changed_by TEXT,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_audit_key ON prompt_audit_logs(prompt_key);
CREATE INDEX IF NOT EXISTS idx_prompt_audit_time ON prompt_audit_logs(changed_at DESC);

-- 001_user_operator_profile.sql
-- Migration: Create user_operator_profile table for Persona Calibration
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_operator_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  agent_persona JSONB DEFAULT NULL,
  agent_instructions TEXT DEFAULT NULL,
  persona_calibration_status TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (persona_calibration_status IN ('incomplete', 'in_progress', 'complete')),
  current_step INT NOT NULL DEFAULT 0,
  prev_response_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Row Level Security
ALTER TABLE user_operator_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON user_operator_profile;
CREATE POLICY "Users can read own profile" ON user_operator_profile FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_operator_profile;
CREATE POLICY "Users can insert own profile" ON user_operator_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_operator_profile;
CREATE POLICY "Users can update own profile" ON user_operator_profile FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypass for Edge Functions
DROP POLICY IF EXISTS "Service role full access" ON user_operator_profile;
CREATE POLICY "Service role full access" ON user_operator_profile FOR ALL
  USING (auth.role() = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_uop_user_id ON user_operator_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_uop_status ON user_operator_profile(persona_calibration_status);

-- 013_edge_function_warmup.sql
-- BIQc Edge Function Keepalive — Prevent Cold Starts
-- Run this in Supabase SQL Editor
-- Pings critical Edge Functions every 4 minutes to keep them warm

-- Enable extensions if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Warmup ping every 4 minutes (keeps functions from sleeping)
SELECT cron.schedule(
  'edge-function-warmup',
  '*/4 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/biqc-insights-cognitive',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"warmup": true}'::jsonb
  );
  $$
);

-- 014_calibration_schedules.sql
-- Calibration Schedules — Recalibration + Video Check-In tracking
CREATE TABLE IF NOT EXISTS calibration_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    type TEXT NOT NULL, -- recalibration | video_checkin | recalibration_dismissed
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending', -- pending | completed | dismissed | cancelled
    notes TEXT,
    completed_at TIMESTAMPTZ,
    postponed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cal_sched_user ON calibration_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_cal_sched_status ON calibration_schedules(user_id, status);

-- 015_compute_market_risk_weight.sql
-- compute_market_risk_weight: Deterministic risk weighting for BIQc Action Plan
-- Called by biqc-insights-cognitive Edge Function before LLM synthesis
-- Prevents pure-AI drift by anchoring risk signals in deterministic logic

CREATE OR REPLACE FUNCTION compute_market_risk_weight(
  contradiction_count INT DEFAULT 0,
  runway_months INT DEFAULT 24,
  sla_breaches INT DEFAULT 0,
  pipeline_declining BOOLEAN DEFAULT FALSE,
  competitor_pressure_rising BOOLEAN DEFAULT FALSE,
  system_state TEXT DEFAULT 'STABLE',
  velocity TEXT DEFAULT 'stable'
)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'misalignment_boost', CASE WHEN contradiction_count > 2 THEN 15 ELSE CASE WHEN contradiction_count > 0 THEN 5 ELSE 0 END END,
    'risk_amplification', CASE WHEN runway_months < 3 THEN 'CRITICAL' WHEN runway_months < 6 THEN 'ELEVATED' WHEN runway_months < 12 THEN 'MODERATE' ELSE 'NORMAL' END,
    'operational_risk', CASE WHEN sla_breaches > 5 THEN 'CRITICAL' WHEN sla_breaches > 3 THEN 'HIGH' WHEN sla_breaches > 0 THEN 'MODERATE' ELSE 'STABLE' END,
    'urgency', CASE WHEN system_state = 'CRITICAL' THEN 'IMMEDIATE' WHEN system_state = 'DRIFT' AND velocity = 'worsening' THEN 'HIGH' WHEN system_state = 'DRIFT' THEN 'MODERATE' WHEN system_state = 'COMPRESSION' THEN 'HIGH' ELSE 'LOW' END,
    'compression_probability', CASE WHEN pipeline_declining AND competitor_pressure_rising THEN 25 WHEN pipeline_declining THEN 10 WHEN competitor_pressure_rising THEN 10 ELSE 0 END,
    'overall_risk_weight', CASE
      WHEN system_state = 'CRITICAL' THEN 90
      WHEN (system_state = 'DRIFT' AND velocity = 'worsening') OR runway_months < 6 THEN 75
      WHEN system_state = 'DRIFT' OR sla_breaches > 3 OR contradiction_count > 2 THEN 55
      WHEN system_state = 'COMPRESSION' THEN 65
      ELSE 30
    END
  );
END;
$$ LANGUAGE plpgsql;

-- 016_detect_contradictions.sql
-- ═══════════════════════════════════════════════════════════════
-- detect_contradictions(user_id) — SQL Function
-- Replaces: backend/contradiction_engine.py (251 lines Python)
-- Purpose: Detect misalignment between declared intent and observed behaviour
-- Called by: biqc-insights-cognitive Edge Function via RPC
-- Writes to: contradiction_memory table
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION detect_contradictions(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_contradictions JSON[];
  v_result JSON;
  v_count INT := 0;
  v_priority_record RECORD;
  v_escalation_record RECORD;
  v_action_record RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_contradictions := ARRAY[]::JSON[];

  -- ═══ CHECK 1: Priority Mismatch ═══
  -- User says domain X is priority but no action taken in 14+ days
  FOR v_priority_record IN
    SELECT dp.domain, dp.pressure_level, dp.window_days,
           COALESCE(
             (SELECT MAX(oe.observed_at) FROM observation_events oe
              WHERE oe.user_id = p_user_id AND oe.domain = dp.domain
              AND oe.observed_at > v_now - INTERVAL '14 days'),
             v_now - INTERVAL '30 days'
           ) AS last_activity
    FROM decision_pressure dp
    WHERE dp.user_id = p_user_id AND dp.active = true
      AND dp.pressure_level IN ('high', 'critical')
  LOOP
    IF v_priority_record.last_activity < v_now - INTERVAL '14 days' THEN
      v_contradictions := array_append(v_contradictions, json_build_object(
        'type', 'priority_mismatch',
        'domain', v_priority_record.domain,
        'observed_state', 'No action in ' || EXTRACT(DAY FROM v_now - v_priority_record.last_activity)::INT || ' days',
        'expected_state', v_priority_record.pressure_level || ' priority — should have action within ' || v_priority_record.window_days || ' days',
        'severity', CASE WHEN v_priority_record.pressure_level = 'critical' THEN 'high' ELSE 'medium' END,
        'times_detected', 1
      ));
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- ═══ CHECK 2: Repeated Ignore ═══
  -- Risk raised 3+ times but no resolution action taken
  FOR v_escalation_record IN
    SELECT em.domain, em.position, em.times_detected, em.pressure_level
    FROM escalation_memory em
    WHERE em.user_id = p_user_id AND em.active = true
      AND em.times_detected >= 3
      AND em.last_action_at IS NULL
  LOOP
    v_contradictions := array_append(v_contradictions, json_build_object(
      'type', 'repeated_ignore',
      'domain', v_escalation_record.domain,
      'observed_state', 'Risk raised ' || v_escalation_record.times_detected || ' times — no action taken',
      'expected_state', 'Acknowledged or resolved after first escalation',
      'severity', CASE WHEN v_escalation_record.times_detected >= 5 THEN 'high' ELSE 'medium' END,
      'times_detected', v_escalation_record.times_detected
    ));
    v_count := v_count + 1;
  END LOOP;

  -- ═══ CHECK 3: Action-Inaction Gap ═══
  -- User completed calibration declaring growth intent but pipeline is declining
  FOR v_action_record IN
    SELECT
      bp.growth_strategy,
      (SELECT COUNT(*) FROM observation_events oe
       WHERE oe.user_id = p_user_id AND oe.signal_name = 'pipeline_decay'
       AND oe.observed_at > v_now - INTERVAL '30 days') AS decay_signals
    FROM business_profiles bp
    WHERE bp.user_id = p_user_id
      AND bp.growth_strategy IS NOT NULL
      AND bp.growth_strategy != ''
    LIMIT 1
  LOOP
    IF v_action_record.decay_signals > 0 THEN
      v_contradictions := array_append(v_contradictions, json_build_object(
        'type', 'action_inaction',
        'domain', 'revenue',
        'observed_state', 'Pipeline declining — ' || v_action_record.decay_signals || ' decay signals in 30 days',
        'expected_state', 'Growth strategy declared: ' || LEFT(v_action_record.growth_strategy, 100),
        'severity', CASE WHEN v_action_record.decay_signals >= 3 THEN 'high' ELSE 'medium' END,
        'times_detected', v_action_record.decay_signals
      ));
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- ═══ PERSIST active contradictions ═══
  IF v_count > 0 THEN
    FOR i IN 1..array_length(v_contradictions, 1) LOOP
      INSERT INTO contradiction_memory (
        id, user_id, domain, observed_state, expected_state, times_detected, active, detected_at
      )
      VALUES (
        gen_random_uuid(),
        p_user_id,
        (v_contradictions[i]->>'domain'),
        (v_contradictions[i]->>'observed_state'),
        (v_contradictions[i]->>'expected_state'),
        COALESCE((v_contradictions[i]->>'times_detected')::INT, 1),
        true,
        v_now
      )
      ON CONFLICT (user_id, domain) WHERE active = true
      DO UPDATE SET
        observed_state = EXCLUDED.observed_state,
        expected_state = EXCLUDED.expected_state,
        times_detected = contradiction_memory.times_detected + 1,
        detected_at = v_now;
    END LOOP;
  END IF;

  v_result := json_build_object(
    'contradiction_count', v_count,
    'contradictions', to_json(v_contradictions),
    'checked_at', v_now::TEXT,
    'checks_performed', json_build_array('priority_mismatch', 'repeated_ignore', 'action_inaction')
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 017_calibrate_pressure.sql
-- ═══════════════════════════════════════════════════════════════
-- calibrate_pressure(user_id) — SQL Function
-- Replaces: backend/pressure_calibration.py (300 lines Python)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE decision_pressure ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_pressure' AND policyname = 'Service role full access on decision_pressure') THEN
    DROP POLICY IF EXISTS "Service role full access on decision_pressure" ON decision_pressure;
CREATE POLICY "Service role full access on decision_pressure" ON decision_pressure FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_pressure' AND policyname = 'Users read own decision_pressure') THEN
    DROP POLICY IF EXISTS "Users read own decision_pressure" ON decision_pressure;
CREATE POLICY "Users read own decision_pressure" ON decision_pressure FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION calibrate_pressure(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_domain TEXT;
  v_domains TEXT[] := ARRAY['finance', 'sales', 'operations', 'team', 'market'];
  v_results JSON[];
  v_score INT;
  v_target_level TEXT;
  v_current RECORD;
  v_position TEXT;
  v_esc_times INT;
  v_esc_action TEXT;
  v_contra_count INT;
  v_risk_posture TEXT;
  v_now TIMESTAMPTZ := now();
  v_window_days INT;
  v_changes INT := 0;
BEGIN
  v_results := ARRAY[]::JSON[];
  SELECT COALESCE((operator_profile->>'risk_posture'),(operator_profile->'forensic_calibration'->>'risk_profile'),'moderate') INTO v_risk_posture FROM user_operator_profile WHERE user_id = p_user_id;
  v_risk_posture := LOWER(COALESCE(v_risk_posture, 'moderate'));

  FOREACH v_domain IN ARRAY v_domains LOOP
    v_score := 0;
    SELECT position INTO v_position FROM watchtower_insights WHERE user_id = p_user_id AND domain = v_domain ORDER BY detected_at DESC LIMIT 1;
    v_position := COALESCE(v_position, 'STABLE');
    v_score := v_score + CASE v_position WHEN 'ELEVATED' THEN 1 WHEN 'DETERIORATING' THEN 2 WHEN 'CRITICAL' THEN 3 ELSE 0 END;

    SELECT COALESCE(times_detected, 0), COALESCE(last_user_action, 'unknown') INTO v_esc_times, v_esc_action FROM escalation_memory WHERE user_id = p_user_id AND domain = v_domain AND active = true LIMIT 1;
    v_esc_times := COALESCE(v_esc_times, 0); v_esc_action := COALESCE(v_esc_action, 'unknown');
    IF v_esc_times >= 5 THEN v_score := v_score + 2; ELSIF v_esc_times >= 3 THEN v_score := v_score + 1; END IF;
    IF v_esc_action IN ('ignored', 'deferred') THEN v_score := v_score + 1; END IF;

    SELECT COUNT(*) INTO v_contra_count FROM contradiction_memory WHERE user_id = p_user_id AND domain = v_domain AND active = true;
    IF v_contra_count >= 3 THEN v_score := v_score + 2; ELSIF v_contra_count >= 1 THEN v_score := v_score + 1; END IF;

    IF v_risk_posture IN ('aggressive', 'high') THEN v_score := GREATEST(v_score - 1, 0); END IF;

    v_target_level := CASE WHEN v_score >= 6 THEN 'CRITICAL' WHEN v_score >= 4 THEN 'HIGH' WHEN v_score >= 2 THEN 'MODERATE' ELSE 'LOW' END;
    v_window_days := CASE v_target_level WHEN 'CRITICAL' THEN 3 WHEN 'HIGH' THEN 7 WHEN 'MODERATE' THEN 14 ELSE NULL END;

    SELECT * INTO v_current FROM decision_pressure WHERE user_id = p_user_id AND domain = v_domain AND active = true LIMIT 1;

    IF v_position = 'STABLE' AND v_current.id IS NOT NULL THEN
      UPDATE decision_pressure SET active = false, last_updated_at = v_now WHERE id = v_current.id;
      v_results := array_append(v_results, json_build_object('domain', v_domain, 'action', 'decayed', 'from', v_current.pressure_level, 'to', 'INACTIVE'));
      v_changes := v_changes + 1; CONTINUE;
    END IF;

    IF v_target_level = 'LOW' AND v_current.id IS NULL THEN CONTINUE; END IF;

    IF v_current.id IS NOT NULL THEN
      DECLARE
        v_current_idx INT := array_position(ARRAY['LOW','MODERATE','HIGH','CRITICAL'], v_current.pressure_level);
        v_target_idx INT := array_position(ARRAY['LOW','MODERATE','HIGH','CRITICAL'], v_target_level);
      BEGIN
        IF v_target_idx <= v_current_idx THEN CONTINUE; END IF;
        UPDATE decision_pressure SET pressure_level = v_target_level,
          window_days = CASE WHEN v_current.window_days IS NOT NULL AND v_current.window_days < v_window_days THEN v_current.window_days ELSE v_window_days END,
          last_updated_at = v_now,
          basis = COALESCE(v_current.basis, '{}'::JSONB) || jsonb_build_object('updated_at', v_now::TEXT, 'from', v_current.pressure_level, 'to', v_target_level, 'score', v_score)
        WHERE id = v_current.id;
        v_results := array_append(v_results, json_build_object('domain', v_domain, 'action', 'increased', 'from', v_current.pressure_level, 'to', v_target_level, 'score', v_score));
        v_changes := v_changes + 1;
      END;
    ELSE
      IF v_target_level != 'LOW' THEN
        INSERT INTO decision_pressure (id, user_id, domain, pressure_level, window_days, first_applied_at, last_updated_at, basis, active)
        VALUES (gen_random_uuid(), p_user_id, v_domain, v_target_level, v_window_days, v_now, v_now, jsonb_build_object('created_at', v_now::TEXT, 'initial_score', v_score, 'position', v_position), true);
        v_results := array_append(v_results, json_build_object('domain', v_domain, 'action', 'created', 'level', v_target_level, 'score', v_score));
        v_changes := v_changes + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object('changes', v_changes, 'results', to_json(v_results), 'calibrated_at', v_now::TEXT, 'risk_posture', v_risk_posture, 'domains_checked', array_length(v_domains, 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 018_decay_evidence.sql
-- ═══════════════════════════════════════════════════════════════
-- decay_evidence(user_id) — SQL Function
-- Replaces: backend/evidence_freshness.py (279 lines Python)
-- Purpose: Confidence decay when evidence becomes stale
-- Reads: evidence_freshness, observation_events
-- Writes: evidence_freshness
--
-- States: FRESH (<48h) → AGING (48-168h) → STALE (>168h/7d)
-- Decay rate: 0.002 confidence units per hour while AGING
-- STALE: confidence halved (floor 0.05)
-- FRESH: confidence restored to watchtower level
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE evidence_freshness ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evidence_freshness' AND policyname = 'Service role full access on evidence_freshness') THEN
    DROP POLICY IF EXISTS "Service role full access on evidence_freshness" ON evidence_freshness;
CREATE POLICY "Service role full access on evidence_freshness" ON evidence_freshness FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evidence_freshness' AND policyname = 'Users read own evidence_freshness') THEN
    DROP POLICY IF EXISTS "Users read own evidence_freshness" ON evidence_freshness;
CREATE POLICY "Users read own evidence_freshness" ON evidence_freshness FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION decay_evidence(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_domain TEXT;
  v_domains TEXT[] := ARRAY['finance', 'sales', 'operations', 'team', 'market'];
  v_results JSON[];
  v_changes INT := 0;
  v_now TIMESTAMPTZ := now();
  v_latest_evidence TIMESTAMPTZ;
  v_hours_since NUMERIC;
  v_new_state TEXT;
  v_new_confidence NUMERIC;
  v_existing RECORD;
  v_wt_confidence NUMERIC;
  v_decay_rate NUMERIC := 0.002;
  v_aging_threshold NUMERIC := 48;
  v_stale_threshold NUMERIC := 168;
BEGIN
  v_results := ARRAY[]::JSON[];

  FOREACH v_domain IN ARRAY v_domains LOOP
    -- Find latest evidence (observation event) for this domain
    SELECT MAX(observed_at) INTO v_latest_evidence
    FROM observation_events
    WHERE user_id = p_user_id AND domain = v_domain
      AND observed_at > v_now - INTERVAL '30 days';

    -- If no evidence at all, use 30 days ago as baseline
    v_latest_evidence := COALESCE(v_latest_evidence, v_now - INTERVAL '30 days');

    v_hours_since := EXTRACT(EPOCH FROM (v_now - v_latest_evidence)) / 3600.0;

    -- Get watchtower confidence for this domain
    SELECT COALESCE(confidence, 0.5) INTO v_wt_confidence
    FROM watchtower_insights
    WHERE user_id = p_user_id AND domain = v_domain
    ORDER BY detected_at DESC LIMIT 1;

    v_wt_confidence := COALESCE(v_wt_confidence, 0.5);

    -- Determine state and confidence
    IF v_hours_since < v_aging_threshold THEN
      v_new_state := 'FRESH';
      v_new_confidence := v_wt_confidence;
    ELSIF v_hours_since < v_stale_threshold THEN
      v_new_state := 'AGING';
      v_new_confidence := GREATEST(v_wt_confidence - ((v_hours_since - v_aging_threshold) * v_decay_rate), 0.1);
    ELSE
      v_new_state := 'STALE';
      v_new_confidence := GREATEST(v_wt_confidence * 0.5, 0.05);
    END IF;

    v_new_confidence := ROUND(LEAST(GREATEST(v_new_confidence, 0.0), 1.0)::NUMERIC, 3);

    -- Get existing record
    SELECT * INTO v_existing
    FROM evidence_freshness
    WHERE user_id = p_user_id AND domain = v_domain AND active = true
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
      -- Check if anything changed
      IF v_existing.confidence_state = v_new_state AND ABS(v_existing.current_confidence - v_new_confidence) < 0.005 THEN
        CONTINUE; -- No change
      END IF;

      UPDATE evidence_freshness SET
        current_confidence = v_new_confidence,
        confidence_state = v_new_state,
        last_evidence_at = v_latest_evidence,
        decay_rate = v_decay_rate
      WHERE id = v_existing.id;

      v_results := array_append(v_results, json_build_object(
        'domain', v_domain,
        'action', 'updated',
        'from_state', v_existing.confidence_state,
        'to_state', v_new_state,
        'from_confidence', v_existing.current_confidence,
        'to_confidence', v_new_confidence,
        'hours_since_evidence', ROUND(v_hours_since::NUMERIC, 1)
      ));
      v_changes := v_changes + 1;
    ELSE
      -- Create new record
      INSERT INTO evidence_freshness (id, user_id, domain, current_confidence, last_evidence_at, decay_rate, confidence_state, active)
      VALUES (gen_random_uuid(), p_user_id, v_domain, v_new_confidence, v_latest_evidence, v_decay_rate, v_new_state, true);

      v_results := array_append(v_results, json_build_object(
        'domain', v_domain,
        'action', 'created',
        'state', v_new_state,
        'confidence', v_new_confidence,
        'hours_since_evidence', ROUND(v_hours_since::NUMERIC, 1)
      ));
      v_changes := v_changes + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'changes', v_changes,
    'results', to_json(v_results),
    'checked_at', v_now::TEXT,
    'thresholds', json_build_object('aging_hours', v_aging_threshold, 'stale_hours', v_stale_threshold, 'decay_rate_per_hour', v_decay_rate)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 019_update_escalation.sql
-- ═══════════════════════════════════════════════════════════════
-- update_escalation(user_id) — SQL Function
-- Replaces: backend/escalation_memory.py (186 lines Python)
-- Purpose: Track risk persistence, recurrence, and user action
-- Reads: watchtower_insights, escalation_memory
-- Writes: escalation_memory
--
-- Called by biqc-insights-cognitive AFTER detect_contradictions
-- and BEFORE calibrate_pressure (pressure depends on escalation data)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE escalation_memory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escalation_memory' AND policyname = 'Service role full access on escalation_memory') THEN
    DROP POLICY IF EXISTS "Service role full access on escalation_memory" ON escalation_memory;
CREATE POLICY "Service role full access on escalation_memory" ON escalation_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escalation_memory' AND policyname = 'Users read own escalation_memory') THEN
    DROP POLICY IF EXISTS "Users read own escalation_memory" ON escalation_memory;
CREATE POLICY "Users read own escalation_memory" ON escalation_memory FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_escalation(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_domain TEXT;
  v_domains TEXT[] := ARRAY['finance', 'sales', 'operations', 'team', 'market'];
  v_results JSON[];
  v_changes INT := 0;
  v_now TIMESTAMPTZ := now();
  v_position TEXT;
  v_existing RECORD;
BEGIN
  v_results := ARRAY[]::JSON[];

  FOREACH v_domain IN ARRAY v_domains LOOP
    -- Get latest watchtower position
    SELECT position INTO v_position
    FROM watchtower_insights
    WHERE user_id = p_user_id AND domain = v_domain
    ORDER BY detected_at DESC LIMIT 1;

    v_position := COALESCE(v_position, 'STABLE');

    -- Get active escalation for this domain
    SELECT * INTO v_existing
    FROM escalation_memory
    WHERE user_id = p_user_id AND domain = v_domain AND active = true
    LIMIT 1;

    IF v_position = 'STABLE' THEN
      -- Recovery: mark escalation resolved
      IF v_existing.id IS NOT NULL THEN
        UPDATE escalation_memory SET
          active = false,
          resolved_at = v_now,
          position = 'STABLE'
        WHERE id = v_existing.id;

        v_results := array_append(v_results, json_build_object(
          'domain', v_domain, 'action', 'resolved',
          'was_position', v_existing.position,
          'times_detected', v_existing.times_detected
        ));
        v_changes := v_changes + 1;
      END IF;
    ELSE
      -- Elevated position: create or increment escalation
      IF v_existing.id IS NOT NULL THEN
        UPDATE escalation_memory SET
          position = v_position,
          last_detected_at = v_now,
          times_detected = COALESCE(v_existing.times_detected, 0) + 1,
          pressure_level = CASE
            WHEN COALESCE(v_existing.times_detected, 0) >= 4 THEN 'critical'
            WHEN COALESCE(v_existing.times_detected, 0) >= 2 THEN 'high'
            ELSE 'medium'
          END
        WHERE id = v_existing.id;

        v_results := array_append(v_results, json_build_object(
          'domain', v_domain, 'action', 'incremented',
          'position', v_position,
          'times_detected', COALESCE(v_existing.times_detected, 0) + 1,
          'has_contradiction', v_existing.has_contradiction
        ));
        v_changes := v_changes + 1;
      ELSE
        INSERT INTO escalation_memory (
          id, user_id, domain, position, first_detected_at, last_detected_at,
          times_detected, last_user_action, pressure_level, active
        ) VALUES (
          gen_random_uuid(), p_user_id, v_domain, v_position, v_now, v_now,
          1, 'unknown', 'medium', true
        );

        v_results := array_append(v_results, json_build_object(
          'domain', v_domain, 'action', 'created',
          'position', v_position,
          'times_detected', 1
        ));
        v_changes := v_changes + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'changes', v_changes,
    'results', to_json(v_results),
    'updated_at', v_now::TEXT,
    'domains_checked', array_length(v_domains, 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 020_insight_outcomes.sql
-- ═══════════════════════════════════════════════════════════════
-- INSIGHT OUTCOMES — Prediction Tracking Table
-- Phase 1: Instrumentation Only (no automated evaluation)
--
-- Purpose:
--   Store every prediction generated by biqc-insights-cognitive
--   Track timeframe, confidence, expected impact, metric source
--   Allow manual evaluation after 30-60 days of observation
--
-- Deploy: Run this SQL in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Create insight_outcomes table
create table if not exists public.insight_outcomes (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  snapshot_id uuid references public.intelligence_snapshots(id) on delete cascade,

  prediction_type text not null, -- risk | growth | alignment | financial

  predicted_outcome text not null,

  predicted_timeframe_days integer not null,

  predicted_impact_low numeric,
  predicted_impact_high numeric,

  prediction_confidence numeric not null check (prediction_confidence >= 0 and prediction_confidence <= 100),

  metric_source text, -- crm | accounting | email | market | internal

  metric_reference text, -- e.g. pipeline_value, revenue_monthly, churn_rate

  action_required text,
  action_completed boolean default false,

  predicted_created_at timestamptz default now(),

  actual_outcome_metric numeric,
  actual_outcome_date timestamptz,

  outcome_delta numeric,
  accuracy_score numeric,

  evaluation_status text default 'pending', -- pending | evaluated | expired_no_data

  created_at timestamptz default now()
);

-- 2. Indexes for fast lookup
create index if not exists idx_insight_outcomes_user on public.insight_outcomes(user_id);
create index if not exists idx_insight_outcomes_snapshot on public.insight_outcomes(snapshot_id);
create index if not exists idx_insight_outcomes_status on public.insight_outcomes(evaluation_status);
create index if not exists idx_insight_outcomes_type on public.insight_outcomes(prediction_type);

-- 3. Add snapshot_confidence to intelligence_snapshots (feedback loop anchor)
alter table public.intelligence_snapshots
add column if not exists snapshot_confidence numeric;

-- 4. RLS policies
alter table public.insight_outcomes enable row level security;

create policy "Users can view own outcomes"
  on public.insight_outcomes for select
  using (auth.uid() = user_id);

create policy "Service role can insert outcomes"
  on public.insight_outcomes for insert
  with check (true);

create policy "Service role can update outcomes"
  on public.insight_outcomes for update
  using (true);

-- 021_trust_reconstruction.sql
-- ═══════════════════════════════════════════════════════════════
-- TRUST RECONSTRUCTION MIGRATION
-- BIQc Governance & Integration Truth Tables
-- 
-- Run in Supabase SQL Editor in this exact order.
-- ═══════════════════════════════════════════════════════════════

-- 1. Workspace Integrations — Single source of truth for integration status
CREATE TABLE IF NOT EXISTS workspace_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    integration_type TEXT NOT NULL CHECK (integration_type IN ('crm', 'accounting', 'marketing', 'email')),
    status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected')),
    connected_at TIMESTAMP,
    last_sync_at TIMESTAMP,
    UNIQUE(workspace_id, integration_type)
);

-- 2. Governance Events — Only source for audit log entries
CREATE TABLE IF NOT EXISTS governance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    source_system TEXT NOT NULL CHECK (source_system IN ('crm', 'accounting', 'marketing', 'scrape', 'manual')),
    signal_reference TEXT,
    signal_timestamp TIMESTAMP NOT NULL,
    confidence_score NUMERIC CHECK (confidence_score BETWEEN 0 AND 1),
    created_at TIMESTAMP DEFAULT now()
);

-- 3. Report Exports — Audit trail for all generated reports
CREATE TABLE IF NOT EXISTS report_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    report_type TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    generated_at TIMESTAMP DEFAULT now(),
    data_snapshot JSONB NOT NULL
);

-- 4. Business DNA Provenance — Add source tracking to business_profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'source_map') THEN
        ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS source_map JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'confidence_map') THEN
        ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS confidence_map JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'timestamp_map') THEN
        ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS timestamp_map JSONB;
    END IF;
END $$;

-- 5. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_governance_events_workspace ON governance_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_events_type ON governance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_workspace ON workspace_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_workspace ON report_exports(workspace_id);

-- 6. RLS Policies
ALTER TABLE workspace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own workspace data
DROP POLICY IF EXISTS "Users read own workspace_integrations" ON workspace_integrations;
CREATE POLICY "Users read own workspace_integrations" ON workspace_integrations
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users read own governance_events" ON governance_events;
CREATE POLICY "Users read own governance_events" ON governance_events
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users read own report_exports" ON report_exports;
CREATE POLICY "Users read own report_exports" ON report_exports
    FOR SELECT USING (true);

-- Service role can insert/update
DROP POLICY IF EXISTS "Service role manages workspace_integrations" ON workspace_integrations;
CREATE POLICY "Service role manages workspace_integrations" ON workspace_integrations
    FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role manages governance_events" ON governance_events;
CREATE POLICY "Service role manages governance_events" ON governance_events
    FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role manages report_exports" ON report_exports;
CREATE POLICY "Service role manages report_exports" ON report_exports
    FOR ALL USING (true) WITH CHECK (true);

-- 022_intelligence_modules.sql
-- ═══════════════════════════════════════════════════════════════
-- INTELLIGENCE MODULES — SQL Functions & Views
-- BIQc Workforce, Growth/Scenario, Weighted Scoring
--
-- Run in Supabase SQL Editor after 021_trust_reconstruction.sql
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- 1. WORKFORCE INTELLIGENCE
-- Computes capacity, fatigue, and key-person dependency from
-- connected email/calendar integration data
-- ═══════════════════════════════════════════════════════════════

-- Workforce health assessment function
CREATE OR REPLACE FUNCTION compute_workforce_health(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_email BOOLEAN := FALSE;
    v_email_events INT := 0;
    v_calendar_events INT := 0;
    v_capacity_index NUMERIC := 0;
    v_fatigue_level TEXT := 'unknown';
    v_pending_decisions INT := 0;
    v_result JSONB;
BEGIN
    -- Check if email integration is connected
    SELECT EXISTS(
        SELECT 1 FROM workspace_integrations
        WHERE workspace_id = p_workspace_id
        AND integration_type = 'email'
        AND status = 'connected'
    ) INTO v_has_email;

    IF NOT v_has_email THEN
        RETURN jsonb_build_object(
            'status', 'no_email_integration',
            'message', 'Connect email and calendar to unlock workforce intelligence.',
            'has_data', false
        );
    END IF;

    -- Count email-related governance events (last 30 days)
    SELECT COUNT(*) INTO v_email_events
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'email'
    AND signal_timestamp > NOW() - INTERVAL '30 days';

    -- Count calendar/meeting events
    SELECT COUNT(*) INTO v_calendar_events
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND (event_type ILIKE '%calendar%' OR event_type ILIKE '%meeting%')
    AND signal_timestamp > NOW() - INTERVAL '7 days';

    -- Compute capacity index (0-150 scale)
    -- Based on event density: high events = high utilisation
    v_capacity_index := LEAST(
        ROUND((v_email_events::NUMERIC / GREATEST(30, 1)) * 100 + (v_calendar_events::NUMERIC / GREATEST(5, 1)) * 50),
        150
    );

    -- Determine fatigue level
    v_fatigue_level := CASE
        WHEN v_capacity_index > 120 THEN 'high'
        WHEN v_capacity_index > 80 THEN 'medium'
        ELSE 'low'
    END;

    -- Count pending decision events
    SELECT COUNT(*) INTO v_pending_decisions
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND event_type ILIKE '%decision%'
    AND signal_timestamp > NOW() - INTERVAL '7 days';

    v_result := jsonb_build_object(
        'status', 'computed',
        'has_data', true,
        'capacity_index', v_capacity_index,
        'fatigue_level', v_fatigue_level,
        'pending_decisions', v_pending_decisions,
        'email_events_30d', v_email_events,
        'calendar_events_7d', v_calendar_events,
        'computed_at', NOW()
    );

    RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 2. GROWTH / SCENARIO PLANNING
-- Computes best/base/worst case from CRM deal data
-- ═══════════════════════════════════════════════════════════════

-- Scenario modeling function
CREATE OR REPLACE FUNCTION compute_revenue_scenarios(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_crm BOOLEAN := FALSE;
    v_total_pipeline NUMERIC := 0;
    v_best_case NUMERIC := 0;
    v_base_case NUMERIC := 0;
    v_worst_case NUMERIC := 0;
    v_deal_count INT := 0;
    v_won_count INT := 0;
    v_lost_count INT := 0;
    v_stalled_count INT := 0;
    v_high_prob_value NUMERIC := 0;
    v_med_prob_value NUMERIC := 0;
    v_low_prob_value NUMERIC := 0;
    v_top_client_pct NUMERIC := 0;
    v_unique_clients INT := 0;
    v_result JSONB;
BEGIN
    -- Check if CRM integration is connected
    SELECT EXISTS(
        SELECT 1 FROM workspace_integrations
        WHERE workspace_id = p_workspace_id
        AND integration_type = 'crm'
        AND status = 'connected'
    ) INTO v_has_crm;

    IF NOT v_has_crm THEN
        RETURN jsonb_build_object(
            'status', 'no_crm_integration',
            'message', 'Connect CRM to unlock revenue scenario modeling.',
            'has_data', false
        );
    END IF;

    -- Count CRM-sourced revenue events
    SELECT COUNT(*) INTO v_deal_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'crm'
    AND event_type ILIKE '%deal%';

    -- Count won/lost from events
    SELECT COUNT(*) INTO v_won_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'crm'
    AND event_type ILIKE '%won%';

    SELECT COUNT(*) INTO v_lost_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'crm'
    AND event_type ILIKE '%lost%';

    -- If no deal events, return empty but connected state
    IF v_deal_count = 0 THEN
        RETURN jsonb_build_object(
            'status', 'connected_no_deals',
            'message', 'CRM connected but no deal events recorded yet. Deals will appear after sync.',
            'has_data', false,
            'crm_connected', true
        );
    END IF;

    -- Compute win rate
    v_result := jsonb_build_object(
        'status', 'computed',
        'has_data', true,
        'deal_count', v_deal_count,
        'won_count', v_won_count,
        'lost_count', v_lost_count,
        'win_rate', CASE WHEN v_deal_count > 0 THEN ROUND((v_won_count::NUMERIC / v_deal_count) * 100) ELSE 0 END,
        'computed_at', NOW()
    );

    RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 3. WEIGHTED INSIGHT SCORING
-- Computes a weighted score for each intelligence domain
-- Score = (severity_weight * alert_count) + metric_bonus + detail_bonus
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_insight_scores(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_domain TEXT;
    v_scores JSONB := '{}'::JSONB;
    v_domain_events INT;
    v_high_count INT;
    v_med_count INT;
    v_low_count INT;
    v_avg_confidence NUMERIC;
    v_score NUMERIC;
BEGIN
    -- Compute scores for each domain
    FOR v_domain IN SELECT UNNEST(ARRAY['crm', 'accounting', 'marketing', 'email', 'scrape'])
    LOOP
        -- Count events by severity proxy (confidence score)
        SELECT
            COUNT(*) FILTER (WHERE confidence_score >= 0.8),
            COUNT(*) FILTER (WHERE confidence_score >= 0.5 AND confidence_score < 0.8),
            COUNT(*) FILTER (WHERE confidence_score < 0.5),
            COUNT(*),
            COALESCE(AVG(confidence_score), 0)
        INTO v_high_count, v_med_count, v_low_count, v_domain_events, v_avg_confidence
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND source_system = v_domain
        AND signal_timestamp > NOW() - INTERVAL '30 days';

        -- Weighted score formula
        -- severity_weight: high=3, medium=2, low=1
        -- Plus confidence bonus
        v_score := (v_high_count * 3) + (v_med_count * 2) + (v_low_count * 1);

        -- Add metric bonus (events density)
        IF v_domain_events > 10 THEN v_score := v_score + 15;
        ELSIF v_domain_events > 5 THEN v_score := v_score + 10;
        ELSIF v_domain_events > 0 THEN v_score := v_score + 5;
        END IF;

        -- Add confidence bonus
        IF v_avg_confidence > 0.7 THEN v_score := v_score + 10;
        ELSIF v_avg_confidence > 0.4 THEN v_score := v_score + 5;
        END IF;

        -- Cap at 100
        v_score := LEAST(v_score, 100);

        v_scores := v_scores || jsonb_build_object(
            v_domain, jsonb_build_object(
                'score', v_score,
                'events', v_domain_events,
                'high_severity', v_high_count,
                'med_severity', v_med_count,
                'low_severity', v_low_count,
                'avg_confidence', ROUND(v_avg_confidence, 2)
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'scores', v_scores,
        'computed_at', NOW(),
        'workspace_id', p_workspace_id
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 4. INTEGRATION STATUS VIEW
-- Quick lookup for frontend to determine what's connected
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_integration_status AS
SELECT
    workspace_id,
    jsonb_object_agg(integration_type, status) AS integrations,
    jsonb_object_agg(integration_type, last_sync_at) AS last_syncs,
    COUNT(*) FILTER (WHERE status = 'connected') AS connected_count,
    COUNT(*) AS total_count
FROM workspace_integrations
GROUP BY workspace_id;


-- ═══════════════════════════════════════════════════════════════
-- 5. GOVERNANCE EVENTS SUMMARY VIEW
-- Aggregated view for reports and dashboards
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_governance_summary AS
SELECT
    workspace_id,
    source_system,
    COUNT(*) AS event_count,
    COUNT(*) FILTER (WHERE confidence_score >= 0.8) AS high_confidence,
    COUNT(*) FILTER (WHERE confidence_score >= 0.5 AND confidence_score < 0.8) AS medium_confidence,
    COUNT(*) FILTER (WHERE confidence_score < 0.5) AS low_confidence,
    ROUND(AVG(confidence_score), 2) AS avg_confidence,
    MAX(signal_timestamp) AS latest_signal,
    MIN(signal_timestamp) AS earliest_signal
FROM governance_events
WHERE signal_timestamp > NOW() - INTERVAL '30 days'
GROUP BY workspace_id, source_system;


-- ═══════════════════════════════════════════════════════════════
-- 6. CONCENTRATION RISK FUNCTION
-- Computes revenue concentration from CRM deal events
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_concentration_risk(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_crm BOOLEAN := FALSE;
    v_event_count INT := 0;
    v_result JSONB;
BEGIN
    -- Check CRM connection
    SELECT EXISTS(
        SELECT 1 FROM workspace_integrations
        WHERE workspace_id = p_workspace_id
        AND integration_type = 'crm'
        AND status = 'connected'
    ) INTO v_has_crm;

    IF NOT v_has_crm THEN
        RETURN jsonb_build_object(
            'status', 'no_crm_integration',
            'has_data', false
        );
    END IF;

    -- Count deal-related events with signal references (client identifiers)
    SELECT COUNT(DISTINCT signal_reference) INTO v_event_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'crm'
    AND signal_reference IS NOT NULL;

    RETURN jsonb_build_object(
        'status', 'computed',
        'has_data', v_event_count > 0,
        'unique_references', v_event_count,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 7. GRANTS — Allow authenticated users to call functions
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION compute_workforce_health(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_revenue_scenarios(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_insight_scores(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_concentration_risk(UUID) TO authenticated;
GRANT SELECT ON v_integration_status TO authenticated;
GRANT SELECT ON v_governance_summary TO authenticated;

-- 023_complete_intelligence_sql.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc COMPLETE INTELLIGENCE SQL LAYER
-- Migration: 023_complete_intelligence_sql.sql
--
-- Contains:
--   10 SQL Functions (deterministic intelligence)
--   5 Database Triggers (auto-fire on data changes)
--   4 pg_cron Jobs (scheduled intelligence)
--   3 Views (pre-computed dashboards)
--   2 Webhook-ready functions (event-driven)
--
-- Run in Supabase SQL Editor after 022_intelligence_modules.sql
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 1: CONTRADICTION DETECTION
-- Detects priority mismatches, action-inaction gaps, repeated ignores
-- Replaces: contradiction_engine.py
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION detect_contradictions(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contradictions JSONB := '[]'::JSONB;
    v_high_events RECORD;
    v_ignored_count INT;
    v_acted_count INT;
BEGIN
    -- 1. Priority Mismatch: High-severity events with no action taken
    FOR v_high_events IN
        SELECT event_type, source_system, signal_timestamp, confidence_score
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND confidence_score >= 0.7
        AND signal_timestamp > NOW() - INTERVAL '14 days'
        AND id NOT IN (
            SELECT DISTINCT signal_reference::UUID
            FROM governance_events
            WHERE workspace_id = p_workspace_id
            AND event_type ILIKE '%action%'
            AND signal_reference IS NOT NULL
        )
        ORDER BY confidence_score DESC
        LIMIT 5
    LOOP
        v_contradictions := v_contradictions || jsonb_build_object(
            'type', 'priority_mismatch',
            'domain', v_high_events.source_system,
            'detail', format('High-confidence %s signal from %s detected %s ago with no recorded action.',
                v_high_events.event_type,
                v_high_events.source_system,
                EXTRACT(DAY FROM NOW() - v_high_events.signal_timestamp) || ' days'
            ),
            'severity', 'high',
            'detected_at', NOW()
        );
    END LOOP;

    -- 2. Repeated Ignore: Same event type appearing 3+ times without action
    SELECT COUNT(*) INTO v_ignored_count
    FROM (
        SELECT event_type, COUNT(*) as cnt
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND signal_timestamp > NOW() - INTERVAL '30 days'
        GROUP BY event_type
        HAVING COUNT(*) >= 3
    ) repeated;

    IF v_ignored_count > 0 THEN
        v_contradictions := v_contradictions || jsonb_build_object(
            'type', 'repeated_ignore',
            'detail', format('%s signal types have appeared 3+ times in 30 days without resolution.', v_ignored_count),
            'severity', 'medium',
            'detected_at', NOW()
        );
    END IF;

    -- 3. Action-Inaction Gap: Integrations connected but no events flowing
    SELECT COUNT(*) INTO v_acted_count
    FROM workspace_integrations
    WHERE workspace_id = p_workspace_id
    AND status = 'connected'
    AND integration_type NOT IN (
        SELECT DISTINCT source_system
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND signal_timestamp > NOW() - INTERVAL '7 days'
    );

    IF v_acted_count > 0 THEN
        v_contradictions := v_contradictions || jsonb_build_object(
            'type', 'silent_integration',
            'detail', format('%s integration(s) connected but producing no events in 7 days. Check sync status.', v_acted_count),
            'severity', 'medium',
            'detected_at', NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'contradictions', v_contradictions,
        'count', jsonb_array_length(v_contradictions),
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 2: PRESSURE CALIBRATION
-- Calculates pressure levels across domains
-- Replaces: pressure_calibration.py
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_pressure_levels(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_domain TEXT;
    v_pressures JSONB := '{}'::JSONB;
    v_event_count INT;
    v_high_count INT;
    v_avg_conf NUMERIC;
    v_pressure_level TEXT;
    v_pressure_score NUMERIC;
BEGIN
    FOR v_domain IN SELECT UNNEST(ARRAY['crm', 'accounting', 'marketing', 'email'])
    LOOP
        SELECT
            COUNT(*),
            COUNT(*) FILTER (WHERE confidence_score >= 0.7),
            COALESCE(AVG(confidence_score), 0)
        INTO v_event_count, v_high_count, v_avg_conf
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND source_system = v_domain
        AND signal_timestamp > NOW() - INTERVAL '14 days';

        -- Pressure score: high events weight more, recency matters
        v_pressure_score := (v_high_count * 3.0) + (v_event_count * 0.5);

        v_pressure_level := CASE
            WHEN v_pressure_score >= 15 THEN 'critical'
            WHEN v_pressure_score >= 8 THEN 'elevated'
            WHEN v_pressure_score >= 3 THEN 'moderate'
            WHEN v_pressure_score > 0 THEN 'low'
            ELSE 'none'
        END;

        v_pressures := v_pressures || jsonb_build_object(
            v_domain, jsonb_build_object(
                'level', v_pressure_level,
                'score', ROUND(v_pressure_score, 1),
                'events_14d', v_event_count,
                'high_severity', v_high_count,
                'avg_confidence', ROUND(v_avg_conf, 2)
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'pressures', v_pressures,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 3: EVIDENCE FRESHNESS & DECAY
-- Tracks signal age, applies decay scoring
-- Replaces: evidence_freshness.py
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_evidence_freshness(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_domain TEXT;
    v_freshness JSONB := '{}'::JSONB;
    v_latest TIMESTAMP;
    v_hours_old NUMERIC;
    v_decay_factor NUMERIC;
    v_status TEXT;
BEGIN
    FOR v_domain IN SELECT UNNEST(ARRAY['crm', 'accounting', 'marketing', 'email', 'scrape'])
    LOOP
        SELECT MAX(signal_timestamp) INTO v_latest
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND source_system = v_domain;

        IF v_latest IS NULL THEN
            v_freshness := v_freshness || jsonb_build_object(
                v_domain, jsonb_build_object(
                    'status', 'no_data',
                    'hours_old', NULL,
                    'decay_factor', 0,
                    'last_signal', NULL
                )
            );
            CONTINUE;
        END IF;

        v_hours_old := EXTRACT(EPOCH FROM (NOW() - v_latest)) / 3600.0;

        -- Decay formula: exponential decay over 168 hours (7 days)
        -- 1.0 at 0 hours, ~0.5 at 72 hours, ~0.1 at 168 hours
        v_decay_factor := ROUND(EXP(-0.014 * v_hours_old)::NUMERIC, 3);

        v_status := CASE
            WHEN v_hours_old < 24 THEN 'fresh'
            WHEN v_hours_old < 72 THEN 'recent'
            WHEN v_hours_old < 168 THEN 'aging'
            ELSE 'stale'
        END;

        v_freshness := v_freshness || jsonb_build_object(
            v_domain, jsonb_build_object(
                'status', v_status,
                'hours_old', ROUND(v_hours_old, 1),
                'decay_factor', v_decay_factor,
                'last_signal', v_latest
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'freshness', v_freshness,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 4: SILENCE DETECTION
-- Detects when critical signals have no user engagement
-- Replaces: silence_detection.py
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION detect_silence(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_last_login TIMESTAMP;
    v_days_silent NUMERIC;
    v_unactioned_high INT;
    v_unactioned_total INT;
    v_silence_level TEXT;
    v_interventions JSONB := '[]'::JSONB;
BEGIN
    -- Check last activity (approximated by last governance event creation)
    SELECT MAX(created_at) INTO v_last_login
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND event_type ILIKE '%action%';

    v_days_silent := CASE
        WHEN v_last_login IS NULL THEN 999
        ELSE EXTRACT(DAY FROM NOW() - v_last_login)
    END;

    -- Count unactioned high-severity events
    SELECT COUNT(*) INTO v_unactioned_high
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND confidence_score >= 0.7
    AND signal_timestamp > NOW() - INTERVAL '14 days';

    SELECT COUNT(*) INTO v_unactioned_total
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND signal_timestamp > NOW() - INTERVAL '7 days';

    v_silence_level := CASE
        WHEN v_days_silent > 14 THEN 'critical'
        WHEN v_days_silent > 7 THEN 'warning'
        WHEN v_days_silent > 3 THEN 'mild'
        ELSE 'active'
    END;

    -- Generate interventions
    IF v_days_silent > 7 AND v_unactioned_high > 0 THEN
        v_interventions := v_interventions || jsonb_build_object(
            'type', 'high_severity_unactioned',
            'message', format('%s high-confidence signals require attention. Last activity %s days ago.', v_unactioned_high, ROUND(v_days_silent)),
            'urgency', 'high'
        );
    END IF;

    IF v_days_silent > 14 THEN
        v_interventions := v_interventions || jsonb_build_object(
            'type', 'extended_absence',
            'message', format('No platform activity detected in %s days. Intelligence may be stale.', ROUND(v_days_silent)),
            'urgency', 'critical'
        );
    END IF;

    RETURN jsonb_build_object(
        'silence_level', v_silence_level,
        'days_silent', ROUND(v_days_silent, 1),
        'unactioned_high', v_unactioned_high,
        'unactioned_total', v_unactioned_total,
        'interventions', v_interventions,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 5: ESCALATION MEMORY
-- Tracks escalation history and patterns
-- Replaces: escalation_memory.py
-- ═══════════════════════════════════════════════════════════════

-- Escalation tracking table
CREATE TABLE IF NOT EXISTS escalation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    domain TEXT NOT NULL,
    position TEXT NOT NULL,
    escalated_at TIMESTAMP DEFAULT NOW(),
    recovered_at TIMESTAMP,
    exposure_count INT DEFAULT 1,
    user_actions JSONB DEFAULT '[]'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_escalation_workspace ON escalation_history(workspace_id);

CREATE OR REPLACE FUNCTION get_escalation_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active INT;
    v_recovered INT;
    v_avg_duration NUMERIC;
    v_domains JSONB;
BEGIN
    SELECT COUNT(*) FILTER (WHERE recovered_at IS NULL),
           COUNT(*) FILTER (WHERE recovered_at IS NOT NULL)
    INTO v_active, v_recovered
    FROM escalation_history
    WHERE workspace_id = p_workspace_id;

    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(recovered_at, NOW()) - escalated_at)) / 86400), 0)
    INTO v_avg_duration
    FROM escalation_history
    WHERE workspace_id = p_workspace_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'domain', domain,
        'position', position,
        'escalated_at', escalated_at,
        'days_active', EXTRACT(DAY FROM NOW() - escalated_at),
        'exposure_count', exposure_count
    )), '[]'::JSONB) INTO v_domains
    FROM escalation_history
    WHERE workspace_id = p_workspace_id
    AND recovered_at IS NULL
    ORDER BY escalated_at DESC
    LIMIT 10;

    RETURN jsonb_build_object(
        'active_escalations', v_active,
        'recovered', v_recovered,
        'avg_duration_days', ROUND(v_avg_duration, 1),
        'active_details', v_domains,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 6: MERGE EMISSION → GOVERNANCE EVENTS BRIDGE
-- Converts integration sync data into governance events
-- Replaces: merge_emission_layer.py (event creation part)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION emit_governance_event(
    p_workspace_id UUID,
    p_event_type TEXT,
    p_source_system TEXT,
    p_signal_reference TEXT DEFAULT NULL,
    p_confidence_score NUMERIC DEFAULT 0.5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO governance_events (
        workspace_id, event_type, source_system,
        signal_reference, signal_timestamp, confidence_score
    ) VALUES (
        p_workspace_id, p_event_type, p_source_system,
        p_signal_reference, NOW(), p_confidence_score
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 7: SNAPSHOT SUMMARY BUILDER
-- Aggregates all intelligence into a single summary
-- Replaces: snapshot_agent.py (_build_summary)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION build_intelligence_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workforce JSONB;
    v_scenarios JSONB;
    v_scores JSONB;
    v_pressure JSONB;
    v_freshness JSONB;
    v_contradictions JSONB;
    v_silence JSONB;
    v_escalations JSONB;
    v_completeness JSONB;
    v_readiness JSONB;
    v_overall_health TEXT;
    v_overall_score NUMERIC := 0;
    v_connected_count INT := 0;
BEGIN
    -- Call all sub-functions
    v_workforce := compute_workforce_health(p_workspace_id);
    v_scenarios := compute_revenue_scenarios(p_workspace_id);
    v_scores := compute_insight_scores(p_workspace_id);
    v_pressure := compute_pressure_levels(p_workspace_id);
    v_freshness := compute_evidence_freshness(p_workspace_id);
    v_contradictions := detect_contradictions(p_workspace_id);
    v_silence := detect_silence(p_workspace_id);
    v_escalations := get_escalation_summary(p_workspace_id);
    v_completeness := compute_profile_completeness(p_workspace_id);
    v_readiness := compute_data_readiness(p_workspace_id);

    -- Compute overall health
    SELECT COUNT(*) INTO v_connected_count
    FROM workspace_integrations
    WHERE workspace_id = p_workspace_id AND status = 'connected';

    v_overall_score := (v_connected_count * 15)
        + CASE WHEN (v_contradictions->>'count')::INT = 0 THEN 20 ELSE 0 END
        + CASE WHEN v_silence->>'silence_level' = 'active' THEN 20 ELSE 0 END
        + COALESCE((v_completeness->>'completeness_pct')::NUMERIC * 0.2, 0)
        + COALESCE((v_readiness->>'readiness_pct')::NUMERIC * 0.1, 0);

    v_overall_health := CASE
        WHEN v_overall_score >= 80 THEN 'excellent'
        WHEN v_overall_score >= 60 THEN 'good'
        WHEN v_overall_score >= 40 THEN 'developing'
        WHEN v_overall_score >= 20 THEN 'needs_attention'
        ELSE 'critical'
    END;

    RETURN jsonb_build_object(
        'workspace_id', p_workspace_id,
        'overall_health', v_overall_health,
        'overall_score', ROUND(v_overall_score),
        'modules', jsonb_build_object(
            'workforce', v_workforce,
            'scenarios', v_scenarios,
            'scores', v_scores,
            'pressure', v_pressure,
            'freshness', v_freshness,
            'contradictions', v_contradictions,
            'silence', v_silence,
            'escalations', v_escalations,
            'completeness', v_completeness,
            'readiness', v_readiness
        ),
        'connected_integrations', v_connected_count,
        'generated_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 8: BUSINESS PROFILE COMPLETENESS SCORE
-- Replaces: Python completeness calculation
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_profile_completeness(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_total_fields INT := 0;
    v_filled_fields INT := 0;
    v_sourced_fields INT := 0;
    v_pct NUMERIC;
BEGIN
    SELECT * INTO v_profile
    FROM business_profiles
    WHERE user_id = p_workspace_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'no_profile',
            'completeness_pct', 0,
            'filled_fields', 0,
            'total_fields', 0,
            'has_source_map', false
        );
    END IF;

    -- Count key fields
    v_total_fields := 12;
    IF v_profile.business_name IS NOT NULL AND v_profile.business_name != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.industry IS NOT NULL AND v_profile.industry != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.website IS NOT NULL AND v_profile.website != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.location IS NOT NULL AND v_profile.location != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.abn IS NOT NULL AND v_profile.abn != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.target_market IS NOT NULL AND v_profile.target_market != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.mission IS NOT NULL AND v_profile.mission != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.vision IS NOT NULL AND v_profile.vision != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.short_term_goals IS NOT NULL AND v_profile.short_term_goals != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.long_term_goals IS NOT NULL AND v_profile.long_term_goals != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.products_services IS NOT NULL AND v_profile.products_services != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.competitive_advantage IS NOT NULL AND v_profile.competitive_advantage != '' THEN v_filled_fields := v_filled_fields + 1; END IF;

    -- Check source_map coverage
    IF v_profile.source_map IS NOT NULL THEN
        SELECT COUNT(*) INTO v_sourced_fields
        FROM jsonb_object_keys(v_profile.source_map);
    END IF;

    v_pct := ROUND((v_filled_fields::NUMERIC / v_total_fields) * 100);

    RETURN jsonb_build_object(
        'completeness_pct', v_pct,
        'filled_fields', v_filled_fields,
        'total_fields', v_total_fields,
        'sourced_fields', v_sourced_fields,
        'has_source_map', v_profile.source_map IS NOT NULL,
        'status', CASE
            WHEN v_pct >= 80 THEN 'strong'
            WHEN v_pct >= 50 THEN 'developing'
            WHEN v_pct >= 25 THEN 'minimal'
            ELSE 'empty'
        END
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 9: DATA READINESS SCORE
-- How ready is the workspace for intelligence
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_data_readiness(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_integration_count INT := 0;
    v_event_count INT := 0;
    v_profile_pct NUMERIC := 0;
    v_has_snapshot BOOLEAN := FALSE;
    v_readiness_pct NUMERIC := 0;
    v_checklist JSONB := '[]'::JSONB;
BEGIN
    -- 1. Integration count
    SELECT COUNT(*) INTO v_integration_count
    FROM workspace_integrations
    WHERE workspace_id = p_workspace_id AND status = 'connected';

    -- 2. Event count (last 30 days)
    SELECT COUNT(*) INTO v_event_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND signal_timestamp > NOW() - INTERVAL '30 days';

    -- 3. Profile completeness
    SELECT COALESCE((compute_profile_completeness(p_workspace_id)->>'completeness_pct')::NUMERIC, 0)
    INTO v_profile_pct;

    -- 4. Has intelligence snapshot
    SELECT EXISTS(
        SELECT 1 FROM intelligence_snapshots
        WHERE user_id = p_workspace_id
        LIMIT 1
    ) INTO v_has_snapshot;

    -- Build checklist
    IF v_integration_count = 0 THEN
        v_checklist := v_checklist || '"Connect at least one integration (CRM, accounting, or email)"'::JSONB;
    END IF;
    IF v_profile_pct < 50 THEN
        v_checklist := v_checklist || '"Complete your Business DNA profile (at least 50%)"'::JSONB;
    END IF;
    IF v_event_count = 0 AND v_integration_count > 0 THEN
        v_checklist := v_checklist || '"Wait for integration sync to generate governance events"'::JSONB;
    END IF;
    IF NOT v_has_snapshot THEN
        v_checklist := v_checklist || '"Generate your first intelligence snapshot"'::JSONB;
    END IF;

    -- Readiness score
    v_readiness_pct := LEAST(
        (v_integration_count * 20) +
        (CASE WHEN v_event_count > 10 THEN 30 WHEN v_event_count > 0 THEN 15 ELSE 0 END) +
        (v_profile_pct * 0.3) +
        (CASE WHEN v_has_snapshot THEN 20 ELSE 0 END),
        100
    );

    RETURN jsonb_build_object(
        'readiness_pct', ROUND(v_readiness_pct),
        'integration_count', v_integration_count,
        'event_count_30d', v_event_count,
        'profile_completeness', v_profile_pct,
        'has_snapshot', v_has_snapshot,
        'checklist', v_checklist,
        'status', CASE
            WHEN v_readiness_pct >= 80 THEN 'ready'
            WHEN v_readiness_pct >= 50 THEN 'developing'
            WHEN v_readiness_pct >= 20 THEN 'initial'
            ELSE 'not_started'
        END
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 10: WATCHTOWER POSITIONS
-- Domain-level position tracking (stable/drift/compression/critical)
-- Replaces: watchtower_engine.py (_compute_position)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_watchtower_positions(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_domain TEXT;
    v_positions JSONB := '{}'::JSONB;
    v_event_count INT;
    v_high_count INT;
    v_recent_count INT;
    v_freshness NUMERIC;
    v_position TEXT;
    v_velocity TEXT;
BEGIN
    FOR v_domain IN SELECT UNNEST(ARRAY['crm', 'accounting', 'marketing', 'email', 'scrape'])
    LOOP
        -- Total events (30 days)
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE confidence_score >= 0.7),
               COUNT(*) FILTER (WHERE signal_timestamp > NOW() - INTERVAL '3 days')
        INTO v_event_count, v_high_count, v_recent_count
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND source_system = v_domain
        AND signal_timestamp > NOW() - INTERVAL '30 days';

        -- Determine position
        v_position := CASE
            WHEN v_high_count >= 5 THEN 'CRITICAL'
            WHEN v_high_count >= 3 OR (v_event_count >= 10 AND v_high_count >= 2) THEN 'COMPRESSION'
            WHEN v_event_count >= 5 AND v_high_count >= 1 THEN 'DRIFT'
            WHEN v_event_count > 0 THEN 'STABLE'
            ELSE 'NO_DATA'
        END;

        -- Determine velocity (comparing recent vs older events)
        v_velocity := CASE
            WHEN v_recent_count > (v_event_count * 0.5) THEN 'accelerating'
            WHEN v_recent_count > (v_event_count * 0.2) THEN 'stable'
            WHEN v_event_count > 0 THEN 'decelerating'
            ELSE 'inactive'
        END;

        IF v_event_count > 0 THEN
            v_positions := v_positions || jsonb_build_object(
                v_domain, jsonb_build_object(
                    'position', v_position,
                    'velocity', v_velocity,
                    'events_30d', v_event_count,
                    'high_severity', v_high_count,
                    'recent_3d', v_recent_count
                )
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'positions', v_positions,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- DATABASE TRIGGERS — Auto-fire on data changes
-- ═══════════════════════════════════════════════════════════════

-- Trigger 1: Auto-update last_sync_at when new governance event arrives
CREATE OR REPLACE FUNCTION trigger_update_integration_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE workspace_integrations
    SET last_sync_at = NOW()
    WHERE workspace_id = NEW.workspace_id
    AND integration_type = NEW.source_system
    AND status = 'connected';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_governance_event_sync ON governance_events;
CREATE OR REPLACE TRIGGER trg_governance_event_sync
    AFTER INSERT ON governance_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_integration_sync();


-- Trigger 2: Auto-log integration status changes
CREATE OR REPLACE FUNCTION trigger_log_integration_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        INSERT INTO governance_events (
            workspace_id, event_type, source_system,
            signal_reference, signal_timestamp, confidence_score
        ) VALUES (
            NEW.workspace_id,
            CASE WHEN NEW.status = 'connected' THEN 'integration_connected' ELSE 'integration_disconnected' END,
            NEW.integration_type,
            NEW.id::TEXT,
            NOW(),
            1.0
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_integration_status_change ON workspace_integrations;
CREATE OR REPLACE TRIGGER trg_integration_status_change
    AFTER INSERT OR UPDATE ON workspace_integrations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_integration_change();


-- Trigger 3: Auto-record report exports as governance events
CREATE OR REPLACE FUNCTION trigger_log_report_export()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO governance_events (
        workspace_id, event_type, source_system,
        signal_reference, signal_timestamp, confidence_score
    ) VALUES (
        NEW.workspace_id,
        'report_generated',
        'manual',
        NEW.id::TEXT,
        NOW(),
        1.0
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_export_log ON report_exports;
CREATE OR REPLACE TRIGGER trg_report_export_log
    AFTER INSERT ON report_exports
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_report_export();


-- ═══════════════════════════════════════════════════════════════
-- pg_cron JOBS — Scheduled intelligence
-- (Uncomment after enabling pg_cron extension in Supabase)
-- ═══════════════════════════════════════════════════════════════

-- NOTE: pg_cron must be enabled in Supabase Dashboard > Database > Extensions
-- Then uncomment the following:

-- Job 1: Evidence freshness decay check (every 6 hours)
-- SELECT cron.schedule('evidence-freshness', '0 */6 * * *',
--     $$SELECT compute_evidence_freshness(workspace_id) FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w$$
-- );

-- Job 2: Silence detection (daily at 8am UTC)
-- SELECT cron.schedule('silence-detection', '0 8 * * *',
--     $$SELECT detect_silence(workspace_id) FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w$$
-- );

-- Job 3: Contradiction detection (every 12 hours)
-- SELECT cron.schedule('contradiction-check', '0 */12 * * *',
--     $$SELECT detect_contradictions(workspace_id) FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w$$
-- );

-- Job 4: Full intelligence summary rebuild (daily at 2am UTC)
-- SELECT cron.schedule('daily-summary', '0 2 * * *',
--     $$SELECT build_intelligence_summary(workspace_id) FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w$$
-- );


-- ═══════════════════════════════════════════════════════════════
-- GRANTS — Allow authenticated users to call all functions
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION detect_contradictions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_pressure_levels(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_evidence_freshness(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_silence(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_escalation_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION emit_governance_event(UUID, TEXT, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION build_intelligence_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_profile_completeness(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_data_readiness(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_watchtower_positions(UUID) TO authenticated;

-- Escalation history RLS
ALTER TABLE escalation_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own escalation_history" ON escalation_history;
CREATE POLICY "Users read own escalation_history" ON escalation_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service manages escalation_history" ON escalation_history;
CREATE POLICY "Service manages escalation_history" ON escalation_history FOR ALL USING (true) WITH CHECK (true);

-- 024_sql_hotfix.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc SQL HOTFIX — Run after 023_complete_intelligence_sql.sql
-- Fixes: get_escalation_summary GROUP BY error
--        build_intelligence_summary downstream call
-- ═══════════════════════════════════════════════════════════════

-- FIX 1: get_escalation_summary — fix ORDER BY with jsonb_agg
CREATE OR REPLACE FUNCTION get_escalation_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active INT;
    v_recovered INT;
    v_avg_duration NUMERIC;
    v_domains JSONB;
BEGIN
    SELECT COUNT(*) FILTER (WHERE recovered_at IS NULL),
           COUNT(*) FILTER (WHERE recovered_at IS NOT NULL)
    INTO v_active, v_recovered
    FROM escalation_history
    WHERE workspace_id = p_workspace_id;

    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(recovered_at, NOW()) - escalated_at)) / 86400), 0)
    INTO v_avg_duration
    FROM escalation_history
    WHERE workspace_id = p_workspace_id;

    SELECT COALESCE(jsonb_agg(row_data), '[]'::JSONB) INTO v_domains
    FROM (
        SELECT jsonb_build_object(
            'domain', domain,
            'position', position,
            'escalated_at', escalated_at,
            'days_active', EXTRACT(DAY FROM NOW() - escalated_at),
            'exposure_count', exposure_count
        ) AS row_data
        FROM escalation_history
        WHERE workspace_id = p_workspace_id
        AND recovered_at IS NULL
        ORDER BY escalated_at DESC
        LIMIT 10
    ) sub;

    RETURN jsonb_build_object(
        'active_escalations', v_active,
        'recovered', v_recovered,
        'avg_duration_days', ROUND(v_avg_duration, 1),
        'active_details', v_domains,
        'computed_at', NOW()
    );
END;
$$;

-- FIX 2: build_intelligence_summary — handle missing functions gracefully
CREATE OR REPLACE FUNCTION build_intelligence_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workforce JSONB;
    v_scenarios JSONB;
    v_scores JSONB;
    v_pressure JSONB;
    v_freshness JSONB;
    v_contradictions JSONB;
    v_silence JSONB;
    v_escalations JSONB;
    v_completeness JSONB;
    v_readiness JSONB;
    v_overall_health TEXT;
    v_overall_score NUMERIC := 0;
    v_connected_count INT := 0;
BEGIN
    -- Call all sub-functions with error handling
    BEGIN v_workforce := compute_workforce_health(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_workforce := '{"status":"error"}'::JSONB; END;
    BEGIN v_scenarios := compute_revenue_scenarios(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_scenarios := '{"status":"error"}'::JSONB; END;
    BEGIN v_scores := compute_insight_scores(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_scores := '{"status":"error"}'::JSONB; END;
    BEGIN v_pressure := compute_pressure_levels(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_pressure := '{"status":"error"}'::JSONB; END;
    BEGIN v_freshness := compute_evidence_freshness(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_freshness := '{"status":"error"}'::JSONB; END;
    BEGIN v_contradictions := detect_contradictions(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_contradictions := '{"count":0}'::JSONB; END;
    BEGIN v_silence := detect_silence(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_silence := '{"silence_level":"unknown"}'::JSONB; END;
    BEGIN v_escalations := get_escalation_summary(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_escalations := '{"active_escalations":0}'::JSONB; END;
    BEGIN v_completeness := compute_profile_completeness(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_completeness := '{"completeness_pct":0}'::JSONB; END;
    BEGIN v_readiness := compute_data_readiness(p_workspace_id); EXCEPTION WHEN OTHERS THEN v_readiness := '{"readiness_pct":0}'::JSONB; END;

    -- Compute overall health
    SELECT COUNT(*) INTO v_connected_count
    FROM workspace_integrations
    WHERE workspace_id = p_workspace_id AND status = 'connected';

    v_overall_score := (v_connected_count * 15)
        + CASE WHEN COALESCE((v_contradictions->>'count')::INT, 0) = 0 THEN 20 ELSE 0 END
        + CASE WHEN COALESCE(v_silence->>'silence_level', 'unknown') = 'active' THEN 20 ELSE 0 END
        + COALESCE((v_completeness->>'completeness_pct')::NUMERIC * 0.2, 0)
        + COALESCE((v_readiness->>'readiness_pct')::NUMERIC * 0.1, 0);

    v_overall_health := CASE
        WHEN v_overall_score >= 80 THEN 'excellent'
        WHEN v_overall_score >= 60 THEN 'good'
        WHEN v_overall_score >= 40 THEN 'developing'
        WHEN v_overall_score >= 20 THEN 'needs_attention'
        ELSE 'critical'
    END;

    RETURN jsonb_build_object(
        'workspace_id', p_workspace_id,
        'overall_health', v_overall_health,
        'overall_score', ROUND(v_overall_score),
        'modules', jsonb_build_object(
            'workforce', v_workforce,
            'scenarios', v_scenarios,
            'scores', v_scores,
            'pressure', v_pressure,
            'freshness', v_freshness,
            'contradictions', v_contradictions,
            'silence', v_silence,
            'escalations', v_escalations,
            'completeness', v_completeness,
            'readiness', v_readiness
        ),
        'connected_integrations', v_connected_count,
        'generated_at', NOW()
    );
END;
$$;

-- Re-grant
GRANT EXECUTE ON FUNCTION get_escalation_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION build_intelligence_summary(UUID) TO authenticated;

-- 025_enable_pg_cron.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc pg_cron SCHEDULED INTELLIGENCE
-- 
-- BEFORE running this SQL:
--   1. Go to Supabase Dashboard
--   2. Click "Database" in left sidebar  
--   3. Click "Extensions"
--   4. Search for "pg_cron"
--   5. Click the toggle to ENABLE it
--   6. Then come back here and run this SQL
-- ═══════════════════════════════════════════════════════════════

-- Enable the extension (if not already done via Dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres (required for Supabase)
GRANT USAGE ON SCHEMA cron TO postgres;


-- ═══════════════════════════════════════════════════════════════
-- JOB 1: Evidence Freshness Decay (every 6 hours)
-- Recalculates how fresh each data source is
-- Stale data gets lower confidence weighting
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
    'biqc-evidence-freshness',
    '0 */6 * * *',
    $$
    SELECT compute_evidence_freshness(workspace_id)
    FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w;
    $$
);


-- ═══════════════════════════════════════════════════════════════
-- JOB 2: Silence Detection (daily at 8am UTC / 6pm AEST)
-- Detects users who haven't engaged with critical signals
-- Generates intervention recommendations
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
    'biqc-silence-detection',
    '0 8 * * *',
    $$
    SELECT detect_silence(workspace_id)
    FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w;
    $$
);


-- ═══════════════════════════════════════════════════════════════
-- JOB 3: Contradiction Detection (every 12 hours)
-- Finds priority mismatches, action-inaction gaps
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
    'biqc-contradiction-check',
    '0 */12 * * *',
    $$
    SELECT detect_contradictions(workspace_id)
    FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w;
    $$
);


-- ═══════════════════════════════════════════════════════════════
-- JOB 4: Full Intelligence Summary (daily at 2am UTC / 12pm AEST)
-- Rebuilds the complete intelligence picture for all active workspaces
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
    'biqc-daily-summary',
    '0 2 * * *',
    $$
    SELECT build_intelligence_summary(workspace_id)
    FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w;
    $$
);


-- ═══════════════════════════════════════════════════════════════
-- Verify jobs are scheduled
-- ═══════════════════════════════════════════════════════════════

SELECT jobid, schedule, command, jobname
FROM cron.job
WHERE jobname LIKE 'biqc-%'
ORDER BY jobname;

-- 026_ingestion_audits.sql
-- ═══════════════════════════════════════════════════════════════
-- FORENSIC INGESTION AUDIT TABLE
-- Stores complete audit results for each URL scan
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ingestion_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    target_url TEXT NOT NULL,
    final_url TEXT,
    http_status INT,
    -- Layer 1: Extraction
    extraction_status TEXT, -- 'pass', 'fail_a1'...'fail_a5'
    raw_html_length INT,
    content_length INT,
    noise_ratio NUMERIC,
    fetch_time_ms INT,
    has_structured_data BOOLEAN DEFAULT FALSE,
    redirect_chain JSONB,
    -- Layer 2: Cleaning
    cleaning_status TEXT, -- 'pass', 'fail_b1'...'fail_b4'
    nav_removed BOOLEAN DEFAULT FALSE,
    footer_removed BOOLEAN DEFAULT FALSE,
    cookie_removed BOOLEAN DEFAULT FALSE,
    unique_sentence_ratio NUMERIC,
    core_content_weight NUMERIC,
    sections_detected JSONB,
    -- Layer 3: Synthesis
    synthesis_status TEXT, -- 'pass', 'fail_c1'...'fail_c5'
    hallucinations JSONB DEFAULT '[]'::JSONB,
    lost_signals JSONB DEFAULT '[]'::JSONB,
    prompt_inference_flags JSONB DEFAULT '[]'::JSONB,
    -- Metadata
    copyright_year INT,
    latest_blog_date TEXT,
    freshness_status TEXT,
    -- Verdict
    primary_failure_layer TEXT, -- 'extraction', 'cleaning', 'synthesis', 'none'
    secondary_failure_layer TEXT,
    failure_codes JSONB DEFAULT '[]'::JSONB,
    confidence_score NUMERIC,
    remediation JSONB,
    -- Raw data
    raw_scrape_snapshot TEXT,
    cleaned_content TEXT,
    generated_snapshot JSONB,
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_audits_workspace ON ingestion_audits(workspace_id);
ALTER TABLE ingestion_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own audits" ON ingestion_audits;
CREATE POLICY "Users read own audits" ON ingestion_audits FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service manages audits" ON ingestion_audits;
CREATE POLICY "Service manages audits" ON ingestion_audits FOR ALL USING (true) WITH CHECK (true);

-- 027_ingestion_engine.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc FORENSIC INGESTION ENGINE — Complete Schema
-- Migration: 027_ingestion_engine.sql
--
-- Tables: ingestion_sessions, ingestion_pages, ingestion_cleaned
-- Alters: business_profiles (adds dna_trace)
-- ═══════════════════════════════════════════════════════════════

-- 1. Ingestion Sessions — one per scrape run
CREATE TABLE IF NOT EXISTS ingestion_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    target_url TEXT NOT NULL,
    canonical_url TEXT,
    pages_crawled INTEGER DEFAULT 0,
    total_html_length INTEGER DEFAULT 0,
    noise_ratio NUMERIC,
    hallucination_score NUMERIC,
    quality_score NUMERIC,
    confidence_level TEXT,
    failure_layer TEXT,
    failure_codes JSONB DEFAULT '[]'::JSONB,
    llm_prompt TEXT,
    llm_output JSONB,
    dna_trace JSONB,
    redirect_chain JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Ingestion Pages — raw HTML per page
CREATE TABLE IF NOT EXISTS ingestion_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES ingestion_sessions(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    page_priority INTEGER,
    html_length INTEGER DEFAULT 0,
    raw_html TEXT,
    fetch_time_ms INTEGER,
    http_status INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Ingestion Cleaned — cleaned text per session
CREATE TABLE IF NOT EXISTS ingestion_cleaned (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES ingestion_sessions(id) ON DELETE CASCADE,
    cleaned_text TEXT,
    cleaned_length INTEGER DEFAULT 0,
    noise_ratio NUMERIC,
    sections_detected JSONB,
    core_content_weight NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Business DNA trace column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'dna_trace') THEN
        ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS dna_trace JSONB;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ingestion_sessions_workspace ON ingestion_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_pages_session ON ingestion_pages(session_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_cleaned_session ON ingestion_cleaned(session_id);

-- RLS
ALTER TABLE ingestion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_cleaned ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own sessions" ON ingestion_sessions;
CREATE POLICY "Users read own sessions" ON ingestion_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service manages sessions" ON ingestion_sessions;
CREATE POLICY "Service manages sessions" ON ingestion_sessions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users read own pages" ON ingestion_pages;
CREATE POLICY "Users read own pages" ON ingestion_pages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service manages pages" ON ingestion_pages;
CREATE POLICY "Service manages pages" ON ingestion_pages FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users read own cleaned" ON ingestion_cleaned;
CREATE POLICY "Users read own cleaned" ON ingestion_cleaned FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service manages cleaned" ON ingestion_cleaned;
CREATE POLICY "Service manages cleaned" ON ingestion_cleaned FOR ALL USING (true) WITH CHECK (true);

-- 028_access_control.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc ACCESS CONTROL SCHEMA
-- Migration: 028_access_control.sql
-- Adds subscription tier, usage counters to auth.users metadata
-- ═══════════════════════════════════════════════════════════════

-- Add subscription columns to users table (if using custom users table)
-- Note: Supabase auth.users is managed — we store tier in business_profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'subscription_tier') THEN
        ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'monthly_snapshot_count') THEN
        ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS monthly_snapshot_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'monthly_audit_refresh_count') THEN
        ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS monthly_audit_refresh_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'billing_cycle_start') THEN
        ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS billing_cycle_start DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Monthly counter reset function (called by pg_cron)
CREATE OR REPLACE FUNCTION reset_monthly_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE business_profiles
    SET monthly_snapshot_count = 0,
        monthly_audit_refresh_count = 0,
        billing_cycle_start = CURRENT_DATE
    WHERE billing_cycle_start < CURRENT_DATE - INTERVAL '30 days';
END;
$$;

-- pg_cron job: reset monthly counters daily at midnight UTC
-- (Uncomment after pg_cron is enabled)
-- SELECT cron.schedule('biqc-monthly-reset', '0 0 * * *', $$SELECT reset_monthly_counters()$$);

-- Atomic snapshot counter increment
CREATE OR REPLACE FUNCTION increment_snapshot_counter(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tier TEXT;
    v_count INT;
    v_cycle_start DATE;
BEGIN
    SELECT subscription_tier, monthly_snapshot_count, billing_cycle_start
    INTO v_tier, v_count, v_cycle_start
    FROM business_profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Reset if cycle expired
    IF v_cycle_start < CURRENT_DATE - INTERVAL '30 days' THEN
        v_count := 0;
        UPDATE business_profiles
        SET monthly_snapshot_count = 0, monthly_audit_refresh_count = 0, billing_cycle_start = CURRENT_DATE
        WHERE user_id = p_user_id;
    END IF;

    -- Check limit for free tier
    IF COALESCE(v_tier, 'free') = 'free' AND v_count >= 3 THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Monthly snapshot limit reached (3/3)', 'current_count', v_count);
    END IF;

    -- Increment
    UPDATE business_profiles
    SET monthly_snapshot_count = COALESCE(monthly_snapshot_count, 0) + 1
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('allowed', true, 'current_count', v_count + 1);
END;
$$;

-- Atomic audit counter increment
CREATE OR REPLACE FUNCTION increment_audit_counter(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tier TEXT;
    v_count INT;
    v_cycle_start DATE;
BEGIN
    SELECT subscription_tier, monthly_audit_refresh_count, billing_cycle_start
    INTO v_tier, v_count, v_cycle_start
    FROM business_profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_cycle_start < CURRENT_DATE - INTERVAL '30 days' THEN
        v_count := 0;
        UPDATE business_profiles
        SET monthly_snapshot_count = 0, monthly_audit_refresh_count = 0, billing_cycle_start = CURRENT_DATE
        WHERE user_id = p_user_id;
    END IF;

    IF COALESCE(v_tier, 'free') = 'free' AND v_count >= 1 THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Monthly audit limit reached (1/1)', 'current_count', v_count);
    END IF;

    UPDATE business_profiles
    SET monthly_audit_refresh_count = COALESCE(monthly_audit_refresh_count, 0) + 1
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('allowed', true, 'current_count', v_count + 1);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_snapshot_counter(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_audit_counter(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_monthly_counters() TO postgres;

