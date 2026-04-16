-- Action items tracking table for SWOT/CMO/industry action management
-- Applied via MCP on 2026-04-16

CREATE TABLE IF NOT EXISTS public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done')),
  assigned_to text,
  due_date date,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_items_owner" ON public.action_items
  FOR ALL USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_items TO authenticated;

CREATE INDEX idx_action_items_user_status ON public.action_items(user_id, status);
