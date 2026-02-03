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
