-- ============================================================================
--  Share Events — CMO Report tokenised share-link audit trail
--  P0 fix/p0-marjo-e8-share-function (PR #449 follow-up)
-- ----------------------------------------------------------------------------
--  Purpose: persist every Share Report click on the CMO Report page so the
--  action is provably non-no-op (PR #449 admitted "Share action could silently
--  no-op"). Backed by a tokenised, expiring URL that an unauthenticated
--  recipient can open to view a sanitised read-only copy of the report.
--
--  Contract v2 (BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2): the
--  shared HTML payload MUST be sanitised before any external response — no
--  supplier names, internal codes, or auth tokens leak through this surface.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.share_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- scan_id is nullable: the CMO report aggregates the latest enrichment row
    -- and may not be tied to a single scan UUID at share-time. When present
    -- it lets us reconstruct the exact dataset for cohort analytics.
    scan_id UUID NULL,
    -- mechanism is an open enum so we can extend (email/pdf/qr) without
    -- another migration. Initial values: 'shareable_link'.
    mechanism TEXT NOT NULL DEFAULT 'shareable_link',
    -- token is the high-entropy URL-safe identifier embedded in share_url.
    -- UNIQUE so a leaked URL can be revoked without colliding.
    token TEXT NOT NULL UNIQUE,
    share_url TEXT NOT NULL,
    -- recipient nullable: copy-link flow has no recipient; email flow does.
    recipient TEXT NULL,
    accessed_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_share_events_user ON public.share_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_events_token ON public.share_events(token);
CREATE INDEX IF NOT EXISTS idx_share_events_expires ON public.share_events(expires_at) WHERE revoked_at IS NULL;

-- RLS: a share_events row is private to its owner (the user who created
-- the share). The /reports/cmo-report/shared/{token} GET endpoint runs
-- service-role and intentionally bypasses RLS to allow unauthenticated
-- viewing of the shared URL.
ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS share_events_owner_select ON public.share_events;
CREATE POLICY share_events_owner_select ON public.share_events
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS share_events_owner_update ON public.share_events;
CREATE POLICY share_events_owner_update ON public.share_events
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Inserts always go through the backend with service-role; no client
-- INSERT path. We deliberately do NOT add an INSERT policy for the
-- authenticated role to keep the audit trail tamper-resistant.

COMMENT ON TABLE public.share_events IS
    'Audit trail for CMO Report share actions. Created by PR fix/p0-marjo-e8-share-function to fix the silent-no-op admission in PR #449. Contract v2 sanitised payloads only.';
COMMENT ON COLUMN public.share_events.token IS
    'URL-safe high-entropy token embedded in share_url. Treat as a secret; never leak in logs or analytics surfaces.';
COMMENT ON COLUMN public.share_events.mechanism IS
    'Open enum: shareable_link | email | pdf_download. Default shareable_link for the v1 ship.';
