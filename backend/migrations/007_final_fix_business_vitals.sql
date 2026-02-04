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
