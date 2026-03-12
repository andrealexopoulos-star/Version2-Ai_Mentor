-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 055: AI Usage Rate Limiting
-- Tracks daily AI usage per user per feature for subscription gates
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  key          text PRIMARY KEY,           -- "{user_id}:{feature}:{date}"
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature      text NOT NULL,              -- soundboard_daily, snapshots_daily, etc.
  date         date NOT NULL DEFAULT CURRENT_DATE,
  count        integer NOT NULL DEFAULT 0,
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage_log(user_id, date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_usage_log(feature, date);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own usage" ON public.ai_usage_log
  USING (auth.uid() = user_id);
GRANT ALL ON public.ai_usage_log TO service_role;
GRANT SELECT ON public.ai_usage_log TO authenticated;

-- Add subscription_tier index for fast rate limit lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON public.users(subscription_tier);

-- Ensure subscription_tier has a default
ALTER TABLE public.users
  ALTER COLUMN subscription_tier SET DEFAULT 'free';

UPDATE public.users SET subscription_tier = 'free' WHERE subscription_tier IS NULL;
