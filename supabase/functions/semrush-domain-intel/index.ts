// ═══════════════════════════════════════════════════════════════
// SEMRUSH DOMAIN INTEL — Supabase Edge Function
//
// Pulls real SEO, paid media, competitive, keyword, backlink, and
// advertising intelligence from SEMrush API for a given domain.
// Replaces heuristic-based analysis with authoritative data.
//
// Endpoints (8 total — budget cap from R2D brief):
//   1. domain_rank                — overview (rank, kw counts, traffic, cost)
//   2. domain_organic             — top 100 organic keywords (was 20; R2D bumps to 100)
//   3. domain_adwords             — top 20 paid keywords
//   4. domain_organic_organic     — top 10 organic competitors (with details)
//   5. domain_adwords_adwords     — top 10 paid competitors
//   6. backlinks_overview         — domain backlink profile (analytics/v1 host)
//   7. domain_organic_pages [NEW] — top 20 organic landing pages
//   8. domain_adwords_history [NEW] — 12-month paid-search history
//
// API UNITS BUDGET (corrected by F15 2026-05-04 — old comment claimed
// 232 units worst-case which understated true cost by ~15×; see
// evidence_f15/F15-units-budget-explainer.md for derivation).
//
// Per-call worst-case units (display_limit × per-line cost):
//   1. domain_rank             flat 10 units                          (10)
//   2. domain_organic          100 lines × 10 units/line              (1000)
//   3. domain_adwords          20 lines  × 20 units/line              (400)
//   4. domain_organic_organic  10 lines  × 40 units/line              (400)
//   5. domain_adwords_adwords  10 lines  × 40 units/line              (400)
//   6. backlinks_overview      flat 40 units                          (40)
//   7. domain_organic_pages    20 lines  × 10 units/line              (200)
//   8. domain_adwords_history  12 lines  × 100 units/line             (1200)
//   ───────────────────────────────────────────────────────────────
//   Total uncached per scan:   ~3650 units worst-case
//   Typical (low-traffic domain returning few rows): ~200–600 units
//
// Plan capacity (from semrush.com/pricing — Apr 2026 snapshot):
//   - Pro       (~$140/mo) →   1,000,000 units/month → ~273 worst-case scans
//   - Guru      (~$250/mo) →   3,000,000 units/month → ~821 worst-case scans
//   - Business  (~$500/mo) →   5,000,000 units/month → ~1369 worst-case scans
//   With 24h cache (see below): effective scan capacity is much higher
//   because most domains are re-scanned within the TTL window.
//
// Cache: backend uses 24h domain-level TTL via scan_cache.set_edge_result
// (R2D bumped EDGE_TTL for SEMrush to SCAN_TTL=86400). Repeated scans of
// the same domain in 24h = ZERO units. THIS IS THE SAVING GRACE — without
// the 24h TTL the per-scan cost would exhaust a Pro plan in <300 scans.
//
// ───────────────────────────────────────────────────────────────
// FAILURE MODES (operator runbook — Contract v2 secure no-silent-failure)
//
// This function returns one of two top-level shapes — NEVER a mixed
// "ok with empty data" success-on-failure (that would violate
// BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2):
//
//   SUCCESS:  { ok: true,  ...intel sections... }
//   FAILURE:  { ok: false, error: { code, message, retryable } }
//
// Internal failure codes (NEVER surfaced to UI — backend sanitizer maps
// them to external state DATA_UNAVAILABLE):
//
//   SEMRUSH_API_KEY_MISSING
//     Meaning:  Edge function environment lacks SEMRUSH_API_KEY secret.
//     Operator: Set the secret via Supabase dashboard → Edge Functions →
//               semrush-domain-intel → Secrets. Redeploy the function.
//
//   SEMRUSH_SUPPLIER_TOTAL_FAILURE
//     Meaning:  All 8 SEMrush API calls returned non-2xx (most commonly
//               401 = invalid/expired key, 403 = plan does not include
//               required endpoints, 429 = monthly unit budget exhausted,
//               or per-IP rate limit blocked the request).
//     Operator runbook (in priority order):
//               1. semrush.com/accounts/subscription → confirm plan tier
//                  includes the API endpoints listed above (Pro+ is
//                  required; Guru+ for backlinks_overview).
//               2. semrush.com/accounts/subscription → confirm monthly
//                  units NOT exhausted (worst-case is ~3650/scan; cache
//                  hit lifts effective capacity 10–100×).
//               3. semrush.com/projects/api → confirm API key is active
//                  AND that the calling IP (Supabase edge runtime egress
//                  IPs) is on the allowlist if IP allowlisting is on.
//               4. Re-rotate the API key if compromised; update the
//                  Supabase secret AND redeploy.
//     This is HARD-FAIL by design (Contract v2): we do NOT degrade to a
//     fabricated SEO score. Frontend shows "Market intelligence
//     temporarily unavailable" via SectionStateBanner.
//
//   SEMRUSH_PARTIAL_FAILURE
//     Meaning:  Some endpoints returned 2xx, some did not. We surface
//               whatever we got, mark the missing sections null, and the
//               sanitizer flags them DEGRADED.
//     Operator: Same as above; usually a single-endpoint plan limitation
//               (e.g. backlinks_overview requires Guru tier).
//
// G0d (operator-side) flagged the underlying SEMrush dashboard issue
// 2026-05-04. F15 added this runbook so future on-call has a clear path.
// ───────────────────────────────────────────────────────────────
//
// Deploy: supabase functions deploy semrush-domain-intel --no-verify-jwt
// Secrets: SEMRUSH_API_KEY
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const SEMRUSH_API_KEY = Deno.env.get("SEMRUSH_API_KEY") || "";
const SEMRUSH_BASE = "https://api.semrush.com/";
// Backlinks API lives on a separate analytics host — confirmed against
// developer.semrush.com/api/v3/analytics/backlinks/ (Apr 2026).
const SEMRUSH_ANALYTICS_BASE = "https://api.semrush.com/analytics/v1/";

// ─── Per-endpoint API-unit cost table (R2D telemetry) ──────────────────
// Source: developer.semrush.com pricing pages, snapshot 2026-04 (organic
// reports = 10 units/line; backlinks_overview = 40 units flat;
// adwords_history = 100 units/line). Used for `api_units_used` rollup.
// Values are per-line where applicable; flat for backlinks/overview.
const UNIT_COSTS: Record<string, { perLine: number; flat: number }> = {
  domain_rank:            { perLine: 0,  flat: 10 },
  domain_organic:         { perLine: 10, flat: 0  },
  domain_adwords:         { perLine: 20, flat: 0  },
  domain_organic_organic: { perLine: 40, flat: 0  },
  domain_adwords_adwords: { perLine: 40, flat: 0  },
  backlinks_overview:     { perLine: 0,  flat: 40 },
  domain_organic_pages:   { perLine: 10, flat: 0  },
  domain_adwords_history: { perLine: 100,flat: 0  },
};

function unitsFor(label: string, rows: number): number {
  const c = UNIT_COSTS[label];
  if (!c) return 0;
  return c.flat + (c.perLine * rows);
}

function parseSemrushCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] || "").trim();
    });
    return row;
  });
}

interface ProviderTrace {
  endpoint: string;
  status: number | null;
  ms: number;
  rows: number;
  units: number;
  ok: boolean;
  failure_reason?: string; // sanitised — never includes raw key/error body
}

async function semrushGet(
  params: Record<string, string>,
  aiErrors: string[],
  label: string,
  traces: ProviderTrace[],
  base: string = SEMRUSH_BASE,
): Promise<Record<string, string>[]> {
  const trace: ProviderTrace = {
    endpoint: label,
    status: null,
    ms: 0,
    rows: 0,
    units: 0,
    ok: false,
  };
  const t0 = Date.now();

  if (!SEMRUSH_API_KEY) {
    aiErrors.push(`${label}: provider key missing`);
    trace.failure_reason = "key_missing";
    trace.ms = Date.now() - t0;
    traces.push(trace);
    return [];
  }
  const url = new URL(base);
  url.searchParams.set("key", SEMRUSH_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timer);
    trace.status = res.status;
    trace.ms = Date.now() - t0;

    if (!res.ok) {
      // ─── Contract v2 sanitisation ───────────────────────────────────
      // Never include raw response body in the public payload — it can
      // contain "ERROR 134 :: NOTHING FOUND" pluss internals. We surface
      // a sanitised category to ai_errors and a numeric status to the
      // trace. The full body is only logged inside the function.
      const body = await res.text();
      const sanitisedCategory = res.status === 401 || res.status === 403
        ? "auth_failed"
        : res.status === 429
          ? "rate_limited"
          : res.status >= 500
            ? "supplier_5xx"
            : "supplier_4xx";
      console.log(`[semrush-domain-intel] ${label} HTTP ${res.status} (${sanitisedCategory}) — body: ${body.slice(0, 200)}`);
      aiErrors.push(`${label}: ${sanitisedCategory}`);
      trace.failure_reason = sanitisedCategory;
      traces.push(trace);
      return [];
    }
    const csv = await res.text();
    if (csv.startsWith("ERROR")) {
      // SEMrush returns 200 with body "ERROR 50 :: NOTHING FOUND" for
      // domains it has no data on. Distinguish "nothing found" (soft
      // empty — not a failure) from harder ERROR codes (10/132/134) —
      // some indicate "no API access" which IS a failure.
      const errLine = csv.split("\n")[0] || "";
      const code = (errLine.match(/ERROR\s+(\d+)/) || [])[1] || "unknown";
      const isNothingFound = /NOTHING FOUND|No data|No keyword/i.test(csv);
      if (isNothingFound) {
        // Treat as a soft empty result — domain genuinely has no data.
        // Don't push aiErrors; don't mark trace as failed.
        console.log(`[semrush-domain-intel] ${label} soft-empty: ${csv.slice(0, 120)}`);
        trace.ok = true;
        traces.push(trace);
        return [];
      }
      console.log(`[semrush-domain-intel] ${label} ERROR ${code} — body: ${csv.slice(0, 200)}`);
      aiErrors.push(`${label}: provider_error_${code}`);
      trace.failure_reason = `provider_error_${code}`;
      traces.push(trace);
      return [];
    }
    const rows = parseSemrushCsv(csv);
    trace.ok = true;
    trace.rows = rows.length;
    trace.units = unitsFor(label, rows.length);
    traces.push(trace);
    return rows;
  } catch (err) {
    trace.ms = Date.now() - t0;
    const isTimeout = String(err).toLowerCase().includes("abort");
    console.log(`[semrush-domain-intel] ${label} exception: ${String(err).slice(0, 200)}`);
    aiErrors.push(`${label}: ${isTimeout ? "timeout" : "transport_error"}`);
    trace.failure_reason = isTimeout ? "timeout" : "transport_error";
    traces.push(trace);
    return [];
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
        function: "semrush-domain-intel",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders(req) },
    );
  }

  // ─── Incident H / SEMRUSH P0 (2026-04-23): hard-fail supplier-key gap ───
  // Missing key = HARD FAILURE, surfaced upstream so the backend can mark
  // the scan incomplete rather than persisting confident-but-empty analysis.
  if (!SEMRUSH_API_KEY) {
    const msg = "Provider key missing from edge runtime";
    console.log("[semrush-domain-intel] hard-fail: " + msg);
    return new Response(
      JSON.stringify({
        ok: false,
        error: msg,
        // NB: code is internal-only (sanitiser strips before frontend).
        code: "PROVIDER_KEY_MISSING",
        ai_errors: [msg],
      }),
      { status: 503, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const aiErrors: string[] = [];
  const traces: ProviderTrace[] = [];
  const correlation = {
    run_id: req.headers.get("x-calibration-run-id") || null,
    step: req.headers.get("x-calibration-step") || null,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const rawDomain: string = body.domain || body.website || "";
    const domain = rawDomain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .toLowerCase()
      .trim();
    const database: string = body.database || "us";

    if (!domain) {
      return new Response(
        JSON.stringify({ ok: false, error: "domain is required" }),
        { status: 400, headers: corsHeaders(req) },
      );
    }

    // ─── R2D parallel fan-out: 8 SEMrush API calls ─────────────────────
    // All 8 dispatched in a single Promise.all. Per-call timeout 20s;
    // failure of one does not abort others (each has its own try/catch
    // inside semrushGet). aiErrors accumulates per-failure category;
    // traces[] carries per-call telemetry for downstream provider_usage
    // rollup.
    const [
      overviewRows,           // 1. domain_rank
      organicRows,            // 2. domain_organic (top 100)
      adwordsRows,            // 3. domain_adwords
      competitorRows,         // 4. domain_organic_organic (top 10)
      paidCompetitorRows,     // 5. domain_adwords_adwords
      backlinksRows,          // 6. backlinks_overview (analytics host)
      organicPagesRows,       // 7. domain_organic_pages [R2D NEW]
      adwordsHistoryRows,     // 8. domain_adwords_history [R2D NEW]
    ] = await Promise.all([
      semrushGet(
        {
          type: "domain_rank",
          domain,
          database,
          export_columns: "Dn,Rk,Or,Ot,Oc,Ad,At,Ac,FKn,FPn",
        },
        aiErrors, "domain_rank", traces,
      ),
      // ─── R2D: bumped display_limit 20 → 100 for full keyword spectrum.
      // Powers SWOT (current ranking strengths) + Roadmap (target keywords
      // to improve) + Brand-strength scoring with full distribution.
      semrushGet(
        {
          type: "domain_organic",
          domain,
          database,
          display_limit: "100",
          export_columns: "Ph,Po,Nq,Cp,Ur,Tr,Tc,Co,Kd",
          display_sort: "tr_desc",
        },
        aiErrors, "domain_organic", traces,
      ),
      semrushGet(
        {
          type: "domain_adwords",
          domain,
          database,
          display_limit: "20",
          export_columns: "Ph,Po,Nq,Cp,Ur,Tr,Tc,Co",
          display_sort: "tr_desc",
        },
        aiErrors, "domain_adwords", traces,
      ),
      semrushGet(
        {
          type: "domain_organic_organic",
          domain,
          database,
          display_limit: "10",
          export_columns: "Dn,Cr,Np,Or,Ot,Oc,Ad",
          display_sort: "np_desc",
        },
        aiErrors, "domain_organic_organic", traces,
      ),
      semrushGet(
        {
          type: "domain_adwords_adwords",
          domain,
          database,
          display_limit: "10",
          export_columns: "Dn,Np,Ad,At,Ac",
          display_sort: "np_desc",
        },
        aiErrors, "domain_adwords_adwords", traces,
      ),
      // Backlinks API uses the analytics/v1 host (different from the main
      // SEMrush API). Documented at developer.semrush.com/api/v3/analytics/backlinks/.
      // Requires the Backlinks API add-on; without it, returns 401/403 and
      // we leave the field null (no fabrication).
      semrushGet(
        {
          type: "backlinks_overview",
          target: domain,
          target_type: "root_domain",
          export_columns: "ascore,total,domains_num,urls_num,ips_num,ipclassc_num,follows_num,nofollows_num",
        },
        aiErrors, "backlinks_overview", traces,
        SEMRUSH_ANALYTICS_BASE,
      ),
      // ─── R2D NEW #7: domain_organic_pages — top organic landing pages.
      // Powers Roadmap (which pages to optimise), Content strategy
      // (high-traffic page list), CMO Strategic Roadmap section.
      // Export columns:
      //   Ur = URL, Pc = Page traffic count (organic), Tg = traffic share %,
      //   Rk = rank within domain, Or = number of organic keywords on page.
      semrushGet(
        {
          type: "domain_organic_pages",
          domain,
          database,
          display_limit: "20",
          export_columns: "Ur,Pc,Tg,Rk,Or",
          display_sort: "tg_desc",
        },
        aiErrors, "domain_organic_pages", traces,
      ),
      // ─── R2D NEW #8: domain_adwords_history — 12-month paid posture.
      // Powers Competitive Landscape (ad-spend trend), Market Position
      // Score (advertising intensity dimension), CMO Roadmap (paid
      // posture inference).
      // Export columns: Dt = date, Po = position, Cp = cpc, Nq = volume,
      //   Tr = traffic, Ur = URL, Tt = ad title, Ds = ad description.
      semrushGet(
        {
          type: "domain_adwords_history",
          domain,
          database,
          display_limit: "12",
          export_columns: "Dt,Po,Cp,Nq,Tr,Ur,Tt,Ds",
        },
        aiErrors, "domain_adwords_history", traces,
      ),
    ]);

    const ov = overviewRows[0] || {};
    const toNum = (v: string | undefined) => {
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // ─── 1+2. SEO analysis (domain_rank + domain_organic top 100) ────────
    const allOrganicKeywords = organicRows.map((r) => ({
      keyword: r["Ph"] || r["Keyword"],
      position: toNum(r["Po"] || r["Position"]),
      search_volume: toNum(r["Nq"] || r["Search Volume"]),
      cpc: toNum(r["Cp"] || r["CPC"]),
      url: r["Ur"] || r["Url"],
      traffic: toNum(r["Tr"] || r["Traffic"]),
      traffic_cost: toNum(r["Tc"] || r["Traffic Cost"]),
      competition: toNum(r["Co"] || r["Competition"]),
      keyword_difficulty: toNum(r["Kd"] || r["Keyword Difficulty"]),
    }));

    const seoAnalysis = {
      semrush_rank: toNum(ov["Rank"]) ?? toNum(ov["Rk"]),
      organic_keywords: toNum(ov["Organic Keywords"]) ?? toNum(ov["Or"]),
      organic_traffic: toNum(ov["Organic Traffic"]) ?? toNum(ov["Ot"]),
      organic_cost_usd: toNum(ov["Organic Cost"]) ?? toNum(ov["Oc"]),
      featured_snippets: toNum(ov["FKn"]),
      featured_positions: toNum(ov["FPn"]),
      // Keep legacy top_organic_keywords[20] for backward compat with
      // intelligence_modules.py / cmo report consumer that slices [:10].
      top_organic_keywords: allOrganicKeywords.slice(0, 20),
      score: null as number | null,
      status: "unknown",
      source: "semrush",
    };

    const orgKw = seoAnalysis.organic_keywords;
    if (orgKw !== null) {
      if (orgKw > 10000) { seoAnalysis.score = 90; seoAnalysis.status = "strong"; }
      else if (orgKw > 1000) { seoAnalysis.score = 70; seoAnalysis.status = "moderate"; }
      else if (orgKw > 100) { seoAnalysis.score = 45; seoAnalysis.status = "developing"; }
      else { seoAnalysis.score = 20; seoAnalysis.status = "weak"; }
    }

    // ─── 3. Paid media (domain_adwords) ───────────────────────────────────
    const paidMediaAnalysis = {
      adwords_keywords: toNum(ov["Adwords Keywords"]) ?? toNum(ov["Ad"]),
      adwords_traffic: toNum(ov["Adwords Traffic"]) ?? toNum(ov["At"]),
      adwords_cost_usd: toNum(ov["Adwords Cost"]) ?? toNum(ov["Ac"]),
      top_paid_keywords: adwordsRows.slice(0, 20).map((r) => ({
        keyword: r["Ph"] || r["Keyword"],
        position: toNum(r["Po"] || r["Position"]),
        search_volume: toNum(r["Nq"] || r["Search Volume"]),
        cpc: toNum(r["Cp"] || r["CPC"]),
        url: r["Ur"] || r["Url"],
        traffic: toNum(r["Tr"] || r["Traffic"]),
        traffic_cost: toNum(r["Tc"] || r["Traffic Cost"]),
      })),
      maturity: "unknown",
      assessment: "",
      source: "semrush",
    };

    const adKw = paidMediaAnalysis.adwords_keywords;
    const adCost = paidMediaAnalysis.adwords_cost_usd;
    if (adKw !== null && adKw > 0) {
      paidMediaAnalysis.maturity = adKw > 100 ? "aggressive" : adKw > 10 ? "active" : "testing";
      paidMediaAnalysis.assessment =
        `Active paid search detected: ${adKw.toLocaleString()} keywords driving ~${(paidMediaAnalysis.adwords_traffic || 0).toLocaleString()} monthly visits. ` +
        `Estimated monthly spend: $${(adCost || 0).toLocaleString()}.`;
    } else {
      paidMediaAnalysis.maturity = "none_detected";
      paidMediaAnalysis.assessment =
        "No paid search activity detected for this domain.";
    }

    // ─── 4. Competitor analysis (organic competitors) ─────────────────────
    // R2D: each competitor row already returns a mini-overview (Or, Ot, Oc, Ad)
    // via export_columns on the competitor call — that IS their domain_overview.
    // We surface this as `detailed_competitors` per the R2D brief WITHOUT
    // making 10 extra per-competitor calls (which would blow the budget).
    const competitorAnalysis = {
      organic_competitors: competitorRows.slice(0, 10).map((r) => ({
        domain: r["Dn"] || r["Domain"],
        common_keywords: toNum(r["Cr"] || r["Common Keywords"]),
        total_keywords: toNum(r["Np"]),
        organic_keywords: toNum(r["Or"] || r["Organic Keywords"]),
        organic_traffic: toNum(r["Ot"] || r["Organic Traffic"]),
        organic_cost: toNum(r["Oc"] || r["Organic Cost"]),
        adwords_keywords: toNum(r["Ad"] || r["Adwords Keywords"]),
      })),
      // R2D NEW: detailed_competitors top-10 with the full overview slice
      // already included in the same row. Saves 10 extra API calls vs naive
      // per-competitor domain_overview fan-out.
      detailed_competitors: competitorRows.slice(0, 10).map((r, idx) => ({
        rank: idx + 1,
        domain: r["Dn"] || r["Domain"],
        common_keywords: toNum(r["Cr"] || r["Common Keywords"]),
        total_keywords: toNum(r["Np"]),
        organic_keywords: toNum(r["Or"] || r["Organic Keywords"]),
        organic_traffic: toNum(r["Ot"] || r["Organic Traffic"]),
        organic_cost_usd: toNum(r["Oc"] || r["Organic Cost"]),
        adwords_keywords: toNum(r["Ad"] || r["Adwords Keywords"]),
        // Lightweight inferred competitive intensity tier so the CMO report
        // can render a glanceable signal without consuming the dial fields.
        competitive_intensity_tier: (() => {
          const ot = toNum(r["Ot"]) || 0;
          if (ot > 100000) return "dominant";
          if (ot > 10000) return "strong";
          if (ot > 1000) return "established";
          return "emerging";
        })(),
      })),
      competitor_count: competitorRows.length,
      source: "semrush",
    };

    // ─── 5. Paid competitor analysis ─────────────────────────────────────
    const paidCompetitorAnalysis = {
      paid_competitors: paidCompetitorRows.slice(0, 10).map((r) => ({
        domain: r["Dn"] || r["Domain"],
        total_keywords: toNum(r["Np"]),
        adwords_keywords: toNum(r["Ad"] || r["Adwords Keywords"]),
        adwords_traffic: toNum(r["At"] || r["Adwords Traffic"]),
        adwords_cost: toNum(r["Ac"] || r["Adwords Cost"]),
      })),
      paid_competitor_count: paidCompetitorRows.length,
      source: "semrush",
    };

    // ─── 6. Backlink profile ─────────────────────────────────────────────
    const bl = backlinksRows[0] || {};
    const totalBl = toNum(bl["total"]);
    const refDomains = toNum(bl["domains_num"]);
    const followsNum = toNum(bl["follows_num"]);
    const nofollowsNum = toNum(bl["nofollows_num"]);
    const followRatio = (followsNum !== null && nofollowsNum !== null && (followsNum + nofollowsNum) > 0)
      ? Math.round((followsNum / (followsNum + nofollowsNum)) * 1000) / 1000
      : null;
    const backlinkProfile = backlinksRows.length > 0 && totalBl !== null ? {
      total_backlinks: totalBl,
      referring_domains: refDomains,
      referring_urls: toNum(bl["urls_num"]),
      referring_ips: toNum(bl["ips_num"]),
      referring_ip_class_c: toNum(bl["ipclassc_num"]),
      authority_score: toNum(bl["ascore"]) ?? toNum(bl["score"]),
      follow_links: followsNum,
      nofollow_links: nofollowsNum,
      follow_ratio: followRatio,
      // Heuristic: SEMrush does not publish a `toxic_backlinks_pct` on
      // the overview endpoint (that's the audit endpoint, separate quota).
      // Surface as null per Contract v2 — never fabricated.
      toxic_backlinks_pct: null,
      source: "semrush",
    } : null;

    // ─── 7. R2D NEW: keyword_intelligence (organic kw top 100 + top pages) ─
    const topPages = organicPagesRows.slice(0, 20).map((r) => ({
      page_url: r["Ur"] || r["Url"],
      organic_traffic: toNum(r["Pc"]),
      traffic_pct: toNum(r["Tg"]),
      page_rank: toNum(r["Rk"]),
      organic_keywords: toNum(r["Or"]),
    }));

    const keywordIntelligence = (allOrganicKeywords.length > 0 || topPages.length > 0) ? {
      // Full top-100 organic keyword spectrum (already computed above for
      // seo_analysis.top_organic_keywords[:20]). Surface as a separate
      // section so consumers can iterate the long tail without re-fetching.
      organic_keywords: allOrganicKeywords,
      organic_keywords_count: allOrganicKeywords.length,
      // Top 20 organic landing pages for content strategy + roadmap.
      top_pages: topPages,
      top_pages_count: topPages.length,
      source: "semrush",
    } : null;

    // ─── 8. R2D NEW: advertising_intelligence (12-month adwords history) ──
    const adHistory12m = adwordsHistoryRows.slice(0, 12).map((r) => ({
      date: r["Dt"] || r["Date"],
      position: toNum(r["Po"]),
      cpc: toNum(r["Cp"]),
      search_volume: toNum(r["Nq"]),
      traffic: toNum(r["Tr"]),
      url: r["Ur"] || r["Url"],
      ad_title: r["Tt"] || r["Title"] || "",
      ad_description: r["Ds"] || r["Description"] || "",
    }));

    // Roll-up for budget posture inference. Mean/min/max ad activity
    // derived from the 12-row series. Null when no series available.
    const adTrafficSeries = adHistory12m.map((r) => r.traffic).filter((v): v is number => v !== null);
    const advertisingIntelligence = adHistory12m.length > 0 ? {
      ad_history_12m: adHistory12m,
      months_active: adHistory12m.length,
      mean_monthly_traffic: adTrafficSeries.length > 0
        ? Math.round(adTrafficSeries.reduce((a, b) => a + b, 0) / adTrafficSeries.length)
        : null,
      max_monthly_traffic: adTrafficSeries.length > 0 ? Math.max(...adTrafficSeries) : null,
      // Budget-posture inference: classifies advertiser cadence based on
      // months observed. Surfaced as a hint, not a score, per Contract v2.
      budget_posture: adHistory12m.length >= 9 ? "consistent_advertiser"
                    : adHistory12m.length >= 4 ? "intermittent_advertiser"
                    : adHistory12m.length >= 1 ? "occasional_advertiser"
                    : "no_history",
      source: "semrush",
    } : null;

    // ─── Incident H / SEMRUSH P0 Step 2: total-failure guard ─────────────
    // If EVERY semrushGet returned zero rows AND at least one aiErrors
    // entry exists → hard-fail. Updated for 8 endpoints.
    const totalRows = overviewRows.length + organicRows.length +
                      adwordsRows.length + competitorRows.length +
                      paidCompetitorRows.length + backlinksRows.length +
                      organicPagesRows.length + adwordsHistoryRows.length;
    if (totalRows === 0 && aiErrors.length > 0) {
      const errSummary = aiErrors.slice(0, 8).join(" | ");
      console.log("[semrush-domain-intel] hard-fail: all supplier calls failed — " + errSummary);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Provider API failed for every call",
          code: "PROVIDER_TOTAL_FAILURE",
          ai_errors: aiErrors,
          provider_traces: traces,
          correlation,
        }),
        { status: 503, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ─── R2D telemetry: api_units_used roll-up ───────────────────────────
    const apiUnitsUsed = traces.reduce((sum, t) => sum + (t.units || 0), 0);
    const apiCallsMade = traces.length;
    const apiCallsOk = traces.filter((t) => t.ok).length;

    const response = {
      ok: true,
      domain,
      database,
      // Existing sections (preserved for backward compat):
      seo_analysis: seoAnalysis,
      paid_media_analysis: paidMediaAnalysis,
      competitor_analysis: competitorAnalysis,
      paid_competitor_analysis: paidCompetitorAnalysis,
      backlink_profile: backlinkProfile,
      // R2D NEW sections:
      keyword_intelligence: keywordIntelligence,
      advertising_intelligence: advertisingIntelligence,
      // Backwards-compat aliases per R2D brief:
      // - enrichment.backlink_intelligence is the brief's preferred key;
      //   alias to backlink_profile so existing consumers keep working.
      backlink_intelligence: backlinkProfile,
      // R2D telemetry:
      api_units_used: apiUnitsUsed,
      api_calls_made: apiCallsMade,
      api_calls_ok: apiCallsOk,
      provider_traces: traces,
      // Internal scaffolding — sanitised before frontend display by
      // backend response_sanitizer (raw_overview/source keys stripped).
      raw_overview: ov,
      ai_errors: aiErrors,
      correlation,
      generated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders(req),
    });
  } catch (err) {
    console.log("[semrush-domain-intel] hard-fail: exception — " + String(err).slice(0, 200));
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err).slice(0, 200),
        code: "PROVIDER_EXCEPTION",
        ai_errors: aiErrors,
        provider_traces: traces,
        seo_analysis: null,
        paid_media_analysis: null,
        competitor_analysis: null,
        keyword_intelligence: null,
        backlink_intelligence: null,
        advertising_intelligence: null,
        correlation,
      }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
