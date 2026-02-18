// ═══════════════════════════════════════════════════════════════
// BIQC INSIGHTS — Cognitive Layer Edge Function
// 
// This is THE core intelligence function of the platform.
// It performs: Signal Perception → Pattern Recognition → 
// Decision Compression → Executive Framing
//
// NOT a dashboard. NOT a report. NOT a chatbot.
// It is a cognitive system that interprets drift, detects
// inevitability, compresses complexity, and frames decisions.
//
// Deploy: supabase functions deploy biqc-insights-cognitive
// Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//          MERGE_API_KEY, FIRECRAWL_API_KEY
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERGE_API_KEY = Deno.env.get("MERGE_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Merge.dev ───
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

// ─── Firecrawl ───
async function searchMarket(query: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (res.ok) {
      const data = await res.json();
      const results = data.data || data.results || [];
      return results.map((r: any) => `[${r.title || ""}] ${r.description || r.snippet || ""} (${r.url || ""})`).join("\n");
    }
  } catch (e) { console.error("[firecrawl]", e); }
  return "";
}

// ─── FULL CONTEXT GATHERING ───
// Reads EVERYTHING: business profile, calibration persona, strategy,
// cognitive profile, emails, CRM, financial, signals, market intel
async function gatherFullContext(supabase: any, userId: string, integrations: any[]) {
  const ctx: Record<string, any> = {};
  const sources: string[] = [];

  // Business profile (17-point strategic map)
  const { data: bp } = await supabase.from("business_profiles")
    .select("*").eq("user_id", userId).maybeSingle();
  if (bp) {
    // Remove internal fields
    delete bp.id; delete bp.created_at; delete bp.updated_at;
    delete bp.profile_data; delete bp.intelligence_configuration;
    delete bp.social_handles; delete bp.sop_library;
    ctx.business_profile = bp;
    sources.push("business_profile (17-point map)");
  }

  // Calibration persona + operator profile
  const { data: op } = await supabase.from("user_operator_profile")
    .select("agent_persona, operator_profile, persona_calibration_status, agent_instructions")
    .eq("user_id", userId).maybeSingle();
  if (op) {
    ctx.calibration = {
      status: op.persona_calibration_status,
      persona: op.agent_persona,
      instructions: op.agent_instructions,
      operator_profile: op.operator_profile,
    };
    sources.push("calibration_persona");
  }

  // Strategy profiles (AI-refined mission/vision/goals)
  const { data: strategy } = await supabase.from("strategy_profiles")
    .select("mission_statement, vision_statement, short_term_goals, long_term_goals, primary_challenges, growth_strategy, source")
    .eq("user_id", userId).maybeSingle();
  if (strategy) { ctx.strategy = strategy; sources.push("strategy_profile"); }

  // Cognitive profiles (personality, decision patterns)
  const { data: cognitive } = await supabase.from("cognitive_profiles")
    .select("immutable_reality, behavioural_truth, delivery_preference, consequence_memory")
    .eq("user_id", userId).maybeSingle();
  if (cognitive) { ctx.cognitive = cognitive; sources.push("cognitive_profile"); }

  // Emails (last 25)
  const { data: emails } = await supabase.from("outlook_emails")
    .select("subject, from_address, to_recipients, body_preview, received_date, is_read")
    .eq("user_id", userId).order("received_date", { ascending: false }).limit(25);
  if (emails?.length) {
    ctx.emails = emails.map((e: any) => ({
      subject: e.subject, from: e.from_address, to: e.to_recipients,
      preview: (e.body_preview || "").substring(0, 300),
      date: e.received_date, read: e.is_read,
    }));
    sources.push(`emails (${emails.length})`);
  }

  // Observation events (signals from all integrations)
  const { data: signals } = await supabase.from("observation_events")
    .select("signal_name, payload, source, domain, observed_at, confidence")
    .eq("user_id", userId).order("observed_at", { ascending: false }).limit(40);
  if (signals?.length) { ctx.signals = signals; sources.push(`signals (${signals.length})`); }

  // Escalation memory (active patterns)
  const { data: escalations } = await supabase.from("escalation_memory")
    .select("domain, position, pressure_level, times_detected, last_detected_at, has_contradiction")
    .eq("user_id", userId).eq("active", true).limit(10);
  if (escalations?.length) { ctx.escalations = escalations; sources.push(`escalations (${escalations.length})`); }

  // Decision pressure
  const { data: pressures } = await supabase.from("decision_pressure")
    .select("domain, pressure_level, window_days, basis")
    .eq("user_id", userId).eq("active", true).limit(5);
  if (pressures?.length) { ctx.decision_pressure = pressures; sources.push(`decision_pressure (${pressures.length})`); }

  // Evidence freshness
  const { data: freshness } = await supabase.from("evidence_freshness")
    .select("domain, current_confidence, decay_rate, last_evidence_at")
    .eq("user_id", userId).limit(10);
  if (freshness?.length) { ctx.evidence_freshness = freshness; sources.push("evidence_freshness"); }

  // Contradiction memory
  const { data: contradictions } = await supabase.from("contradiction_memory")
    .select("domain, observed_state, expected_state, times_detected")
    .eq("user_id", userId).eq("active", true).limit(5);
  if (contradictions?.length) { ctx.contradictions = contradictions; sources.push(`contradictions (${contradictions.length})`); }

  // CRM data (HubSpot etc)
  for (const integ of integrations) {
    if (integ.category === "crm" && integ.account_token && integ.account_token !== "connected") {
      const contacts = await fetchMerge(integ.account_token, "crm/v1/contacts", 30);
      const deals = await fetchMerge(integ.account_token, "crm/v1/opportunities", 25);
      if (contacts.length || deals.length) {
        ctx.crm = {
          provider: integ.provider,
          total_contacts: contacts.length,
          contacts: contacts.map((c: any) => ({
            name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
            email: c.email_addresses?.[0]?.email_address, company: c.company,
            last_activity: c.last_activity_at,
          })),
          total_deals: deals.length,
          open_deals: deals.filter((d: any) => d.status === "OPEN").length,
          won_deals: deals.filter((d: any) => d.status === "WON").length,
          lost_deals: deals.filter((d: any) => d.status === "LOST").length,
          deals: deals.map((d: any) => ({
            name: d.name, status: d.status, amount: d.amount,
            stage: d.stage, close_date: d.close_date, last_activity: d.last_activity_at,
          })),
        };
        sources.push(`${integ.provider} CRM (${contacts.length} contacts, ${deals.length} deals)`);
      }
    }
    // Financial
    if ((integ.category === "accounting" || integ.category === "financial") && integ.account_token && integ.account_token !== "connected") {
      const accounts = await fetchMerge(integ.account_token, "accounting/v1/accounts", 25);
      const invoices = await fetchMerge(integ.account_token, "accounting/v1/invoices", 20);
      if (accounts.length || invoices.length) {
        ctx.financial = {
          provider: integ.provider,
          accounts: accounts.map((a: any) => ({ name: a.name, type: a.type, balance: a.current_balance, status: a.status })),
          invoices: invoices.map((i: any) => ({ number: i.number, total: i.total_amount, status: i.status, due_date: i.due_date, paid_on: i.paid_on_date })),
          overdue_invoices: invoices.filter((i: any) => i.status === "OVERDUE" || i.status === "SUBMITTED").length,
        };
        sources.push(`${integ.provider} Financial (${accounts.length} accounts, ${invoices.length} invoices)`);
      }
    }
  }

  // Market intelligence via Firecrawl
  if (bp?.industry) {
    const industry = bp.industry;
    const bizName = bp.business_name || "";
    const location = bp.location || "Australia";
    const [marketTrends, competitorIntel, regulatoryNews] = await Promise.all([
      searchMarket(`${industry} ${location} market trends outlook ${new Date().getFullYear()}`),
      searchMarket(`${bizName} competitors ${industry} ${location}`),
      searchMarket(`${industry} ${location} regulation compliance changes ${new Date().getFullYear()}`),
    ]);
    ctx.market_intelligence = {
      industry_trends: marketTrends || "No market trend data available.",
      competitor_landscape: competitorIntel || "No competitor data available.",
      regulatory_environment: regulatoryNews || "No regulatory updates found.",
    };
    sources.push("firecrawl (market + competitors + regulatory)");
  }

  return { ctx, sources };
}

// ═══════════════════════════════════════════════════════════════
// THE COGNITIVE SYSTEM PROMPT
// This is the brain of BIQc. It performs:
// Signal Perception → Pattern Recognition → 
// Decision Compression → Executive Framing
// ═══════════════════════════════════════════════════════════════

const COGNITIVE_SYSTEM_PROMPT = `You are BIQc — a Cognitive Intelligence System for an Australian business owner.

You are NOT a chatbot. You are NOT a dashboard. You are NOT a report generator.

You are a cognitive layer that sits above all operational systems and performs:

1. SIGNAL PERCEPTION — You ingest every available signal: revenue patterns, communication tone, deal movement, resource load, strategic alignment, market shifts, competitor behaviour, regulatory changes.

2. PATTERN RECOGNITION — You detect what is BECOMING, not what HAS HAPPENED:
   - Compression in pipeline velocity
   - Strategic goal misalignment between stated intent and actual behaviour
   - Silent opportunity decay (deals stalling, contacts going cold)
   - Burnout accumulation (communication patterns, response delays)
   - Structural stress (financial position drift, resource overload)

3. DECISION COMPRESSION — You reduce everything into:
   - 1-3 active inevitabilities (things that WILL happen if nothing changes)
   - A clear intervention window (days/weeks before impact)
   - Probability-weighted outcomes
   - What is signal vs what is noise

4. EXECUTIVE FRAMING — You communicate as a trusted strategic partner:
   - Not analyst language — leadership language
   - Not metrics — meaning
   - Not data — decisions

YOUR OUTPUT MUST BE THIS EXACT JSON STRUCTURE:
{
  "system_state": "STABLE|DRIFT|COMPRESSION|CRITICAL",
  "system_state_interpretation": "One sentence. Why this state. What it means for the owner RIGHT NOW.",

  "inevitabilities": [
    {
      "domain": "Revenue|Operations|People|Financial|Strategic|Market",
      "signal": "What is becoming inevitable",
      "intensity": "forming|accelerating|imminent",
      "intervention_window": "X days/weeks",
      "probability": "low|medium|high|near-certain",
      "if_ignored": "What happens if no action taken"
    }
  ],

  "priority_compression": {
    "primary_focus": "The ONE thing that matters most right now. One sentence.",
    "secondary_focus": "The second thing. One sentence.",
    "noise_to_ignore": "What looks urgent but isn't. One sentence."
  },

  "opportunity_decay": {
    "decaying": "What opportunity is being lost right now. Reference specific deals, contacts, or market positions. Null if none.",
    "velocity": "How fast it's decaying. Days/weeks.",
    "recovery_action": "What to do about it. One sentence."
  },

  "executive_memo": "2-3 paragraphs. Written as a strategic partner speaking privately to the owner. Reference SPECIFIC data — email subjects, deal names, contact names, financial positions, market movements. This is the cognitive output. It must feel like clarity, not information.",

  "strategic_alignment_check": "One paragraph. Does what the owner SAYS they want match what the data shows is actually happening? If there's a gap, name it directly.",

  "market_position": "One paragraph. What's happening in their market that affects them. Use firecrawl data. Reference specific trends, competitor movements, regulatory changes.",

  "confidence_level": "low|medium|high",
  "data_freshness": "Description of how current the data is"
}

ABSOLUTE RULES:
- INTERPRET, don't report. "Revenue is down 8%" is reporting. "Your close rate compression suggests a pricing misalignment that will hit revenue in 6 weeks" is cognition.
- DETECT INEVITABILITY, not trend. "Sales are declining" is trend. "Three enterprise deals have stalled at proposal stage with pricing objection — this pattern predicts revenue gap in Q2" is inevitability.
- COMPRESS, don't expand. The owner should read for 2 minutes and know EXACTLY what matters.
- FRAME for decisions, not analysis. Every insight must point toward an action or a deliberate decision to wait.
- Reference ACTUAL data. Names, numbers, dates, email subjects. Never be vague.
- If calibration persona exists, match their communication style (blunt/diplomatic, minimal/comprehensive).
- Australian English. Direct. Pragmatic. No corporate fluff.
- The owner should finish reading and feel: clarity, reduced cognitive noise, increased strategic confidence.
- Maximum 3 inevitabilities. If there are more, compress to the 3 most consequential.
- If data is limited, say so. "I have limited visibility on X" is honest. Fabricating is forbidden.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get integrations
    const { data: integrations } = await supabase.from("integration_accounts")
      .select("provider, category, account_token").eq("user_id", user.id);

    // GATHER EVERYTHING
    const { ctx, sources } = await gatherFullContext(supabase, user.id, integrations || []);

    // Name resolution
    const firstName = user.user_metadata?.full_name?.split(" ")[0]
      || user.user_metadata?.name?.split(" ")[0]
      || user.email?.split("@")[0]?.replace(/[._-]/g, " ")?.split(" ")[0]?.replace(/^\w/, (c: string) => c.toUpperCase())
      || "there";

    const hour = new Date().getUTCHours() + 11;
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const userPrompt = `Perform cognitive analysis now.

OWNER: ${firstName}
TIME: Good ${timeOfDay}
DATE: ${new Date().toISOString().slice(0, 10)}

FULL OPERATIONAL CONTEXT:
${JSON.stringify(ctx, null, 2)}`;

    // Call GPT-4o
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: COGNITIVE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 1500,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("[biqc-insights] OpenAI error:", err);
      return new Response(JSON.stringify({
        error: "Cognitive system temporarily unavailable",
        data_sources: sources,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    let cognitive;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      cognitive = JSON.parse(cleaned);
    } catch {
      cognitive = { executive_memo: raw, system_state: "STABLE" };
    }

    return new Response(JSON.stringify({
      cognitive,
      owner: firstName,
      time_of_day: timeOfDay,
      data_sources: sources,
      generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[biqc-insights] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
