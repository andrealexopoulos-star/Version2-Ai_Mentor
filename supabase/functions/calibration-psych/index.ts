// supabase/functions/calibration-psych/index.ts
// Persona Calibration — 9-step operator psychology profiling
// OpenAI Responses API · Structured JSON outputs · Supabase JWT auth

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("Calibration-Psych") || "";
const MODEL = "gpt-5.3";

const STEPS: { [k: number]: { field: string; label: string } } = {
  1: { field: "communication_style", label: "Communication Style" },
  2: { field: "verbosity", label: "Verbosity Preference" },
  3: { field: "bluntness", label: "Blunt vs Diplomatic" },
  4: { field: "risk_posture", label: "Risk Posture" },
  5: { field: "decision_style", label: "Decision Style" },
  6: { field: "accountability_cadence", label: "Accountability Cadence" },
  7: { field: "time_constraints", label: "Time Constraints" },
  8: { field: "challenge_tolerance", label: "Challenge Tolerance" },
  9: { field: "boundaries", label: "Boundaries" },
};

const STEP_QUESTIONS: { [k: number]: string } = {
  1: "To calibrate your advisor voice, which communication format helps you think fastest: bullet points, narrative walkthroughs, data-first summaries, or conversational coaching?",
  2: "When decisions carry risk, how much depth should I default to: minimal signal-only output, moderate context, or comprehensive analysis with evidence?",
  3: "When I detect a strategic risk, which delivery style should I use: blunt and direct, balanced and direct, or diplomatic framing with softer language?",
  4: "How should I tune recommendations against uncertainty: conservative protection, moderate calculated moves, or aggressive growth-first positioning?",
  5: "What is your dominant decision mode under pressure: instinct-led, data-led, consensus-led, or a hybrid of data plus intuition?",
  6: "Which accountability rhythm creates the best execution for you: daily check-ins, weekly reviews, milestone-based updates, or ad-hoc escalation only?",
  7: "How constrained is your strategic bandwidth most weeks: always time-poor, moderate bandwidth, or enough room for deeper analysis?",
  8: "How much intellectual friction should I apply in advice: challenge your assumptions hard, balanced challenge, or mainly supportive execution guidance?",
  9: "Are there any off-limit topics, tones, or boundaries I must respect so this advisor remains trusted and usable for you?",
};

function normalizeStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildStepAck(field: string | null, value: string): string {
  const v = value.length > 0 ? `"${value}"` : "that signal";
  switch (field) {
    case "communication_style":
      return `Communication mode mapped from ${v}.`;
    case "verbosity":
      return `Detail depth calibrated from ${v}.`;
    case "bluntness":
      return `Feedback intensity tuned using ${v}.`;
    case "risk_posture":
      return `Risk tolerance profile set from ${v}.`;
    case "decision_style":
      return `Decision framework aligned to ${v}.`;
    case "accountability_cadence":
      return `Execution cadence locked from ${v}.`;
    case "time_constraints":
      return `Time-pressure profile learned from ${v}.`;
    case "challenge_tolerance":
      return `Challenge threshold configured using ${v}.`;
    case "boundaries":
      return `Advisory boundaries registered from ${v}.`;
    default:
      return "Signal captured for persona calibration.";
  }
}

function buildInProgressMessage(
  capturedField: string | null,
  capturedValue: string,
  nextStep: number,
): string {
  const question = STEP_QUESTIONS[nextStep] || STEP_QUESTIONS[9];
  return `${buildStepAck(capturedField, capturedValue)} ${question}`;
}

function buildFallbackTurn(userMessage: string, step: number): Record<string, unknown> {
  const field = STEPS[step]?.field || null;
  const value = normalizeStr(userMessage);
  const isComplete = step >= 9;
  const nextStep = Math.min(step + 1, 9);
  return {
    message: isComplete
      ? "Calibration complete. Your advisory voice is now configured."
      : buildInProgressMessage(field, value, nextStep),
    status: isComplete ? "COMPLETE" : "IN_PROGRESS",
    step: isComplete ? 9 : nextStep,
    percentage: isComplete ? 100 : Math.round((step / 9) * 100),
    captured_field: field,
    captured_value: value || null,
    agent_persona: null,
    agent_instructions: null,
  };
}

const TURN_SCHEMA = {
  type: "json_schema" as const,
  name: "calibration_turn",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      message: { type: "string" as const },
      status: { type: "string" as const, enum: ["IN_PROGRESS", "COMPLETE"] },
      step: { type: "number" as const },
      percentage: { type: "number" as const },
      captured_field: { type: ["string", "null"] as const },
      captured_value: { type: ["string", "null"] as const },
      agent_persona: { type: ["string", "null"] as const },
      agent_instructions: { type: ["string", "null"] as const },
    },
    required: ["message", "status", "step", "percentage", "captured_field", "captured_value", "agent_persona", "agent_instructions"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are the BIQc Persona Calibration Agent.

PURPOSE: Profile the OPERATOR's communication preferences and working style. NOT about their business.

9 STEPS (one per turn):
1. communication_style — bullets, narrative, data-first, or conversational?
2. verbosity — minimal, moderate, or comprehensive?
3. bluntness — blunt, balanced, or diplomatic?
4. risk_posture — conservative, moderate, or aggressive?
5. decision_style — gut-instinct, data-driven, consensus, or hybrid?
6. accountability_cadence — daily, weekly, ad-hoc, or milestone?
7. time_constraints — always-rushed, moderate, or has-breathing-room?
8. challenge_tolerance — challenge-me, balanced, or support-me?
9. boundaries — what topics or tones are OFF LIMITS?

ABSOLUTE RULES:
1. Every message you send MUST end with a direct question mark (?). No exceptions except the final COMPLETE message.
2. When acknowledging an answer, keep it to ONE short sentence, then IMMEDIATELY ask the next step's question.
3. Example response after step 1 answer: "Bullet points — noted. How much detail do you prefer in communications: minimal and to the point, moderate depth, or comprehensive deep-dives?"
4. NEVER send a message that only acknowledges without asking the next question.
5. On first turn (init): ask step 1 question directly.
6. On step 9 COMPLETE: thank them, generate agent_persona (JSON string) and agent_instructions (text).

RESPOND WITH JSON ONLY.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Compute current step from operator_profile (count filled fields)
function computeStep(op: Record<string, unknown>): number {
  const filled = Object.keys(STEPS).filter(k => op[STEPS[Number(k)].field] !== undefined).length;
  return Math.min(filled + 1, 9);
}

async function resolveUserId(authHeader: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

async function askOpenAI(
  userMessage: string, step: number, profile: Record<string, unknown>,
): Promise<{ parsed: Record<string, unknown>; responseId: string }> {
  const profileSummary = Object.keys(profile).length > 0
    ? `\nPROFILE SO FAR:\n${JSON.stringify(profile, null, 2)}\n---` : "";
  const stepDir = step <= 9
    ? `Step ${step}/9. Field: ${STEPS[step]?.field} (${STEPS[step]?.label}).`
    : "All done. Generate agent_persona and agent_instructions.";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input: `${profileSummary}\n${stepDir}\n\nUSER: ${userMessage}`,
      text: { format: TURN_SCHEMA },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[calibration-psych] OpenAI error:", res.status, err);
    throw new Error(`OpenAI ${res.status}`);
  }

  const data = await res.json();
  const txt = data.output?.find((o: Record<string, unknown>) => o.type === "message")
    ?.content?.find((c: Record<string, unknown>) => c.type === "output_text")?.text;

  // Track usage
  try {
    const usage = data.usage || {};
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("usage_tracking").insert({
      function_name: "calibration-psych",
      api_provider: "openai",
      model: MODEL,
      tokens_in: usage.input_tokens || usage.prompt_tokens || 0,
      tokens_out: usage.output_tokens || usage.completion_tokens || 0,
      cost_estimate: ((usage.input_tokens || usage.prompt_tokens || 0) * 0.00015 + (usage.output_tokens || usage.completion_tokens || 0) * 0.0006) / 1000,
      called_at: new Date().toISOString(),
    });
  } catch {}

  if (!txt) throw new Error("Empty OpenAI response");
  return { parsed: JSON.parse(txt), responseId: data.id };
}

function errorResp(msg: string, step: number): Response {
  return new Response(JSON.stringify({
    message: msg, status: "IN_PROGRESS", step, percentage: Math.round(((step - 1) / 9) * 100),
    captured: { field: null, value: null }, agent_persona: null, agent_instructions: null,
  }), { status: 200, headers: CORS });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let currentStep = 1;
  try {
    // Deterministic path is forced for reliability and latency.
    // This prevents calibration interruptions when external model calls are slow/unavailable.
    const modelAvailable = false;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: CORS });
    const userId = await resolveUserId(authHeader);

    const { message } = await req.json();
    if (!message) return new Response(JSON.stringify({ error: "message required" }), { status: 400, headers: CORS });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: existing } = await sb.from("user_operator_profile").select("*").eq("user_id", userId).maybeSingle();

    let profile = existing;
    if (!profile) {
      const { data: created, error: err } = await sb.from("user_operator_profile")
        .insert({ user_id: userId, operator_profile: {}, persona_calibration_status: "in_progress" })
        .select().single();
      if (err) throw err;
      profile = created;
    }

    const op: Record<string, unknown> = profile.operator_profile || {};
    currentStep = computeStep(op);

    const normalizedMessage = normalizeStr(message).toLowerCase();
    if (normalizedMessage === "init" && currentStep <= 9) {
      return new Response(JSON.stringify({
        message: STEP_QUESTIONS[currentStep] || STEP_QUESTIONS[1],
        status: "IN_PROGRESS",
        step: currentStep,
        percentage: Math.round(((currentStep - 1) / 9) * 100),
        captured: { field: null, value: null },
        agent_persona: null,
        agent_instructions: null,
      }), { status: 200, headers: CORS });
    }

    if (profile.persona_calibration_status === "complete") {
      return new Response(JSON.stringify({
        message: "Calibration already complete.", status: "COMPLETE", step: 9, percentage: 100,
        captured: { field: null, value: null }, agent_persona: profile.agent_persona, agent_instructions: profile.agent_instructions,
      }), { status: 200, headers: CORS });
    }

    let parsed: Record<string, unknown>;
    let responseId = `local-${Date.now()}`;
    if (modelAvailable) {
      const llmTurn = await askOpenAI(message, currentStep, op);
      parsed = llmTurn.parsed;
      responseId = llmTurn.responseId;
    } else {
      parsed = buildFallbackTurn(message, currentStep);
    }

    const updated = { ...op };
    if (parsed.captured_field && parsed.captured_value !== null) {
      updated[parsed.captured_field as string] = parsed.captured_value;
    }

    const filled = Object.keys(STEPS).filter(k => updated[STEPS[Number(k)].field] !== undefined).length;
    const isComplete = parsed.status === "COMPLETE" || filled >= 9;
    const nextStep = Math.min(filled + 1, 9);
    const pct = isComplete ? 100 : Math.round((filled / 9) * 100);

    const patch: Record<string, unknown> = {
      operator_profile: updated,
      prev_response_id: responseId,
      persona_calibration_status: isComplete ? "complete" : "in_progress",
      updated_at: new Date().toISOString(),
    };

    // When calibration completes, also mark onboarding and console as complete
    // This prevents the redirect loop: /advisor → /onboarding → /calibration
    if (isComplete) {
      updated["onboarding_state"] = { completed: true, current_step: 14, completed_at: new Date().toISOString() };
      updated["console_state"] = { status: "COMPLETE", current_step: 17, updated_at: new Date().toISOString() };
      patch.operator_profile = updated;
    }

    if (isComplete && parsed.agent_persona) {
      try { patch.agent_persona = JSON.parse(parsed.agent_persona as string); } catch { patch.agent_persona = parsed.agent_persona; }
    }
    if (isComplete && !patch.agent_persona) {
      patch.agent_persona = updated;
    }
    if (isComplete && parsed.agent_instructions) {
      patch.agent_instructions = parsed.agent_instructions;
    } else if (isComplete && !patch.agent_instructions) {
      patch.agent_instructions = "Use the calibrated operator profile to tailor directness, depth, cadence, and challenge level for every response.";
    }

    await sb.from("user_operator_profile").update(patch).eq("user_id", userId);

    const responseMessage = isComplete
      ? (normalizeStr(parsed.message) || "Calibration complete. Your advisor persona is now tuned for decision-ready, psychometric-aligned guidance.")
      : buildInProgressMessage(
        normalizeStr(parsed.captured_field) || null,
        normalizeStr(parsed.captured_value),
        nextStep,
      );

    return new Response(JSON.stringify({
      message: responseMessage, status: isComplete ? "COMPLETE" : "IN_PROGRESS",
      step: isComplete ? 9 : nextStep, percentage: pct,
      captured: { field: parsed.captured_field || null, value: parsed.captured_value || null },
      agent_persona: isComplete ? patch.agent_persona ?? null : null,
      agent_instructions: isComplete ? parsed.agent_instructions ?? null : null,
    }), { status: 200, headers: CORS });

  } catch (err) {
    console.error("[calibration-psych]", err);
    return errorResp("Calibration link disrupted. Please retry.", currentStep);
  }
});
