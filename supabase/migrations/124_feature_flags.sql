-- Migration 124: Sprint D #28c — feature flags / kill switches for super admin.
CREATE TABLE IF NOT EXISTS public.feature_flags (
  flag_key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on feature_flags"
  ON public.feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read access on feature_flags"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);

INSERT INTO public.feature_flags (flag_key, enabled, description) VALUES
  ('trinity_synthesis_enabled',      true, 'biqc-trinity edge fn. Disable to pause all Trinity synthesis calls.'),
  ('morning_brief_cron_enabled',     true, 'Daily morning brief email worker. Disable to pause daily sends.'),
  ('calibration_deep_scan_enabled',  true, 'Expensive sonar-pro deep scans in calibration. Disable to cap costs.'),
  ('new_user_signup_enabled',        true, 'Public registration. Disable to gate signups during incidents.'),
  ('stripe_webhook_processing',      true, 'Stripe webhook ingestion. Disable to pause subscription sync during incidents.'),
  ('edge_function_global_pause',     true, 'Master switch. When OFF every edge fn that reads this should short-circuit.'),
  ('email_sync_cron_enabled',        true, 'Inbox sync cron. Disable to pause email ingestion.'),
  ('llm_global_pause',               true, 'Master pause for ALL LLM calls. When OFF callers should return cached/placeholder.')
ON CONFLICT (flag_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_feature_flag_enabled(flag TEXT, default_value BOOLEAN DEFAULT true)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled FROM public.feature_flags WHERE flag_key = flag LIMIT 1;
  RETURN COALESCE(v_enabled, default_value);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_flag_enabled(TEXT, BOOLEAN) TO authenticated, service_role;
