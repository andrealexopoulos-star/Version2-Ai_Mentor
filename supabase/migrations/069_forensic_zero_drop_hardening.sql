-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 069: Forensic zero-drop hardening
-- - Make scheduled email refresh perform real edge invocations
-- - Harden get_priority_inbox against cross-tenant access
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_email_priority_refresh()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec RECORD;
  base_url TEXT;
  service_role_key TEXT;
  request_id BIGINT;
BEGIN
  base_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.service_role_key', true);

  IF COALESCE(base_url, '') = '' OR COALESCE(service_role_key, '') = '' THEN
    RAISE NOTICE 'Skipping email refresh cron: missing app.supabase_url or app.service_role_key';
    RETURN;
  END IF;

  FOR rec IN
    SELECT DISTINCT
      ec.user_id,
      ec.provider
    FROM email_connections ec
    WHERE ec.connected = true
      AND ec.sync_status != 'token_expired'
  LOOP
    request_id := net.http_post(
      url := base_url || '/functions/v1/email_priority',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'user_id', rec.user_id,
        'provider', rec.provider
      )
    );

    INSERT INTO email_intelligence_runs (user_id, provider, total_analyzed, strategic_insights)
    VALUES (rec.user_id, rec.provider, 0, 'Scheduled edge run dispatched (request_id=' || request_id || ')')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION get_priority_inbox(
  p_user_id uuid,
  p_provider text DEFAULT 'gmail',
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  email_id text,
  from_address text,
  subject text,
  snippet text,
  received_date timestamptz,
  priority_level text,
  reason text,
  suggested_action text,
  user_override text,
  analyzed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    pi.id,
    pi.email_id,
    pi.from_address,
    pi.subject,
    pi.snippet,
    pi.received_date,
    pi.priority_level,
    pi.reason,
    pi.suggested_action,
    pi.user_override,
    pi.analyzed_at
  FROM priority_inbox pi
  WHERE pi.user_id = p_user_id
    AND pi.provider = p_provider
  ORDER BY
    CASE COALESCE(pi.user_override, pi.priority_level)
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
      ELSE 4
    END,
    pi.received_date DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_priority_inbox(uuid, text, int) TO authenticated, service_role;
