// ═══════════════════════════════════════════════════════════════
// Phase 1.X model-name auto-validation (2026-05-05 code 13041978):
// Probes each configured LLM provider with a tiny request at function
// cold-start to confirm the configured model name is REAL.
//
// If a provider returns model_not_found / 400 invalid model, the result
// is captured here and surfaced via the model-health-check edge function
// so deploys / synthetic checks fail LOUDLY instead of silently producing
// 400s on every customer call (the smsglobal.com 2026-05-04 incident).
//
// Honoured env vars (when set on Supabase Edge runtime):
//   OPENAI_API_KEY              hard-required for openai probe
//   ANTHROPIC_API_KEY           hard-required for anthropic probe
//   GOOGLE_API_KEY              hard-required for google probe
//   OPENAI_MODEL_NORMAL         default normal-tier OpenAI model       (fallback: gpt-4o)
//   OPENAI_MODEL_DEEP           default deep-tier  OpenAI model        (fallback: gpt-4o)
//   OPENAI_MODEL_MINI           cheap+fast OpenAI                      (fallback: gpt-4o-mini)
//   ANTHROPIC_MODEL_OPUS        default Anthropic model                (fallback: claude-3-5-sonnet-20241022)
//   ANTHROPIC_MODEL_SONNET      Sonnet alias                           (fallback: claude-3-5-sonnet-20241022)
//   GEMINI_MODEL_PRO            default Gemini model                   (fallback: gemini-1.5-pro)
//
// The fallbacks are SAFE PRODUCTION-AVAILABLE model names — never an
// unreleased preview. If an env var is unset we still hit a real model.
// ═══════════════════════════════════════════════════════════════

export interface ModelValidationResult {
  ok: boolean;
  provider: string;
  model: string;
  http_status?: number;
  error?: string;
  checked_at: string;
}

// ── Safe production-available defaults (never hardcode previews) ──────────────
export const SAFE_OPENAI_NORMAL = "gpt-4o";
export const SAFE_OPENAI_MINI = "gpt-4o-mini";
export const SAFE_ANTHROPIC = "claude-3-5-sonnet-20241022";
export const SAFE_ANTHROPIC_HAIKU = "claude-3-5-haiku-20241022";
export const SAFE_GEMINI_PRO = "gemini-1.5-pro";
export const SAFE_GEMINI_FLASH = "gemini-1.5-flash";

// Resolve the runtime model for a given role, honouring env first then safe default.
export function resolveOpenAINormalModel(): string {
  return Deno.env.get("OPENAI_MODEL_NORMAL") || SAFE_OPENAI_NORMAL;
}
export function resolveOpenAIDeepModel(): string {
  return Deno.env.get("OPENAI_MODEL_DEEP") || SAFE_OPENAI_NORMAL;
}
export function resolveOpenAIMiniModel(): string {
  return Deno.env.get("OPENAI_MODEL_MINI") || SAFE_OPENAI_MINI;
}
export function resolveAnthropicOpusModel(): string {
  return Deno.env.get("ANTHROPIC_MODEL_OPUS") || SAFE_ANTHROPIC;
}
export function resolveAnthropicSonnetModel(): string {
  return Deno.env.get("ANTHROPIC_MODEL_SONNET") || SAFE_ANTHROPIC;
}
export function resolveGeminiProModel(): string {
  return Deno.env.get("GEMINI_MODEL_PRO") || SAFE_GEMINI_PRO;
}

// ── Internal: probe one provider with a tiny request to confirm the model exists.
async function probeOpenAI(model: string): Promise<ModelValidationResult> {
  const checked_at = new Date().toISOString();
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    return { ok: false, provider: "openai", model, error: "OPENAI_API_KEY not set", checked_at };
  }
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });
    if (r.status === 200) {
      return { ok: true, provider: "openai", model, http_status: 200, checked_at };
    }
    const bodyText = await r.text().catch(() => "");
    return {
      ok: false,
      provider: "openai",
      model,
      http_status: r.status,
      error: `HTTP ${r.status}: ${bodyText.slice(0, 250)}`,
      checked_at,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "openai",
      model,
      error: String(e).slice(0, 250),
      checked_at,
    };
  }
}

async function probeAnthropic(model: string): Promise<ModelValidationResult> {
  const checked_at = new Date().toISOString();
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return { ok: false, provider: "anthropic", model, error: "ANTHROPIC_API_KEY not set", checked_at };
  }
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    if (r.status === 200) {
      return { ok: true, provider: "anthropic", model, http_status: 200, checked_at };
    }
    const bodyText = await r.text().catch(() => "");
    return {
      ok: false,
      provider: "anthropic",
      model,
      http_status: r.status,
      error: `HTTP ${r.status}: ${bodyText.slice(0, 250)}`,
      checked_at,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "anthropic",
      model,
      error: String(e).slice(0, 250),
      checked_at,
    };
  }
}

async function probeGoogle(model: string): Promise<ModelValidationResult> {
  const checked_at = new Date().toISOString();
  const key = Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    return { ok: false, provider: "google", model, error: "GOOGLE_API_KEY not set", checked_at };
  }
  // Strip an accidental "-preview" suffix if someone sets a preview-style name —
  // Google's REST URL only accepts the canonical name without that suffix.
  const cleanModel = model.replace("-preview", "");
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 1, temperature: 0.0 },
        }),
      },
    );
    if (r.status === 200) {
      return { ok: true, provider: "google", model: cleanModel, http_status: 200, checked_at };
    }
    const bodyText = await r.text().catch(() => "");
    return {
      ok: false,
      provider: "google",
      model: cleanModel,
      http_status: r.status,
      error: `HTTP ${r.status}: ${bodyText.slice(0, 250)}`,
      checked_at,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "google",
      model: cleanModel,
      error: String(e).slice(0, 250),
      checked_at,
    };
  }
}

// Public entry point — probe all 3 in parallel and return per-provider verdict.
export async function validateModels(): Promise<ModelValidationResult[]> {
  const openaiNormal = resolveOpenAINormalModel();
  const anthropicOpus = resolveAnthropicOpusModel();
  const geminiPro = resolveGeminiProModel();

  const [openai, anthropic, google] = await Promise.all([
    probeOpenAI(openaiNormal),
    probeAnthropic(anthropicOpus),
    probeGoogle(geminiPro),
  ]);

  return [openai, anthropic, google];
}

// Helper: returns the first failed probe so callers can surface a single error string.
export function firstFailure(results: ModelValidationResult[]): ModelValidationResult | null {
  for (const r of results) {
    if (!r.ok) return r;
  }
  return null;
}
