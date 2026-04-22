// ═══════════════════════════════════════════════════════════════
// STRATEGIC CONSOLE AI — Supabase Edge Function
// 
// Two modes:
//   1. BRIEF mode (on load): Full executive briefing from all data
//   2. ASK mode (user question): Search all connected data + answer
//
// Deploy: supabase functions deploy strategic-console-ai
//
// Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//          MERGE_API_KEY, PERPLEXITY_API_KEY
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { recordUsage, recordUsageSonar } from "../_shared/metering.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERGE_API_KEY = Deno.env.get("MERGE_API_KEY") || "";
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") || "";
const CONSOLE_MODEL = "gpt-5.4-pro";

// ─── Fetch Merge.dev data ───
async function fetchMerge(token: string, endpoint: string, limit = 20) {
  if (!MERGE_API_KEY || !token || token === "connected") return [];
  try {
    const res = await fetch(`https://api.merge.dev/api/${endpoint}?page_size=${limit}`, {
      headers: { "Authorization": `Bearer ${MERGE_API_KEY}`, "X-Account-Token": token },
    });
    if (res.ok) { const d = await res.json(); return d.results || []; }
  } catch {}
  return [];
}

// ─── Perplexity (replaces Firecrawl) ───
async function searchMarket(query: string, userId: string = "", action: string = "market_recon"): Promise<string> {
  if (!PERPLEXITY_API_KEY) return "";
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: query }], max_tokens: 400 }),
    });
    if (res.ok) {
      const d = await res.json();
      const answer = d.choices?.[0]?.message?.content || "";
      // usage_ledger emit (systemic metering — Track B v2)
      recordUsageSonar({
        userId,
        model: "sonar",
        promptText: query,
        responseText: answer,
        feature: "strategic_console_ai",
        action,
      });
      return answer;
    }
  } catch (e) { console.error("[perplexity]", e); }
  return "";
}

// ─── Gather ALL user context ───
async function gatherContext(supabase: any, userId: string, integrations: any[]) {
  const ctx: Record<string, any> = {};
  const sources: string[] = [];

  // Business profile
  const { data: bp } = await supabase.from("business_profiles")
    .select("business_name, industry, business_stage, target_market, main_challenges, short_term_goals, long_term_goals, growth_strategy, growth_goals, risk_profile, team_size, business_model, competitive_advantages, unique_value_proposition, main_products_services, location")
    .eq("user_id", userId).maybeSingle();
  if (bp) { ctx.business = bp; sources.push("business_profile"); }

  // Calibration persona
  const { data: op } = await supabase.from("user_operator_profile")
    .select("agent_persona, operator_profile, persona_calibration_status")
    .eq("user_id", userId).maybeSingle();
  if (op) {
    ctx.calibration = {
      status: op.persona_calibration_status,
      persona: op.agent_persona,
      profile: op.operator_profile,
    };
    sources.push("calibration");
  }

  // Emails (last 20)
  const { data: emails } = await supabase.from("outlook_emails")
    .select("subject, from_address, to_recipients, body_preview, received_date, is_read")
    .eq("user_id", userId).order("received_date", { ascending: false }).limit(20);
  if (emails?.length) {
    ctx.emails = emails.map((e: any) => ({
      subject: e.subject, from: e.from_address, to: e.to_recipients,
      preview: (e.body_preview || "").substring(0, 300),
      date: e.received_date, read: e.is_read,
    }));
    sources.push(`outlook (${emails.length} emails)`);
  }

  // Observation events
  const { data: signals } = await supabase.from("observation_events")
    .select("signal_name, payload, source, domain, observed_at, confidence")
    .eq("user_id", userId).order("observed_at", { ascending: false }).limit(30);
  if (signals?.length) { ctx.signals = signals; sources.push(`signals (${signals.length})`); }

  // CRM data
  for (const integ of integrations) {
    if (integ.category === "crm" && integ.account_token && integ.account_token !== "connected") {
      const contacts = await fetchMerge(integ.account_token, "crm/v1/contacts", 30);
      const deals = await fetchMerge(integ.account_token, "crm/v1/opportunities", 20);
      if (contacts.length || deals.length) {
        ctx.crm = {
          provider: integ.provider,
          contacts: contacts.map((c: any) => ({
            name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
            email: c.email_addresses?.[0]?.email_address,
            company: c.company,
          })),
          deals: deals.map((d: any) => ({
            name: d.name, status: d.status, amount: d.amount,
            stage: d.stage, close_date: d.close_date,
          })),
        };
        sources.push(`${integ.provider} (${contacts.length} contacts, ${deals.length} deals)`);
      }
    }
    // Financial
    if ((integ.category === "accounting" || integ.category === "financial") && integ.account_token && integ.account_token !== "connected") {
      const accounts = await fetchMerge(integ.account_token, "accounting/v1/accounts", 20);
      const invoices = await fetchMerge(integ.account_token, "accounting/v1/invoices", 15);
      if (accounts.length || invoices.length) {
        ctx.financial = {
          provider: integ.provider,
          accounts: accounts.map((a: any) => ({ name: a.name, type: a.type, balance: a.current_balance })),
          invoices: invoices.map((i: any) => ({ number: i.number, total: i.total_amount, status: i.status, due_date: i.due_date })),
        };
        sources.push(`${integ.provider} (${accounts.length} accounts, ${invoices.length} invoices)`);
      }
    }
  }

  // Market intelligence via Firecrawl
  if (bp?.industry && bp?.business_name) {
    const marketQuery = `${bp.industry} Australia market trends news ${new Date().getFullYear()}`;
    const competitorQuery = `${bp.business_name} competitors ${bp.industry} Australia`;
    const [marketResults, competitorResults] = await Promise.all([
      searchMarket(marketQuery, userId, "market_trends"),
      searchMarket(competitorQuery, userId, "competitor_search"),
    ]);
    if (marketResults || competitorResults) {
      ctx.market_intel = {
        trends: marketResults || "No recent market data found.",
        competitors: competitorResults || "No competitor intelligence found.",
      };
      sources.push("perplexity (market intel)");
    }
  }

  return { ctx, sources };
}

// ─── BRIEF System Prompt ───
const BRIEF_SYSTEM = `You are the BIQc Strategic Console — a senior executive advisor for an Australian SME.

You generate a DAILY EXECUTIVE BRIEFING. This is not a dashboard. This is not a report.
This is a 2-minute read that tells the owner exactly what matters RIGHT NOW.

STRUCTURE YOUR RESPONSE AS JSON:
{
  "greeting": "Good [morning/afternoon], [first_name].",
  "state": "STABLE|DRIFT|COMPRESSION|CRITICAL",
  "state_reason": "One sentence why this state.",
  "what_matters": "2-3 paragraphs. The most important things happening in the business right now. Reference specific emails, deals, financial positions. Be specific with names, numbers, dates.",
  "what_can_wait": "1 paragraph. Things that look concerning but aren't urgent.",
  "what_is_forming": "1 paragraph. Patterns you're seeing that haven't become problems yet but will if ignored. Market trends, competitor movements, internal patterns.",
  "decision_required": "1 paragraph or null. If a decision needs to be made in the next 7 days, state it clearly. If nothing urgent, set to null.",
  "market_context": "1 paragraph. What's happening in their industry that affects them. Use the market intel data.",
  "closing": "One sentence. Reassuring but honest."
}

RULES:
- Write as "I" — you are the advisor speaking to the owner.
- Reference ACTUAL data: email subjects, deal names, contact names, account balances.
- If calibration shows they prefer blunt communication, be blunt. If diplomatic, be diplomatic.
- Different brief every time — never generic. If data is limited, say so.
- No bullet points. Flowing human paragraphs.
- Australian English. Direct, pragmatic, warm.
- The owner should finish reading and feel CLARITY, not anxiety.`;

// ─── ASK System Prompt ───
const ASK_SYSTEM = `You are the BIQc Strategic Console assistant. The user is asking a specific question about their business data.

You have access to their emails, CRM contacts and deals, financial accounts and invoices, business profile, and market intelligence.

RULES:
- Answer the SPECIFIC question. Don't give a general briefing.
- Reference exact data: email dates, subjects, from addresses, deal names, amounts.
- If you can't find the answer in the data, say "I don't have visibility on that yet."
- Be concise. 1-3 paragraphs max.
- Write as "I" — the advisor.
- If they ask about a specific contact/email, search through the email data for matches.

Respond as plain text, not JSON.`;

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const mode = body.mode || "brief"; // "brief" or "ask"
    const question = body.question || "";

    // Get integrations
    const { data: integrations } = await supabase.from("integration_accounts")
      .select("provider, category, account_token").eq("user_id", user.id);

    // Gather all context
    const { ctx, sources } = await gatherContext(supabase, user.id, integrations || []);

    // Extract first name from calibration or business profile
    const firstName = ctx.calibration?.profile?.full_name?.split(" ")[0]
      || ctx.business?.business_name?.split(" ")[0]
      || user.email?.split("@")[0]?.replace(/[._-]/g, " ")?.split(" ")[0]
      || "there";

    const hour = new Date().getUTCHours() + 11; // AEST rough
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    // Build the AI call
    const systemPrompt = mode === "brief" ? BRIEF_SYSTEM : ASK_SYSTEM;
    const userPrompt = mode === "brief"
      ? `Generate today's executive briefing.

FIRST NAME: ${firstName}
TIME OF DAY: ${timeOfDay}
TODAY: ${new Date().toISOString().slice(0, 10)}

FULL BUSINESS CONTEXT:
${JSON.stringify(ctx, null, 2)}`
      : `USER QUESTION: ${question}

FULL BUSINESS CONTEXT:
${JSON.stringify(ctx, null, 2)}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CONSOLE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: mode === "brief" ? 1200 : 600,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("[strategic-console-ai] OpenAI error:", err);
      return new Response(JSON.stringify({
        mode, error: "AI temporarily unavailable",
        data_sources: sources,
      }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    const usage = aiData.usage || {};

    // usage_ledger emit (systemic metering — Track B v2)
    recordUsage({
      userId: user.id,
      model: CONSOLE_MODEL,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cachedInputTokens: usage.prompt_tokens_details?.cached_tokens || 0,
      feature: "strategic_console_ai",
      action: mode,
    });

    // Legacy usage_tracking
    try {
      await supabase.from("usage_tracking").insert({
        user_id: user.id,
        function_name: "strategic-console-ai",
        api_provider: "openai",
        model: CONSOLE_MODEL,
        tokens_in: usage.prompt_tokens || 0,
        tokens_out: usage.completion_tokens || 0,
        cost_estimate: ((usage.prompt_tokens || 0) * 0.00015 + (usage.completion_tokens || 0) * 0.0006) / 1000,
        called_at: new Date().toISOString(),
      });
    } catch {}

    if (mode === "brief") {
      // Parse JSON briefing
      let briefing;
      try {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        briefing = JSON.parse(cleaned);
      } catch {
        briefing = { what_matters: raw, state: "STABLE" };
      }

      return new Response(JSON.stringify({
        mode: "brief",
        briefing,
        data_sources: sources,
        generated_at: new Date().toISOString(),
      }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    } else {
      // Plain text answer
      return new Response(JSON.stringify({
        mode: "ask",
        answer: raw,
        data_sources: sources,
        generated_at: new Date().toISOString(),
      }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

  } catch (err) {
    console.error("[strategic-console-ai] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
