-- ═══════════════════════════════════════════════════════════════
-- BIQC SYSTEM PROMPTS TABLE — Phase 2 Migration Target
-- Run this in Supabase SQL Editor to create the table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_key TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL DEFAULT '1.0',
  agent TEXT NOT NULL,
  description TEXT,
  source_file TEXT,
  source_function TEXT,
  source_lines TEXT,
  dynamic_variables JSONB DEFAULT '[]'::jsonb,
  raw_content TEXT NOT NULL,
  system_message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_prompts_key ON system_prompts(prompt_key);
CREATE INDEX IF NOT EXISTS idx_system_prompts_agent ON system_prompts(agent);
CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(is_active);

COMMENT ON TABLE system_prompts IS 'Central registry of all AI system prompts. Extracted from hardcoded strings in server.py and helper files. Enables A/B testing, versioning, and hot-swapping without redeployment.';
