-- Sprint 1: Tutorial Progress — Cross-device persistence
-- Run in Supabase SQL Editor on project vwwandhoydemcybltoxz

-- 1. Create tutorial_progress table
CREATE TABLE IF NOT EXISTS tutorial_progress (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key    text NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, page_key)
);

CREATE INDEX IF NOT EXISTS idx_tutorial_progress_user ON tutorial_progress(user_id);

ALTER TABLE tutorial_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tutorial progress"
  ON tutorial_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Add tutorials_disabled flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorials_disabled boolean DEFAULT false;
