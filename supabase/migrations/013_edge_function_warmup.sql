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
