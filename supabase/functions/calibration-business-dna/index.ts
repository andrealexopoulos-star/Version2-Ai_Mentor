// ═══════════════════════════════════════════════════════════════
// CALIBRATION BUSINESS DNA — Enhanced Supabase Edge Function
//
// V2: Now extracts full identity signals for forensic verification:
//   - ABN/ACN patterns
//   - Phone numbers, emails
//   - Physical addresses
//   - Social media profile URLs
//   - Geographic signals
//   - Page structure signals (about, contact, services presence)
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

// Deterministic identity signal extraction (no AI needed)
function extractIdentitySignals(allContent: string, websiteUrl: string) {
  const signals: Record<string, any> = {};

  // ABN: XX XXX XXX XXX (11 digits)
  const abnPattern = /\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/g;
  const abnMatches = [...new Set((allContent.match(abnPattern) || []))];
  signals.abn_candidates = abnMatches.filter(m => m.replace(/\s/g, '').length === 11).slice(0, 3);

  // ACN: XXX XXX XXX (9 digits, usually prefixed with ACN)
  const acnPattern = /\bACN[:\s]*(\d{3}\s?\d{3}\s?\d{3})\b/gi;
  signals.acn_candidates = (allContent.match(acnPattern) || []).slice(0, 3);

  // Phone numbers (AU formats)
  const phonePattern = /(?:\+61|0)(?:\s?[2-9]\d{1,2}\s?\d{3,4}\s?\d{3,4}|\s?4\d{2}\s?\d{3}\s?\d{3})|(?:1[38]00\s?\d{3}\s?\d{3})/g;
  signals.phone_numbers = [...new Set((allContent.match(phonePattern) || []))].slice(0, 5);

  // Email addresses
  const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  signals.email_addresses = [...new Set((allContent.match(emailPattern) || []))]
    .filter(e => !e.includes('example.com') && !e.includes('sentry.io') && !e.includes('wixpress'))
    .slice(0, 5);

  // Social media URLs
  const socialPatterns: Record<string, RegExp> = {
    linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"')<,]+/gi,
    facebook: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"')<,]+/gi,
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"')<,]+/gi,
    twitter: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"')<,]+/gi,
    youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|@)[^\s"')<,]+/gi,
  };
  signals.social_media_links = {};
  for (const [platform, pattern] of Object.entries(socialPatterns)) {
    const matches = allContent.match(pattern);
    if (matches?.length) signals.social_media_links[platform] = matches[0];
  }

  // Physical address (Australian format)
  const addressPattern = /(?:Level\s+\d+[,\s]+)?(?:\d+[A-Za-z]?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Way|Place|Pl|Court|Ct|Crescent|Cres|Boulevard|Blvd|Parade|Pde|Terrace|Tce|Highway|Hwy)[,\s]+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*[,\s]+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}/g;
  signals.address_candidates = (allContent.match(addressPattern) || []).slice(0, 3);

  // Geographic city mentions
  const cityPattern = /\b(Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Darwin|Canberra|Gold Coast|Newcastle|Wollongong|Geelong|Cairns|Townsville|Toowoomba)\b/gi;
  signals.geographic_mentions = [...new Set((allContent.match(cityPattern) || []).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()))].slice(0, 5);

  // State abbreviations
  signals.state_abbreviations = [...new Set(allContent.match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/g) || [])];

  // Page structure
  const lower = allContent.toLowerCase();
  signals.page_signals = {
    about_page_exists: lower.includes('--- about page ---'),
    contact_page_exists: lower.includes('--- contact page ---'),
    services_page_exists: lower.includes('--- services page ---'),
    case_studies_detected: lower.includes('case stud') || lower.includes('testimonial') || lower.includes('client stories'),
    pricing_page_detected: lower.includes('/pricing') || lower.includes('pricing'),
  };

  // Domain email match
  if (websiteUrl) {
    const domain = websiteUrl.replace(/https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    signals.domain = domain;
    signals.email_matches_domain = signals.email_addresses.some((e: string) => e.includes(domain));
  }

  return signals;
}

const EXTRACTION_PROMPT = `You are a Business Intelligence Analyst performing a forensic identity extraction. Extract EVERY possible business data point from the provided content.

You must fill ALL fields. If information is not explicitly available, make intelligent inferences based on context. If truly impossible to determine, write "Not available from current data".

OUTPUT MUST BE THIS EXACT JSON:
{
  "business_name": "Company name as it appears on the website",
  "trading_name": "Alternative/trading name if different from legal name",
  "brand_name": "Brand name if different from business name",
  "industry": "Primary industry/sector",
  "business_stage": "startup|early_revenue|growth|established",
  "business_type": "LLC|Sole Trader|Partnership|Pty Ltd|etc",
  "location": "Full address if found, otherwise City, State, Country",
  "address": "Physical street address if found",
  "city": "City name",
  "state": "State/Province",
  "country": "Country",
  "website": "URL",
  "abn": "Australian Business Number if found (11 digits)",
  "acn": "Australian Company Number if found (9 digits)",
  "target_market": "Detailed description of who they sell to",
  "ideal_customer_profile": "Specific profile of their perfect customer",
  "business_model": "SaaS|eCommerce|Services|Marketplace|Subscription|Hybrid|etc",
  "geographic_focus": "Local|Regional|National|Global with specifics",
  "customer_count": "Estimate based on available data",
  "revenue_range": "Estimate based on team size, pricing, market position",
  "main_products_services": "Detailed description of ALL products and services",
  "unique_value_proposition": "What makes them different",
  "competitive_advantages": "Specific competitive moats",
  "pricing_model": "Subscription|One-time|Hourly|Project|Retainer|Freemium|etc",
  "sales_cycle_length": "Estimate based on business type and market",
  "team_size": "1-2|2-5|5-10|10-25|25-50|50+",
  "hiring_status": "Actively hiring|Planning|Not now",
  "founder_background": "Founder background and expertise",
  "key_team_members": "Key people and their roles",
  "team_strengths": "What the team is good at",
  "team_gaps": "Missing skills or roles",
  "mission_statement": "Why does this business exist?",
  "vision_statement": "What does success look like in 5-10 years?",
  "short_term_goals": "Goals for the next 6-12 months",
  "long_term_goals": "Goals for the next 2-5 years",
  "main_challenges": "Primary obstacles or constraints",
  "growth_strategy": "How they plan to grow",
  "growth_goals": "revenue_growth|market_expansion|product_diversification|operational_efficiency|team_scaling|profitability",
  "risk_profile": "conservative|moderate|aggressive",
  "competitive_moat": "What protects them from competition",
  "social_media_links": { "linkedin": "", "facebook": "", "instagram": "", "twitter": "", "youtube": "" },
  "contact_email": "Primary contact email",
  "contact_phone": "Primary phone number",
  "services_count": 0,
  "testimonials": "Summary of testimonials/case studies if found",
  "certifications": "Professional certifications or accreditations"
}

RULES:
- Be thorough. Every field must have meaningful content.
- Infer intelligently from context. Australian English.
- Extract EXACT ABN/ACN if visible on any page.
- Extract EXACT address, phone, email as they appear.
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
    const businessNameHint = body.business_name_hint || "";
    const locationHint = body.location_hint || "";
    const abnHint = body.abn_hint || "";

    if (!websiteUrl && !businessDescription) {
      return new Response(JSON.stringify({ error: "Provide website_url or business_description" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sources: string[] = [];
    let websiteContent = "";
    let searchContent = "";

    if (websiteUrl) {
      const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;

      // Scrape main page + key subpages in parallel (now includes /contact)
      const [mainContent, aboutContent, contactContent, servicesContent, teamContent] = await Promise.all([
        scrapeWebsite(url),
        scrapeWebsite(`${url}/about`),
        scrapeWebsite(`${url}/contact`),
        scrapeWebsite(`${url}/services`),
        scrapeWebsite(`${url}/team`),
      ]);

      if (mainContent) { websiteContent = mainContent; sources.push(`scraped: ${url}`); }
      if (aboutContent) { websiteContent += "\n\n--- ABOUT PAGE ---\n" + aboutContent; sources.push("about page"); }
      if (contactContent) { websiteContent += "\n\n--- CONTACT PAGE ---\n" + contactContent; sources.push("contact page"); }
      if (servicesContent) { websiteContent += "\n\n--- SERVICES PAGE ---\n" + servicesContent; sources.push("services page"); }
      if (teamContent) { websiteContent += "\n\n--- TEAM PAGE ---\n" + teamContent; sources.push("team page"); }

      const domain = url.replace(/https?:\/\//, "").replace(/\/.*/, "");
      const searchQuery = [domain, "company information products services team", businessNameHint ? `"${businessNameHint}"` : "", locationHint].filter(Boolean).join(" ");
      searchContent = await searchWeb(searchQuery);
      if (searchContent) sources.push("web search");
    }

    // STEP 1: Deterministic identity signal extraction
    const allContent = [websiteContent, searchContent, businessDescription].filter(Boolean).join("\n\n");
    const identitySignals = extractIdentitySignals(allContent, websiteUrl);
    if (abnHint) identitySignals.abn_hint = abnHint;
    if (businessNameHint) identitySignals.business_name_hint = businessNameHint;
    if (locationHint) identitySignals.location_hint = locationHint;

    // STEP 2: AI extraction
    const contextBlock = [
      websiteContent ? `WEBSITE CONTENT:\n${websiteContent.substring(0, 10000)}` : "",
      searchContent ? `WEB SEARCH RESULTS:\n${searchContent}` : "",
      businessDescription ? `OWNER DESCRIPTION:\n${businessDescription}` : "",
      businessNameHint ? `USER HINT - BUSINESS NAME: ${businessNameHint}` : "",
      locationHint ? `USER HINT - LOCATION: ${locationHint}` : "",
      abnHint ? `USER HINT - ABN: ${abnHint}` : "",
    ].filter(Boolean).join("\n\n");

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
        max_tokens: 2500,
      }),
    });

    if (!aiRes.ok) {
      console.error("[calibration-dna] OpenAI error:", await aiRes.text());
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    let extracted;
    try {
      extracted = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: raw.substring(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 3: Merge deterministic signals into AI extraction (deterministic wins for identity)
    if (identitySignals.abn_candidates?.length > 0 && (!extracted.abn || extracted.abn === "Not available from current data")) {
      extracted.abn = identitySignals.abn_candidates[0];
    }
    if (identitySignals.phone_numbers?.length > 0 && (!extracted.contact_phone || extracted.contact_phone === "Not available from current data")) {
      extracted.contact_phone = identitySignals.phone_numbers[0];
    }
    if (identitySignals.email_addresses?.length > 0 && (!extracted.contact_email || extracted.contact_email === "Not available from current data")) {
      extracted.contact_email = identitySignals.email_addresses[0];
    }
    if (identitySignals.address_candidates?.length > 0 && (!extracted.address || extracted.address === "Not available from current data")) {
      extracted.address = identitySignals.address_candidates[0];
    }
    if (identitySignals.social_media_links) {
      if (!extracted.social_media_links || typeof extracted.social_media_links !== 'object') extracted.social_media_links = {};
      for (const [platform, url] of Object.entries(identitySignals.social_media_links)) {
        if (url && !extracted.social_media_links[platform]) extracted.social_media_links[platform] = url;
      }
    }
    extracted._identity_signals = identitySignals;

    // STEP 4: Write to business_profiles
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

    const fieldsUpdated = Object.keys(profileUpdate).length;
    const { error: updateError } = await supabase.from("business_profiles").update(profileUpdate).eq("user_id", user.id);
    if (updateError) {
      profileUpdate.user_id = user.id;
      await supabase.from("business_profiles").upsert(profileUpdate, { onConflict: "user_id" });
    }

    return new Response(JSON.stringify({
      status: "ok",
      fields_extracted: fieldsUpdated,
      extracted_data: extracted,
      identity_signals: identitySignals,
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
