-- 2026-05-05 (13041978) — usage_ledger idempotency: composite unique index.
--
-- Purpose: prevent double-counting if a webhook retries or a request retries
-- after partial failure. Key: (user_id, request_id, feature) — request_id is
-- generated per LLM call, so the same logical operation cannot insert twice.
--
-- See OPS Manual entry 01 section 7.4.
--
-- Note: a partial unique index (only when request_id IS NOT NULL) is used because
-- some legacy rows have request_id = NULL — we don't want to break those.

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_ledger_idempotency
    ON public.usage_ledger (user_id, request_id, feature)
    WHERE request_id IS NOT NULL;

COMMENT ON INDEX public.idx_usage_ledger_idempotency IS 'Idempotency guard against double-counting. Inserts use ON CONFLICT (user_id, request_id, feature) DO NOTHING when request_id is set. Migration 20260505 / OPS Manual entry 01 section 7.4.';
