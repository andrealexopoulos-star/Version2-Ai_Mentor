// Supabase Edge Function: calibration_psych
// Persona Calibration — 9-step operator psychology profiling via OpenAI Responses API
//
// Deploy: supabase functions deploy calibration_psych
// Set secrets:
//   supabase secrets set OPENAI_API_KEY=sk-...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ─── Constants ───
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const MODEL = "gpt-4o-mini";

const STEPS: Record<number, { field: string; label: string }> = {
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

// ─── JSON Schema for OpenAI Structured Output ───
const CALIBRATION_SCHEMA = {
  name: "calibration_turn",
  strict: true,
  schema: {
    type: "object",
    properties: {
      message: { type: "string", description: "The next question or completion message to show the user" },
      status: { type: "string", enum: ["IN_PROGRESS", "COMPLETE"] },
      step: { type: "number", description: "Current step number (1-9)" },
      percentage: { type: "number", description: "Completion percentage (0-100)" },
      captured: {
        type: "object",
        properties: {
          field: { type: ["string", "null"], description: "The profile field being captured" },
          value: { description: "The extracted value from the user answer" },
        },
        required: ["field", "value"],
        additionalProperties: false,
      },
      agent_persona: {
        description: "Generated agent persona object — only on COMPLETE",
      },
      agent_instructions: {
        type: ["string", "null"],
        description: "Generated agent instruction text — only on COMPLETE",
      },
    },
    required: ["message", "status", "step", "percentage", "captured", "agent_persona", "agent_instructions"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are BIQc Calibration Agent. Your job is to profile the OPERATOR (the human) — not their business.

You are conducting a 9-step psychological/operational preference calibration.
Each step maps to exactly ONE field. Ask ONE focused question per turn.

STEPS:
1. communication_style — How does the operator prefer to receive information? (bullet points, narratives, data-first, etc.)
2. verbosity — How much detail? (minimal/concise, moderate, deep-dive)
3. bluntness — Blunt and direct, or diplomatic and cushioned?
4. risk_posture — Conservative, moderate, or aggressive risk appetite?
5. decision_style — Gut-instinct, data-driven, consensus-seeking, or hybrid?
6. accountability_cadence — How often should the system check in? (daily, weekly, ad-hoc)
7. time_constraints — How time-pressured is the operator? (always rushed, moderate, has breathing room)
8. challenge_tolerance — Does the operator want to be challenged/pushed back on, or supported?
9. boundaries — What topics or approaches are OFF LIMITS?

RULES:
- Ask exactly ONE question per turn
- After the user answers, extract the value for the current step's field into "captured"
- Advance to the next step
- Keep tone professional but human — you're getting to know them
- On step 9 COMPLETE: generate a full agent_persona JSON object and agent_instructions text
- The agent_persona should describe the ideal AI agent personality for this operator
- The agent_instructions should be a system prompt fragment the AI should use when talking to this operator

ALWAYS respond with the required JSON schema. Never deviate.`;

// ─── Helpers ───
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

async function getUserId(authHeader: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

async function callOpenAI(
  userMessage: string,
  currentStep: number,
  operatorProfile: Record<string, unknown>,
  prevResponseId: string | null,
): Promise<{ parsed: Record<string, unknown>; responseId: string }> {
  const contextBlock = Object.keys(operatorProfile).length > 0
    ? `\nCALIBRATION STATE SO FAR:\n${JSON.stringify(operatorProfile, null, 2)}\n---\n`
    : "";

  const stepInfo = currentStep <= 9
    ? `You are on step ${currentStep}/9. The field to capture is: ${STEPS[currentStep]?.field} (${STEPS[currentStep]?.label}).`
    : "All 9 steps are done. Generate the final agent_persona and agent_instructions.";

  const input = `${contextBlock}${stepInfo}\n\nUSER MESSAGE: ${userMessage}`;

  const body: Record<string, unknown> = {
    model: MODEL,
    instructions: SYSTEM_PROMPT,
    input,
    text: {
      format: {
        type: "json_schema",
        json_schema: CALIBRATION_SCHEMA,
      },
    },
  };

  if (prevResponseId) {
    body.previous_response_id = prevResponseId;
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("OpenAI error:", res.status, errText);
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = await res.json();

  // Extract text content from Responses API output
  const textContent = data.output?.find((o: Record<string, unknown>) => o.type === "message")
    ?.content?.find((c: Record<string, unknown>) => c.type === "output_text")
    ?.text;

  if (!textContent) throw new Error("No text in OpenAI response");

  const parsed = JSON.parse(textContent);
  return { parsed, responseId: data.id };
}

// ─── Main Handler ───
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "calibration_psych",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders() },
    );
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders() });
    }
    const userId = await getUserId(authHeader);

    // 2. Parse input
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message required" }), { status: 400, headers: corsHeaders() });
    }

    // 3. Load or create profile
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let { data: profile } = await supabase
      .from("user_operator_profile")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      const { data: newProfile, error: insertErr } = await supabase
        .from("user_operator_profile")
        .insert({ user_id: userId, operator_profile: {}, current_step: 1, persona_calibration_status: "in_progress" })
        .select()
        .single();
      if (insertErr) throw insertErr;
      profile = newProfile;
    }

    // 4. Determine step
    const currentStep = profile.current_step || 1;
    const operatorProfile = profile.operator_profile || {};
    const prevResponseId = profile.prev_response_id || null;

    // 5. Call OpenAI
    const { parsed, responseId } = await callOpenAI(message, currentStep, operatorProfile, prevResponseId);

    // 6. Update profile with captured field
    const updatedProfile = { ...operatorProfile };
    if (parsed.captured?.field && parsed.captured?.value !== null) {
      updatedProfile[parsed.captured.field as string] = parsed.captured.value;
    }

    const isComplete = parsed.status === "COMPLETE";
    const nextStep = isComplete ? 9 : Math.min((parsed.step as number) + 1, 9);

    const updatePayload: Record<string, unknown> = {
      operator_profile: updatedProfile,
      current_step: nextStep,
      prev_response_id: responseId,
      persona_calibration_status: isComplete ? "complete" : "in_progress",
      updated_at: new Date().toISOString(),
    };

    if (isComplete && parsed.agent_persona) {
      updatePayload.agent_persona = parsed.agent_persona;
      updatePayload.agent_instructions = parsed.agent_instructions || null;
    }

    await supabase
      .from("user_operator_profile")
      .update(updatePayload)
      .eq("user_id", userId);

    // 7. Return response
    const response = {
      message: parsed.message,
      status: parsed.status,
      step: parsed.step,
      percentage: parsed.percentage,
      captured: parsed.captured,
      agent_persona: isComplete ? parsed.agent_persona : null,
      agent_instructions: isComplete ? parsed.agent_instructions : null,
      prev_response_id: responseId,
    };

    return new Response(JSON.stringify(response), { status: 200, headers: corsHeaders() });

  } catch (err) {
    console.error("calibration_psych error:", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(
      JSON.stringify({
        message: "Calibration link disrupted. Please retry.",
        status: "IN_PROGRESS",
        step: 1,
        percentage: 0,
        captured: { field: null, value: null },
        agent_persona: null,
        agent_instructions: null,
        prev_response_id: null,
        error: msg,
      }),
      { status: 200, headers: corsHeaders() },
    );
  }
});
