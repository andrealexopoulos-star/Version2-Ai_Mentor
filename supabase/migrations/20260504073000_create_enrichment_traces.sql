-- ============================================================================
-- Migration: create enrichment_traces table — P0 Marjo E2 / 2026-05-04
-- ============================================================================
-- Issue: PR #449 audit revealed that provider calls (Firecrawl, Perplexity,
-- OpenAI, Anthropic, Gemini, ABR, plus the Supabase edge functions that
-- compose them) are not consistently traced to a per-scan persistence layer.
-- Without per-call rows linked to a scan_id, the CMO Report and the daily
-- check cannot prove which provider returned what evidence — every section
-- becomes unverifiable.
--
-- Existing tables that DO NOT solve this:
--   - public.provider_usage  → per-PROVIDER running tally only (one row per
--                              vendor); no scan linkage, no per-call rows.
--                              Powers the Super-Admin dashboard. Kept as-is.
--   - public.llm_call_log    → LLM-only schema; no scan_id, no provider
--                              field, no http_status, no edge_function.
--                              Kept as-is for back-compat.
--
-- Contract: per "BIQc Platform Contract — Secure No-Silent-Failure v2"
-- (2026-04-23), supplier names live ONLY behind the backend trust boundary.
-- Rows in this table contain raw supplier identifiers (provider, edge_function,
-- error code) and MUST never reach a frontend response unsanitised. Reads
-- are gated to admin/audit endpoints; the user-facing CMO Report only
-- surfaces a sanitised provider-chain summary (hash + state + ok-count).
--
-- Zero-401 (2026-04-23): every non-200 attempt MUST land a row here. There
-- are no silent failures and no fallback-to-empty rows. A row with error
-- populated is itself the audit trail Andreas reviews in the daily check.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enrichment_traces (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Per-scan grouping. UUID, NOT a FK because scans are not first-class
    -- rows yet (scan_id is generated in-process by calibration.py and
    -- threaded through the edge fanout). Indexed for the CMO/audit queries.
    scan_id             uuid NOT NULL,

    -- Optional user/business linkage. Nullable so traces can land for
    -- pre-auth scan attempts and for backend-orchestrated jobs.
    user_id             uuid NULL,
    business_profile_id uuid NULL,

    -- Provider slug. Kept as text (not enum) so we can add new vendors
    -- without a migration. Validated by the helper before insert.
    -- Allowed: firecrawl | perplexity | openai | anthropic | gemini | abr
    --        | semrush | browse_ai | serper | merge | supabase
    provider            text NOT NULL,

    -- Optional name of the Supabase edge function that mediated the call
    -- (e.g. 'deep-web-recon', 'semrush-domain-intel'). Null when the
    -- backend called the supplier directly (e.g. LLM router → OpenAI).
    edge_function       text NULL,

    -- Per-call attempt number. Each retry produces a new row with
    -- attempt incremented. Helper enforces this; default = 1.
    attempt             integer NOT NULL DEFAULT 1,

    called_at           timestamptz NOT NULL DEFAULT now(),

    -- Latency in milliseconds. Nullable for rows recorded BEFORE the call
    -- completes (the helper writes a "started" row pre-call and updates
    -- it post-call so we can prove the call was attempted even if the
    -- handler crashes mid-flight).
    latency_ms          integer NULL,

    -- Upstream HTTP status. Nullable for the "started" row.
    -- 200 = success. 401 = auth — Andreas's zero-401 rule fires on insert.
    -- 5xx, 429, 4xx all land rows with error populated.
    http_status         integer NULL,

    -- Sanitised request descriptor. NEVER full payload — just enough to
    -- audit the call (URL pattern, query length, prompt fingerprint).
    -- Examples:
    --   { "url": "smsglobal.com", "query_chars": 84 }
    --   { "model": "gpt-4o", "system_chars": 2310, "user_chars": 1180 }
    --   { "edge_function": "deep-web-recon", "user_id_hash": "ab12.." }
    request_summary     jsonb NULL,

    -- Sanitised response descriptor. Counts + sizes — NOT raw bodies.
    --   { "evidence_size": 12830, "citation_count": 14, "competitor_count": 6 }
    --   { "completion_chars": 4120, "total_tokens": 3815 }
    --   { "ok": false, "code": "EDGE_FUNCTION_HTTP_ERROR" }
    response_summary    jsonb NULL,

    -- sha256 of the canonicalised response body (or response_summary if
    -- the body is too large). Used for de-duplication — two providers
    -- returning byte-identical evidence land different rows but identical
    -- hashes, which the CMO audit pane shows as "1 unique evidence pkt
    -- across 2 sources".
    evidence_hash       text NULL,

    -- Explicit failure reason. INTERNAL only. Never returned to frontend.
    -- Format: short machine-readable code + " : " + 280-char snippet.
    --   "EDGE_FUNCTION_HTTP_ERROR : semrush-domain-intel returned HTTP 401"
    --   "TIMEOUT : timeout after retry calling deep-web-recon"
    --   "SUPPLIER_RATE_LIMIT : openai 429 — retry in 60s"
    error               text NULL,

    -- True when this row's response_summary was passed through the
    -- centralised sanitizer before being persisted. Defaults FALSE so a
    -- new caller that forgets the sanitizer step is auditable. The CMO
    -- audit endpoint surfaces a count of unsanitised rows per scan.
    sanitiser_applied   boolean NOT NULL DEFAULT FALSE,

    -- Free-form metadata for the integrating call site. Kept open so a
    -- caller can add e.g. {"cache":"hit"} or {"trinity_leg":"openai"}
    -- without us shipping a new migration.
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────
-- Primary access path: "all traces for scan X" — hit by CMO audit pane
-- and the daily health check.
CREATE INDEX IF NOT EXISTS idx_enrichment_traces_scan_id
    ON public.enrichment_traces (scan_id);

-- "What did supplier Y do for user Z?" — used by the per-user audit drill.
CREATE INDEX IF NOT EXISTS idx_enrichment_traces_user_provider
    ON public.enrichment_traces (user_id, provider, called_at DESC);

-- "All 401s in the last 24h" — feeds Andreas's zero-401 daily review.
CREATE INDEX IF NOT EXISTS idx_enrichment_traces_failures
    ON public.enrichment_traces (http_status, called_at DESC)
    WHERE http_status IS NULL OR http_status >= 400;

-- "What's the latest call for this scan?" — keeps CMO audit pane snappy.
CREATE INDEX IF NOT EXISTS idx_enrichment_traces_scan_recent
    ON public.enrichment_traces (scan_id, called_at DESC);

-- ── Comments ─────────────────────────────────────────────────────────────
COMMENT ON TABLE public.enrichment_traces IS
  'Per-call audit trail of every provider/edge-function invocation in the URL '
  'scan path. One row per attempt. Written by backend/core/enrichment_trace.py '
  'on the BEFORE+AFTER pattern. Read by CMO Report admin/audit endpoint and '
  'the ops_daily_calibration_check. Rows contain raw supplier names — must '
  'never reach a frontend response unsanitised. P0 Marjo E2 / 2026-05-04. '
  'Cites BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.';

COMMENT ON COLUMN public.enrichment_traces.scan_id IS
  'Per-scan grouping uuid. Generated in-process by calibration.py and '
  'threaded through the edge fanout. Not a FK — scans are not first-class '
  'rows yet.';

COMMENT ON COLUMN public.enrichment_traces.provider IS
  'Lowercase supplier slug. INTERNAL only — never echo to a frontend '
  'response. Allowed values are validated by the Python helper, not by a '
  'CHECK constraint, so we can add vendors without a migration.';

COMMENT ON COLUMN public.enrichment_traces.error IS
  'Internal failure descriptor. May contain supplier-identifying tokens. '
  'Sanitiser MUST run before any field derived from this column is '
  'returned to a frontend caller.';

COMMENT ON COLUMN public.enrichment_traces.sanitiser_applied IS
  'TRUE when the writing call site routed response_summary through the '
  'centralised sanitizer before persisting. Daily check counts FALSE rows '
  'per scan as a contract-compliance metric.';

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Standard BIQc posture: enable RLS, deny all by default, grant only to
-- service_role (which the backend uses) and the owning user via JWT sub.
-- The CMO Report admin/audit endpoint is gated server-side on superadmin.
ALTER TABLE public.enrichment_traces ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default in Supabase. Drop+create idempotent
-- policy for the user read path. Users can see their own trace rows so the
-- in-app "diagnostics" tab can show "we called X providers for your scan"
-- (sanitised — supplier names are stripped at the response layer).
DROP POLICY IF EXISTS enrichment_traces_owner_select ON public.enrichment_traces;
CREATE POLICY enrichment_traces_owner_select
    ON public.enrichment_traces
    FOR SELECT
    USING (user_id = auth.uid());

-- No INSERT policy: only the backend service_role writes here. Per-user
-- INSERT through the API is explicitly disallowed.
-- No UPDATE policy: rows are append-only (helper updates the "started" row
-- via service_role only).
-- No DELETE policy: append-only audit table.

-- ── Grants ───────────────────────────────────────────────────────────────
-- Authenticated users may select their own rows (gated by RLS above).
-- Service role bypasses RLS. Anon role gets nothing.
GRANT SELECT ON public.enrichment_traces TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.enrichment_traces TO service_role;
