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
