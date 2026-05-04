// ═══════════════════════════════════════════════════════════════
// MODEL HEALTH CHECK — Supabase Edge Function
// File: supabase/functions/model-health-check/index.ts
//
// Phase 1.X model-name auto-validation probe (2026-05-05 code 13041978).
//
// PURPOSE:
//   Hits the canonical OPENAI_MODEL_NORMAL / ANTHROPIC_MODEL_OPUS /
//   GEMINI_MODEL_PRO with a 1-token request against each provider so we
//   know — at any moment — whether the model names BIQc is configured to
//   call still exist on the live providers. Replaces the silent 400 +
//   empty BDE failure mode that triggered the smsglobal.com incident.
//
// CONTRACT:
//   GET  /functions/v1/model-health-check
//     200 → { ok: true,  reachable: true, results: [...] } when ALL probes succeed
//     503 → { ok: false, reachable: true, results: [...] } when ANY probe fails
//     The `reachable: true` and `function: "model-health-check"` fields keep
//     the same shape as the calibration edge health smoke contract so the
//     CI workflow can validate it the same way.
//
// SECRETS REQUIRED:
//   OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY
//   Optional model overrides:
//     OPENAI_MODEL_NORMAL  ANTHROPIC_MODEL_OPUS  GEMINI_MODEL_PRO
//
// Deploy: supabase functions deploy model-health-check
// ═══════════════════════════════════════════════════════════════

import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { validateModels, firstFailure } from "../_shared/model_validator.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  // GET reachability + full validation. We intentionally do NOT require auth
  // here — this is a synthetic probe consumed by the deploy pipeline + the
  // 5am/5pm AEST infra health check + Andreas-side debugging. It returns
  // ZERO PII and burns < 5 tokens per call.
  const generated_at = new Date().toISOString();
  const results = await validateModels();
  const failure = firstFailure(results);

  // Aggregate verdict — one bad probe flips the whole response to NOT-OK.
  // We keep HTTP 200 vs 503 distinct so the CI gate + browser-based monitors
  // can both make the right decision without parsing the body.
  const allOk = !failure;

  // Body shape mirrors the calibration health smoke (function/reachable/
  // generated_at/ok) so the existing supabase-functions-deploy.yml check
  // that expects those four keys still validates this function.
  const body: Record<string, unknown> = {
    ok: allOk,
    function: "model-health-check",
    reachable: true,
    generated_at,
    results,
  };
  if (!allOk) {
    body.first_failure = {
      provider: failure!.provider,
      model: failure!.model,
      http_status: failure!.http_status ?? null,
      error: failure!.error ?? null,
    };
  }

  return new Response(JSON.stringify(body), {
    status: allOk ? 200 : 503,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
});
