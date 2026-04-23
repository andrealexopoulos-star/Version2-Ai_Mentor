// ═══════════════════════════════════════════════════════════════
// MARKET ANALYSIS — Supabase Edge Function
//
// User inputs: product/service, region, specific question
// Function: Reads ALL user data + Firecrawl market intel
// Returns: SWOT analysis + strategic recommendations
//
// Deploy: supabase functions deploy market-analysis-ai
// Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//          MERGE_API_KEY, FIRECRAWL_API_KEY
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { recordUsage, recordUsageSonar } from "../_shared/metering.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERGE_API_KEY = Deno.env.get("MERGE_API_KEY") || "";
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") || "";

async function fetchMerge(token: string, endpoint: string, limit = 20) {
  if (!MERGE_API_KEY || !token || token === "connected") return [];
  try {
    const res = await fetch(`https://api.merge.dev/api/${endpoint}?page_size=${limit}`, {
      headers: { "Authorization": `Bearer ${MERGE_API_KEY}`, "X-Account-Token": token },
    });
    if (res.ok) { const d = await res.json(); return d.results || []; }
  } catch {}
  return [];
}

async function perplexitySearch(query: string, userId: string = "", action: string = "market_recon"): Promise<string> {
  if (!PERPLEXITY_API_KEY) return "";
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: query }], max_tokens: 1000 }),
    });
    if (res.ok) {
      const d = await res.json();
      const answer = d.choices?.[0]?.message?.content || "";
      // usage_ledger emit (systemic metering — Track B v2)
      recordUsageSonar({
        userId,
        model: "sonar",
        promptText: query,
        responseText: answer,
        feature: "market_analysis_ai",
        action,
      });
      return answer;
    }
  } catch (e) { console.error("[perplexity]", e); }
  return "";
}

const SYSTEM_PROMPT = `You are BIQc Market Intelligence — a senior market analyst for an Australian business owner.

The owner is asking you to analyse a specific product, service, or market region.

You have access to:
- Their full Business DNA (17-point strategic map)
- Their CRM data (contacts, deals, pipeline)
- Their financial data (accounts, invoices)
- Their email communications
- Live market intelligence from web search (Firecrawl)
- Competitor intelligence from web search

YOUR OUTPUT MUST BE THIS EXACT JSON:
{
  "analysis_title": "Market Analysis: [product/service] in [region]",
  
  "swot": {
    "strengths": ["3-5 specific strengths based on their actual business data. Reference real data points."],
    "weaknesses": ["3-5 specific weaknesses. Be honest. Reference gaps in their data."],
    "opportunities": ["3-5 specific opportunities based on market intel + their positioning."],
    "threats": ["3-5 specific threats based on competitor intel + market trends."]
  },
  
  "market_size": "Estimate of addressable market size for this product/service in this region. Use firecrawl data.",
  
  "competitor_landscape": "1-2 paragraphs. Who are the key competitors? What are they doing? How does the owner compare? Reference specific competitors .",
  
  "customer_insight": "1 paragraph. Based on their CRM contacts and deals, what patterns emerge about their ideal customer? What's working in their pipeline?",
  
  "revenue_opportunity": "1 paragraph. Based on their financial data + market size, what's the realistic revenue opportunity? Be specific with numbers.",
  
  "recommendations": [
    {
      "action": "Specific, actionable recommendation",
      "impact": "high|medium|low",
      "timeframe": "immediate|short-term|medium-term",
      "rationale": "Why this matters based on data"
    }
  ],
  
  "risks_to_watch": "1 paragraph. What could go wrong? What should they monitor?",
  
  "confidence": "low|medium|high",
  "data_quality_note": "Honest assessment of data completeness"
}

RULES:
- Reference ACTUAL business data. Not generic advice.
- Use web intelligence for real competitor and market data.
- If their CRM shows stalled deals in this segment, say so.
- If their financial data shows they can't fund expansion, say so.
- Maximum 5 recommendations, ranked by impact.
- Australian English. Direct. Pragmatic.
- The owner should finish reading knowing exactly whether to pursue this opportunity.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "market-analysis-ai",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  try {
    // ───────────────────────────────────────────────────────────────
    // Incident H (2026-04-23) — backend-orchestrated auth contract.
    //
    // Old model (REMOVED): secondary supabase.auth.getUser(token) that
    // broke under service_role callers and on fresh-user JWTs. That
    // second validation was the observable 7×401 failure vector for
    // brand-new signups during calibration.
    //
    // New model: verifyAuth (line 119) is the single auth gate. It
    // already accepts service_role AND user-JWT paths. Downstream
    // user identity is derived from:
    //   - body.user_id when the caller is service_role (backend
    //     orchestration). The backend passes this explicitly and it
    //     is mandatory under EdgeCallMode.BACKEND_ORCHESTRATED.
    //   - auth.userId when the caller is a user JWT (direct invoke).
    //
    // Security invariant preserved: user_id used for DB reads is
    // derived from a validated auth subject, never from unvalidated
    // request body input. For service_role callers the backend is the
    // trust authority (has already validated the user via
    // get_current_user_from_request before the edge call).
    // ───────────────────────────────────────────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    let userId: string = "";
    if (auth.isServiceRole) {
      userId = `${body.user_id || ""}`.trim();
      if (!userId) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "service_role caller must provide body.user_id",
            code: "BACKEND_ORCHESTRATION_CONTRACT_VIOLATION",
          }),
          { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
        );
      }
    } else {
      userId = `${auth.userId || ""}`.trim();
      if (!userId) {
        return new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
        );
      }
    }
    // Stable shape preserved: downstream code uses `user.id`.
    const user = { id: userId };

    const product_or_service = body.product_or_service || "";
    const region = body.region || "Australia";
    const specific_question = body.specific_question || "";

    if (!product_or_service) {
      return new Response(JSON.stringify({ ok: false, error: "product_or_service is required" }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const ctx: Record<string, any> = {};
    const sources: string[] = [];

    // Business profile
    const { data: bp } = await supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (bp) {
      delete bp.id; delete bp.created_at; delete bp.updated_at;
      delete bp.profile_data; delete bp.intelligence_configuration;
      ctx.business = bp;
      sources.push("business_profile");
    }

    // CRM
    const { data: integrations } = await supabase.from("integration_accounts")
      .select("provider, category, account_token").eq("user_id", user.id);
    
    for (const integ of (integrations || [])) {
      if (integ.category === "crm" && integ.account_token && integ.account_token !== "connected") {
        const contacts = await fetchMerge(integ.account_token, "crm/v1/contacts", 30);
        const deals = await fetchMerge(integ.account_token, "crm/v1/opportunities", 25);
        if (contacts.length || deals.length) {
          ctx.crm = {
            provider: integ.provider,
            contacts: contacts.map((c: any) => ({
              name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
              email: c.email_addresses?.[0]?.email_address, company: c.company,
            })),
            deals: deals.map((d: any) => ({
              name: d.name, status: d.status, amount: d.amount, stage: d.stage,
            })),
          };
          sources.push(`${integ.provider} CRM (${contacts.length} contacts, ${deals.length} deals)`);
        }
      }
      if ((integ.category === "accounting" || integ.category === "financial") && integ.account_token && integ.account_token !== "connected") {
        const accounts = await fetchMerge(integ.account_token, "accounting/v1/accounts", 20);
        const invoices = await fetchMerge(integ.account_token, "accounting/v1/invoices", 15);
        if (accounts.length || invoices.length) {
          ctx.financial = {
            accounts: accounts.map((a: any) => ({ name: a.name, type: a.type, balance: a.current_balance })),
            invoices: invoices.map((i: any) => ({ number: i.number, total: i.total_amount, status: i.status })),
          };
          sources.push(`${integ.provider} Financial`);
        }
      }
    }

    // Emails
    const { data: emails } = await supabase.from("outlook_emails")
      .select("subject, from_address, body_preview, received_date")
      .eq("user_id", user.id).order("received_date", { ascending: false }).limit(15);
    if (emails?.length) {
      ctx.emails = emails.map((e: any) => ({ subject: e.subject, from: e.from_address, preview: (e.body_preview || "").substring(0, 200) }));
      sources.push(`emails (${emails.length})`);
    }

    // Market intelligence via Perplexity
    const [marketIntel, competitorIntel, pricingIntel, trendIntel] = await Promise.all([
      perplexitySearch(`${product_or_service} market size ${region} ${new Date().getFullYear()}`, user.id, "market_size"),
      perplexitySearch(`${product_or_service} top competitors ${region}`, user.id, "competitors"),
      perplexitySearch(`${product_or_service} pricing trends ${region}`, user.id, "pricing_trends"),
      perplexitySearch(`${product_or_service} industry trends outlook ${region} ${new Date().getFullYear()}`, user.id, "industry_trends"),
    ]);

    ctx.market_research = {
      market_size_data: marketIntel,
      competitor_data: competitorIntel,
      pricing_trends: pricingIntel,
      industry_trends: trendIntel,
    };
    sources.push("perplexity (market intel)");

    const userPrompt = `ANALYSE THIS MARKET OPPORTUNITY:

Product/Service: ${product_or_service}
Region: ${region}
${specific_question ? `Specific Question: ${specific_question}` : ""}

FULL BUSINESS CONTEXT:
${JSON.stringify(ctx, null, 2)}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 8000,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("[market-analysis] OpenAI error:", err);
      return new Response(JSON.stringify({ ok: false, error: "Analysis unavailable", data_sources: sources }), {
        status: 502,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    // usage_ledger emit (systemic metering — Track B v2)
    const mUsage = aiData.usage || {};
    const mModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o";
    recordUsage({
      userId: user.id,
      model: mModel,
      inputTokens: mUsage.prompt_tokens || 0,
      outputTokens: mUsage.completion_tokens || 0,
      cachedInputTokens: mUsage.prompt_tokens_details?.cached_tokens || 0,
      feature: "market_analysis_ai",
      action: "swot_synthesis",
    });

    let analysis;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { analysis_title: `Market Analysis: ${product_or_service}`, executive_summary: raw };
    }

    return new Response(JSON.stringify({
      ok: true,
      analysis, data_sources: sources, generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[market-analysis] Error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Internal error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
