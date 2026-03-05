-- ============================================================
-- Supabase: user_feature_usage
-- Server-side tracking of scan usage per user
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS user_feature_usage (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name    TEXT NOT NULL,
  last_used_at    TIMESTAMPTZ DEFAULT now(),
  use_count       INTEGER DEFAULT 1,
  UNIQUE(user_id, feature_name)
);

ALTER TABLE user_feature_usage ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE user_feature_usage ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 1;

ALTER TABLE user_feature_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users manage own feature usage" ON user_feature_usage;
END $$;

CREATE POLICY "Users manage own feature usage"
  ON user_feature_usage FOR ALL
  USING (auth.uid() = user_id);
