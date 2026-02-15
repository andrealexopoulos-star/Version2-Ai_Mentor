-- Prompt Audit Logs — tracks every prompt edit for compliance and rollback
CREATE TABLE IF NOT EXISTS prompt_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_key TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'update',
  old_version TEXT,
  new_version TEXT,
  old_content_preview TEXT,
  new_content_preview TEXT,
  changed_by TEXT,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_audit_key ON prompt_audit_logs(prompt_key);
CREATE INDEX IF NOT EXISTS idx_prompt_audit_time ON prompt_audit_logs(changed_at DESC);
