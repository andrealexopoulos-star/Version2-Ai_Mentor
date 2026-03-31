// supabase/functions/calibration-psych/index.ts
// Persona Calibration — 6-step dynamic AI-powered operator psychology profiling
// Generates a SoundBoard persona profile for personalized advisory communication
// OpenAI Responses API · Structured JSON outputs · Supabase JWT auth

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o";

const TOTAL_STEPS = 6;

const STEPS: { [k: number]: { field: string; label: string } } = {
  1: { field: "communication_thinking", label: "Communication & Thinking" },
  2: { field: "risk_decision", label: "Risk & Decision Framework" },
  3: { field: "strategic_depth", label: "Strategic Depth & Bandwidth" },
  4: { field: "challenge_feedback", label: "Challenge & Feedback Style" },
  5: { field: "accountability_execution", label: "Accountability & Execution" },
  6: { field: "boundaries_relationship", label: "Boundaries & Advisory Relationship" },
};

const SEED_QUESTION =
  "I need to understand how you think. When you're facing a high-stakes business decision — " +
  "the kind where the outcome really matters — walk me through what happens. " +
  "Do you reach for data first, talk it through with someone, go with your gut, or something else entirely?";

const FALLBACK_QUESTIONS: { [k: number]: string } = {
  1: SEED_QUESTION,
  2: "When you're weighing a decision with real downside risk — say a big hire, a market bet, or killing a product — how do you decide? Are you spreadsheet-first, instinct-first, or do you pressure-test with people you trust?",
  3: "How deep do you actually want me to go? Some operators want the full strategic breakdown with evidence. Others want the headline and the move. And how much bandwidth do you realistically have each week for strategic thinking?",
  4: "When I spot something that looks like a mistake — or an assumption I think is wrong — how hard do you want me to push back? Some people want the unvarnished truth. Others want it framed more carefully. Where do you sit?",
  5: "How do you want me to hold you accountable? Daily nudges, weekly check-ins, milestone tracking, or just flag it when something slips? What cadence actually makes you execute better?",
  6: "Last one. Are there any topics, tones, or approaches that are off limits for me? And how do you want this advisory relationship to feel — like a trusted peer, a demanding coach, a calm strategist, or something else?",
};

function normalizeStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildFallbackTurn(userMessage: string, step: number): Record<string, unknown> {
  const field = STEPS[step]?.field || null;
  const value = normalizeStr(userMessage);
  const isComplete = step >= TOTAL_STEPS;
  const nextStep = Math.min(step + 1, TOTAL_STEPS);

  if (isComplete) {
    return {
      message: "Calibration complete. I've built your SoundBoard persona profile — your advisor will now communicate in a way that's tuned to how you think, decide, and operate.",
      status: "COMPLETE",
      step: TOTAL_STEPS,
      percentage: 100,
      captured_field: field,
      captured_value: value || null,
      agent_persona: JSON.stringify({
        communication_mode: "adaptive",
        risk_calibration: "balanced",
        analysis_depth: "moderate",
        challenge_intensity: "direct-but-respectful",
        accountability_style: "milestone-based",
        relationship_tone: "trusted-peer",
        note: "Fallback profile — AI was unavailable during calibration",
      }),
      agent_instructions:
        "Communicate with clarity and directness. Provide moderate analytical depth by default. " +
        "Challenge assumptions when you spot risk, but frame pushback respectfully. " +
        "Hold the operator accountable at natural milestones. Maintain a trusted-peer tone — " +
        "professional but not stiff, direct but not abrasive. " +
        "Use the calibrated operator profile to tailor every response.",
    };
  }

  const ack = step === 1 ? "" : "Got it — signal captured. ";
  return {
    message: `${ack}${FALLBACK_QUESTIONS[nextStep] || FALLBACK_QUESTIONS[TOTAL_STEPS]}`,
    status: "IN_PROGRESS",
    step: nextStep,
    percentage: Math.round((step / TOTAL_STEPS) * 100),
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
    required: [
      "message", "status", "step", "percentage",
      "captured_field", "captured_value", "agent_persona", "agent_instructions",
    ],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are the BIQc SoundBoard Persona Calibration Engine.

PURPOSE: Build a deep psychological operating model of this business operator across 6 dimensions. You are NOT asking about their business — you are profiling HOW THEY THINK, DECIDE, AND OPERATE so the SoundBoard AI advisor can communicate with them in exactly the right way.

THE 6 DIMENSIONS (one per step):
1. communication_thinking — How they process information, preferred format, thinking style
2. risk_decision — How they evaluate risk, make decisions under pressure, tolerance for uncertainty
3. strategic_depth — How deep they want analysis, how much time they have, bandwidth constraints
4. challenge_feedback — How much pushback they want, directness level, friction tolerance
5. accountability_execution — How they want to be held accountable, execution cadence, follow-through style
6. boundaries_relationship — What's off limits, how they want the advisory relationship to feel

HOW TO CONDUCT THE CALIBRATION:
- Be conversational and intelligent. You are a world-class executive psychologist, not a survey bot.
- When the user answers, ACKNOWLEDGE their answer with genuine insight — show you understood the deeper signal, not just the surface words. One or two sentences of real recognition.
- Then TRANSITION naturally into the next dimension's question. The question should feel like it flows from what they just revealed, not like you're reading from a list.
- Generate each question DYNAMICALLY based on what you've learned so far. If they said they're data-driven, your risk question might probe whether data ever paralyzes them. If they said they're gut-first, probe how they validate instinct.
- captured_field MUST be the field name for the dimension you just captured (the one they answered).
- captured_value should be a concise synthesis of what they revealed (not their raw text — your interpretation of the signal).

STEP PROGRESSION:
- On init (step 1, no prior answers): Deliver the opening question for dimension 1. Set captured_field and captured_value to null.
- Steps 2-6: Acknowledge → transition → ask. Set captured_field to the PREVIOUS dimension's field, captured_value to your synthesis.
- Step 6 answer received (completion): Acknowledge their final answer. Then synthesize EVERYTHING into:
  - agent_persona: A JSON string describing the operator's psychological operating model. Include keys for each dimension plus overall_archetype, communication_do, communication_dont, and advisory_voice.
  - agent_instructions: A detailed paragraph (200+ words) that tells the SoundBoard AI EXACTLY how to communicate with this operator. Cover tone, depth, pacing, challenge level, when to push back, when to support, what to avoid, and how to structure responses.
  - Set status to "COMPLETE", step to 6, percentage to 100.

PERCENTAGE CALCULATION:
- Step 1 (asking first question): 0%
- After step N answer captured: round(N/6 * 100)
- Complete: 100%

ABSOLUTE RULES:
1. Every IN_PROGRESS message MUST end with a question mark (?).
2. NEVER be robotic. No "Noted." No "Thank you for sharing." Show you actually understood.
3. Keep acknowledgments to 1-3 sentences of genuine insight, then ask the next question.
4. The completion message should feel like a meaningful conclusion, not a form submission.
5. agent_persona must be a valid JSON STRING (stringified object).
6. agent_instructions must be actionable and specific to THIS operator.
7. RESPOND WITH JSON ONLY — no markdown, no extra text outside the JSON structure.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function computeStep(op: Record<string, unknown>): number {
  const filled = Object.keys(STEPS)
    .filter((k) => op[STEPS[Number(k)].field] !== undefined)
    .length;
  return Math.min(filled + 1, TOTAL_STEPS);
}

async function resolveUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing auth");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");

  try {
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (!error && user) return user.id;
  } catch { /* JWT parse failure or service-role token — fall through */ }

  const body = await req.clone().json().catch(() => ({}));
  const bodyUserId = body.user_id || body.tenant_id || "";
  if (bodyUserId) return bodyUserId;

  if (token === SUPABASE_SERVICE_KEY) return "service-role-calibration";

  throw new Error("Unauthorized");
}

async function askOpenAI(
  userMessage: string,
  step: number,
  profile: Record<string, unknown>,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<{ parsed: Record<string, unknown>; responseId: string }> {
  const profileSummary = Object.keys(profile).length > 0
    ? `\nOPERATOR PROFILE CAPTURED SO FAR:\n${JSON.stringify(profile, null, 2)}\n---`
    : "";

  let stepDir: string;
  if (step > TOTAL_STEPS) {
    stepDir = `All ${TOTAL_STEPS} dimensions captured. Generate the final agent_persona (JSON string) and agent_instructions. Set status=COMPLETE, step=${TOTAL_STEPS}, percentage=100.`;
  } else {
    stepDir = `Now on step ${step}/${TOTAL_STEPS}. Capture dimension: ${STEPS[step]?.field} (${STEPS[step]?.label}). After acknowledging, ask about this dimension.`;
  }

  const messages = [
    ...conversationHistory,
    {
      role: "user" as const,
      content: `${profileSummary}\n${stepDir}\n\nUSER: ${userMessage}`,
    },
  ];

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      text: { format: TURN_SCHEMA },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[calibration-psych] OpenAI error:", res.status, err);
    throw new Error(`OpenAI ${res.status}`);
  }

  const data = await res.json();
  const txt = data.output
    ?.find((o: Record<string, unknown>) => o.type === "message")
    ?.content?.find((c: Record<string, unknown>) => c.type === "output_text")?.text;

  try {
    const usage = data.usage || {};
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("usage_tracking").insert({
      function_name: "calibration-psych",
      api_provider: "openai",
      model: MODEL,
      tokens_in: usage.input_tokens || usage.prompt_tokens || 0,
      tokens_out: usage.output_tokens || usage.completion_tokens || 0,
      cost_estimate:
        ((usage.input_tokens || usage.prompt_tokens || 0) * 0.00015 +
          (usage.output_tokens || usage.completion_tokens || 0) * 0.0006) /
        1000,
      called_at: new Date().toISOString(),
    });
  } catch { /* non-critical */ }

  if (!txt) throw new Error("Empty OpenAI response");
  return { parsed: JSON.parse(txt), responseId: data.id };
}

function errorResp(msg: string, step: number): Response {
  return new Response(
    JSON.stringify({
      message: msg,
      status: "IN_PROGRESS",
      step,
      percentage: Math.round(((step - 1) / TOTAL_STEPS) * 100),
      captured: { field: null, value: null },
      agent_persona: null,
      agent_instructions: null,
    }),
    { status: 200, headers: CORS },
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let currentStep = 1;
  try {
    const modelAvailable = !!OPENAI_KEY;

    const userId = await resolveUserId(req);

    const { message, conversation_history } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 200,
        headers: CORS,
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: existing } = await sb
      .from("user_operator_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    let profile = existing;
    if (!profile) {
      const { data: created, error: err } = await sb
        .from("user_operator_profile")
        .insert({
          user_id: userId,
          operator_profile: {},
          persona_calibration_status: "in_progress",
        })
        .select()
        .single();
      if (err) throw err;
      profile = created;
    }

    const op: Record<string, unknown> = profile.operator_profile || {};
    currentStep = computeStep(op);

    const normalizedMessage = normalizeStr(message).toLowerCase();
    if (normalizedMessage === "init" && currentStep <= TOTAL_STEPS) {
      const initMessage = modelAvailable
        ? await (async () => {
            try {
              const { parsed } = await askOpenAI("init", 1, {}, []);
              return normalizeStr(parsed.message) || SEED_QUESTION;
            } catch {
              return SEED_QUESTION;
            }
          })()
        : SEED_QUESTION;

      return new Response(
        JSON.stringify({
          message: initMessage,
          status: "IN_PROGRESS",
          step: currentStep,
          percentage: Math.round(((currentStep - 1) / TOTAL_STEPS) * 100),
          captured: { field: null, value: null },
          agent_persona: null,
          agent_instructions: null,
        }),
        { status: 200, headers: CORS },
      );
    }

    if (profile.persona_calibration_status === "complete") {
      return new Response(
        JSON.stringify({
          message: "Calibration already complete.",
          status: "COMPLETE",
          step: TOTAL_STEPS,
          percentage: 100,
          captured: { field: null, value: null },
          agent_persona: profile.agent_persona,
          agent_instructions: profile.agent_instructions,
        }),
        { status: 200, headers: CORS },
      );
    }

    const history: Array<{ role: string; content: string }> =
      Array.isArray(conversation_history) ? conversation_history : [];

    let parsed: Record<string, unknown>;
    let responseId = `local-${Date.now()}`;

    if (modelAvailable) {
      const llmTurn = await askOpenAI(message, currentStep, op, history);
      parsed = llmTurn.parsed;
      responseId = llmTurn.responseId;
    } else {
      parsed = buildFallbackTurn(message, currentStep);
    }

    const updated = { ...op };
    if (parsed.captured_field && parsed.captured_value !== null) {
      updated[parsed.captured_field as string] = parsed.captured_value;
    }

    const filled = Object.keys(STEPS)
      .filter((k) => updated[STEPS[Number(k)].field] !== undefined)
      .length;
    const isComplete = parsed.status === "COMPLETE" || filled >= TOTAL_STEPS;
    const nextStep = Math.min(filled + 1, TOTAL_STEPS);
    const pct = isComplete ? 100 : Math.round((filled / TOTAL_STEPS) * 100);

    const patch: Record<string, unknown> = {
      operator_profile: updated,
      prev_response_id: responseId,
      persona_calibration_status: isComplete ? "complete" : "in_progress",
      updated_at: new Date().toISOString(),
    };

    if (isComplete) {
      updated["onboarding_state"] = {
        completed: true,
        current_step: 14,
        completed_at: new Date().toISOString(),
      };
      updated["console_state"] = {
        status: "COMPLETE",
        current_step: 17,
        updated_at: new Date().toISOString(),
      };
      patch.operator_profile = updated;
    }

    if (isComplete && parsed.agent_persona) {
      try {
        patch.agent_persona = JSON.parse(parsed.agent_persona as string);
      } catch {
        patch.agent_persona = parsed.agent_persona;
      }
    }
    if (isComplete && !patch.agent_persona) {
      patch.agent_persona = updated;
    }
    if (isComplete && parsed.agent_instructions) {
      patch.agent_instructions = parsed.agent_instructions;
    } else if (isComplete && !patch.agent_instructions) {
      patch.agent_instructions =
        "Use the calibrated operator profile to tailor directness, depth, cadence, " +
        "and challenge level for every response. Mirror the operator's thinking style " +
        "and respect their stated boundaries.";
    }

    await sb.from("user_operator_profile").update(patch).eq("user_id", userId);

    const responseMessage = normalizeStr(parsed.message) ||
      (isComplete
        ? "Calibration complete. Your SoundBoard advisor persona is now fully tuned to how you think, decide, and operate."
        : FALLBACK_QUESTIONS[nextStep] || FALLBACK_QUESTIONS[TOTAL_STEPS]);

    return new Response(
      JSON.stringify({
        message: responseMessage,
        status: isComplete ? "COMPLETE" : "IN_PROGRESS",
        step: isComplete ? TOTAL_STEPS : nextStep,
        percentage: pct,
        captured: {
          field: parsed.captured_field || null,
          value: parsed.captured_value || null,
        },
        agent_persona: isComplete ? patch.agent_persona ?? null : null,
        agent_instructions: isComplete ? patch.agent_instructions ?? null : null,
      }),
      { status: 200, headers: CORS },
    );
  } catch (err) {
    console.error("[calibration-psych]", err);
    return errorResp("Calibration link disrupted. Please retry.", currentStep);
  }
});
