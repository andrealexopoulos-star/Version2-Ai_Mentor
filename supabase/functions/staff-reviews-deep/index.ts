// ═══════════════════════════════════════════════════════════════════════════
// STAFF REVIEWS DEEP — Supabase Edge Function (P0 Marjo R2C)
//
// Replaces the snippet-scrape approach in calibration.py:_parse_glassdoor_reviews
// with deep, public-page Firecrawl scraping across Glassdoor (AU+global), Indeed
// (AU+global), Seek (AU-specific), and optional PayScale/Fairwork bonus sources.
//
// Per-platform extraction:
//   - overall rating, total review count, rating distribution
//   - up to N recent reviews with role, date, pros, cons
//   - LLM-classified sentiment per review
//   - LLM-extracted top 3-5 pros + cons themes (with example quotes)
//   - CEO approval %, recommend-to-friend % (Glassdoor only)
//
// Cross-platform aggregation:
//   - weighted_overall_rating (by review count)
//   - total_staff_reviews_cross_platform
//   - cross_platform_themes (pros+cons)
//   - trend_30d_vs_90d (improving|stable|declining|insufficient_data)
//   - employer_brand_health_score (0-100)
//
// Discovery: when slugs/EIDs not provided, derive via Serper.dev Google search
// (already wired in BIQc — same key as backend/core/helpers.py).
//
// Contract v2 sanitised:
//   - external response NEVER names suppliers (Firecrawl / OpenAI / Serper)
//   - external errors map to {DATA_AVAILABLE,DATA_UNAVAILABLE,INSUFFICIENT_SIGNAL,
//     PROCESSING,DEGRADED}; full internal detail kept in ai_errors[]
//
// Andreas constraint: NO new keys / accounts. Re-uses FIRECRAWL_API_KEY,
// SERPER_API_KEY, OPENAI_API_KEY (Trinity-anchored).
//
// Deploy: supabase functions deploy staff-reviews-deep --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { verifyAuth, enforceUserOwnership } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { recordUsage } from "../_shared/metering.ts";

const FIRECRAWL_API_KEY = (Deno.env.get("FIRECRAWL_API_KEY") || "").trim();
const SERPER_API_KEY = (Deno.env.get("SERPER_API_KEY") || "").trim();
const OPENAI_API_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();
const ANTHROPIC_API_KEY = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
const GOOGLE_API_KEY = (Deno.env.get("GOOGLE_API_KEY") || "").trim();

const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o";
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3-pro-preview";
const LLM_TIMEOUT_MS = 35000;

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

type PlatformId = "glassdoor" | "indeed" | "seek" | "payscale" | "fairwork";

type Sentiment = "positive" | "negative" | "neutral";

type ExternalState =
  | "DATA_AVAILABLE"
  | "DATA_UNAVAILABLE"
  | "INSUFFICIENT_SIGNAL"
  | "PROCESSING"
  | "DEGRADED";

interface RatingDistribution {
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
}

interface RecentReview {
  text: string;
  rating: number | null;
  role?: string;
  date_iso: string | null;
  pros?: string;
  cons?: string;
  sentiment: Sentiment;
}

interface PlatformStaffIntel {
  platform: PlatformId;
  url: string;
  found: boolean;
  state: ExternalState;
  overall_rating: number | null;
  total_review_count: number | null;
  rating_distribution: RatingDistribution | null;
  recent_reviews: RecentReview[];
  themes: { pros: string[]; cons: string[] };
  ceo_approval: number | null;
  recommend_to_friend: number | null;
  ai_errors: string[];
}

interface CompetitorStaffBenchmark {
  own: { rating: number | null; reviews: number };
  competitor_avg: { rating: number | null; reviews: number };
  delta: number;
}

interface CrossPlatformAggregation {
  weighted_overall_rating: number | null;
  total_staff_reviews_cross_platform: number;
  cross_platform_themes: { pros: string[]; cons: string[] };
  trend_30d_vs_90d: "improving" | "stable" | "declining" | "insufficient_data";
  employer_brand_health_score: number;
  competitor_employer_benchmark: CompetitorStaffBenchmark | null;
}

interface StaffReviewsDeepResponse {
  ok: boolean;
  state: ExternalState;
  business_name: string;
  platforms: PlatformStaffIntel[];
  aggregation: CrossPlatformAggregation;
  ai_errors: string[];
  correlation: { run_id: string | null; step: string | null };
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function slugifyName(name: string): string {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function deriveStateFromIntel(p: Pick<PlatformStaffIntel, "found" | "overall_rating" | "recent_reviews" | "ai_errors">): ExternalState {
  if (p.found && (p.overall_rating !== null || p.recent_reviews.length > 0)) {
    return "DATA_AVAILABLE";
  }
  if (p.ai_errors.length > 0 && !p.found) {
    return "DATA_UNAVAILABLE";
  }
  if (p.found && p.overall_rating === null && p.recent_reviews.length === 0) {
    return "INSUFFICIENT_SIGNAL";
  }
  return "DATA_UNAVAILABLE";
}

function emptyDistribution(): RatingDistribution {
  return { one: 0, two: 0, three: 0, four: 0, five: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Strip HTML, collapse whitespace, cap length
function cleanText(raw: string, maxLen = 800): string {
  return (raw || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// ───────────────────────────────────────────────────────────────────────────
// Firecrawl scrape (markdown)
// ───────────────────────────────────────────────────────────────────────────

async function firecrawlScrape(
  url: string,
  aiErrors: string[],
): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    aiErrors.push("scrape_provider_unavailable");
    return null;
  }
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 25000,
      }),
    });
    if (!res.ok) {
      aiErrors.push(`scrape_http_${res.status}_${url.slice(0, 60)}`);
      return null;
    }
    const payload = await res.json();
    const md = String(
      payload?.data?.markdown || payload?.data?.content || "",
    );
    if (md.length < 80) {
      aiErrors.push(`scrape_empty_${url.slice(0, 60)}`);
      return null;
    }
    return md.slice(0, 60_000);
  } catch (err) {
    aiErrors.push(`scrape_error_${String(err).slice(0, 80)}`);
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Serper.dev (Google search) — used to discover slugs/EIDs when not provided.
// ───────────────────────────────────────────────────────────────────────────

interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

async function serperSearch(
  query: string,
  aiErrors: string[],
  num = 5,
): Promise<SerperResult[]> {
  if (!SERPER_API_KEY) {
    aiErrors.push("search_provider_unavailable");
    return [];
  }
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, gl: "au", hl: "en", num }),
    });
    if (!res.ok) {
      aiErrors.push(`search_http_${res.status}`);
      return [];
    }
    const data = await res.json();
    const organic: SerperResult[] = (data?.organic || []).map((r: any) => ({
      title: String(r?.title || ""),
      link: String(r?.link || ""),
      snippet: String(r?.snippet || ""),
    }));
    return organic;
  } catch (err) {
    aiErrors.push(`search_error_${String(err).slice(0, 60)}`);
    return [];
  }
}

// ───────────────────────────────────────────────────────────────────────────
// EID / slug discovery
// ───────────────────────────────────────────────────────────────────────────

interface DiscoveredTargets {
  glassdoor_url: string | null;
  indeed_url: string | null;
  seek_url: string | null;
  payscale_url: string | null;
  fairwork_url: string | null;
}

async function discoverPlatformUrls(
  businessName: string,
  hints: {
    glassdoor_eid?: string;
    indeed_slug?: string;
    seek_slug?: string;
  },
  aiErrors: string[],
): Promise<DiscoveredTargets> {
  const targets: DiscoveredTargets = {
    glassdoor_url: null,
    indeed_url: null,
    seek_url: null,
    payscale_url: null,
    fairwork_url: null,
  };

  // Glassdoor: prefer hint EID, else SerpAPI/Serper lookup
  if (hints.glassdoor_eid) {
    const slug = slugifyName(businessName);
    targets.glassdoor_url = `https://www.glassdoor.com.au/Reviews/${slug}-Reviews-E${hints.glassdoor_eid}.htm`;
  } else {
    const results = await serperSearch(
      `site:glassdoor.com.au "${businessName}" reviews`,
      aiErrors,
      3,
    );
    const hit = results.find((r) => /glassdoor\..+\/Reviews\/.+-E\d+\.htm/i.test(r.link));
    if (hit) {
      targets.glassdoor_url = hit.link;
    } else {
      // Try global glassdoor as secondary
      const glb = await serperSearch(
        `site:glassdoor.com "${businessName}" reviews`,
        aiErrors,
        3,
      );
      const ghit = glb.find((r) => /glassdoor\..+\/Reviews\/.+-E\d+\.htm/i.test(r.link));
      if (ghit) targets.glassdoor_url = ghit.link;
    }
  }

  // Indeed: prefer hint slug, else SerpAPI/Serper lookup
  if (hints.indeed_slug) {
    targets.indeed_url = `https://au.indeed.com/cmp/${hints.indeed_slug}/reviews`;
  } else {
    const results = await serperSearch(
      `site:au.indeed.com "${businessName}" reviews`,
      aiErrors,
      3,
    );
    const hit = results.find((r) => /indeed\.com\/cmp\/[^/]+\/reviews/i.test(r.link));
    if (hit) {
      targets.indeed_url = hit.link.split("?")[0];
    } else {
      // Try global indeed
      const glb = await serperSearch(
        `site:indeed.com/cmp "${businessName}" reviews`,
        aiErrors,
        3,
      );
      const ghit = glb.find((r) => /indeed\.com\/cmp\/[^/]+\/reviews/i.test(r.link));
      if (ghit) targets.indeed_url = ghit.link.split("?")[0];
    }
  }

  // Seek: AU-only
  if (hints.seek_slug) {
    targets.seek_url = `https://www.seek.com.au/companies/${hints.seek_slug}/reviews`;
  } else {
    const results = await serperSearch(
      `site:seek.com.au companies "${businessName}" reviews`,
      aiErrors,
      3,
    );
    const hit = results.find((r) => /seek\.com\.au\/companies\/[^/]+/i.test(r.link));
    if (hit) {
      // Normalise to /reviews subpath
      const baseMatch = hit.link.match(/(https:\/\/www\.seek\.com\.au\/companies\/[^/]+)/i);
      if (baseMatch) targets.seek_url = `${baseMatch[1]}/reviews`;
    }
  }

  // Optional bonus: PayScale + Fairwork — only when SerpAPI returns
  const psResults = await serperSearch(
    `site:payscale.com "${businessName}" reviews`,
    aiErrors,
    2,
  );
  const psHit = psResults.find((r) => /payscale\.com.+\/Salary/i.test(r.link) || /payscale\.com.+\/Reviews/i.test(r.link));
  if (psHit) targets.payscale_url = psHit.link;

  const fwResults = await serperSearch(
    `site:fairwork.gov.au "${businessName}"`,
    aiErrors,
    2,
  );
  const fwHit = fwResults.find((r) => /fairwork\.gov\.au/i.test(r.link));
  if (fwHit) targets.fairwork_url = fwHit.link;

  return targets;
}

// ───────────────────────────────────────────────────────────────────────────
// Per-platform extractors (regex + heuristic on Firecrawl markdown)
// ───────────────────────────────────────────────────────────────────────────

function extractGlassdoorMarkdown(md: string): {
  overall_rating: number | null;
  total_review_count: number | null;
  rating_distribution: RatingDistribution | null;
  recent_reviews: RecentReview[];
  ceo_approval: number | null;
  recommend_to_friend: number | null;
} {
  const out = {
    overall_rating: null as number | null,
    total_review_count: null as number | null,
    rating_distribution: null as RatingDistribution | null,
    recent_reviews: [] as RecentReview[],
    ceo_approval: null as number | null,
    recommend_to_friend: null as number | null,
  };

  // Overall rating (e.g. "3.7 ★", "Overall rating 3.7", "3.7 out of 5")
  const ratingMatch = md.match(/(\d\.\d)\s*(?:out of\s*5|\/\s*5|★|stars?)/i)
    || md.match(/Overall\s+(?:rating|Rating)?\s*:?\s*(\d\.\d)/i);
  if (ratingMatch) {
    const v = parseFloat(ratingMatch[1]);
    if (v > 0 && v <= 5) out.overall_rating = v;
  }

  // Total reviews
  const countMatch = md.match(/(\d[\d,]*)\s*(?:Reviews|reviews|Glassdoor reviews)/i);
  if (countMatch) {
    const n = parseInt(countMatch[1].replace(/,/g, ""), 10);
    if (n > 0 && n < 1_000_000) out.total_review_count = n;
  }

  // Rating distribution: Glassdoor exposes "5 stars" + bar chart numbers, or
  // textual "5 4 3 2 1" with counts. Heuristic — match "(N) % 5 stars" patterns.
  const dist = emptyDistribution();
  const distRegex = /(\d+)\s*%?\s*(?:stars?\s*)?(?:5|four|four star)/i; // weak fallback
  // More reliable: structured "5 ★ 234"-style lines.
  for (const m of md.matchAll(/(?:^|\n)\s*([1-5])\s*(?:star|★)?\s*[\|:\-—]?\s*(\d[\d,]*)\b/gi)) {
    const star = parseInt(m[1], 10);
    const n = parseInt(m[2].replace(/,/g, ""), 10);
    if (n >= 0 && star >= 1 && star <= 5) {
      const key = (["one", "two", "three", "four", "five"] as const)[star - 1];
      if (dist[key] === 0) dist[key] = n;
    }
  }
  const distSum = dist.one + dist.two + dist.three + dist.four + dist.five;
  if (distSum > 0) out.rating_distribution = dist;

  // CEO approval %, Recommend to a friend %
  const ceoMatch = md.match(/CEO\s+(?:approval|Approval)\s*:?\s*(\d{1,3})\s*%/i)
    || md.match(/(\d{1,3})\s*%\s+approve\s+of\s+CEO/i);
  if (ceoMatch) {
    const v = parseInt(ceoMatch[1], 10);
    if (v >= 0 && v <= 100) out.ceo_approval = v;
  }
  const recMatch = md.match(/(\d{1,3})\s*%\s+recommend\s+to\s+a?\s*friend/i)
    || md.match(/Recommend\s+to\s+a?\s*friend\s*:?\s*(\d{1,3})\s*%/i);
  if (recMatch) {
    const v = parseInt(recMatch[1], 10);
    if (v >= 0 && v <= 100) out.recommend_to_friend = v;
  }

  // Recent reviews — look for blocks with "Pros" + "Cons" sections.
  // Glassdoor markdown often emits each review as:
  //   "## Job title — Date"  OR  "Current Employee, Sydney - Sep 2025"
  //   "Pros\n- ..."
  //   "Cons\n- ..."
  const reviewBlocks = md.split(/\n(?=##\s)|\n(?=\*\*Pros\*\*)|\n(?=Pros\b)/i);
  for (const block of reviewBlocks.slice(0, 30)) {
    const prosMatch = block.match(/Pros[\s\S]{0,1200}?(?=Cons\b|$)/i);
    const consMatch = block.match(/Cons[\s\S]{0,1200}?(?=Advice|Helpful|$)/i);
    if (!prosMatch && !consMatch) continue;
    const headerMatch = block.match(/^[#*]*\s*(.{4,200})$/m);
    const dateMatch = block.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+(\d{4})/i)
      || block.match(/(\d{4})-(\d{2})-(\d{2})/);
    const ratingInline = block.match(/(\d\.\d)\s*(?:★|stars?)/i);
    let isoDate: string | null = null;
    if (dateMatch) {
      try {
        const parsed = new Date(dateMatch[0]);
        if (!isNaN(parsed.valueOf())) isoDate = parsed.toISOString();
      } catch { /* ignore */ }
    }
    const proStr = prosMatch ? cleanText(prosMatch[0].replace(/^Pros[:\s]*/i, "")) : "";
    const conStr = consMatch ? cleanText(consMatch[0].replace(/^Cons[:\s]*/i, "")) : "";
    const text = [proStr, conStr].filter(Boolean).join(" | ").slice(0, 800);
    if (!text) continue;
    out.recent_reviews.push({
      text,
      rating: ratingInline ? parseFloat(ratingInline[1]) : null,
      role: headerMatch ? cleanText(headerMatch[1], 120) : "",
      date_iso: isoDate,
      pros: proStr || undefined,
      cons: conStr || undefined,
      sentiment: "neutral", // LLM will reclassify in the next pass
    });
    if (out.recent_reviews.length >= 12) break;
  }

  return out;
}

function extractIndeedMarkdown(md: string): {
  overall_rating: number | null;
  total_review_count: number | null;
  rating_distribution: RatingDistribution | null;
  recent_reviews: RecentReview[];
} {
  const out = {
    overall_rating: null as number | null,
    total_review_count: null as number | null,
    rating_distribution: null as RatingDistribution | null,
    recent_reviews: [] as RecentReview[],
  };

  const ratingMatch = md.match(/(\d\.\d)\s*(?:out of\s*5|\/\s*5|stars?|★)/i);
  if (ratingMatch) {
    const v = parseFloat(ratingMatch[1]);
    if (v > 0 && v <= 5) out.overall_rating = v;
  }

  const countMatch = md.match(/(\d[\d,]*)\s*(?:reviews?)/i);
  if (countMatch) {
    const n = parseInt(countMatch[1].replace(/,/g, ""), 10);
    if (n > 0 && n < 1_000_000) out.total_review_count = n;
  }

  const dist = emptyDistribution();
  for (const m of md.matchAll(/(?:^|\n)\s*([1-5])\s*(?:star|★)?\s*[\|:\-—]?\s*(\d[\d,]*)\b/gi)) {
    const star = parseInt(m[1], 10);
    const n = parseInt(m[2].replace(/,/g, ""), 10);
    if (n >= 0 && star >= 1 && star <= 5) {
      const key = (["one", "two", "three", "four", "five"] as const)[star - 1];
      if (dist[key] === 0) dist[key] = n;
    }
  }
  const distSum = dist.one + dist.two + dist.three + dist.four + dist.five;
  if (distSum > 0) out.rating_distribution = dist;

  // Indeed reviews are typically labelled as "Productive workplace" or similar
  // headlines, then a paragraph, then meta line "Reviewer Title (City) - Date"
  const blocks = md.split(/\n(?=##\s)|\n(?=\*\*[A-Z])/);
  for (const block of blocks.slice(0, 30)) {
    const text = cleanText(block);
    if (text.length < 60) continue;
    const dateMatch = block.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+(\d{4})/i);
    const ratingInline = block.match(/(\d\.\d)\s*(?:★|stars?|out of 5)/i);
    const roleMatch = block.match(/^([^\n]{4,80})\s*[\(-]/);
    let isoDate: string | null = null;
    if (dateMatch) {
      try {
        const parsed = new Date(dateMatch[0]);
        if (!isNaN(parsed.valueOf())) isoDate = parsed.toISOString();
      } catch { /* ignore */ }
    }
    out.recent_reviews.push({
      text: text.slice(0, 800),
      rating: ratingInline ? parseFloat(ratingInline[1]) : null,
      role: roleMatch ? cleanText(roleMatch[1], 120) : "",
      date_iso: isoDate,
      sentiment: "neutral",
    });
    if (out.recent_reviews.length >= 12) break;
  }

  return out;
}

function extractSeekMarkdown(md: string): {
  overall_rating: number | null;
  total_review_count: number | null;
  rating_distribution: RatingDistribution | null;
  recent_reviews: RecentReview[];
} {
  const out = {
    overall_rating: null as number | null,
    total_review_count: null as number | null,
    rating_distribution: null as RatingDistribution | null,
    recent_reviews: [] as RecentReview[],
  };

  const ratingMatch = md.match(/(\d\.\d)\s*(?:out of\s*5|\/\s*5|stars?|★)/i);
  if (ratingMatch) {
    const v = parseFloat(ratingMatch[1]);
    if (v > 0 && v <= 5) out.overall_rating = v;
  }

  const countMatch = md.match(/(\d[\d,]*)\s*reviews?/i);
  if (countMatch) {
    const n = parseInt(countMatch[1].replace(/,/g, ""), 10);
    if (n > 0 && n < 1_000_000) out.total_review_count = n;
  }

  // Seek reviews: "## What I love" / "## What could be improved" cadence,
  // each review block has a date in MMM YYYY.
  const blocks = md.split(/\n(?=##\s)/);
  for (const block of blocks.slice(0, 30)) {
    const text = cleanText(block);
    if (text.length < 60) continue;
    const ratingInline = block.match(/(\d\.\d)\s*(?:★|stars?|out of 5)/i);
    const dateMatch = block.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*\d{0,2},?\s*(\d{4})/i);
    let isoDate: string | null = null;
    if (dateMatch) {
      try {
        const parsed = new Date(dateMatch[0]);
        if (!isNaN(parsed.valueOf())) isoDate = parsed.toISOString();
      } catch { /* ignore */ }
    }
    const lovedMatch = block.match(/(?:What I love|Pros|The good)[\s\S]{0,800}?(?=What|Cons|$)/i);
    const improvedMatch = block.match(/(?:What could be improved|Cons|The bad)[\s\S]{0,800}?(?=Helpful|Reply|$)/i);
    out.recent_reviews.push({
      text: text.slice(0, 800),
      rating: ratingInline ? parseFloat(ratingInline[1]) : null,
      role: "",
      date_iso: isoDate,
      pros: lovedMatch ? cleanText(lovedMatch[0]) : undefined,
      cons: improvedMatch ? cleanText(improvedMatch[0]) : undefined,
      sentiment: "neutral",
    });
    if (out.recent_reviews.length >= 12) break;
  }

  return out;
}

// LLM sentiment + theme extraction — Trinity quorum (P0 Marjo F14)
// ───────────────────────────────────────────────────────────────────────────
//
// 2026-05-04: replaced single-provider OpenAI call with the same
// Promise.allSettled Trinity-quorum pattern R2B's customer-reviews-deep uses
// (supabase/functions/customer-reviews-deep/index.ts:865-1015). Single LLM
// = single point of failure; staff sentiment + themes are critical for the
// "world-class employer brand intelligence" claim, so OpenAI degrading at
// 4am AEST cannot zero out an entire scan.
//
// Behaviour:
//   * All 3 providers (OpenAI, Anthropic, Gemini) are called in parallel
//     via Promise.allSettled — none can stall the others.
//   * Result iteration order is OpenAI → Anthropic → Gemini, so OpenAI
//     remains de-facto primary (its result is consumed first when valid).
//   * First non-empty fulfilled result wins; the others are best-effort
//     and their errors are sanitised into ai_errors[] internally.
//   * If all 3 fail, ai_errors gets `llm_trinity_total_failure` and the
//     callers (classifySentimentBatch, extractThemesAcrossPlatforms,
//     extractPerPlatformThemes) cope by returning their `null` / empty
//     fallback shape — zero-401 + Contract v2 preserved (no leak, no
//     silent success, the cross-platform aggregation downgrades to
//     INSUFFICIENT_SIGNAL via deriveStateFromIntel).
//
// Strict no-supplier-leak: ai_errors strings remain opaque codes like
// `llm_openai_unconfigured` / `llm_anthropic_http_429` / `llm_gemini_exception_…`.
// They are NEVER surfaced externally (see test_no_supplier_leak_in_errors_contract_v2
// which asserts the calibration boundary strips them before the frontend).
// ───────────────────────────────────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ ok: boolean; text: string; error?: string; tokens?: { input: number; output: number; cached: number } }> {
  if (!OPENAI_API_KEY) return { ok: false, text: "", error: "openai_unconfigured" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2400,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, text: "", error: `openai_http_${res.status}` };
    const data = await res.json();
    const usage = data.usage || {};
    return {
      ok: true,
      text: String(data?.choices?.[0]?.message?.content || ""),
      tokens: {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0,
        cached: usage.prompt_tokens_details?.cached_tokens || 0,
      },
    };
  } catch (e) {
    return { ok: false, text: "", error: `openai_exception_${String(e).slice(0, 60)}` };
  }
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ ok: boolean; text: string; error?: string; tokens?: { input: number; output: number; cached: number } }> {
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
        model: ANTHROPIC_MODEL,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 2400,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, text: "", error: `anthropic_http_${res.status}` };
    const data = await res.json();
    const usage = data?.usage || {};
    return {
      ok: true,
      text: String(data?.content?.[0]?.text || ""),
      tokens: {
        input: usage.input_tokens || 0,
        output: usage.output_tokens || 0,
        cached: usage.cache_read_input_tokens || 0,
      },
    };
  } catch (e) {
    return { ok: false, text: "", error: `anthropic_exception_${String(e).slice(0, 60)}` };
  }
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ ok: boolean; text: string; error?: string; tokens?: { input: number; output: number; cached: number } }> {
  if (!GOOGLE_API_KEY) return { ok: false, text: "", error: "gemini_unconfigured" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { maxOutputTokens: 2400, temperature: 0.2 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, text: "", error: `gemini_http_${res.status}` };
    const data = await res.json();
    const usage = data?.usageMetadata || {};
    return {
      ok: true,
      text: String(data?.candidates?.[0]?.content?.parts?.[0]?.text || ""),
      tokens: {
        input: usage.promptTokenCount || 0,
        output: usage.candidatesTokenCount || 0,
        cached: usage.cachedContentTokenCount || 0,
      },
    };
  } catch (e) {
    return { ok: false, text: "", error: `gemini_exception_${String(e).slice(0, 60)}` };
  }
}

// Trinity quorum: try all 3 providers in parallel, return first non-empty.
// Iteration order is OpenAI → Anthropic → Gemini so OpenAI remains primary
// when healthy (its result is consumed first). Returns the raw text plus
// which provider+model produced it (for usage_ledger metering).
async function trinityQuorum(
  systemPrompt: string,
  userPrompt: string,
  aiErrors: string[],
): Promise<{
  text: string;
  provider: "openai" | "anthropic" | "gemini" | null;
  model: string | null;
  tokens: { input: number; output: number; cached: number };
}> {
  const [oa, an, gm] = await Promise.allSettled([
    callOpenAI(systemPrompt, userPrompt),
    callAnthropic(systemPrompt, userPrompt),
    callGemini(systemPrompt, userPrompt),
  ]);
  const ordered: Array<{
    res: PromiseSettledResult<{ ok: boolean; text: string; error?: string; tokens?: { input: number; output: number; cached: number } }>;
    provider: "openai" | "anthropic" | "gemini";
    model: string;
  }> = [
    { res: oa, provider: "openai", model: OPENAI_MODEL },
    { res: an, provider: "anthropic", model: ANTHROPIC_MODEL },
    { res: gm, provider: "gemini", model: GEMINI_MODEL },
  ];
  // First pass — accept any successful non-empty text in priority order.
  for (const item of ordered) {
    if (item.res.status !== "fulfilled") continue;
    const v = item.res.value;
    if (v.ok && v.text && v.text.trim()) {
      return {
        text: v.text,
        provider: item.provider,
        model: item.model,
        tokens: v.tokens || { input: 0, output: 0, cached: 0 },
      };
    }
  }
  // No success — record sanitised provider errors for internal diagnostics
  // (these never reach the external response per Contract v2; the
  // calibration boundary strips ai_errors before frontend exposure).
  for (const item of ordered) {
    if (item.res.status === "rejected") {
      aiErrors.push(`llm_${item.provider}_rejected`);
    } else if (!item.res.value.ok) {
      aiErrors.push(`llm_${item.provider}_${item.res.value.error || "unknown"}`);
    } else {
      aiErrors.push(`llm_${item.provider}_empty_response`);
    }
  }
  aiErrors.push("llm_trinity_total_failure");
  return { text: "", provider: null, model: null, tokens: { input: 0, output: 0, cached: 0 } };
}

async function llmJsonExtract(
  systemPrompt: string,
  userPrompt: string,
  aiErrors: string[],
  userId?: string,
  feature = "staff_reviews_deep",
): Promise<any | null> {
  // P0 Marjo F14 (2026-05-04): Trinity quorum — all 3 providers tried in
  // parallel; first non-empty wins (OpenAI primary by iteration order).
  const { text, provider, model, tokens } = await trinityQuorum(systemPrompt, userPrompt, aiErrors);
  if (!text) return null;

  // Provider trace via usage_ledger — same wiring as the single-provider
  // path used to do, but now records which provider actually answered so
  // ops can see Trinity health (recordUsage tolerates absent provider).
  if (userId && model) {
    recordUsage({
      userId,
      model,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      cachedInputTokens: tokens.cached,
      feature,
      action: provider ? `${feature}_${provider}` : feature,
    });
  }

  let raw = text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "").trim();
  }
  try {
    return JSON.parse(raw);
  } catch {
    aiErrors.push("ai_parse_error");
    return null;
  }
}

async function classifySentimentBatch(
  reviews: RecentReview[],
  aiErrors: string[],
  userId?: string,
): Promise<RecentReview[]> {
  if (reviews.length === 0) return reviews;
  const systemPrompt =
    "You are a workplace-review sentiment classifier. " +
    "For each input review object, return the same id with sentiment in {positive, negative, neutral}. " +
    "Output ONLY JSON: {\"results\":[{\"id\":N,\"sentiment\":\"positive|negative|neutral\"}]}.";
  const indexed = reviews.map((r, i) => ({
    id: i,
    text: r.text.slice(0, 600),
    pros: r.pros?.slice(0, 300) || "",
    cons: r.cons?.slice(0, 300) || "",
  }));
  const userPrompt = `Classify these ${indexed.length} reviews:\n${JSON.stringify(indexed)}`;
  const parsed = await llmJsonExtract(
    systemPrompt,
    userPrompt,
    aiErrors,
    userId,
    "staff_reviews_sentiment",
  );
  if (!parsed || !Array.isArray(parsed.results)) return reviews;
  const result = [...reviews];
  for (const item of parsed.results) {
    const id = Number(item?.id);
    const sentiment = String(item?.sentiment || "").toLowerCase();
    if (Number.isInteger(id) && id >= 0 && id < result.length) {
      if (sentiment === "positive" || sentiment === "negative" || sentiment === "neutral") {
        result[id] = { ...result[id], sentiment };
      }
    }
  }
  return result;
}

async function extractThemesAcrossPlatforms(
  allReviews: Array<{ platform: string; text: string; pros?: string; cons?: string }>,
  aiErrors: string[],
  userId?: string,
): Promise<{ pros: string[]; cons: string[] }> {
  if (allReviews.length === 0) return { pros: [], cons: [] };
  const systemPrompt =
    "You are an employer-brand intelligence analyst. " +
    "From the provided employee reviews, extract the TOP 5 positive themes and TOP 5 negative themes. " +
    "Each theme must be ≤12 words, paraphrasing recurring patterns ONLY. " +
    "Reference real review wording — no Marketing-101 fluff (e.g. NOT 'great culture'). " +
    "Output ONLY JSON: {\"pros\":[\"theme — short example quote\",...],\"cons\":[\"theme — short example quote\",...]}";
  const corpus = allReviews
    .slice(0, 60)
    .map((r) => `[${r.platform}] ${r.text.slice(0, 400)}`)
    .join("\n");
  const userPrompt = `Reviews:\n${corpus}\n\nReturn JSON only.`;
  const parsed = await llmJsonExtract(
    systemPrompt,
    userPrompt,
    aiErrors,
    userId,
    "staff_reviews_themes",
  );
  const pros = Array.isArray(parsed?.pros)
    ? parsed.pros.filter((s: any) => typeof s === "string").slice(0, 5)
    : [];
  const cons = Array.isArray(parsed?.cons)
    ? parsed.cons.filter((s: any) => typeof s === "string").slice(0, 5)
    : [];
  return { pros, cons };
}

async function extractPerPlatformThemes(
  reviews: RecentReview[],
  platform: string,
  aiErrors: string[],
  userId?: string,
): Promise<{ pros: string[]; cons: string[] }> {
  if (reviews.length === 0) return { pros: [], cons: [] };
  const systemPrompt =
    `You are an employer-brand analyst. Extract TOP 3 pros and TOP 3 cons themes ` +
    `from these ${platform} employee reviews. Each theme ≤10 words. Reference real wording. ` +
    `Output ONLY JSON: {"pros":["..."],"cons":["..."]}`;
  const corpus = reviews
    .slice(0, 30)
    .map((r) => r.text.slice(0, 300))
    .join("\n---\n");
  const userPrompt = `Reviews:\n${corpus}\n\nReturn JSON only.`;
  const parsed = await llmJsonExtract(
    systemPrompt,
    userPrompt,
    aiErrors,
    userId,
    "staff_reviews_platform_themes",
  );
  const pros = Array.isArray(parsed?.pros)
    ? parsed.pros.filter((s: any) => typeof s === "string").slice(0, 5)
    : [];
  const cons = Array.isArray(parsed?.cons)
    ? parsed.cons.filter((s: any) => typeof s === "string").slice(0, 5)
    : [];
  return { pros, cons };
}

// ───────────────────────────────────────────────────────────────────────────
// Trend detection + employer-brand health score
// ───────────────────────────────────────────────────────────────────────────

function computeTrend30vs90(
  reviews: RecentReview[],
): "improving" | "stable" | "declining" | "insufficient_data" {
  const dated = reviews
    .map((r) => ({
      date: r.date_iso ? new Date(r.date_iso) : null,
      sentiment: r.sentiment,
      rating: r.rating,
    }))
    .filter((r) => r.date && !isNaN(r.date.valueOf()));
  if (dated.length < 4) return "insufficient_data";
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const last30 = dated.filter((r) => now - r.date!.valueOf() <= 30 * day);
  const last90 = dated.filter((r) => now - r.date!.valueOf() <= 90 * day);
  if (last30.length === 0 || last90.length === 0) return "insufficient_data";

  const score = (set: typeof dated): number => {
    let s = 0;
    let n = 0;
    for (const r of set) {
      if (r.rating !== null && r.rating !== undefined) {
        s += r.rating;
        n += 1;
      } else {
        s += r.sentiment === "positive" ? 4 : r.sentiment === "negative" ? 2 : 3;
        n += 1;
      }
    }
    return n > 0 ? s / n : 0;
  };
  const recent = score(last30);
  const baseline = score(last90);
  if (recent === 0 || baseline === 0) return "insufficient_data";
  const delta = recent - baseline;
  if (delta > 0.2) return "improving";
  if (delta < -0.2) return "declining";
  return "stable";
}

function computeEmployerBrandHealthScore(
  weighted_rating: number | null,
  total_reviews: number,
  reviews: RecentReview[],
): number {
  if (weighted_rating === null && total_reviews === 0 && reviews.length === 0) return 0;
  // Component 1: rating-derived (0-50)
  const ratingComponent = weighted_rating !== null
    ? clamp((weighted_rating / 5) * 50, 0, 50)
    : 0;
  // Component 2: review velocity / corpus presence (0-25)
  // Threshold: 50+ reviews → full 25; scaled below.
  const velocityComponent = clamp(Math.log10(Math.max(1, total_reviews + 1)) * 12.5, 0, 25);
  // Component 3: sentiment ratio (0-25)
  const totalClassified = reviews.filter((r) => r.sentiment !== "neutral").length;
  const positive = reviews.filter((r) => r.sentiment === "positive").length;
  const sentimentComponent = totalClassified > 0
    ? clamp((positive / totalClassified) * 25, 0, 25)
    : 0;
  return Math.round(ratingComponent + velocityComponent + sentimentComponent);
}

// ───────────────────────────────────────────────────────────────────────────
// Per-platform pipeline
// ───────────────────────────────────────────────────────────────────────────

async function runGlassdoor(
  url: string | null,
  aiErrors: string[],
  userId?: string,
): Promise<PlatformStaffIntel> {
  const intel: PlatformStaffIntel = {
    platform: "glassdoor",
    url: url || "",
    found: false,
    state: "DATA_UNAVAILABLE",
    overall_rating: null,
    total_review_count: null,
    rating_distribution: null,
    recent_reviews: [],
    themes: { pros: [], cons: [] },
    ceo_approval: null,
    recommend_to_friend: null,
    ai_errors: [],
  };
  if (!url) {
    intel.ai_errors.push("discovery_failed");
    intel.state = deriveStateFromIntel(intel);
    return intel;
  }
  const md = await firecrawlScrape(url, intel.ai_errors);
  if (!md) {
    intel.state = deriveStateFromIntel(intel);
    aiErrors.push(...intel.ai_errors.map((e) => `glassdoor:${e}`));
    return intel;
  }
  const ext = extractGlassdoorMarkdown(md);
  intel.overall_rating = ext.overall_rating;
  intel.total_review_count = ext.total_review_count;
  intel.rating_distribution = ext.rating_distribution;
  intel.recent_reviews = ext.recent_reviews;
  intel.ceo_approval = ext.ceo_approval;
  intel.recommend_to_friend = ext.recommend_to_friend;
  intel.found = ext.overall_rating !== null
    || ext.total_review_count !== null
    || ext.recent_reviews.length > 0;
  if (intel.recent_reviews.length > 0) {
    intel.recent_reviews = await classifySentimentBatch(
      intel.recent_reviews,
      intel.ai_errors,
      userId,
    );
    intel.themes = await extractPerPlatformThemes(
      intel.recent_reviews,
      "glassdoor",
      intel.ai_errors,
      userId,
    );
  }
  intel.state = deriveStateFromIntel(intel);
  aiErrors.push(...intel.ai_errors.map((e) => `glassdoor:${e}`));
  return intel;
}

async function runIndeed(
  url: string | null,
  aiErrors: string[],
  userId?: string,
): Promise<PlatformStaffIntel> {
  const intel: PlatformStaffIntel = {
    platform: "indeed",
    url: url || "",
    found: false,
    state: "DATA_UNAVAILABLE",
    overall_rating: null,
    total_review_count: null,
    rating_distribution: null,
    recent_reviews: [],
    themes: { pros: [], cons: [] },
    ceo_approval: null,
    recommend_to_friend: null,
    ai_errors: [],
  };
  if (!url) {
    intel.ai_errors.push("discovery_failed");
    intel.state = deriveStateFromIntel(intel);
    return intel;
  }
  const md = await firecrawlScrape(url, intel.ai_errors);
  if (!md) {
    intel.state = deriveStateFromIntel(intel);
    aiErrors.push(...intel.ai_errors.map((e) => `indeed:${e}`));
    return intel;
  }
  const ext = extractIndeedMarkdown(md);
  intel.overall_rating = ext.overall_rating;
  intel.total_review_count = ext.total_review_count;
  intel.rating_distribution = ext.rating_distribution;
  intel.recent_reviews = ext.recent_reviews;
  intel.found = ext.overall_rating !== null
    || ext.total_review_count !== null
    || ext.recent_reviews.length > 0;
  if (intel.recent_reviews.length > 0) {
    intel.recent_reviews = await classifySentimentBatch(
      intel.recent_reviews,
      intel.ai_errors,
      userId,
    );
    intel.themes = await extractPerPlatformThemes(
      intel.recent_reviews,
      "indeed",
      intel.ai_errors,
      userId,
    );
  }
  intel.state = deriveStateFromIntel(intel);
  aiErrors.push(...intel.ai_errors.map((e) => `indeed:${e}`));
  return intel;
}

async function runSeek(
  url: string | null,
  aiErrors: string[],
  userId?: string,
): Promise<PlatformStaffIntel> {
  const intel: PlatformStaffIntel = {
    platform: "seek",
    url: url || "",
    found: false,
    state: "DATA_UNAVAILABLE",
    overall_rating: null,
    total_review_count: null,
    rating_distribution: null,
    recent_reviews: [],
    themes: { pros: [], cons: [] },
    ceo_approval: null,
    recommend_to_friend: null,
    ai_errors: [],
  };
  if (!url) {
    intel.ai_errors.push("discovery_failed");
    intel.state = deriveStateFromIntel(intel);
    return intel;
  }
  const md = await firecrawlScrape(url, intel.ai_errors);
  if (!md) {
    intel.state = deriveStateFromIntel(intel);
    aiErrors.push(...intel.ai_errors.map((e) => `seek:${e}`));
    return intel;
  }
  const ext = extractSeekMarkdown(md);
  intel.overall_rating = ext.overall_rating;
  intel.total_review_count = ext.total_review_count;
  intel.rating_distribution = ext.rating_distribution;
  intel.recent_reviews = ext.recent_reviews;
  intel.found = ext.overall_rating !== null
    || ext.total_review_count !== null
    || ext.recent_reviews.length > 0;
  if (intel.recent_reviews.length > 0) {
    intel.recent_reviews = await classifySentimentBatch(
      intel.recent_reviews,
      intel.ai_errors,
      userId,
    );
    intel.themes = await extractPerPlatformThemes(
      intel.recent_reviews,
      "seek",
      intel.ai_errors,
      userId,
    );
  }
  intel.state = deriveStateFromIntel(intel);
  aiErrors.push(...intel.ai_errors.map((e) => `seek:${e}`));
  return intel;
}

async function runBonusPlatform(
  platform: "payscale" | "fairwork",
  url: string | null,
  aiErrors: string[],
): Promise<PlatformStaffIntel> {
  const intel: PlatformStaffIntel = {
    platform,
    url: url || "",
    found: false,
    state: "DATA_UNAVAILABLE",
    overall_rating: null,
    total_review_count: null,
    rating_distribution: null,
    recent_reviews: [],
    themes: { pros: [], cons: [] },
    ceo_approval: null,
    recommend_to_friend: null,
    ai_errors: [],
  };
  if (!url) {
    intel.state = deriveStateFromIntel(intel);
    return intel;
  }
  const md = await firecrawlScrape(url, intel.ai_errors);
  if (!md) {
    intel.state = deriveStateFromIntel(intel);
    aiErrors.push(...intel.ai_errors.map((e) => `${platform}:${e}`));
    return intel;
  }
  // Lightweight extraction — these are bonus signals.
  const ratingMatch = md.match(/(\d\.\d)\s*(?:out of\s*5|\/\s*5|stars?|★)/i);
  if (ratingMatch) {
    const v = parseFloat(ratingMatch[1]);
    if (v > 0 && v <= 5) intel.overall_rating = v;
  }
  const countMatch = md.match(/(\d[\d,]*)\s*(?:reviews?|salary reports)/i);
  if (countMatch) {
    const n = parseInt(countMatch[1].replace(/,/g, ""), 10);
    if (n > 0 && n < 1_000_000) intel.total_review_count = n;
  }
  intel.found = intel.overall_rating !== null || intel.total_review_count !== null;
  intel.state = deriveStateFromIntel(intel);
  return intel;
}

// ───────────────────────────────────────────────────────────────────────────
// Cross-platform aggregation
// ───────────────────────────────────────────────────────────────────────────

async function buildCrossPlatformAggregation(
  platforms: PlatformStaffIntel[],
  competitorAvg: { rating: number | null; reviews: number } | null,
  aiErrors: string[],
  userId?: string,
): Promise<CrossPlatformAggregation> {
  const ratedPlatforms = platforms.filter((p) =>
    p.overall_rating !== null && p.total_review_count !== null && p.total_review_count > 0
  );

  let weighted_rating: number | null = null;
  let total_reviews = 0;
  if (ratedPlatforms.length > 0) {
    const totalWeight = ratedPlatforms.reduce(
      (sum, p) => sum + (p.total_review_count || 0),
      0,
    );
    if (totalWeight > 0) {
      const weightedSum = ratedPlatforms.reduce(
        (sum, p) => sum + (p.overall_rating || 0) * (p.total_review_count || 0),
        0,
      );
      weighted_rating = Math.round((weightedSum / totalWeight) * 10) / 10;
      total_reviews = totalWeight;
    }
  } else {
    // Fallback: simple mean of available ratings
    const ratings = platforms
      .map((p) => p.overall_rating)
      .filter((r): r is number => r !== null);
    if (ratings.length > 0) {
      weighted_rating = Math.round(
        (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10
      ) / 10;
    }
    total_reviews = platforms.reduce((sum, p) => sum + (p.recent_reviews.length || 0), 0);
  }

  const allReviews = platforms.flatMap((p) =>
    p.recent_reviews.map((r) => ({
      platform: p.platform,
      text: r.text,
      pros: r.pros,
      cons: r.cons,
    }))
  );
  const cross_themes = await extractThemesAcrossPlatforms(allReviews, aiErrors, userId);

  // Trend on combined recent reviews
  const allRecent = platforms.flatMap((p) => p.recent_reviews);
  const trend = computeTrend30vs90(allRecent);

  const health = computeEmployerBrandHealthScore(
    weighted_rating,
    total_reviews,
    allRecent,
  );

  let benchmark: CompetitorStaffBenchmark | null = null;
  if (competitorAvg) {
    const ownDelta = (weighted_rating !== null && competitorAvg.rating !== null)
      ? Math.round(((weighted_rating - competitorAvg.rating)) * 10) / 10
      : 0;
    benchmark = {
      own: { rating: weighted_rating, reviews: total_reviews },
      competitor_avg: competitorAvg,
      delta: ownDelta,
    };
  }

  return {
    weighted_overall_rating: weighted_rating,
    total_staff_reviews_cross_platform: total_reviews,
    cross_platform_themes: cross_themes,
    trend_30d_vs_90d: trend,
    employer_brand_health_score: health,
    competitor_employer_benchmark: benchmark,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Persistence + sanitised response shaping
// ───────────────────────────────────────────────────────────────────────────

function deriveAggregateState(platforms: PlatformStaffIntel[]): ExternalState {
  const states = platforms.map((p) => p.state);
  if (states.some((s) => s === "DATA_AVAILABLE")) return "DATA_AVAILABLE";
  if (states.some((s) => s === "DEGRADED")) return "DEGRADED";
  if (states.every((s) => s === "INSUFFICIENT_SIGNAL")) return "INSUFFICIENT_SIGNAL";
  return "DATA_UNAVAILABLE";
}

// ───────────────────────────────────────────────────────────────────────────
// Main handler
// ───────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ ok: false, state: "DATA_UNAVAILABLE", error: auth.error || "Unauthorized" }),
      { status: auth.status || 401, headers: corsHeaders(req) },
    );
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "staff-reviews-deep",
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

  try {
    const body = await req.json().catch(() => ({}));
    const ownership = enforceUserOwnership(auth, body.user_id || null);
    if (!ownership.ok) {
      return new Response(
        JSON.stringify({ ok: false, state: "DATA_UNAVAILABLE", error: ownership.error }),
        { status: ownership.status, headers: corsHeaders(req) },
      );
    }
    const userId = String(body.user_id || auth.userId || "").trim();
    const businessName = String(body.business_name || body.businessName || "").trim();
    const competitorPayload = body.competitor_employer_benchmark || null;

    if (!businessName) {
      return new Response(
        JSON.stringify({ ok: false, state: "DATA_UNAVAILABLE", error: "business_name is required" }),
        { status: 400, headers: corsHeaders(req) },
      );
    }

    const targets = await discoverPlatformUrls(
      businessName,
      {
        glassdoor_eid: body.glassdoor_eid ? String(body.glassdoor_eid) : undefined,
        indeed_slug: body.indeed_slug ? String(body.indeed_slug) : undefined,
        seek_slug: body.seek_slug ? String(body.seek_slug) : undefined,
      },
      aiErrors,
    );

    const [glassdoor, indeed, seek, payscale, fairwork] = await Promise.all([
      runGlassdoor(targets.glassdoor_url, aiErrors, userId),
      runIndeed(targets.indeed_url, aiErrors, userId),
      runSeek(targets.seek_url, aiErrors, userId),
      runBonusPlatform("payscale", targets.payscale_url, aiErrors),
      runBonusPlatform("fairwork", targets.fairwork_url, aiErrors),
    ]);

    const platforms: PlatformStaffIntel[] = [glassdoor, indeed, seek];
    if (payscale.found) platforms.push(payscale);
    if (fairwork.found) platforms.push(fairwork);

    const competitorAvg = (competitorPayload
      && typeof competitorPayload === "object"
      && (typeof competitorPayload.rating === "number" || competitorPayload.rating === null)
      && typeof competitorPayload.reviews === "number")
      ? { rating: competitorPayload.rating, reviews: competitorPayload.reviews }
      : null;
    const aggregation = await buildCrossPlatformAggregation(
      platforms,
      competitorAvg,
      aiErrors,
      userId,
    );

    const aggregateState = deriveAggregateState(platforms);

    // Persist to biqc_insights for cross-surface availability (CMO Report).
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      );
      if (userId && userId !== "service_role") {
        await supabase.from("biqc_insights").upsert(
          {
            user_id: userId,
            staff_intelligence: {
              platforms,
              aggregation,
              business_name: businessName,
              generated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      }
    } catch (persistErr) {
      aiErrors.push(`persistence_warning:${String(persistErr).slice(0, 80)}`);
    }

    const response: StaffReviewsDeepResponse = {
      ok: true,
      state: aggregateState,
      business_name: businessName,
      platforms,
      aggregation,
      ai_errors: aiErrors,
      correlation,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders(req),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        state: "DEGRADED",
        business_name: "",
        platforms: [],
        aggregation: {
          weighted_overall_rating: null,
          total_staff_reviews_cross_platform: 0,
          cross_platform_themes: { pros: [], cons: [] },
          trend_30d_vs_90d: "insufficient_data",
          employer_brand_health_score: 0,
          competitor_employer_benchmark: null,
        },
        ai_errors: [...aiErrors, `handler_error:${String(err).slice(0, 80)}`],
        correlation,
      }),
      { status: 200, headers: corsHeaders(req) },
    );
  }
});
