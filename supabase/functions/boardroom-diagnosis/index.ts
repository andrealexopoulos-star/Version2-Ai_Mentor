// ═══════════════════════════════════════════════════════════════
// BOARDROOM DIAGNOSIS — Supabase Edge Function
// File: supabase/functions/boardroom-diagnosis/index.ts
// 
// Deploy: supabase functions deploy boardroom-diagnosis
// ═══════════════════════════════════════════════════════════════
//
// SECRETS REQUIRED (set via Supabase Dashboard → Edge Functions → Secrets):
//   OPENAI_API_KEY     — Your OpenAI API key
//   SUPABASE_URL       — Your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — Service role key for DB access
//
// FRONTEND CONTRACT:
//   POST /functions/v1/boardroom-diagnosis
//   Headers: Authorization: Bearer {user_jwt}, apikey: {anon_key}
//   Body: { "focus_area": "cash_flow_financial_risk" }
//
// RESPONSE SHAPE:
//   {
//     "status": "ok",
//     "focus_area": "cash_flow_financial_risk",
//     "confidence": "medium",
//     "headline": "Your cash position is stable, but payment cycles are stretching.",
//     "narrative": "Based on your Xero accounts...",
//     "what_to_watch": "Receivables aging beyond 45 days...",
//     "if_ignored": "Potential cash gap of $15-25K in 8 weeks...",
//     "data_sources_used": ["xero", "outlook"],
//     "generated_at": "2026-02-18T..."
//   }
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { recordUsage } from "../_shared/metering.ts";
// Phase 1.X model-name auto-validation (2026-05-05 code 13041978):
// Replace hardcoded "gpt-5.4-pro" (unreleased preview → silent 400) with
// env-driven resolver that falls back to a safe production model.
import { resolveOpenAIDeepModel } from "../_shared/model_validator.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOARDROOM_MODEL = resolveOpenAIDeepModel();

// ─── Focus Area → Data Query + Prompt Mapping ───
const FOCUS_CONFIGS: Record<string, {
  tables: string[];
  mergeEndpoints: string[];
  briefingCriteria: string;
}> = {
  cash_flow_financial_risk: {
    tables: ["business_profiles", "observation_events"],
    mergeEndpoints: ["accounting/v1/accounts", "accounting/v1/invoices"],
    briefingCriteria: `Analyse: Cash flow position, payment obligations, receivables aging, 
      liquidity runway, budget vs actuals. Flag any cash gaps forming in the next 8-12 weeks.`,
  },
  revenue_momentum: {
    tables: ["business_profiles", "observation_events"],
    mergeEndpoints: ["crm/v1/opportunities", "crm/v1/contacts"],
    briefingCriteria: `Analyse: Sales velocity, pipeline health, close rate trends, 
      customer acquisition cost signals, and whether revenue growth matches effort invested.`,
  },
  strategy_effectiveness: {
    tables: ["business_profiles", "strategy_profiles", "observation_events"],
    mergeEndpoints: [],
    briefingCriteria: `Analyse: Whether current strategic direction is producing expected outcomes.
      Look for drift between stated goals and actual activity patterns in emails and CRM.`,
  },
  operations_delivery: {
    tables: ["business_profiles", "observation_events"],
    mergeEndpoints: [],
    briefingCriteria: `Analyse: Execution quality, delivery timelines, operational bottlenecks.
      Look for patterns of missed deadlines, rework, or capacity constraints in communications.`,
  },
  people_retention_capacity: {
    tables: ["business_profiles", "observation_events"],
    mergeEndpoints: [],
    briefingCriteria: `Analyse: Team stability, workload distribution, delegation gaps, 
      burnout signals in communications, and capacity to deliver current commitments.`,
  },
  customer_relationships: {
    tables: ["business_profiles", "observation_events"],
    mergeEndpoints: ["crm/v1/contacts"],
    briefingCriteria: `Analyse: Client satisfaction signals, relationship health, retention indicators,
      complaint patterns, and churn risk based on communication frequency and sentiment.`,
  },
  risk_compliance: {
    tables: ["business_profiles", "observation_events"],
    mergeEndpoints: [],
    briefingCriteria: `Analyse: Regulatory obligations, contractual risks, legal exposure,
      compliance gaps, and any upcoming deadlines or changes requiring attention.`,
  },
  systems_technology: {
    tables: ["business_profiles", "observation_events"],
    mergeEndpoints: [],
    briefingCriteria: `Analyse: Technical debt, system reliability, infrastructure limitations,
      and technology risks that could limit growth or cause operational disruption.`,
  },
  market_position: {
    tables: ["business_profiles", "observation_events"],
    mergeEndpoints: ["crm/v1/opportunities"],
    briefingCriteria: `Analyse: Competitive landscape, market positioning, opportunity decay,
      and whether the business is gaining or losing ground relative to alternatives.`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }

  // Phase 1.X health-check handler (2026-05-05 code 13041978):
  // Andreas mandate "every edge function returns 200 on health check".
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "boardroom-diagnosis",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  try {
    // Phase 1.X auth-symmetry hard-fix (2026-05-05 code 13041978):
    // Previously this function did a redundant supabase.auth.getUser(token) AFTER
    // verifyAuth had already validated the bearer. That broke service_role calls
    // because getUser() rejects service-role JWTs as "user not found", returning
    // 401 even when verifyAuth had returned ok. Now we trust the AuthResult:
    // service_role callers must provide user_id in the body; user-JWT callers
    // get auth.userId. Symmetry with verifyAuth — no key-mismatch bugs.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Parse request
    const body = await req.json().catch(() => ({}));
    const { focus_area } = body;

    // Resolve target user (service_role → body.user_id; user JWT → auth.userId)
    const targetUserId: string | null = auth.isServiceRole
      ? (typeof body.user_id === "string" && body.user_id.trim() ? body.user_id.trim() : null)
      : (auth.userId || null);
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "user_id required for service_role; or invalid user session" }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const user = { id: targetUserId };

    const config = FOCUS_CONFIGS[focus_area];
    if (!config) {
      return new Response(JSON.stringify({ error: `Unknown focus area: ${focus_area}` }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // 3. Gather context from Supabase tables
    const context: Record<string, any> = {};
    const dataSources: string[] = [];

    // Business profile
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("business_name, industry, business_stage, target_market, main_challenges, short_term_goals, growth_strategy, team_size, business_model")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile) {
      context.business = profile;
      dataSources.push("business_profile");
    }

    // Observation events (signals from integrations)
    const { data: signals } = await supabase
      .from("observation_events")
      .select("signal_name, payload, source, domain, observed_at, confidence")
      .eq("user_id", user.id)
      .order("observed_at", { ascending: false })
      .limit(30);
    if (signals && signals.length > 0) {
      context.signals = signals;
      dataSources.push("observation_events");
    }

    // Strategy profiles (if needed)
    if (config.tables.includes("strategy_profiles")) {
      const { data: strategy } = await supabase
        .from("strategy_profiles")
        .select("mission_statement, vision_statement, short_term_goals, long_term_goals, growth_strategy")
        .eq("user_id", user.id)
        .maybeSingle();
      if (strategy) {
        context.strategy = strategy;
        dataSources.push("strategy_profiles");
      }
    }

    // 4. Fetch Merge.dev integration data (if configured)
    const { data: integrations } = await supabase
      .from("integration_accounts")
      .select("provider, category, account_token")
      .eq("user_id", user.id);

    const MERGE_API_KEY = Deno.env.get("MERGE_API_KEY");

    if (MERGE_API_KEY && integrations) {
      for (const endpoint of config.mergeEndpoints) {
        const category = endpoint.startsWith("crm") ? "crm" : "accounting";
        const integ = integrations.find(
          (i: any) => (i.category === category || i.category === "financial") && i.account_token && i.account_token !== "connected"
        );
        if (integ) {
          try {
            const mergeRes = await fetch(`https://api.merge.dev/api/${endpoint}?page_size=20`, {
              headers: {
                "Authorization": `Bearer ${MERGE_API_KEY}`,
                "X-Account-Token": integ.account_token,
              },
            });
            if (mergeRes.ok) {
              const mergeData = await mergeRes.json();
              const key = endpoint.split("/").pop() || endpoint;
              context[`merge_${key}`] = (mergeData.results || []).slice(0, 15);
              dataSources.push(integ.provider.toLowerCase());
            }
          } catch { /* non-blocking */ }
        }
      }
    }

    // 5. Fetch recent emails for context
    const { data: emails } = await supabase
      .from("outlook_emails")
      .select("subject, from_address, body_preview, received_date")
      .eq("user_id", user.id)
      .order("received_date", { ascending: false })
      .limit(15);
    if (emails && emails.length > 0) {
      context.recent_emails = emails.map((e: any) => ({
        subject: e.subject,
        from: e.from_address,
        preview: (e.body_preview || "").substring(0, 200),
      }));
      dataSources.push("outlook");
    }

    // 6. Build the AI prompt
    const systemPrompt = `You are a senior strategic advisor for an Australian SME. 
You provide calm, direct, human intelligence briefings — like a trusted CFO or COO speaking privately to the owner.

RULES:
- Write in first person as the advisor ("I'm noticing...", "Based on what I can see...")
- Be specific. Reference actual data points when available.
- No jargon. No bullet points. Write in flowing paragraphs.
- If data is limited, say so honestly. Don't fabricate.
- Always provide a "what to watch" and "if ignored" assessment.
- Keep the headline under 15 words.
- Keep the narrative under 200 words.
- Be Australian in tone — direct, pragmatic, no-nonsense but warm.`;

    const userPrompt = `FOCUS AREA: ${focus_area}

BRIEFING CRITERIA:
${config.briefingCriteria}

BUSINESS CONTEXT:
${JSON.stringify(context, null, 2)}

Generate a diagnosis briefing. Return ONLY valid JSON with this exact structure:
{
  "headline": "One sentence summary under 15 words",
  "narrative": "2-3 paragraphs of human, conversational analysis",
  "what_to_watch": "One paragraph on what to monitor",
  "if_ignored": "One sentence on the cost of inaction",
  "confidence": "low|medium|high"
}`;

    // 7. Call OpenAI
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: BOARDROOM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI error:", errText);
      return new Response(JSON.stringify({
        status: "ok",
        focus_area,
        confidence: "low",
        headline: "Analysis temporarily unavailable.",
        narrative: "I wasn't able to complete this analysis right now. This is usually a temporary issue. Please try again in a moment.",
        what_to_watch: null,
        if_ignored: null,
        data_sources_used: dataSources,
        generated_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    const usage = aiData.usage || {};

    // usage_ledger emit (systemic metering — Track B v2)
    recordUsage({
      userId: user.id,
      model: BOARDROOM_MODEL,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cachedInputTokens: usage.prompt_tokens_details?.cached_tokens || 0,
      feature: "boardroom_diagnosis",
      action: focus_area,
    });

    // Legacy usage_tracking — boardroom is the most expensive (multi-agent debate)
    try {
      await supabase.from("usage_tracking").insert({
        user_id: user.id,
        function_name: "boardroom-diagnosis",
        api_provider: "openai",
        model: BOARDROOM_MODEL,
        tokens_in: usage.prompt_tokens || 0,
        tokens_out: usage.completion_tokens || 0,
        cost_estimate: ((usage.prompt_tokens || 0) * 0.00015 + (usage.completion_tokens || 0) * 0.0006) / 1000,
        called_at: new Date().toISOString(),
      });
    } catch (e) { console.error("[usage] boardroom tracking failed:", e); }

    // Parse JSON from AI response
    let parsed;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        headline: raw.substring(0, 100),
        narrative: raw,
        confidence: "low",
      };
    }

    // 8. Return the diagnosis
    return new Response(JSON.stringify({
      status: "ok",
      focus_area,
      confidence: parsed.confidence || "medium",
      headline: parsed.headline,
      narrative: parsed.narrative,
      what_to_watch: parsed.what_to_watch || null,
      if_ignored: parsed.if_ignored || null,
      data_sources_used: dataSources,
      generated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("boardroom-diagnosis error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
