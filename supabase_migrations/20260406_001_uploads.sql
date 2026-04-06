CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES soundboard_conversations(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf','docx','xlsx','csv','image')),
  extracted_text TEXT,
  extracted_json JSONB,
  storage_path TEXT,
  storage_bucket TEXT DEFAULT 'user-files',
  size_bytes INTEGER,
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uploads_owner"
ON uploads FOR ALL
USING (auth.uid() = user_id);

CREATE INDEX idx_uploads_user ON uploads(user_id);
CREATE INDEX idx_uploads_conv ON uploads(conversation_id);
