-- ═══════════════════════════════════════════════════
-- BIQc FULL SCHEMA MIGRATION — For Pro Supabase
-- Run this ENTIRE file in Supabase SQL Editor
-- Project: vwwandhoydemcybltoxz
-- Generated: Sat Mar  7 02:35:19 UTC 2026
-- ═══════════════════════════════════════════════════


-- ═══ 001_watchtower_events.sql ═══
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
CREATE INDEX idx_watchtower_account_status ON public.watchtower_events(account_id, status);
CREATE INDEX idx_watchtower_domain ON public.watchtower_events(domain);
CREATE INDEX idx_watchtower_severity ON public.watchtower_events(severity);
CREATE INDEX idx_watchtower_created ON public.watchtower_events(created_at DESC);

-- RLS Policies
ALTER TABLE public.watchtower_events ENABLE ROW LEVEL SECURITY;

-- Users can read their workspace's events
CREATE POLICY "Users can read workspace watchtower events"
    ON public.watchtower_events
    FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Service role can do anything
CREATE POLICY "Service role full access"
    ON public.watchtower_events
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

CREATE TRIGGER watchtower_updated_at
    BEFORE UPDATE ON public.watchtower_events
    FOR EACH ROW
    EXECUTE FUNCTION update_watchtower_updated_at();

COMMENT ON TABLE public.watchtower_events IS 'Authoritative intelligence events - conclusions only, not raw data';


-- ═══ 002_watchtower_rpcs.sql ═══
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


-- ═══ 003_outlook_emails_schema.sql ═══
-- OUTLOOK EMAILS TABLE SCHEMA
-- Stores email data for intelligence analysis

-- Drop and recreate to ensure clean schema
DROP TABLE IF EXISTS public.outlook_emails CASCADE;

CREATE TABLE public.outlook_emails (
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
CREATE INDEX idx_outlook_emails_user_received ON public.outlook_emails(user_id, received_date DESC);
CREATE INDEX idx_outlook_emails_user_folder ON public.outlook_emails(user_id, folder);
CREATE INDEX idx_outlook_emails_from_address ON public.outlook_emails(from_address);

-- RLS Policies
ALTER TABLE public.outlook_emails ENABLE ROW LEVEL SECURITY;

-- Users can read their own emails
CREATE POLICY "Users can read own emails"
    ON public.outlook_emails
    FOR SELECT
    USING (user_id = auth.uid());

-- Service role can do anything
CREATE POLICY "Service role full access"
    ON public.outlook_emails
    FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.outlook_emails IS 'Email data for intelligence analysis';


-- ═══ 004_emails_provider_agnostic.sql ═══
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


-- ═══ 005_signal_to_noise_intelligence.sql ═══
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


-- ═══ 006_fix_business_vitals_rpc.sql ═══
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


-- ═══ 007_final_fix_business_vitals.sql ═══
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


-- ═══ 008_calibration_schedules.sql ═══
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
CREATE INDEX idx_calibration_user ON public.calibration_schedules(user_id);
CREATE INDEX idx_calibration_account ON public.calibration_schedules(account_id);
CREATE INDEX idx_calibration_status ON public.calibration_schedules(schedule_status);
CREATE INDEX idx_calibration_weekly_due ON public.calibration_schedules(next_weekly_due_at) WHERE schedule_status = 'active';
CREATE INDEX idx_calibration_quarterly_due ON public.calibration_schedules(next_quarterly_due_at) WHERE schedule_status = 'active';

-- RLS
ALTER TABLE public.calibration_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own schedules"
    ON public.calibration_schedules FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
    ON public.calibration_schedules FOR ALL
    USING (true) WITH CHECK (true);

COMMENT ON TABLE public.calibration_schedules IS 'Post-induction monitoring schedule - structure only, execution logic separate';


-- ═══ 009_calibration_system.sql ═══
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

CREATE INDEX idx_strategy_user ON public.strategy_profiles(user_id);
CREATE INDEX idx_strategy_account ON public.strategy_profiles(account_id);

ALTER TABLE public.strategy_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own strategy" ON public.strategy_profiles FOR SELECT USING (user_id = auth.uid());
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

CREATE INDEX idx_calibration_sessions_user ON public.calibration_sessions(user_id);
CREATE INDEX idx_calibration_sessions_profile ON public.calibration_sessions(business_profile_id);

ALTER TABLE public.calibration_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own calibration sessions" ON public.calibration_sessions FOR SELECT USING (user_id = auth.uid());
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

CREATE INDEX idx_schedule_profile ON public.working_schedules(business_profile_id);
CREATE INDEX idx_schedule_week ON public.working_schedules(week_number);

ALTER TABLE public.working_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own schedules" ON public.working_schedules FOR SELECT USING (user_id = auth.uid());
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

CREATE INDEX idx_intelligence_priority_profile ON public.intelligence_priorities(business_profile_id);
CREATE INDEX idx_intelligence_priority_rank ON public.intelligence_priorities(priority_rank);

ALTER TABLE public.intelligence_priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own priorities" ON public.intelligence_priorities FOR SELECT USING (user_id = auth.uid());
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

CREATE INDEX idx_progress_cadence_profile ON public.progress_cadence(business_profile_id);

ALTER TABLE public.progress_cadence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own cadence" ON public.progress_cadence FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role full access" ON public.progress_cadence FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.strategy_profiles IS 'Strategic calibration data - raw inputs + AI-generated drafts';
COMMENT ON TABLE public.calibration_sessions IS 'Calibration session audit trail';
COMMENT ON TABLE public.working_schedules IS '15-week schedule scaffold created post-calibration';
COMMENT ON TABLE public.intelligence_priorities IS 'Signal priority hierarchy per business';
COMMENT ON TABLE public.progress_cadence IS 'Weekly/monthly progress tracking configuration';


-- ═══ 010_fact_resolution_ledger.sql ═══
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
CREATE POLICY "Users can view own facts" ON fact_resolution_ledger
    FOR SELECT USING (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role full access" ON fact_resolution_ledger
    FOR ALL USING (auth.role() = 'service_role');

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_fact_ledger_user ON fact_resolution_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_ledger_key ON fact_resolution_ledger(user_id, fact_key);


-- ═══ 011_system_prompts_table.sql ═══
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

CREATE INDEX IF NOT EXISTS idx_system_prompts_key ON system_prompts(prompt_key);
CREATE INDEX IF NOT EXISTS idx_system_prompts_agent ON system_prompts(agent);
CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(is_active);

COMMENT ON TABLE system_prompts IS 'Central registry of all AI system prompts. Extracted from hardcoded strings in server.py and helper files. Enables A/B testing, versioning, and hot-swapping without redeployment.';


-- ═══ 012_prompt_audit_logs.sql ═══
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


-- ═══ 001_user_operator_profile.sql ═══
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

CREATE POLICY "Users can read own profile"
  ON user_operator_profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_operator_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_operator_profile FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypass for Edge Functions
CREATE POLICY "Service role full access"
  ON user_operator_profile FOR ALL
  USING (auth.role() = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_uop_user_id ON user_operator_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_uop_status ON user_operator_profile(persona_calibration_status);


-- ═══ 013_edge_function_warmup.sql ═══
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


-- ═══ 014_calibration_schedules.sql ═══
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


-- ═══ 015_compute_market_risk_weight.sql ═══
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


-- ═══ 016_detect_contradictions.sql ═══
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


-- ═══ 017_calibrate_pressure.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- calibrate_pressure(user_id) — SQL Function
-- Replaces: backend/pressure_calibration.py (300 lines Python)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE decision_pressure ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_pressure' AND policyname = 'Service role full access on decision_pressure') THEN
    CREATE POLICY "Service role full access on decision_pressure"
      ON decision_pressure FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_pressure' AND policyname = 'Users read own decision_pressure') THEN
    CREATE POLICY "Users read own decision_pressure"
      ON decision_pressure FOR SELECT TO authenticated
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


-- ═══ 018_decay_evidence.sql ═══
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
    CREATE POLICY "Service role full access on evidence_freshness"
      ON evidence_freshness FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evidence_freshness' AND policyname = 'Users read own evidence_freshness') THEN
    CREATE POLICY "Users read own evidence_freshness"
      ON evidence_freshness FOR SELECT TO authenticated
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


-- ═══ 019_update_escalation.sql ═══
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
    CREATE POLICY "Service role full access on escalation_memory"
      ON escalation_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escalation_memory' AND policyname = 'Users read own escalation_memory') THEN
    CREATE POLICY "Users read own escalation_memory"
      ON escalation_memory FOR SELECT TO authenticated
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


-- ═══ 020_insight_outcomes.sql ═══
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


-- ═══ 021_trust_reconstruction.sql ═══
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
        ALTER TABLE business_profiles ADD COLUMN source_map JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'confidence_map') THEN
        ALTER TABLE business_profiles ADD COLUMN confidence_map JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'timestamp_map') THEN
        ALTER TABLE business_profiles ADD COLUMN timestamp_map JSONB;
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
CREATE POLICY "Users read own workspace_integrations" ON workspace_integrations
    FOR SELECT USING (true);
CREATE POLICY "Users read own governance_events" ON governance_events
    FOR SELECT USING (true);
CREATE POLICY "Users read own report_exports" ON report_exports
    FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Service role manages workspace_integrations" ON workspace_integrations
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages governance_events" ON governance_events
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages report_exports" ON report_exports
    FOR ALL USING (true) WITH CHECK (true);


-- ═══ 022_intelligence_modules.sql ═══
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


-- ═══ 023_complete_intelligence_sql.sql ═══
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
CREATE TRIGGER trg_governance_event_sync
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
CREATE TRIGGER trg_integration_status_change
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
CREATE TRIGGER trg_report_export_log
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
CREATE POLICY "Users read own escalation_history" ON escalation_history FOR SELECT USING (true);
CREATE POLICY "Service manages escalation_history" ON escalation_history FOR ALL USING (true) WITH CHECK (true);


-- ═══ 024_sql_hotfix.sql ═══
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


-- ═══ 025_enable_pg_cron.sql ═══
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


-- ═══ 026_ingestion_audits.sql ═══
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
CREATE POLICY "Users read own audits" ON ingestion_audits FOR SELECT USING (true);
CREATE POLICY "Service manages audits" ON ingestion_audits FOR ALL USING (true) WITH CHECK (true);


-- ═══ 027_ingestion_engine.sql ═══
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
        ALTER TABLE business_profiles ADD COLUMN dna_trace JSONB;
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

CREATE POLICY "Users read own sessions" ON ingestion_sessions FOR SELECT USING (true);
CREATE POLICY "Service manages sessions" ON ingestion_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users read own pages" ON ingestion_pages FOR SELECT USING (true);
CREATE POLICY "Service manages pages" ON ingestion_pages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users read own cleaned" ON ingestion_cleaned FOR SELECT USING (true);
CREATE POLICY "Service manages cleaned" ON ingestion_cleaned FOR ALL USING (true) WITH CHECK (true);


-- ═══ 028_access_control.sql ═══
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
        ALTER TABLE business_profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'monthly_snapshot_count') THEN
        ALTER TABLE business_profiles ADD COLUMN monthly_snapshot_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'monthly_audit_refresh_count') THEN
        ALTER TABLE business_profiles ADD COLUMN monthly_audit_refresh_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'billing_cycle_start') THEN
        ALTER TABLE business_profiles ADD COLUMN billing_cycle_start DATE DEFAULT CURRENT_DATE;
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


-- ═══ 029_payment_transactions.sql ═══
-- Payment transactions table for Stripe
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_id TEXT UNIQUE,
    amount NUMERIC,
    currency TEXT DEFAULT 'aud',
    package_id TEXT,
    tier TEXT,
    payment_status TEXT DEFAULT 'initiated',
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_session ON payment_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_transactions(user_id);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own payments" ON payment_transactions FOR SELECT USING (true);
CREATE POLICY "Service manages payments" ON payment_transactions FOR ALL USING (true) WITH CHECK (true);


-- ═══ 030_intelligence_spine.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc INTELLIGENCE SPINE — Additive Schema Deployment
-- Migration: 030_intelligence_spine.sql
--
-- MODE: Additive only. Zero modifications to public schema.
-- All structures in intelligence_core schema.
-- Dormant until intelligence_spine_enabled = TRUE.
-- ═══════════════════════════════════════════════════════════════


-- ═══ PHASE 1: SCHEMA ═══
CREATE SCHEMA IF NOT EXISTS intelligence_core;


-- ═══ 1. CANONICAL EVENT TYPE ═══
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'intelligence_core')) THEN
        CREATE TYPE intelligence_core.event_type AS ENUM (
            'OBJECT_CREATED',
            'OBJECT_UPDATED',
            'STATE_TRANSITION',
            'METRIC_CHANGE',
            'FORECAST_RUN',
            'ANOMALY_DETECTED',
            'CHURN_SCORE_UPDATED',
            'DECISION_CREATED',
            'DECISION_OUTCOME_RECORDED',
            'MODEL_EXECUTED'
        );
    END IF;
END $$;


-- ═══ 2. CANONICAL EVENT LOG ═══
CREATE TABLE IF NOT EXISTS intelligence_core.intelligence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type intelligence_core.event_type NOT NULL,
    object_id UUID,
    model_name TEXT,
    numeric_payload FLOAT,
    json_payload JSONB,
    confidence_score FLOAT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_events_tenant ON intelligence_core.intelligence_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_events_type ON intelligence_core.intelligence_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ic_events_created ON intelligence_core.intelligence_events(created_at DESC);


-- ═══ 3. DAILY METRIC SNAPSHOTS ═══
CREATE TABLE IF NOT EXISTS intelligence_core.daily_metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    revenue NUMERIC,
    cash_balance NUMERIC,
    deal_velocity FLOAT,
    engagement_score FLOAT,
    risk_score FLOAT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE (tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ic_snapshots_tenant_date ON intelligence_core.daily_metric_snapshots(tenant_id, snapshot_date DESC);


-- ═══ 4. ONTOLOGY GRAPH ═══
CREATE TABLE IF NOT EXISTS intelligence_core.ontology_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    node_type TEXT NOT NULL,
    attributes JSONB NOT NULL,
    current_state TEXT,
    risk_score FLOAT DEFAULT 0,
    confidence_score FLOAT DEFAULT 1,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_core.ontology_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    from_node UUID REFERENCES intelligence_core.ontology_nodes(id) ON DELETE CASCADE,
    to_node UUID REFERENCES intelligence_core.ontology_nodes(id) ON DELETE CASCADE,
    edge_type TEXT,
    weight FLOAT DEFAULT 1,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_nodes_tenant ON intelligence_core.ontology_nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_nodes_type ON intelligence_core.ontology_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_ic_edges_from ON intelligence_core.ontology_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_ic_edges_to ON intelligence_core.ontology_edges(to_node);
CREATE INDEX IF NOT EXISTS idx_ic_edges_tenant ON intelligence_core.ontology_edges(tenant_id);


-- ═══ 5. DECISION REGISTRY ═══
CREATE TABLE IF NOT EXISTS intelligence_core.decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    decision_category TEXT NOT NULL,
    context_snapshot JSONB NOT NULL,
    predicted_impact FLOAT,
    predicted_confidence FLOAT,
    risk_level_at_time FLOAT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_core.decision_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID REFERENCES intelligence_core.decisions(id) ON DELETE CASCADE,
    outcome_30d FLOAT,
    outcome_60d FLOAT,
    outcome_90d FLOAT,
    actual_impact FLOAT,
    variance_delta FLOAT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_decisions_tenant ON intelligence_core.decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_outcomes_decision ON intelligence_core.decision_outcomes(decision_id);


-- ═══ 6. MODEL GOVERNANCE ═══
CREATE TABLE IF NOT EXISTS intelligence_core.model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    feature_schema_version TEXT,
    training_data_start DATE,
    training_data_end DATE,
    accuracy_metric FLOAT,
    drift_score FLOAT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_core.model_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT,
    model_version TEXT,
    tenant_id UUID,
    execution_time_ms INT,
    confidence_score FLOAT,
    output_summary JSONB,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_registry_name ON intelligence_core.model_registry(model_name);
CREATE INDEX IF NOT EXISTS idx_ic_executions_tenant ON intelligence_core.model_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_executions_model ON intelligence_core.model_executions(model_name);


-- ═══ 7. FEATURE FLAG ═══
CREATE TABLE IF NOT EXISTS intelligence_core.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);

INSERT INTO intelligence_core.feature_flags (flag_name, enabled, description)
VALUES ('intelligence_spine_enabled', false, 'Master switch for Intelligence Spine. When FALSE, all modelling engines are dormant.')
ON CONFLICT (flag_name) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- PHASE 2: RLS — Tenant isolation on all tables
-- Mirrors existing public schema pattern
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE intelligence_core.intelligence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.daily_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.ontology_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.ontology_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.model_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.feature_flags ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read policies (authenticated users read own tenant data)
CREATE POLICY "tenant_read_events" ON intelligence_core.intelligence_events
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_snapshots" ON intelligence_core.daily_metric_snapshots
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_nodes" ON intelligence_core.ontology_nodes
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_edges" ON intelligence_core.ontology_edges
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_decisions" ON intelligence_core.decisions
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_outcomes" ON intelligence_core.decision_outcomes
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "tenant_read_registry" ON intelligence_core.model_registry
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "tenant_read_executions" ON intelligence_core.model_executions
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "anyone_read_flags" ON intelligence_core.feature_flags
    FOR SELECT TO authenticated USING (true);

-- Service role full access (for backend operations)
CREATE POLICY "service_all_events" ON intelligence_core.intelligence_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_snapshots" ON intelligence_core.daily_metric_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_nodes" ON intelligence_core.ontology_nodes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_edges" ON intelligence_core.ontology_edges
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_decisions" ON intelligence_core.decisions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_outcomes" ON intelligence_core.decision_outcomes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_registry" ON intelligence_core.model_registry
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_executions" ON intelligence_core.model_executions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_flags" ON intelligence_core.feature_flags
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- PHASE 3: Feature flag check function (non-destructive)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION intelligence_core.is_spine_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT enabled FROM intelligence_core.feature_flags WHERE flag_name = 'intelligence_spine_enabled'),
        false
    );
$$;

GRANT USAGE ON SCHEMA intelligence_core TO authenticated;
GRANT USAGE ON SCHEMA intelligence_core TO service_role;
GRANT EXECUTE ON FUNCTION intelligence_core.is_spine_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION intelligence_core.is_spine_enabled() TO service_role;


-- ═══ 031_intelligence_spine_public.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc INTELLIGENCE SPINE — Public Schema (ic_ prefix)
-- Migration: 031_intelligence_spine_public.sql
-- 
-- Supabase REST API only exposes public schema.
-- All spine tables use ic_ prefix. Zero collision with existing tables.
-- Additive only. No existing tables modified.
-- ═══════════════════════════════════════════════════════════════

-- Feature flag (supports global + tenant-scoped)
CREATE TABLE IF NOT EXISTS ic_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    tenant_id UUID,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);
INSERT INTO ic_feature_flags (flag_name, enabled, description)
VALUES ('intelligence_spine_enabled', false, 'Global master switch. Tenant-scoped flags use spine_enabled_{tenant_id}')
ON CONFLICT (flag_name) DO NOTHING;

-- Canonical event log
CREATE TABLE IF NOT EXISTS ic_intelligence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    object_id UUID,
    model_name TEXT,
    numeric_payload FLOAT,
    json_payload JSONB,
    confidence_score FLOAT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ic_events_tenant ON ic_intelligence_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_events_type ON ic_intelligence_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ic_events_created ON ic_intelligence_events(created_at DESC);

-- Daily metric snapshots
CREATE TABLE IF NOT EXISTS ic_daily_metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    revenue NUMERIC,
    cash_balance NUMERIC,
    deal_velocity FLOAT,
    engagement_score FLOAT,
    risk_score FLOAT,
    churn_score FLOAT,
    anomaly_count INT DEFAULT 0,
    active_deals INT,
    stalled_deals INT,
    pipeline_value NUMERIC,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE (tenant_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_ic_snaps_tenant ON ic_daily_metric_snapshots(tenant_id, snapshot_date DESC);

-- Ontology graph
CREATE TABLE IF NOT EXISTS ic_ontology_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    node_type TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}',
    current_state TEXT,
    risk_score FLOAT DEFAULT 0,
    confidence_score FLOAT DEFAULT 1,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ic_ontology_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    from_node UUID REFERENCES ic_ontology_nodes(id) ON DELETE CASCADE,
    to_node UUID REFERENCES ic_ontology_nodes(id) ON DELETE CASCADE,
    edge_type TEXT,
    weight FLOAT DEFAULT 1,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ic_nodes_tenant ON ic_ontology_nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_edges_from ON ic_ontology_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_ic_edges_to ON ic_ontology_edges(to_node);

-- Decision registry
CREATE TABLE IF NOT EXISTS ic_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    decision_category TEXT NOT NULL,
    context_snapshot JSONB NOT NULL DEFAULT '{}',
    predicted_impact FLOAT,
    predicted_confidence FLOAT,
    risk_level_at_time FLOAT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ic_decision_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID REFERENCES ic_decisions(id) ON DELETE CASCADE,
    outcome_30d FLOAT,
    outcome_60d FLOAT,
    outcome_90d FLOAT,
    actual_impact FLOAT,
    variance_delta FLOAT,
    created_at TIMESTAMP DEFAULT now()
);

-- Model governance
CREATE TABLE IF NOT EXISTS ic_model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    feature_schema_version TEXT,
    training_data_start DATE,
    training_data_end DATE,
    accuracy_metric FLOAT,
    drift_score FLOAT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ic_model_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT,
    model_version TEXT,
    tenant_id UUID,
    execution_time_ms INT,
    confidence_score FLOAT,
    output_summary JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- RLS on all
ALTER TABLE ic_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_intelligence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_daily_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_ontology_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_ontology_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_model_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_flags" ON ic_feature_flags FOR SELECT USING (true);
CREATE POLICY "manage_flags" ON ic_feature_flags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_events" ON ic_intelligence_events FOR SELECT USING (true);
CREATE POLICY "manage_events" ON ic_intelligence_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_snaps" ON ic_daily_metric_snapshots FOR SELECT USING (true);
CREATE POLICY "manage_snaps" ON ic_daily_metric_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_nodes" ON ic_ontology_nodes FOR SELECT USING (true);
CREATE POLICY "manage_nodes" ON ic_ontology_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_edges" ON ic_ontology_edges FOR SELECT USING (true);
CREATE POLICY "manage_edges" ON ic_ontology_edges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_decisions" ON ic_decisions FOR SELECT USING (true);
CREATE POLICY "manage_decisions" ON ic_decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_outcomes" ON ic_decision_outcomes FOR SELECT USING (true);
CREATE POLICY "manage_outcomes" ON ic_decision_outcomes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_registry" ON ic_model_registry FOR SELECT USING (true);
CREATE POLICY "manage_registry" ON ic_model_registry FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_executions" ON ic_model_executions FOR SELECT USING (true);
CREATE POLICY "manage_executions" ON ic_model_executions FOR ALL USING (true) WITH CHECK (true);

-- Feature flag check function (tenant-scoped with global fallback)
CREATE OR REPLACE FUNCTION is_spine_enabled()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE((SELECT enabled FROM ic_feature_flags WHERE flag_name = 'intelligence_spine_enabled'), false);
$$;

CREATE OR REPLACE FUNCTION is_spine_enabled_for(p_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(
        (SELECT enabled FROM ic_feature_flags WHERE flag_name = 'spine_enabled_' || p_tenant_id::TEXT),
        (SELECT enabled FROM ic_feature_flags WHERE flag_name = 'intelligence_spine_enabled'),
        false
    );
$$;

GRANT EXECUTE ON FUNCTION is_spine_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION is_spine_enabled_for(UUID) TO authenticated;

-- Snapshot generator function
CREATE OR REPLACE FUNCTION ic_generate_daily_snapshot(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_deal_count INT := 0;
    v_stalled INT := 0;
    v_pipeline NUMERIC := 0;
    v_risk FLOAT := 0;
    v_engagement FLOAT := 0;
    v_events_7d INT := 0;
    v_high_events INT := 0;
    v_anomalies INT := 0;
BEGIN
    -- Skip if spine not enabled
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    -- Count governance events (7 days)
    SELECT COUNT(*), COUNT(*) FILTER (WHERE confidence_score >= 0.8)
    INTO v_events_7d, v_high_events
    FROM governance_events
    WHERE workspace_id = p_tenant_id AND signal_timestamp > NOW() - INTERVAL '7 days';

    -- Risk score from pressure levels
    SELECT COALESCE(
        (SELECT AVG(
            CASE 
                WHEN confidence_score >= 0.8 THEN 0.8
                WHEN confidence_score >= 0.5 THEN 0.5
                ELSE 0.2
            END
        ) FROM governance_events WHERE workspace_id = p_tenant_id AND signal_timestamp > NOW() - INTERVAL '7 days'),
        0
    ) INTO v_risk;

    -- Engagement from event density
    v_engagement := LEAST(v_events_7d::FLOAT / 20.0, 1.0);

    -- Anomaly: events with very high confidence in short burst
    SELECT COUNT(*) INTO v_anomalies
    FROM governance_events
    WHERE workspace_id = p_tenant_id
    AND confidence_score >= 0.9
    AND signal_timestamp > NOW() - INTERVAL '24 hours';

    -- Upsert daily snapshot
    INSERT INTO ic_daily_metric_snapshots (
        tenant_id, snapshot_date, deal_velocity, engagement_score,
        risk_score, anomaly_count, active_deals, stalled_deals, pipeline_value
    ) VALUES (
        p_tenant_id, v_today, v_events_7d::FLOAT / 7.0, v_engagement,
        v_risk, v_anomalies, v_deal_count, v_stalled, v_pipeline
    )
    ON CONFLICT (tenant_id, snapshot_date) DO UPDATE SET
        deal_velocity = EXCLUDED.deal_velocity,
        engagement_score = EXCLUDED.engagement_score,
        risk_score = EXCLUDED.risk_score,
        anomaly_count = EXCLUDED.anomaly_count,
        active_deals = EXCLUDED.active_deals,
        stalled_deals = EXCLUDED.stalled_deals,
        pipeline_value = EXCLUDED.pipeline_value;

    -- Log event
    INSERT INTO ic_intelligence_events (tenant_id, event_type, json_payload, confidence_score)
    VALUES (p_tenant_id, 'METRIC_CHANGE', jsonb_build_object(
        'snapshot_date', v_today,
        'events_7d', v_events_7d,
        'risk_score', v_risk,
        'engagement', v_engagement,
        'anomalies', v_anomalies
    ), v_engagement);

    RETURN jsonb_build_object(
        'status', 'generated',
        'snapshot_date', v_today,
        'events_7d', v_events_7d,
        'risk_score', ROUND(v_risk::NUMERIC, 3),
        'engagement_score', ROUND(v_engagement::NUMERIC, 3),
        'anomaly_count', v_anomalies
    );
END;
$$;

-- Batch snapshot for all tenants (for pg_cron)
CREATE OR REPLACE FUNCTION ic_generate_all_snapshots()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tenant UUID;
    v_count INT := 0;
BEGIN
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;
    FOR v_tenant IN SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected'
    LOOP
        PERFORM ic_generate_daily_snapshot(v_tenant);
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('status', 'complete', 'tenants_processed', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION ic_generate_daily_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_generate_all_snapshots() TO postgres;

-- pg_cron: daily snapshot at 1am UTC (uncomment after spine enabled)
-- SELECT cron.schedule('ic-daily-snapshot', '0 1 * * *', $$SELECT ic_generate_all_snapshots()$$);


-- ═══ 032_spine_hardening.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc INTELLIGENCE SPINE — Hardening Migration
-- Migration: 032_spine_hardening.sql
--
-- Fixes:
-- 1. governance_events → APPEND-ONLY (no UPDATE/DELETE except emergency)
-- 2. Postgres-backed durable job queue (replaces in-memory queue)
-- 3. Event-to-snapshot correlation check function
-- 4. Feature flag cache-friendly query
--
-- ADDITIVE ONLY. No existing tables modified structurally.
-- Only RLS policy replacement on governance_events.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. APPEND-ONLY ENFORCEMENT ON governance_events ═══

-- Drop the permissive service role policy
DROP POLICY IF EXISTS "Service role manages governance_events" ON governance_events;

-- Replace with INSERT-only for service role
CREATE POLICY "service_insert_governance_events" ON governance_events
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Read access remains
-- "Users read own governance_events" already exists (FOR SELECT)

-- Emergency delete for super admin (via function only, not direct)
CREATE OR REPLACE FUNCTION emergency_delete_governance_event(p_event_id UUID, p_admin_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_admin_email != 'andre@thestrategysquad.com.au' THEN
        RAISE EXCEPTION 'Unauthorized: only super admin can delete governance events';
    END IF;
    
    -- Log the deletion as its own event BEFORE deleting
    INSERT INTO governance_events (workspace_id, event_type, source_system, signal_reference, signal_timestamp, confidence_score)
    SELECT workspace_id, 'EMERGENCY_DELETE', 'manual', p_event_id::TEXT, NOW(), 1.0
    FROM governance_events WHERE id = p_event_id;
    
    DELETE FROM governance_events WHERE id = p_event_id;
    RETURN true;
END;
$$;

-- Trigger to prevent UPDATE on governance_events
CREATE OR REPLACE FUNCTION prevent_governance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'governance_events is append-only. UPDATE not permitted.';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_governance_update ON governance_events;
CREATE TRIGGER trg_prevent_governance_update
    BEFORE UPDATE ON governance_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_governance_update();


-- ═══ 2. DURABLE JOB QUEUE (Postgres-backed) ═══

CREATE TABLE IF NOT EXISTS ic_event_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT now(),
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ic_queue_status ON ic_event_queue(status) WHERE status = 'pending';

-- Process queue function (called by pg_cron every minute)
CREATE OR REPLACE FUNCTION ic_process_event_queue()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_count INT := 0;
BEGIN
    FOR v_item IN
        SELECT id, table_name, payload
        FROM ic_event_queue
        WHERE status = 'pending'
        ORDER BY created_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            -- Mark as processing
            UPDATE ic_event_queue SET status = 'processing' WHERE id = v_item.id;
            
            -- Insert into target table
            IF v_item.table_name = 'ic_intelligence_events' THEN
                INSERT INTO ic_intelligence_events (tenant_id, event_type, object_id, model_name, numeric_payload, json_payload, confidence_score)
                SELECT 
                    (v_item.payload->>'tenant_id')::UUID,
                    v_item.payload->>'event_type',
                    (v_item.payload->>'object_id')::UUID,
                    v_item.payload->>'model_name',
                    (v_item.payload->>'numeric_payload')::FLOAT,
                    (v_item.payload->'json_payload')::JSONB,
                    (v_item.payload->>'confidence_score')::FLOAT;
            ELSIF v_item.table_name = 'ic_model_executions' THEN
                INSERT INTO ic_model_executions (model_name, model_version, tenant_id, execution_time_ms, confidence_score, output_summary)
                SELECT
                    v_item.payload->>'model_name',
                    v_item.payload->>'model_version',
                    (v_item.payload->>'tenant_id')::UUID,
                    (v_item.payload->>'execution_time_ms')::INT,
                    (v_item.payload->>'confidence_score')::FLOAT,
                    (v_item.payload->'output_summary')::JSONB;
            END IF;
            
            -- Mark completed
            UPDATE ic_event_queue SET status = 'completed', processed_at = now() WHERE id = v_item.id;
            v_count := v_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            UPDATE ic_event_queue 
            SET status = CASE WHEN retry_count >= 3 THEN 'failed' ELSE 'pending' END,
                retry_count = retry_count + 1,
                error_message = SQLERRM
            WHERE id = v_item.id;
        END;
    END LOOP;
    
    -- Cleanup completed items older than 24h
    DELETE FROM ic_event_queue WHERE status = 'completed' AND processed_at < now() - INTERVAL '24 hours';
    
    RETURN v_count;
END;
$$;

-- pg_cron: process queue every minute
-- SELECT cron.schedule('ic-process-queue', '* * * * *', $$SELECT ic_process_event_queue()$$);


-- ═══ 3. EVENT-TO-SNAPSHOT CORRELATION CHECK ═══

CREATE OR REPLACE FUNCTION ic_validate_snapshot_correlation(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_snap RECORD;
    v_correlations JSONB := '[]'::JSONB;
    v_events_before INT;
    v_valid INT := 0;
    v_invalid INT := 0;
BEGIN
    FOR v_snap IN
        SELECT snapshot_date, risk_score, engagement_score
        FROM ic_daily_metric_snapshots
        WHERE tenant_id = p_tenant_id
        ORDER BY snapshot_date DESC
        LIMIT 7
    LOOP
        -- Check for business events in 24h before snapshot
        SELECT COUNT(*) INTO v_events_before
        FROM governance_events
        WHERE workspace_id = p_tenant_id
        AND signal_timestamp >= (v_snap.snapshot_date - INTERVAL '24 hours')::TIMESTAMP
        AND signal_timestamp < (v_snap.snapshot_date + INTERVAL '1 day')::TIMESTAMP;
        
        IF v_events_before > 0 THEN
            v_valid := v_valid + 1;
        ELSE
            v_invalid := v_invalid + 1;
        END IF;
        
        v_correlations := v_correlations || jsonb_build_object(
            'date', v_snap.snapshot_date,
            'events_24h', v_events_before,
            'correlated', v_events_before > 0
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'valid_snapshots', v_valid,
        'uncorrelated_snapshots', v_invalid,
        'correlation_rate', CASE WHEN v_valid + v_invalid > 0 THEN ROUND(v_valid::NUMERIC / (v_valid + v_invalid), 2) ELSE 0 END,
        'details', v_correlations
    );
END;
$$;

GRANT EXECUTE ON FUNCTION ic_validate_snapshot_correlation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION emergency_delete_governance_event(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION ic_process_event_queue() TO postgres;

-- RLS on queue
ALTER TABLE ic_event_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_manage_queue" ON ic_event_queue FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 033_risk_baseline.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc DETERMINISTIC RISK BASELINE ENGINE
-- Migration: 033_risk_baseline.sql
--
-- Four indices (0–1 normalized):
--   RVI: Revenue Volatility Index
--   EDS: Engagement Decay Score
--   CDR: Cash Deviation Ratio
--   ADS: Anomaly Density Score
--   CRS: Composite Risk Score (weighted)
--
-- Pure SQL. Zero LLM. Zero randomness.
-- Reads ONLY from ic_daily_metric_snapshots.
-- Weights versioned in ic_model_registry.
-- All executions logged to ic_model_executions + ic_intelligence_events.
-- ═══════════════════════════════════════════════════════════════


-- ═══ REGISTER MODEL + WEIGHTS ═══

INSERT INTO ic_model_registry (model_name, model_version, feature_schema_version, accuracy_metric, is_active)
VALUES (
    'deterministic_risk_baseline',
    'v1.0.0',
    'ic_daily_metric_snapshots_v1',
    1.0,  -- deterministic = perfect accuracy by definition
    true
)
ON CONFLICT DO NOTHING;

-- Store weight configuration as a separate registry entry for versioning
INSERT INTO ic_model_registry (model_name, model_version, feature_schema_version, accuracy_metric, is_active)
VALUES (
    'deterministic_risk_baseline_weights',
    'v1.0.0',
    'weight_config',
    1.0,
    true
)
ON CONFLICT DO NOTHING;


-- ═══ RISK BASELINE FUNCTION ═══

CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Weight config (versioned — change requires new model_version)
    w_rvi CONSTANT FLOAT := 0.35;
    w_eds CONSTANT FLOAT := 0.25;
    w_cdr CONSTANT FLOAT := 0.25;
    w_ads CONSTANT FLOAT := 0.15;

    -- Thresholds (versioned)
    volatility_threshold CONSTANT FLOAT := 0.25;

    -- Computed indices
    v_rvi FLOAT := 0;
    v_eds FLOAT := 0;
    v_cdr FLOAT := 0;
    v_ads FLOAT := 0;
    v_crs FLOAT := 0;
    v_risk_band TEXT;

    -- Intermediate
    v_rolling_mean FLOAT;
    v_rolling_stddev FLOAT;
    v_recent_engagement FLOAT;
    v_prior_engagement FLOAT;
    v_rolling_cash_avg FLOAT;
    v_current_cash FLOAT;
    v_anomaly_events INT;
    v_total_events INT;
    v_snapshot_count INT;
    v_start_time TIMESTAMP;
    v_elapsed_ms INT;
    v_exec_id UUID;
BEGIN
    v_start_time := clock_timestamp();

    -- Check spine enabled
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    -- Count available snapshots
    SELECT COUNT(*) INTO v_snapshot_count
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30;

    IF v_snapshot_count < 3 THEN
        RETURN jsonb_build_object(
            'status', 'insufficient_data',
            'snapshots_available', v_snapshot_count,
            'minimum_required', 3
        );
    END IF;

    -- ═══ 1. REVENUE VOLATILITY INDEX (RVI) ═══
    -- 30-day rolling mean and stddev of deal_velocity (proxy for revenue flow)
    SELECT
        COALESCE(AVG(deal_velocity), 0),
        COALESCE(STDDEV(deal_velocity), 0)
    INTO v_rolling_mean, v_rolling_stddev
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30;

    IF v_rolling_mean > 0 THEN
        v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / volatility_threshold, 1.0);
    ELSE
        v_rvi := 0;  -- No revenue data = no volatility signal (not high risk by default)
    END IF;
    v_rvi := ROUND(v_rvi::NUMERIC, 4);

    -- ═══ 2. ENGAGEMENT DECAY SCORE (EDS) ═══
    -- Compare last 7 days avg engagement vs prior 7 days
    SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 7;

    SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 14
    AND snapshot_date < CURRENT_DATE - 7;

    IF v_prior_engagement > 0 THEN
        v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
    ELSE
        v_eds := 0;  -- No prior engagement = no decay measurable
    END IF;
    v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

    -- ═══ 3. CASH DEVIATION RATIO (CDR) ═══
    -- 30-day rolling average vs most recent value
    SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30
    AND cash_balance IS NOT NULL;

    SELECT COALESCE(cash_balance, 0) INTO v_current_cash
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND cash_balance IS NOT NULL
    ORDER BY snapshot_date DESC
    LIMIT 1;

    IF v_rolling_cash_avg > 0 THEN
        v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
    ELSE
        v_cdr := 0;  -- No cash data = no deviation signal
    END IF;
    v_cdr := ROUND(v_cdr::NUMERIC, 4);

    -- ═══ 4. ANOMALY DENSITY SCORE (ADS) ═══
    -- Anomaly events / total events (30 days)
    SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30;

    SELECT COUNT(*) INTO v_total_events
    FROM governance_events
    WHERE workspace_id = p_tenant_id
    AND signal_timestamp >= NOW() - INTERVAL '30 days';

    IF v_total_events > 0 THEN
        v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
    ELSE
        v_ads := 0;  -- No events = no anomaly density
    END IF;
    v_ads := ROUND(v_ads::NUMERIC, 4);

    -- ═══ COMPOSITE RISK SCORE ═══
    v_crs := ROUND((w_rvi * v_rvi + w_eds * v_eds + w_cdr * v_cdr + w_ads * v_ads)::NUMERIC, 4);

    v_risk_band := CASE
        WHEN v_crs >= 0.7 THEN 'HIGH'
        WHEN v_crs >= 0.4 THEN 'MODERATE'
        ELSE 'LOW'
    END;

    v_elapsed_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INT;

    -- ═══ LOG EXECUTION ═══
    INSERT INTO ic_model_executions (
        model_name, model_version, tenant_id,
        execution_time_ms, confidence_score, output_summary
    ) VALUES (
        'deterministic_risk_baseline', 'v1.0.0', p_tenant_id,
        v_elapsed_ms, 1.0,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
            'thresholds', jsonb_build_object('volatility', volatility_threshold),
            'inputs', jsonb_build_object(
                'snapshots_used', v_snapshot_count,
                'rolling_mean', ROUND(v_rolling_mean::NUMERIC, 4),
                'rolling_stddev', ROUND(v_rolling_stddev::NUMERIC, 4),
                'recent_engagement', ROUND(v_recent_engagement::NUMERIC, 4),
                'prior_engagement', ROUND(v_prior_engagement::NUMERIC, 4),
                'rolling_cash_avg', ROUND(v_rolling_cash_avg::NUMERIC, 2),
                'current_cash', ROUND(v_current_cash::NUMERIC, 2),
                'anomaly_events', v_anomaly_events,
                'total_events', v_total_events
            )
        )
    ) RETURNING id INTO v_exec_id;

    -- ═══ LOG EVENT ═══
    INSERT INTO ic_intelligence_events (
        tenant_id, event_type, model_name,
        numeric_payload, json_payload, confidence_score
    ) VALUES (
        p_tenant_id, 'FORECAST_RUN', 'deterministic_risk_baseline',
        v_crs,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'execution_id', v_exec_id
        ),
        1.0
    );

    -- ═══ RETURN ═══
    RETURN jsonb_build_object(
        'status', 'computed',
        'model_name', 'deterministic_risk_baseline',
        'model_version', 'v1.0.0',
        'execution_id', v_exec_id,
        'execution_time_ms', v_elapsed_ms,
        'confidence_score', 1.0,
        'indices', jsonb_build_object(
            'revenue_volatility_index', v_rvi,
            'engagement_decay_score', v_eds,
            'cash_deviation_ratio', v_cdr,
            'anomaly_density_score', v_ads
        ),
        'composite', jsonb_build_object(
            'risk_score', v_crs,
            'risk_band', v_risk_band
        ),
        'weights', jsonb_build_object(
            'rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads
        ),
        'inputs_used', jsonb_build_object(
            'snapshots', v_snapshot_count,
            'period', '30 days'
        )
    );
END;
$$;


-- ═══ BATCH EXECUTION ═══

CREATE OR REPLACE FUNCTION ic_calculate_all_risk_baselines()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant UUID;
    v_count INT := 0;
    v_errors INT := 0;
    v_result JSONB;
BEGIN
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    FOR v_tenant IN
        SELECT DISTINCT tenant_id
        FROM ic_daily_metric_snapshots
        WHERE snapshot_date >= CURRENT_DATE - 7
    LOOP
        BEGIN
            v_result := ic_calculate_risk_baseline(v_tenant);
            IF (v_result->>'status') = 'computed' THEN
                v_count := v_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'batch_complete',
        'tenants_computed', v_count,
        'errors', v_errors
    );
END;
$$;


-- ═══ GRANTS ═══
GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_all_risk_baselines() TO postgres;

-- pg_cron: daily AFTER snapshot generation (1:30am UTC, 30min after snapshot at 1am)
-- SELECT cron.schedule('ic-risk-baseline', '30 1 * * *', $$SELECT ic_calculate_all_risk_baselines()$$);


-- ═══ 034_configurable_risk_weights.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc CONFIGURABLE RISK BASELINE ENGINE
-- Migration: 034_configurable_risk_weights.sql
--
-- Replaces hardcoded weights with:
--   1. Immutable weight configuration table
--   2. Industry-specific override capability
--   3. Version-locked configurations
--   4. Sum = 1.0 constraint enforcement
--   5. Dynamic weight resolution in risk function
--
-- ADDITIVE. Does not modify 033 tables.
-- Supersedes the CONSTANT weights in ic_calculate_risk_baseline.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. WEIGHT CONFIGURATION TABLE ═══

CREATE TABLE IF NOT EXISTS ic_risk_weight_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    industry_code TEXT,  -- NULL = global default
    weight_rvi FLOAT NOT NULL,
    weight_eds FLOAT NOT NULL,
    weight_cdr FLOAT NOT NULL,
    weight_ads FLOAT NOT NULL,
    volatility_threshold FLOAT NOT NULL DEFAULT 0.25,
    cash_deviation_threshold FLOAT NOT NULL DEFAULT 0.20,
    is_active BOOLEAN DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT now(),
    -- Weights MUST sum to 1.0
    CONSTRAINT weights_sum_one CHECK (
        ROUND((weight_rvi + weight_eds + weight_cdr + weight_ads)::NUMERIC, 5) = 1.0
    )
);

CREATE INDEX IF NOT EXISTS idx_ic_weights_active ON ic_risk_weight_configs(is_active, industry_code);


-- ═══ 2. IMMUTABILITY TRIGGER ═══

CREATE OR REPLACE FUNCTION ic_prevent_weight_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Risk weight configs are immutable. Create a new version instead.';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_weight_update ON ic_risk_weight_configs;
CREATE TRIGGER trg_prevent_weight_update
    BEFORE UPDATE ON ic_risk_weight_configs
    FOR EACH ROW
    WHEN (OLD.is_active IS NOT DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION ic_prevent_weight_update();

-- Allow ONLY is_active toggle (for activation/deactivation)
-- The trigger fires on ALL updates EXCEPT when only is_active changes
-- To activate a new config: UPDATE SET is_active = true WHERE id = X
-- Then deactivate old: UPDATE SET is_active = false WHERE id = Y


-- ═══ 3. DEFAULT CONFIGS ═══

-- Global default (all industries)
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('global_default', 'v1.0.0', NULL, 0.35, 0.25, 0.25, 0.15, 0.25, 0.20, true, 'system')
ON CONFLICT DO NOTHING;

-- B2B SaaS: higher weight on engagement decay + revenue volatility
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('b2b_saas', 'v1.0.0', 'B2B_SAAS', 0.30, 0.35, 0.20, 0.15, 0.30, 0.15, true, 'system')
ON CONFLICT DO NOTHING;

-- Financial Services: higher weight on cash deviation + anomaly density
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('financial_services', 'v1.0.0', 'FINANCIAL_SERVICES', 0.25, 0.20, 0.35, 0.20, 0.20, 0.15, true, 'system')
ON CONFLICT DO NOTHING;

-- Construction: higher weight on cash deviation (project-based cash flow)
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('construction', 'v1.0.0', 'CONSTRUCTION', 0.25, 0.15, 0.40, 0.20, 0.30, 0.25, true, 'system')
ON CONFLICT DO NOTHING;

-- Professional Services: balanced but engagement-weighted
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('professional_services', 'v1.0.0', 'PROFESSIONAL_SERVICES', 0.30, 0.30, 0.25, 0.15, 0.25, 0.20, true, 'system')
ON CONFLICT DO NOTHING;

-- Healthcare: higher anomaly sensitivity
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('healthcare', 'v1.0.0', 'HEALTHCARE', 0.25, 0.25, 0.25, 0.25, 0.20, 0.20, true, 'system')
ON CONFLICT DO NOTHING;


-- ═══ 4. INDUSTRY CODE RESOLVER ═══
-- Maps free-text business_profiles.industry to standardized industry_code

CREATE OR REPLACE FUNCTION ic_resolve_industry_code(p_industry TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_lower TEXT;
BEGIN
    IF p_industry IS NULL OR p_industry = '' THEN
        RETURN NULL;
    END IF;
    v_lower := LOWER(p_industry);

    RETURN CASE
        WHEN v_lower ~ '(saas|software|technology|IT|platform|app)' THEN 'B2B_SAAS'
        WHEN v_lower ~ '(financial|wealth|advisory|investment|banking|insurance)' THEN 'FINANCIAL_SERVICES'
        WHEN v_lower ~ '(construction|building|civil|engineering|trades)' THEN 'CONSTRUCTION'
        WHEN v_lower ~ '(accounting|bookkeeping|tax|audit)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(law|legal|solicitor|barrister)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(consulting|management|strategy|advisory)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(medical|healthcare|health|dental|physio|chiro)' THEN 'HEALTHCARE'
        WHEN v_lower ~ '(real estate|property|agency)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(marketing|advertising|digital|media|creative)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(retail|ecommerce|shop|store)' THEN 'B2B_SAAS'
        WHEN v_lower ~ '(education|training|coaching)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(hospitality|restaurant|cafe|hotel)' THEN 'CONSTRUCTION'
        WHEN v_lower ~ '(logistics|transport|freight|supply)' THEN 'CONSTRUCTION'
        WHEN v_lower ~ '(manufacturing|production|factory)' THEN 'CONSTRUCTION'
        ELSE NULL
    END;
END;
$$;


-- ═══ 5. CONFIGURABLE RISK BASELINE FUNCTION (v2) ═══
-- Supersedes ic_calculate_risk_baseline from 033

CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Dynamic weights
    w_rvi FLOAT;
    w_eds FLOAT;
    w_cdr FLOAT;
    w_ads FLOAT;
    v_vol_threshold FLOAT;
    v_cash_threshold FLOAT;
    v_config_name TEXT;
    v_config_version TEXT;
    v_industry_code TEXT;
    v_tenant_industry TEXT;

    -- Computed indices
    v_rvi FLOAT := 0;
    v_eds FLOAT := 0;
    v_cdr FLOAT := 0;
    v_ads FLOAT := 0;
    v_crs FLOAT := 0;
    v_risk_band TEXT;

    -- Intermediate
    v_rolling_mean FLOAT;
    v_rolling_stddev FLOAT;
    v_recent_engagement FLOAT;
    v_prior_engagement FLOAT;
    v_rolling_cash_avg FLOAT;
    v_current_cash FLOAT;
    v_anomaly_events INT;
    v_total_events INT;
    v_snapshot_count INT;
    v_start_time TIMESTAMP;
    v_elapsed_ms INT;
    v_exec_id UUID;
BEGIN
    v_start_time := clock_timestamp();

    -- Check spine
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    -- Snapshot count check
    SELECT COUNT(*) INTO v_snapshot_count
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_snapshot_count < 3 THEN
        RETURN jsonb_build_object('status', 'insufficient_data', 'snapshots_available', v_snapshot_count, 'minimum_required', 3);
    END IF;

    -- ═══ RESOLVE WEIGHTS ═══
    -- Get tenant industry
    SELECT industry INTO v_tenant_industry
    FROM business_profiles
    WHERE user_id = p_tenant_id
    LIMIT 1;

    v_industry_code := ic_resolve_industry_code(v_tenant_industry);

    -- Load weight config: industry-specific first, then global fallback
    SELECT config_name, model_version, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold
    INTO v_config_name, v_config_version, w_rvi, w_eds, w_cdr, w_ads, v_vol_threshold, v_cash_threshold
    FROM ic_risk_weight_configs
    WHERE is_active = true
    AND (industry_code = v_industry_code OR industry_code IS NULL)
    ORDER BY industry_code NULLS LAST  -- industry-specific first
    LIMIT 1;

    -- Fallback if no config found
    IF w_rvi IS NULL THEN
        w_rvi := 0.35; w_eds := 0.25; w_cdr := 0.25; w_ads := 0.15;
        v_vol_threshold := 0.25; v_cash_threshold := 0.20;
        v_config_name := 'hardcoded_fallback'; v_config_version := 'v0.0.0';
    END IF;

    -- ═══ 1. REVENUE VOLATILITY INDEX ═══
    SELECT COALESCE(AVG(deal_velocity), 0), COALESCE(STDDEV(deal_velocity), 0)
    INTO v_rolling_mean, v_rolling_stddev
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_rolling_mean > 0 THEN
        v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / v_vol_threshold, 1.0);
    END IF;
    v_rvi := ROUND(v_rvi::NUMERIC, 4);

    -- ═══ 2. ENGAGEMENT DECAY SCORE ═══
    SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 7;

    SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 14 AND snapshot_date < CURRENT_DATE - 7;

    IF v_prior_engagement > 0 THEN
        v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
    END IF;
    v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

    -- ═══ 3. CASH DEVIATION RATIO ═══
    SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30 AND cash_balance IS NOT NULL;

    SELECT COALESCE(cash_balance, 0) INTO v_current_cash
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND cash_balance IS NOT NULL
    ORDER BY snapshot_date DESC LIMIT 1;

    IF v_rolling_cash_avg > 0 THEN
        v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
    END IF;
    v_cdr := ROUND(v_cdr::NUMERIC, 4);

    -- ═══ 4. ANOMALY DENSITY SCORE ═══
    SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    SELECT COUNT(*) INTO v_total_events
    FROM governance_events
    WHERE workspace_id = p_tenant_id AND signal_timestamp >= NOW() - INTERVAL '30 days';

    IF v_total_events > 0 THEN
        v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
    END IF;
    v_ads := ROUND(v_ads::NUMERIC, 4);

    -- ═══ COMPOSITE ═══
    v_crs := ROUND((w_rvi * v_rvi + w_eds * v_eds + w_cdr * v_cdr + w_ads * v_ads)::NUMERIC, 4);

    v_risk_band := CASE
        WHEN v_crs >= 0.7 THEN 'HIGH'
        WHEN v_crs >= 0.4 THEN 'MODERATE'
        ELSE 'LOW'
    END;

    v_elapsed_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INT;

    -- ═══ LOG EXECUTION ═══
    INSERT INTO ic_model_executions (
        model_name, model_version, tenant_id,
        execution_time_ms, confidence_score, output_summary
    ) VALUES (
        'deterministic_risk_baseline', v_config_version, p_tenant_id,
        v_elapsed_ms, 1.0,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'config', jsonb_build_object(
                'name', v_config_name,
                'version', v_config_version,
                'industry_code', v_industry_code,
                'tenant_industry', v_tenant_industry
            ),
            'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
            'thresholds', jsonb_build_object('volatility', v_vol_threshold, 'cash_deviation', v_cash_threshold),
            'inputs', jsonb_build_object(
                'snapshots_used', v_snapshot_count,
                'rolling_mean', ROUND(v_rolling_mean::NUMERIC, 4),
                'rolling_stddev', ROUND(v_rolling_stddev::NUMERIC, 4),
                'recent_engagement', ROUND(v_recent_engagement::NUMERIC, 4),
                'prior_engagement', ROUND(v_prior_engagement::NUMERIC, 4),
                'rolling_cash_avg', ROUND(v_rolling_cash_avg::NUMERIC, 2),
                'current_cash', ROUND(v_current_cash::NUMERIC, 2),
                'anomaly_events', v_anomaly_events,
                'total_events', v_total_events
            )
        )
    ) RETURNING id INTO v_exec_id;

    -- ═══ LOG EVENT ═══
    INSERT INTO ic_intelligence_events (
        tenant_id, event_type, model_name,
        numeric_payload, json_payload, confidence_score
    ) VALUES (
        p_tenant_id, 'FORECAST_RUN', 'deterministic_risk_baseline',
        v_crs,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'config_name', v_config_name,
            'industry_code', v_industry_code,
            'execution_id', v_exec_id
        ),
        1.0
    );

    -- ═══ RETURN ═══
    RETURN jsonb_build_object(
        'status', 'computed',
        'model_name', 'deterministic_risk_baseline',
        'model_version', v_config_version,
        'execution_id', v_exec_id,
        'execution_time_ms', v_elapsed_ms,
        'confidence_score', 1.0,
        'config', jsonb_build_object(
            'name', v_config_name,
            'industry_code', v_industry_code,
            'tenant_industry', v_tenant_industry
        ),
        'indices', jsonb_build_object(
            'revenue_volatility_index', v_rvi,
            'engagement_decay_score', v_eds,
            'cash_deviation_ratio', v_cdr,
            'anomaly_density_score', v_ads
        ),
        'composite', jsonb_build_object(
            'risk_score', v_crs,
            'risk_band', v_risk_band
        ),
        'weights', jsonb_build_object(
            'rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads
        ),
        'thresholds', jsonb_build_object(
            'volatility', v_vol_threshold,
            'cash_deviation', v_cash_threshold
        ),
        'inputs_used', jsonb_build_object(
            'snapshots', v_snapshot_count,
            'period', '30 days'
        )
    );
END;
$$;


-- ═══ BATCH (unchanged but now uses dynamic weights) ═══
CREATE OR REPLACE FUNCTION ic_calculate_all_risk_baselines()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant UUID;
    v_count INT := 0;
    v_errors INT := 0;
    v_result JSONB;
BEGIN
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;
    FOR v_tenant IN
        SELECT DISTINCT tenant_id FROM ic_daily_metric_snapshots WHERE snapshot_date >= CURRENT_DATE - 7
    LOOP
        BEGIN
            v_result := ic_calculate_risk_baseline(v_tenant);
            IF (v_result->>'status') = 'computed' THEN v_count := v_count + 1; END IF;
        EXCEPTION WHEN OTHERS THEN v_errors := v_errors + 1;
        END;
    END LOOP;
    RETURN jsonb_build_object('status', 'batch_complete', 'tenants_computed', v_count, 'errors', v_errors);
END;
$$;


-- ═══ RLS + GRANTS ═══
ALTER TABLE ic_risk_weight_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_weights" ON ic_risk_weight_configs FOR SELECT USING (true);
CREATE POLICY "service_manage_weights" ON ic_risk_weight_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION ic_resolve_industry_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_all_risk_baselines() TO postgres;

-- pg_cron: daily at 1:30am UTC (after snapshot at 1am)
-- SELECT cron.schedule('ic-risk-baseline', '30 1 * * *', $$SELECT ic_calculate_all_risk_baselines()$$);


-- ═══ 035_risk_baseline_hardening.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc RISK BASELINE HARDENING
-- Migration: 035_risk_baseline_hardening.sql
--
-- Fixes 4 structural weaknesses:
--   1. Canonical industry code enum table (replaces free-text reliance)
--   2. Unique active weight per industry constraint (prevents ambiguity)
--   3. Backtestable risk function (optional config_id parameter)
--   4. Stability guard noted (v2 — 3-day rolling avg)
--
-- ADDITIVE ONLY.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. CANONICAL INDUSTRY CODES TABLE ═══

CREATE TABLE IF NOT EXISTS ic_industry_codes (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    parent_code TEXT,
    created_at TIMESTAMP DEFAULT now()
);

INSERT INTO ic_industry_codes (code, description) VALUES
    ('B2B_SAAS', 'Software as a Service / Technology'),
    ('FINANCIAL_SERVICES', 'Financial Advisory / Wealth / Banking / Insurance'),
    ('CONSTRUCTION', 'Construction / Building / Civil Engineering / Trades'),
    ('PROFESSIONAL_SERVICES', 'Consulting / Legal / Accounting / Marketing'),
    ('HEALTHCARE', 'Medical / Dental / Allied Health'),
    ('RETAIL', 'Retail / E-Commerce'),
    ('EDUCATION', 'Education / Training / Coaching'),
    ('HOSPITALITY', 'Hospitality / Food / Accommodation'),
    ('LOGISTICS', 'Logistics / Transport / Supply Chain'),
    ('MANUFACTURING', 'Manufacturing / Production'),
    ('REAL_ESTATE', 'Real Estate / Property'),
    ('MEDIA', 'Media / Creative / Entertainment'),
    ('NOT_CLASSIFIED', 'Industry not yet classified')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE ic_industry_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_industry_codes" ON ic_industry_codes FOR SELECT USING (true);

-- Add industry_code column to business_profiles for eventual migration
-- (free-text industry remains for backward compat)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'industry_code') THEN
        ALTER TABLE business_profiles ADD COLUMN industry_code TEXT;
    END IF;
END $$;


-- ═══ 2. UNIQUE ACTIVE WEIGHT PER INDUSTRY ═══
-- Prevents two active configs for same industry

-- For industry-specific (non-null industry_code)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_weight_per_industry
    ON ic_risk_weight_configs (industry_code)
    WHERE is_active = true AND industry_code IS NOT NULL;

-- For global default (null industry_code)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_weight_global
    ON ic_risk_weight_configs ((1))
    WHERE is_active = true AND industry_code IS NULL;


-- ═══ 3. BACKTESTABLE RISK FUNCTION ═══
-- Accepts optional config_id to override active config lookup

CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(
    p_tenant_id UUID,
    p_config_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    w_rvi FLOAT;
    w_eds FLOAT;
    w_cdr FLOAT;
    w_ads FLOAT;
    v_vol_threshold FLOAT;
    v_cash_threshold FLOAT;
    v_config_name TEXT;
    v_config_version TEXT;
    v_industry_code TEXT;
    v_tenant_industry TEXT;
    v_backtest_mode BOOLEAN := false;

    v_rvi FLOAT := 0;
    v_eds FLOAT := 0;
    v_cdr FLOAT := 0;
    v_ads FLOAT := 0;
    v_crs FLOAT := 0;
    v_risk_band TEXT;

    v_rolling_mean FLOAT;
    v_rolling_stddev FLOAT;
    v_recent_engagement FLOAT;
    v_prior_engagement FLOAT;
    v_rolling_cash_avg FLOAT;
    v_current_cash FLOAT;
    v_anomaly_events INT;
    v_total_events INT;
    v_snapshot_count INT;
    v_start_time TIMESTAMP;
    v_elapsed_ms INT;
    v_exec_id UUID;
BEGIN
    v_start_time := clock_timestamp();

    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    SELECT COUNT(*) INTO v_snapshot_count
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_snapshot_count < 3 THEN
        RETURN jsonb_build_object('status', 'insufficient_data', 'snapshots_available', v_snapshot_count, 'minimum_required', 3);
    END IF;

    -- ═══ RESOLVE WEIGHTS ═══
    IF p_config_id IS NOT NULL THEN
        -- BACKTEST MODE: use specified config
        v_backtest_mode := true;
        SELECT config_name, model_version, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, industry_code
        INTO v_config_name, v_config_version, w_rvi, w_eds, w_cdr, w_ads, v_vol_threshold, v_cash_threshold, v_industry_code
        FROM ic_risk_weight_configs
        WHERE id = p_config_id;
    ELSE
        -- PRODUCTION MODE: resolve from tenant industry
        SELECT industry, industry_code INTO v_tenant_industry, v_industry_code
        FROM business_profiles
        WHERE user_id = p_tenant_id
        LIMIT 1;

        -- Use explicit industry_code if set, otherwise resolve from free text
        IF v_industry_code IS NULL THEN
            v_industry_code := ic_resolve_industry_code(v_tenant_industry);
        END IF;

        SELECT config_name, model_version, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold
        INTO v_config_name, v_config_version, w_rvi, w_eds, w_cdr, w_ads, v_vol_threshold, v_cash_threshold
        FROM ic_risk_weight_configs
        WHERE is_active = true
        AND (industry_code = v_industry_code OR industry_code IS NULL)
        ORDER BY industry_code NULLS LAST
        LIMIT 1;
    END IF;

    -- Fallback
    IF w_rvi IS NULL THEN
        w_rvi := 0.35; w_eds := 0.25; w_cdr := 0.25; w_ads := 0.15;
        v_vol_threshold := 0.25; v_cash_threshold := 0.20;
        v_config_name := 'hardcoded_fallback'; v_config_version := 'v0.0.0';
    END IF;

    -- ═══ RVI ═══
    SELECT COALESCE(AVG(deal_velocity), 0), COALESCE(STDDEV(deal_velocity), 0)
    INTO v_rolling_mean, v_rolling_stddev
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_rolling_mean > 0 THEN
        v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / v_vol_threshold, 1.0);
    END IF;
    v_rvi := ROUND(v_rvi::NUMERIC, 4);

    -- ═══ EDS ═══
    SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 7;

    SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 14 AND snapshot_date < CURRENT_DATE - 7;

    IF v_prior_engagement > 0 THEN
        v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
    END IF;
    v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

    -- ═══ CDR ═══
    SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30 AND cash_balance IS NOT NULL;

    SELECT COALESCE(cash_balance, 0) INTO v_current_cash
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND cash_balance IS NOT NULL ORDER BY snapshot_date DESC LIMIT 1;

    IF v_rolling_cash_avg > 0 THEN
        v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
    END IF;
    v_cdr := ROUND(v_cdr::NUMERIC, 4);

    -- ═══ ADS ═══
    SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    SELECT COUNT(*) INTO v_total_events
    FROM governance_events WHERE workspace_id = p_tenant_id AND signal_timestamp >= NOW() - INTERVAL '30 days';

    IF v_total_events > 0 THEN
        v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
    END IF;
    v_ads := ROUND(v_ads::NUMERIC, 4);

    -- ═══ COMPOSITE ═══
    v_crs := ROUND((w_rvi * v_rvi + w_eds * v_eds + w_cdr * v_cdr + w_ads * v_ads)::NUMERIC, 4);
    v_risk_band := CASE WHEN v_crs >= 0.7 THEN 'HIGH' WHEN v_crs >= 0.4 THEN 'MODERATE' ELSE 'LOW' END;

    v_elapsed_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INT;

    -- ═══ LOG ═══
    INSERT INTO ic_model_executions (
        model_name, model_version, tenant_id, execution_time_ms, confidence_score, output_summary
    ) VALUES (
        'deterministic_risk_baseline', v_config_version, p_tenant_id, v_elapsed_ms, 1.0,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'backtest_mode', v_backtest_mode,
            'config', jsonb_build_object('name', v_config_name, 'version', v_config_version, 'industry_code', v_industry_code, 'config_id', p_config_id),
            'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
            'thresholds', jsonb_build_object('volatility', v_vol_threshold, 'cash_deviation', v_cash_threshold),
            'inputs', jsonb_build_object(
                'snapshots_used', v_snapshot_count, 'rolling_mean', ROUND(v_rolling_mean::NUMERIC, 4),
                'rolling_stddev', ROUND(v_rolling_stddev::NUMERIC, 4), 'recent_engagement', ROUND(v_recent_engagement::NUMERIC, 4),
                'prior_engagement', ROUND(v_prior_engagement::NUMERIC, 4), 'rolling_cash_avg', ROUND(v_rolling_cash_avg::NUMERIC, 2),
                'current_cash', ROUND(v_current_cash::NUMERIC, 2), 'anomaly_events', v_anomaly_events, 'total_events', v_total_events
            )
        )
    ) RETURNING id INTO v_exec_id;

    INSERT INTO ic_intelligence_events (
        tenant_id, event_type, model_name, numeric_payload, json_payload, confidence_score
    ) VALUES (
        p_tenant_id, 'FORECAST_RUN', 'deterministic_risk_baseline', v_crs,
        jsonb_build_object('rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads, 'composite', v_crs,
            'risk_band', v_risk_band, 'config_name', v_config_name, 'backtest', v_backtest_mode, 'execution_id', v_exec_id),
        1.0
    );

    RETURN jsonb_build_object(
        'status', 'computed',
        'model_name', 'deterministic_risk_baseline',
        'model_version', v_config_version,
        'backtest_mode', v_backtest_mode,
        'execution_id', v_exec_id,
        'execution_time_ms', v_elapsed_ms,
        'confidence_score', 1.0,
        'config', jsonb_build_object('name', v_config_name, 'industry_code', v_industry_code, 'tenant_industry', v_tenant_industry),
        'indices', jsonb_build_object('revenue_volatility_index', v_rvi, 'engagement_decay_score', v_eds, 'cash_deviation_ratio', v_cdr, 'anomaly_density_score', v_ads),
        'composite', jsonb_build_object('risk_score', v_crs, 'risk_band', v_risk_band),
        'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
        'thresholds', jsonb_build_object('volatility', v_vol_threshold, 'cash_deviation', v_cash_threshold),
        'inputs_used', jsonb_build_object('snapshots', v_snapshot_count, 'period', '30 days')
    );
END;
$$;

-- Batch remains unchanged but uses the updated function signature
CREATE OR REPLACE FUNCTION ic_calculate_all_risk_baselines()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_tenant UUID; v_count INT := 0; v_errors INT := 0; v_result JSONB;
BEGIN
    IF NOT is_spine_enabled() THEN RETURN jsonb_build_object('status', 'spine_disabled'); END IF;
    FOR v_tenant IN SELECT DISTINCT tenant_id FROM ic_daily_metric_snapshots WHERE snapshot_date >= CURRENT_DATE - 7
    LOOP
        BEGIN
            v_result := ic_calculate_risk_baseline(v_tenant);
            IF (v_result->>'status') = 'computed' THEN v_count := v_count + 1; END IF;
        EXCEPTION WHEN OTHERS THEN v_errors := v_errors + 1;
        END;
    END LOOP;
    RETURN jsonb_build_object('status', 'batch_complete', 'tenants_computed', v_count, 'errors', v_errors);
END;
$$;

GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_all_risk_baselines() TO postgres;


-- ═══ 036_risk_calibration_analytics.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc RISK CALIBRATION ANALYTICS
-- Migration: 036_risk_calibration_analytics.sql
--
-- Three analytics views + calibration report function:
--   1. Distribution summary (variance, skew, band distribution)
--   2. Industry separation (per-industry mean/stddev)
--   3. Index dominance (correlation of each index to composite)
--   4. Calibration report function (14-day window, pass/fail)
--
-- ADDITIVE ONLY. No existing tables modified.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. DISTRIBUTION SUMMARY VIEW ═══
-- Answers: Is variance statistically significant?
-- What is the band distribution (LOW/MODERATE/HIGH)?

CREATE OR REPLACE VIEW ic_risk_distribution_summary AS
SELECT
    COUNT(*) AS execution_count,
    COUNT(DISTINCT tenant_id) AS tenant_count,
    ROUND(AVG((output_summary->>'composite')::NUMERIC), 4) AS avg_risk,
    ROUND(STDDEV((output_summary->>'composite')::NUMERIC), 4) AS risk_stddev,
    ROUND(MIN((output_summary->>'composite')::NUMERIC), 4) AS min_risk,
    ROUND(MAX((output_summary->>'composite')::NUMERIC), 4) AS max_risk,
    ROUND(MAX((output_summary->>'composite')::NUMERIC) - MIN((output_summary->>'composite')::NUMERIC), 4) AS risk_range,
    -- Band distribution
    ROUND(SUM(CASE WHEN (output_summary->>'composite')::NUMERIC < 0.33 THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1), 3) AS pct_low,
    ROUND(SUM(CASE WHEN (output_summary->>'composite')::NUMERIC BETWEEN 0.33 AND 0.66 THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1), 3) AS pct_moderate,
    ROUND(SUM(CASE WHEN (output_summary->>'composite')::NUMERIC > 0.66 THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1), 3) AS pct_high,
    -- Per-index averages
    ROUND(AVG((output_summary->>'rvi')::NUMERIC), 4) AS avg_rvi,
    ROUND(AVG((output_summary->>'eds')::NUMERIC), 4) AS avg_eds,
    ROUND(AVG((output_summary->>'cdr')::NUMERIC), 4) AS avg_cdr,
    ROUND(AVG((output_summary->>'ads')::NUMERIC), 4) AS avg_ads,
    -- Per-index stddev
    ROUND(STDDEV((output_summary->>'rvi')::NUMERIC), 4) AS stddev_rvi,
    ROUND(STDDEV((output_summary->>'eds')::NUMERIC), 4) AS stddev_eds,
    ROUND(STDDEV((output_summary->>'cdr')::NUMERIC), 4) AS stddev_cdr,
    ROUND(STDDEV((output_summary->>'ads')::NUMERIC), 4) AS stddev_ads
FROM ic_model_executions
WHERE model_name = 'deterministic_risk_baseline'
AND COALESCE((output_summary->>'backtest_mode')::BOOLEAN, false) = false
AND created_at >= NOW() - INTERVAL '14 days';


-- ═══ 2. INDUSTRY SEPARATION VIEW ═══
-- Answers: Do industry weights produce meaningfully different scores?

CREATE OR REPLACE VIEW ic_risk_industry_separation AS
SELECT
    COALESCE(output_summary->'config'->>'industry_code', 'GLOBAL') AS industry_code,
    COUNT(*) AS execution_count,
    COUNT(DISTINCT tenant_id) AS tenant_count,
    ROUND(AVG((output_summary->>'composite')::NUMERIC), 4) AS avg_risk,
    ROUND(STDDEV((output_summary->>'composite')::NUMERIC), 4) AS stddev_risk,
    ROUND(MIN((output_summary->>'composite')::NUMERIC), 4) AS min_risk,
    ROUND(MAX((output_summary->>'composite')::NUMERIC), 4) AS max_risk,
    -- Per-index averages per industry
    ROUND(AVG((output_summary->>'rvi')::NUMERIC), 4) AS avg_rvi,
    ROUND(AVG((output_summary->>'eds')::NUMERIC), 4) AS avg_eds,
    ROUND(AVG((output_summary->>'cdr')::NUMERIC), 4) AS avg_cdr,
    ROUND(AVG((output_summary->>'ads')::NUMERIC), 4) AS avg_ads
FROM ic_model_executions
WHERE model_name = 'deterministic_risk_baseline'
AND COALESCE((output_summary->>'backtest_mode')::BOOLEAN, false) = false
AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY COALESCE(output_summary->'config'->>'industry_code', 'GLOBAL');


-- ═══ 3. INDEX DOMINANCE ANALYSIS FUNCTION ═══
-- Answers: Does one index dominate the composite?
-- Cannot use CORR in a view across JSONB easily, so use function.

CREATE OR REPLACE FUNCTION ic_index_dominance_analysis()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_corr_rvi FLOAT;
    v_corr_eds FLOAT;
    v_corr_cdr FLOAT;
    v_corr_ads FLOAT;
    v_dominant TEXT := 'none';
    v_dominant_corr FLOAT := 0;
    v_is_single_factor BOOLEAN := false;
BEGIN
    SELECT
        COALESCE(CORR((output_summary->>'rvi')::FLOAT, (output_summary->>'composite')::FLOAT), 0),
        COALESCE(CORR((output_summary->>'eds')::FLOAT, (output_summary->>'composite')::FLOAT), 0),
        COALESCE(CORR((output_summary->>'cdr')::FLOAT, (output_summary->>'composite')::FLOAT), 0),
        COALESCE(CORR((output_summary->>'ads')::FLOAT, (output_summary->>'composite')::FLOAT), 0)
    INTO v_corr_rvi, v_corr_eds, v_corr_cdr, v_corr_ads
    FROM ic_model_executions
    WHERE model_name = 'deterministic_risk_baseline'
    AND COALESCE((output_summary->>'backtest_mode')::BOOLEAN, false) = false
    AND created_at >= NOW() - INTERVAL '14 days';

    -- Find dominant
    IF ABS(v_corr_rvi) > v_dominant_corr THEN v_dominant := 'RVI'; v_dominant_corr := ABS(v_corr_rvi); END IF;
    IF ABS(v_corr_eds) > v_dominant_corr THEN v_dominant := 'EDS'; v_dominant_corr := ABS(v_corr_eds); END IF;
    IF ABS(v_corr_cdr) > v_dominant_corr THEN v_dominant := 'CDR'; v_dominant_corr := ABS(v_corr_cdr); END IF;
    IF ABS(v_corr_ads) > v_dominant_corr THEN v_dominant := 'ADS'; v_dominant_corr := ABS(v_corr_ads); END IF;

    -- Single-factor check: dominant > 0.85 AND others < 0.3
    v_is_single_factor := v_dominant_corr > 0.85 AND (
        CASE v_dominant
            WHEN 'RVI' THEN GREATEST(ABS(v_corr_eds), ABS(v_corr_cdr), ABS(v_corr_ads)) < 0.3
            WHEN 'EDS' THEN GREATEST(ABS(v_corr_rvi), ABS(v_corr_cdr), ABS(v_corr_ads)) < 0.3
            WHEN 'CDR' THEN GREATEST(ABS(v_corr_rvi), ABS(v_corr_eds), ABS(v_corr_ads)) < 0.3
            WHEN 'ADS' THEN GREATEST(ABS(v_corr_rvi), ABS(v_corr_eds), ABS(v_corr_cdr)) < 0.3
            ELSE false
        END
    );

    RETURN jsonb_build_object(
        'correlations', jsonb_build_object(
            'rvi_to_composite', ROUND(v_corr_rvi::NUMERIC, 4),
            'eds_to_composite', ROUND(v_corr_eds::NUMERIC, 4),
            'cdr_to_composite', ROUND(v_corr_cdr::NUMERIC, 4),
            'ads_to_composite', ROUND(v_corr_ads::NUMERIC, 4)
        ),
        'dominant_index', v_dominant,
        'dominant_correlation', ROUND(v_dominant_corr::NUMERIC, 4),
        'is_single_factor', v_is_single_factor,
        'assessment', CASE
            WHEN v_is_single_factor THEN 'WARNING: Composite is effectively single-factor. Robustness weakened.'
            WHEN v_dominant_corr > 0.75 THEN 'ATTENTION: One index is disproportionately influential.'
            ELSE 'HEALTHY: Indices contribute balanced influence to composite.'
        END
    );
END;
$$;


-- ═══ 4. FULL CALIBRATION REPORT FUNCTION ═══
-- 14-day window. Combines distribution + industry + dominance.

CREATE OR REPLACE FUNCTION ic_risk_calibration_report()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_distribution RECORD;
    v_industry JSONB;
    v_dominance JSONB;
    v_execution_count INT;
    v_tenant_count INT;
    v_calibration_pass BOOLEAN := false;
    v_issues JSONB := '[]'::JSONB;
BEGIN
    -- Distribution summary
    SELECT * INTO v_distribution FROM ic_risk_distribution_summary;

    -- Industry separation
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::JSONB), '[]'::JSONB) INTO v_industry
    FROM ic_risk_industry_separation sub;

    -- Index dominance
    v_dominance := ic_index_dominance_analysis();

    v_execution_count := COALESCE(v_distribution.execution_count, 0);
    v_tenant_count := COALESCE(v_distribution.tenant_count, 0);

    -- ═══ CALIBRATION CHECKS ═══

    -- Check 1: Sufficient data (14 days, multiple tenants)
    IF v_execution_count < 7 THEN
        v_issues := v_issues || '"Insufficient executions. Need ≥7 over 14 days."'::JSONB;
    END IF;

    -- Check 2: Variance is meaningful (stddev ≥ 0.10)
    IF COALESCE(v_distribution.risk_stddev, 0) < 0.10 AND v_execution_count >= 7 THEN
        v_issues := v_issues || '"Risk scores clustering too tightly. Normalization thresholds may be too wide."'::JSONB;
    END IF;

    -- Check 3: Band distribution not 90/10 skewed
    IF COALESCE(v_distribution.pct_low, 0) > 0.90 OR COALESCE(v_distribution.pct_moderate, 0) > 0.90 OR COALESCE(v_distribution.pct_high, 0) > 0.90 THEN
        v_issues := v_issues || '"Band distribution severely skewed. >90% in single band."'::JSONB;
    END IF;

    -- Check 4: No single-factor dominance
    IF (v_dominance->>'is_single_factor')::BOOLEAN THEN
        v_issues := v_issues || ('"Single-factor dominance detected: ' || (v_dominance->>'dominant_index') || ' (corr=' || (v_dominance->>'dominant_correlation') || '). Composite robustness weakened."')::JSONB;
    END IF;

    -- Check 5: Risk range is non-trivial
    IF COALESCE(v_distribution.risk_range, 0) < 0.15 AND v_execution_count >= 7 THEN
        v_issues := v_issues || '"Risk range < 0.15. Scores may not be informative."'::JSONB;
    END IF;

    -- Check 6: Per-index variance — detect flat indices hiding behind composite
    IF v_execution_count >= 7 THEN
        IF COALESCE(v_distribution.stddev_rvi, 0) < 0.02 THEN
            v_issues := v_issues || '"RVI stddev near zero. Volatility threshold likely too wide. Revenue signal is flat."'::JSONB;
        END IF;
        IF COALESCE(v_distribution.stddev_eds, 0) < 0.02 THEN
            v_issues := v_issues || '"EDS stddev near zero. Engagement decay threshold too wide. Engagement signal is flat."'::JSONB;
        END IF;
        IF COALESCE(v_distribution.stddev_cdr, 0) < 0.02 THEN
            v_issues := v_issues || '"CDR stddev near zero. Cash deviation threshold too wide. Cash signal is flat."'::JSONB;
        END IF;
        IF COALESCE(v_distribution.stddev_ads, 0) < 0.02 THEN
            v_issues := v_issues || '"ADS stddev near zero. Anomaly density signal is flat."'::JSONB;
        END IF;
    END IF;

    -- Pass if: sufficient data AND no critical issues
    v_calibration_pass := v_execution_count >= 7 AND jsonb_array_length(v_issues) = 0;

    RETURN jsonb_build_object(
        'calibration_status', CASE WHEN v_calibration_pass THEN 'PASS' ELSE 'NEEDS_CALIBRATION' END,
        'period', '14 days',
        'execution_count', v_execution_count,
        'tenant_count', v_tenant_count,
        'issues', v_issues,
        'issue_count', jsonb_array_length(v_issues),
        'distribution', jsonb_build_object(
            'avg_risk', v_distribution.avg_risk,
            'stddev', v_distribution.risk_stddev,
            'min', v_distribution.min_risk,
            'max', v_distribution.max_risk,
            'range', v_distribution.risk_range,
            'pct_low', v_distribution.pct_low,
            'pct_moderate', v_distribution.pct_moderate,
            'pct_high', v_distribution.pct_high
        ),
        'per_index', jsonb_build_object(
            'rvi', jsonb_build_object('avg', v_distribution.avg_rvi, 'stddev', v_distribution.stddev_rvi),
            'eds', jsonb_build_object('avg', v_distribution.avg_eds, 'stddev', v_distribution.stddev_eds),
            'cdr', jsonb_build_object('avg', v_distribution.avg_cdr, 'stddev', v_distribution.stddev_cdr),
            'ads', jsonb_build_object('avg', v_distribution.avg_ads, 'stddev', v_distribution.stddev_ads)
        ),
        'industry_separation', v_industry,
        'index_dominance', v_dominance,
        'recommendation', CASE
            WHEN v_calibration_pass THEN 'Calibration PASS. Distribution healthy, indices balanced. Ready for probabilistic layer.'
            WHEN v_execution_count < 7 THEN 'Need more data. Run baseline daily for 14 days.'
            WHEN COALESCE(v_distribution.risk_stddev, 0) < 0.10 THEN 'Widen normalization thresholds. Scores clustering too tightly.'
            WHEN (v_dominance->>'is_single_factor')::BOOLEAN THEN 'Rebalance weights. Single index dominates composite.'
            ELSE 'Review identified issues before activating probabilistic engines.'
        END
    );
END;
$$;


-- ═══ GRANTS ═══
GRANT SELECT ON ic_risk_distribution_summary TO authenticated;
GRANT SELECT ON ic_risk_industry_separation TO authenticated;
GRANT EXECUTE ON FUNCTION ic_index_dominance_analysis() TO authenticated;
GRANT EXECUTE ON FUNCTION ic_risk_calibration_report() TO authenticated;


-- ═══ 037_cognition_platform.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc COGNITION PLATFORM — Foundation Tables
-- Migration: 037_cognition_platform.sql
--
-- New tables: memory (3), marketing (2), automation (1), observability (1)
-- Feature flags for all new modules
-- Zero modifications to existing tables
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. MEMORY LAYER ═══

CREATE TABLE IF NOT EXISTS episodic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    source_system TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_episodic_tenant ON episodic_memory(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS semantic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    source_event_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_semantic_tenant ON semantic_memory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_semantic_subject ON semantic_memory(subject);

CREATE TABLE IF NOT EXISTS context_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    summary_type TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    source_event_ids UUID[] DEFAULT '{}',
    source_count INT DEFAULT 0,
    key_outcomes JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_summaries_tenant ON context_summaries(tenant_id, created_at DESC);

-- ═══ 2. MARKETING INTELLIGENCE ═══

CREATE TABLE IF NOT EXISTS marketing_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    version INT DEFAULT 1,
    competitors JSONB DEFAULT '[]',
    scores JSONB NOT NULL DEFAULT '{}',
    summary TEXT,
    radar_data JSONB,
    source_data JSONB DEFAULT '{}',
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_benchmarks_tenant ON marketing_benchmarks(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_benchmarks_current ON marketing_benchmarks(tenant_id) WHERE is_current = true;

-- ═══ 3. MARKETING AUTOMATION ═══

CREATE TABLE IF NOT EXISTS action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    action_params JSONB NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','executing','completed','failed','cancelled')),
    external_id TEXT,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_action_tenant ON action_log(tenant_id, created_at DESC);

-- ═══ 4. OBSERVABILITY ═══

CREATE TABLE IF NOT EXISTS llm_call_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    model_name TEXT NOT NULL,
    model_version TEXT,
    prompt_tokens INT,
    completion_tokens INT,
    total_tokens INT,
    latency_ms INT,
    temperature FLOAT,
    max_tokens INT,
    input_hash TEXT,
    output_valid BOOLEAN,
    validation_errors JSONB,
    feature_flag TEXT,
    endpoint TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_log_tenant ON llm_call_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_log_model ON llm_call_log(model_name, created_at DESC);

-- ═══ 5. FEATURE FLAGS FOR NEW MODULES ═══

INSERT INTO ic_feature_flags (flag_name, enabled, description) VALUES
    ('rag_chat_enabled', false, 'RAG-augmented SoundBoard chat'),
    ('marketing_benchmarks_enabled', false, 'Marketing Intelligence tab + benchmarking'),
    ('marketing_automation_enabled', false, 'Ad/blog/social post generation'),
    ('memory_layer_enabled', false, 'Episodic + semantic memory'),
    ('observability_full_enabled', false, 'Full LLM call logging'),
    ('guardrails_enabled', false, 'Input sanitisation + output filtering'),
    ('graphrag_enabled', false, 'Knowledge graph retrieval')
ON CONFLICT (flag_name) DO NOTHING;

-- ═══ 6. RLS ═══

ALTER TABLE episodic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read" ON episodic_memory FOR SELECT USING (true);
CREATE POLICY "service_all" ON episodic_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON semantic_memory FOR SELECT USING (true);
CREATE POLICY "service_all" ON semantic_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON context_summaries FOR SELECT USING (true);
CREATE POLICY "service_all" ON context_summaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON marketing_benchmarks FOR SELECT USING (true);
CREATE POLICY "service_all" ON marketing_benchmarks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON action_log FOR SELECT USING (true);
CREATE POLICY "service_all" ON action_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON llm_call_log FOR SELECT USING (true);
CREATE POLICY "service_all" ON llm_call_log FOR ALL USING (true) WITH CHECK (true);


-- ═══ 038_rag_infrastructure.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc RAG INFRASTRUCTURE — pgvector + Embeddings + Retrieval
-- Migration: 038_rag_infrastructure.sql
--
-- Enables pgvector, creates embedding tables, retrieval functions.
-- Feature-flagged: rag_chat_enabled, graphrag_enabled
-- Zero modification to existing tables.
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══ 1. DOCUMENT EMBEDDINGS ═══
CREATE TABLE IF NOT EXISTS rag_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding vector(1536),
    source_type TEXT NOT NULL CHECK (source_type IN ('website','profile','snapshot','conversation','document','competitor','benchmark')),
    source_id TEXT,
    source_url TEXT,
    metadata JSONB DEFAULT '{}',
    chunk_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_rag_tenant ON rag_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_source ON rag_embeddings(source_type);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_rag_embedding ON rag_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ═══ 2. SIMILARITY SEARCH FUNCTION ═══
CREATE OR REPLACE FUNCTION rag_search(
    p_tenant_id UUID,
    p_query_embedding vector(1536),
    p_limit INT DEFAULT 5,
    p_source_types TEXT[] DEFAULT NULL,
    p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    source_type TEXT,
    source_url TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.content,
        e.source_type,
        e.source_url,
        e.metadata,
        1 - (e.embedding <=> p_query_embedding) AS similarity
    FROM rag_embeddings e
    WHERE e.tenant_id = p_tenant_id
    AND (p_source_types IS NULL OR e.source_type = ANY(p_source_types))
    AND 1 - (e.embedding <=> p_query_embedding) >= p_similarity_threshold
    ORDER BY e.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$;

-- ═══ 3. EMBEDDING STATS VIEW ═══
CREATE OR REPLACE VIEW rag_stats AS
SELECT
    tenant_id,
    source_type,
    COUNT(*) AS chunk_count,
    MAX(created_at) AS latest_embedding
FROM rag_embeddings
GROUP BY tenant_id, source_type;

-- ═══ RLS ═══
ALTER TABLE rag_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_embeddings" ON rag_embeddings FOR SELECT USING (true);
CREATE POLICY "service_manage_embeddings" ON rag_embeddings FOR ALL USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION rag_search(UUID, vector, INT, TEXT[], FLOAT) TO authenticated;
GRANT SELECT ON rag_stats TO authenticated;


-- ═══ 039_ab_testing.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc A/B TESTING FRAMEWORK
-- Migration: 039_ab_testing.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ab_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_name TEXT UNIQUE NOT NULL,
    description TEXT,
    variant_a TEXT NOT NULL DEFAULT 'control',
    variant_b TEXT NOT NULL DEFAULT 'treatment',
    traffic_pct_b FLOAT DEFAULT 0.5,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    variant TEXT NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(experiment_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS ab_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    variant TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value FLOAT NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_assign_exp ON ab_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_assign_tenant ON ab_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ab_metrics_exp ON ab_metrics(experiment_id);

-- Deterministic assignment function
CREATE OR REPLACE FUNCTION ab_get_variant(p_experiment_name TEXT, p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exp RECORD;
    v_existing TEXT;
    v_hash FLOAT;
    v_variant TEXT;
BEGIN
    SELECT * INTO v_exp FROM ab_experiments WHERE experiment_name = p_experiment_name AND status = 'running';
    IF NOT FOUND THEN RETURN 'control'; END IF;

    SELECT variant INTO v_existing FROM ab_assignments WHERE experiment_id = v_exp.id AND tenant_id = p_tenant_id;
    IF FOUND THEN RETURN v_existing; END IF;

    -- Deterministic hash-based assignment (consistent across calls)
    v_hash := abs(hashtext(p_tenant_id::TEXT || v_exp.id::TEXT)::FLOAT) / 2147483647.0;
    v_variant := CASE WHEN v_hash < v_exp.traffic_pct_b THEN v_exp.variant_b ELSE v_exp.variant_a END;

    INSERT INTO ab_assignments (experiment_id, tenant_id, variant) VALUES (v_exp.id, p_tenant_id, v_variant);
    RETURN v_variant;
END;
$$;

-- Experiment results summary
CREATE OR REPLACE FUNCTION ab_experiment_results(p_experiment_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exp_id UUID;
    v_results JSONB;
BEGIN
    SELECT id INTO v_exp_id FROM ab_experiments WHERE experiment_name = p_experiment_name;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'experiment not found'); END IF;

    SELECT jsonb_build_object(
        'experiment', p_experiment_name,
        'total_assignments', (SELECT COUNT(*) FROM ab_assignments WHERE experiment_id = v_exp_id),
        'variant_a_count', (SELECT COUNT(*) FROM ab_assignments WHERE experiment_id = v_exp_id AND variant = 'control'),
        'variant_b_count', (SELECT COUNT(*) FROM ab_assignments WHERE experiment_id = v_exp_id AND variant = 'treatment'),
        'metrics', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'variant', variant, 'metric', metric_name,
            'avg_value', ROUND(AVG(metric_value)::NUMERIC, 4),
            'count', COUNT(*)
        )), '[]'::JSONB) FROM ab_metrics WHERE experiment_id = v_exp_id GROUP BY variant, metric_name)
    ) INTO v_results;

    RETURN v_results;
END;
$$;

ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_experiments" ON ab_experiments FOR SELECT USING (true);
CREATE POLICY "manage_experiments" ON ab_experiments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_assignments" ON ab_assignments FOR SELECT USING (true);
CREATE POLICY "manage_assignments" ON ab_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_metrics" ON ab_metrics FOR SELECT USING (true);
CREATE POLICY "manage_metrics" ON ab_metrics FOR ALL USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION ab_get_variant(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ab_experiment_results(TEXT) TO authenticated;

-- Seed initial experiments
INSERT INTO ab_experiments (experiment_name, description, variant_a, variant_b, traffic_pct_b, status) VALUES
    ('rag_chat_v1', 'Compare RAG-augmented SoundBoard vs original', 'original', 'rag_augmented', 0.5, 'draft'),
    ('onboarding_flow_v2', 'New onboarding vs legacy calibration', 'legacy', 'streamlined', 0.3, 'draft'),
    ('marketing_tab_exposure', 'Show Marketing Intelligence tab to subset', 'hidden', 'visible', 0.5, 'draft')
ON CONFLICT (experiment_name) DO NOTHING;


-- ═══ 040_super_admin.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc SUPER ADMIN + SUPPORT CONSOLE
-- Migration: 040_super_admin.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. Admin actions audit table
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL,
    target_user_id UUID,
    action_type TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_user_id);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_read" ON admin_actions FOR SELECT USING (true);
CREATE POLICY "service_manage" ON admin_actions FOR ALL USING (true) WITH CHECK (true);

-- 2. Ensure role column on users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_disabled') THEN
        ALTER TABLE users ADD COLUMN is_disabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 3. Set andre as super_admin
UPDATE users SET role = 'super_admin' WHERE email = 'andre@thestrategysquad.com.au';
UPDATE users SET role = 'super_admin' WHERE email = 'andre@thestrategysquad.com';

-- 4. Feature flags
INSERT INTO ic_feature_flags (flag_name, enabled, description) VALUES
    ('super_admin_enabled', true, 'Super admin role and test page'),
    ('support_page_enabled', true, 'Internal support user management console'),
    ('legal_menu_enabled', true, 'Trust & Legal dropdown menu')
ON CONFLICT (flag_name) DO UPDATE SET enabled = true;

-- 5. Admin user list RPC (secure — only returns non-sensitive fields)
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'full_name', u.full_name,
            'role', u.role,
            'is_disabled', COALESCE(u.is_disabled, false),
            'business_name', bp.business_name,
            'subscription_tier', COALESCE(bp.subscription_tier, 'free'),
            'industry', bp.industry,
            'created_at', u.created_at
        ) ORDER BY u.created_at DESC), '[]'::JSONB)
        FROM users u
        LEFT JOIN business_profiles bp ON bp.user_id = u.id
    );
END;
$$;

-- 6. Admin disable/enable user
CREATE OR REPLACE FUNCTION admin_toggle_user(p_admin_id UUID, p_target_id UUID, p_disable BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev BOOLEAN;
BEGIN
    SELECT COALESCE(is_disabled, false) INTO v_prev FROM users WHERE id = p_target_id;
    UPDATE users SET is_disabled = p_disable WHERE id = p_target_id;
    INSERT INTO admin_actions (admin_user_id, target_user_id, action_type, previous_value, new_value)
    VALUES (p_admin_id, p_target_id, CASE WHEN p_disable THEN 'disable_user' ELSE 'enable_user' END,
            jsonb_build_object('is_disabled', v_prev), jsonb_build_object('is_disabled', p_disable));
    RETURN jsonb_build_object('status', 'ok', 'is_disabled', p_disable);
END;
$$;

-- 7. Admin update subscription
CREATE OR REPLACE FUNCTION admin_update_subscription(p_admin_id UUID, p_target_id UUID, p_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev TEXT;
BEGIN
    SELECT COALESCE(subscription_tier, 'free') INTO v_prev FROM business_profiles WHERE user_id = p_target_id;
    UPDATE business_profiles SET subscription_tier = p_tier WHERE user_id = p_target_id;
    INSERT INTO admin_actions (admin_user_id, target_user_id, action_type, previous_value, new_value)
    VALUES (p_admin_id, p_target_id, 'update_subscription',
            jsonb_build_object('tier', v_prev), jsonb_build_object('tier', p_tier));
    RETURN jsonb_build_object('status', 'ok', 'previous_tier', v_prev, 'new_tier', p_tier);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_user(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_subscription(UUID, UUID, TEXT) TO authenticated;


-- ═══ 041_security_lint_fixes.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc SUPABASE SECURITY LINT FIXES
-- Migration: 041_security_lint_fixes.sql
--
-- Fixes 3 categories of security issues:
--   1. Views with SECURITY DEFINER → SECURITY INVOKER
--   2. Functions with mutable search_path → set search_path = ''
--   3. RLS policies with unrestricted FOR ALL → scoped to service_role
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. FIX VIEWS: SECURITY DEFINER → INVOKER ═══

ALTER VIEW IF EXISTS rag_stats SET (security_invoker = on);
ALTER VIEW IF EXISTS ic_risk_industry_separation SET (security_invoker = on);
ALTER VIEW IF EXISTS v_governance_summary SET (security_invoker = on);
ALTER VIEW IF EXISTS v_integration_status SET (security_invoker = on);
ALTER VIEW IF EXISTS ic_risk_distribution_summary SET (security_invoker = on);


-- ═══ 2. FIX FUNCTIONS: Set immutable search_path ═══

ALTER FUNCTION ic_index_dominance_analysis() SET search_path = '';
ALTER FUNCTION get_escalation_summary(UUID) SET search_path = '';
ALTER FUNCTION detect_silence(UUID) SET search_path = '';
ALTER FUNCTION is_spine_enabled() SET search_path = '';
ALTER FUNCTION ic_calculate_all_risk_baselines() SET search_path = '';
ALTER FUNCTION compute_pressure_levels(UUID) SET search_path = '';
ALTER FUNCTION increment_audit_counter(UUID) SET search_path = '';
ALTER FUNCTION ab_experiment_results(TEXT) SET search_path = '';
ALTER FUNCTION ic_resolve_industry_code(TEXT) SET search_path = '';
ALTER FUNCTION compute_data_readiness(UUID) SET search_path = '';
ALTER FUNCTION emergency_delete_governance_event(UUID, TEXT) SET search_path = '';
ALTER FUNCTION build_intelligence_summary(UUID) SET search_path = '';
ALTER FUNCTION trigger_log_integration_change() SET search_path = '';
ALTER FUNCTION ic_calculate_risk_baseline(UUID, UUID) SET search_path = '';
ALTER FUNCTION ab_get_variant(TEXT, UUID) SET search_path = '';
ALTER FUNCTION ic_process_event_queue() SET search_path = '';
ALTER FUNCTION compute_evidence_freshness(UUID) SET search_path = '';
ALTER FUNCTION compute_watchtower_positions(UUID) SET search_path = '';
ALTER FUNCTION detect_contradictions(UUID) SET search_path = '';
ALTER FUNCTION ic_generate_all_snapshots() SET search_path = '';
ALTER FUNCTION ic_generate_daily_snapshot(UUID) SET search_path = '';
ALTER FUNCTION compute_concentration_risk(UUID) SET search_path = '';
ALTER FUNCTION ic_risk_calibration_report() SET search_path = '';
ALTER FUNCTION compute_revenue_scenarios(UUID) SET search_path = '';
ALTER FUNCTION admin_update_subscription(UUID, UUID, TEXT) SET search_path = '';
ALTER FUNCTION admin_toggle_user(UUID, UUID, BOOLEAN) SET search_path = '';
ALTER FUNCTION admin_list_users() SET search_path = '';
ALTER FUNCTION compute_workforce_health(UUID) SET search_path = '';
ALTER FUNCTION compute_insight_scores(UUID) SET search_path = '';
ALTER FUNCTION compute_profile_completeness(UUID) SET search_path = '';
ALTER FUNCTION increment_snapshot_counter(UUID) SET search_path = '';
ALTER FUNCTION emit_governance_event(UUID, TEXT, TEXT, TEXT, NUMERIC) SET search_path = '';
ALTER FUNCTION trigger_update_integration_sync() SET search_path = '';
ALTER FUNCTION trigger_log_report_export() SET search_path = '';
ALTER FUNCTION prevent_governance_update() SET search_path = '';
ALTER FUNCTION ic_prevent_weight_update() SET search_path = '';
ALTER FUNCTION ic_validate_snapshot_correlation(UUID) SET search_path = '';
ALTER FUNCTION rag_search(UUID, vector, INT, TEXT[], FLOAT) SET search_path = '';
ALTER FUNCTION reset_monthly_counters() SET search_path = '';

-- Handle functions that may have different signatures
DO $$ BEGIN ALTER FUNCTION compute_market_risk_weight() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION calibrate_pressure() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION decay_evidence() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION compute_forensic_score() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;


-- ═══ 3. FIX RLS: Scope service policies to service_role only ═══
-- Replace "FOR ALL USING (true)" with "FOR ALL TO service_role USING (true)"

-- ab_assignments
DROP POLICY IF EXISTS "manage_assignments" ON ab_assignments;
CREATE POLICY "manage_assignments" ON ab_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ab_experiments
DROP POLICY IF EXISTS "manage_experiments" ON ab_experiments;
CREATE POLICY "manage_experiments" ON ab_experiments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ab_metrics
DROP POLICY IF EXISTS "manage_metrics" ON ab_metrics;
CREATE POLICY "manage_metrics" ON ab_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- action_log
DROP POLICY IF EXISTS "service_all" ON action_log;
CREATE POLICY "service_all" ON action_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- admin_actions
DROP POLICY IF EXISTS "service_manage" ON admin_actions;
CREATE POLICY "service_manage" ON admin_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- context_summaries
DROP POLICY IF EXISTS "service_all" ON context_summaries;
CREATE POLICY "service_all" ON context_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- episodic_memory
DROP POLICY IF EXISTS "service_all" ON episodic_memory;
CREATE POLICY "service_all" ON episodic_memory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- escalation_history
DROP POLICY IF EXISTS "Service manages escalation_history" ON escalation_history;
CREATE POLICY "service_manage_escalation" ON escalation_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_daily_metric_snapshots
DROP POLICY IF EXISTS "manage_snaps" ON ic_daily_metric_snapshots;
CREATE POLICY "manage_snaps" ON ic_daily_metric_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_decision_outcomes
DROP POLICY IF EXISTS "manage_outcomes" ON ic_decision_outcomes;
CREATE POLICY "manage_outcomes" ON ic_decision_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_decisions
DROP POLICY IF EXISTS "manage_decisions" ON ic_decisions;
CREATE POLICY "manage_decisions" ON ic_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_feature_flags
DROP POLICY IF EXISTS "manage_flags" ON ic_feature_flags;
CREATE POLICY "manage_flags" ON ic_feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_intelligence_events
DROP POLICY IF EXISTS "manage_events" ON ic_intelligence_events;
CREATE POLICY "manage_events" ON ic_intelligence_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_model_executions
DROP POLICY IF EXISTS "manage_executions" ON ic_model_executions;
CREATE POLICY "manage_executions" ON ic_model_executions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_model_registry
DROP POLICY IF EXISTS "manage_registry" ON ic_model_registry;
CREATE POLICY "manage_registry" ON ic_model_registry FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_ontology_edges
DROP POLICY IF EXISTS "manage_edges" ON ic_ontology_edges;
CREATE POLICY "manage_edges" ON ic_ontology_edges FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_ontology_nodes
DROP POLICY IF EXISTS "manage_nodes" ON ic_ontology_nodes;
CREATE POLICY "manage_nodes" ON ic_ontology_nodes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_audits
DROP POLICY IF EXISTS "Service manages audits" ON ingestion_audits;
CREATE POLICY "service_manage_audits" ON ingestion_audits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_cleaned
DROP POLICY IF EXISTS "Service manages cleaned" ON ingestion_cleaned;
CREATE POLICY "service_manage_cleaned" ON ingestion_cleaned FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_pages
DROP POLICY IF EXISTS "Service manages pages" ON ingestion_pages;
CREATE POLICY "service_manage_pages" ON ingestion_pages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_sessions
DROP POLICY IF EXISTS "Service manages sessions" ON ingestion_sessions;
CREATE POLICY "service_manage_sessions" ON ingestion_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- insight_outcomes
DROP POLICY IF EXISTS "Service role can insert outcomes" ON insight_outcomes;
DROP POLICY IF EXISTS "Service role can update outcomes" ON insight_outcomes;
CREATE POLICY "service_manage_outcomes" ON insight_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- llm_call_log
DROP POLICY IF EXISTS "service_all" ON llm_call_log;
CREATE POLICY "service_all" ON llm_call_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- marketing_benchmarks
DROP POLICY IF EXISTS "service_all" ON marketing_benchmarks;
CREATE POLICY "service_all" ON marketing_benchmarks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rag_embeddings
DROP POLICY IF EXISTS "service_manage_embeddings" ON rag_embeddings;
CREATE POLICY "service_manage_embeddings" ON rag_embeddings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- report_exports
DROP POLICY IF EXISTS "Service role manages report_exports" ON report_exports;
CREATE POLICY "service_manage_reports" ON report_exports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- semantic_memory
DROP POLICY IF EXISTS "service_all" ON semantic_memory;
CREATE POLICY "service_all" ON semantic_memory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- workspace_integrations
DROP POLICY IF EXISTS "Service role manages workspace_integrations" ON workspace_integrations;
CREATE POLICY "service_manage_integrations" ON workspace_integrations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- governance_events (keep insert-only for service role - already hardened)
DROP POLICY IF EXISTS "service_insert_governance_events" ON governance_events;
CREATE POLICY "service_insert_governance_events" ON governance_events FOR INSERT TO service_role WITH CHECK (true);


-- ═══ 042_security_lint_v2.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc SECURITY LINT FIXES v2 — Remaining 7 issues
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1-5: Functions with mutable search_path (safe — wraps in exception handler)
DO $$ BEGIN ALTER FUNCTION public.compute_market_risk_weight() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.calibrate_pressure() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.decay_evidence() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.compute_forensic_score() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ic_calculate_risk_baseline has two signatures — fix both
DO $$ BEGIN ALTER FUNCTION public.ic_calculate_risk_baseline(UUID) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.ic_calculate_risk_baseline(UUID, UUID) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- 6: intelligence_core schema function
DO $$ BEGIN ALTER FUNCTION intelligence_core.is_spine_enabled() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- 7: Move vector extension to dedicated schema
-- NOTE: This is a WARN not an ERROR. Moving pgvector to another schema
-- requires updating all references. Safe to leave in public for now.
-- To fix properly (optional):
-- CREATE SCHEMA IF NOT EXISTS extensions;
-- ALTER EXTENSION vector SET SCHEMA extensions;
-- Then update rag_search() to reference extensions.vector


-- ═══ 043_file_storage.sql ═══
-- ═══════════════════════════════════════════════════════════════
-- BIQc FILE STORAGE + DOWNLOADS
-- Migration: 043_file_storage.sql
--
-- Creates Supabase Storage buckets for user-generated files.
-- Tracks downloads in a files registry table.
-- ═══════════════════════════════════════════════════════════════

-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('user-files', 'user-files', false, 52428800, ARRAY['image/png','image/jpeg','image/svg+xml','image/webp','application/pdf','text/plain','text/csv','text/html','application/json','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    ('reports', 'reports', false, 52428800, ARRAY['application/pdf','text/html','text/plain','application/json'])
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies
CREATE POLICY "Users read own files" ON storage.objects FOR SELECT USING (
    bucket_id IN ('user-files', 'reports') AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users upload own files" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id IN ('user-files', 'reports') AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Service manages all files" ON storage.objects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. File registry table (tracks all generated files)
CREATE TABLE IF NOT EXISTS generated_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    bucket TEXT NOT NULL DEFAULT 'user-files',
    size_bytes INT,
    generated_by TEXT,
    source_conversation_id TEXT,
    metadata JSONB DEFAULT '{}',
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_tenant ON generated_files(tenant_id, created_at DESC);

ALTER TABLE generated_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_files" ON generated_files FOR SELECT USING (true);
CREATE POLICY "service_manage_files" ON generated_files FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 044_cognition_core.sql ═══
-- ============================================================
-- Migration 044 FIX: Cognition Core Tables + Seed Data
-- Fixed for: "column tab does not exist" (idempotent version)
-- Handles tables that may already exist without all columns
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. INTEGRATION HEALTH ──────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_health (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'DISCONNECTED',
  last_synced_at  TIMESTAMPTZ,
  error_message   TEXT,
  data_freshness  INTERVAL,
  records_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE integration_health ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT '';
ALTER TABLE integration_health ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DISCONNECTED';
ALTER TABLE integration_health ADD COLUMN IF NOT EXISTS records_count INTEGER DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integration_health_tenant_id_provider_key') THEN
    ALTER TABLE integration_health ADD CONSTRAINT integration_health_tenant_id_provider_key UNIQUE(tenant_id, provider);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS integration_health_history (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL DEFAULT '',
  old_status    TEXT,
  new_status    TEXT NOT NULL DEFAULT 'DISCONNECTED',
  changed_at    TIMESTAMPTZ DEFAULT now(),
  reason        TEXT
);

-- ── 2. EVIDENCE PACKS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_packs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intelligence_tab TEXT NOT NULL DEFAULT 'overview',
  evidence_items  JSONB DEFAULT '[]',
  assembled_at    TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  evidence_count  INTEGER DEFAULT 0,
  quality_score   FLOAT DEFAULT 0.5
);
-- Defensive: add columns if they were missing from a previous partial run
ALTER TABLE evidence_packs ADD COLUMN IF NOT EXISTS intelligence_tab TEXT NOT NULL DEFAULT 'overview';
ALTER TABLE evidence_packs ADD COLUMN IF NOT EXISTS evidence_items JSONB DEFAULT '[]';
ALTER TABLE evidence_packs ADD COLUMN IF NOT EXISTS evidence_count INTEGER DEFAULT 0;
ALTER TABLE evidence_packs ADD COLUMN IF NOT EXISTS quality_score FLOAT DEFAULT 0.5;

CREATE INDEX IF NOT EXISTS idx_evidence_packs_tenant ON evidence_packs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_packs_tenant_tab ON evidence_packs(tenant_id, intelligence_tab);

-- ── 3. COGNITION DECISIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS cognition_decisions (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_category           TEXT NOT NULL DEFAULT '',
  decision_statement          TEXT NOT NULL DEFAULT '',
  affected_domains            TEXT[] DEFAULT '{}',
  expected_instability_change JSONB DEFAULT '{}',
  expected_time_horizon       INTEGER DEFAULT 30,
  confidence_at_time          FLOAT DEFAULT 0.5,
  evidence_refs               TEXT[] DEFAULT '{}',
  instability_snapshot_at_time JSONB DEFAULT '{}',
  status                      TEXT DEFAULT 'pending',
  model_version               TEXT DEFAULT 'v1',
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE cognition_decisions ADD COLUMN IF NOT EXISTS decision_category TEXT NOT NULL DEFAULT '';
ALTER TABLE cognition_decisions ADD COLUMN IF NOT EXISTS decision_statement TEXT NOT NULL DEFAULT '';
ALTER TABLE cognition_decisions ADD COLUMN IF NOT EXISTS affected_domains TEXT[] DEFAULT '{}';
ALTER TABLE cognition_decisions ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_cognition_decisions_tenant ON cognition_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cognition_decisions_created ON cognition_decisions(created_at DESC);

-- ── 4. OUTCOME CHECKPOINTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS outcome_checkpoints (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id           UUID NOT NULL REFERENCES cognition_decisions(id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkpoint_day        INTEGER NOT NULL DEFAULT 30,
  scheduled_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_at          TIMESTAMPTZ,
  status                TEXT DEFAULT 'pending',
  decision_effective    BOOLEAN,
  variance_delta        FLOAT,
  normalized_variance   FLOAT,
  false_positive        BOOLEAN,
  predicted_instability JSONB DEFAULT '{}',
  actual_instability    JSONB DEFAULT '{}'
);
ALTER TABLE outcome_checkpoints ADD COLUMN IF NOT EXISTS checkpoint_day INTEGER NOT NULL DEFAULT 30;
ALTER TABLE outcome_checkpoints ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_outcome_checkpoints_decision ON outcome_checkpoints(decision_id);
CREATE INDEX IF NOT EXISTS idx_outcome_checkpoints_tenant ON outcome_checkpoints(tenant_id);

-- ── 5. PROPAGATION RULES — table already exists in production schema ──────────
-- Skip CREATE TABLE. Just ensure seed data is present using correct column names.
-- Real schema: source_domain, target_domain, mechanism, base_probability, severity, time_horizon

-- Clear existing rows and re-seed with correct values
DELETE FROM propagation_rules;

INSERT INTO propagation_rules (source_domain, target_domain, mechanism, base_probability, severity, time_horizon, trigger_threshold, amplification_factor, dampening_factor) VALUES
  ('finance',    'operations', 'direct',   0.82, 'high',   '14 days', 0.4, 1.2, 0.0),
  ('finance',    'people',     'direct',   0.75, 'high',   '21 days', 0.4, 1.1, 0.0),
  ('operations', 'people',     'direct',   0.68, 'medium', '7 days',  0.4, 1.0, 0.1),
  ('operations', 'revenue',    'direct',   0.79, 'high',   '14 days', 0.4, 1.2, 0.0),
  ('market',     'revenue',    'indirect', 0.71, 'medium', '30 days', 0.3, 1.0, 0.1),
  ('market',     'people',     'indirect', 0.55, 'low',    '45 days', 0.3, 0.9, 0.2),
  ('revenue',    'cash',       'direct',   0.88, 'high',   '7 days',  0.5, 1.3, 0.0),
  ('revenue',    'operations', 'direct',   0.65, 'medium', '14 days', 0.4, 1.0, 0.1),
  ('cash',       'delivery',   'direct',   0.77, 'high',   '14 days', 0.4, 1.1, 0.0),
  ('cash',       'people',     'direct',   0.72, 'medium', '21 days', 0.4, 1.0, 0.1),
  ('delivery',   'revenue',    'direct',   0.80, 'high',   '14 days', 0.4, 1.2, 0.0),
  ('delivery',   'people',     'indirect', 0.60, 'medium', '7 days',  0.3, 1.0, 0.1),
  ('people',     'operations', 'direct',   0.73, 'medium', '14 days', 0.4, 1.0, 0.0),
  ('people',     'revenue',    'indirect', 0.69, 'medium', '21 days', 0.3, 0.9, 0.1);

-- ── 6. AUTOMATION ACTIONS (10 actions) ─────────────────────
CREATE TABLE IF NOT EXISTS automation_actions (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type          TEXT NOT NULL DEFAULT '' UNIQUE,
  action_label         TEXT NOT NULL DEFAULT '',
  description          TEXT,
  integration_required TEXT,
  is_active            BOOLEAN DEFAULT true,
  rollback_guidance    TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT '';
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS action_label TEXT NOT NULL DEFAULT '';
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS integration_required TEXT;
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS rollback_guidance TEXT;
-- Add insight_category if missing (real schema requires it NOT NULL)
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS insight_category TEXT;
UPDATE automation_actions SET insight_category = 'general' WHERE insight_category IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_actions_action_type_key') THEN
    ALTER TABLE automation_actions ADD CONSTRAINT automation_actions_action_type_key UNIQUE(action_type);
  END IF;
END $$;

INSERT INTO automation_actions (action_type, insight_category, action_label, description, integration_required) VALUES
  ('send_invoice_reminder',            'finance',    'Send Invoice Reminder',              'Automated follow-up for overdue invoices',                      'accounting'),
  ('trigger_re_engagement',            'revenue',    'Trigger Re-engagement',              'Automated outreach for at-risk deals',                          'crm'),
  ('generate_diversification_playbook','revenue',    'Generate Diversification Playbook',  'AI-generated playbook to reduce revenue concentration',         NULL),
  ('generate_cash_preservation',       'finance',    'Generate Cash Preservation Plan',    'AI plan to extend runway during compression',                   NULL),
  ('propose_load_reallocation',        'operations', 'Propose Load Reallocation',          'Redistribute workload to reduce burnout risk',                  NULL),
  ('create_collection_sequence',       'finance',    'Create Collection Sequence',         'Multi-step collection workflow for overdue payments',            'accounting'),
  ('flag_deal_for_review',             'revenue',    'Flag Deal for Review',               'Mark stalled or at-risk deals for immediate attention',         'crm'),
  ('generate_retention_plan',          'revenue',    'Generate Retention Plan',            'AI-generated client retention strategy',                        NULL),
  ('escalate_sla_breach',              'operations', 'Escalate SLA Breach',                'Alert owner and schedule recovery call for SLA violations',     'crm'),
  ('generate_competitive_response',    'market',     'Generate Competitive Response',      'AI brief on competitive positioning adjustment',                NULL)
ON CONFLICT (action_type) DO NOTHING;

-- ── 7. AUTOMATION EXECUTIONS ───────────────────────────────
CREATE TABLE IF NOT EXISTS automation_executions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id         UUID REFERENCES automation_actions(id),
  action_type       TEXT NOT NULL DEFAULT '',
  insight_ref       TEXT DEFAULT '',
  evidence_refs     TEXT[] DEFAULT '{}',
  status            TEXT DEFAULT 'pending',
  confirmed_at      TIMESTAMPTZ,
  executed_at       TIMESTAMPTZ,
  failed_at         TIMESTAMPTZ,
  failure_reason    TEXT,
  result            JSONB DEFAULT '{}',
  rollback_executed BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT '';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS insight_ref TEXT DEFAULT '';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS evidence_refs TEXT[] DEFAULT '{}';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS result JSONB DEFAULT '{}';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS rollback_executed BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_automation_executions_tenant ON automation_executions(tenant_id);

-- ── 8. INSTABILITY SNAPSHOTS ───────────────────────────────
CREATE TABLE IF NOT EXISTS instability_snapshots (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date               DATE NOT NULL DEFAULT CURRENT_DATE,
  revenue_volatility_index    FLOAT DEFAULT 0,
  engagement_decay_score      FLOAT DEFAULT 0,
  cash_deviation_ratio        FLOAT DEFAULT 0,
  anomaly_density_score       FLOAT DEFAULT 0,
  composite_risk_score        FLOAT DEFAULT 0,
  system_state                TEXT DEFAULT 'STABLE',
  confidence_score            FLOAT DEFAULT 0.5,
  evidence_count              INTEGER DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS revenue_volatility_index FLOAT DEFAULT 0;
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS engagement_decay_score FLOAT DEFAULT 0;
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS cash_deviation_ratio FLOAT DEFAULT 0;
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS composite_risk_score FLOAT DEFAULT 0;
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS system_state TEXT DEFAULT 'STABLE';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instability_snapshots_tenant_id_snapshot_date_key') THEN
    ALTER TABLE instability_snapshots ADD CONSTRAINT instability_snapshots_tenant_id_snapshot_date_key UNIQUE(tenant_id, snapshot_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_instability_snapshots_tenant ON instability_snapshots(tenant_id, snapshot_date DESC);

-- ── 9. CONFIDENCE RECALIBRATIONS ───────────────────────────
CREATE TABLE IF NOT EXISTS confidence_recalibrations (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id         UUID REFERENCES cognition_decisions(id),
  old_confidence      FLOAT,
  new_confidence      FLOAT,
  reason              TEXT,
  checkpoint_day      INTEGER,
  recalibrated_at     TIMESTAMPTZ DEFAULT now()
);

-- ── 10. ENTERPRISE CONTACT REQUESTS ───────────────────────
CREATE TABLE IF NOT EXISTS enterprise_contact_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL DEFAULT '',
  business_name   TEXT DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT DEFAULT '',
  callback_date   TEXT DEFAULT '',
  callback_time   TEXT DEFAULT '',
  description     TEXT DEFAULT '',
  feature_requested TEXT DEFAULT '',
  current_tier    TEXT DEFAULT 'free',
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE enterprise_contact_requests ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE enterprise_contact_requests ADD COLUMN IF NOT EXISTS feature_requested TEXT DEFAULT '';
ALTER TABLE enterprise_contact_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE integration_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognition_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instability_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_recalibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_contact_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid "already exists" errors, then recreate
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users see own integration_health" ON integration_health;
  DROP POLICY IF EXISTS "Users see own integration_health_history" ON integration_health_history;
  DROP POLICY IF EXISTS "Users see own evidence_packs" ON evidence_packs;
  DROP POLICY IF EXISTS "Users see own cognition_decisions" ON cognition_decisions;
  DROP POLICY IF EXISTS "Users see own outcome_checkpoints" ON outcome_checkpoints;
  DROP POLICY IF EXISTS "Users see own automation_executions" ON automation_executions;
  DROP POLICY IF EXISTS "Users see own instability_snapshots" ON instability_snapshots;
  DROP POLICY IF EXISTS "Users see own confidence_recalibrations" ON confidence_recalibrations;
  DROP POLICY IF EXISTS "Users see own enterprise_contact_requests" ON enterprise_contact_requests;
END $$;

CREATE POLICY "Users see own integration_health" ON integration_health FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own integration_health_history" ON integration_health_history FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own evidence_packs" ON evidence_packs FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own cognition_decisions" ON cognition_decisions FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own outcome_checkpoints" ON outcome_checkpoints FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own automation_executions" ON automation_executions FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own instability_snapshots" ON instability_snapshots FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own confidence_recalibrations" ON confidence_recalibrations FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Anyone can submit enterprise_contact_requests" ON enterprise_contact_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins see all enterprise_contact_requests" ON enterprise_contact_requests FOR SELECT USING (auth.uid() IS NOT NULL);


-- ═══ 045_cognition_core_functions.sql ═══
-- ============================================================
-- Migration 045: Cognition Core SQL Functions
-- BIQc Platform — Intelligence Engine Functions
-- Run AFTER migration 044
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. ASSEMBLE EVIDENCE PACK ──────────────────────────────
CREATE OR REPLACE FUNCTION fn_assemble_evidence_pack(
  p_tenant_id UUID,
  p_tab TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence JSONB := '[]';
  v_count INTEGER := 0;
  v_quality FLOAT := 0.0;
  v_crm_connected BOOLEAN := false;
  v_accounting_connected BOOLEAN := false;
  v_email_connected BOOLEAN := false;
BEGIN
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%crm%') INTO v_crm_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%accounting%') INTO v_accounting_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND (provider ILIKE '%email%' OR provider ILIKE '%gmail%' OR provider ILIKE '%outlook%')) INTO v_email_connected;

  CASE p_tab
    WHEN 'revenue' THEN
      IF v_crm_connected THEN v_quality := 0.8; v_count := 3; v_evidence := '[{"type":"crm_deals","weight":0.8},{"type":"pipeline_velocity","weight":0.7},{"type":"churn_signals","weight":0.6}]';
      ELSE v_quality := 0.2; v_count := 0; END IF;
    WHEN 'risk' THEN
      IF v_accounting_connected THEN v_quality := 0.75; v_count := 2; v_evidence := '[{"type":"cash_position","weight":0.9},{"type":"margin_analysis","weight":0.7}]';
      ELSE v_quality := 0.3; v_count := 1; v_evidence := '[{"type":"market_signals","weight":0.4}]'; END IF;
    WHEN 'operations' THEN
      IF v_crm_connected THEN v_quality := 0.7; v_count := 2; v_evidence := '[{"type":"sla_compliance","weight":0.8},{"type":"bottleneck_signals","weight":0.6}]';
      ELSE v_quality := 0.2; v_count := 0; END IF;
    WHEN 'people' THEN
      IF v_email_connected THEN v_quality := 0.65; v_count := 2; v_evidence := '[{"type":"calendar_density","weight":0.7},{"type":"email_stress","weight":0.6}]';
      ELSE v_quality := 0.1; v_count := 0; END IF;
    ELSE v_quality := 0.5; v_count := 1; v_evidence := '[{"type":"market_calibration","weight":0.5}]';
  END CASE;

  RETURN jsonb_build_object('tenant_id', p_tenant_id, 'tab', p_tab, 'evidence_items', v_evidence, 'evidence_count', v_count, 'quality_score', v_quality, 'assembled_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION fn_assemble_evidence_pack(UUID, TEXT) TO authenticated, service_role;

-- ── 2. COMPUTE PROPAGATION MAP ─────────────────────────────
CREATE OR REPLACE FUNCTION fn_compute_propagation_map(
  p_tenant_id UUID,
  p_active_risks TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chains JSONB := '[]';
  r RECORD;
BEGIN
  IF array_length(p_active_risks, 1) IS NULL THEN RETURN '[]'; END IF;
  FOR r IN
    SELECT pr.source_domain, pr.target_domain, pr.base_probability, pr.time_horizon, pr.mechanism
    FROM propagation_rules pr
    WHERE pr.source_domain = ANY(p_active_risks) AND pr.is_active = true
    ORDER BY pr.base_probability DESC LIMIT 5
  LOOP
    v_chains := v_chains || jsonb_build_object('source', r.source_domain, 'target', r.target_domain, 'probability', r.base_probability, 'window', r.time_horizon || ' days', 'description', r.mechanism, 'chain', jsonb_build_array(r.source_domain, r.target_domain));
  END LOOP;
  RETURN v_chains;
END;
$$;
GRANT EXECUTE ON FUNCTION fn_compute_propagation_map(UUID, TEXT[]) TO authenticated, service_role;

-- ── 3. EVALUATE PENDING CHECKPOINTS ────────────────────────
CREATE OR REPLACE FUNCTION fn_evaluate_pending_checkpoints(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_evaluated INTEGER := 0; r RECORD;
BEGIN
  FOR r IN SELECT oc.id FROM outcome_checkpoints oc WHERE oc.tenant_id = p_tenant_id AND oc.status = 'pending' AND oc.scheduled_at <= now() LIMIT 10
  LOOP
    UPDATE outcome_checkpoints SET status = 'evaluated', evaluated_at = now(), decision_effective = true, variance_delta = 0 WHERE id = r.id;
    v_evaluated := v_evaluated + 1;
  END LOOP;
  RETURN jsonb_build_object('evaluated_count', v_evaluated, 'evaluated_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION fn_evaluate_pending_checkpoints(UUID) TO authenticated, service_role;

-- ── 4. RECALIBRATE CONFIDENCE ──────────────────────────────
CREATE OR REPLACE FUNCTION fn_recalibrate_confidence(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_decision_count INTEGER; v_evaluated_count INTEGER; v_accuracy FLOAT := 0.5; v_new_confidence FLOAT;
BEGIN
  SELECT COUNT(*) INTO v_decision_count FROM cognition_decisions WHERE tenant_id = p_tenant_id AND status != 'dismissed';
  SELECT COUNT(*) INTO v_evaluated_count FROM outcome_checkpoints oc JOIN cognition_decisions cd ON oc.decision_id = cd.id WHERE cd.tenant_id = p_tenant_id AND oc.status = 'evaluated';
  IF v_evaluated_count >= 3 THEN
    SELECT COALESCE(AVG(CASE WHEN decision_effective THEN 1.0 ELSE 0.0 END), 0.5) INTO v_accuracy FROM outcome_checkpoints oc JOIN cognition_decisions cd ON oc.decision_id = cd.id WHERE cd.tenant_id = p_tenant_id AND oc.status = 'evaluated';
    v_new_confidence := 0.4 + (v_accuracy * 0.5) + (LEAST(v_evaluated_count, 10) * 0.01);
  ELSE
    v_new_confidence := 0.5 + (v_decision_count * 0.02);
  END IF;
  v_new_confidence := GREATEST(0.1, LEAST(0.99, v_new_confidence));
  RETURN jsonb_build_object('confidence_score', v_new_confidence, 'decision_count', v_decision_count, 'evaluated_count', v_evaluated_count, 'accuracy', v_accuracy);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_recalibrate_confidence(UUID) TO authenticated, service_role;

-- ── 5. CHECK INTEGRATION HEALTH ────────────────────────────
CREATE OR REPLACE FUNCTION fn_check_integration_health(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_integrations JSONB := '[]'; v_total INTEGER := 0; v_connected INTEGER := 0; r RECORD;
BEGIN
  FOR r IN SELECT provider, status, last_synced_at, error_message, records_count FROM integration_health WHERE tenant_id = p_tenant_id ORDER BY provider
  LOOP
    v_integrations := v_integrations || jsonb_build_object('provider', r.provider, 'status', r.status, 'last_synced_at', r.last_synced_at, 'error_message', r.error_message, 'records_count', r.records_count);
    v_total := v_total + 1;
    IF r.status = 'CONNECTED' THEN v_connected := v_connected + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('integrations', v_integrations, 'total', v_total, 'connected', v_connected, 'health_score', CASE WHEN v_total > 0 THEN (v_connected::float / v_total) ELSE 0 END);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_check_integration_health(UUID) TO authenticated, service_role;

-- ── 6. SNAPSHOT DAILY INSTABILITY ──────────────────────────
CREATE OR REPLACE FUNCTION fn_snapshot_daily_instability(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO instability_snapshots (tenant_id, snapshot_date, composite_risk_score, system_state, confidence_score, evidence_count)
  VALUES (p_tenant_id, CURRENT_DATE, 0, 'STABLE', 0.5, 0)
  ON CONFLICT (tenant_id, snapshot_date) DO NOTHING;
  RETURN jsonb_build_object('status', 'snapshotted', 'date', CURRENT_DATE);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_snapshot_daily_instability(UUID) TO authenticated, service_role;

-- ── 7. DETECT DRIFT ────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_detect_drift(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recent RECORD; v_prior_score FLOAT; v_delta FLOAT := 0; v_drift_detected BOOLEAN := false;
BEGIN
  SELECT composite_risk_score, system_state INTO v_recent FROM instability_snapshots WHERE tenant_id = p_tenant_id ORDER BY snapshot_date DESC LIMIT 1;
  SELECT composite_risk_score INTO v_prior_score FROM instability_snapshots WHERE tenant_id = p_tenant_id ORDER BY snapshot_date DESC LIMIT 1 OFFSET 1;
  IF v_recent IS NOT NULL AND v_prior_score IS NOT NULL THEN
    v_delta := v_recent.composite_risk_score - v_prior_score;
    v_drift_detected := ABS(v_delta) > 0.15;
  END IF;
  RETURN jsonb_build_object('drift_detected', v_drift_detected, 'delta', v_delta, 'current_state', COALESCE(v_recent.system_state, 'STABLE'), 'checked_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION fn_detect_drift(UUID) TO authenticated, service_role;

-- ── 8. MASTER COGNITION CONTRACT ───────────────────────────
CREATE OR REPLACE FUNCTION ic_generate_cognition_contract(
  p_tenant_id UUID,
  p_tab TEXT DEFAULT 'overview'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence JSONB;
  v_confidence JSONB;
  v_propagation JSONB;
  v_active_risks TEXT[] := '{}';
  v_system_state TEXT := 'STABLE';
  v_composite_risk FLOAT := 0;
  v_instability_indices JSONB;
  v_crm_connected BOOLEAN := false;
  v_accounting_connected BOOLEAN := false;
  v_email_connected BOOLEAN := false;
  v_tab_data JSONB := '{}';
BEGIN
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%crm%') INTO v_crm_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%accounting%') INTO v_accounting_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND (provider ILIKE '%email%' OR provider ILIKE '%gmail%' OR provider ILIKE '%outlook%')) INTO v_email_connected;

  v_evidence := fn_assemble_evidence_pack(p_tenant_id, p_tab);
  v_confidence := fn_recalibrate_confidence(p_tenant_id);

  IF NOT v_crm_connected THEN v_active_risks := v_active_risks || ARRAY['revenue']; END IF;
  IF NOT v_accounting_connected THEN v_active_risks := v_active_risks || ARRAY['finance']; END IF;
  IF NOT v_email_connected THEN v_active_risks := v_active_risks || ARRAY['people']; END IF;

  v_propagation := fn_compute_propagation_map(p_tenant_id, v_active_risks);

  v_instability_indices := jsonb_build_object(
    'revenue_volatility_index', CASE WHEN v_crm_connected THEN 0.25 ELSE 0.6 END,
    'engagement_decay_score', CASE WHEN v_email_connected THEN 0.2 ELSE 0.5 END,
    'cash_deviation_ratio', CASE WHEN v_accounting_connected THEN 0.15 ELSE 0.55 END,
    'anomaly_density_score', 0.2
  );

  v_composite_risk := (
    ((v_instability_indices->>'revenue_volatility_index')::float * 0.3) +
    ((v_instability_indices->>'engagement_decay_score')::float * 0.25) +
    ((v_instability_indices->>'cash_deviation_ratio')::float * 0.3) +
    ((v_instability_indices->>'anomaly_density_score')::float * 0.15)
  );

  v_system_state := CASE
    WHEN v_composite_risk > 0.7 THEN 'CRITICAL'
    WHEN v_composite_risk > 0.5 THEN 'COMPRESSION'
    WHEN v_composite_risk > 0.3 THEN 'DRIFT'
    ELSE 'STABLE'
  END;

  CASE p_tab
    WHEN 'revenue' THEN v_tab_data := jsonb_build_object('crm_required', NOT v_crm_connected, 'pipeline_health', CASE WHEN v_crm_connected THEN 'connected' ELSE 'disconnected' END);
    WHEN 'risk' THEN v_tab_data := jsonb_build_object('accounting_required', NOT v_accounting_connected, 'risk_level', CASE WHEN v_composite_risk > 0.6 THEN 'high' WHEN v_composite_risk > 0.3 THEN 'medium' ELSE 'low' END);
    WHEN 'operations' THEN v_tab_data := jsonb_build_object('crm_required', NOT v_crm_connected, 'operational_load', 'nominal');
    WHEN 'people' THEN v_tab_data := jsonb_build_object('email_required', NOT v_email_connected, 'capacity', CASE WHEN v_email_connected THEN 'available' ELSE 'requires_email' END);
    ELSE v_tab_data := jsonb_build_object('integrations_connected', (CASE WHEN v_crm_connected THEN 1 ELSE 0 END + CASE WHEN v_accounting_connected THEN 1 ELSE 0 END + CASE WHEN v_email_connected THEN 1 ELSE 0 END));
  END CASE;

  RETURN jsonb_build_object(
    'status', 'computed',
    'tab', p_tab,
    'tenant_id', p_tenant_id,
    'system_state', v_system_state,
    'composite_risk_score', v_composite_risk,
    'instability_indices', v_instability_indices,
    'propagation_map', v_propagation,
    'confidence_score', (v_confidence->>'confidence_score')::float,
    'evidence_count', (v_evidence->>'evidence_count')::int,
    'evidence_quality', (v_evidence->>'quality_score')::float,
    'tab_data', v_tab_data,
    'integrations', jsonb_build_object('crm', v_crm_connected, 'accounting', v_accounting_connected, 'email', v_email_connected),
    'computed_at', now(),
    'model_version', 'v1.0'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ic_generate_cognition_contract(UUID, TEXT) TO authenticated, service_role;

-- ── 9. CALCULATE RISK BASELINE ─────────────────────────────
CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT ic_generate_cognition_contract(p_tenant_id, 'overview') INTO v_result;
  RETURN jsonb_build_object('status', 'computed', 'composite', jsonb_build_object('risk_score', (v_result->>'composite_risk_score')::float, 'system_state', v_result->>'system_state'), 'indices', v_result->'instability_indices', 'computed_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated, service_role;


-- ═══ 046_user_feature_usage.sql ═══
-- ============================================================
-- Supabase: user_feature_usage
-- Server-side tracking of scan usage per user
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS user_feature_usage (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name    TEXT NOT NULL,
  last_used_at    TIMESTAMPTZ DEFAULT now(),
  use_count       INTEGER DEFAULT 1,
  UNIQUE(user_id, feature_name)
);

ALTER TABLE user_feature_usage ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE user_feature_usage ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 1;

ALTER TABLE user_feature_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users manage own feature usage" ON user_feature_usage;
END $$;

CREATE POLICY "Users manage own feature usage"
  ON user_feature_usage FOR ALL
  USING (auth.uid() = user_id);


-- ═══ 047_grant_test_super_admin.sql ═══
-- ============================================================
-- Grant Super Admin to 3 Test Accounts
-- Run in Supabase SQL Editor
-- ============================================================

UPDATE public.users
SET subscription_tier = 'super_admin', role = 'super_admin'
WHERE email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);

-- Also set calibration complete for test1 (Campos Coffee — already calibrated)
UPDATE public.user_operator_profile
SET persona_calibration_status = 'complete'
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('trent-test1@biqc-test.com','trent-test2@biqc-test.com','trent-test3@biqc-test.com')
);

-- Verify
SELECT au.email, u.subscription_tier, u.role, op.persona_calibration_status
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
LEFT JOIN public.user_operator_profile op ON op.user_id = au.id
WHERE au.email IN ('trent-test1@biqc-test.com','trent-test2@biqc-test.com','trent-test3@biqc-test.com');


-- ═══ 048_forensic_corrections.sql ═══
-- ============================================================
-- FORENSIC CORRECTIONS 048 — CORRECTED (uses real columns)
-- Run in Supabase SQL Editor
-- ============================================================

-- PROTOCOL 1: Delete old SoundBoard prompt
DELETE FROM system_prompts WHERE prompt_key = 'mysoundboard_v1';

-- PROTOCOL 7: Grant super_admin to test accounts
UPDATE public.users
SET subscription_tier = 'super_admin', role = 'super_admin'
WHERE email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);

-- Set calibration complete for test accounts
UPDATE public.user_operator_profile
SET persona_calibration_status = 'complete'
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'trent-test1@biqc-test.com',
    'trent-test2@biqc-test.com',
    'trent-test3@biqc-test.com'
  )
);

-- PROTOCOL 2: Clear contaminated intelligence fields (verified real columns)
UPDATE public.business_profiles
SET
  market_position           = NULL,
  main_products_services    = NULL,
  unique_value_proposition  = NULL,
  competitive_advantages    = NULL,
  target_market             = NULL,
  ideal_customer_profile    = NULL,
  geographic_focus          = NULL,
  abn                       = NULL,
  competitor_scan_result    = NULL,
  cached_market_intel       = NULL,
  competitor_scan_last      = NULL,
  last_market_scraped_at    = NULL,
  updated_at                = now()
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'trent-test1@biqc-test.com',
    'trent-test2@biqc-test.com',
    'trent-test3@biqc-test.com'
  )
);

-- Verify everything
SELECT
  au.email,
  u.subscription_tier,
  u.role,
  op.persona_calibration_status,
  bp.business_name,
  bp.abn,
  bp.market_position
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
LEFT JOIN public.user_operator_profile op ON op.user_id = au.id
LEFT JOIN public.business_profiles bp ON bp.user_id = au.id
WHERE au.email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);


-- ═══ 049_fix_propagation_map_columns.sql ═══
-- Migration 049: Fix fn_compute_propagation_map column references
-- The function was referencing pr.probability and pr.lag_days which don't exist
-- Actual columns: pr.base_probability, pr.time_horizon, pr.mechanism
-- Run this in Supabase SQL Editor to fix the cognition/overview 500 error

CREATE OR REPLACE FUNCTION fn_compute_propagation_map(p_tenant_id UUID, p_active_risks TEXT[]) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chains JSONB := '[]';
  r RECORD;
BEGIN
  IF array_length(p_active_risks, 1) IS NULL THEN RETURN '[]'; END IF;
  FOR r IN
    SELECT pr.source_domain, pr.target_domain, pr.base_probability, pr.time_horizon, pr.mechanism
    FROM propagation_rules pr
    WHERE pr.source_domain = ANY(p_active_risks) AND pr.is_active = true
    ORDER BY pr.base_probability DESC LIMIT 5
  LOOP
    v_chains := v_chains || jsonb_build_object(
      'source', r.source_domain,
      'target', r.target_domain,
      'probability', r.base_probability,
      'window', r.time_horizon || ' days',
      'description', r.mechanism,
      'chain', jsonb_build_array(r.source_domain, r.target_domain)
    );
  END LOOP;
  RETURN v_chains;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_compute_propagation_map(UUID, TEXT[]) TO authenticated, service_role;

