BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='watchtower_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watchtower_events;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='boardroom_conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.boardroom_conversations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='boardroom_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.boardroom_messages;
  END IF;
END $$;

COMMIT;
