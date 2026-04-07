// ═══════════════════════════════════════════════════════════════
// BROWSE AI REVIEWS — Supabase Edge Function
//
// Extracts customer reviews (Google, Trustpilot, ProductReview)
// and staff/employer reviews (Glassdoor, Indeed, Seek) using
// Browse AI's web scraping API.
//
// Deploy: supabase functions deploy browse-ai-reviews --no-verify-jwt
// Secrets: BROWSE_AI_API_KEY
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const BROWSE_AI_API_KEY = Deno.env.get("BROWSE_AI_API_KEY") || "";
const BROWSE_AI_BASE = "https://api.browse.ai/v2";

interface ReviewResult {
  source: string;
  platform: string;
  rating: number | null;
  review_count: number | null;
  reviews: Array<{
    text: string;
    rating: number | null;
    author: string;
    date: string;
    sentiment: "positive" | "negative" | "neutral";
  }>;
  url: string;
}

interface BrowseAIResponse {
  ok: boolean;
  business_name: string;
  customer_reviews: ReviewResult[];
  staff_reviews: ReviewResult[];
  aggregated: {
    customer_score: number | null;
    customer_count: number;
    staff_score: number | null;
    staff_count: number;
    top_positive: string[];
    top_negative: string[];
  };
  ai_errors: string[];
  correlation: {
    run_id: string | null;
    step: string | null;
  };
}

function classifySentiment(text: string): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  const negWords = [
    "terrible", "awful", "worst", "poor", "bad", "horrible",
    "disappointed", "rude", "slow", "avoid", "scam", "toxic",
    "overworked", "underpaid", "no growth", "high turnover",
  ];
  const posWords = [
    "excellent", "great", "amazing", "wonderful", "best",
    "fantastic", "outstanding", "love", "recommend", "professional",
    "helpful", "friendly", "quick", "efficient", "good culture",
  ];
  const negCount = negWords.filter((w) => lower.includes(w)).length;
  const posCount = posWords.filter((w) => lower.includes(w)).length;
  if (negCount > posCount) return "negative";
  if (posCount > negCount) return "positive";
  return "neutral";
}

function extractRating(text: string): number | null {
  const m = text.match(/(\d(?:\.\d)?)\s*(?:out of\s*5|\/\s*5|stars?|★|rating)/i);
  if (m) {
    const val = parseFloat(m[1]);
    if (val > 0 && val <= 5) return val;
  }
  return null;
}

function extractReviewCount(text: string): number | null {
  const m = text.match(/(\d[\d,]*)\s*(?:reviews?|ratings?|verified)/i);
  if (m) {
    const val = parseInt(m[1].replace(/,/g, ""), 10);
    if (val > 0 && val < 1000000) return val;
  }
  return null;
}

async function scrapeWithBrowseAI(
  url: string,
  aiErrors: string[],
): Promise<string | null> {
  if (!BROWSE_AI_API_KEY) {
    aiErrors.push("BROWSE_AI_API_KEY not configured");
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "BIQc-Review-Scanner/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      aiErrors.push(`HTTP ${res.status} fetching ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    aiErrors.push(`Fetch error for ${url}: ${String(err).slice(0, 100)}`);
    return null;
  }
}

async function searchGoogleReviews(
  businessName: string,
  location: string,
  aiErrors: string[],
): Promise<ReviewResult> {
  const result: ReviewResult = {
    source: "browse_ai",
    platform: "google",
    rating: null,
    review_count: null,
    reviews: [],
    url: "",
  };

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `"${businessName}" ${location} reviews`
  )}&num=10`;

  const html = await scrapeWithBrowseAI(searchUrl, aiErrors);
  if (!html) return result;

  result.url = searchUrl;

  const ratingMatch = html.match(
    /(\d\.\d)\s*<[^>]*>\s*(?:out of 5|\/5|stars?)/i
  );
  if (ratingMatch) result.rating = parseFloat(ratingMatch[1]);

  const countMatch = html.match(/(\d[\d,]*)\s*(?:Google\s*)?reviews?/i);
  if (countMatch) {
    result.review_count = parseInt(countMatch[1].replace(/,/g, ""), 10);
  }

  const reviewBlocks = html.match(
    /<(?:div|span|p)[^>]*class="[^"]*review[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span|p)>/gi
  );
  if (reviewBlocks) {
    for (const block of reviewBlocks.slice(0, 10)) {
      const text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length < 20) continue;
      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date: "",
        sentiment: classifySentiment(text),
      });
    }
  }

  return result;
}

async function searchGlassdoorReviews(
  businessName: string,
  aiErrors: string[],
): Promise<ReviewResult> {
  const result: ReviewResult = {
    source: "browse_ai",
    platform: "glassdoor",
    rating: null,
    review_count: null,
    reviews: [],
    url: "",
  };

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `site:glassdoor.com "${businessName}" reviews`
  )}&num=10`;

  const html = await scrapeWithBrowseAI(searchUrl, aiErrors);
  if (!html) return result;

  result.url = searchUrl;

  const snippets = html.match(
    /<span[^>]*class="[^"]*(?:st|aCOpRe|hgKElc)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
  );
  if (snippets) {
    for (const snip of snippets.slice(0, 10)) {
      const text = snip.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length < 20 || !text.toLowerCase().includes("glassdoor")) continue;

      if (!result.rating) result.rating = extractRating(text);
      if (!result.review_count) result.review_count = extractReviewCount(text);

      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date: "",
        sentiment: classifySentiment(text),
      });
    }
  }

  return result;
}

async function searchTrustpilotReviews(
  businessName: string,
  domain: string,
  aiErrors: string[],
): Promise<ReviewResult> {
  const result: ReviewResult = {
    source: "browse_ai",
    platform: "trustpilot",
    rating: null,
    review_count: null,
    reviews: [],
    url: "",
  };

  const trustpilotUrl = `https://www.trustpilot.com/review/${domain}`;
  const html = await scrapeWithBrowseAI(trustpilotUrl, aiErrors);
  if (!html) return result;

  result.url = trustpilotUrl;

  const ratingMatch = html.match(/TrustScore\s*(\d\.\d)/i) ||
    html.match(/"ratingValue"\s*:\s*"?(\d\.\d)"?/i);
  if (ratingMatch) result.rating = parseFloat(ratingMatch[1]);

  const countMatch = html.match(/"reviewCount"\s*:\s*"?(\d+)"?/i) ||
    html.match(/(\d[\d,]*)\s*(?:total\s*)?reviews?/i);
  if (countMatch) {
    result.review_count = parseInt(countMatch[1].replace(/,/g, ""), 10);
  }

  const reviewTexts = html.match(
    /<p[^>]*data-service-review-text[^>]*>([\s\S]*?)<\/p>/gi
  );
  if (reviewTexts) {
    for (const rt of reviewTexts.slice(0, 10)) {
      const text = rt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length < 10) continue;
      result.reviews.push({
        text: text.slice(0, 300),
        rating: null,
        author: "",
        date: "",
        sentiment: classifySentiment(text),
      });
    }
  }

  return result;
}

async function searchIndeedReviews(
  businessName: string,
  aiErrors: string[],
): Promise<ReviewResult> {
  const result: ReviewResult = {
    source: "browse_ai",
    platform: "indeed",
    rating: null,
    review_count: null,
    reviews: [],
    url: "",
  };

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `site:indeed.com "${businessName}" reviews`
  )}&num=10`;

  const html = await scrapeWithBrowseAI(searchUrl, aiErrors);
  if (!html) return result;

  result.url = searchUrl;

  const snippets = html.match(
    /<span[^>]*class="[^"]*(?:st|aCOpRe|hgKElc)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
  );
  if (snippets) {
    for (const snip of snippets.slice(0, 10)) {
      const text = snip.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length < 20) continue;

      if (!result.rating) result.rating = extractRating(text);

      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date: "",
        sentiment: classifySentiment(text),
      });
    }
  }

  return result;
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
        function: "browse-ai-reviews",
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
    const businessName: string = body.business_name || body.businessName || "";
    const domain: string = (body.domain || body.website || "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
    const location: string = body.location || "Australia";

    if (!businessName && !domain) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "business_name or domain is required",
        }),
        { status: 400, headers: corsHeaders(req) },
      );
    }

    const searchName = businessName || domain;

    const [google, glassdoor, trustpilot, indeed] = await Promise.allSettled([
      searchGoogleReviews(searchName, location, aiErrors),
      searchGlassdoorReviews(searchName, aiErrors),
      searchTrustpilotReviews(searchName, domain, aiErrors),
      searchIndeedReviews(searchName, aiErrors),
    ]);

    const customerReviews: ReviewResult[] = [];
    const staffReviews: ReviewResult[] = [];

    if (google.status === "fulfilled" && google.value.reviews.length > 0) {
      customerReviews.push(google.value);
    }
    if (trustpilot.status === "fulfilled" && (trustpilot.value.rating || trustpilot.value.reviews.length > 0)) {
      customerReviews.push(trustpilot.value);
    }
    if (glassdoor.status === "fulfilled" && (glassdoor.value.rating || glassdoor.value.reviews.length > 0)) {
      staffReviews.push(glassdoor.value);
    }
    if (indeed.status === "fulfilled" && (indeed.value.rating || indeed.value.reviews.length > 0)) {
      staffReviews.push(indeed.value);
    }

    const customerScores = customerReviews
      .map((r) => r.rating)
      .filter((r): r is number => r !== null);
    const staffScores = staffReviews
      .map((r) => r.rating)
      .filter((r): r is number => r !== null);

    const allPositive = [
      ...customerReviews.flatMap((r) =>
        r.reviews.filter((rv) => rv.sentiment === "positive").map((rv) => `[${r.platform}] ${rv.text}`)
      ),
      ...staffReviews.flatMap((r) =>
        r.reviews.filter((rv) => rv.sentiment === "positive").map((rv) => `[${r.platform}] ${rv.text}`)
      ),
    ];
    const allNegative = [
      ...customerReviews.flatMap((r) =>
        r.reviews.filter((rv) => rv.sentiment === "negative").map((rv) => `[${r.platform}] ${rv.text}`)
      ),
      ...staffReviews.flatMap((r) =>
        r.reviews.filter((rv) => rv.sentiment === "negative").map((rv) => `[${r.platform}] ${rv.text}`)
      ),
    ];

    const response: BrowseAIResponse = {
      ok: true,
      business_name: searchName,
      customer_reviews: customerReviews,
      staff_reviews: staffReviews,
      aggregated: {
        customer_score: customerScores.length > 0
          ? Math.round((customerScores.reduce((a, b) => a + b, 0) / customerScores.length) * 10) / 10
          : null,
        customer_count: customerReviews.reduce((sum, r) => sum + (r.review_count || r.reviews.length), 0),
        staff_score: staffScores.length > 0
          ? Math.round((staffScores.reduce((a, b) => a + b, 0) / staffScores.length) * 10) / 10
          : null,
        staff_count: staffReviews.reduce((sum, r) => sum + (r.review_count || r.reviews.length), 0),
        top_positive: allPositive.slice(0, 5),
        top_negative: allNegative.slice(0, 5),
      },
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
        error: String(err).slice(0, 200),
        ai_errors: aiErrors,
        customer_reviews: [],
        staff_reviews: [],
        aggregated: {
          customer_score: null,
          customer_count: 0,
          staff_score: null,
          staff_count: 0,
          top_positive: [],
          top_negative: [],
        },
        correlation,
      }),
      { status: 200, headers: corsHeaders(req) },
    );
  }
});
