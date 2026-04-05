// ═══════════════════════════════════════════════════════════════
// CALIBRATION SYNC — Supabase Edge Function
// Deploy: supabase functions deploy calibration-sync
// Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════
//
// Called after calibration completes. Reads the conversation history
// from calibration-psych and extracts business profile fields to
// populate business_profiles and strategy_profiles tables.
//
// POST /functions/v1/calibration-sync
// Body: { } (uses auth token to identify user)
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "calibration-sync",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Load operator profile (has calibration answers)
    const { data: op } = await sb.from("user_operator_profile")
      .select("agent_persona, operator_profile, agent_instructions")
      .eq("user_id", userId).maybeSingle();

    // Load existing business profile
    const { data: bp } = await sb.from("business_profiles")
      .select("*").eq("user_id", userId).maybeSingle();

    if (!op) {
      return new Response(JSON.stringify({ ok: false, error: "No calibration data found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const persona = op.agent_persona || {};
    const opProfile = op.operator_profile || {};
    const instructions = op.agent_instructions || "";

    // Use GPT to extract business profile fields from the calibration data
    const extractionPrompt = `Extract business profile fields from this calibration data. Return ONLY a JSON object with these fields (use null for unknown):

{
  "business_name": "string or null",
  "industry": "string or null",
  "location": "string or null",
  "team_size": "string or null",
  "business_stage": "string or null - startup/growth/established/mature",
  "years_operating": "string or null",
  "target_market": "string or null",
  "main_products_services": "string or null",
  "value_proposition": "string or null",
  "main_challenges": "string or null",
  "short_term_goals": "string or null - 12 month goals",
  "long_term_goals": "string or null - 3 year vision",
  "growth_strategy": "string or null",
  "competitive_advantages": "string or null",
  "mission_statement": "string or null",
  "business_model": "string or null"
}

Calibration Persona: ${JSON.stringify(persona)}
Agent Instructions: ${instructions.substring(0, 2000)}
Website: ${bp?.website || "unknown"}
Country: ${bp?.target_country || "Australia"}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You extract structured business profile data from calibration conversations. Return valid JSON only. Use null for anything not explicitly mentioned." },
          { role: "user", content: extractionPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    let extracted: Record<string, any> = {};
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || "{}";
      const usage = aiData.usage || {};
      try { extracted = JSON.parse(raw); } catch { extracted = {}; }

      // Track usage
      try {
        await sb.from("usage_tracking").insert({
          user_id: userId,
          function_name: "calibration-sync",
          api_provider: "openai",
          model: "gpt-4o-mini",
          tokens_in: usage.prompt_tokens || 0,
          tokens_out: usage.completion_tokens || 0,
          cost_estimate: ((usage.prompt_tokens || 0) * 0.00015 + (usage.completion_tokens || 0) * 0.0006) / 1000,
          called_at: new Date().toISOString(),
        });
      } catch {}
    }

    // Merge: only fill in NULL fields (don't overwrite existing data)
    const updates: Record<string, any> = {};
    const profileFields = [
      "business_name", "industry", "location", "team_size", "business_stage",
      "years_operating", "target_market", "main_products_services", "value_proposition",
      "main_challenges", "short_term_goals", "long_term_goals", "growth_strategy",
      "competitive_advantages", "mission_statement", "business_model",
    ];

    for (const field of profileFields) {
      if (extracted[field] && !bp?.[field]) {
        updates[field] = extracted[field];
      }
    }

    // Also sync persona preferences
    if (persona.communication_style) updates.advisory_mode = persona.communication_style;

    let fieldsUpdated = 0;
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error } = await sb.from("business_profiles")
        .update(updates).eq("user_id", userId);
      if (error) console.error("[calibration-sync] Update error:", error);
      else fieldsUpdated = Object.keys(updates).length - 1; // -1 for updated_at
    }

    // Also populate strategy_profiles if empty
    const { data: existingStrategy } = await sb.from("strategy_profiles")
      .select("id").eq("user_id", userId).maybeSingle();

    if (!existingStrategy && (extracted.mission_statement || extracted.short_term_goals)) {
      await sb.from("strategy_profiles").insert({
        user_id: userId,
        mission_statement: extracted.mission_statement || null,
        short_term_goals: extracted.short_term_goals || null,
        long_term_goals: extracted.long_term_goals || null,
        primary_challenges: extracted.main_challenges || null,
        growth_strategy: extracted.growth_strategy || null,
        created_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      fields_updated: fieldsUpdated,
      updates,
      extracted,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
