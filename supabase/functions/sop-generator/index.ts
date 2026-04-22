// ═══════════════════════════════════════════════════════════════
// SOP GENERATOR — Supabase Edge Function
// File: supabase/functions/sop-generator/index.ts
//
// Deploy: supabase functions deploy sop-generator
// ═══════════════════════════════════════════════════════════════
//
// SECRETS REQUIRED:
//   OPENAI_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// PURPOSE:
//   Generates Standard Operating Procedures, checklists, and action plans
//   using OpenAI, with full business context from the user's profile.
//
// ENDPOINTS:
//   POST /functions/v1/sop-generator
//   Body: { "type": "sop" | "checklist" | "action_plan", "prompt": "...", "context": "..." }
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { recordUsage } from "../_shared/metering.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOP_MODEL = "gpt-5.3";

const SYSTEM_PROMPTS: Record<string, string> = {
  sop: `You are BIQc's SOP Generator — a senior operations consultant who creates clear, practical Standard Operating Procedures for Australian SMBs.

Output format:
- Title
- Purpose (1-2 sentences)
- Scope (who this applies to)
- Prerequisites
- Step-by-step procedure (numbered, with sub-steps where needed)
- Quality checkpoints
- Exception handling
- Review schedule

Write in plain Australian English. Be specific, not generic. Reference the business context provided.`,

  checklist: `You are BIQc's Checklist Generator — creating actionable, tick-box checklists for Australian SMBs.

Output format:
- Checklist title
- When to use
- Items (each as a clear action with a checkbox)
- Completion criteria
- Who to notify when complete

Keep items specific and measurable. No vague steps.`,

  action_plan: `You are BIQc's Action Plan Generator — creating structured execution plans for Australian SMBs.

Output format:
- Objective (what success looks like)
- Timeline (realistic for an SMB)
- Actions (numbered, with owner, deadline, and success metric for each)
- Dependencies (what must happen first)
- Risks and mitigations
- Review checkpoints

Be practical. SMBs have limited resources — prioritise ruthlessly.`,
};

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<{ content: string; usage: any }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SOP_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 3000,
    }),
  });

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "Generation failed. Please try again.",
    usage: data.usage || {},
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const genType = body.type || "sop";
    const prompt = body.prompt || "";
    const additionalContext = body.context || "";

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Load business context
    const { data: profile } = await sb
      .from("business_profiles")
      .select("business_name, industry, mission_statement, target_customer, products_services, team_size, location")
      .eq("user_id", user.id)
      .maybeSingle();

    let businessContext = "";
    if (profile) {
      const parts = [];
      if (profile.business_name) parts.push(`Business: ${profile.business_name}`);
      if (profile.industry) parts.push(`Industry: ${profile.industry}`);
      if (profile.target_customer) parts.push(`Customers: ${profile.target_customer}`);
      if (profile.products_services) parts.push(`Products/Services: ${profile.products_services}`);
      if (profile.team_size) parts.push(`Team size: ${profile.team_size}`);
      if (profile.location) parts.push(`Location: ${profile.location}`);
      businessContext = `\n\nBusiness Context:\n${parts.join("\n")}`;
    }

    const systemPrompt = SYSTEM_PROMPTS[genType] || SYSTEM_PROMPTS.sop;
    const fullPrompt = `${prompt}${businessContext}${additionalContext ? `\n\nAdditional context: ${additionalContext}` : ""}`;

    const { content, usage } = await callOpenAI(systemPrompt, fullPrompt);

    // usage_ledger emit (systemic metering — Track B v2)
    recordUsage({
      userId: user.id,
      model: SOP_MODEL,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cachedInputTokens: usage.prompt_tokens_details?.cached_tokens || 0,
      feature: "sop_generator",
      action: genType,
    });

    // Legacy usage_tracking (kept for backward-compat dashboards)
    try {
      await sb.from("usage_tracking").insert({
        user_id: user.id,
        function_name: "sop-generator",
        api_provider: "openai",
        model: SOP_MODEL,
        tokens_in: usage.prompt_tokens || 0,
        tokens_out: usage.completion_tokens || 0,
        cost_estimate: 0.002,
        called_at: new Date().toISOString(),
      });
    } catch {}

    // Persist to documents table
    const docId = crypto.randomUUID();
    await sb.from("documents").insert({
      id: docId,
      user_id: user.id,
      title: `${genType.toUpperCase()}: ${prompt.substring(0, 80)}`,
      content,
      doc_type: genType,
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      ok: true,
      type: genType,
      content,
      document_id: docId,
      generated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
