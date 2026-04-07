import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

type Platform =
  | "linkedin"
  | "facebook"
  | "instagram"
  | "twitter"
  | "youtube"
  | "tiktok"
  | "pinterest";

interface HandleEvidence {
  url: string;
  source_page: string;
  method: "html_extraction" | "perplexity_ai";
}

interface SocialResult {
  ok: boolean;
  website_url: string;
  social_handles: Record<Platform, string | null>;
  handle_evidence: Partial<Record<Platform, HandleEvidence>>;
  trust_signals: string[];
  pages_scanned: number;
  sources: string[];
  field_provenance: {
    social_handles: { source_fn: string; confidence: number };
  };
  ai_errors: string[];
  correlation: {
    run_id: string | null;
    step: string | null;
    proxy_request_id: string | null;
  };
}

const PLATFORM_PATTERNS: Array<{ key: Platform; re: RegExp }> = [
  { key: "linkedin", re: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in|school)\/[^\s"'<>)]+/gi },
  { key: "facebook", re: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)]+/gi },
  { key: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/gi },
  { key: "twitter", re: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s"'<>)]+/gi },
  { key: "youtube", re: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[^\s"'<>)]+/gi },
  { key: "tiktok", re: /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>)]+/gi },
  { key: "pinterest", re: /https?:\/\/(?:www\.)?pinterest\.com\/[^\s"'<>)]+/gi },
];

const TRUST_KEYWORDS =
  /\b(review|testimonial|case[\s-]?study|client|customer|award|certified|iso[\s-]?\d+|years?\s+of\s+experience)\b/gi;

function normalizeUrl(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function pickCanonical(urls: string[]): string {
  const sorted = [...new Set(urls)].sort((a, b) => {
    const aClean = a.replace(/\/$/, "");
    const bClean = b.replace(/\/$/, "");
    if (aClean.length !== bClean.length) return bClean.length - aClean.length;
    return aClean.localeCompare(bClean);
  });
  return sorted[0] || "";
}

function extractHandlesFromHtml(
  html: string,
  sourcePage: string,
  handles: Map<Platform, string[]>,
  evidence: Map<Platform, HandleEvidence>,
): void {
  for (const { key, re } of PLATFORM_PATTERNS) {
    re.lastIndex = 0;
    const matches = html.match(re) || [];
    if (matches.length === 0) continue;

    const existing = handles.get(key) || [];
    handles.set(key, [...existing, ...matches]);

    if (!evidence.has(key)) {
      evidence.set(key, {
        url: matches[0],
        source_page: sourcePage,
        method: "html_extraction",
      });
    }
  }
}

function extractTrustSignals(html: string): string[] {
  const signals: string[] = [];
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const matches = text.match(TRUST_KEYWORDS) || [];
  const uniqueKeywords = [...new Set(matches.map((m) => m.toLowerCase()))];

  for (const kw of uniqueKeywords) {
    const idx = text.toLowerCase().indexOf(kw);
    if (idx === -1) continue;
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + kw.length + 60);
    const snippet = text.slice(start, end).trim();
    signals.push(snippet);
  }
  return signals;
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "BIQc-Social-Enrichment/2.0" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function queryPerplexity(
  domain: string,
  businessName: string | undefined,
): Promise<Record<Platform, string> | null> {
  const apiKey = (Deno.env.get("PERPLEXITY_API_KEY") || "").trim();
  if (!apiKey) return null;

  const subject = businessName || domain;
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "Return ONLY a JSON object mapping platform names to profile URLs. " +
              "Platforms: linkedin, facebook, instagram, twitter, youtube, tiktok, pinterest. " +
              "Omit platforms with no known profile. No markdown fences, no explanation.",
          },
          {
            role: "user",
            content: `What are the official social media profiles for ${subject}?`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    let text = (data.choices?.[0]?.message?.content || "").trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "").trim();
    }
    return JSON.parse(text) as Record<Platform, string>;
  } catch {
    return null;
  }
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
        function: "social-enrichment",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders(req) },
    );
  }

  const aiErrors: string[] = [];
  const sources: string[] = [];
  const correlation = {
    run_id: req.headers.get("x-calibration-run-id") || null,
    step: req.headers.get("x-calibration-step") || null,
    proxy_request_id: req.headers.get("x-proxy-request-id") || null,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const websiteUrl = normalizeUrl(body.website_url || body.url || "");
    const businessName: string | undefined = body.business_name;
    const inputHandles: Partial<Record<Platform, string>> =
      body.social_handles || {};

    if (!websiteUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "website_url is required" }),
        { status: 400, headers: corsHeaders(req) },
      );
    }

    // Multi-page scrape: homepage + /about + /contact + /team
    const base = websiteUrl.replace(/\/+$/, "");
    const pagePaths = ["", "/about", "/contact", "/team"];
    const pageUrls = pagePaths.map((p) => base + p);

    const handles = new Map<Platform, string[]>();
    const evidence = new Map<Platform, HandleEvidence>();
    const allTrustSignals: string[] = [];
    let pagesScanned = 0;

    const pageResults = await Promise.allSettled(
      pageUrls.map((u) => fetchPage(u)),
    );

    for (let i = 0; i < pageResults.length; i++) {
      const result = pageResults[i];
      if (result.status !== "fulfilled" || !result.value) continue;

      pagesScanned++;
      const html = result.value;
      const pageUrl = pageUrls[i];

      extractHandlesFromHtml(html, pageUrl, handles, evidence);
      allTrustSignals.push(...extractTrustSignals(html));
    }

    sources.push("html_extraction");

    // Resolve best URL per platform from HTML
    const resolvedHandles: Record<Platform, string | null> = {
      linkedin: null,
      facebook: null,
      instagram: null,
      twitter: null,
      youtube: null,
      tiktok: null,
      pinterest: null,
    };

    for (const [platform, urls] of handles) {
      resolvedHandles[platform] = pickCanonical(urls);
    }

    // Merge caller-provided handles (they take priority over HTML extraction)
    for (const [p, url] of Object.entries(inputHandles)) {
      const platform = p as Platform;
      if (url && platform in resolvedHandles) {
        resolvedHandles[platform] = normalizeUrl(url);
        evidence.set(platform, {
          url: normalizeUrl(url),
          source_page: "caller_input",
          method: "html_extraction",
        });
      }
    }

    // Perplexity AI verification
    const domain = new URL(websiteUrl).hostname;
    const perplexityResult = await queryPerplexity(domain, businessName);

    if (perplexityResult) {
      sources.push("perplexity_ai");
      for (const [p, url] of Object.entries(perplexityResult)) {
        const platform = p as Platform;
        if (!url || !(platform in resolvedHandles)) continue;
        resolvedHandles[platform] = url;
        evidence.set(platform, {
          url,
          source_page: "perplexity_api",
          method: "perplexity_ai",
        });
      }
    } else if (Deno.env.get("PERPLEXITY_API_KEY")) {
      aiErrors.push("Perplexity query failed or returned unparseable result");
    }

    const foundCount = Object.values(resolvedHandles).filter(Boolean).length;
    const trustSignals = [...new Set(allTrustSignals)];

    const result: SocialResult = {
      ok: true,
      website_url: websiteUrl,
      social_handles: resolvedHandles,
      handle_evidence: Object.fromEntries(evidence) as Partial<
        Record<Platform, HandleEvidence>
      >,
      trust_signals: trustSignals,
      pages_scanned: pagesScanned,
      sources: sources.map((s) => `social-enrichment:${s}`),
      field_provenance: {
        social_handles: {
          source_fn: "social-enrichment",
          confidence: foundCount >= 3 ? 0.9 : foundCount > 0 ? 0.75 : 0.35,
        },
      },
      ai_errors: aiErrors,
      correlation,
    };

    return new Response(JSON.stringify(result), { headers: corsHeaders(req) });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err),
        ai_errors: [...aiErrors, String(err)],
        correlation,
      }),
      { status: 500, headers: corsHeaders(req) },
    );
  }
});
