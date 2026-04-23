// TEMPORARY — DO NOT RETAIN. One-shot edge-secrets presence reporter.
// Incident H (2026-04-23) CTO approval: must be deleted within 10 minutes
// of first invocation. Deletion workflow:
//   gh workflow run supabase-function-delete.yml -f function_name=debug-edge-secrets
//
// Strict contract:
//   - Caller MUST be service_role (verifyAuth + auth.isServiceRole === true);
//     any other caller → 401.
//   - Response is a flat map of 5 keys to boolean presence only.
//   - No lengths, no prefixes, no masked strings, no timestamps, no metadata.
//   - No logs that reveal value content.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPPLIER_KEYS = [
  "OPENAI_API_KEY",
  "FIRECRAWL_API_KEY",
  "PERPLEXITY_API_KEY",
  "BROWSE_AI_API_KEY",
  "SEMRUSH_API_KEY",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const auth = await verifyAuth(req);
  if (!auth.ok || !auth.isServiceRole) {
    return new Response(
      JSON.stringify({ ok: false, error: "service_role required" }),
      { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const report: Record<string, boolean> = {};
  for (const key of SUPPLIER_KEYS) {
    report[key] = !!Deno.env.get(key);
  }

  console.log("[debug-edge-secrets] key presence checked");

  return new Response(
    JSON.stringify(report),
    { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
  );
});
