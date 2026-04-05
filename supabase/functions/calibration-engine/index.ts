import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TENANT_MISMATCH = "__TENANT_MISMATCH__";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveTenantId(req, supabase, body) {
  const explicit = `${body.tenant_id || body.user_id || ""}`.trim();
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return explicit || null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  if (explicit && explicit !== data.user.id) return TENANT_MISMATCH;
  return data.user.id;
}

function pct(completed, total) {
  return total <= 0 ? 0 : Math.round((completed / total) * 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing" }, 503);
  }

  if (req.method === "GET") {
    return json({
      ok: true,
      status: "ok",
      function: "calibration-engine",
      reachable: true,
      generated_at: new Date().toISOString(),
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const tenantId = await resolveTenantId(req, supabase, body);
  if (tenantId === TENANT_MISMATCH) {
    return json({ error: "tenant_id/user_id must match authenticated user" }, 403);
  }
  if (!tenantId) {
    return json({ error: "tenant_id or authenticated bearer token required" }, 400);
  }

  const [profileRes, operatorRes, consoleRes, integrationsRes, runsRes, metricsRes, concernRes] = await Promise.all([
    supabase.from("business_profiles").select("business_name,industry,website,location,target_market,mission,vision,products_services,competitive_advantage").eq("user_id", tenantId).maybeSingle(),
    supabase.from("user_operator_profile").select("persona_calibration_status,agent_persona,operator_profile,updated_at").eq("user_id", tenantId).maybeSingle(),
    supabase.from("strategic_console_state").select("status,is_complete,current_step,updated_at").eq("user_id", tenantId).maybeSingle(),
    supabase.from("integration_accounts").select("provider,category,connected_at").eq("user_id", tenantId),
    supabase.schema("business_core").from("source_runs").select("source_id", { count: "exact" }).eq("tenant_id", tenantId),
    supabase.schema("business_core").from("business_metrics").select("id", { count: "exact" }).eq("tenant_id", tenantId),
    supabase.schema("business_core").from("concern_evaluations").select("id", { count: "exact" }).eq("tenant_id", tenantId),
  ]);

  const profile = profileRes.data || {};
  const operator = operatorRes.data || {};
  const consoleState = consoleRes.data || {};
  const integrations = integrationsRes.data || [];
  const connectedCategories = new Set(integrations.map((row) => `${row.category || "unknown"}`.toLowerCase()));

  const identityFields = [
    profile.business_name,
    profile.industry,
    profile.website,
    profile.location,
    profile.target_market,
    profile.products_services,
    profile.competitive_advantage,
  ];

  const strategicFields = [profile.mission, profile.vision];

  const identityScore = pct(identityFields.filter((v) => `${v || ""}`.trim() !== "").length, identityFields.length);
  const strategyScore = pct(strategicFields.filter((v) => `${v || ""}`.trim() !== "").length, strategicFields.length);
  const integrationScore = pct(connectedCategories.size, 4);
  const operatorScore = operator.persona_calibration_status === "complete"
    ? 100
    : consoleState.is_complete
      ? 85
      : Number(consoleState.current_step || 0) > 0
        ? 50
        : 0;

  const businessCoreRuns = runsRes.count || 0;
  const businessMetrics = metricsRes.count || 0;
  const concernEvaluations = concernRes.count || 0;
  const cognitionScore = pct(
    [businessCoreRuns > 0, businessMetrics > 0, concernEvaluations > 0].filter(Boolean).length,
    3,
  );

  const readinessScore = Math.round(
    (identityScore * 0.25)
    + (strategyScore * 0.15)
    + (integrationScore * 0.2)
    + (operatorScore * 0.15)
    + (cognitionScore * 0.25)
  );

  const gaps = [];
  if (identityScore < 100) gaps.push("Complete Business DNA identity fields so BIQc can reason over a fully-specified business model.");
  if (strategyScore < 100) gaps.push("Capture mission and vision so calibration is anchored to operator intent, not just data exhaust.");
  if (!connectedCategories.has("crm")) gaps.push("Connect CRM to unlock canonical customer, deal, and pipeline cognition.");
  if (!connectedCategories.has("accounting")) gaps.push("Connect accounting to unlock cash, invoice, margin, and runway cognition.");
  if (!connectedCategories.has("email")) gaps.push("Connect email to unlock silence, response-delay, and execution-pressure cognition.");
  if (businessCoreRuns === 0) gaps.push("Run business-brain-merge-ingest so business_core canonical tables are populated.");
  if (businessMetrics === 0) gaps.push("Run business-brain-metrics-cron so KPI computation and threshold logic are active.");
  if (concernEvaluations === 0) gaps.push("Recompute the Business Brain after ingestion so ranked concerns and calibration are grounded in canonical evidence.");

  return json({
    ok: true,
    function: "calibration-engine",
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    readiness_score: readinessScore,
    status: readinessScore >= 85 ? "calibrated" : readinessScore >= 60 ? "developing" : "not_ready",
    modules: {
      identity: identityScore,
      strategy: strategyScore,
      integrations: integrationScore,
      operator_calibration: operatorScore,
      cognition_activation: cognitionScore,
    },
    canonical_state: {
      business_core_source_runs: businessCoreRuns,
      business_core_metrics: businessMetrics,
      business_core_concern_evaluations: concernEvaluations,
      operator_status: operator.persona_calibration_status || null,
      strategic_console_complete: Boolean(consoleState.is_complete),
    },
    gaps,
  });
});