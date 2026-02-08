// supabase/functions/calibration-psych/index.ts
// Persona Calibration — 9-step operator psychology profiling
// OpenAI Responses API · Structured JSON outputs · Supabase JWT auth

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ─── Config ───
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("Calibration Voice Open AI")!;
const MODEL = "gpt-4o";

// ─── 9 Calibration Steps ───
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

// ─── JSON Schema for Structured Output ───
const TURN_SCHEMA = {
  name: "calibration_turn",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      message: {
        type: "string" as const,
        description: "The question or completion message to show the user.",
      },
      status: {
        type: "string" as const,
        enum: ["IN_PROGRESS", "COMPLETE"],
      },
      step: {
        type: "number" as const,
        description: "Current step number 1-9.",
      },
      percentage: {
        type: "number" as const,
        description: "Completion percentage 0-100.",
      },
      captured: {
        type: "object" as const,
        properties: {
          field: {
            type: ["string", "null"] as const,
            description: "The operator_profile field being captured this turn.",
          },
          value: {
            description: "The extracted preference value. Null on first turn.",
          },
        },
        required: ["field", "value"],
        additionalProperties: false,
      },
      agent_persona: {
        description:
          "Full agent persona object. Null unless status=COMPLETE.",
      },
      agent_instructions: {
        type: ["string", "null"] as const,
        description:
          "System prompt fragment for this operator. Null unless status=COMPLETE.",
      },
    },
    required: [
      "message",
      "status",
      "step",
      "percentage",
      "captured",
      "agent_persona",
      "agent_instructions",
    ],
    additionalProperties: false,
  },
};

// ─── System Prompt ───
const SYSTEM_PROMPT = `You are the BIQc Persona Calibration Agent.

PURPOSE: Profile the OPERATOR — their communication preferences, working style, and psychological boundaries. This is NOT about their business. This is about how THEY operate as a human decision-maker.

You are running a strict 9-step calibration. Each step maps to exactly ONE field.

STEPS:
1. communication_style — How does this person prefer to receive information? (bullet points, narrative, data-first, visual, conversational)
2. verbosity — How much detail do they want? (minimal, moderate, comprehensive)
3. bluntness — Do they prefer blunt directness, or diplomatic cushioning? (blunt, balanced, diplomatic)
4. risk_posture — What is their risk appetite? (conservative, moderate, aggressive)
5. decision_style — How do they make decisions? (gut-instinct, data-driven, consensus-seeking, hybrid)
6. accountability_cadence — How often should the system check in with them? (daily, weekly, ad-hoc, milestone-based)
7. time_constraints — How time-pressured are they typically? (always-rushed, moderate, has-breathing-room)
8. challenge_tolerance — Do they want to be challenged and pushed back on, or supported and affirmed? (challenge-me, balanced, support-me)
9. boundaries — What topics, tones, or approaches are absolutely OFF LIMITS?

RULES:
- Ask exactly ONE question per turn.
- Make the question conversational and human — not robotic.
- After the user answers, extract the value for the current step field into "captured".
- Then advance: set step to the NEXT step number.
- percentage = (completed_steps / 9) * 100, rounded.
- On step 1 (first turn, init signal): ask the first question. captured.field=null, captured.value=null.
- When the user answers step 9:
  - Set status to "COMPLETE"
  - Generate agent_persona: a JSON object describing the ideal AI agent personality for this operator (tone, pacing, directness, vocabulary level, emoji usage, formality)
  - Generate agent_instructions: a plain-text system prompt fragment that any AI agent should prepend when communicating with this operator
- NEVER ask business strategy questions.
- NEVER deviate from the 9 steps.
- Keep tone warm but efficient.

RESPOND WITH THE REQUIRED JSON SCHEMA ONLY. No markdown, no wrapping.`;

// ─── CORS Headers ───
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// ─── Auth Helper ───
async function resolveUserId(authHeader: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

// ─── OpenAI Responses API Call ───
async function askOpenAI(
  userMessage: string,
  step: number,
  profile: Record<string, unknown>,
  prevId: string | null,
): Promise<{ parsed: Record<string, unknown>; responseId: string }> {
  // Build context
  const profileSummary =
    Object.keys(profile).length > 0
      ? `\nOPERATOR PROFILE SO FAR:\n${JSON.stringify(profile, null, 2)}\n---`
      : "";

  const stepDirective =
    step <= 9
      ? `Current step: ${step}/9. Field: ${STEPS[step]?.field} (${STEPS[step]?.label}).`
      : "All 9 steps complete. Generate final agent_persona and agent_instructions.";

  const input = `${profileSummary}\n${stepDirective}\n\nUSER: ${userMessage}`;

  const body: Record<string, unknown> = {
    model: MODEL,
    instructions: SYSTEM_PROMPT,
    input,
    text: {
      format: {
        type: "json_schema",
        json_schema: TURN_SCHEMA,
      },
    },
  };
  if (prevId) body.previous_response_id = prevId;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[calibration-psych] OpenAI error:", res.status, err);
    throw new Error(`OpenAI ${res.status}`);
  }

  const data = await res.json();

  // Responses API output structure:
  // data.output[] → find type "message" → content[] → find type "output_text" → .text
  const textBlock = data.output
    ?.find((o: Record<string, unknown>) => o.type === "message")
    ?.content?.find((c: Record<string, unknown>) => c.type === "output_text");

  if (!textBlock?.text) {
    console.error("[calibration-psych] No text in response:", JSON.stringify(data.output));
    throw new Error("Empty OpenAI response");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    console.error("[calibration-psych] JSON parse failed:", textBlock.text);
    throw new Error("Malformed JSON from OpenAI");
  }

  // Validate required keys
  const required = ["message", "status", "step", "percentage", "captured"];
  for (const k of required) {
    if (!(k in parsed)) throw new Error(`Missing key: ${k}`);
  }

  return { parsed, responseId: data.id };
}

// ─── Error Response (still matches output contract) ───
function errorResponse(msg: string, step: number): Response {
  return new Response(
    JSON.stringify({
      message: msg,
      status: "IN_PROGRESS",
      step,
      percentage: Math.round(((step - 1) / 9) * 100),
      captured: { field: null, value: null },
      agent_persona: null,
      agent_instructions: null,
    }),
    { status: 200, headers: CORS },
  );
}

// ═══════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  let currentStep = 1;

  try {
    // ── 1. Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: CORS,
      });
    }
    const userId = await resolveUserId(authHeader);

    // ── 2. Parse body ──
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: CORS,
      });
    }

    // ── 3. Load or create profile ──
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: existing } = await sb
      .from("user_operator_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    let profile = existing;
    if (!profile) {
      const { data: created, error: createErr } = await sb
        .from("user_operator_profile")
        .insert({
          user_id: userId,
          operator_profile: {},
          current_step: 1,
          persona_calibration_status: "in_progress",
        })
        .select()
        .single();
      if (createErr) {
        console.error("[calibration-psych] Insert error:", createErr);
        throw createErr;
      }
      profile = created;
    }

    currentStep = profile.current_step || 1;
    const operatorProfile: Record<string, unknown> =
      profile.operator_profile || {};
    const prevId: string | null = profile.prev_response_id || null;

    // Already complete? Return done state.
    if (profile.persona_calibration_status === "complete") {
      return new Response(
        JSON.stringify({
          message: "Calibration already complete.",
          status: "COMPLETE",
          step: 9,
          percentage: 100,
          captured: { field: null, value: null },
          agent_persona: profile.agent_persona,
          agent_instructions: profile.agent_instructions,
        }),
        { status: 200, headers: CORS },
      );
    }

    // ── 4. Call OpenAI ──
    const { parsed, responseId } = await askOpenAI(
      message,
      currentStep,
      operatorProfile,
      prevId,
    );

    // ── 5. Merge captured field ──
    const updated = { ...operatorProfile };
    if (
      parsed.captured &&
      typeof parsed.captured === "object" &&
      (parsed.captured as Record<string, unknown>).field &&
      (parsed.captured as Record<string, unknown>).value !== null
    ) {
      const cap = parsed.captured as Record<string, unknown>;
      updated[cap.field as string] = cap.value;
    }

    // ── 6. Compute next step deterministically ──
    // Count how many of the 9 fields are filled
    const filledCount = Object.keys(STEPS).filter(
      (k) => updated[STEPS[Number(k)].field] !== undefined,
    ).length;
    const nextStep = Math.min(filledCount + 1, 9);
    const isComplete = parsed.status === "COMPLETE" || filledCount >= 9;
    const pct = isComplete ? 100 : Math.round((filledCount / 9) * 100);

    // ── 7. Persist ──
    const patch: Record<string, unknown> = {
      operator_profile: updated,
      current_step: isComplete ? 9 : nextStep,
      prev_response_id: responseId,
      persona_calibration_status: isComplete ? "complete" : "in_progress",
      updated_at: new Date().toISOString(),
    };

    if (isComplete && parsed.agent_persona) {
      patch.agent_persona = parsed.agent_persona;
    }
    if (isComplete && parsed.agent_instructions) {
      patch.agent_instructions = parsed.agent_instructions;
    }

    const { error: updateErr } = await sb
      .from("user_operator_profile")
      .update(patch)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("[calibration-psych] Update error:", updateErr);
    }

    // ── 8. Return ──
    return new Response(
      JSON.stringify({
        message: parsed.message,
        status: isComplete ? "COMPLETE" : "IN_PROGRESS",
        step: isComplete ? 9 : (parsed.step as number),
        percentage: pct,
        captured: parsed.captured,
        agent_persona: isComplete ? parsed.agent_persona ?? null : null,
        agent_instructions: isComplete
          ? parsed.agent_instructions ?? null
          : null,
      }),
      { status: 200, headers: CORS },
    );
  } catch (err) {
    console.error("[calibration-psych] Unhandled:", err);
    return errorResponse(
      "Calibration link disrupted. Please retry.",
      currentStep,
    );
  }
});
