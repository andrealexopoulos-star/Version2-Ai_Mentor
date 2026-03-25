-- 070_rls_tenant_lockdown_cognition.sql
-- Hardens remaining permissive tenant_read policies from cognition foundation tables.
-- Keeps service_role full access while restricting authenticated reads to auth.uid().

-- Memory + benchmark + automation + observability tables
ALTER TABLE IF EXISTS public.episodic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.semantic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.context_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketing_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.llm_call_log ENABLE ROW LEVEL SECURITY;

-- Drop permissive legacy tenant policies
DROP POLICY IF EXISTS "tenant_read" ON public.episodic_memory;
DROP POLICY IF EXISTS "tenant_read" ON public.semantic_memory;
DROP POLICY IF EXISTS "tenant_read" ON public.context_summaries;
DROP POLICY IF EXISTS "tenant_read" ON public.marketing_benchmarks;
DROP POLICY IF EXISTS "tenant_read" ON public.action_log;
DROP POLICY IF EXISTS "tenant_read" ON public.llm_call_log;

-- Drop legacy service policies so we can standardize role scope
DROP POLICY IF EXISTS "service_all" ON public.episodic_memory;
DROP POLICY IF EXISTS "service_all" ON public.semantic_memory;
DROP POLICY IF EXISTS "service_all" ON public.context_summaries;
DROP POLICY IF EXISTS "service_all" ON public.marketing_benchmarks;
DROP POLICY IF EXISTS "service_all" ON public.action_log;
DROP POLICY IF EXISTS "service_all" ON public.llm_call_log;

-- Authenticated users: only their tenant rows
CREATE POLICY "episodic_memory_tenant_read"
ON public.episodic_memory
FOR SELECT
TO authenticated
USING (tenant_id = auth.uid());

CREATE POLICY "semantic_memory_tenant_read"
ON public.semantic_memory
FOR SELECT
TO authenticated
USING (tenant_id = auth.uid());

CREATE POLICY "context_summaries_tenant_read"
ON public.context_summaries
FOR SELECT
TO authenticated
USING (tenant_id = auth.uid());

CREATE POLICY "marketing_benchmarks_tenant_read"
ON public.marketing_benchmarks
FOR SELECT
TO authenticated
USING (tenant_id = auth.uid());

CREATE POLICY "action_log_tenant_read"
ON public.action_log
FOR SELECT
TO authenticated
USING (tenant_id = auth.uid());

CREATE POLICY "llm_call_log_tenant_read"
ON public.llm_call_log
FOR SELECT
TO authenticated
USING (tenant_id = auth.uid());

-- Service role: full maintenance
CREATE POLICY "episodic_memory_service_manage"
ON public.episodic_memory
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "semantic_memory_service_manage"
ON public.semantic_memory
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "context_summaries_service_manage"
ON public.context_summaries
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "marketing_benchmarks_service_manage"
ON public.marketing_benchmarks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "action_log_service_manage"
ON public.action_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "llm_call_log_service_manage"
ON public.llm_call_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
