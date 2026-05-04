// ═══════════════════════════════════════════════════════════════
// COMPETITOR MONITOR — Supabase Edge Function
// File: supabase/functions/competitor-monitor/index.ts
//
// Deploy: supabase functions deploy competitor-monitor
// ═══════════════════════════════════════════════════════════════
//
// SECRETS REQUIRED:
//   OPENAI_API_KEY
//   PERPLEXITY_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// PURPOSE:
//   Scheduled weekly competitor monitoring. Extends deep-web-recon with:
//   - Re-scans competitors detected during calibration
//   - Diffs against previous scan results
//   - Generates COMPETITOR ALERT intelligence actions when changes detected
//
// TRIGGERS:
//   - Supabase pg_cron (weekly) — calls for all active users
//   - Manual: POST /functions/v1/competitor-monitor { "user_id": "..." }
//   - Batch:  POST /functions/v1/competitor-monitor { "batch": true }
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, enforceUserOwnership } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { recordUsage, recordUsageSonar } from "../_shared/metering.ts";
// Phase 1.X model-name auto-validation (2026-05-05 code 13041978):
// Replace hardcoded "gpt-5.3" (unreleased preview → silent 400) with env-driven resolver.
import { resolveOpenAINormalModel } from "../_shared/model_validator.ts";

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPETITOR_MONITOR_BATCH_SECRET = Deno.env.get("COMPETITOR_MONITOR_BATCH_SECRET") || "";
const COMPETITOR_MODEL = resolveOpenAINormalModel();

interface CompetitorSignal {
  name: string;
  type: string; // pricing_change | new_product | hiring | marketing | news
  detail: string;
  source: string;
  severity: "high" | "medium" | "low";
}

async function searchPerplexity(query: string, userId: string = ""): Promise<string> {
  if (!PERPLEXITY_API_KEY) return "";

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a competitive intelligence analyst for Australian SMBs. Return factual, verifiable findings only. No speculation.",
          },
          { role: "user", content: query },
        ],
        max_tokens: 1500,
      }),
    });

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || "";
    // usage_ledger emit (systemic metering — Track B v2)
    recordUsageSonar({
      userId,
      model: "sonar",
      promptText: query,
      responseText: answer,
      feature: "competitor_monitor",
      action: "competitor_search",
    });
    return answer;
  } catch {
    return "";
  }
}

async function analyseChanges(
  businessName: string,
  industry: string,
  previousSignals: string,
  currentSignals: string,
  userId: string,
): Promise<CompetitorSignal[]> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: COMPETITOR_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a competitive intelligence analyst. Compare the PREVIOUS and CURRENT competitor scans for ${businessName} (${industry}).
Identify CHANGES ONLY — new pricing, new products, new hires, marketing campaigns, news mentions.
Return JSON array of signals: [{"name":"competitor","type":"pricing_change|new_product|hiring|marketing|news","detail":"what changed","source":"where found","severity":"high|medium|low"}]
If no material changes, return empty array [].
Be factual. No fabrication.`,
          },
          {
            role: "user",
            content: `PREVIOUS SCAN:\n${previousSignals || "No previous scan"}\n\nCURRENT SCAN:\n${currentSignals}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const usage = data.usage || {};

    // usage_ledger emit (systemic metering — Track B v2)
    recordUsage({
      userId,
      model: COMPETITOR_MODEL,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cachedInputTokens: usage.prompt_tokens_details?.cached_tokens || 0,
      feature: "competitor_monitor",
    });

    // Legacy usage_tracking
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("usage_tracking").insert({
        user_id: userId,
        function_name: "competitor-monitor",
        api_provider: "openai",
        model: COMPETITOR_MODEL,
        tokens_in: usage.prompt_tokens || 0,
        tokens_out: usage.completion_tokens || 0,
        cost_estimate: ((usage.prompt_tokens || 0) * 0.00015 + (usage.completion_tokens || 0) * 0.0006) / 1000,
        called_at: new Date().toISOString(),
      });
    } catch {}

    const parsed = JSON.parse(content);
    return parsed.signals || parsed.changes || [];
  } catch {
    return [];
  }
}

async function monitorUser(sb: any, userId: string): Promise<{ signals: number; actions: number }> {
  // Load business profile
  const { data: profile } = await sb
    .from("business_profiles")
    .select("business_name, industry, website, social_handles, competitor_data")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.business_name) return { signals: 0, actions: 0 };

  const businessName = profile.business_name;
  const industry = profile.industry || "general business";
  const website = profile.website || "";

  // Build search query
  const competitorNames = (() => {
    try {
      if (typeof profile.competitor_data === 'string') return JSON.parse(profile.competitor_data);
      if (Array.isArray(profile.competitor_data)) return profile.competitor_data;
    } catch {}
    return [];
  })();
  const namedList = competitorNames.length > 0 ? ` Key competitors to monitor: ${competitorNames.slice(0, 5).join(', ')}.` : '';
  const searchQuery = `Latest news, pricing changes, product launches, and hiring for competitors of ${businessName} in the ${industry} industry in Australia. Focus on the last 7 days.${website ? ` Their website is ${website}.` : ''}${namedList}`;

  // Search current competitive landscape
  const currentSignals = await searchPerplexity(searchQuery, userId);
  if (!currentSignals) return { signals: 0, actions: 0 };

  // Load previous scan
  const { data: prevScan } = await sb
    .from("intelligence_actions")
    .select("description")
    .eq("user_id", userId)
    .eq("source", "competitor_monitor")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousSignals = prevScan?.description || "";

  // Analyse changes
  const changes = await analyseChanges(businessName, industry, previousSignals, currentSignals, userId);

  // Persist scan result to a separate field to avoid clobbering calibration's competitor_scan_result
  await sb.from("business_profiles").update({
    competitor_scan_last: new Date().toISOString(),
    competitor_monitor_latest: JSON.stringify({
      signals: changes,
      raw_intelligence: currentSignals.substring(0, 2000),
      scanned_at: new Date().toISOString(),
      business_name: businessName,
      industry: industry,
    }),
  }).eq("user_id", userId);

  // Create intelligence actions for detected changes
  let actionsCreated = 0;
  for (const signal of changes) {
    const { error } = await sb.from("intelligence_actions").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      source: "competitor_monitor",
      source_id: `comp_${signal.name}_${Date.now()}`,
      domain: "market",
      severity: signal.severity,
      title: `Competitor Alert: ${signal.name} — ${signal.type.replace(/_/g, " ")}`,
      description: signal.detail,
      suggested_action: `Review this competitive movement and assess impact on your ${industry} positioning.`,
      status: "action_required",
      created_at: new Date().toISOString(),
    });

    if (!error) actionsCreated++;
  }

  return { signals: changes.length, actions: actionsCreated };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error || "Unauthorized" }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "competitor-monitor",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders(req) },
    );
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const isServiceRoleToken = auth.isServiceRole;
    const batchSecret = (req.headers.get("X-Batch-Secret") || "").trim();

    const authenticatedUserId = auth.userId;

    // Batch mode: scan all active users (for pg_cron)
    if (body.batch) {
      if (!isServiceRoleToken || !COMPETITOR_MONITOR_BATCH_SECRET || batchSecret !== COMPETITOR_MONITOR_BATCH_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized batch invocation" }), {
          status: 403, headers: corsHeaders(req),
        });
      }
      const { data: users } = await sb
        .from("business_profiles")
        .select("user_id")
        .not("business_name", "is", null);

      let totalSignals = 0;
      let totalActions = 0;
      const userCount = (users || []).length;

      for (const u of (users || [])) {
        try {
          const result = await monitorUser(sb, u.user_id);
          totalSignals += result.signals;
          totalActions += result.actions;
        } catch (err) {
          console.error(`[competitor-monitor] Failed for user ${u.user_id}: ${err}`);
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        mode: "batch",
        users_scanned: userCount,
        total_signals: totalSignals,
        total_actions: totalActions,
      }), { headers: corsHeaders(req) });
    }

    // Single user mode
    const requestedUserId = `${body.user_id || ""}`.trim();
    if (!requestedUserId) {
      if (!authenticatedUserId) {
        return new Response(JSON.stringify({ ok: false, error: "user_id required or authenticate via Bearer token" }), {
          status: 400, headers: corsHeaders(req),
        });
      }
      const result = await monitorUser(sb, authenticatedUserId);
      return new Response(JSON.stringify({ ok: true, mode: "single", ...result }), {
        headers: corsHeaders(req),
      });
    }

    if (isServiceRoleToken) {
      const result = await monitorUser(sb, requestedUserId);
      return new Response(JSON.stringify({ ok: true, mode: "single", ...result }), {
        headers: corsHeaders(req),
      });
    }

    const ownership = enforceUserOwnership(auth, requestedUserId);
    if (!ownership.ok) {
      return new Response(JSON.stringify({ ok: false, error: "user_id must match authenticated user" }), {
        status: 403, headers: corsHeaders(req),
      });
    }

    const result = await monitorUser(sb, requestedUserId);
    return new Response(JSON.stringify({ ok: true, mode: "single", ...result }), {
      headers: corsHeaders(req),
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: corsHeaders(req),
    });
  }
});
