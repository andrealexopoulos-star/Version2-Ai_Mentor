-- 065_rls_tenant_lockdown.sql
-- P0 hardening migration:
-- Replace permissive tenant policies with user-scoped predicates.

-- ------------------------------------------------------------
-- workspace_integrations
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.workspace_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own workspace_integrations" ON public.workspace_integrations;
DROP POLICY IF EXISTS "workspace_integrations_tenant_read" ON public.workspace_integrations;
CREATE POLICY "workspace_integrations_tenant_read"
ON public.workspace_integrations
FOR SELECT
TO authenticated
USING (workspace_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages workspace_integrations" ON public.workspace_integrations;
DROP POLICY IF EXISTS "workspace_integrations_service_manage" ON public.workspace_integrations;
CREATE POLICY "workspace_integrations_service_manage"
ON public.workspace_integrations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------
-- governance_events
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.governance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own governance_events" ON public.governance_events;
DROP POLICY IF EXISTS "governance_events_tenant_read" ON public.governance_events;
CREATE POLICY "governance_events_tenant_read"
ON public.governance_events
FOR SELECT
TO authenticated
USING (workspace_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages governance_events" ON public.governance_events;
DROP POLICY IF EXISTS "governance_events_service_manage" ON public.governance_events;
DROP POLICY IF EXISTS "service_insert_governance_events" ON public.governance_events;
CREATE POLICY "governance_events_service_read"
ON public.governance_events
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "governance_events_service_insert"
ON public.governance_events
FOR INSERT
TO service_role
WITH CHECK (true);

-- ------------------------------------------------------------
-- report_exports
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.report_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own report_exports" ON public.report_exports;
DROP POLICY IF EXISTS "report_exports_tenant_read" ON public.report_exports;
CREATE POLICY "report_exports_tenant_read"
ON public.report_exports
FOR SELECT
TO authenticated
USING (workspace_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages report_exports" ON public.report_exports;
DROP POLICY IF EXISTS "service_manage_reports" ON public.report_exports;
DROP POLICY IF EXISTS "report_exports_service_manage" ON public.report_exports;
CREATE POLICY "report_exports_service_manage"
ON public.report_exports
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------
-- generated_files
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.generated_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_read_files" ON public.generated_files;
DROP POLICY IF EXISTS "generated_files_tenant_read" ON public.generated_files;
CREATE POLICY "generated_files_tenant_read"
ON public.generated_files
FOR SELECT
TO authenticated
USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "service_manage_files" ON public.generated_files;
DROP POLICY IF EXISTS "generated_files_service_manage" ON public.generated_files;
CREATE POLICY "generated_files_service_manage"
ON public.generated_files
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------
-- enterprise_contact_requests
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.enterprise_contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit enterprise_contact_requests" ON public.enterprise_contact_requests;
DROP POLICY IF EXISTS "Admins see all enterprise_contact_requests" ON public.enterprise_contact_requests;
DROP POLICY IF EXISTS "enterprise_contact_requests_user_insert" ON public.enterprise_contact_requests;
DROP POLICY IF EXISTS "enterprise_contact_requests_user_read" ON public.enterprise_contact_requests;
CREATE POLICY "enterprise_contact_requests_user_insert"
ON public.enterprise_contact_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "enterprise_contact_requests_user_read"
ON public.enterprise_contact_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "enterprise_contact_requests_service_manage" ON public.enterprise_contact_requests;
CREATE POLICY "enterprise_contact_requests_service_manage"
ON public.enterprise_contact_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
