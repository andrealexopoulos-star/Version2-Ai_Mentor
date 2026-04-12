-- =============================================================================
-- Migration 087: Supernatural Intelligence Layer
--
-- Creates all tables for BIQc's supernatural intelligence features:
--   1.  industry_news           -- curated news per user
--   2.  regulatory_signals      -- compliance & regulatory alerts
--   3.  economic_indicators     -- macro-economic data (shared, not per-user)
--   4.  reputation_signals      -- online reputation monitoring
--   5.  supply_chain_signals    -- supply-chain risk & disruption tracking
--   6.  job_market_signals      -- competitor hiring / labor market intel
--   7.  predictions             -- ML/AI model predictions per user
--   8.  decision_log            -- structured decision journal
--   9.  strategic_narratives    -- AI-generated periodic strategic briefings
--  10.  marketing_campaigns     -- ad campaign metadata
--  11.  marketing_metrics       -- daily campaign performance metrics
--  12.  marketing_connections   -- OAuth tokens for ad platforms
--
-- Plus two RPC functions:
--   - detect_client_silence     -- finds contacts who have gone quiet
--   - marketing_overview_metrics -- aggregated 30-day ad spend summary
--
-- All tables use CREATE TABLE IF NOT EXISTS for idempotency.
-- All user FKs reference auth.users(id) ON DELETE CASCADE.
-- RLS enabled on every table; service_role bypass on all.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. industry_news
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.industry_news (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    headline          text NOT NULL,
    summary           text,
    source_name       text,
    source_url        text,
    published_at      timestamptz,
    industry          text,
    relevance_score   real,
    sentiment         text CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    impact_assessment text,
    tags              text[] DEFAULT '{}',
    is_read           boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industry_news_user_published
    ON public.industry_news(user_id, published_at DESC);

ALTER TABLE public.industry_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "industry_news_select_own"
    ON public.industry_news FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "industry_news_insert_own"
    ON public.industry_news FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "industry_news_update_own"
    ON public.industry_news FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "industry_news_delete_own"
    ON public.industry_news FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "industry_news_service_role"
    ON public.industry_news FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 2. regulatory_signals
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regulatory_signals (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title             text NOT NULL,
    body              text,
    jurisdiction      text NOT NULL DEFAULT 'AU',
    regulatory_body   text,
    effective_date    date,
    compliance_deadline date,
    severity          text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
    industry_impact   text,
    action_required   text,
    status            text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed')),
    source_url        text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_signals_user_deadline
    ON public.regulatory_signals(user_id, compliance_deadline);

ALTER TABLE public.regulatory_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regulatory_signals_select_own"
    ON public.regulatory_signals FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "regulatory_signals_insert_own"
    ON public.regulatory_signals FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "regulatory_signals_update_own"
    ON public.regulatory_signals FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "regulatory_signals_delete_own"
    ON public.regulatory_signals FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "regulatory_signals_service_role"
    ON public.regulatory_signals FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 3. economic_indicators  (shared data -- no user_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.economic_indicators (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_name    text NOT NULL,
    value             real,
    previous_value    real,
    change_pct        real,
    period            text,
    country           text NOT NULL DEFAULT 'AU',
    category          text NOT NULL CHECK (category IN (
                          'gdp', 'inflation', 'employment', 'interest_rate',
                          'consumer_confidence', 'housing', 'trade',
                          'business_confidence')),
    source            text,
    impact_narrative  text,
    published_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_economic_indicators_cat_published
    ON public.economic_indicators(category, published_at DESC);

ALTER TABLE public.economic_indicators ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all indicators (shared reference data)
CREATE POLICY "economic_indicators_select_authenticated"
    ON public.economic_indicators FOR SELECT TO authenticated
    USING (true);

-- Only service_role can insert/update/delete
CREATE POLICY "economic_indicators_service_role"
    ON public.economic_indicators FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 4. reputation_signals
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reputation_signals (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform          text NOT NULL CHECK (platform IN (
                          'google_reviews', 'trustpilot', 'productreview',
                          'glassdoor', 'reddit', 'twitter')),
    signal_type       text NOT NULL CHECK (signal_type IN (
                          'review', 'mention', 'sentiment_shift',
                          'rating_change', 'complaint', 'praise')),
    content           text,
    author            text,
    rating            real,
    sentiment         text CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    sentiment_score   real,
    source_url        text,
    detected_at       timestamptz NOT NULL DEFAULT now(),
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reputation_signals_user_platform_detected
    ON public.reputation_signals(user_id, platform, detected_at DESC);

ALTER TABLE public.reputation_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reputation_signals_select_own"
    ON public.reputation_signals FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "reputation_signals_insert_own"
    ON public.reputation_signals FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reputation_signals_update_own"
    ON public.reputation_signals FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reputation_signals_delete_own"
    ON public.reputation_signals FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "reputation_signals_service_role"
    ON public.reputation_signals FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 5. supply_chain_signals
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supply_chain_signals (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signal_type       text NOT NULL CHECK (signal_type IN (
                          'supplier_risk', 'price_change', 'shortage',
                          'disruption', 'logistics_delay', 'quality_issue',
                          'new_supplier')),
    supplier_name     text,
    industry          text,
    region            text,
    severity          text,
    description       text,
    source            text,
    source_url        text,
    impact_estimate   text,
    detected_at       timestamptz NOT NULL DEFAULT now(),
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_chain_signals_user_detected
    ON public.supply_chain_signals(user_id, detected_at DESC);

ALTER TABLE public.supply_chain_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supply_chain_signals_select_own"
    ON public.supply_chain_signals FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "supply_chain_signals_insert_own"
    ON public.supply_chain_signals FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "supply_chain_signals_update_own"
    ON public.supply_chain_signals FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "supply_chain_signals_delete_own"
    ON public.supply_chain_signals FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "supply_chain_signals_service_role"
    ON public.supply_chain_signals FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 6. job_market_signals
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_market_signals (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name      text,
    is_competitor     boolean NOT NULL DEFAULT false,
    job_title         text,
    department        text,
    location          text,
    seniority         text,
    signal_type       text NOT NULL CHECK (signal_type IN (
                          'new_posting', 'mass_hiring', 'layoff',
                          'executive_hire', 'role_expansion', 'role_reduction')),
    posting_count     integer,
    source            text,
    source_url        text,
    analysis          text,
    detected_at       timestamptz NOT NULL DEFAULT now(),
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_market_signals_user_detected
    ON public.job_market_signals(user_id, detected_at DESC);

ALTER TABLE public.job_market_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_market_signals_select_own"
    ON public.job_market_signals FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "job_market_signals_insert_own"
    ON public.job_market_signals FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "job_market_signals_update_own"
    ON public.job_market_signals FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "job_market_signals_delete_own"
    ON public.job_market_signals FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "job_market_signals_service_role"
    ON public.job_market_signals FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 7. predictions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.predictions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model_name        text NOT NULL,
    prediction_date   date NOT NULL DEFAULT CURRENT_DATE,
    score             real,
    confidence        real,
    reasoning         text,
    data_points_used  integer,
    horizon_days      integer NOT NULL DEFAULT 90,
    details           jsonb DEFAULT '{}'::jsonb,
    actual_outcome    real,                        -- nullable; filled when outcome known
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, model_name, prediction_date)
);

CREATE INDEX IF NOT EXISTS idx_predictions_user_date
    ON public.predictions(user_id, prediction_date DESC);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Users can read their own predictions
CREATE POLICY "predictions_select_own"
    ON public.predictions FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Service role manages predictions (backend writes)
CREATE POLICY "predictions_service_role"
    ON public.predictions FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 8. decision_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.decision_log (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title               text NOT NULL,
    description         text,
    domain              text NOT NULL CHECK (domain IN (
                            'finance', 'sales', 'operations', 'team',
                            'market', 'regulatory', 'strategy')),
    decision_type       text NOT NULL CHECK (decision_type IN (
                            'strategic', 'operational', 'financial',
                            'hiring', 'product', 'marketing', 'investment')),
    urgency             text NOT NULL DEFAULT 'medium' CHECK (urgency IN (
                            'critical', 'high', 'medium', 'low')),
    status              text NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'decided', 'implemented',
                            'reviewing', 'closed')),
    options             jsonb NOT NULL DEFAULT '[]'::jsonb,
    chosen_option       text,
    reasoning           text,
    related_signals     jsonb NOT NULL DEFAULT '[]'::jsonb,
    data_confidence     real,
    expected_outcome    text,
    actual_outcome      text,
    impact_score        real,
    outcome_recorded_at timestamptz,
    scenarios           jsonb NOT NULL DEFAULT '[]'::jsonb,
    decided_at          timestamptz,
    review_at           timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_log_user_created
    ON public.decision_log(user_id, created_at DESC);

ALTER TABLE public.decision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decision_log_select_own"
    ON public.decision_log FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "decision_log_insert_own"
    ON public.decision_log FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "decision_log_update_own"
    ON public.decision_log FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "decision_log_delete_own"
    ON public.decision_log FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "decision_log_service_role"
    ON public.decision_log FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 9. strategic_narratives
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategic_narratives (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    narrative_type      text NOT NULL CHECK (narrative_type IN (
                            'weekly', 'monthly', 'quarterly', 'ad_hoc')),
    period_start        date NOT NULL,
    period_end          date NOT NULL,
    executive_summary   text,
    narrative           text,
    key_developments    jsonb DEFAULT '[]'::jsonb,
    signal_summary      jsonb DEFAULT '{}'::jsonb,
    prediction_summary  jsonb DEFAULT '{}'::jsonb,
    decision_review     jsonb DEFAULT '{}'::jsonb,
    risk_assessment     jsonb DEFAULT '{}'::jsonb,
    opportunities       jsonb DEFAULT '[]'::jsonb,
    recommended_actions jsonb DEFAULT '[]'::jsonb,
    data_completeness   real,
    domains_covered     text[] DEFAULT '{}',
    model_used          text,
    token_count         integer,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, narrative_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_strategic_narratives_user_type_period
    ON public.strategic_narratives(user_id, narrative_type, period_start DESC);

ALTER TABLE public.strategic_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategic_narratives_select_own"
    ON public.strategic_narratives FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "strategic_narratives_insert_own"
    ON public.strategic_narratives FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "strategic_narratives_update_own"
    ON public.strategic_narratives FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "strategic_narratives_delete_own"
    ON public.strategic_narratives FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "strategic_narratives_service_role"
    ON public.strategic_narratives FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 10. marketing_campaigns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform          text NOT NULL CHECK (platform IN (
                          'google_ads', 'meta_ads', 'linkedin_ads', 'other')),
    campaign_id       text NOT NULL,
    campaign_name     text,
    status            text NOT NULL DEFAULT 'active',
    objective         text,
    budget_daily      real,
    budget_total      real,
    currency          text NOT NULL DEFAULT 'AUD',
    start_date        date,
    end_date          date,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, platform, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_user_platform
    ON public.marketing_campaigns(user_id, platform);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_campaigns_select_own"
    ON public.marketing_campaigns FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "marketing_campaigns_insert_own"
    ON public.marketing_campaigns FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "marketing_campaigns_update_own"
    ON public.marketing_campaigns FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "marketing_campaigns_delete_own"
    ON public.marketing_campaigns FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "marketing_campaigns_service_role"
    ON public.marketing_campaigns FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 11. marketing_metrics
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_metrics (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id       uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
    metric_date       date NOT NULL,
    impressions       integer DEFAULT 0,
    clicks            integer DEFAULT 0,
    conversions       integer DEFAULT 0,
    spend             real DEFAULT 0,
    revenue           real DEFAULT 0,
    ctr               real,
    cpc               real,
    cpa               real,
    roas              real,
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_marketing_metrics_campaign_date
    ON public.marketing_metrics(campaign_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_metrics_user_date
    ON public.marketing_metrics(user_id, metric_date DESC);

ALTER TABLE public.marketing_metrics ENABLE ROW LEVEL SECURITY;

-- Users see metrics for their own campaigns (via user_id on the metrics row)
CREATE POLICY "marketing_metrics_select_own"
    ON public.marketing_metrics FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "marketing_metrics_insert_own"
    ON public.marketing_metrics FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "marketing_metrics_update_own"
    ON public.marketing_metrics FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "marketing_metrics_delete_own"
    ON public.marketing_metrics FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "marketing_metrics_service_role"
    ON public.marketing_metrics FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 12. marketing_connections
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_connections (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform          text NOT NULL CHECK (platform IN (
                          'google_ads', 'meta_ads', 'linkedin_ads')),
    account_id        text,
    account_name      text,
    access_token      text,
    refresh_token     text,
    token_expires_at  timestamptz,
    scopes            text[] DEFAULT '{}',
    connected         boolean NOT NULL DEFAULT true,
    connected_at      timestamptz DEFAULT now(),
    last_sync_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_marketing_connections_user_platform
    ON public.marketing_connections(user_id, platform);

ALTER TABLE public.marketing_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_connections_select_own"
    ON public.marketing_connections FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "marketing_connections_insert_own"
    ON public.marketing_connections FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "marketing_connections_update_own"
    ON public.marketing_connections FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "marketing_connections_delete_own"
    ON public.marketing_connections FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "marketing_connections_service_role"
    ON public.marketing_connections FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- =============================================================================
-- updated_at triggers (reuses set_updated_at from migration 085)
-- =============================================================================

-- decision_log
DROP TRIGGER IF EXISTS trg_decision_log_updated_at ON public.decision_log;
CREATE TRIGGER trg_decision_log_updated_at
    BEFORE UPDATE ON public.decision_log
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- marketing_campaigns
DROP TRIGGER IF EXISTS trg_marketing_campaigns_updated_at ON public.marketing_campaigns;
CREATE TRIGGER trg_marketing_campaigns_updated_at
    BEFORE UPDATE ON public.marketing_campaigns
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- RPC: detect_client_silence
--
-- Finds contacts in outlook_emails who have sent 3+ prior emails but whose
-- most recent email is older than p_silence_days (default 21).
-- Filters out automated / noreply addresses.
-- Returns up to 10 results ordered by total_emails DESC.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.detect_client_silence(
    p_user_id      uuid,
    p_silence_days integer DEFAULT 21
)
RETURNS TABLE (
    email         text,
    name          text,
    days_silent   integer,
    was_active    boolean,
    prior_emails  integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        e.from_address                                        AS email,
        MAX(e.from_name)                                      AS name,
        EXTRACT(DAY FROM now() - MAX(e.received_date))::int   AS days_silent,
        true                                                  AS was_active,
        COUNT(*)::int                                         AS prior_emails
    FROM public.outlook_emails e
    WHERE e.user_id = p_user_id
      AND e.from_address IS NOT NULL
      -- filter out automated / noreply addresses
      AND e.from_address NOT ILIKE '%noreply%'
      AND e.from_address NOT ILIKE '%no-reply%'
      AND e.from_address NOT ILIKE '%donotreply%'
      AND e.from_address NOT ILIKE '%do-not-reply%'
      AND e.from_address NOT ILIKE '%notification%'
      AND e.from_address NOT ILIKE '%mailer-daemon%'
      AND e.from_address NOT ILIKE '%postmaster%'
    GROUP BY e.from_address
    HAVING COUNT(*) >= 3
       AND MAX(e.received_date) < now() - (p_silence_days || ' days')::interval
    ORDER BY COUNT(*) DESC
    LIMIT 10;
$$;


-- =============================================================================
-- RPC: marketing_overview_metrics
--
-- Returns a single JSONB object with aggregated marketing metrics for the
-- last 30 days: total_spend, total_impressions, total_clicks,
-- total_conversions, avg_ctr, avg_roas.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.marketing_overview_metrics(
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (
            SELECT jsonb_build_object(
                'total_spend',       COALESCE(SUM(m.spend), 0),
                'total_impressions', COALESCE(SUM(m.impressions), 0),
                'total_clicks',      COALESCE(SUM(m.clicks), 0),
                'total_conversions', COALESCE(SUM(m.conversions), 0),
                'avg_ctr',           COALESCE(AVG(m.ctr), 0),
                'avg_roas',          COALESCE(AVG(m.roas), 0)
            )
            FROM public.marketing_metrics m
            JOIN public.marketing_campaigns c ON c.id = m.campaign_id
            WHERE c.user_id = p_user_id
              AND m.metric_date >= CURRENT_DATE - 30
        ),
        '{"total_spend":0,"total_impressions":0,"total_clicks":0,"total_conversions":0,"avg_ctr":0,"avg_roas":0}'::jsonb
    );
$$;


-- =============================================================================
-- GRANTs (belt-and-suspenders alongside RLS)
-- =============================================================================
GRANT SELECT ON public.industry_news          TO authenticated;
GRANT SELECT ON public.regulatory_signals     TO authenticated;
GRANT SELECT ON public.economic_indicators    TO authenticated;
GRANT SELECT ON public.reputation_signals     TO authenticated;
GRANT SELECT ON public.supply_chain_signals   TO authenticated;
GRANT SELECT ON public.job_market_signals     TO authenticated;
GRANT SELECT ON public.predictions            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_log          TO authenticated;
GRANT SELECT ON public.strategic_narratives   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_metrics     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_connections TO authenticated;

GRANT ALL ON public.industry_news          TO service_role;
GRANT ALL ON public.regulatory_signals     TO service_role;
GRANT ALL ON public.economic_indicators    TO service_role;
GRANT ALL ON public.reputation_signals     TO service_role;
GRANT ALL ON public.supply_chain_signals   TO service_role;
GRANT ALL ON public.job_market_signals     TO service_role;
GRANT ALL ON public.predictions            TO service_role;
GRANT ALL ON public.decision_log           TO service_role;
GRANT ALL ON public.strategic_narratives   TO service_role;
GRANT ALL ON public.marketing_campaigns    TO service_role;
GRANT ALL ON public.marketing_metrics      TO service_role;
GRANT ALL ON public.marketing_connections  TO service_role;


-- =============================================================================
-- Table comments
-- =============================================================================
COMMENT ON TABLE public.industry_news          IS 'Curated industry news articles per user with sentiment and relevance scoring.';
COMMENT ON TABLE public.regulatory_signals     IS 'Regulatory and compliance alerts with jurisdiction, severity, and deadlines.';
COMMENT ON TABLE public.economic_indicators    IS 'Shared macro-economic indicator data (GDP, inflation, etc.) for AU and beyond.';
COMMENT ON TABLE public.reputation_signals     IS 'Online reputation monitoring: reviews, mentions, sentiment shifts.';
COMMENT ON TABLE public.supply_chain_signals   IS 'Supply-chain risk tracking: disruptions, shortages, price changes.';
COMMENT ON TABLE public.job_market_signals     IS 'Competitor and labor market intelligence: hiring patterns, layoffs.';
COMMENT ON TABLE public.predictions            IS 'AI/ML model predictions with confidence scores and eventual actual outcomes.';
COMMENT ON TABLE public.decision_log           IS 'Structured decision journal with options, reasoning, and outcome tracking.';
COMMENT ON TABLE public.strategic_narratives   IS 'AI-generated periodic strategic briefings (weekly/monthly/quarterly).';
COMMENT ON TABLE public.marketing_campaigns    IS 'Ad campaign metadata synced from Google Ads, Meta, LinkedIn.';
COMMENT ON TABLE public.marketing_metrics      IS 'Daily ad campaign performance metrics (spend, clicks, conversions, ROAS).';
COMMENT ON TABLE public.marketing_connections  IS 'OAuth connections to ad platforms with token storage.';
COMMENT ON FUNCTION public.detect_client_silence IS 'Finds contacts with 3+ prior emails who have gone silent beyond N days.';
COMMENT ON FUNCTION public.marketing_overview_metrics IS 'Returns JSONB summary of 30-day marketing spend and performance.';
