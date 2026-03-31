// ═══════════════════════════════════════════════════════════════
// BUSINESS IDENTITY LOOKUP — Supabase Edge Function
//
// ABN/Business Registry lookup using the free ABR (Australian
// Business Register) JSON API. Resolves identity when domain
// scan cannot find ABN/address and confidence stays Low.
//
// Inputs:
//   - domain (optional)
//   - business_name_hint (optional)
//   - location_hint (optional)
//   - abn (optional) — if provided, does direct ABN lookup
//
// Outputs:
//   - legal_name, trading_name, ABN, address, match_confidence, match_reason
//
// Deploy: supabase functions deploy business-identity-lookup
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ABR_GUID (register free at abr.business.gov.au/Tools/WebServices)
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ABR_GUID =
  Deno.env.get("ABR_GUID") ||
  Deno.env.get("ABR_GUD") ||
  Deno.env.get("ABR_API_GUID") ||
  "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parse JSONP response from ABR into plain JSON
function parseJsonp(jsonp: string): any {
  const match = jsonp.match(/callback\(([\s\S]*)\)/);
  if (match && match[1]) {
    return JSON.parse(match[1]);
  }
  return JSON.parse(jsonp);
}

// Lookup ABN details by ABN number
async function lookupByAbn(abn: string): Promise<any> {
  if (!ABR_GUID) return null;
  const cleanAbn = abn.replace(/\s/g, '');
  if (cleanAbn.length !== 11) return null;

  try {
    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${cleanAbn}&callback=callback&guid=${ABR_GUID}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    return parseJsonp(text);
  } catch (e) {
    console.error("[abn-lookup] ABN lookup error:", e);
    return null;
  }
}

// Search businesses by name
async function searchByName(name: string, maxResults = 5): Promise<any> {
  if (!ABR_GUID) return null;
  if (!name || name.length < 3) return null;

  try {
    const encodedName = encodeURIComponent(name);
    const url = `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodedName}&maxResults=${maxResults}&callback=callback&guid=${ABR_GUID}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    return parseJsonp(text);
  } catch (e) {
    console.error("[abn-lookup] Name search error:", e);
    return null;
  }
}

// Score how well an ABR result matches the user's hints
function scoreMatch(result: any, hints: { name?: string; location?: string; domain?: string }): number {
  let score = 0;
  const entityName = (result.EntityName || result.BusinessName || result.Name || '').toLowerCase();

  // Name match
  if (hints.name) {
    const hintLower = hints.name.toLowerCase();
    if (entityName.includes(hintLower) || hintLower.includes(entityName)) score += 40;
    else {
      const words = hintLower.split(/\s+/);
      const matchingWords = words.filter(w => entityName.includes(w));
      score += Math.round((matchingWords.length / words.length) * 30);
    }
  }

  // Location match
  if (hints.location && result.AddressState) {
    const hintLower = hints.location.toLowerCase();
    const state = (result.AddressState || '').toLowerCase();
    const postcode = result.AddressPostcode || '';
    if (hintLower.includes(state) || hintLower.includes(postcode)) score += 30;
  }

  // ABN is active
  if (result.AbnStatus === 'Active') score += 20;

  // Has GST registration
  if (result.Gst) score += 10;

  return Math.min(score, 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { domain, business_name_hint, location_hint, abn } = body;

    // Check if ABR_GUID is configured
    if (!ABR_GUID) {
      return new Response(JSON.stringify({
        status: "unavailable",
        message: "ABN Lookup not configured. Register for a free GUID at abr.business.gov.au/Tools/WebServices and add as ABR_GUID secret.",
        legal_name: null,
        trading_name: null,
        abn: null,
        address: null,
        match_confidence: 0,
        match_reason: "ABR API key not configured",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Path 1: Direct ABN lookup
    if (abn) {
      const result = await lookupByAbn(abn);
      if (!result || result.Message) {
        return new Response(JSON.stringify({
          status: "not_found",
          legal_name: null,
          trading_name: null,
          abn: abn,
          address: null,
          match_confidence: 0,
          match_reason: result?.Message || "ABN not found in register",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const entityName = result.EntityName || '';
      const tradingName = result.BusinessName?.[0] || '';
      const state = result.AddressState || '';
      const postcode = result.AddressPostcode || '';

      return new Response(JSON.stringify({
        status: "found",
        legal_name: entityName,
        trading_name: tradingName,
        abn: result.Abn,
        abn_status: result.AbnStatus,
        entity_type: result.EntityTypeName,
        gst_registered: !!result.Gst,
        address: state && postcode ? `${state} ${postcode}` : state || "Not available",
        address_state: state,
        address_postcode: postcode,
        match_confidence: 95,
        match_reason: "Direct ABN match from Australian Business Register",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Path 2: Name search
    if (business_name_hint) {
      const searchResult = await searchByName(business_name_hint);
      if (!searchResult || !searchResult.Names || searchResult.Names.length === 0) {
        return new Response(JSON.stringify({
          status: "not_found",
          legal_name: null,
          trading_name: null,
          abn: null,
          address: null,
          match_confidence: 0,
          match_reason: `No businesses found matching "${business_name_hint}"`,
          suggestions: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Score and rank matches
      const scored = searchResult.Names.map((n: any) => ({
        ...n,
        match_score: scoreMatch(n, { name: business_name_hint, location: location_hint, domain }),
      })).sort((a: any, b: any) => b.match_score - a.match_score);

      const best = scored[0];
      const isConfident = best.match_score >= 50;

      // If confident match, do full ABN lookup for complete details
      let fullDetails = null;
      if (isConfident && best.Abn) {
        fullDetails = await lookupByAbn(best.Abn);
      }

      const entityName = fullDetails?.EntityName || best.Name || '';
      const tradingName = fullDetails?.BusinessName?.[0] || '';
      const state = fullDetails?.AddressState || best.State || '';
      const postcode = fullDetails?.AddressPostcode || best.Postcode || '';

      return new Response(JSON.stringify({
        status: isConfident ? "found" : "ambiguous",
        legal_name: entityName,
        trading_name: tradingName,
        abn: best.Abn || null,
        abn_status: fullDetails?.AbnStatus || "Unknown",
        entity_type: fullDetails?.EntityTypeName || null,
        gst_registered: fullDetails?.Gst ? true : false,
        address: state && postcode ? `${state} ${postcode}` : state || "Not available",
        address_state: state,
        address_postcode: postcode,
        match_confidence: best.match_score,
        match_reason: isConfident
          ? `Matched "${business_name_hint}" in Australian Business Register`
          : `Multiple potential matches found for "${business_name_hint}" - review required`,
        suggestions: scored.slice(0, 5).map((s: any) => ({
          name: s.Name,
          abn: s.Abn,
          state: s.State,
          postcode: s.Postcode,
          score: s.match_score,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // No search criteria provided
    return new Response(JSON.stringify({
      status: "error",
      message: "Provide at least one of: abn, business_name_hint",
      match_confidence: 0,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[business-identity-lookup] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
