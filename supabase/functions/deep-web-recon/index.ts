import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { verifyAuth, enforceUserOwnership } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";


interface SWOTResult {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface ReconSignal {
  type: "competitor" | "sentiment" | "market" | "operational";
  text: string;
  evidence: string;
  source_url: string;
}

interface ReconResponse {
  ok: boolean;
  targets_scanned: number;
  content_bytes: number;
  signals: ReconSignal[];
  swot: SWOTResult;
  executive_summary: string;
  sources: string[];
  field_provenance: Record<string, { source_fn: string; confidence: number }>;
  ai_errors: string[];
  correlation: {
    run_id: string | null;
    step: string | null;
    proxy_request_id: string | null;
  };
}

function normalizeUrl(input: string): string {
  const value = (input || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

// ─── Scraping ────────────────────────────────────────────────────────────────

async function scrapeWithFirecrawl(
  url: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 15000,
      }),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const md = String(payload?.data?.markdown || payload?.data?.content || "");
    return md.length > 50 ? md.substring(0, 20000) : null;
  } catch {
    return null;
  }
}

async function scrapeRawHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BIQc-Deep-Recon/2.0" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html.slice(0, 20_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function scrape(
  url: string,
  firecrawlKey: string,
): Promise<string> {
  if (firecrawlKey) {
    const md = await scrapeWithFirecrawl(url, firecrawlKey);
    if (md) return md;
  }
  return (await scrapeRawHtml(url)) || "";
}

// ─── Signal detection (regex-based) ─────────────────────────────────────────

interface SignalPattern {
  type: ReconSignal["type"];
  pattern: RegExp;
  label: string;
}

const SIGNAL_PATTERNS: SignalPattern[] = [
  {
    type: "sentiment",
    pattern: /(review|rating|testimonial|satisfaction|nps\b)/i,
    label: "Customer-review / sentiment language detected",
  },
  {
    type: "competitor",
    pattern: /(competitor|alternative|vs\b|compare|benchmark)/i,
    label: "Competitive positioning language detected",
  },
  {
    type: "operational",
    pattern: /(hiring|join our team|careers|open roles|we'?re growing)/i,
    label: "Hiring / people-growth markers detected",
  },
  {
    type: "market",
    pattern: /(launch|announc|new product|release|partnership|expansion)/i,
    label: "Recent launch or market-change signals detected",
  },
];

function extractEvidence(content: string, pattern: RegExp): string {
  const match = content.match(pattern);
  if (!match) return "";
  const idx = match.index ?? 0;
  const start = Math.max(0, idx - 80);
  const end = Math.min(content.length, idx + match[0].length + 80);
  return content.slice(start, end).replace(/\s+/g, " ").trim();
}

function deriveSignals(
  content: string,
  sourceUrl: string,
): ReconSignal[] {
  const text = (content || "").toLowerCase();
  if (!text) return [];

  const out: ReconSignal[] = [];
  for (const sp of SIGNAL_PATTERNS) {
    if (sp.pattern.test(text)) {
      out.push({
        type: sp.type,
        text: sp.label,
        evidence: extractEvidence(content, sp.pattern),
        source_url: sourceUrl,
      });
    }
  }
  return out;
}

// ─── AI SWOT synthesis ──────────────────────────────────────────────────────

async function synthesizeSWOT(
  scrapedSections: Array<{ source: string; content: string }>,
  businessName: string | undefined,
  aiErrors: string[],
): Promise<{ swot: SWOTResult; executive_summary: string }> {
  const empty: SWOTResult = {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  };

  const openaiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!openaiKey) {
    return { swot: empty, executive_summary: "" };
  }

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o";

  const scrapeSummary = scrapedSections
    .map((s) => `### ${s.source.toUpperCase()}\n${s.content.substring(0, 8000)}`)
    .join("\n\n---\n\n");

  const systemPrompt =
    "You are BIQc's Strategic Intelligence Engine. " +
    "Zero-Presumption mandate: only state what is evidenced in the data provided. " +
    "If insufficient data exists for a SWOT category, state " +
    '"Insufficient signal — requires deeper recon."';

  const userPrompt = `BUSINESS: ${businessName || "Unknown"}

SCRAPED INTELLIGENCE:
${scrapeSummary || "No content scraped — produce a minimal assessment."}

Return JSON ONLY (no markdown fences):
{
  "swot": { "strengths": ["..."], "weaknesses": ["..."], "opportunities": ["..."], "threats": ["..."] },
  "executive_summary": "One-paragraph summary of strategic findings."
}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      aiErrors.push(`OpenAI ${res.status}: ${errText.substring(0, 200)}`);
      return { swot: empty, executive_summary: "" };
    }

    const data = await res.json();
    let raw = (data.choices?.[0]?.message?.content || "").trim();

    if (raw.startsWith("```")) {
      raw = raw.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "").trim();
    }

    const parsed = JSON.parse(raw);
    return {
      swot: parsed.swot || empty,
      executive_summary: parsed.executive_summary || "",
    };
  } catch (err) {
    aiErrors.push(`SWOT synthesis error: ${String(err)}`);
    return { swot: empty, executive_summary: "" };
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────

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
        function: "deep-web-recon",
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
    proxy_request_id: req.headers.get("x-proxy-request-id") || null,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const ownership = enforceUserOwnership(auth, body.user_id || null);
    if (!ownership.ok) {
      return new Response(JSON.stringify({ ok: false, error: ownership.error }), {
        status: ownership.status,
        headers: corsHeaders(req),
      });
    }
    const firecrawlKey = (Deno.env.get("FIRECRAWL_API_KEY") || "").trim();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const targetUserId = String(body.user_id || auth.userId || "").trim();

    const targets = [
      { source: "website", url: normalizeUrl(body.website || body.website_url || "") },
      { source: "linkedin", url: normalizeUrl(body.linkedin || "") },
      { source: "twitter", url: normalizeUrl(body.twitter || body.x || "") },
      { source: "instagram", url: normalizeUrl(body.instagram || "") },
      { source: "facebook", url: normalizeUrl(body.facebook || "") },
      { source: "youtube", url: normalizeUrl(body.youtube || "") },
      { source: "tiktok", url: normalizeUrl(body.tiktok || "") },
    ].filter((t) => t.url);

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "At least one target URL is required (website, linkedin, twitter, etc.)",
        }),
        { status: 400, headers: corsHeaders(req) },
      );
    }

    // ═══ PHASE 1: MULTI-CHANNEL SCRAPE ═══
    const scrapedSections: Array<{ source: string; content: string }> = [];
    let totalBytes = 0;
    const sourcesUsed: string[] = [];

    const scrapeResults = await Promise.allSettled(
      targets.map(async (t) => {
        const content = await scrape(t.url, firecrawlKey);
        return { source: t.source, url: t.url, content };
      }),
    );

    for (const result of scrapeResults) {
      if (result.status === "fulfilled") {
        const { source, url, content } = result.value;
        if (content) {
          scrapedSections.push({ source, content });
          totalBytes += content.length;
          sourcesUsed.push(
            firecrawlKey ? `firecrawl:${source}` : `html:${source}`,
          );
        } else {
          aiErrors.push(`Scrape returned empty for ${source} (${url})`);
        }
      } else {
        aiErrors.push(`Scrape failed: ${result.reason}`);
      }
    }

    // ═══ PHASE 2: SIGNAL DETECTION (regex) ═══
    const signals: ReconSignal[] = [];
    for (const section of scrapedSections) {
      const target = targets.find((t) => t.source === section.source);
      signals.push(...deriveSignals(section.content, target?.url || section.source));
    }

    // ═══ PHASE 3: AI SWOT SYNTHESIS ═══
    const { swot, executive_summary } = await synthesizeSWOT(
      scrapedSections,
      body.business_name,
      aiErrors,
    );

    const hasAi = Boolean(Deno.env.get("OPENAI_API_KEY"));
    const hasSignals = signals.length > 0;
    const hasSWOT =
      swot.strengths.length +
        swot.weaknesses.length +
        swot.opportunities.length +
        swot.threats.length >
      0;

    const response: ReconResponse = {
      ok: true,
      targets_scanned: targets.length,
      content_bytes: totalBytes,
      signals,
      swot,
      executive_summary:
        executive_summary ||
        (hasSignals
          ? `Deep recon detected ${signals.length} actionable signals across ${targets.length} source(s).`
          : "Deep recon completed with low signal density from available public sources."),
      sources: sourcesUsed.map((s) => `deep-web-recon:${s}`),
      field_provenance: {
        signals: {
          source_fn: "deep-web-recon",
          confidence: hasSignals ? 0.78 : 0.45,
        },
        swot: {
          source_fn: "deep-web-recon",
          confidence: hasSWOT ? (hasAi ? 0.85 : 0.55) : 0.3,
        },
        executive_summary: {
          source_fn: "deep-web-recon",
          confidence: executive_summary ? 0.82 : 0.4,
        },
      },
      ai_errors: aiErrors,
      correlation,
    };

    if (targetUserId) {
      try {
        await supabase.from("biqc_insights").upsert(
          {
            user_id: targetUserId,
            status: "ready",
            insight_payload: {
              swot,
              executive_summary: response.executive_summary,
              signals: response.signals,
            },
            last_deep_crawl: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (response.signals.length > 0) {
          await Promise.all(
            response.signals.slice(0, 20).map((signal) =>
              supabase.from("intelligence_actions").insert({
                id: crypto.randomUUID(),
                user_id: targetUserId,
                source: "deep-web-recon",
                source_id: `deep_recon_${Date.now()}_${signal.type}`,
                domain: "market",
                severity: signal.type === "competitor" ? "high" : "medium",
                title: `Deep Recon: ${signal.type}`,
                description: signal.text,
                suggested_action: "Review this signal in context of current strategy.",
                status: "read",
                created_at: new Date().toISOString(),
              })
            ),
          );
        }
      } catch (persistErr) {
        aiErrors.push(`Persistence warning: ${String(persistErr).slice(0, 180)}`);
      }
    }

    return new Response(JSON.stringify(response), { headers: corsHeaders(req) });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        targets_scanned: 0,
        content_bytes: 0,
        signals: [],
        swot: {
          strengths: [],
          weaknesses: [],
          opportunities: [],
          threats: [],
        },
        executive_summary: "",
        sources: [],
        field_provenance: {},
        ai_errors: [...aiErrors, String(err)],
        correlation,
      }),
      { status: 500, headers: corsHeaders(req) },
    );
  }
});
