BEGIN;

CREATE OR REPLACE FUNCTION public.trg_observation_to_watchtower()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_account_id uuid;
  v_fingerprint text;
BEGIN
  IF NEW.severity NOT IN ('critical','high') THEN RETURN NEW; END IF;
  SELECT account_id INTO v_account_id FROM public.users WHERE id = NEW.user_id LIMIT 1;
  IF v_account_id IS NULL THEN v_account_id := NEW.user_id; END IF;
  v_fingerprint := NEW.domain || ':' || NEW.event_type || ':' || COALESCE(NEW.fingerprint, NEW.id::text);

  INSERT INTO public.watchtower_events (
    account_id, domain, type, severity, headline, statement,
    evidence_payload, source, fingerprint, status, created_at
  ) VALUES (
    v_account_id, NEW.domain, NEW.event_type, NEW.severity,
    COALESCE(NEW.executive_summary, NEW.domain || ' ' || NEW.event_type),
    COALESCE(NEW.executive_summary, ''),
    COALESCE(NEW.payload, '{}'::jsonb),
    COALESCE(NEW.source, 'observation_events'),
    v_fingerprint, 'active', NEW.created_at
  )
  ON CONFLICT (account_id, fingerprint) DO UPDATE
  SET severity = CASE
        WHEN EXCLUDED.severity = 'critical' THEN 'critical'
        WHEN watchtower_events.severity = 'critical' THEN 'critical'
        ELSE EXCLUDED.severity
      END,
      updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_observation_events_to_watchtower ON public.observation_events;
CREATE TRIGGER trg_observation_events_to_watchtower
  AFTER INSERT ON public.observation_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_observation_to_watchtower();

INSERT INTO public.watchtower_events (
  account_id, domain, type, severity, headline, statement,
  evidence_payload, source, fingerprint, status, created_at
)
SELECT
  COALESCE((SELECT account_id FROM public.users WHERE id = oe.user_id LIMIT 1), oe.user_id),
  oe.domain, oe.event_type, oe.severity,
  COALESCE(oe.executive_summary, oe.domain || ' ' || oe.event_type),
  COALESCE(oe.executive_summary, ''),
  COALESCE(oe.payload, '{}'::jsonb),
  COALESCE(oe.source, 'observation_events'),
  oe.domain || ':' || oe.event_type || ':' || COALESCE(oe.fingerprint, oe.id::text),
  'active', oe.created_at
FROM public.observation_events oe
WHERE oe.severity IN ('critical','high')
ON CONFLICT (account_id, fingerprint) DO NOTHING;

COMMIT;
