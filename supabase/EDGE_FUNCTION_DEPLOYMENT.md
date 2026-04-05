# BIQc Edge Function Deployment Guide
## 4 New Functions + Secrets Configuration

---

## STEP 1: Set Secrets in Supabase

Go to **Supabase Dashboard → Edge Functions → Secrets** and ensure these are set:

```
OPENAI_API_KEY=<your OpenAI key>
PERPLEXITY_API_KEY=<your-perplexity-api-key>
MERGE_API_KEY=<your-merge-api-key>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt>
```

If OPENAI_API_KEY is already set from previous functions, skip it.
PERPLEXITY_API_KEY and MERGE_API_KEY may be new — add them.

---

## STEP 2: Deploy Each Function

Run these commands from the project root (where `supabase/` folder lives):

### 2a. Intelligence Bridge
```bash
supabase functions deploy intelligence-bridge --no-verify-jwt
```
**Why --no-verify-jwt:** This function is called server-to-server (from FastAPI backend), not from the browser directly. It uses service_role_key for auth.

### 2b. SOP Generator
```bash
supabase functions deploy sop-generator
```
**JWT verified:** Yes — called from frontend with user's Bearer token.

### 2c. Competitor Monitor
```bash
supabase functions deploy competitor-monitor --no-verify-jwt
```
**Why --no-verify-jwt:** Called by pg_cron (batch mode) and server-to-server. Single-user mode also supports Bearer token auth.

### 2d. CFO Cash Analysis
```bash
supabase functions deploy cfo-cash-analysis --no-verify-jwt
```
**Why --no-verify-jwt:** Called by pg_cron (batch mode) and server-to-server.

---

## STEP 3: Verify Deployment

Test each function with curl:

### Intelligence Bridge
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/intelligence-bridge \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "snapshot": {"id": "test123", "open_risks": [], "contradictions": []}}'
```
Expected: `{"ok":true,"actions_created":0,"user_id":"test"}`

### SOP Generator
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/sop-generator \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"type": "sop", "prompt": "Client onboarding process for a consulting firm"}'
```
Expected: `{"ok":true,"type":"sop","content":"...","document_id":"..."}`

### Competitor Monitor
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/competitor-monitor \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<real_user_id>"}'
```
Expected: `{"ok":true,"mode":"single","signals":N,"actions":N}`

### CFO Cash Analysis
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/cfo-cash-analysis \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<real_user_id>"}'
```
Expected: `{"ok":true,"mode":"single","alerts":N,"actions":N}`

---

## STEP 4: Set Up Scheduled Execution (pg_cron)

In the **Supabase SQL Editor**, run:

```sql
-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Weekly competitor monitoring (every Monday at 6am AEST)
SELECT cron.schedule(
  'competitor-monitor-weekly',
  '0 20 * * 0',  -- 8pm UTC Sunday = 6am Monday AEST
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/competitor-monitor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"batch": true}'::jsonb
  );
  $$
);

-- Weekly CFO analysis (every Monday at 7am AEST)
SELECT cron.schedule(
  'cfo-cash-analysis-weekly',
  '0 21 * * 0',  -- 9pm UTC Sunday = 7am Monday AEST
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cfo-cash-analysis',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"batch": true}'::jsonb
  );
  $$
);
```

**Note:** If `net.http_post` is not available, you'll need to enable the `pg_net` extension first:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

## STEP 5: Database Columns (if needed)

Run in SQL Editor if these columns don't exist yet:

```sql
-- For competitor monitor
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS competitor_scan_last TIMESTAMPTZ;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS competitor_scan_result TEXT;

-- For CFO agent
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS cfo_analysis_last TIMESTAMPTZ;

-- For intelligence actions metadata
ALTER TABLE intelligence_actions ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE intelligence_actions ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE intelligence_actions ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE intelligence_actions ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium';
ALTER TABLE intelligence_actions ADD COLUMN IF NOT EXISTS suggested_action TEXT;
```

---

## EXISTING EDGE FUNCTIONS (No Changes Needed)

These are already deployed and working:
- `calibration-psych` — AI calibration Q&A
- `intelligence-snapshot` — Cognitive snapshot generation
- `deep-web-recon` — Public signal scanning
- `boardroom-diagnosis` — Multi-agent Board Room
- `strategic-console-ai` — War Room AI
- `gmail_prod` — Gmail integration
- `email_priority` — Email prioritisation

---

## SUMMARY

| Function | Purpose | Trigger | Secrets Needed |
|---|---|---|---|
| `intelligence-bridge` | Snapshot/Watchtower → Actions | Server-to-server | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `sop-generator` | Generate SOPs/checklists | User (JWT) | OPENAI_API_KEY |
| `competitor-monitor` | Weekly competitor scanning | pg_cron + manual | OPENAI_API_KEY, PERPLEXITY_API_KEY |
| `cfo-cash-analysis` | Weekly financial analysis | pg_cron + manual | OPENAI_API_KEY, MERGE_API_KEY |

For calibration-critical secret mapping, use the canonical matrix in `docs/CALIBRATION_SECRET_MATRIX.md`.
