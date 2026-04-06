CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sidebar_width INTEGER DEFAULT 260,
  sidebar_collapsed BOOLEAN DEFAULT FALSE,
  default_agent TEXT DEFAULT 'auto',
  default_mode TEXT DEFAULT 'auto',
  theme TEXT DEFAULT 'dark',
  dismissed_insights JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_owner"
ON user_settings FOR ALL
USING (auth.uid() = user_id);
