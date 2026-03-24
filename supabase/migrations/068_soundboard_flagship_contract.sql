-- 068_soundboard_flagship_contract.sql
-- Canonical Soundboard persistence and tenant-safe policies for flagship contract.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.soundboard_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  contract_version TEXT NOT NULL DEFAULT 'soundboard_v3',
  mode_requested TEXT,
  mode_effective TEXT,
  last_model_used TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.soundboard_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.soundboard_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  action_id TEXT,
  evidence_pack JSONB NOT NULL DEFAULT '{}'::jsonb,
  boardroom_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.soundboard_conversations
  ADD COLUMN IF NOT EXISTS contract_version TEXT NOT NULL DEFAULT 'soundboard_v3',
  ADD COLUMN IF NOT EXISTS mode_requested TEXT,
  ADD COLUMN IF NOT EXISTS mode_effective TEXT,
  ADD COLUMN IF NOT EXISTS last_model_used TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

ALTER TABLE public.soundboard_messages
  ADD COLUMN IF NOT EXISTS action_id TEXT,
  ADD COLUMN IF NOT EXISTS evidence_pack JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS boardroom_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_soundboard_conversations_user_updated
  ON public.soundboard_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_soundboard_messages_conv_ts
  ON public.soundboard_messages(conversation_id, timestamp ASC);

ALTER TABLE public.soundboard_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soundboard_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'soundboard_conversations' AND policyname = 'sb_conversations_select_own'
  ) THEN
    CREATE POLICY sb_conversations_select_own ON public.soundboard_conversations
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'soundboard_conversations' AND policyname = 'sb_conversations_insert_own'
  ) THEN
    CREATE POLICY sb_conversations_insert_own ON public.soundboard_conversations
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'soundboard_conversations' AND policyname = 'sb_conversations_update_own'
  ) THEN
    CREATE POLICY sb_conversations_update_own ON public.soundboard_conversations
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'soundboard_conversations' AND policyname = 'sb_conversations_delete_own'
  ) THEN
    CREATE POLICY sb_conversations_delete_own ON public.soundboard_conversations
      FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'soundboard_messages' AND policyname = 'sb_messages_select_own'
  ) THEN
    CREATE POLICY sb_messages_select_own ON public.soundboard_messages
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'soundboard_messages' AND policyname = 'sb_messages_insert_own'
  ) THEN
    CREATE POLICY sb_messages_insert_own ON public.soundboard_messages
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'soundboard_messages' AND policyname = 'sb_messages_update_own'
  ) THEN
    CREATE POLICY sb_messages_update_own ON public.soundboard_messages
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'soundboard_messages' AND policyname = 'sb_messages_delete_own'
  ) THEN
    CREATE POLICY sb_messages_delete_own ON public.soundboard_messages
      FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.soundboard_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soundboard_messages TO authenticated;

COMMIT;
