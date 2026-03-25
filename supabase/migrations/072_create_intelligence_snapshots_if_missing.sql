-- Ensure intelligence_snapshots exists before dependent migrations/functions use it.
-- This is idempotent and safe to run in partially-initialized environments.

create table if not exists public.intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  snapshot_type text default 'periodic',
  summary text,
  executive_memo text,
  cognitive_snapshot jsonb default '{}'::jsonb,
  domains jsonb default '{}'::jsonb,
  open_risks jsonb default '[]'::jsonb,
  resolution_score numeric,
  snapshot_confidence numeric,
  generated_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_intelligence_snapshots_user_id
  on public.intelligence_snapshots(user_id);

create index if not exists idx_intelligence_snapshots_generated_at
  on public.intelligence_snapshots(generated_at desc);

alter table public.intelligence_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'intelligence_snapshots'
      and policyname = 'Users can view own snapshots'
  ) then
    create policy "Users can view own snapshots"
      on public.intelligence_snapshots
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

