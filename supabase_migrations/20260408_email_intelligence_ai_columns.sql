ALTER TABLE IF EXISTS public.email_intelligence
  ADD COLUMN IF NOT EXISTS urgency text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS business_impact_score int,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS action_required boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_intelligence_user_email
  ON public.email_intelligence(user_id, email_id);

CREATE INDEX IF NOT EXISTS idx_email_intelligence_user_created
  ON public.email_intelligence(user_id, created_at DESC);
