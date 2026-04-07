// ═══════════════════════════════════════════════════════════════
// WARM-COGNITIVE-ENGINE — Cold Start Mitigation
// Deploy: supabase functions deploy warm-cognitive-engine
// Purpose: Warm Deno runtime + secrets before heavy calls
// Returns: HTTP 204 (no body, no DB writes, no user output)
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  // Touch secrets to force them into memory (no logging, no DB writes)
  const _a = Deno.env.get("OPENAI_API_KEY");
  const _b = Deno.env.get("SUPABASE_URL");
  const _c = Deno.env.get("MERGE_API_KEY");
  const _d = Deno.env.get("PERPLEXITY_API_KEY");

  return new Response(null, {
    status: 204,
    headers: corsHeaders(req),
  });
});
