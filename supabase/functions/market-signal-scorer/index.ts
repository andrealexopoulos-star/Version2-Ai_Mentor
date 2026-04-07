import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const TENANT_MISMATCH = "__TENANT_MISMATCH__";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((acc, n) => acc + n, 0) / nums.length;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function severityWeight(raw) {
  const sev = `${raw || ""}`.toLowerCase();
  if (sev === "critical") return 30;
  if (sev === "high") return 20;
  if (sev === "medium" || sev === "warning") return 10;
  return 4;
}

function verdictToScore(verdict) {
  const text = `${verdict || ""}`.toLowerCase();
  if (!text) return null;
  if (text.includes("leader") || text.includes("strong") || text.includes("clear")) return 82;
  if (text.includes("solid") || text.includes("stable") || text.includes("credible")) return 68;
  if (text.includes("mixed") || text.includes("unclear") || text.includes("drift")) return 52;
  if (text.includes("weak") || text.includes("poor") || text.includes("behind")) return 34;
  return 60;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(req, { error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing" }, 503);
  }

  if (req.method === "GET") {
    return json(req, {
      ok: true,
      status: "ok",
      function: "market-signal-scorer",
      reachable: true,
      generated_at: new Date().toISOString(),
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const tenantId = await resolveTenantId(req, supabase, body);
  if (tenantId === TENANT_MISMATCH) {
    return json(req, { error: "tenant_id/user_id must match authenticated user" }, 403);
  }
  if (!tenantId) {
    return json(req, { error: "tenant_id or authenticated bearer token required" }, 400);
  }

  const [profileRes, snapshotRes, benchmarkRes, eventRes, integrationRes, cacheRes] = await Promise.all([
    supabase.from("business_profiles").select("business_name,industry,location,website,target_market,competitive_advantage,source_map,confidence_map,market_position").eq("user_id", tenantId).maybeSingle(),
    supabase.from("intelligence_snapshots").select("summary,generated_at,executive_memo").eq("user_id", tenantId).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("marketing_benchmarks").select("scores,summary,competitors,updated_at").eq("tenant_id", tenantId).eq("is_current", true).limit(1).maybeSingle(),
    supabase.from("observation_events").select("domain,severity,source,observed_at,payload,signal_name").eq("user_id", tenantId).order("observed_at", { ascending: false }).limit(40),
    supabase.from("integration_accounts").select("provider,category,connected_at").eq("user_id", tenantId),
    supabase.schema("business_core").from("integration_snapshots").select("source_key,generated_at").eq("tenant_id", tenantId).order("generated_at", { ascending: false }).limit(10),
  ]);

  const profile = profileRes.data || {};
  const snapshot = snapshotRes.data?.summary || {};
  const marketIntel = snapshot.market_intelligence || {};
  const benchmark = benchmarkRes.data || {};
  const events = eventRes.data || [];
  const integrations = integrationRes.data || [];
  const cacheRows = cacheRes.data || [];

  const connectedSources = new Set(integrations.map((row) => `${row.category || "unknown"}:${row.provider || "unknown"}`));
  const marketEvents = events.filter((row) => {
    const domain = `${row.domain || ""}`.toLowerCase();
    const source = `${row.source || ""}`.toLowerCase();
    return domain === "market" || source.includes("marketing") || source.includes("scrape") || source.includes("market");
  });

  const acquisition = toNumber(marketIntel.acquisition_signal_score);
  const retention = toNumber(marketIntel.retention_signal_score);
  const growth = toNumber(marketIntel.growth_signal_score);
  const probability = toNumber(marketIntel.probability_of_goal_achievement);
  const misalignment = toNumber(marketIntel.misalignment_index);
  const marketingOverall = toNumber((benchmark.scores || {}).overall);
  const positioningScore = misalignment !== null
    ? clamp(100 - misalignment)
    : verdictToScore(marketIntel.positioning_verdict || profile.market_position);
  const demandScore = average([
    acquisition,
    retention,
    growth,
    marketingOverall !== null ? marketingOverall * 100 : null,
    probability,
  ]);
  const competitivePressureScore = clamp(
    marketEvents.reduce((acc, row) => acc + severityWeight(row.severity), 0)
      + ((Array.isArray(marketIntel.competitor_signals) ? marketIntel.competitor_signals : []).length * 8)
      + ((Array.isArray(benchmark.competitors) ? benchmark.competitors : []).length * 4),
  );
  const riskScore = average([
    misalignment,
    marketIntel.strategic_risk_level ? (verdictToScore(marketIntel.strategic_risk_level) !== null ? 100 - verdictToScore(marketIntel.strategic_risk_level) : null) : null,
    competitivePressureScore,
  ]);

  const completenessSignals = [
    profile.business_name,
    profile.industry,
    profile.website,
    profile.location,
    profile.target_market,
    profile.competitive_advantage,
  ];
  const calibrationCoverage = Math.round((completenessSignals.filter((v) => `${v || ""}`.trim() !== "").length / completenessSignals.length) * 100);

  const availableScores = [positioningScore, demandScore, riskScore !== null ? 100 - riskScore : null];
  const overallMarketScore = average(availableScores);
  const latestTimestamp = [
    `${snapshotRes.data?.generated_at || ""}`,
    `${benchmark.updated_at || ""}`,
    `${cacheRows[0]?.generated_at || ""}`,
    `${marketEvents[0]?.observed_at || ""}`,
  ].filter(Boolean)[0];

  const freshnessHours = latestTimestamp
    ? Math.max(0, Math.round((Date.now() - new Date(latestTimestamp).getTime()) / 36e5))
    : null;

  const trajectory = overallMarketScore === null
    ? "insufficient_evidence"
    : overallMarketScore >= 75 && (riskScore ?? 50) < 40
      ? "improving"
      : overallMarketScore >= 55
        ? "stable"
        : "at_risk";

  return json(req, {
    ok: true,
    function: "market-signal-scorer",
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    connected_sources_count: connectedSources.size,
    canonical_cache_rows: cacheRows.length,
    market_events_count: marketEvents.length,
    freshness_hours: freshnessHours,
    calibration_coverage_pct: calibrationCoverage,
    scores: {
      overall_market_score: overallMarketScore !== null ? Math.round(overallMarketScore) : null,
      positioning_score: positioningScore !== null ? Math.round(positioningScore) : null,
      demand_score: demandScore !== null ? Math.round(demandScore) : null,
      competitive_pressure_score: Math.round(competitivePressureScore),
      risk_score: riskScore !== null ? Math.round(riskScore) : null,
    },
    trajectory,
    evidence: {
      positioning_verdict: marketIntel.positioning_verdict || profile.market_position || null,
      probability_of_goal_achievement: probability,
      misalignment_index: misalignment,
      competitor_signals_count: (Array.isArray(marketIntel.competitor_signals) ? marketIntel.competitor_signals : []).length,
      industry_trends_count: (Array.isArray(marketIntel.industry_trends) ? marketIntel.industry_trends : []).length,
      benchmark_available: Boolean(benchmarkRes.data),
      snapshot_available: Boolean(snapshotRes.data),
    },
  });
});