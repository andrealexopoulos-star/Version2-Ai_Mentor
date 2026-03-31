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

const BROWSE_AI_API_KEY = Deno.env.get("BROWSE_AI_API_KEY") || "";
const BROWSE_AI_BASE = "https://api.browse.ai/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-calibration-run-id, x-calibration-step, x-proxy-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

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
    customer_last_12_months_count: number;
    customer_undated_count: number;
    customer_sources: string[];
    customer_platforms: Array<{
      platform: string;
      rating: number | null;
      review_count: number;
      last_12_months_count: number;
      undated_count: number;
      url: string;
    }>;
    staff_score: number | null;
    staff_count: number;
    staff_last_12_months_count: number;
    staff_undated_count: number;
    window_months: number;
    staff_sources: string[];
    top_positive: string[];
    top_negative: string[];
    top_recent: string[];
    top_staff_positive: string[];
    top_staff_negative: string[];
    customer_action_themes: string[];
    staff_action_themes: string[];
  };
  ai_errors: string[];
  correlation: {
    run_id: string | null;
    step: string | null;
  };
}

const REVIEW_WINDOW_MONTHS = 12;

function normalizeText(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function dedupeStrings(values: string[], max = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const val = (raw || "").trim();
    if (!val) continue;
    const key = val.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(val);
    if (out.length >= max) break;
  }
  return out;
}

function parseDateFromText(text: string): string {
  const raw = (text || "").toLowerCase();
  if (!raw) return "";

  const relative = raw.match(/(\d+)\s*(day|week|month|year)s?\s+ago/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    if (Number.isFinite(amount) && amount > 0) {
      const dt = new Date();
      if (unit === "day") dt.setDate(dt.getDate() - amount);
      if (unit === "week") dt.setDate(dt.getDate() - amount * 7);
      if (unit === "month") dt.setMonth(dt.getMonth() - amount);
      if (unit === "year") dt.setFullYear(dt.getFullYear() - amount);
      return dt.toISOString();
    }
  }

  const absolute = raw.match(
    /\b(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2},?\s+\d{4}\b/i
  ) || raw.match(
    /\b(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{4}\b/i
  ) || raw.match(/\b\d{4}-\d{2}-\d{2}\b/);

  if (absolute) {
    const parsed = new Date(absolute[0]);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return "";
}

function isWithinLastMonths(dateIso: string, months: number): boolean {
  if (!dateIso) return false;
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return parsed >= cutoff;
}

function deriveStaffActionThemes(staffNegative: string[]): string[] {
  const corpus = staffNegative.join(" ").toLowerCase();
  const actions: string[] = [];
  const add = (condition: boolean, action: string) => {
    if (condition) actions.push(action);
  };

  add(
    /(manager|management|leadership|communication)/i.test(corpus),
    "Strengthen frontline leadership cadence with weekly manager coaching and two-way communication check-ins."
  );
  add(
    /(overwork|burnout|workload|long hours|pressure)/i.test(corpus),
    "Rebalance workloads with capacity planning, role clarity, and escalation pathways to reduce burnout risk."
  );
  add(
    /(pay|salary|underpaid|compensation|benefits)/i.test(corpus),
    "Benchmark compensation and benefits against local market medians and publish transparent progression bands."
  );
  add(
    /(culture|toxic|turnover|attrition|no growth|career)/i.test(corpus),
    "Launch a 90-day culture and retention plan: stay interviews, growth pathways, and manager accountability KPIs."
  );
  add(
    /(training|onboarding|support|tools|process)/i.test(corpus),
    "Upgrade onboarding and enablement with documented SOPs and role-specific training scorecards."
  );

  if (actions.length === 0 && staffNegative.length > 0) {
    actions.push("Run quarterly employee listening loops and convert top recurring pain points into tracked operations improvements.");
  }
  return dedupeStrings(actions, 4);
}

function deriveCustomerActionThemes(customerNegative: string[]): string[] {
  const corpus = customerNegative.join(" ").toLowerCase();
  const actions: string[] = [];
  const add = (condition: boolean, action: string) => {
    if (condition) actions.push(action);
  };

  add(
    /(slow|wait|delay|late|delivery|shipping|turnaround)/i.test(corpus),
    "Set service-level targets for response and delivery times, then publish weekly SLA adherence to operations leaders."
  );
  add(
    /(quality|defect|broken|error|issue|fault|refund|return)/i.test(corpus),
    "Implement a root-cause quality loop: classify complaints weekly, assign owners, and verify corrective actions within 14 days."
  );
  add(
    /(support|service|rude|unhelpful|communication|follow up)/i.test(corpus),
    "Upgrade customer service playbooks with response templates, escalation rules, and coaching on complaint handling."
  );
  add(
    /(price|pricing|expensive|cost|value|overpriced|hidden fee)/i.test(corpus),
    "Audit pricing transparency: clarify inclusions/exclusions, align value messaging, and review refund friction points."
  );
  add(
    /(booking|appointment|website|checkout|payment|billing)/i.test(corpus),
    "Reduce front-end friction in booking and checkout flows; track abandonment and payment failure reasons as weekly ops KPIs."
  );

  if (actions.length === 0 && customerNegative.length > 0) {
    actions.push("Run a monthly voice-of-customer operations review and convert top recurring complaints into tracked fixes with deadlines.");
  }
  return dedupeStrings(actions, 4);
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
      const text = normalizeText(block);
      if (text.length < 20) continue;
      const date = parseDateFromText(text);
      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date,
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
      const text = normalizeText(snip);
      if (text.length < 20 || !text.toLowerCase().includes("glassdoor")) continue;

      if (!result.rating) result.rating = extractRating(text);
      if (!result.review_count) result.review_count = extractReviewCount(text);
      const date = parseDateFromText(text);

      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date,
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
      const text = normalizeText(rt);
      if (text.length < 10) continue;
      const date = parseDateFromText(text);
      result.reviews.push({
        text: text.slice(0, 300),
        rating: null,
        author: "",
        date,
        sentiment: classifySentiment(text),
      });
    }
  }

  return result;
}

async function searchProductReviewReviews(
  businessName: string,
  aiErrors: string[],
): Promise<ReviewResult> {
  const result: ReviewResult = {
    source: "browse_ai",
    platform: "productreview",
    rating: null,
    review_count: null,
    reviews: [],
    url: "",
  };

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `site:productreview.com.au "${businessName}" reviews`
  )}&num=10`;

  const html = await scrapeWithBrowseAI(searchUrl, aiErrors);
  if (!html) return result;

  result.url = searchUrl;

  const snippets = html.match(
    /<span[^>]*class="[^"]*(?:st|aCOpRe|hgKElc)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
  );
  if (snippets) {
    for (const snip of snippets.slice(0, 10)) {
      const text = normalizeText(snip);
      if (text.length < 20) continue;
      if (!/productreview|review/i.test(text)) continue;

      if (!result.rating) result.rating = extractRating(text);
      if (!result.review_count) result.review_count = extractReviewCount(text);
      const date = parseDateFromText(text);

      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date,
        sentiment: classifySentiment(text),
      });
    }
  }

  return result;
}

async function searchForumReviews(
  businessName: string,
  aiErrors: string[],
): Promise<ReviewResult> {
  const result: ReviewResult = {
    source: "browse_ai",
    platform: "forums",
    rating: null,
    review_count: null,
    reviews: [],
    url: "",
  };

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `site:reddit.com OR inurl:forum "${businessName}" review experiences`
  )}&num=10`;

  const html = await scrapeWithBrowseAI(searchUrl, aiErrors);
  if (!html) return result;

  result.url = searchUrl;

  const snippets = html.match(
    /<span[^>]*class="[^"]*(?:st|aCOpRe|hgKElc)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
  );
  if (snippets) {
    for (const snip of snippets.slice(0, 10)) {
      const text = normalizeText(snip);
      if (text.length < 20) continue;
      if (!/review|experience|customer|service|quality|support/i.test(text)) continue;
      const date = parseDateFromText(text);
      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date,
        sentiment: classifySentiment(text),
      });
    }
  }

  return result;
}

async function searchOtherReviewPlatforms(
  businessName: string,
  aiErrors: string[],
): Promise<ReviewResult> {
  const result: ReviewResult = {
    source: "browse_ai",
    platform: "review-platforms",
    rating: null,
    review_count: null,
    reviews: [],
    url: "",
  };

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `site:yelp.com OR site:g2.com OR site:capterra.com OR site:tripadvisor.com "${businessName}" reviews`
  )}&num=10`;

  const html = await scrapeWithBrowseAI(searchUrl, aiErrors);
  if (!html) return result;

  result.url = searchUrl;

  const snippets = html.match(
    /<span[^>]*class="[^"]*(?:st|aCOpRe|hgKElc)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
  );
  if (snippets) {
    for (const snip of snippets.slice(0, 10)) {
      const text = normalizeText(snip);
      if (text.length < 20) continue;
      if (!/review|rating|customer|service/i.test(text)) continue;

      if (!result.rating) result.rating = extractRating(text);
      if (!result.review_count) result.review_count = extractReviewCount(text);
      const date = parseDateFromText(text);

      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date,
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
      const text = normalizeText(snip);
      if (text.length < 20) continue;

      if (!result.rating) result.rating = extractRating(text);
      if (!result.review_count) result.review_count = extractReviewCount(text);
      const date = parseDateFromText(text);

      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date,
        sentiment: classifySentiment(text),
      });
    }
  }

  return result;
}

async function searchSeekReviews(
  businessName: string,
  aiErrors: string[],
): Promise<ReviewResult> {
  const result: ReviewResult = {
    source: "browse_ai",
    platform: "seek",
    rating: null,
    review_count: null,
    reviews: [],
    url: "",
  };

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `site:seek.com.au "${businessName}" reviews`
  )}&num=10`;

  const html = await scrapeWithBrowseAI(searchUrl, aiErrors);
  if (!html) return result;

  result.url = searchUrl;

  const snippets = html.match(
    /<span[^>]*class="[^"]*(?:st|aCOpRe|hgKElc)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
  );
  if (snippets) {
    for (const snip of snippets.slice(0, 10)) {
      const text = normalizeText(snip);
      if (text.length < 20) continue;

      if (!result.rating) result.rating = extractRating(text);
      if (!result.review_count) result.review_count = extractReviewCount(text);
      const date = parseDateFromText(text);

      result.reviews.push({
        text: text.slice(0, 300),
        rating: extractRating(text),
        author: "",
        date,
        sentiment: classifySentiment(text),
      });
    }
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
        { status: 200, headers: corsHeaders },
      );
    }

    const searchName = businessName || domain;

    const [google, trustpilot, productreview, forums, reviewPlatforms, glassdoor, indeed, seek] = await Promise.allSettled([
      searchGoogleReviews(searchName, location, aiErrors),
      searchTrustpilotReviews(searchName, domain, aiErrors),
      searchProductReviewReviews(searchName, aiErrors),
      searchForumReviews(searchName, aiErrors),
      searchOtherReviewPlatforms(searchName, aiErrors),
      searchGlassdoorReviews(searchName, aiErrors),
      searchIndeedReviews(searchName, aiErrors),
      searchSeekReviews(searchName, aiErrors),
    ]);

    const customerReviews: ReviewResult[] = [];
    const staffReviews: ReviewResult[] = [];

    if (google.status === "fulfilled" && google.value.reviews.length > 0) {
      customerReviews.push(google.value);
    }
    if (trustpilot.status === "fulfilled" && (trustpilot.value.rating || trustpilot.value.reviews.length > 0)) {
      customerReviews.push(trustpilot.value);
    }
    if (productreview.status === "fulfilled" && (productreview.value.rating || productreview.value.reviews.length > 0)) {
      customerReviews.push(productreview.value);
    }
    if (forums.status === "fulfilled" && forums.value.reviews.length > 0) {
      customerReviews.push(forums.value);
    }
    if (reviewPlatforms.status === "fulfilled" && (reviewPlatforms.value.rating || reviewPlatforms.value.reviews.length > 0)) {
      customerReviews.push(reviewPlatforms.value);
    }
    if (glassdoor.status === "fulfilled" && (glassdoor.value.rating || glassdoor.value.reviews.length > 0)) {
      staffReviews.push(glassdoor.value);
    }
    if (indeed.status === "fulfilled" && (indeed.value.rating || indeed.value.reviews.length > 0)) {
      staffReviews.push(indeed.value);
    }
    if (seek.status === "fulfilled" && (seek.value.rating || seek.value.reviews.length > 0)) {
      staffReviews.push(seek.value);
    }

    const customerScores = customerReviews
      .map((r) => r.rating)
      .filter((r): r is number => r !== null);
    const staffScores = staffReviews
      .map((r) => r.rating)
      .filter((r): r is number => r !== null);

    const customerPositive = [
      ...customerReviews.flatMap((r) =>
        r.reviews.filter((rv) => rv.sentiment === "positive").map((rv) => `[${r.platform}] ${rv.text}`)
      ),
    ];
    const customerNegative = [
      ...customerReviews.flatMap((r) =>
        r.reviews.filter((rv) => rv.sentiment === "negative").map((rv) => `[${r.platform}] ${rv.text}`)
      ),
    ];
    const staffPositive = [
      ...staffReviews.flatMap((r) =>
        r.reviews.filter((rv) => rv.sentiment === "positive").map((rv) => `[${r.platform}] ${rv.text}`)
      ),
    ];
    const staffNegative = [
      ...staffReviews.flatMap((r) =>
        r.reviews.filter((rv) => rv.sentiment === "negative").map((rv) => `[${r.platform}] ${rv.text}`)
      ),
    ];
    const customerLast12MonthReviews = customerReviews.flatMap((platformReviews) =>
      (platformReviews.reviews || []).filter((rv) => isWithinLastMonths(rv.date, REVIEW_WINDOW_MONTHS))
    );
    const customerUndatedCount = customerReviews.reduce((sum, platformReviews) => (
      sum + (platformReviews.reviews || []).filter((rv) => !rv.date).length
    ), 0);
    const customerPlatformSources = dedupeStrings(customerReviews.map((r) => r.platform), 8);
    const customerPlatforms = customerReviews.map((platformReviews) => ({
      platform: platformReviews.platform,
      rating: platformReviews.rating,
      review_count: platformReviews.review_count || platformReviews.reviews.length,
      last_12_months_count: (platformReviews.reviews || []).filter((rv) => isWithinLastMonths(rv.date, REVIEW_WINDOW_MONTHS)).length,
      undated_count: (platformReviews.reviews || []).filter((rv) => !rv.date).length,
      url: platformReviews.url || "",
    })).sort((a, b) => b.review_count - a.review_count).slice(0, 8);
    const customerReviewEvents = customerReviews.flatMap((platformReviews) =>
      (platformReviews.reviews || []).map((rv) => ({
        platform: platformReviews.platform,
        text: rv.text || "",
        date: rv.date || "",
      }))
    );
    const customerDatedRecent = customerReviewEvents
      .filter((rv) => rv.date && isWithinLastMonths(rv.date, REVIEW_WINDOW_MONTHS))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((rv) => `[${rv.platform}] ${rv.text} (${new Date(rv.date).toISOString().slice(0, 10)})`);
    const customerUndatedRecent = customerReviewEvents
      .filter((rv) => !rv.date)
      .map((rv) => `[${rv.platform}] ${rv.text} (date not verified)`);
    const customerTopRecent = dedupeStrings([...customerDatedRecent, ...customerUndatedRecent], 6);
    const staffLast12MonthReviews = staffReviews.flatMap((platformReviews) =>
      (platformReviews.reviews || []).filter((rv) => isWithinLastMonths(rv.date, REVIEW_WINDOW_MONTHS))
    );
    const staffUndatedCount = staffReviews.reduce((sum, platformReviews) => (
      sum + (platformReviews.reviews || []).filter((rv) => !rv.date).length
    ), 0);
    const staffPlatformSources = dedupeStrings(staffReviews.map((r) => r.platform), 6);
    const topStaffPositive = dedupeStrings(staffPositive, 5);
    const topStaffNegative = dedupeStrings(staffNegative, 5);
    const topCustomerPositive = dedupeStrings(customerPositive, 5);
    const topCustomerNegative = dedupeStrings(customerNegative, 5);

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
        customer_last_12_months_count: customerLast12MonthReviews.length,
        customer_undated_count: customerUndatedCount,
        customer_sources: customerPlatformSources,
        customer_platforms: customerPlatforms,
        staff_score: staffScores.length > 0
          ? Math.round((staffScores.reduce((a, b) => a + b, 0) / staffScores.length) * 10) / 10
          : null,
        staff_count: staffReviews.reduce((sum, r) => sum + (r.review_count || r.reviews.length), 0),
        staff_last_12_months_count: staffLast12MonthReviews.length,
        staff_undated_count: staffUndatedCount,
        window_months: REVIEW_WINDOW_MONTHS,
        staff_sources: staffPlatformSources,
        top_positive: topCustomerPositive,
        top_negative: topCustomerNegative,
        top_recent: customerTopRecent,
        top_staff_positive: topStaffPositive,
        top_staff_negative: topStaffNegative,
        customer_action_themes: deriveCustomerActionThemes(topCustomerNegative),
        staff_action_themes: deriveStaffActionThemes(topStaffNegative),
      },
      ai_errors: aiErrors,
      correlation,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders,
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
          customer_last_12_months_count: 0,
          customer_undated_count: 0,
          customer_sources: [],
          customer_platforms: [],
          staff_score: null,
          staff_count: 0,
          staff_last_12_months_count: 0,
          staff_undated_count: 0,
          window_months: REVIEW_WINDOW_MONTHS,
          staff_sources: [],
          top_positive: [],
          top_negative: [],
          top_recent: [],
          top_staff_positive: [],
          top_staff_negative: [],
          customer_action_themes: [],
          staff_action_themes: [],
        },
        correlation,
      }),
      { status: 200, headers: corsHeaders },
    );
  }
});
