// ═══════════════════════════════════════════════════════════════════════════
// _shared/metering.ts — usage_ledger emit helper for Deno edge functions
//
// WHY: Python usage_ledger is empty because 90%+ of BIQc LLM calls happen in
// edge functions that never wrote to it. This helper is the Deno mirror of
// backend/core/token_meter.py:emit_consume — same semantics, same columns,
// same pricing map (MODEL_PRICING is kept in lock-step with
// backend/middleware/token_metering.py).
//
// Usage (inside any edge function):
//   import { recordUsage } from "../_shared/metering.ts";
//   ...
//   const aiData = await aiRes.json();
//   const usage = aiData.usage || {};
//   recordUsage({
//     userId: user.id,
//     model: "gpt-5.4",
//     inputTokens: usage.prompt_tokens || 0,
//     outputTokens: usage.completion_tokens || 0,
//     cachedInputTokens: usage.prompt_tokens_details?.cached_tokens || 0,
//     feature: "insights_cognitive",
//   });
//
// Contract:
//   - Fire-and-forget. Does NOT throw. Does NOT block the LLM response path.
//   - Returns Promise<void>; callers can `await` it (no-op beyond scheduling)
//     or ignore it. Either way the insert runs in the background.
//   - Kill switch: env USAGE_LEDGER_ENABLED=false disables every emit.
//
// Schema spec: supabase/migrations/111_usage_ledger.sql
//   kind='consume' REQUIRES model IS NOT NULL AND provider IS NOT NULL.
//   tokens (bigint, >=0) = input + output (no cached double-count).
//   cost_aud_micros is AUD * 1_000_000 (integer for exact accounting).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Env / kill switch ─────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const USAGE_LEDGER_ENABLED = !["0", "false", "no", "off"].includes(
  (Deno.env.get("USAGE_LEDGER_ENABLED") || "true").trim().toLowerCase(),
);
const USD_TO_AUD = parseFloat(Deno.env.get("AUD_USD_RATE") || "1.52");
const PRICING_VERSION = "v1";

// ─── Model pricing (AUD per 1M tokens) ────────────────────────────────────
// MUST mirror backend/middleware/token_metering.py:MODEL_PRICING.
// Keys are canonical model IDs as returned by provider APIs. Unknown model →
// cost_aud_micros = 0, but the row is still inserted (so we can spot gaps).
const MODEL_PRICING: Record<string, { input_per_1m: number; output_per_1m: number }> = {
  // OpenAI GPT-5 family — developers.openai.com/api/docs/pricing verified
  // 2026-04-22. Old map had legacy rates; Pro was 50-67% under-priced.
  "gpt-5.4-pro":         { input_per_1m: 45.60, output_per_1m: 273.60 },
  "gpt-5.4":             { input_per_1m:  3.80, output_per_1m:  22.80 },
  "gpt-5.3":             { input_per_1m:  2.66, output_per_1m:  21.28 },
  "gpt-5.3-chat-latest": { input_per_1m:  2.66, output_per_1m:  21.28 },
  "gpt-5.3-codex":       { input_per_1m:  2.66, output_per_1m:  21.28 },
  "gpt-5.2":       { input_per_1m:  2.66, output_per_1m: 21.28 }, // Trinity GPT contributor. Src: openai.com/api/pricing (verified 2026-04-22 via WebSearch) — $1.75/$14 USD @ 1.52 AUD
  // OpenAI reasoning / synthesis models
  "o3-pro":        { input_per_1m: 30.40, output_per_1m: 121.60 }, // Trinity synthesis. Src: apidog.com + MS Foundry blog (verified 2026-04-22) — $20/$80 USD @ 1.52 AUD. NOTE: more expensive per-token than Opus 4.6
  "o3":            { input_per_1m:  3.04, output_per_1m:  12.16 }, // Reasoning. Src: apidog + OpenAI community (2026-04-22) — $2/$8 USD @ 1.52
  // OpenAI GPT-4o family (still used by several edge functions)
  "gpt-4o":        { input_per_1m:  3.80, output_per_1m: 15.20 },
  "gpt-4o-mini":   { input_per_1m:  0.23, output_per_1m:  0.91 },
  "gpt-4o-realtime-preview-2024-12-17": { input_per_1m: 7.60, output_per_1m: 30.40 },
  // Google Gemini 3 — ai.google.dev/pricing re-verified 2026-04-22.
  // Old values were Gemini 2.5 legacy rates; G3 doubled across the board.
  // Pro tier >200k prompt = 2x price ($4/$18 USD). Not yet modelled — flagged.
  "gemini-3-pro-preview":   { input_per_1m: 3.04, output_per_1m: 18.24 },
  "gemini-3.1-pro-preview": { input_per_1m: 3.04, output_per_1m: 18.24 },
  "gemini-3-flash-preview": { input_per_1m: 0.76, output_per_1m:  4.56 },
  // Anthropic Claude — claude.com/pricing re-verified 2026-04-22.
  // Opus 4.7 is the CURRENT variant per the live pricing page; 4.6 is legacy.
  // Opus was previously mapped at $15/$75 USD — the real rate is $5/$25.
  // Our ledger was OVER-reporting Anthropic cost by 3x until this fix.
  "claude-opus-4-7":    { input_per_1m:  7.60, output_per_1m:  38.00 },
  "claude-opus-4-6":    { input_per_1m:  7.60, output_per_1m:  38.00 },
  "claude-sonnet-4-6":  { input_per_1m:  4.56, output_per_1m:  22.80 },
  // Legacy dated Sonnet 4.0 ID (Claude Code / Desktop still route here).
  "claude-sonnet-4-20250514": { input_per_1m:  4.56, output_per_1m:  22.80 },
  "claude-haiku-4-5":   { input_per_1m:  1.52, output_per_1m:   7.60 },
  // Perplexity (Sonar) — used by biqc-insights-cognitive, market-analysis-ai,
  // competitor-monitor, strategic-console-ai, intelligence-snapshot,
  // social-enrichment, calibration-business-dna. Src: docs.perplexity.ai/docs/
  // getting-started/pricing verified 2026-04-22 via WebSearch. Note: Sonar
  // calls also incur a small per-request search fee that varies by context
  // size — NOT yet modelled here. Token cost is the dominant component.
  "sonar":         { input_per_1m:  0.38, output_per_1m:  3.80 }, // $0.25 / $2.50 USD @ 1.52 AUD
  "sonar-pro":     { input_per_1m:  4.56, output_per_1m: 22.80 }, // $3.00 / $15.00 USD @ 1.52 AUD
  // Embeddings (output is always 0)
  "text-embedding-3-small": { input_per_1m: 0.03, output_per_1m: 0.0 },
};

// Provider cache-bucket multipliers — keep in lock-step with core/plans.py
const ANTHROPIC_CACHE_WRITE_MULT = 1.25;
const ANTHROPIC_CACHE_READ_MULT  = 0.10;
const OPENAI_CACHED_INPUT_MULT   = 0.50;

// One-shot warn guard — avoid log spam for unknown models
const _unknownModelWarned = new Set<string>();

// ─── Helpers ───────────────────────────────────────────────────────────────
type Provider = "openai" | "anthropic" | "google" | "perplexity" | "unknown";

function providerOf(model: string): Provider {
  const m = (model || "").toLowerCase();
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("gemini")) return "google";
  if (m.startsWith("sonar") || m.includes("perplexity")) return "perplexity";
  if (m.startsWith("gpt") || m.startsWith("o3") || m.startsWith("text-embedding") || m.includes("openai")) return "openai";
  return "unknown";
}

/**
 * Rough token estimate for providers that don't return usage counts in the
 * response body (Perplexity Sonar). The 4-chars-per-token heuristic is the
 * standard OpenAI approximation for English prose. Acceptable for GP
 * reporting — off by 10-20% on aggregate but directionally correct.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function normalizeTier(tier?: string | null): string {
  const t = (tier || "free").toLowerCase().trim();
  if (t === "superadmin" || t === "super_admin") return "super_admin";
  if (t === "custom" || t === "custom_build") return "custom_build";
  if (t === "professional" || t === "pro") return "pro";
  if (t === "foundation" || t === "growth" || t === "starter") return "starter";
  if (["business", "enterprise", "trial", "free"].includes(t)) return t;
  return "free";
}

function computeCostAudMicros(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number,
): number {
  if (!model) return 0;
  const price = MODEL_PRICING[model];
  if (!price) {
    if (!_unknownModelWarned.has(model)) {
      _unknownModelWarned.add(model);
      console.warn(`[metering] unknown model in MODEL_PRICING: ${model} (cost_aud_micros=0)`);
    }
    return 0;
  }

  const ti = Math.max(0, inputTokens || 0);
  const to = Math.max(0, outputTokens || 0);
  const tc = Math.max(0, cachedInputTokens || 0);

  const inRate  = price.input_per_1m || 0;
  const outRate = price.output_per_1m || 0;
  const prov = providerOf(model);

  let inputCost: number;
  if (prov === "openai") {
    const nonCached = Math.max(0, ti - tc);
    inputCost = (nonCached / 1_000_000) * inRate
              + (tc / 1_000_000) * inRate * OPENAI_CACHED_INPUT_MULT;
  } else if (prov === "anthropic") {
    // Cache-writes aren't exposed in this helper's signature yet; callers that
    // need them can extend. Matches Python default where tw=0.
    inputCost = (ti / 1_000_000) * inRate
              + (tc / 1_000_000) * inRate * ANTHROPIC_CACHE_READ_MULT;
  } else {
    inputCost = (ti / 1_000_000) * inRate;
  }

  const outputCost = (to / 1_000_000) * outRate;
  const aud = inputCost + outputCost;
  return Math.max(0, Math.round(aud * 1_000_000));
}

// ─── Service-role Supabase client (singleton per edge invocation) ──────────
let _cachedClient: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (_cachedClient) return _cachedClient;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  _cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return _cachedClient;
}

// ─── Public API ────────────────────────────────────────────────────────────
export interface RecordUsageParams {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  feature?: string;
  action?: string;
  provider?: string;
  requestId?: string;
  cacheHit?: boolean;
  tier?: string;
}

/**
 * Fire-and-forget insert into public.usage_ledger (kind='consume').
 *
 * Never throws. Never blocks the caller meaningfully — all DB work runs in
 * a detached promise. Safe to `await` (the await resolves as soon as the
 * background write is scheduled) or to ignore entirely.
 *
 * Guards: missing user_id → return. 0+0 tokens → return. DB error → logged,
 * swallowed, no effect on caller.
 */
export async function recordUsage(params: RecordUsageParams): Promise<void> {
  if (!USAGE_LEDGER_ENABLED) return;
  if (!params.userId) return;

  const ti = Math.max(0, params.inputTokens || 0);
  const to = Math.max(0, params.outputTokens || 0);
  const tc = Math.max(0, params.cachedInputTokens || 0);
  if (ti === 0 && to === 0) return;

  const tt = ti + to;
  const model = params.model || "";
  const prov = params.provider || providerOf(model);
  if (prov === "unknown" && model) {
    console.warn(`[metering] unknown provider for model=${model} — stamping 'unknown'`);
  }

  const costMicros = computeCostAudMicros(model, ti, to, tc);

  const row = {
    user_id: params.userId,
    kind: "consume",
    tokens: tt,
    input_tokens: ti,
    output_tokens: to,
    cached_input_tokens: tc,
    model,
    provider: prov,
    feature: params.feature ?? "llm_call",
    action: params.action ?? null,
    request_id: params.requestId ?? null,
    cost_aud_micros: costMicros,
    cache_hit: params.cacheHit ?? null,
    tier_at_event: normalizeTier(params.tier),
    metadata: { fx_rate: USD_TO_AUD, pricing_version: PRICING_VERSION, source: "edge" },
    created_at: new Date().toISOString(),
  };

  const sb = getServiceClient();
  if (!sb) {
    console.error("[metering] SUPABASE_URL / SERVICE_ROLE_KEY missing — skipping insert");
    return;
  }

  // Fire-and-forget: schedule the insert and return. supabase-js's builder is
  // a PostgrestBuilder (thenable, not a native Promise), so we wrap it in
  // Promise.resolve() to guarantee proper .catch() chaining.
  try {
    Promise.resolve(sb.from("usage_ledger").insert(row))
      .then((result: { error: unknown } | null | undefined) => {
        if (result && (result as { error: unknown }).error) {
          console.error(
            "[metering] usage_ledger insert failed:",
            (result as { error: unknown }).error,
          );
        }
      })
      .catch((err: unknown) => {
        console.error("[metering] usage_ledger insert threw:", err);
      });
  } catch (err) {
    // Synchronous failure in builder construction — log and swallow.
    console.error("[metering] usage_ledger insert scheduling error:", err);
  }
}

/**
 * Convenience helper for Perplexity (Sonar) — the Perplexity API does NOT
 * return usage.prompt_tokens / completion_tokens in the response body, so we
 * estimate from character lengths and delegate to recordUsage. Also stamps
 * provider='perplexity' explicitly since the model prefix gets detected
 * correctly but being explicit keeps the ledger clean.
 *
 * Note: Sonar also incurs a per-request search fee (varies by context size)
 * which is NOT yet modelled — token cost is the dominant component.
 */
export async function recordUsageSonar(params: {
  userId: string;
  model: string;              // "sonar" | "sonar-pro"
  promptText: string;
  responseText: string;
  feature?: string;
  action?: string;
  requestId?: string;
  tier?: string;
}): Promise<void> {
  return recordUsage({
    userId: params.userId,
    model: params.model || "sonar",
    inputTokens: estimateTokens(params.promptText),
    outputTokens: estimateTokens(params.responseText),
    provider: "perplexity",
    feature: params.feature,
    action: params.action,
    requestId: params.requestId,
    tier: params.tier,
  });
}

export { MODEL_PRICING, providerOf, normalizeTier, computeCostAudMicros };
