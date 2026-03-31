// ═══════════════════════════════════════════════════════════════
// BIQc Trinity Edge Function
// Calls OpenAI GPT-5.2 + Anthropic Claude Opus 4.6 + Google Gemini 2.5 Pro
// in PARALLEL, then synthesizes into one world-class response.
//
// Each model contributes its strength:
//   GPT-5.2       → Structured financial analysis, numbers, logic
//   Claude Opus   → Nuanced strategy, recommendations, communication
//   Gemini 2.5    → Market intelligence, breadth, competitive context
//   Synthesizer   → Merges all three into one coherent executive response
//
// Secrets: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const GOOGLE_KEY    = Deno.env.get("GOOGLE_API_KEY")!;


// ── Call a model via Emergent universal API ────────────────────────────────────
async function callModel(provider: string, model: string, systemMsg: string, userMsg: string, temperature = 0.7): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }], temperature, max_tokens: 1200 }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const d = await res.json();
    return d.choices?.[0]?.message?.content || "";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, system: systemMsg, messages: [{ role: "user", content: userMsg }], max_tokens: 1200 }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
    const d = await res.json();
    return d.content?.[0]?.text || "";
  }

  if (provider === "gemini") {
    const geminiModel = model.replace("-preview", "");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GOOGLE_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemMsg}\n\n${userMsg}` }] }], generationConfig: { maxOutputTokens: 1200, temperature } }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ── System prompts — each model gets specialised instructions ─────────────────
const GPT_SYSTEM = (businessContext: string) => `You are a financial and quantitative business analyst.
${businessContext}
TASK: Analyse the query focusing on numbers, metrics, financial logic, and quantifiable risk.
BE SPECIFIC: Reference actual data from the business context. State exact numbers, percentages, and timeframes.
FORMAT: 2-3 precise sentences. Lead with the most important number or metric. No generic advice.`;

const CLAUDE_SYSTEM = (businessContext: string) => `You are a strategic advisor and executive communications expert.
${businessContext}
TASK: Provide the strategic recommendation and communication approach for this query.
BE SPECIFIC: Ground every recommendation in the business context provided. Name specific actions, owners, and outcomes.
FORMAT: 2-3 sentences. Lead with the clearest, most actionable recommendation. Write as a trusted partner, not a consultant.`;

const GEMINI_SYSTEM = (businessContext: string) => `You are a market intelligence analyst with deep knowledge of Australian and global SMB markets.
${businessContext}
TASK: Provide market context, competitive intelligence, and external factors relevant to this query.
BE SPECIFIC: Reference industry benchmarks, market trends, and competitive dynamics specific to this business's sector and stage.
FORMAT: 2-3 sentences. Surface the most relevant external insight the business owner may not be aware of.`;

const SYNTHESIS_SYSTEM = `You are BIQc — the world's most capable AI advisor for SMBs.
You have received analysis from three specialist AI models. Synthesize them into ONE cohesive executive response.

SYNTHESIS RULES:
1. Do NOT repeat yourself or list each model separately
2. Weave the financial data, strategic recommendation, and market context into ONE flowing response
3. The response must feel like it came from ONE brilliant advisor, not three separate AIs
4. Keep it to 4-6 sentences unless more detail is explicitly needed
5. End with ONE specific action the user should take this week
6. Cite data sources inline: "Your HubSpot pipeline shows...", "Market data indicates...", "Your Xero invoices..."
7. NEVER start with "I" — start with the most important insight`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Auth
  const authHeader = req.headers.get("Authorization") || "";
  const userSb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userSb.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const userId = user.id;
  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const { message, business_context = "", conversation_id = null, mode_requested = "trinity", agent_id = "boardroom" } = body;
  if (!message) return new Response(JSON.stringify({ error: "message required" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const startTime = Date.now();

  try {
    // ── Run all three models in PARALLEL ────────────────────────────────────────
    console.log("[TRINITY] Dispatching to GPT-5.2, Claude Opus 4.6, Gemini 2.5 Pro in parallel...");

    const [gptResult, claudeResult, geminiResult] = await Promise.allSettled([
      callModel("openai", "gpt-5.2", GPT_SYSTEM(business_context), message, 0.3),
      callModel("anthropic", "claude-opus-4-6", CLAUDE_SYSTEM(business_context), message, 0.6),
      callModel("gemini", "gemini-3.1-pro-preview", GEMINI_SYSTEM(business_context), message, 0.7),
    ]);

    const gptAnalysis   = gptResult.status   === "fulfilled" ? gptResult.value   : `[GPT unavailable: ${(gptResult as any).reason?.message?.slice(0,100)}]`;
    const claudeAnalysis = claudeResult.status === "fulfilled" ? claudeResult.value : `[Claude unavailable: ${(claudeResult as any).reason?.message?.slice(0,100)}]`;
    const geminiAnalysis = geminiResult.status === "fulfilled" ? geminiResult.value : `[Gemini unavailable: ${(geminiResult as any).reason?.message?.slice(0,100)}]`;

    const parallelMs = Date.now() - startTime;
    console.log(`[TRINITY] All three responded in ${parallelMs}ms`);

    // ── Synthesize with o3-pro ───────────────────────────────────────────────────
    const synthesisPrompt = `QUERY: "${message}"

FINANCIAL ANALYSIS (GPT-5.2):
${gptAnalysis}

STRATEGIC RECOMMENDATION (Claude Opus 4.6):
${claudeAnalysis}

MARKET INTELLIGENCE (Gemini 2.5 Pro):
${geminiAnalysis}

Business context available:
${business_context.slice(0, 2000)}

Now synthesize these three perspectives into one cohesive, authoritative executive response.`;

    const synthesis = await callModel("openai", "o3-pro", SYNTHESIS_SYSTEM, synthesisPrompt, 0.7);

    const totalMs = Date.now() - startTime;
    console.log(`[TRINITY] Complete in ${totalMs}ms`);

    // ── Save to canonical conversation + message tables ─────────────────────────
    const nowIso = new Date().toISOString();
    const conversationId = conversation_id || crypto.randomUUID();
    const modelUsed = "trinity/gpt-5.2+claude-opus-4-6+gemini-2.5-pro+o3-pro";

    const convoPayload = {
      id: conversationId,
      user_id: userId,
      title: "Trinity Session",
      contract_version: "soundboard_v3",
      mode_requested,
      mode_effective: "trinity",
      last_model_used: modelUsed,
      updated_at: nowIso,
      metadata: {
        mode: "trinity",
        agent_id,
        parallel_ms: parallelMs,
        total_ms: totalMs,
        contributors: {
          gpt: gptResult.status,
          claude: claudeResult.status,
          gemini: geminiResult.status,
        },
      },
    };

    if (conversation_id) {
      await adminSb
        .from("soundboard_conversations")
        .update(convoPayload)
        .eq("id", conversationId)
        .eq("user_id", userId);
    } else {
      await adminSb.from("soundboard_conversations").insert({
        ...convoPayload,
        created_at: nowIso,
      });
    }

    await adminSb.from("soundboard_messages").insert([
      {
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        content: message,
        timestamp: nowIso,
        metadata: { source: "biqc-trinity-edge" },
      },
      {
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content: synthesis,
        timestamp: nowIso,
        boardroom_trace: {
          phase: "trinity_edge",
          contributors: {
            gpt52: gptResult.status,
            claude: claudeResult.status,
            gemini: geminiResult.status,
          },
        },
        metadata: {
          mode_effective: "trinity",
          model_used: modelUsed,
        },
      },
    ]);

    return new Response(JSON.stringify({
      reply: synthesis,
      conversation_id: conversationId,
      mode: "trinity",
      contributors: {
        gpt52:  { status: gptResult.status,    preview: gptAnalysis.slice(0, 120) },
        claude: { status: claudeResult.status, preview: claudeAnalysis.slice(0, 120) },
        gemini: { status: geminiResult.status, preview: geminiAnalysis.slice(0, 120) },
      },
      timing: { parallel_ms: parallelMs, total_ms: totalMs },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[TRINITY] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Trinity failed" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
