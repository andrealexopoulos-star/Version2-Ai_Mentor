// ═══════════════════════════════════════════════════════════════
// CALIBRATION BUSINESS DNA — Supabase Edge Function
//
// Called AFTER calibration-psych completes OR when user provides
// their website URL during initial calibration.
//
// Takes: website URL or business description
// Does: Firecrawl scrapes website → GPT-4o extracts ALL Business DNA fields
// Writes: Directly to business_profiles table (all 4 tabs: Market, Product, Team, Strategy)
//
// Deploy: supabase functions deploy calibration-business-dna
// Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const PERPLEXITY_KEY = Deno.env.get("Perplexity_API") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keep Firecrawl ONLY for URL scraping — no Perplexity alternative for full page crawl
async function scrapeWebsite(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], timeout: 15000 }),
    });
    if (res.ok) {
      const data = await res.json();
      return (data.data?.markdown || "").substring(0, 8000);
    }
  } catch (e) { console.error("[scrape]", e); }
  return "";
}

// Replace Firecrawl search with Perplexity
async function searchWeb(query: string): Promise<string> {
  if (!PERPLEXITY_KEY) return "";
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PERPLEXITY_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: query }], max_tokens: 500 }),
    });
    if (res.ok) {
      const d = await res.json();
      return d.choices?.[0]?.message?.content || "";
    }
  } catch (e) { console.error("[perplexity]", e); }
  return "";
}

const EXTRACTION_PROMPT = `You are a Business Intelligence Analyst. Extract EVERY possible business data point from the provided content.

You must fill ALL fields. If information is not explicitly available, make intelligent inferences based on context. If truly impossible to determine, write "Not available from current data".

OUTPUT MUST BE THIS EXACT JSON:
{
  "business_name": "Company name",
  "industry": "Primary industry/sector",
  "business_stage": "startup|early_revenue|growth|established",
  "business_type": "LLC|Sole Trader|Partnership|Pty Ltd|etc",
  "location": "City, State, Country",
  "website": "URL",
  
  "target_market": "Detailed description of who they sell to — demographics, psychographics, business type, pain points",
  "ideal_customer_profile": "Specific profile of their perfect customer — who are they, what do they need, why do they buy",
  "business_model": "SaaS|eCommerce|Services|Marketplace|Subscription|Hybrid|etc",
  "geographic_focus": "Local|Regional|National|Global — with specifics",
  "customer_count": "Estimate based on available data",
  "revenue_range": "Estimate based on team size, pricing, market position",
  
  "main_products_services": "Detailed description of ALL products and services. Be thorough.",
  "unique_value_proposition": "What makes them different. Why would a customer choose them over alternatives.",
  "competitive_advantages": "Specific competitive moats — technology, experience, positioning, relationships",
  "pricing_model": "Subscription|One-time|Hourly|Project|Retainer|Freemium|etc",
  "sales_cycle_length": "Estimate based on business type and market",
  
  "team_size": "1-2|2-5|5-10|10-25|25-50|50+",
  "hiring_status": "Actively hiring|Planning|Not now — infer from context",
  "founder_background": "What is the founder's background, experience, expertise",
  "key_team_members": "Who are the key people and what do they do",
  "team_strengths": "What the team is good at",
  "team_gaps": "What skills or roles are missing",
  
  "mission_statement": "Why does this business exist? What problem does it solve?",
  "vision_statement": "What does success look like in 5-10 years?",
  "short_term_goals": "Goals for the next 6-12 months",
  "long_term_goals": "Goals for the next 2-5 years",
  "main_challenges": "Primary obstacles or constraints",
  "growth_strategy": "How they plan to grow",
  "growth_goals": "revenue_growth|market_expansion|product_diversification|operational_efficiency|team_scaling|profitability",
  "risk_profile": "conservative|moderate|aggressive",
  "competitive_moat": "What protects them from competition long-term"
}

RULES:
- Be thorough. Every field must have meaningful content.
- Infer intelligently from context — business type, market, pricing page, team page, about page.
- Australian English.
- Do NOT leave fields empty. "Not available from current data" only if truly impossible.`;

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
    const websiteUrl = body.website_url || "";
    const businessDescription = body.business_description || "";

    if (!websiteUrl && !businessDescription) {
      return new Response(JSON.stringify({ error: "Provide website_url or business_description" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sources: string[] = [];
    let websiteContent = "";
    let searchContent = "";

    // Scrape the website
    if (websiteUrl) {
      const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
      websiteContent = await scrapeWebsite(url);
      if (websiteContent) sources.push(`scraped: ${url}`);

      // Also scrape key subpages
      const [aboutContent, teamContent, servicesContent] = await Promise.all([
        scrapeWebsite(`${url}/about`),
        scrapeWebsite(`${url}/team`),
        scrapeWebsite(`${url}/services`),
      ]);
      if (aboutContent) { websiteContent += "\n\n--- ABOUT PAGE ---\n" + aboutContent; sources.push("about page"); }
      if (teamContent) { websiteContent += "\n\n--- TEAM PAGE ---\n" + teamContent; sources.push("team page"); }
      if (servicesContent) { websiteContent += "\n\n--- SERVICES PAGE ---\n" + servicesContent; sources.push("services page"); }

      // Search for additional context
      const domain = url.replace(/https?:\/\//, "").replace(/\/.*/, "");
      searchContent = await searchWeb(`${domain} company information products services team`);
      if (searchContent) sources.push("web search");
    }

    const contextBlock = [
      websiteContent ? `WEBSITE CONTENT:\n${websiteContent.substring(0, 10000)}` : "",
      searchContent ? `WEB SEARCH RESULTS:\n${searchContent}` : "",
      businessDescription ? `OWNER DESCRIPTION:\n${businessDescription}` : "",
    ].filter(Boolean).join("\n\n");

    // Call GPT-4o to extract Business DNA
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: `Extract the complete Business DNA from this content:\n\n${contextBlock}` },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("[calibration-dna] OpenAI error:", err);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    let extracted;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: raw.substring(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map extracted fields to business_profiles columns (only non-null values)
    const profileUpdate: Record<string, any> = {};
    const fieldMap: Record<string, string> = {
      business_name: "business_name", industry: "industry", business_stage: "business_stage",
      business_type: "business_type", location: "location", website: "website",
      target_market: "target_market", ideal_customer_profile: "ideal_customer_profile",
      business_model: "business_model", geographic_focus: "geographic_focus",
      customer_count: "customer_count", revenue_range: "revenue_range",
      main_products_services: "main_products_services", unique_value_proposition: "unique_value_proposition",
      competitive_advantages: "competitive_advantages", pricing_model: "pricing_model",
      sales_cycle_length: "sales_cycle_length",
      team_size: "team_size", hiring_status: "hiring_status", founder_background: "founder_background",
      key_team_members: "key_team_members", team_strengths: "team_strengths", team_gaps: "team_gaps",
      mission_statement: "mission_statement", vision_statement: "vision_statement",
      short_term_goals: "short_term_goals", long_term_goals: "long_term_goals",
      main_challenges: "main_challenges", growth_strategy: "growth_strategy",
      growth_goals: "growth_goals", risk_profile: "risk_profile", competitive_moat: "competitive_moat",
    };

    for (const [extractedKey, dbColumn] of Object.entries(fieldMap)) {
      const val = extracted[extractedKey];
      if (val && val !== "Not available from current data" && val !== "null" && val !== "") {
        profileUpdate[dbColumn] = val;
      }
    }

    profileUpdate.last_calibration_step = 9;
    profileUpdate.updated_at = new Date().toISOString();

    // Write to business_profiles
    const fieldsUpdated = Object.keys(profileUpdate).length;
    const { error: updateError } = await supabase
      .from("business_profiles")
      .update(profileUpdate)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[calibration-dna] Update error:", updateError);
      // Try upsert if update fails (no existing row)
      profileUpdate.user_id = user.id;
      const { error: upsertError } = await supabase
        .from("business_profiles")
        .upsert(profileUpdate, { onConflict: "user_id" });
      if (upsertError) {
        console.error("[calibration-dna] Upsert error:", upsertError);
      }
    }

    return new Response(JSON.stringify({
      status: "ok",
      fields_extracted: fieldsUpdated,
      extracted_data: extracted,
      data_sources: sources,
      generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[calibration-dna] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
