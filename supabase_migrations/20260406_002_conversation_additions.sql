ALTER TABLE soundboard_conversations
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_conv_user_starred ON soundboard_conversations(user_id, is_starred, updated_at DESC);
