# BIQc Edge Function Deployment Guide
## Date: 2026-02-24

---

## EDGE FUNCTION 1: biqc-insights-cognitive (UPDATED)

### What Changed
- Added `market_intelligence` object to the AI prompt JSON schema
- This includes: positioning_verdict, acquisition/retention/growth signal scores,
  drift_snapshot (cohort/trust/authority/position vs targets),
  market_kpis, competitor_signals, industry_trends,
  misalignment_index, probability_of_goal_achievement,
  gap_magnitude, strategic_risk_level
- Added instruction in RULES to always generate market_intelligence
- NO logic changes — only prompt extension

### How to Deploy
1. Go to Supabase Dashboard → Edge Functions
2. Find `biqc-insights-cognitive`
3. Replace the ENTIRE code with the file at:
   `/app/supabase/functions/biqc-insights-cognitive/index.ts`
4. Deploy

OR via CLI:
```bash
supabase functions deploy biqc-insights-cognitive
```

### Required Secrets (already set)
- OPENAI_API_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- MERGE_API_KEY
- PERPLEXITY_API_KEY

---

## SQL FUNCTION: compute_forensic_score (NEW)

Run this in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION compute_forensic_score(answers jsonb)
RETURNS jsonb AS $$
DECLARE
  total_score numeric := 0;
  count integer := 0;
  risk_level text;
  result jsonb;
  r record;
BEGIN
  FOR r IN SELECT * FROM jsonb_each(answers) LOOP
    total_score := total_score + COALESCE((r.value->>'index')::numeric, 0);
    count := count + 1;
  END LOOP;
  
  IF count > 0 THEN total_score := total_score / count; END IF;
  
  IF total_score > 2.5 THEN risk_level := 'Aggressive';
  ELSIF total_score > 1.5 THEN risk_level := 'Moderate';
  ELSE risk_level := 'Conservative';
  END IF;
  
  result := jsonb_build_object(
    'avg_score', round(total_score, 2),
    'risk_level', risk_level,
    'revenue_ambition', CASE COALESCE((answers->'revenue_ambition'->>'index')::int, 0)
      WHEN 0 THEN 'Maintain' WHEN 1 THEN 'Steady' WHEN 2 THEN 'Aggressive' ELSE 'Hyper' END,
    'retention_maturity', CASE COALESCE((answers->'retention_maturity'->>'index')::int, 0)
      WHEN 0 THEN 'Reactive' WHEN 1 THEN 'Basic' WHEN 2 THEN 'Structured' ELSE 'Advanced' END,
    'pricing_confidence', CASE COALESCE((answers->'pricing_confidence'->>'index')::int, 0)
      WHEN 0 THEN 'Low' WHEN 1 THEN 'Some' WHEN 2 THEN 'Confident' ELSE 'Very High' END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

---

## PG_CRON SCHEDULES (if not already active)

Run in SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily cognitive snapshot precompute (6am AEST = 8pm UTC)
SELECT cron.schedule('cognitive-snapshot-daily', '0 20 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/biqc-insights-cognitive',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'), 'Content-Type', 'application/json'),
    body := '{"batch_precompute": true}'::jsonb
  ); $$
);

-- Weekly competitor monitoring (Monday 6am AEST = Sunday 8pm UTC)
SELECT cron.schedule('competitor-monitor-weekly', '0 20 * * 0',
  $$ SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/competitor-monitor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'), 'Content-Type', 'application/json'),
    body := '{"batch": true}'::jsonb
  ); $$
);

-- Weekly CFO analysis (Monday 7am AEST = Sunday 9pm UTC)
SELECT cron.schedule('cfo-cash-analysis-weekly', '0 21 * * 0',
  $$ SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cfo-cash-analysis',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'), 'Content-Type', 'application/json'),
    body := '{"batch": true}'::jsonb
  ); $$
);
```

---

## SUPABASE REALTIME (if not already active)

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE intelligence_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE watchtower_events;
ALTER PUBLICATION supabase_realtime ADD TABLE calibration_schedules;
```
(If these error with "already member", they're already enabled — skip.)

---

## VERIFICATION CHECKLIST

After deploying:
1. Sign up as new user on biqc.ai
2. Complete calibration flow (Ignition → URL → Analyzing → WOW Summary → CMO Snapshot → Dashboard)
3. Navigate to /market — should show:
   - System state from cognitive engine
   - Signal scores (Positioning, Acquisition, Retention, Growth)
   - Drift snapshot bars (if market_intelligence generated)
   - AI Market Advisory
   - Alignment check
   - Integration layer
   - Forensic Calibration button (Super Admin only)
   - Executive Strategic Brief
4. Navigate to /market/calibration as Super Admin — full 7-question questionnaire
5. Check that cognitive snapshot auto-refreshes daily at 6am AEST
