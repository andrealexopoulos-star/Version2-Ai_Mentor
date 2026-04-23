// ═══════════════════════════════════════════════════════════════
// SEMRUSH DOMAIN INTEL — Supabase Edge Function
//
// Pulls real SEO, paid media, and competitive intelligence from
// SEMrush API for a given domain. Replaces heuristic-based
// analysis with authoritative data.
//
// Endpoints used:
//   1. domain_rank      — organic/paid overview (rank, keywords, traffic, cost)
//   2. domain_organic    — top organic keywords
//   3. domain_adwords    — top paid keywords
//   4. domain_organic_organic — organic competitors
//
// Deploy: supabase functions deploy semrush-domain-intel --no-verify-jwt
// Secrets: SEMRUSH_API_KEY
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const SEMRUSH_API_KEY = Deno.env.get("SEMRUSH_API_KEY") || "";
const SEMRUSH_BASE = "https://api.semrush.com/";

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

async function semrushGet(
  params: Record<string, string>,
  aiErrors: string[],
  label: string,
): Promise<Record<string, string>[]> {
  if (!SEMRUSH_API_KEY) {
    aiErrors.push(`${label}: SEMRUSH_API_KEY not configured`);
    return [];
  }
  const url = new URL(SEMRUSH_BASE);
  url.searchParams.set("key", SEMRUSH_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      aiErrors.push(`${label}: HTTP ${res.status} — ${body.slice(0, 200)}`);
      return [];
    }
    const csv = await res.text();
    if (csv.startsWith("ERROR")) {
      aiErrors.push(`${label}: ${csv.slice(0, 200)}`);
      return [];
    }
    return parseSemrushCsv(csv);
  } catch (err) {
    aiErrors.push(`${label}: ${String(err).slice(0, 150)}`);
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
  // The CTO directive is explicit: supplier-key missing MUST NOT return
  // ok:true with empty fields. That pattern creates "fabricated signal"
  // (seo_score/status derived from nothing). Missing key = HARD FAILURE,
  // surfaced upstream so the backend can mark the scan incomplete rather
  // than persisting confident-but-empty analysis.
  //
  // Response shape on hard-fail:
  //   HTTP 503
  //   { ok:false, error:"SEMRUSH_API_KEY missing from edge runtime",
  //     code:"SEMRUSH_API_KEY_MISSING", ai_errors:[...] }
  // This keys into _edge_result_failed() on the backend → enrichment
  // row will NOT persist a fabricated seo_analysis score.
  if (!SEMRUSH_API_KEY) {
    const msg = "SEMRUSH_API_KEY missing from edge runtime";
    console.log("[semrush-domain-intel] hard-fail: " + msg);
    return new Response(
      JSON.stringify({
        ok: false,
        error: msg,
        code: "SEMRUSH_API_KEY_MISSING",
        ai_errors: [msg],
      }),
      { status: 503, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const aiErrors: string[] = [];
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

    const [overviewRows, organicRows, adwordsRows, competitorRows] =
      await Promise.all([
        semrushGet(
          {
            type: "domain_rank",
            domain,
            database,
            export_columns: "Dn,Rk,Or,Ot,Oc,Ad,At,Ac,FKn,FPn",
          },
          aiErrors,
          "domain_rank",
        ),
        semrushGet(
          {
            type: "domain_organic",
            domain,
            database,
            display_limit: "20",
            export_columns: "Ph,Po,Nq,Cp,Ur,Tr,Tc,Co,Kd",
            display_sort: "tr_desc",
          },
          aiErrors,
          "domain_organic",
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
          aiErrors,
          "domain_adwords",
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
          aiErrors,
          "domain_organic_organic",
        ),
      ]);

    const ov = overviewRows[0] || {};
    const toNum = (v: string | undefined) => {
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const seoAnalysis = {
      semrush_rank: toNum(ov["Rank"]) ?? toNum(ov["Rk"]),
      organic_keywords: toNum(ov["Organic Keywords"]) ?? toNum(ov["Or"]),
      organic_traffic: toNum(ov["Organic Traffic"]) ?? toNum(ov["Ot"]),
      organic_cost_usd: toNum(ov["Organic Cost"]) ?? toNum(ov["Oc"]),
      featured_snippets: toNum(ov["FKn"]),
      featured_positions: toNum(ov["FPn"]),
      top_organic_keywords: organicRows.slice(0, 20).map((r) => ({
        keyword: r["Ph"] || r["Keyword"],
        position: toNum(r["Po"] || r["Position"]),
        search_volume: toNum(r["Nq"] || r["Search Volume"]),
        cpc: toNum(r["Cp"] || r["CPC"]),
        url: r["Ur"] || r["Url"],
        traffic: toNum(r["Tr"] || r["Traffic"]),
        traffic_cost: toNum(r["Tc"] || r["Traffic Cost"]),
        competition: toNum(r["Co"] || r["Competition"]),
        keyword_difficulty: toNum(r["Kd"] || r["Keyword Difficulty"]),
      })),
      score: null as number | null,
      status: "unknown",
      source: "semrush",
    };

    const orgKw = seoAnalysis.organic_keywords;
    if (orgKw !== null) {
      if (orgKw > 10000) {
        seoAnalysis.score = 90;
        seoAnalysis.status = "strong";
      } else if (orgKw > 1000) {
        seoAnalysis.score = 70;
        seoAnalysis.status = "moderate";
      } else if (orgKw > 100) {
        seoAnalysis.score = 45;
        seoAnalysis.status = "developing";
      } else {
        seoAnalysis.score = 20;
        seoAnalysis.status = "weak";
      }
    }

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
        "No paid search activity detected by SEMrush. This domain does not appear to be running Google Ads campaigns.";
    }

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
      competitor_count: competitorRows.length,
      source: "semrush",
    };

    // ─── Incident H / SEMRUSH P0 Step 2: supplier-API total-failure guard ───
    // Distinguish "SEMrush returned empty because domain has no SEO footprint"
    // (valid soft result) from "every SEMrush request failed due to auth/rate
    // limit/transient error" (silent failure class the CTO flagged).
    //
    // Rule: if EVERY semrushGet returned zero rows AND at least one aiErrors
    // entry exists → hard-fail. We cannot return ok:true for a domain when
    // the reason we saw no data is "we failed to actually query the data".
    const totalRows = overviewRows.length + organicRows.length +
                      adwordsRows.length + competitorRows.length;
    if (totalRows === 0 && aiErrors.length > 0) {
      const errSummary = aiErrors.slice(0, 4).join(" | ");
      console.log("[semrush-domain-intel] hard-fail: all supplier calls failed — " + errSummary);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "SEMrush supplier API failed for every call",
          code: "SEMRUSH_SUPPLIER_TOTAL_FAILURE",
          ai_errors: aiErrors,
          correlation,
        }),
        { status: 503, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const response = {
      ok: true,
      domain,
      database,
      seo_analysis: seoAnalysis,
      paid_media_analysis: paidMediaAnalysis,
      competitor_analysis: competitorAnalysis,
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
    // Incident H: exceptions are hard failures, not soft-ok. Surface as 5xx
    // so _edge_result_failed() on the backend marks the call failed.
    console.log("[semrush-domain-intel] hard-fail: exception — " + String(err).slice(0, 200));
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err).slice(0, 200),
        code: "SEMRUSH_EXCEPTION",
        ai_errors: aiErrors,
        seo_analysis: null,
        paid_media_analysis: null,
        competitor_analysis: null,
        correlation,
      }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
