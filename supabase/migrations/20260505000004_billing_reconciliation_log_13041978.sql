-- 2026-05-05 (13041978) — reconciliation_log: daily reconciliation of usage_ledger vs provider billing APIs.
--
-- Purpose: every day at 06:00 AEST, sum cost_aud_micros from usage_ledger per
-- provider and compare against the provider's billing API total for the same
-- period. If delta > 1% (D-default 2026-05-05), pause auto top-up + alert
-- super_admin.
--
-- See OPS Manual entry 01 section 7.5 + principle P7.

CREATE TABLE IF NOT EXISTS public.reconciliation_log (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start             timestamptz NOT NULL,
    period_end               timestamptz NOT NULL,
    provider_id              text NOT NULL,                         -- 'openai' | 'anthropic' | 'perplexity' | 'google' | etc.
    ledger_aud_cents         bigint NOT NULL,                       -- our side (usage_ledger sum cast to cents)
    provider_aud_cents       bigint NOT NULL,                       -- provider's billing API total
    delta_aud_cents          bigint GENERATED ALWAYS AS (provider_aud_cents - ledger_aud_cents) STORED,
    delta_pct                numeric(8, 4) GENERATED ALWAYS AS (
        CASE
            WHEN provider_aud_cents = 0 THEN 0
            ELSE ROUND(((provider_aud_cents - ledger_aud_cents)::numeric / provider_aud_cents) * 100, 4)
        END
    ) STORED,
    status                   text NOT NULL CHECK (status IN ('PASS', 'FAIL', 'ERROR', 'SKIPPED')),
    threshold_pct            numeric(5, 2) NOT NULL DEFAULT 1.00,    -- D-default 2026-05-05; configurable per row
    notes                    text,
    actioned                 boolean NOT NULL DEFAULT false,         -- super_admin marks reviewed/resolved
    actioned_by              uuid REFERENCES auth.users(id),
    actioned_at              timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.reconciliation_log IS 'Daily reconciliation of usage_ledger vs provider billing APIs. Status FAIL = delta > threshold_pct, pauses auto top-up + alerts super_admin. Migration 20260505 / OPS Manual entry 01 section 7.5.';
COMMENT ON COLUMN public.reconciliation_log.delta_pct IS 'Computed: (provider − ledger) / provider × 100. Positive = we under-charged (BIQc-side leak). Negative = we over-charged (refund risk).';
COMMENT ON COLUMN public.reconciliation_log.threshold_pct IS 'Per-row threshold; default 1.00 per Andreas 2026-05-05.';

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_period
    ON public.reconciliation_log (period_start DESC, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_provider
    ON public.reconciliation_log (provider_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_failures
    ON public.reconciliation_log (status, actioned)
    WHERE status IN ('FAIL', 'ERROR');

ALTER TABLE public.reconciliation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reconciliation_log_service_role ON public.reconciliation_log;
CREATE POLICY reconciliation_log_service_role
    ON public.reconciliation_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Super_admin dashboard view: latest run per provider.
CREATE OR REPLACE VIEW public.vw_reconciliation_latest AS
SELECT DISTINCT ON (provider_id)
    provider_id,
    period_start,
    period_end,
    ledger_aud_cents,
    provider_aud_cents,
    delta_aud_cents,
    delta_pct,
    status,
    threshold_pct,
    created_at
FROM public.reconciliation_log
ORDER BY provider_id, created_at DESC;

COMMENT ON VIEW public.vw_reconciliation_latest IS 'Most recent reconciliation result per provider — fed to Super Admin Portal System Health panel.';
