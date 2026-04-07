BEGIN;

CREATE TABLE IF NOT EXISTS public.boardroom_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('boardroom','war_room')),
  title text,
  focus_area text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boardroom_conversations_user_updated
  ON public.boardroom_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_boardroom_conversations_user_mode_status
  ON public.boardroom_conversations(user_id, mode, status);

CREATE TABLE IF NOT EXISTS public.boardroom_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.boardroom_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','advisor','system')),
  content text NOT NULL,
  focus_area text,
  explainability jsonb DEFAULT '{}'::jsonb,
  evidence_chain jsonb DEFAULT '[]'::jsonb,
  priority_compression jsonb DEFAULT '{}'::jsonb,
  lineage jsonb DEFAULT '{}'::jsonb,
  confidence_score numeric(4,3),
  degraded boolean DEFAULT false,
  source_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boardroom_messages_conv_created
  ON public.boardroom_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_user_created
  ON public.boardroom_messages(user_id, created_at DESC);

ALTER TABLE public.boardroom_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boardroom_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "br_conversations_select_own" ON public.boardroom_conversations;
CREATE POLICY "br_conversations_select_own" ON public.boardroom_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "br_conversations_insert_own" ON public.boardroom_conversations;
CREATE POLICY "br_conversations_insert_own" ON public.boardroom_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "br_conversations_update_own" ON public.boardroom_conversations;
CREATE POLICY "br_conversations_update_own" ON public.boardroom_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "br_conversations_delete_own" ON public.boardroom_conversations;
CREATE POLICY "br_conversations_delete_own" ON public.boardroom_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "br_conversations_service_role" ON public.boardroom_conversations;
CREATE POLICY "br_conversations_service_role" ON public.boardroom_conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "br_messages_select_own" ON public.boardroom_messages;
CREATE POLICY "br_messages_select_own" ON public.boardroom_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "br_messages_insert_own" ON public.boardroom_messages;
CREATE POLICY "br_messages_insert_own" ON public.boardroom_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "br_messages_service_role" ON public.boardroom_messages;
CREATE POLICY "br_messages_service_role" ON public.boardroom_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.trg_boardroom_message_upsert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.boardroom_conversations
  SET message_count = message_count + 1,
      last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_boardroom_messages_after_insert ON public.boardroom_messages;
CREATE TRIGGER trg_boardroom_messages_after_insert
  AFTER INSERT ON public.boardroom_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_boardroom_message_upsert();

COMMIT;
