// ═══════════════════════════════════════════════════════════════
// DETERMINISTIC BUSINESS SCRAPE — Supabase Edge Function
//
// TRUST RECONSTRUCTION: No LLM enrichment. No inferred competitors.
// Extracts ONLY structured metadata from HTML.
//
// Deploy: supabase functions deploy scrape-business-profile
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeUrl(input: string): string {
  let url = input.trim();
  // Remove protocol
  url = url.replace(/^https?:\/\//, '');
  // Remove trailing slash
  url = url.replace(/\/+$/, '');
  // Remove query params
  url = url.split('?')[0];
  // Remove www prefix for canonical
  const canonical = url.replace(/^www\./, '');
  // Reconstruct with https
  return `https://${url}`;
}

async function fetchWithRedirects(url: string, maxRedirects = 5): Promise<{ html: string; finalUrl: string; status: number }> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    try {
      const res = await fetch(currentUrl, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BIQcBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      // Follow redirects manually
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) break;
        currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
        redirectCount++;
        continue;
      }

      if (res.status >= 400) {
        return { html: '', finalUrl: currentUrl, status: res.status };
      }

      const html = await res.text();
      return { html, finalUrl: currentUrl, status: res.status };
    } catch (e) {
      return { html: '', finalUrl: currentUrl, status: 0 };
    }
  }

  return { html: '', finalUrl: currentUrl, status: 0 };
}

interface StructuredMetadata {
  title: string | null;
  description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_type: string | null;
  og_site_name: string | null;
  json_ld: Record<string, unknown>[];
  canonical_url: string | null;
  competitors: Array<{ name: string; url: string; source: string }>;
  status: string;
}

function extractMetadata(html: string, url: string): StructuredMetadata {
  const result: StructuredMetadata = {
    title: null,
    description: null,
    og_title: null,
    og_description: null,
    og_image: null,
    og_type: null,
    og_site_name: null,
    json_ld: [],
    canonical_url: null,
    competitors: [],
    status: 'scraped',
  };

  if (!html) {
    result.status = 'no_html_content';
    return result;
  }

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim();

  // Extract meta description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (descMatch) result.description = descMatch[1].trim();

  // Extract OpenGraph tags
  const ogPatterns = [
    { key: 'og_title', prop: 'og:title' },
    { key: 'og_description', prop: 'og:description' },
    { key: 'og_image', prop: 'og:image' },
    { key: 'og_type', prop: 'og:type' },
    { key: 'og_site_name', prop: 'og:site_name' },
  ];

  for (const { key, prop } of ogPatterns) {
    const match = html.match(new RegExp(`<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["']${prop}["']`, 'i'));
    if (match) (result as any)[key] = match[1].trim();
  }

  // Extract canonical URL
  const canonMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (canonMatch) result.canonical_url = canonMatch[1].trim();

  // Extract JSON-LD structured data
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch;
  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1]);
      result.json_ld.push(parsed);
    } catch {}
  }

  // Extract competitors ONLY from structured data (JSON-LD)
  // No inference. No guessing. Only explicit competitor references.
  for (const ld of result.json_ld) {
    if (ld && typeof ld === 'object') {
      // Check for competitor mentions in structured data
      const ldStr = JSON.stringify(ld);
      // Only extract if there's an explicit "competitor" field
      if ((ld as any).competitor || (ld as any).competitors) {
        const comps = (ld as any).competitor || (ld as any).competitors;
        const compArray = Array.isArray(comps) ? comps : [comps];
        for (const c of compArray) {
          if (typeof c === 'string') {
            result.competitors.push({ name: c, url: '', source: 'json-ld' });
          } else if (c?.name) {
            result.competitors.push({ name: c.name, url: c.url || '', source: 'json-ld' });
          }
        }
      }
    }
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL parameter required', status: 'invalid_input' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    const { html, finalUrl, status: httpStatus } = await fetchWithRedirects(normalizedUrl);

    if (httpStatus === 0) {
      return new Response(
        JSON.stringify({
          url: normalizedUrl,
          status: 'unreachable',
          metadata: null,
          competitors: [],
          message: 'Domain is unreachable or does not resolve.',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (httpStatus >= 500) {
      return new Response(
        JSON.stringify({
          url: normalizedUrl,
          status: 'server_error',
          http_status: httpStatus,
          metadata: null,
          competitors: [],
          message: 'Target server returned an error.',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!html || html.length < 100) {
      return new Response(
        JSON.stringify({
          url: finalUrl,
          status: 'minimal_content',
          metadata: null,
          competitors: [],
          message: 'Insufficient publicly available structured data for analysis.',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metadata = extractMetadata(html, finalUrl);

    // If no structured competitor data found, explicitly state it
    if (metadata.competitors.length === 0) {
      metadata.status = 'no_structured_competitor_data';
    }

    return new Response(
      JSON.stringify({
        url: finalUrl,
        status: metadata.status,
        metadata: {
          title: metadata.title,
          description: metadata.description,
          og_title: metadata.og_title,
          og_description: metadata.og_description,
          og_image: metadata.og_image,
          og_type: metadata.og_type,
          og_site_name: metadata.og_site_name,
          canonical_url: metadata.canonical_url,
          json_ld_count: metadata.json_ld.length,
        },
        competitors: metadata.competitors,
        message: metadata.competitors.length === 0
          ? 'Insufficient publicly available structured data for competitor analysis.'
          : `Found ${metadata.competitors.length} competitor(s) in structured data.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
