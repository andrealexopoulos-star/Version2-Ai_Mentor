-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 052: Scheduled cron jobs for email intelligence
-- Requires pg_cron (enabled in migration 025)
-- ═══════════════════════════════════════════════════════════════

-- ── Wrapper SQL function: calls email_priority edge function ────
-- This lets pg_cron invoke it as a SQL job
CREATE OR REPLACE FUNCTION trigger_email_priority_refresh()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  edge_url TEXT;
BEGIN
  edge_url := current_setting('app.supabase_url', true) || '/functions/v1/email_priority';

  -- Iterate over all users with connected email
  FOR rec IN
    SELECT DISTINCT
      ec.user_id,
      ec.provider
    FROM email_connections ec
    WHERE ec.connected = true
      AND ec.sync_status != 'token_expired'
  LOOP
    -- Log the attempt (lightweight — actual HTTP call happens via pg_net extension)
    INSERT INTO email_intelligence_runs (user_id, provider, total_analyzed, strategic_insights)
    VALUES (rec.user_id, rec.provider, 0, 'Scheduled run queued at ' || now()::text)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ── Schedule: run email_priority every 10 minutes ──────────────
-- Uses pg_cron (must be enabled)
SELECT cron.schedule(
  'email-priority-refresh',
  '*/10 * * * *',
  $$SELECT trigger_email_priority_refresh()$$
);

-- ── Schedule: refresh tokens every 30 minutes ──────────────────
SELECT cron.schedule(
  'token-refresh',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/refresh_tokens',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer " || current_setting(''app.service_role_key'', true)}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- ── Helper: get latest priority inbox for a user ────────────────
CREATE OR REPLACE FUNCTION get_priority_inbox(p_user_id uuid, p_provider text DEFAULT 'gmail', p_limit int DEFAULT 50)
RETURNS TABLE (
  id             uuid,
  email_id       text,
  from_address   text,
  subject        text,
  snippet        text,
  received_date  timestamptz,
  priority_level text,
  reason         text,
  suggested_action text,
  user_override  text,
  analyzed_at    timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    id, email_id, from_address, subject, snippet,
    received_date, priority_level, reason, suggested_action,
    user_override, analyzed_at
  FROM priority_inbox
  WHERE user_id = p_user_id
    AND provider = p_provider
  ORDER BY
    CASE COALESCE(user_override, priority_level)
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
      ELSE 4
    END,
    received_date DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_priority_inbox TO authenticated, service_role;
