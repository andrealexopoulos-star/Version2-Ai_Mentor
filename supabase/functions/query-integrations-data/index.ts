// ═══════════════════════════════════════════════════════════════
// QUERY INTEGRATIONS DATA — Supabase Edge Function
//
// Allows Soundboard to query real data from connected integrations.
// Called directly from frontend when user asks a data question.
//
// Capabilities:
//   - CRM queries (pipeline, deals, contacts) via Merge.dev
//   - Accounting queries (invoices, outstanding) via Merge.dev
//   - Business profile queries (internal)
//   - Observation events / signals
//
// Deploy: supabase functions deploy query-integrations-data
// Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MERGE_API_KEY
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { recordUsage } from "../_shared/metering.ts";
// Phase 1.X model-name auto-validation (2026-05-05 code 13041978):
// "gpt-4o-mini" was already a real production model — but route through
// the env-resolver (with mini fallback) so an env override here behaves the
// same as the rest of the BIQc edge fleet and the model-health-check probe
// validates a SINGLE canonical surface.
import { resolveOpenAIMiniModel } from "../_shared/model_validator.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERGE_API_KEY = Deno.env.get("MERGE_API_KEY") || "";
const QUERY_MODEL = resolveOpenAIMiniModel();

async function fetchMerge(token: string, endpoint: string, limit = 50) {
  if (!MERGE_API_KEY || !token || token === "connected") return [];
  try {
    const res = await fetch(`https://api.merge.dev/api/${endpoint}?page_size=${limit}`, {
      headers: { "Authorization": `Bearer ${MERGE_API_KEY}`, "X-Account-Token": token },
    });
    if (res.ok) { const d = await res.json(); return d.results || []; }
  } catch {}
  return [];
}

// Classify user query intent
function classifyQuery(query: string): { type: string; sources: string[] } {
  const q = query.toLowerCase();

  if (
    q.includes('board report') ||
    q.includes('board pack') ||
    q.includes('board summary') ||
    q.includes('performance report') ||
    q.includes('executive report') ||
    q.includes('last 12 months') ||
    q.includes('past 12 months') ||
    q.includes('12 month')
  ) {
    return { type: 'executive_report', sources: ['crm', 'accounting', 'email', 'internal'] };
  }

  if (q.includes('pipeline') || q.includes('deal') || q.includes('opportunity') || q.includes('sales'))
    return { type: 'crm_pipeline', sources: ['crm'] };
  if (q.includes('contact') || q.includes('client') || q.includes('customer') || q.includes('lead'))
    return { type: 'crm_contacts', sources: ['crm'] };
  if (q.includes('invoice') || q.includes('outstanding') || q.includes('overdue') || q.includes('revenue') || q.includes('cashflow') || q.includes('cash flow'))
    return { type: 'accounting', sources: ['accounting'] };
  if (q.includes('google ads') || q.includes('ad spend') || q.includes('campaign') || q.includes('ads'))
    return { type: 'google_ads', sources: ['google_ads'] };
  if (q.includes('email') || q.includes('inbox') || q.includes('communication'))
    return { type: 'email', sources: ['email'] };
  if (q.includes('competitor') || q.includes('market') || q.includes('industry'))
    return { type: 'market', sources: ['market'] };
  if (q.includes('team') || q.includes('staff') || q.includes('hiring'))
    return { type: 'profile', sources: ['internal'] };
  if (q.includes('goal') || q.includes('strategy') || q.includes('challenge'))
    return { type: 'profile', sources: ['internal'] };

  return { type: 'general', sources: ['internal'] };
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

  // Phase 1.X health-check handler (2026-05-05 code 13041978):
  // Andreas mandate "every edge function returns 200 on health check".
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "query-integrations-data",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  try {
    // Phase 1.X auth-symmetry hard-fix (2026-05-05 code 13041978):
    // Replaced redundant supabase.auth.getUser(token) with AuthResult-trust.
    // service_role callers must supply user_id in body; user-JWT path uses auth.userId.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const targetUserId: string | null = auth.isServiceRole
      ? (typeof body.user_id === "string" && body.user_id.trim() ? body.user_id.trim() : null)
      : (auth.userId || null);
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "user_id required for service_role; or invalid user session" }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const user = { id: targetUserId };
    const query = body.query || "";
    if (!query) {
      return new Response(JSON.stringify({ error: "No query provided" }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Classify the query
    const classification = classifyQuery(query);

    // Board / executive report requests must use the deeper backend runtime.
    // This edge function is intentionally limited to direct factual data queries.
    if (classification.type === 'executive_report') {
      return new Response(JSON.stringify({
        status: 'defer_to_soundboard',
        query_type: classification.type,
        message: 'Report-grade requests require the full BIQc Soundboard runtime so coverage, lineage, and missing periods can be checked before an answer is produced.',
        data_sources: [],
        raw_data: null,
      }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    // Get user's integrations
    const { data: integrations } = await supabase.from("integration_accounts")
      .select("provider, category, account_token, status")
      .eq("user_id", user.id);

    const connectedSources: Record<string, any> = {};
    for (const integ of (integrations || [])) {
      if (integ.account_token && integ.account_token !== "connected") {
        connectedSources[integ.category] = integ;
      }
    }

    // Check if required source is connected
    const missingSource = classification.sources.find(s =>
      s !== 'internal' && s !== 'market' && !connectedSources[s === 'google_ads' ? 'advertising' : s]
    );

    if (missingSource) {
      const sourceLabels: Record<string, string> = {
        crm: 'CRM (HubSpot)',
        accounting: 'Accounting (Xero/QuickBooks)',
        google_ads: 'Google Ads',
        email: 'Email',
      };
      return new Response(JSON.stringify({
        status: 'not_connected',
        query_type: classification.type,
        required_source: missingSource,
        message: `To answer "${query}", connect your ${sourceLabels[missingSource] || missingSource}. Go to Systems > Integrations to connect.`,
        data: null,
      }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    // Gather data based on classification
    let queryData: any = {};
    const dataSources: string[] = [];

    // CRM data
    if (classification.type === 'crm_pipeline' || classification.type === 'crm_contacts') {
      const crmInteg = connectedSources['crm'];
      if (crmInteg) {
        const [contacts, deals] = await Promise.all([
          fetchMerge(crmInteg.account_token, "crm/v1/contacts", 50),
          fetchMerge(crmInteg.account_token, "crm/v1/opportunities", 50),
        ]);
        queryData.crm = {
          total_contacts: contacts.length,
          total_deals: deals.length,
          open_deals: deals.filter((d: any) => d.status === "OPEN"),
          won_deals: deals.filter((d: any) => d.status === "WON"),
          lost_deals: deals.filter((d: any) => d.status === "LOST"),
          pipeline_total: deals.filter((d: any) => d.status === "OPEN").reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0),
          recent_contacts: contacts.slice(0, 10).map((c: any) => ({
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
            email: c.email_addresses?.[0]?.email_address,
            company: c.company,
            last_activity: c.last_activity_at,
          })),
          deal_details: deals.slice(0, 10).map((d: any) => ({
            name: d.name, status: d.status, amount: d.amount,
            stage: d.stage, close_date: d.close_date,
          })),
        };
        dataSources.push(`${crmInteg.provider} CRM`);
      }
    }

    // Accounting data
    if (classification.type === 'accounting') {
      const accInteg = connectedSources['accounting'] || connectedSources['financial'];
      if (accInteg) {
        const invoices = await fetchMerge(accInteg.account_token, "accounting/v1/invoices", 50);
        queryData.accounting = {
          total_invoices: invoices.length,
          overdue: invoices.filter((i: any) => i.status === "OVERDUE" || (i.due_date && new Date(i.due_date) < new Date())),
          total_outstanding: invoices.reduce((sum: number, i: any) => sum + (parseFloat(i.total_amount) || 0), 0),
          recent_invoices: invoices.slice(0, 10).map((i: any) => ({
            number: i.number, total: i.total_amount, status: i.status, due_date: i.due_date,
          })),
        };
        dataSources.push(`${accInteg.provider}`);
      }
    }

    // Internal profile data
    if (classification.type === 'profile' || classification.type === 'general') {
      const { data: bp } = await supabase.from("business_profiles")
        .select("business_name, industry, target_market, business_model, team_size, growth_strategy, main_challenges, short_term_goals, long_term_goals, competitive_advantages")
        .eq("user_id", user.id).maybeSingle();
      if (bp) { queryData.profile = bp; dataSources.push("business_profile"); }
    }

    // Latest snapshot for market/general queries
    if (classification.type === 'market' || classification.type === 'general') {
      const { data: snapshot } = await supabase.from("intelligence_snapshots")
        .select("summary").eq("user_id", user.id).eq("snapshot_type", "cognitive_v2")
        .order("generated_at", { ascending: false }).limit(1).maybeSingle();
      if (snapshot?.summary) {
        const s = snapshot.summary;
        queryData.intelligence = {
          system_state: s.system_state?.status,
          market: s.market,
          market_intelligence: s.market_intelligence,
          action_plan: s.action_plan,
        };
        dataSources.push("cognitive_snapshot");
      }
    }

    // Use GPT to synthesise an answer from the data
    const answerPrompt = `You are BIQc's data assistant. The user asked: "${query}"

Here is the real data from their connected systems:
${JSON.stringify(queryData, null, 2)}

Data sources: ${dataSources.join(', ')}

Rules:
- Answer ONLY from the data provided. Do not fabricate.
- Be specific: use numbers, names, amounts.
- If the data doesn't contain the answer, say what's available and what's missing.
- Keep it concise (2-4 sentences max).
- Australian English.`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: QUERY_MODEL,
        messages: [{ role: "user", content: answerPrompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    let answer = "I couldn't generate an answer from the available data.";
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      answer = aiData.choices?.[0]?.message?.content || answer;
      const usage = aiData.usage || {};

      // usage_ledger emit (systemic metering — Track B v2)
      recordUsage({
        userId: user.id,
        model: QUERY_MODEL,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        cachedInputTokens: usage.prompt_tokens_details?.cached_tokens || 0,
        feature: "query_integrations_data",
        action: classification.type,
      });
    }

    return new Response(JSON.stringify({
      status: 'answered',
      query_type: classification.type,
      answer,
      data_sources: dataSources,
      raw_data: queryData,
    }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[query-integrations] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
