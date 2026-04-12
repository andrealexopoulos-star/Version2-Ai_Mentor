-- 078_user_settings.sql
-- Settings page: Signals section (5 threshold selects) + Notifications section (6 toggles)
-- Supports the full Settings mockup with all interactive elements persisting to real data.

CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Notification toggles (6 from Settings mockup)
    notify_morning_brief BOOLEAN NOT NULL DEFAULT true,
    notify_critical_alerts BOOLEAN NOT NULL DEFAULT true,
    notify_high_alerts BOOLEAN NOT NULL DEFAULT true,
    notify_weekly_report BOOLEAN NOT NULL DEFAULT true,
    notify_nudges BOOLEAN NOT NULL DEFAULT true,
    notify_marketing BOOLEAN NOT NULL DEFAULT false,

    -- Signal thresholds (5 from Settings mockup)
    threshold_deal_stall_days INTEGER NOT NULL DEFAULT 14,
    threshold_cash_runway_months INTEGER NOT NULL DEFAULT 6,
    threshold_meeting_overload_pct INTEGER NOT NULL DEFAULT 60,
    threshold_churn_silence_days INTEGER NOT NULL DEFAULT 21,
    threshold_invoice_aging_pct INTEGER NOT NULL DEFAULT 15,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can only read/write their own settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
CREATE POLICY "Users manage own settings" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role bypass for backend operations
DROP POLICY IF EXISTS "Service role full access user_settings" ON public.user_settings;
CREATE POLICY "Service role full access user_settings" ON public.user_settings
    FOR ALL USING (auth.role() = 'service_role');

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION public.update_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_settings_updated ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_user_settings_timestamp();
