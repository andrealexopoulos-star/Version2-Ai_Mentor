-- Lock down unsafe RLS policies that currently target the "public" role.
-- This migration is intentionally policy-only: no table/index/data changes.

DO $$
DECLARE
  sensitive_tables text[] := ARRAY[
    'payment_transactions',
    'pricing_plans',
    'pricing_features',
    'pricing_releases',
    'pricing_audit_log',
    'outlook_emails',
    'watchtower_events',
    'calibration_sessions',
    'calibration_schedules',
    'deferred_integrations',
    'escalation_history',
    'intelligence_priorities',
    'progress_cadence',
    'strategy_profiles',
    'usability_test_checkpoints',
    'ux_feedback_events',
    'working_schedules'
  ];
  user_scoped_read_tables text[] := ARRAY[
    'payment_transactions',
    'outlook_emails',
    'escalation_history',
    'calibration_sessions',
    'calibration_schedules',
    'watchtower_events'
  ];
  v_table_name text;
  pol record;
  user_scope_expr text;
BEGIN
  -- 1) Remove all policies that target "public" on the 17 sensitive tables.
  -- 2) Recreate service role full access on those tables.
  FOREACH v_table_name IN ARRAY sensitive_tables LOOP
    IF to_regclass(format('public.%I', v_table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping missing table public.%', v_table_name;
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table_name
        AND 'public'::name = ANY(roles)
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, v_table_name);
    END LOOP;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_full_access', v_table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_full_access',
      v_table_name
    );
  END LOOP;

  -- 3) Add authenticated user-scoped read policies on user-facing tables.
  FOREACH v_table_name IN ARRAY user_scoped_read_tables LOOP
    IF to_regclass(format('public.%I', v_table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping missing table public.%', v_table_name;
      CONTINUE;
    END IF;

    user_scope_expr := NULL;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table_name
        AND column_name = 'user_id'
    ) THEN
      user_scope_expr := 'user_id = auth.uid()';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table_name
        AND column_name = 'tenant_id'
    ) THEN
      user_scope_expr := 'tenant_id = auth.uid()';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table_name
        AND column_name = 'workspace_id'
    ) THEN
      user_scope_expr := 'workspace_id IN (SELECT account_id FROM public.memberships WHERE user_id = auth.uid())';
    END IF;

    IF user_scope_expr IS NULL THEN
      RAISE EXCEPTION
        'Cannot derive user-scoped policy expression for public.% (missing user_id/tenant_id/workspace_id)',
        v_table_name;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'user_read_own', v_table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
      'user_read_own',
      v_table_name,
      user_scope_expr
    );
  END LOOP;

  -- 4) Rewrite all SELECT policies that currently grant open reads to "public".
  --    Keep original policy names, but scope reads to authenticated users.
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'SELECT'
      AND 'public'::name = ANY(roles)
      AND lower(regexp_replace(COALESCE(qual, ''), '\s+', '', 'g')) IN ('true', '(true)')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR SELECT TO authenticated USING (true)',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;
END
$$;

-- Safety check aligned with success metric:
-- no public-targeted ALL policies, and no public-targeted SELECT policies with qual=true.
DO $$
DECLARE
  remaining_critical bigint;
BEGIN
  SELECT COUNT(*)
  INTO remaining_critical
  FROM pg_policies
  WHERE schemaname = 'public'
    AND 'public'::name = ANY(roles)
    AND (
      cmd = 'ALL'
      OR lower(regexp_replace(COALESCE(qual, ''), '\s+', '', 'g')) IN ('true', '(true)')
    );

  IF remaining_critical <> 0 THEN
    RAISE EXCEPTION
      'RLS lockdown failed: % critical public policy exposures remain.',
      remaining_critical;
  END IF;
END
$$;
