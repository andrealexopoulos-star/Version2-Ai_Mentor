// ═══════════════════════════════════════════════════════════════
// CUSTOMER REVIEWS DEEP — Supabase Edge Function
//
// Per-platform deep extraction of customer review intelligence for
// AU SMB target market. Replaces the misnamed `browse-ai-reviews`
// shallow Google-HTML scraper with real per-platform scraping +
// LLM sentiment classification + LLM theme extraction.
//
// Platforms covered:
//   1. Google Maps (via Serper.dev places endpoint)
//   2. Trustpilot   (via Firecrawl scrape)
//   3. ProductReview.com.au (via Firecrawl scrape) — critical for AU SMB
//   4. Yelp         (via Firecrawl scrape)
//   5. Facebook     (via Firecrawl scrape — best-effort)
//
// Sentiment: LLM Trinity (OpenAI + Gemini + Anthropic) batch classification.
//            NO keyword bag.
// Themes:    LLM corpus analysis with example quote per theme.
// Aggregation: weighted_avg_rating + sentiment_distribution + review_velocity.
//
// Contract v2 (BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2):
//   - INTERNAL: full detail in `ai_errors[]` + per-platform `_internal`.
//   - EXTERNAL: response is sanitised — no supplier names, no API key
//     names, no HTTP error codes from upstream. State enum is one of
//     DATA_AVAILABLE | DATA_UNAVAILABLE | INSUFFICIENT_SIGNAL |
//     PROCESSING | DEGRADED.
//   - Empty != success: a failed platform returns INSUFFICIENT_SIGNAL,
//     never `ok: true` with empty fields.
//
// Deploy: supabase functions deploy customer-reviews-deep --no-verify-jwt
// Secrets: SERPER_API_KEY, FIRECRAWL_API_KEY,
//          OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY,
//          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

// ── Env / config ─────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") || "";

// Per-platform Firecrawl timeout. Conservative — Trustpilot and ProductReview
// pages are heavy; Yelp + Facebook are heavier still.
const FIRECRAWL_TIMEOUT_MS = 25000;
const SERPER_TIMEOUT_MS = 18000;
const LLM_TIMEOUT_MS = 35000;

// ── Types ────────────────────────────────────────────────────────────────
type PlatformId =
  | "google_maps"
  | "trustpilot"
  | "productreview_au"
  | "yelp"
  | "facebook";

type ExternalState =
  | "DATA_AVAILABLE"
  | "DATA_UNAVAILABLE"
  | "INSUFFICIENT_SIGNAL"
  | "PROCESSING"
  | "DEGRADED";

interface RecentReview {
  text: string;
  rating: number | null; // 0..5 or null
  author_handle?: string; // first name only — strict no-PII
  date_iso: string | null; // best-effort ISO yyyy-mm-dd
  sentiment: "positive" | "negative" | "neutral" | null;
}

interface PlatformReviewIntel {
  platform: PlatformId;
  url: string;
  found: boolean;
  state: ExternalState;
  overall_rating: number | null;
  total_review_count: number | null;
  recent_reviews: RecentReview[];
  themes: string[];
  review_velocity: {
    last_30d: number | null;
    last_90d: number | null;
  };
  // INTERNAL — never serialised to the external response after Contract v2
  // sanitisation. Kept on the per-platform record so calibration.py can
  // log it into business_dna_enrichment.enrichment.ai_errors.
  ai_errors: string[];
}

interface AggregatedReviewIntel {
  weighted_avg_rating: number | null;
  total_reviews_cross_platform: number;
  sentiment_distribution: {
    positive_pct: number;
    negative_pct: number;
    neutral_pct: number;
  };
  velocity_total: {
    last_30d: number | null;
    last_90d: number | null;
  };
  themes_top: Array<{ theme: string; example_quote: string; platforms: PlatformId[] }>;
  has_data: boolean;
  state: ExternalState;
}

interface CustomerReviewsDeepResponse {
  ok: boolean;
  state: ExternalState;
  business_name: string;
  platforms: PlatformReviewIntel[];
  aggregated: AggregatedReviewIntel;
  // INTERNAL — calibration.py reads this for error surfacing. The HTTP
  // boundary in calibration.py is responsible for sanitising before
  // returning to the frontend. See Contract v2 §"Backend is the boundary".
  ai_errors: string[];
  correlation: { run_id: string | null; step: string | null };
  generated_at: string;
}

// ── Slug / handle derivation ────────────────────────────────────────────
function kebabCase(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function deriveDomainSlug(domain: string): string {
  return (domain || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
}

function firstName(full: string | null | undefined): string {
  if (!full) return "";
  const fn = String(full).split(/[\s,]+/)[0] || "";
  return fn.replace(/[^a-zA-ZÀ-ſ\-]/g, "").slice(0, 40);
}

function clampRating(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 0 || n > 5) return null;
  return Math.round(n * 10) / 10;
}

function clampInt(value: unknown, max = 1_000_000): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > max) return null;
  return Math.floor(n);
}

function safeJsonParse(text: string): any {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract first JSON object/array substring (LLMs often wrap)
    const m = text.match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ── Provider trace persistence ──────────────────────────────────────────
//
// Contract requirement: every supplier call writes a trace row. R2B owns
// per-platform Firecrawl + LLM traces. The R2A/E2 enrichment_trace module
// may not exist yet — we write directly into a `provider_traces` table
// with a graceful fallback (no crash if the table is missing). This keeps
// R2B independently shippable and forward-compatible: when R2A lands
// the table will already be receiving rows.

interface ProviderTrace {
  user_id: string | null;
  run_id: string | null;
  edge_function: string;
  platform: PlatformId | "aggregate";
  provider: "serper" | "firecrawl" | "llm_trinity" | "openai" | "anthropic" | "gemini";
  operation: string;
  ok: boolean;
  http_status: number | null;
  latency_ms: number;
  error_code: string | null;
  url_or_input: string | null;
  recorded_at: string;
}

async function writeTrace(
  sb: any,
  trace: ProviderTrace,
): Promise<void> {
  try {
    // Best-effort insert. If the table doesn't exist or RLS rejects,
    // we log and continue — never fail the scan because tracing missed.
    const { error } = await sb.from("provider_traces").insert(trace);
    if (error) {
      // Detect "table missing" specifically — no need to log every scan.
      const msg = String(error.message || error.code || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("relation")) {
        // Single warning per cold start; trace table will be created by R2A.
        console.warn(
          "[customer-reviews-deep] provider_traces table absent — trace not persisted (forward-compat)",
        );
      } else {
        console.warn("[customer-reviews-deep] trace insert failed:", error.message);
      }
    }
  } catch (e) {
    console.warn("[customer-reviews-deep] trace insert threw:", String(e).slice(0, 120));
  }
}

// ── Firecrawl scrape ────────────────────────────────────────────────────
async function firecrawlScrape(
  url: string,
  aiErrors: string[],
): Promise<{ markdown: string; html: string; ok: boolean; status: number; error?: string }> {
  if (!FIRECRAWL_API_KEY) {
    aiErrors.push("scrape_provider_unconfigured");
    return { markdown: "", html: "", ok: false, status: 0, error: "scrape_provider_unconfigured" };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        timeout: FIRECRAWL_TIMEOUT_MS - 2000,
        onlyMainContent: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      aiErrors.push(`scrape_http_${res.status}_for_${new URL(url).host}`);
      return { markdown: "", html: "", ok: false, status: res.status, error: `scrape_http_${res.status}` };
    }
    const data = await res.json();
    const markdown = String(data?.data?.markdown || "");
    const html = String(data?.data?.html || "");
    if (!markdown && !html) {
      aiErrors.push(`scrape_empty_for_${new URL(url).host}`);
      return { markdown: "", html: "", ok: false, status: res.status, error: "scrape_empty" };
    }
    return { markdown, html, ok: true, status: res.status };
  } catch (err) {
    const msg = String(err).slice(0, 100);
    aiErrors.push(`scrape_exception_${msg}`);
    return { markdown: "", html: "", ok: false, status: 0, error: "scrape_exception" };
  }
}

// ── Serper.dev — Google Maps places + organic ───────────────────────────
//
// Serper supports a `places` endpoint that returns Google Maps results
// with rating + review count + place_id. We then call `places` with the
// specific business name + location, take the top match, extract rating
// and review count. For per-review snippets we fall back to a Serper
// `search` query with `inurl:google.com/maps` to surface review URLs.

async function serperGoogleMapsLookup(
  businessName: string,
  location: string,
  aiErrors: string[],
): Promise<{
  rating: number | null;
  review_count: number | null;
  url: string;
  place_address: string;
  ok: boolean;
}> {
  if (!SERPER_API_KEY) {
    aiErrors.push("maps_provider_unconfigured");
    return { rating: null, review_count: null, url: "", place_address: "", ok: false };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SERPER_TIMEOUT_MS);
    const q = `${businessName} ${location}`.trim();
    const res = await fetch("https://google.serper.dev/places", {
      method: "POST",
      headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "au", hl: "en" }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      aiErrors.push(`maps_http_${res.status}`);
      return { rating: null, review_count: null, url: "", place_address: "", ok: false };
    }
    const data = await res.json();
    const places: any[] = Array.isArray(data?.places) ? data.places : [];
    if (!places.length) {
      // No Maps presence detected — distinct from supplier failure.
      return { rating: null, review_count: null, url: "", place_address: "", ok: true };
    }
    const top = places[0];
    const rating = clampRating(top?.rating);
    const review_count = clampInt(top?.ratingCount);
    const placeId = top?.placeId || top?.cid || "";
    const url = placeId
      ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`
      : (top?.website || "");
    const place_address = String(top?.address || "");
    return { rating, review_count, url, place_address, ok: true };
  } catch (err) {
    aiErrors.push(`maps_exception_${String(err).slice(0, 60)}`);
    return { rating: null, review_count: null, url: "", place_address: "", ok: false };
  }
}

// Use Serper search with "google.com/maps reviews" filter to grab review
// snippets. This is the closest free-tier proxy to per-review data.
async function serperGoogleMapsReviewSnippets(
  businessName: string,
  location: string,
  aiErrors: string[],
): Promise<RecentReview[]> {
  if (!SERPER_API_KEY) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SERPER_TIMEOUT_MS);
    const q = `"${businessName}" ${location} reviews site:google.com/maps OR site:maps.google.com`;
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "au", hl: "en", num: 10 }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      aiErrors.push(`maps_search_http_${res.status}`);
      return [];
    }
    const data = await res.json();
    const organic: any[] = Array.isArray(data?.organic) ? data.organic : [];
    const reviews: RecentReview[] = [];
    for (const r of organic.slice(0, 10)) {
      const snip = String(r?.snippet || "");
      if (snip.length < 20) continue;
      reviews.push({
        text: snip.slice(0, 400),
        rating: null,
        date_iso: null,
        sentiment: null, // Set by LLM Trinity below
      });
    }
    return reviews;
  } catch (err) {
    aiErrors.push(`maps_search_exception_${String(err).slice(0, 60)}`);
    return [];
  }
}

// ── Per-platform extractors ─────────────────────────────────────────────
//
// Each returns a partially-populated PlatformReviewIntel with rating /
// count / raw recent_reviews. Sentiment + themes are set after the
// LLM batch pass below.

async function extractGoogleMaps(
  businessName: string,
  location: string,
): Promise<PlatformReviewIntel> {
  const aiErrors: string[] = [];
  const lookup = await serperGoogleMapsLookup(businessName, location, aiErrors);
  let snippets: RecentReview[] = [];
  if (lookup.ok && (lookup.rating !== null || lookup.review_count !== null)) {
    snippets = await serperGoogleMapsReviewSnippets(businessName, location, aiErrors);
  }
  const found = lookup.ok && (lookup.rating !== null || lookup.review_count !== null);
  let state: ExternalState = "INSUFFICIENT_SIGNAL";
  if (found && snippets.length > 0) state = "DATA_AVAILABLE";
  else if (found) state = "DEGRADED";
  else if (!lookup.ok) state = "DATA_UNAVAILABLE";
  return {
    platform: "google_maps",
    url: lookup.url,
    found,
    state,
    overall_rating: lookup.rating,
    total_review_count: lookup.review_count,
    recent_reviews: snippets,
    themes: [],
    review_velocity: { last_30d: null, last_90d: null },
    ai_errors: aiErrors,
  };
}

async function extractTrustpilot(
  domain: string,
): Promise<PlatformReviewIntel> {
  const aiErrors: string[] = [];
  const cleanDomain = deriveDomainSlug(domain);
  if (!cleanDomain) {
    aiErrors.push("trustpilot_no_domain");
    return {
      platform: "trustpilot",
      url: "",
      found: false,
      state: "INSUFFICIENT_SIGNAL",
      overall_rating: null,
      total_review_count: null,
      recent_reviews: [],
      themes: [],
      review_velocity: { last_30d: null, last_90d: null },
      ai_errors: aiErrors,
    };
  }
  const url = `https://www.trustpilot.com/review/${cleanDomain}`;
  const scrape = await firecrawlScrape(url, aiErrors);
  if (!scrape.ok) {
    return {
      platform: "trustpilot",
      url,
      found: false,
      state: "DATA_UNAVAILABLE",
      overall_rating: null,
      total_review_count: null,
      recent_reviews: [],
      themes: [],
      review_velocity: { last_30d: null, last_90d: null },
      ai_errors: aiErrors,
    };
  }
  const md = scrape.markdown;
  const html = scrape.html;

  // Trustpilot embeds rating in the markdown rendering (e.g. "TrustScore 4.3")
  // and in HTML JSON-LD. Try both.
  let rating: number | null = null;
  const ratingMd = md.match(/TrustScore\s*[:\-]?\s*(\d(?:\.\d)?)/i)
    || md.match(/(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/i);
  if (ratingMd) rating = clampRating(parseFloat(ratingMd[1]));
  if (rating === null) {
    const ldRating = html.match(/"ratingValue"\s*:\s*"?(\d(?:\.\d)?)"?/i);
    if (ldRating) rating = clampRating(parseFloat(ldRating[1]));
  }

  let reviewCount: number | null = null;
  const cntMd = md.match(/(\d[\d,]*)\s+reviews?/i);
  if (cntMd) reviewCount = clampInt(parseInt(cntMd[1].replace(/,/g, ""), 10));
  if (reviewCount === null) {
    const ldCnt = html.match(/"reviewCount"\s*:\s*"?(\d+)"?/i);
    if (ldCnt) reviewCount = clampInt(parseInt(ldCnt[1], 10));
  }

  // Extract recent review blocks. Trustpilot's markdown render typically
  // separates reviews with headings like "Rated N out of 5 stars".
  const recentReviews: RecentReview[] = [];
  const reviewBlocks = md.split(/(?=Rated\s+\d\s+out of 5 stars)/i).slice(1, 22);
  for (const block of reviewBlocks) {
    const ratingM = block.match(/Rated\s+(\d)\s+out of 5/i);
    const r = ratingM ? clampRating(parseInt(ratingM[1], 10)) : null;
    // Body: skip the rating label, take the next ~400 chars of meaningful prose.
    const body = block
      .replace(/Rated\s+\d\s+out of 5 stars?/i, "")
      .replace(/^[\s\W]+/, "")
      .split(/\n{2,}/)[0]
      .replace(/\s+/g, " ")
      .trim();
    if (body.length < 20) continue;
    // Best-effort date capture (Trustpilot uses "Date of experience: YYYY-MM-DD").
    const dateM = block.match(/Date of experience[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
    const dateIso = dateM ? normaliseDate(dateM[1]) : null;
    // Author first name only (privacy).
    const authorM = block.match(/^([A-Z][a-z]+(?:\s+[A-Z]\.?)?)\s+[•|·]/);
    const author = authorM ? firstName(authorM[1]) : undefined;
    recentReviews.push({
      text: body.slice(0, 500),
      rating: r,
      author_handle: author,
      date_iso: dateIso,
      sentiment: null,
    });
    if (recentReviews.length >= 20) break;
  }

  const found = rating !== null || reviewCount !== null || recentReviews.length > 0;
  const state: ExternalState = found
    ? (recentReviews.length > 0 ? "DATA_AVAILABLE" : "DEGRADED")
    : "INSUFFICIENT_SIGNAL";

  return {
    platform: "trustpilot",
    url,
    found,
    state,
    overall_rating: rating,
    total_review_count: reviewCount,
    recent_reviews: recentReviews,
    themes: [],
    review_velocity: computeVelocity(recentReviews),
    ai_errors: aiErrors,
  };
}

async function extractProductReviewAU(
  businessName: string,
  domainSlug: string,
  explicitSlug?: string,
): Promise<PlatformReviewIntel> {
  const aiErrors: string[] = [];
  const slug = explicitSlug || kebabCase(businessName) || domainSlug;
  if (!slug) {
    aiErrors.push("productreview_no_slug");
    return emptyIntel("productreview_au", "", "INSUFFICIENT_SIGNAL", aiErrors);
  }
  const url = `https://www.productreview.com.au/listings/${slug}`;
  const scrape = await firecrawlScrape(url, aiErrors);
  if (!scrape.ok) {
    return emptyIntel("productreview_au", url, "DATA_UNAVAILABLE", aiErrors);
  }
  const md = scrape.markdown;
  const html = scrape.html;

  let rating: number | null = null;
  // ProductReview surfaces "X.X / 5" in the listing header.
  const ratingMd = md.match(/(\d(?:\.\d)?)\s*(?:\/|out of)\s*5/i);
  if (ratingMd) rating = clampRating(parseFloat(ratingMd[1]));
  if (rating === null) {
    const ldRating = html.match(/"ratingValue"\s*:\s*"?(\d(?:\.\d)?)"?/i);
    if (ldRating) rating = clampRating(parseFloat(ldRating[1]));
  }

  let reviewCount: number | null = null;
  const cntMd = md.match(/(\d[\d,]*)\s+reviews?/i);
  if (cntMd) reviewCount = clampInt(parseInt(cntMd[1].replace(/,/g, ""), 10));
  if (reviewCount === null) {
    const ldCnt = html.match(/"reviewCount"\s*:\s*"?(\d+)"?/i);
    if (ldCnt) reviewCount = clampInt(parseInt(ldCnt[1], 10));
  }

  // Recent reviews: PR.com.au markdown typically has each review as a
  // bold star-rating line followed by the review body and a date.
  const recentReviews: RecentReview[] = [];
  const blocks = md.split(/(?=\b(?:[1-5])\.0?\s*\/\s*5\b)/).slice(1, 22);
  for (const block of blocks) {
    const ratingM = block.match(/^(\d(?:\.\d)?)\s*\/\s*5/);
    const r = ratingM ? clampRating(parseFloat(ratingM[1])) : null;
    const body = block
      .replace(/^\d(?:\.\d)?\s*\/\s*5/, "")
      .replace(/^[\s\W]+/, "")
      .split(/\n{2,}/)[0]
      .replace(/\s+/g, " ")
      .trim();
    if (body.length < 20) continue;
    const dateM = block.match(/(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/);
    const dateIso = dateM ? normaliseDate(dateM[1]) : null;
    recentReviews.push({
      text: body.slice(0, 500),
      rating: r,
      date_iso: dateIso,
      sentiment: null,
    });
    if (recentReviews.length >= 20) break;
  }

  const found = rating !== null || reviewCount !== null || recentReviews.length > 0;
  const state: ExternalState = found
    ? (recentReviews.length > 0 ? "DATA_AVAILABLE" : "DEGRADED")
    : "INSUFFICIENT_SIGNAL";

  return {
    platform: "productreview_au",
    url,
    found,
    state,
    overall_rating: rating,
    total_review_count: reviewCount,
    recent_reviews: recentReviews,
    themes: [],
    review_velocity: computeVelocity(recentReviews),
    ai_errors: aiErrors,
  };
}

async function extractYelp(
  businessName: string,
  location: string,
  explicitSlug?: string,
): Promise<PlatformReviewIntel> {
  const aiErrors: string[] = [];
  const slug = explicitSlug || `${kebabCase(businessName)}-${kebabCase(location)}`.replace(/-+$/, "");
  if (!slug) {
    aiErrors.push("yelp_no_slug");
    return emptyIntel("yelp", "", "INSUFFICIENT_SIGNAL", aiErrors);
  }
  const url = `https://www.yelp.com/biz/${slug}`;
  const scrape = await firecrawlScrape(url, aiErrors);
  if (!scrape.ok) {
    return emptyIntel("yelp", url, "DATA_UNAVAILABLE", aiErrors);
  }
  const md = scrape.markdown;
  const html = scrape.html;

  let rating: number | null = null;
  const ratingHtml = html.match(/"ratingValue"\s*:\s*"?(\d(?:\.\d)?)"?/i)
    || html.match(/aria-label="(\d(?:\.\d)?)\s+star\s+rating"/i);
  if (ratingHtml) rating = clampRating(parseFloat(ratingHtml[1]));

  let reviewCount: number | null = null;
  const cntHtml = html.match(/"reviewCount"\s*:\s*"?(\d+)"?/i)
    || md.match(/(\d[\d,]*)\s+reviews?/i);
  if (cntHtml) reviewCount = clampInt(parseInt(cntHtml[1].replace(/,/g, ""), 10));

  const recentReviews: RecentReview[] = [];
  // Yelp embeds reviews in JSON-LD review arrays.
  const ldReviews = html.match(/"@type"\s*:\s*"Review"[\s\S]*?(?="@type"|$)/gi) || [];
  for (const block of ldReviews.slice(0, 20)) {
    const bodyM = block.match(/"reviewBody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!bodyM) continue;
    const body = bodyM[1].replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
    if (body.length < 20) continue;
    const ratingM = block.match(/"ratingValue"\s*:\s*"?(\d(?:\.\d)?)"?/);
    const r = ratingM ? clampRating(parseFloat(ratingM[1])) : null;
    const dateM = block.match(/"datePublished"\s*:\s*"([^"]+)"/);
    const dateIso = dateM ? normaliseDate(dateM[1]) : null;
    const authorM = block.match(/"author"[\s\S]*?"name"\s*:\s*"([^"]+)"/);
    recentReviews.push({
      text: body.slice(0, 500),
      rating: r,
      author_handle: authorM ? firstName(authorM[1]) : undefined,
      date_iso: dateIso,
      sentiment: null,
    });
  }

  const found = rating !== null || reviewCount !== null || recentReviews.length > 0;
  const state: ExternalState = found
    ? (recentReviews.length > 0 ? "DATA_AVAILABLE" : "DEGRADED")
    : "INSUFFICIENT_SIGNAL";

  return {
    platform: "yelp",
    url,
    found,
    state,
    overall_rating: rating,
    total_review_count: reviewCount,
    recent_reviews: recentReviews,
    themes: [],
    review_velocity: computeVelocity(recentReviews),
    ai_errors: aiErrors,
  };
}

async function extractFacebook(
  fbHandle: string,
  businessName: string,
): Promise<PlatformReviewIntel> {
  const aiErrors: string[] = [];
  const handle = fbHandle || kebabCase(businessName).replace(/-/g, "");
  if (!handle) {
    aiErrors.push("facebook_no_handle");
    return emptyIntel("facebook", "", "INSUFFICIENT_SIGNAL", aiErrors);
  }
  const url = `https://www.facebook.com/${handle}/reviews`;
  const scrape = await firecrawlScrape(url, aiErrors);
  if (!scrape.ok) {
    // Facebook is heavily rate-limited and login-walled; explicit Contract
    // v2 best-effort marker. NOT a system failure — INSUFFICIENT_SIGNAL.
    return emptyIntel("facebook", url, "INSUFFICIENT_SIGNAL", aiErrors);
  }
  const md = scrape.markdown;
  const html = scrape.html;

  let rating: number | null = null;
  const ratingM = html.match(/"ratingValue"\s*:\s*"?(\d(?:\.\d)?)"?/i)
    || md.match(/(\d(?:\.\d)?)\s*out of 5/i);
  if (ratingM) rating = clampRating(parseFloat(ratingM[1]));

  let reviewCount: number | null = null;
  const cntM = html.match(/"reviewCount"\s*:\s*"?(\d+)"?/i)
    || md.match(/(\d[\d,]*)\s+reviews?/i);
  if (cntM) reviewCount = clampInt(parseInt(cntM[1].replace(/,/g, ""), 10));

  // Facebook public reviews — even when reachable — usually only render
  // 1-3 truncated snippets without login. We extract whatever is visible.
  const recentReviews: RecentReview[] = [];
  const blocks = md.split(/(?=recommends?\s+|reviews?\s+\w)/i).slice(1, 8);
  for (const block of blocks) {
    const body = block.split(/\n{2,}/)[0].replace(/\s+/g, " ").trim();
    if (body.length < 30) continue;
    recentReviews.push({
      text: body.slice(0, 400),
      rating: null,
      date_iso: null,
      sentiment: null,
    });
  }

  const found = rating !== null || reviewCount !== null || recentReviews.length > 0;
  const state: ExternalState = found
    ? (recentReviews.length > 0 ? "DATA_AVAILABLE" : "DEGRADED")
    : "INSUFFICIENT_SIGNAL";

  return {
    platform: "facebook",
    url,
    found,
    state,
    overall_rating: rating,
    total_review_count: reviewCount,
    recent_reviews: recentReviews,
    themes: [],
    review_velocity: computeVelocity(recentReviews),
    ai_errors: aiErrors,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────
function emptyIntel(
  platform: PlatformId,
  url: string,
  state: ExternalState,
  aiErrors: string[],
): PlatformReviewIntel {
  return {
    platform,
    url,
    found: false,
    state,
    overall_rating: null,
    total_review_count: null,
    recent_reviews: [],
    themes: [],
    review_velocity: { last_30d: null, last_90d: null },
    ai_errors: aiErrors,
  };
}

function normaliseDate(raw: string): string | null {
  if (!raw) return null;
  // ISO already
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  // "January 15, 2026" / "15 January 2026"
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const m1 = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m1) {
    const mo = months[m1[2].toLowerCase().slice(0, 3)];
    if (mo) return `${m1[3]}-${mo}-${String(parseInt(m1[1], 10)).padStart(2, "0")}`;
  }
  const m2 = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m2) {
    const mo = months[m2[1].toLowerCase().slice(0, 3)];
    if (mo) return `${m2[3]}-${mo}-${String(parseInt(m2[2], 10)).padStart(2, "0")}`;
  }
  return null;
}

function computeVelocity(reviews: RecentReview[]): { last_30d: number | null; last_90d: number | null } {
  const dated = reviews.filter((r) => r.date_iso).map((r) => r.date_iso!);
  if (dated.length === 0) return { last_30d: null, last_90d: null };
  const now = Date.now();
  let count30 = 0, count90 = 0;
  for (const d of dated) {
    const t = Date.parse(d);
    if (!Number.isFinite(t)) continue;
    const ageDays = (now - t) / 86_400_000;
    if (ageDays <= 30) count30 += 1;
    if (ageDays <= 90) count90 += 1;
  }
  return { last_30d: count30, last_90d: count90 };
}

// ── LLM Trinity batch sentiment + theme extraction ──────────────────────
//
// Each platform's reviews are batched into ONE LLM call (not one call
// per review). Sentiment classifier requests structured JSON output:
//   [{"id": int, "sentiment": "positive"|"negative"|"neutral", "themes": ["..."]}]
//
// Then a corpus-wide theme synthesis call extracts top 5 themes with
// example quotes. Quorum: at least 1 of 3 providers must succeed.

const SENTIMENT_SYSTEM_PROMPT =
  "You are a customer-review sentiment classifier for an Australian SMB " +
  "intelligence platform. Classify each review as one of: positive, " +
  "negative, neutral. Also extract up to 3 themes the reviewer mentions " +
  "(e.g. 'slow service', 'overpriced', 'friendly staff', 'great quality'). " +
  "Themes must be observed in the review text — do not invent. Return " +
  "ONLY a JSON array of objects with shape " +
  "{\"id\": <int>, \"sentiment\": <\"positive\"|\"negative\"|\"neutral\">, " +
  "\"themes\": [<string>, ...]}. No prose. No markdown fences.";

const THEMES_SYSTEM_PROMPT =
  "You are a customer-review theme synthesiser for an Australian SMB " +
  "intelligence platform. From the supplied corpus of customer reviews " +
  "(across Google Maps, Trustpilot, ProductReview, Yelp, Facebook), " +
  "extract the top 5 most-mentioned themes. Each theme MUST cite ONE " +
  "verbatim quote from the corpus as evidence. Themes must be derived " +
  "from the text — never generic. Return ONLY a JSON array of objects " +
  "with shape " +
  "{\"theme\": <string>, \"example_quote\": <string verbatim>, " +
  "\"platforms\": [<\"google_maps\"|\"trustpilot\"|\"productreview_au\"|\"yelp\"|\"facebook\">, ...]}. " +
  "No prose. No markdown fences.";

async function callOpenAI(
  systemMsg: string,
  userMsg: string,
): Promise<{ ok: boolean; text: string; error?: string }> {
  if (!OPENAI_API_KEY) return { ok: false, text: "", error: "openai_unconfigured" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
        temperature: 0.2,
        max_tokens: 2200,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, text: "", error: `openai_http_${res.status}` };
    const data = await res.json();
    return { ok: true, text: data?.choices?.[0]?.message?.content || "" };
  } catch (e) {
    return { ok: false, text: "", error: `openai_exception_${String(e).slice(0, 60)}` };
  }
}

async function callAnthropic(
  systemMsg: string,
  userMsg: string,
): Promise<{ ok: boolean; text: string; error?: string }> {
  if (!ANTHROPIC_API_KEY) return { ok: false, text: "", error: "anthropic_unconfigured" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        system: systemMsg,
        messages: [{ role: "user", content: userMsg }],
        max_tokens: 2200,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, text: "", error: `anthropic_http_${res.status}` };
    const data = await res.json();
    return { ok: true, text: data?.content?.[0]?.text || "" };
  } catch (e) {
    return { ok: false, text: "", error: `anthropic_exception_${String(e).slice(0, 60)}` };
  }
}

async function callGemini(
  systemMsg: string,
  userMsg: string,
): Promise<{ ok: boolean; text: string; error?: string }> {
  if (!GOOGLE_API_KEY) return { ok: false, text: "", error: "gemini_unconfigured" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemMsg}\n\n${userMsg}` }] }],
        generationConfig: { maxOutputTokens: 2200, temperature: 0.2 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, text: "", error: `gemini_http_${res.status}` };
    const data = await res.json();
    return { ok: true, text: data?.candidates?.[0]?.content?.parts?.[0]?.text || "" };
  } catch (e) {
    return { ok: false, text: "", error: `gemini_exception_${String(e).slice(0, 60)}` };
  }
}

// Trinity quorum: try all 3 in parallel, return first non-empty.
async function trinityQuorum(
  systemMsg: string,
  userMsg: string,
  aiErrors: string[],
): Promise<string> {
  const [oa, an, gm] = await Promise.allSettled([
    callOpenAI(systemMsg, userMsg),
    callAnthropic(systemMsg, userMsg),
    callGemini(systemMsg, userMsg),
  ]);
  for (const result of [oa, an, gm]) {
    if (result.status !== "fulfilled") continue;
    const v = result.value;
    if (v.ok && v.text) return v.text;
    if (!v.ok && v.error) aiErrors.push(`llm_${v.error}`);
  }
  aiErrors.push("llm_trinity_total_failure");
  return "";
}

async function classifySentimentBatch(
  platform: PlatformId,
  reviews: RecentReview[],
  aiErrors: string[],
): Promise<RecentReview[]> {
  if (reviews.length === 0) return reviews;
  // Build a numbered list. Truncate per-review text to keep tokens reasonable.
  const items = reviews.map((r, idx) => `${idx}: ${r.text.slice(0, 350)}`).join("\n---\n");
  const userMsg =
    `Platform: ${platform}\nClassify each review below. Return JSON array.\n\n${items}`;
  const text = await trinityQuorum(SENTIMENT_SYSTEM_PROMPT, userMsg, aiErrors);
  if (!text) {
    // All Trinity providers failed. Mark sentiment as null (not "neutral" —
    // that would be a silent failure per Contract v2).
    return reviews.map((r) => ({ ...r, sentiment: null }));
  }
  const parsed = safeJsonParse(text);
  // Accept either {results: [...]} or [...] shape (LLMs vary).
  const arr: any[] = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed?.results) ? parsed.results
       : Array.isArray(parsed?.data) ? parsed.data : []);
  if (!arr.length) {
    aiErrors.push("llm_sentiment_parse_failed");
    return reviews.map((r) => ({ ...r, sentiment: null }));
  }
  const byId = new Map<number, { sentiment: string; themes: string[] }>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const id = Number(item.id);
    if (!Number.isInteger(id) || id < 0) continue;
    const sent = String(item.sentiment || "").toLowerCase();
    if (!["positive", "negative", "neutral"].includes(sent)) continue;
    const themes = Array.isArray(item.themes)
      ? item.themes.filter((t: unknown) => typeof t === "string").slice(0, 3)
      : [];
    byId.set(id, { sentiment: sent, themes });
  }
  return reviews.map((r, idx) => {
    const found = byId.get(idx);
    if (!found) return { ...r, sentiment: null };
    return {
      ...r,
      sentiment: found.sentiment as "positive" | "negative" | "neutral",
    };
  });
}

async function extractCorpusThemes(
  allReviews: Array<{ platform: PlatformId; text: string }>,
  aiErrors: string[],
): Promise<Array<{ theme: string; example_quote: string; platforms: PlatformId[] }>> {
  if (allReviews.length === 0) return [];
  const corpus = allReviews
    .slice(0, 60) // Cap corpus size
    .map((r) => `[${r.platform}] ${r.text.slice(0, 280)}`)
    .join("\n---\n");
  const userMsg = `Corpus of customer reviews (one per separator). Extract top 5 themes.\n\n${corpus}`;
  const text = await trinityQuorum(THEMES_SYSTEM_PROMPT, userMsg, aiErrors);
  if (!text) return [];
  const parsed = safeJsonParse(text);
  const arr: any[] = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed?.themes) ? parsed.themes
       : Array.isArray(parsed?.results) ? parsed.results
       : Array.isArray(parsed?.data) ? parsed.data : []);
  if (!arr.length) {
    aiErrors.push("llm_themes_parse_failed");
    return [];
  }
  const validPlatforms: PlatformId[] = ["google_maps", "trustpilot", "productreview_au", "yelp", "facebook"];
  const themes: Array<{ theme: string; example_quote: string; platforms: PlatformId[] }> = [];
  for (const item of arr.slice(0, 5)) {
    if (!item || typeof item !== "object") continue;
    const theme = String(item.theme || "").trim();
    const quote = String(item.example_quote || item.quote || "").trim();
    if (!theme || !quote) continue;
    const plats = Array.isArray(item.platforms)
      ? item.platforms.filter((p: unknown) => validPlatforms.includes(p as PlatformId))
      : [];
    themes.push({
      theme: theme.slice(0, 120),
      example_quote: quote.slice(0, 280),
      platforms: plats as PlatformId[],
    });
  }
  return themes;
}

// ── Aggregation ─────────────────────────────────────────────────────────
function aggregatePlatforms(
  platforms: PlatformReviewIntel[],
  themes: Array<{ theme: string; example_quote: string; platforms: PlatformId[] }>,
): AggregatedReviewIntel {
  // Weighted average rating, weighted by total_review_count per platform.
  const ratings = platforms.filter((p) => p.overall_rating !== null && (p.total_review_count || 0) > 0);
  let weightedAvg: number | null = null;
  let totalReviews = 0;
  if (ratings.length > 0) {
    let weightedSum = 0;
    let weightSum = 0;
    for (const p of ratings) {
      const w = p.total_review_count || 0;
      weightedSum += (p.overall_rating || 0) * w;
      weightSum += w;
    }
    if (weightSum > 0) weightedAvg = Math.round((weightedSum / weightSum) * 10) / 10;
  }
  for (const p of platforms) {
    totalReviews += p.total_review_count || 0;
  }

  // Sentiment distribution from classified reviews.
  let pos = 0, neg = 0, neu = 0, classified = 0;
  for (const p of platforms) {
    for (const r of p.recent_reviews) {
      if (r.sentiment === "positive") { pos += 1; classified += 1; }
      else if (r.sentiment === "negative") { neg += 1; classified += 1; }
      else if (r.sentiment === "neutral") { neu += 1; classified += 1; }
    }
  }
  const dist = {
    positive_pct: classified > 0 ? Math.round((pos / classified) * 100) : 0,
    negative_pct: classified > 0 ? Math.round((neg / classified) * 100) : 0,
    neutral_pct: classified > 0 ? Math.round((neu / classified) * 100) : 0,
  };

  // Velocity totals.
  let v30: number | null = null;
  let v90: number | null = null;
  for (const p of platforms) {
    if (p.review_velocity.last_30d !== null) {
      v30 = (v30 || 0) + p.review_velocity.last_30d;
    }
    if (p.review_velocity.last_90d !== null) {
      v90 = (v90 || 0) + p.review_velocity.last_90d;
    }
  }

  const has_data = weightedAvg !== null || classified > 0 || totalReviews > 0;
  const platformsWithSignal = platforms.filter((p) => p.found).length;
  const state: ExternalState = has_data
    ? (platformsWithSignal >= 2 ? "DATA_AVAILABLE" : "DEGRADED")
    : "INSUFFICIENT_SIGNAL";

  return {
    weighted_avg_rating: weightedAvg,
    total_reviews_cross_platform: totalReviews,
    sentiment_distribution: dist,
    velocity_total: { last_30d: v30, last_90d: v90 },
    themes_top: themes,
    has_data,
    state,
  };
}

// ── HTTP handler ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  // GET = health probe; still requires auth (zero-401 rule applies — no anon
  // bypass — but a service-role probe must succeed).
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ ok: false, state: "DATA_UNAVAILABLE" }),
      { status: auth.status || 401, headers: corsHeaders(req) },
    );
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "customer-reviews-deep",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders(req) },
    );
  }

  const aiErrors: string[] = [];
  const correlation = {
    run_id: req.headers.get("x-calibration-run-id") || null,
    step: req.headers.get("x-calibration-step") || null,
  };

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, state: "DATA_UNAVAILABLE" }),
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const userId: string = body.user_id || "";
  const businessName: string = body.business_name || body.businessName || "";
  const domainRaw: string = body.domain || body.website || "";
  const location: string = body.location || "Australia";
  const productreview_slug: string | undefined = body.productreview_slug || undefined;
  const facebook_handle: string | undefined = body.facebook_handle || undefined;
  const yelp_slug: string | undefined = body.yelp_slug || undefined;

  if (!businessName && !domainRaw) {
    aiErrors.push("missing_business_identifier");
    return new Response(
      JSON.stringify({ ok: false, state: "INSUFFICIENT_SIGNAL" }),
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const domain = deriveDomainSlug(domainRaw);
  const adminSb = (SUPABASE_URL && SERVICE_ROLE_KEY)
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    : null;

  // Fan out per-platform extraction in parallel. Each call captures its own
  // ai_errors and returns a typed PlatformReviewIntel — no exceptions cross
  // this boundary; the contract is preserved per-platform.
  const t0 = Date.now();
  const [gmaps, trustp, prAU, yelp, fb] = await Promise.all([
    extractGoogleMaps(businessName, location).then(async (r) => {
      if (adminSb) {
        await writeTrace(adminSb, {
          user_id: userId || null,
          run_id: correlation.run_id,
          edge_function: "customer-reviews-deep",
          platform: "google_maps",
          provider: "serper",
          operation: "places_lookup",
          ok: r.found,
          http_status: r.found ? 200 : null,
          latency_ms: Date.now() - t0,
          error_code: r.ai_errors[0] || null,
          url_or_input: `${businessName} ${location}`.slice(0, 200),
          recorded_at: new Date().toISOString(),
        });
      }
      return r;
    }),
    extractTrustpilot(domain).then(async (r) => {
      if (adminSb) {
        await writeTrace(adminSb, {
          user_id: userId || null,
          run_id: correlation.run_id,
          edge_function: "customer-reviews-deep",
          platform: "trustpilot",
          provider: "firecrawl",
          operation: "scrape",
          ok: r.found,
          http_status: r.found ? 200 : null,
          latency_ms: Date.now() - t0,
          error_code: r.ai_errors[0] || null,
          url_or_input: r.url,
          recorded_at: new Date().toISOString(),
        });
      }
      return r;
    }),
    extractProductReviewAU(businessName, domain, productreview_slug).then(async (r) => {
      if (adminSb) {
        await writeTrace(adminSb, {
          user_id: userId || null,
          run_id: correlation.run_id,
          edge_function: "customer-reviews-deep",
          platform: "productreview_au",
          provider: "firecrawl",
          operation: "scrape",
          ok: r.found,
          http_status: r.found ? 200 : null,
          latency_ms: Date.now() - t0,
          error_code: r.ai_errors[0] || null,
          url_or_input: r.url,
          recorded_at: new Date().toISOString(),
        });
      }
      return r;
    }),
    extractYelp(businessName, location, yelp_slug).then(async (r) => {
      if (adminSb) {
        await writeTrace(adminSb, {
          user_id: userId || null,
          run_id: correlation.run_id,
          edge_function: "customer-reviews-deep",
          platform: "yelp",
          provider: "firecrawl",
          operation: "scrape",
          ok: r.found,
          http_status: r.found ? 200 : null,
          latency_ms: Date.now() - t0,
          error_code: r.ai_errors[0] || null,
          url_or_input: r.url,
          recorded_at: new Date().toISOString(),
        });
      }
      return r;
    }),
    extractFacebook(facebook_handle || "", businessName).then(async (r) => {
      if (adminSb) {
        await writeTrace(adminSb, {
          user_id: userId || null,
          run_id: correlation.run_id,
          edge_function: "customer-reviews-deep",
          platform: "facebook",
          provider: "firecrawl",
          operation: "scrape_best_effort",
          ok: r.found,
          http_status: r.found ? 200 : null,
          latency_ms: Date.now() - t0,
          error_code: r.ai_errors[0] || null,
          url_or_input: r.url,
          recorded_at: new Date().toISOString(),
        });
      }
      return r;
    }),
  ]);

  const platforms: PlatformReviewIntel[] = [gmaps, trustp, prAU, yelp, fb];

  // Roll per-platform ai_errors into the response-level array (sanitised
  // by name only — calibration.py is the boundary that strips before
  // surfacing to the frontend).
  for (const p of platforms) {
    for (const e of p.ai_errors) aiErrors.push(`${p.platform}:${e}`);
  }

  // LLM Trinity sentiment classification — one call per platform that has
  // recent_reviews. Gathered in parallel.
  const sentimentTasks = platforms.map(async (p) => {
    if (p.recent_reviews.length === 0) return p;
    const platformAiErrors: string[] = [];
    const updated = await classifySentimentBatch(p.platform, p.recent_reviews, platformAiErrors);
    p.recent_reviews = updated;
    p.ai_errors.push(...platformAiErrors);
    if (adminSb) {
      await writeTrace(adminSb, {
        user_id: userId || null,
        run_id: correlation.run_id,
        edge_function: "customer-reviews-deep",
        platform: p.platform,
        provider: "llm_trinity",
        operation: "sentiment_batch",
        ok: platformAiErrors.length === 0,
        http_status: null,
        latency_ms: Date.now() - t0,
        error_code: platformAiErrors[0] || null,
        url_or_input: `${p.recent_reviews.length}_reviews`,
        recorded_at: new Date().toISOString(),
      });
    }
    return p;
  });
  await Promise.all(sentimentTasks);

  for (const p of platforms) {
    for (const e of p.ai_errors) {
      const tag = `${p.platform}:${e}`;
      if (!aiErrors.includes(tag)) aiErrors.push(tag);
    }
  }

  // Corpus-wide theme extraction — one Trinity call across all platforms.
  const corpus = platforms.flatMap((p) =>
    p.recent_reviews.map((r) => ({ platform: p.platform, text: r.text }))
  );
  const themeAiErrors: string[] = [];
  const corpusThemes = await extractCorpusThemes(corpus, themeAiErrors);
  for (const e of themeAiErrors) aiErrors.push(`aggregate:${e}`);
  if (adminSb) {
    await writeTrace(adminSb, {
      user_id: userId || null,
      run_id: correlation.run_id,
      edge_function: "customer-reviews-deep",
      platform: "aggregate",
      provider: "llm_trinity",
      operation: "themes_corpus",
      ok: themeAiErrors.length === 0 && corpusThemes.length > 0,
      http_status: null,
      latency_ms: Date.now() - t0,
      error_code: themeAiErrors[0] || null,
      url_or_input: `${corpus.length}_reviews_in_corpus`,
      recorded_at: new Date().toISOString(),
    });
  }

  // Per-platform themes are populated from the corpus extraction
  // (themes whose `platforms` includes the platform).
  for (const p of platforms) {
    p.themes = corpusThemes
      .filter((t) => t.platforms.includes(p.platform))
      .map((t) => t.theme);
  }

  const aggregated = aggregatePlatforms(platforms, corpusThemes);

  const response: CustomerReviewsDeepResponse = {
    ok: aggregated.has_data || aiErrors.length === 0,
    state: aggregated.state,
    business_name: businessName || domain,
    platforms,
    aggregated,
    ai_errors: aiErrors,
    correlation,
    generated_at: new Date().toISOString(),
  };

  // Aggregate trace row — final write.
  if (adminSb) {
    await writeTrace(adminSb, {
      user_id: userId || null,
      run_id: correlation.run_id,
      edge_function: "customer-reviews-deep",
      platform: "aggregate",
      provider: "llm_trinity",
      operation: "final_aggregation",
      ok: aggregated.has_data,
      http_status: 200,
      latency_ms: Date.now() - t0,
      error_code: aiErrors[0] || null,
      url_or_input: `${platforms.length}_platforms`,
      recorded_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: corsHeaders(req),
  });
});
