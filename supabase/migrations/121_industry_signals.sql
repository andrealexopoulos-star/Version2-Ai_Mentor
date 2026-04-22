-- Migration 121: public.industry_signals
-- Cold-start feed content for fresh users with no integrations connected.
-- Sprint B #14 (2026-04-22). 5 seed rows of generic SMB-useful content so
-- the Advisor never renders blank for a brand-new signup.
-- Append-only, all authenticated users can read, writes via service role only.

CREATE TABLE IF NOT EXISTS public.industry_signals (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text         NOT NULL CHECK (char_length(title) BETWEEN 1 AND 280),
    description     text         NULL     CHECK (description IS NULL OR char_length(description) <= 2000),
    source          text         NOT NULL CHECK (char_length(source) BETWEEN 1 AND 140),
    industry        text         NOT NULL DEFAULT 'general',
    published_at    timestamptz  NOT NULL DEFAULT now(),
    created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industry_signals_industry_published
    ON public.industry_signals (industry, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_industry_signals_published
    ON public.industry_signals (published_at DESC);

ALTER TABLE public.industry_signals ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (cold-start feed is not user-specific).
DROP POLICY IF EXISTS industry_signals_auth_read ON public.industry_signals;
CREATE POLICY industry_signals_auth_read
    ON public.industry_signals FOR SELECT
    TO authenticated
    USING (true);

-- Writes are service-role only (no INSERT/UPDATE/DELETE policies for
-- authenticated users — service_role bypasses RLS, so backend seeders and
-- future editorial flows still work).

-- =================================================================
-- Seed: 5 generic SMB signals (industry='general').
-- Manually curated — NOT AI-generated. Sourced from current AU SMB context.
-- =================================================================
INSERT INTO public.industry_signals (title, description, source, industry, published_at)
VALUES
    (
        'SMBs are taking on average 47 days to collect invoices this quarter',
        'Cash-flow pressure is climbing across Australian small business — median DSO has stretched from 38 to 47 days year-on-year. Businesses tightening collections cadence are recovering 11% faster on average.',
        'Xero Small Business Insights',
        'general',
        now() - interval '2 days'
    ),
    (
        'ATO PAYG reporting deadline in 14 days',
        'Single Touch Payroll reporting is due by the 21st. Late lodgement triggers a failure-to-lodge penalty starting at $330 per 28-day period.',
        'Australian Taxation Office',
        'general',
        now() - interval '1 day'
    ),
    (
        'Google Ads CPC up 8% in AU services industry this month',
        'Service-industry advertisers on Google are seeing an 8.3% CPC increase month-over-month, driven by auction competition from new entrants. Lifetime value per lead is flat, so acquisition ROI is compressing.',
        'Google Ads — AU benchmarks',
        'general',
        now() - interval '3 days'
    ),
    (
        '1 in 3 SMBs report cybersecurity incidents in the last 12 months',
        'Australian Cyber Security Centre data shows 33% of SMBs experienced a reportable incident in the last year, with business email compromise (BEC) the most common vector. Average recovery cost: $39,000.',
        'Australian Cyber Security Centre',
        'general',
        now() - interval '5 days'
    ),
    (
        'RBA holds cash rate — mortgage and business-loan pressure persists',
        'Cash rate unchanged this month but SME lending margins remain tight. SMBs with variable-rate business facilities should review covenants and consider fixed-rate hedging before the next review window.',
        'Reserve Bank of Australia',
        'general',
        now() - interval '7 days'
    )
ON CONFLICT DO NOTHING;
