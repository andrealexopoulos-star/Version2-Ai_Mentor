-- 134_drive_canonical_tables.sql
-- Additive schema alignment for Google Drive / File Storage reliability.

CREATE TABLE IF NOT EXISTS public.merge_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  account_token text NOT NULL,
  integration_category text NOT NULL,
  integration_slug text NOT NULL,
  status text,
  connected_at timestamptz,
  last_sync_at timestamptz,
  end_user_email text
);

ALTER TABLE public.merge_integrations
  ADD COLUMN IF NOT EXISTS integration_name text;

ALTER TABLE public.merge_integrations
  ADD COLUMN IF NOT EXISTS sync_status text;

ALTER TABLE public.merge_integrations
  ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.merge_integrations
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

ALTER TABLE public.merge_integrations
  ADD COLUMN IF NOT EXISTS sync_stats jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_merge_integrations_user_category
  ON public.merge_integrations (user_id, integration_category, integration_slug);

CREATE INDEX IF NOT EXISTS idx_merge_integrations_account_token
  ON public.merge_integrations (account_token);

CREATE TABLE IF NOT EXISTS public.google_drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  merge_file_id text NOT NULL,
  merge_account_token text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  mime_type text,
  file_size bigint,
  parent_folder_id text,
  web_view_link text,
  owner_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz,
  document_type text,
  business_relevance text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_drive_files_account_merge_file
  ON public.google_drive_files (account_id, merge_file_id);

CREATE INDEX IF NOT EXISTS idx_google_drive_files_user
  ON public.google_drive_files (user_id);

CREATE TABLE IF NOT EXISTS public.drive_scope_policy (
  user_id uuid PRIMARY KEY,
  allow_all_files boolean NOT NULL DEFAULT false,
  folder_ids text[] NOT NULL DEFAULT '{}'::text[],
  file_type_includes text[] NOT NULL DEFAULT '{}'::text[],
  file_type_excludes text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_scope_policy_updated_at
  ON public.drive_scope_policy (updated_at DESC);

ALTER TABLE public.merge_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_scope_policy ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'merge_integrations' AND policyname = 'merge_integrations_user_read'
  ) THEN
    CREATE POLICY merge_integrations_user_read ON public.merge_integrations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'merge_integrations' AND policyname = 'merge_integrations_user_write'
  ) THEN
    CREATE POLICY merge_integrations_user_write ON public.merge_integrations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'merge_integrations' AND policyname = 'merge_integrations_service_role'
  ) THEN
    CREATE POLICY merge_integrations_service_role ON public.merge_integrations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'google_drive_files' AND policyname = 'google_drive_files_user_read'
  ) THEN
    CREATE POLICY google_drive_files_user_read ON public.google_drive_files
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'google_drive_files' AND policyname = 'google_drive_files_user_write'
  ) THEN
    CREATE POLICY google_drive_files_user_write ON public.google_drive_files
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'google_drive_files' AND policyname = 'google_drive_files_service_role'
  ) THEN
    CREATE POLICY google_drive_files_service_role ON public.google_drive_files
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'drive_scope_policy' AND policyname = 'drive_scope_policy_user_read'
  ) THEN
    CREATE POLICY drive_scope_policy_user_read ON public.drive_scope_policy
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'drive_scope_policy' AND policyname = 'drive_scope_policy_user_write'
  ) THEN
    CREATE POLICY drive_scope_policy_user_write ON public.drive_scope_policy
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'drive_scope_policy' AND policyname = 'drive_scope_policy_service_role'
  ) THEN
    CREATE POLICY drive_scope_policy_service_role ON public.drive_scope_policy
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
