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

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERGE_API_KEY = Deno.env.get("MERGE_API_KEY") || "";
const PERPLEXITY_API_KEY =
  Deno.env.get("PERPLEXITY_API_KEY") ||
  Deno.env.get("PERPLEXITY_API") ||
  Deno.env.get("Perplexity_API") ||
  "";

if (!Deno.env.get("PERPLEXITY_API_KEY") && (Deno.env.get("PERPLEXITY_API") || Deno.env.get("Perplexity_API"))) {
  console.warn("[market-analysis-ai] Using legacy Perplexity env var. Please migrate to PERPLEXITY_API_KEY.");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function perplexitySearch(query: string): Promise<string> {
  if (!PERPLEXITY_API_KEY) return "";
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: query }], max_tokens: 500 }),
    });
    if (res.ok) { const d = await res.json(); return d.choices?.[0]?.message?.content || ""; }
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const product_or_service = body.product_or_service || "";
    const region = body.region || "Australia";
    const specific_question = body.specific_question || "";

    if (!product_or_service) {
      return new Response(JSON.stringify({ error: "product_or_service is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      perplexitySearch(`${product_or_service} market size ${region} ${new Date().getFullYear()}`),
      perplexitySearch(`${product_or_service} top competitors ${region}`),
      perplexitySearch(`${product_or_service} pricing trends ${region}`),
      perplexitySearch(`${product_or_service} industry trends outlook ${region} ${new Date().getFullYear()}`),
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
        model: "gemini-3-pro-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 1500,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("[market-analysis] OpenAI error:", err);
      return new Response(JSON.stringify({ error: "Analysis unavailable", data_sources: sources }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    let analysis;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { analysis_title: `Market Analysis: ${product_or_service}`, executive_summary: raw };
    }

    return new Response(JSON.stringify({
      analysis, data_sources: sources, generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[market-analysis] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
