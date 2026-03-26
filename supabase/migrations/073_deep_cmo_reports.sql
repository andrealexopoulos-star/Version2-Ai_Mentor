-- Deep CMO report persistence and monetisation support.

create table if not exists public.deep_cmo_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null default 'deep_cmo',
  status text not null default 'generating',
  abn_status text not null default 'not_found',
  social_status text not null default 'not_detected',
  source_hash text,
  source_payload jsonb not null default '{}'::jsonb,
  report_payload jsonb not null default '{}'::jsonb,
  pdf_filename text,
  pdf_url text,
  quota_month_key text not null,
  created_at timestamptz not null default now(),
  generated_at timestamptz
);

create index if not exists idx_deep_cmo_reports_user_created
  on public.deep_cmo_reports(user_id, created_at desc);

create index if not exists idx_deep_cmo_reports_quota
  on public.deep_cmo_reports(user_id, quota_month_key);

create unique index if not exists idx_deep_cmo_reports_source_hash
  on public.deep_cmo_reports(user_id, source_hash)
  where source_hash is not null;

alter table public.deep_cmo_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'deep_cmo_reports'
      and policyname = 'Users can view own deep cmo reports'
  ) then
    create policy "Users can view own deep cmo reports"
      on public.deep_cmo_reports
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

grant all on public.deep_cmo_reports to service_role;
grant select on public.deep_cmo_reports to authenticated;
