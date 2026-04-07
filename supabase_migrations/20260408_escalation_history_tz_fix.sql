BEGIN;

ALTER TABLE public.escalation_history
  ALTER COLUMN escalated_at TYPE timestamptz USING escalated_at AT TIME ZONE 'UTC';
ALTER TABLE public.escalation_history
  ALTER COLUMN recovered_at TYPE timestamptz USING recovered_at AT TIME ZONE 'UTC';
ALTER TABLE public.escalation_history
  ALTER COLUMN escalated_at SET DEFAULT now();

COMMIT;
