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
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function failureResponse(
  code: string,
  error: string,
  status = 422,
  stage = "scan",
  details: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({
      status: "error",
      ok: false,
      error_code: code,
      error,
      stage,
      details,
      generated_at: new Date().toISOString(),
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function normalizeWebsiteUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(candidate);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

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
      const md = data.data?.markdown || "";
      // Only return if we got meaningful content (not error pages or empty shells)
      if (md.length > 200) return md.substring(0, 8000);
    }
  } catch (e) { console.error("[scrape]", e); }
  return "";
}

function stripHtmlTags(input: string): string {
  return (input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWebsiteHtml(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BIQcBot/1.0; +https://biqc.ai)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return "";
    const html = await res.text();
    if (!html || html.length < 200) return "";

    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
    const siteName = (html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] || "").trim();
    const description = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "").trim();
    const bodyText = stripHtmlTags(html).slice(0, 12000);

    return [
      title ? `TITLE: ${title}` : "",
      siteName ? `OG_SITE_NAME: ${siteName}` : "",
      description ? `META_DESCRIPTION: ${description}` : "",
      bodyText ? `BODY_TEXT: ${bodyText}` : "",
    ].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

async function scrapeWebsiteWithKeyPages(baseUrl: string): Promise<string> {
  if (!FIRECRAWL_API_KEY || !baseUrl) return "";
  const origin = new URL(baseUrl).origin;
  const keyPaths = ["", "/contact", "/about", "/about-us", "/services"];
  const pageUrls = keyPaths.map((p) => `${origin}${p}`);
  const pages = await Promise.all(pageUrls.map((u) => scrapeWebsite(u)));
  const merged = pages
    .map((content, idx) => content ? `--- PAGE: ${pageUrls[idx]} ---\n${content}` : "")
    .filter(Boolean)
    .join("\n\n");
  return merged.substring(0, 24000);
}

function buildScanUrls(baseUrl: string): string[] {
  const normalized = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const root = normalized.replace(/\/+$/, "");
  const seeds = ["", "/about", "/about-us", "/contact", "/services"];
  return [...new Set(seeds.map((path) => `${root}${path}`))];
}

// Perplexity deep search — primary intelligence source
async function deepSearch(query: string, maxTokens = 800): Promise<string> {
  if (!PERPLEXITY_API_KEY) return "";
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [{ role: "user", content: query }],
        max_tokens: maxTokens,
      }),
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

  // Business name candidates from common title/meta patterns.
  const titleCandidates = [
    ...((allContent.match(/TITLE:\s*([^\n|•\-]{3,120})/gi) || []).map((m) => m.replace(/^TITLE:\s*/i, "").trim())),
    ...((allContent.match(/OG_SITE_NAME:\s*([^\n]{3,120})/gi) || []).map((m) => m.replace(/^OG_SITE_NAME:\s*/i, "").trim())),
  ]
    .map((v) => v.replace(/\s*\|\s*.*$/, "").replace(/\s*-\s*.*$/, "").trim())
    .filter(Boolean);
  signals.business_name_candidates = [...new Set(titleCandidates)].slice(0, 3);

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
    linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"')<,]+/gi,
    facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s"')<,]+/gi,
    instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s"')<,]+/gi,
    twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/[^\s"')<,]+/gi,
    youtube: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel|c|@)[^\s"')<,]+/gi,
  };
  signals.social_media_links = {};
  for (const [platform, pattern] of Object.entries(socialPatterns)) {
    const matches = allContent.match(pattern);
    if (matches?.length) {
      const first = matches[0].startsWith("http") ? matches[0] : `https://${matches[0]}`;
      signals.social_media_links[platform] = first;
    }
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

const EXTRACTION_PROMPT = `You are a data extraction agent tasked with profiling a business domain. You will be given retrieved passages, scraped pages or API responses related to a domain. Each passage includes its source URL.

Your goal is to extract structured information about the business. Do not invent or infer any values. Populate a field only when there is direct evidence in the provided context; otherwise set the field to null. When data appears ambiguous, prefer the most authoritative source (e.g. official website over secondary blogs). For each populated field, include the URL of the source used.

OUTPUT MUST BE THIS EXACT JSON:
{
  "business_name": null,
  "trading_name": null,
  "industry": null,
  "services_offered": [],
  "market_position": null,
  "team_members": [],
  "competitors": [],
  "revenue_range": null,
  "customer_count": null,
  "team_size": null,
  "location": null,
  "address": null,
  "city": null,
  "state": null,
  "country": null,
  "website": null,
  "abn": null,
  "acn": null,
  "target_market": null,
  "business_model": null,
  "main_products_services": null,
  "unique_value_proposition": null,
  "pricing_model": null,
  "mission_statement": null,
  "vision_statement": null,
  "contact_email": null,
  "contact_phone": null,
  "social_media_links": { "linkedin": null, "facebook": null, "instagram": null, "twitter": null },
  "certifications": null,
  "competitor_analysis": null,
  "market_position": null,
  "executive_summary": null,
  "seo_analysis": null,
  "paid_media_analysis": null,
  "social_media_analysis": null,
  "website_health": null,
  "swot": null,
  "competitor_swot": null,
  "cmo_priority_actions": null,
  "sources": {}
}

RULES:
- No Intelligent Inference: Never infer missing data. If you cannot find explicit evidence, return null.
- Multiple Sources: If multiple sources provide conflicting information, choose the source with the highest authority (official site > government registry > news article).
- Cite Sources: For each non-null field, add an entry in "sources" mapping the field name to an array of source URLs used.
- team_members format: [{"name": "...", "role": "...", "source": "..."}]
- No Extra Fields: Do not add any keys beyond the defined schema.
- Extract EXACT ABN/ACN if visible on any page.
- Extract EXACT address, phone, email as they appear.
- Australian English.`;

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
    let user: { id: string } | null = null;
    try {
      const { data, error: authError } = await supabase.auth.getUser(token);
      if (!authError && data?.user) {
        user = data.user;
      }
    } catch { /* service role key or invalid JWT — fall through */ }

    const body = await req.json();

    if (!user) {
      const bodyUserId = body.user_id || body.tenant_id || "";
      if (bodyUserId) {
        user = { id: bodyUserId };
      } else if (token === SUPABASE_SERVICE_ROLE_KEY) {
        user = { id: "service-role-scan" };
      } else {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const websiteUrl = body.website_url || "";
    const businessDescription = body.business_description || "";
    const businessNameHint = body.business_name_hint || "";
    const locationHint = body.location_hint || "";
    const abnHint = body.abn_hint || "";

    if (!websiteUrl && !businessDescription) {
      return failureResponse(
        "MISSING_SCAN_INPUT",
        "Provide website_url or business_description",
        400,
        "validation",
      );
    }

    const sources: string[] = [];
    let websiteContent = "";
    let perplexityContent = "";

    if (websiteUrl) {
      const url = normalizeWebsiteUrl(websiteUrl);
      if (!url) {
        return failureResponse("INVALID_WEBSITE_URL", "Invalid website_url", 400, "validation");
      }
      const domain = url.replace(/https?:\/\//, "").replace(/\/.*/, "");

      // ═══ PRIMARY: Perplexity deep search (multiple targeted queries in parallel) ═══
      // This is the main intelligence source — accurate, contextual, current
      const [
        identityResult,
        servicesResult,
        marketResult,
        teamResult,
        competitorResult,
      ] = await Promise.all([
        deepSearch(
          `What is the business at ${domain}? Provide: exact registered business name, trading name, ABN if available, physical address, city, state, country, phone number, email address, industry, business type (Pty Ltd, sole trader, etc), years operating. Be specific and factual. If information is not publicly available, say so.` +
          (businessNameHint ? ` The business may be called "${businessNameHint}".` : '') +
          (locationHint ? ` Located near ${locationHint}.` : ''),
          600
        ),
        deepSearch(
          `What products and services does ${domain} offer? Provide: detailed list of all services/products, pricing model if visible, unique value proposition, competitive advantages, target market, ideal customer profile. Be specific about what they actually do, not generic descriptions.` +
          (businessNameHint ? ` Business name: "${businessNameHint}".` : ''),
          600
        ),
        deepSearch(
          `What is the market position of ${domain}? Provide: geographic focus, business model (B2B/B2C/etc), customer count estimate, revenue range estimate, growth strategy, main business challenges, industry position. Be factual — state what is publicly observable.`,
          500
        ),
        deepSearch(
          `Who runs ${domain}? Provide: founder name and background, key team members and roles, team size, hiring status. Also provide: mission statement, vision, short-term goals, long-term goals if publicly stated on their website or LinkedIn.`,
          500
        ),
        deepSearch(
          `Who are the main competitors of ${domain}? List their top 3-5 competitors in the same industry and geographic area. For each: name, website, what they offer, how they compare. Also: what is ${domain}'s competitive moat — what protects them from competition?`,
          500
        ),
      ]);

      if (identityResult) { perplexityContent += "--- BUSINESS IDENTITY ---\n" + identityResult + "\n\n"; sources.push("Perplexity (identity)"); }
      if (servicesResult) { perplexityContent += "--- SERVICES & PRODUCTS ---\n" + servicesResult + "\n\n"; sources.push("Perplexity (services)"); }
      if (marketResult) { perplexityContent += "--- MARKET POSITION ---\n" + marketResult + "\n\n"; sources.push("Perplexity (market)"); }
      if (teamResult) { perplexityContent += "--- TEAM & LEADERSHIP ---\n" + teamResult + "\n\n"; sources.push("Perplexity (team)"); }
      if (competitorResult) { perplexityContent += "--- COMPETITOR LANDSCAPE ---\n" + competitorResult + "\n\n"; sources.push("Perplexity (competitors)"); }

      // ═══ SECONDARY: Firecrawl site scrape (supplemental — only if available) ═══
      // Used for raw page content that Perplexity might miss (footer ABN, contact details)
      if (FIRECRAWL_API_KEY) {
        const crawledContent = await scrapeWebsiteWithKeyPages(url);
        if (crawledContent) {
          websiteContent = crawledContent;
          sources.push(`scraped: ${url}`);
        }
        const scanUrls = buildScanUrls(url);
        const scrapedChunks = await Promise.all(scanUrls.map((scanUrl) => scrapeWebsite(scanUrl)));
        const combined = scrapedChunks
          .map((chunk, i) => (chunk ? `--- ${scanUrls[i]} ---\n${chunk}` : ""))
          .filter(Boolean)
          .join("\n\n");
        if (combined) {
          websiteContent = combined.substring(0, 12000);
          sources.push(`scraped_pages: ${scanUrls.length}`);
        }
      }

      // ═══ FALLBACK: direct HTML fetch (works even without Firecrawl) ═══
      if (!websiteContent) {
        const fallbackUrls = buildScanUrls(url);
        const htmlChunks = await Promise.all(fallbackUrls.map((scanUrl) => fetchWebsiteHtml(scanUrl)));
        const mergedHtml = htmlChunks
          .map((chunk, i) => (chunk ? `--- HTML PAGE: ${fallbackUrls[i]} ---\n${chunk}` : ""))
          .filter(Boolean)
          .join("\n\n");
        if (mergedHtml) {
          websiteContent = mergedHtml.substring(0, 12000);
          sources.push(`html_fallback_pages: ${fallbackUrls.length}`);
        }
      }

      if (!perplexityContent && !websiteContent) {
        return failureResponse(
          "INSUFFICIENT_PUBLIC_CONTENT",
          "No usable public content found for this website",
          422,
          "scan",
          { website_url: url },
        );
      }
    }

    // If only business description provided (no URL)
    if (!websiteUrl && businessDescription) {
      const descResult = await deepSearch(
        `Based on this business description, provide comprehensive business intelligence: "${businessDescription}". ` +
        `Include: likely industry, target market, business model, competitive landscape, growth opportunities, main challenges.` +
        (businessNameHint ? ` Business name: "${businessNameHint}".` : '') +
        (locationHint ? ` Located: ${locationHint}.` : ''),
        800
      );
      if (descResult) { perplexityContent = descResult; sources.push("Perplexity (from description)"); }
    }

    // STEP 1: Deterministic identity signal extraction
    const allContent = [perplexityContent, websiteContent, businessDescription].filter(Boolean).join("\n\n");
    const identitySignals = extractIdentitySignals(allContent, websiteUrl);
    if (abnHint) identitySignals.abn_hint = abnHint;
    if (businessNameHint) identitySignals.business_name_hint = businessNameHint;
    if (locationHint) identitySignals.location_hint = locationHint;

    // STEP 2: AI extraction
    const contextBlock = [
      perplexityContent ? `PERPLEXITY INTELLIGENCE (PRIMARY SOURCE):\n${perplexityContent.substring(0, 12000)}` : "",
      websiteContent ? `RAW WEBSITE CONTENT (SUPPLEMENTAL):\n${websiteContent.substring(0, 4000)}` : "",
      businessDescription ? `OWNER DESCRIPTION:\n${businessDescription}` : "",
      businessNameHint ? `USER HINT - BUSINESS NAME: ${businessNameHint}` : "",
      locationHint ? `USER HINT - LOCATION: ${locationHint}` : "",
      abnHint ? `USER HINT - ABN: ${abnHint}` : "",
    ].filter(Boolean).join("\n\n");

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.3",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: `Extract the complete Business DNA from this content:\n\n${contextBlock}` },
        ],
        temperature: 0.3,
        max_tokens: 2500,
      }),
    });

    if (!aiRes.ok) {
      const rawErr = await aiRes.text();
      console.error("[calibration-dna] OpenAI error:", rawErr);
      return failureResponse("AI_EXTRACTION_FAILED", "AI extraction failed", 502, "extraction");
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    let extracted;
    try {
      extracted = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    } catch {
      return failureResponse(
        "AI_RESPONSE_PARSE_FAILED",
        "Failed to parse AI response",
        502,
        "extraction",
      );
    }

    // STEP 3: Merge deterministic signals into AI extraction (deterministic wins for identity)
    if (identitySignals.abn_candidates?.length > 0 && (!extracted.abn || extracted.abn === "Not available from current data")) {
      extracted.abn = identitySignals.abn_candidates[0];
    }
    if (identitySignals.business_name_candidates?.length > 0 && (!extracted.business_name || extracted.business_name === "Not available from current data")) {
      extracted.business_name = identitySignals.business_name_candidates[0];
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
    if (extracted.social_media_links && typeof extracted.social_media_links === "object") {
      profileUpdate.social_handles = extracted.social_media_links;
    }
    if (extracted.competitor_analysis) {
      profileUpdate.competitor_scan_result = typeof extracted.competitor_analysis === "string"
        ? extracted.competitor_analysis
        : JSON.stringify(extracted.competitor_analysis);
    }
    if (extracted.market_position) {
      profileUpdate.market_position = extracted.market_position;
    }
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
      ok: true,
      fields_extracted: fieldsUpdated,
      extracted_data: extracted,
      identity_signals: identitySignals,
      data_sources: sources,
      generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[calibration-dna] Error:", err);
    return failureResponse("INTERNAL_SCAN_ERROR", "Internal scan error", 500, "scan");
  }
});
