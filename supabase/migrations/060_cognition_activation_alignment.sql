-- Cognition activation alignment
-- Repairs existing databases that were created before the stricter cognition schema was complete.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS evidence_freshness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    domain TEXT NOT NULL CHECK (domain IN ('finance', 'sales', 'operations', 'team', 'market')),
    current_confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (current_confidence >= 0 AND current_confidence <= 1),
    last_evidence_at TIMESTAMPTZ,
    decay_rate NUMERIC NOT NULL DEFAULT 0.002,
    confidence_state TEXT NOT NULL DEFAULT 'FRESH' CHECK (confidence_state IN ('FRESH', 'AGING', 'STALE')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_freshness_active_unique
    ON evidence_freshness(user_id, domain, active);

CREATE INDEX IF NOT EXISTS idx_evidence_freshness_domain_lookup
    ON evidence_freshness(user_id, domain);

GRANT SELECT, INSERT, UPDATE, DELETE ON evidence_freshness TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON evidence_freshness TO service_role;

ALTER TABLE evidence_freshness ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'evidence_freshness' AND policyname = 'Service role full access on evidence_freshness'
    ) THEN
        CREATE POLICY "Service role full access on evidence_freshness"
            ON evidence_freshness FOR ALL TO service_role
            USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'evidence_freshness' AND policyname = 'Users read own evidence_freshness'
    ) THEN
        CREATE POLICY "Users read own evidence_freshness"
            ON evidence_freshness FOR SELECT TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT conname INTO v_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'governance_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source_system%';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE governance_events DROP CONSTRAINT %I', v_constraint_name);
    END IF;

    ALTER TABLE governance_events
        ADD CONSTRAINT governance_events_source_system_check
        CHECK (source_system IN ('crm', 'accounting', 'marketing', 'email', 'scrape', 'manual'));
END $$;
