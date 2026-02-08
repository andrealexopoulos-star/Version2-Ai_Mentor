// supabase/functions/calibration-psych/index.ts
// Persona Calibration — 9-step operator psychology profiling
// OpenAI Responses API · Structured JSON outputs · Supabase JWT auth

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("Calibration-Psych") || "";
const MODEL = "gpt-4o";

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

PURPOSE: Profile the OPERATOR — their communication preferences, working style, and psychological boundaries. This is NOT about their business.

You run a strict 9-step calibration. Each step = ONE field.

STEPS:
1. communication_style — How do they prefer receiving info? (bullets, narrative, data-first, conversational)
2. verbosity — How much detail? (minimal, moderate, comprehensive)
3. bluntness — Blunt or diplomatic? (blunt, balanced, diplomatic)
4. risk_posture — Risk appetite? (conservative, moderate, aggressive)
5. decision_style — How do they decide? (gut-instinct, data-driven, consensus, hybrid)
6. accountability_cadence — Check-in frequency? (daily, weekly, ad-hoc, milestone)
7. time_constraints — How rushed? (always-rushed, moderate, has-breathing-room)
8. challenge_tolerance — Push back or support? (challenge-me, balanced, support-me)
9. boundaries — What is OFF LIMITS?

RULES:
- ONE question per turn. Conversational, not robotic.
- After user answers: extract value into captured_field + captured_value.
- Advance step. percentage = (completed / 9) * 100.
- First turn (init signal): ask step 1 question. captured_field=null, captured_value=null.
- On step 9 answer: status=COMPLETE, generate agent_persona (JSON string describing ideal AI tone/pacing/directness/formality for this operator), generate agent_instructions (system prompt fragment text).
- NEVER ask business questions. NEVER deviate from 9 steps.

RESPOND WITH THE REQUIRED JSON ONLY.`;

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
    if (!OPENAI_KEY) {
      console.error("[calibration-psych] No key. Env:", Object.keys(Deno.env.toObject()).join(", "));
      return new Response(JSON.stringify({ error: "OpenAI key not configured" }), { status: 500, headers: CORS });
    }

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

    if (profile.persona_calibration_status === "complete") {
      return new Response(JSON.stringify({
        message: "Calibration already complete.", status: "COMPLETE", step: 9, percentage: 100,
        captured: { field: null, value: null }, agent_persona: profile.agent_persona, agent_instructions: profile.agent_instructions,
      }), { status: 200, headers: CORS });
    }

    const { parsed, responseId } = await askOpenAI(message, currentStep, op);

    const updated = { ...op };
    if (parsed.captured_field && parsed.captured_value !== null) {
      updated[parsed.captured_field as string] = parsed.captured_value;
    }

    const filled = Object.keys(STEPS).filter(k => updated[STEPS[Number(k)].field] !== undefined).length;
    const isComplete = parsed.status === "COMPLETE" || filled >= 9;
    const pct = isComplete ? 100 : Math.round((filled / 9) * 100);

    const patch: Record<string, unknown> = {
      operator_profile: updated,
      prev_response_id: responseId,
      persona_calibration_status: isComplete ? "complete" : "in_progress",
      updated_at: new Date().toISOString(),
    };

    if (isComplete && parsed.agent_persona) {
      try { patch.agent_persona = JSON.parse(parsed.agent_persona as string); } catch { patch.agent_persona = parsed.agent_persona; }
    }
    if (isComplete && parsed.agent_instructions) patch.agent_instructions = parsed.agent_instructions;

    await sb.from("user_operator_profile").update(patch).eq("user_id", userId);

    return new Response(JSON.stringify({
      message: parsed.message, status: isComplete ? "COMPLETE" : "IN_PROGRESS",
      step: isComplete ? 9 : (parsed.step as number), percentage: pct,
      captured: { field: parsed.captured_field || null, value: parsed.captured_value || null },
      agent_persona: isComplete ? patch.agent_persona ?? null : null,
      agent_instructions: isComplete ? parsed.agent_instructions ?? null : null,
    }), { status: 200, headers: CORS });

  } catch (err) {
    console.error("[calibration-psych]", err);
    return errorResp("Calibration link disrupted. Please retry.", currentStep);
  }
});
