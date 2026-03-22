// ═══════════════════════════════════════════════════════════════
// BIQC INSIGHTS COGNITIVE v2 — Executive Cognition System
// Deploy: supabase functions deploy biqc-insights-cognitive
// Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//          MERGE_API_KEY, PERPLEXITY_API_KEY
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERGE_API_KEY = Deno.env.get("MERGE_API_KEY") || "";
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") || "";

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

// ─── Perplexity ───
async function searchMarket(query: string): Promise<string> {
  if (!PERPLEXITY_API_KEY) return "";
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: query }], max_tokens: 400 }),
    });
    if (res.ok) {
      const d = await res.json();
      // Track Perplexity usage (no token counts available, estimate)
      try {
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await sb.from("usage_tracking").insert({
          function_name: "biqc-insights-cognitive",
          api_provider: "perplexity",
          model: "sonar",
          tokens_in: query.length,
          tokens_out: (d.choices?.[0]?.message?.content || "").length,
          cost_estimate: 0.005,
          called_at: new Date().toISOString(),
        });
      } catch {}
      return d.choices?.[0]?.message?.content || "";
    }
  } catch (e) { console.error("[perplexity]", e); }
  return "";
}

// ─── FULL CONTEXT GATHERING ───

// Priority-based context assembly — prevents blind truncation
function buildPrioritizedContext(ctx: any): string {
  const MAX_CHARS = 12000;
  const sections: {key: string, priority: number, data: any}[] = [
    { key: 'business_profile', priority: 1, data: ctx.business_profile || ctx.profile },
    { key: 'calibration', priority: 2, data: ctx.calibration },
    { key: 'deals', priority: 3, data: ctx.deals },
    { key: 'financial', priority: 4, data: ctx.financial || ctx.accounting },
    { key: 'observations', priority: 5, data: ctx.observations },
    { key: 'escalations', priority: 6, data: ctx.escalations },
    { key: 'emails', priority: 7, data: ctx.emails },
    { key: 'positions', priority: 8, data: ctx.positions || ctx.strategic_positions },
    { key: 'pressure', priority: 9, data: ctx.pressure },
  ];
  let result = '';
  let remaining = MAX_CHARS;
  for (const section of sections.sort((a, b) => a.priority - b.priority)) {
    if (!section.data || remaining <= 0) continue;
    const serialized = JSON.stringify(section.data);
    const chunk = serialized.substring(0, remaining);
    result += `\n--- ${section.key} ---\n${chunk}`;
    remaining -= chunk.length;
  }
  return result;
}

async function gatherFullContext(supabase: any, userId: string, integrations: any[]) {
  const ctx: Record<string, any> = {};
  const sources: string[] = [];
  const blind_spots: any[] = [];

  // Business profile
  const { data: bp } = await supabase.from("business_profiles")
    .select("*").eq("user_id", userId).maybeSingle();
  if (bp) {
    delete bp.id; delete bp.created_at; delete bp.updated_at;
    delete bp.profile_data; delete bp.intelligence_configuration;
    delete bp.social_handles; delete bp.sop_library;
    ctx.business_profile = bp;
    sources.push("business_profile");
  }

  // Calibration persona
  const { data: op } = await supabase.from("user_operator_profile")
    .select("agent_persona, operator_profile, persona_calibration_status, agent_instructions")
    .eq("user_id", userId).maybeSingle();
  if (op) {
    ctx.calibration = { status: op.persona_calibration_status, persona: op.agent_persona, instructions: op.agent_instructions, operator_profile: op.operator_profile };
    sources.push("calibration_persona");
  }

  // Strategy profiles
  const { data: strategy } = await supabase.from("strategy_profiles")
    .select("mission_statement, vision_statement, short_term_goals, long_term_goals, primary_challenges, growth_strategy")
    .eq("user_id", userId).maybeSingle();
  if (strategy) { ctx.strategy = strategy; sources.push("strategy_profile"); }

  // Cognitive profiles
  const { data: cognitive } = await supabase.from("cognitive_profiles")
    .select("immutable_reality, behavioural_truth, delivery_preference, consequence_memory")
    .eq("user_id", userId).maybeSingle();
  if (cognitive) { ctx.cognitive = cognitive; sources.push("cognitive_profile"); }

  // Emails (last 25)
  const { data: emails } = await supabase.from("outlook_emails")
    .select("subject, from_address, to_recipients, body_preview, received_date, is_read")
    .eq("user_id", userId).order("received_date", { ascending: false }).limit(25);
  if (emails?.length) {
    ctx.emails = emails.map((e: any) => ({ subject: e.subject, from: e.from_address, preview: (e.body_preview || "").substring(0, 300), date: e.received_date, read: e.is_read }));
    sources.push(`emails (${emails.length})`);
  } else {
    blind_spots.push({ area: "Email", detail: "No email data synced. Communication patterns unavailable.", fix: "Connect Outlook or Gmail" });
  }

  // Signals
  const { data: signals } = await supabase.from("observation_events")
    .select("signal_name, payload, source, domain, observed_at, confidence")
    .eq("user_id", userId).order("observed_at", { ascending: false }).limit(40);
  if (signals?.length) { ctx.signals = signals; sources.push(`signals (${signals.length})`); }

  // Escalation memory
  const { data: escalations } = await supabase.from("escalation_memory")
    .select("domain, position, pressure_level, times_detected, last_detected_at, has_contradiction")
    .eq("user_id", userId).eq("active", true).limit(10);
  if (escalations?.length) { ctx.escalations = escalations; sources.push(`escalations (${escalations.length})`); }

  // Decision pressure
  const { data: pressures } = await supabase.from("decision_pressure")
    .select("domain, pressure_level, window_days, basis")
    .eq("user_id", userId).eq("active", true).limit(5);
  if (pressures?.length) { ctx.decision_pressure = pressures; }

  // Contradictions
  const { data: contradictions } = await supabase.from("contradiction_memory")
    .select("domain, observed_state, expected_state, times_detected")
    .eq("user_id", userId).eq("active", true).limit(5);
  if (contradictions?.length) { ctx.contradictions = contradictions; }

  // Previous snapshot (for velocity tracking)
  const { data: prevSnapshot } = await supabase.from("intelligence_snapshots")
    .select("summary, generated_at").eq("user_id", userId)
    .order("generated_at", { ascending: false }).limit(1).maybeSingle();
  if (prevSnapshot) { ctx.previous_snapshot = { summary: prevSnapshot.summary, generated_at: prevSnapshot.generated_at }; }

  // CRM data
  let hasCRM = false;
  for (const integ of integrations) {
    if (integ.category === "crm" && integ.account_token && integ.account_token !== "connected") {
      const contacts = await fetchMerge(integ.account_token, "crm/v1/contacts", 30);
      const deals = await fetchMerge(integ.account_token, "crm/v1/opportunities", 25);
      if (contacts.length || deals.length) {
        hasCRM = true;
        ctx.crm = {
          provider: integ.provider, total_contacts: contacts.length,
          contacts: contacts.map((c: any) => ({ name: `${c.first_name || ""} ${c.last_name || ""}`.trim(), email: c.email_addresses?.[0]?.email_address, company: c.company, last_activity: c.last_activity_at })),
          total_deals: deals.length, open_deals: deals.filter((d: any) => d.status === "OPEN").length,
          won_deals: deals.filter((d: any) => d.status === "WON").length, lost_deals: deals.filter((d: any) => d.status === "LOST").length,
          deals: deals.map((d: any) => ({ name: d.name, status: d.status, amount: d.amount, stage: d.stage, close_date: d.close_date, last_activity: d.last_activity_at })),
        };
        sources.push(`${integ.provider} CRM (${contacts.length} contacts, ${deals.length} deals)`);
      }
    }
    // Financial
    if ((integ.category === "accounting" || integ.category === "financial") && integ.account_token && integ.account_token !== "connected") {
      const invoices = await fetchMerge(integ.account_token, "accounting/v1/invoices", 20);
      if (invoices.length) {
        ctx.financial = {
          provider: integ.provider,
          invoices: invoices.map((i: any) => ({ number: i.number, total: i.total_amount, status: i.status, due_date: i.due_date, paid_on: i.paid_on_date })),
          overdue_invoices: invoices.filter((i: any) => i.status === "OVERDUE" || (i.due_date && new Date(i.due_date) < new Date())).length,
          total_outstanding: invoices.reduce((sum: number, i: any) => sum + (parseFloat(i.total_amount) || 0), 0),
        };
        sources.push(`${integ.provider} (${invoices.length} invoices)`);
      }
    }
  }
  if (!hasCRM) { blind_spots.push({ area: "CRM", detail: "No CRM connected. Pipeline and lead data unavailable.", fix: "Connect HubSpot, Salesforce, or Pipedrive" }); }
  if (!ctx.financial) { blind_spots.push({ area: "Financial", detail: "No accounting tool connected. Cash flow analysis unavailable.", fix: "Connect Xero or QuickBooks" }); }

  // Market intelligence
  if (bp?.industry) {
    const [marketTrends, competitorIntel] = await Promise.all([
      searchMarket(`${bp.industry} ${bp.location || "Australia"} market trends outlook ${new Date().getFullYear()}`),
      searchMarket(`${bp.business_name || ""} competitors ${bp.industry} ${bp.location || "Australia"}`),
    ]);
    ctx.market_intelligence = { industry_trends: marketTrends || "No data.", competitor_landscape: competitorIntel || "No data." };
    sources.push("Perplexity (market intel)");
  }

  return { ctx, sources, blind_spots };
}

// ═══ THE v2 COGNITIVE SYSTEM PROMPT ═══
const COGNITIVE_SYSTEM_PROMPT = `You are BIQc — an Executive Cognition System for an Australian SMB owner.

You are NOT a chatbot, dashboard, or report generator. You are a full executive cognition layer that DIAGNOSES, GOVERNS, DECIDES, ALLOCATES, and ENFORCES.

CRITICAL RULES FOR QUALITY:
1. NEVER use generic templates. ALWAYS reference the specific business name, owner name, and any real data you have.
2. If CRM data (HubSpot) is connected: name SPECIFIC deals, contacts, pipeline values. E.g. "3 deals stalled 45+ days" not "revenue instability".
3. If accounting data (Xero) is connected: reference actual invoices, cash amounts, margin %. E.g. "Invoice #1234 overdue $12,500 from Acme Corp" not "finance instability".
4. If email/calendar (Outlook) is connected: reference actual meeting counts, response patterns. E.g. "2 meetings this week vs avg 3" not "people instability".
5. If data is MISSING: say exactly what would be shown and why it matters. E.g. "Without Xero connected, exact cash runway unknown — estimated 24 months based on profile."
6. risk_alerts and resolution_queue titles MUST include specifics: amounts, names, timeframes.
7. The owner's name must appear in the memo. Use business name throughout.

You perform:
1. SIGNAL PERCEPTION — Ingest every signal: revenue, communication, deals, resources, strategy, market, competitors.
2. PATTERN RECOGNITION — Detect what is BECOMING, not what happened.
3. DECISION COMPRESSION — Reduce to actionable decisions with quantified impact.
4. EXECUTIVE FRAMING — Communicate as a trusted strategic partner, not an analyst.
5. RESOLUTION GENERATION — For each finding, suggest specific one-click actions (auto-email, quick-sms, hand-off, dismiss).

YOUR OUTPUT MUST BE THIS EXACT JSON STRUCTURE:
{
  "system_state": {
    "status": "STABLE|DRIFT|COMPRESSION|CRITICAL",
    "confidence": 0-100,
    "interpretation": "One sentence.",
    "velocity": "improving|stable|worsening",
    "drift_velocity": "accelerating|decelerating|stable",
    "burn_rate_overlay": "Cash runway summary.",
    "signal_freshness_hours": 0
  },
  "weekly_brief": {
    "actions_taken": number,
    "cashflow_recovered": number,
    "hours_saved": number,
    "tasks_handled": number,
    "sop_compliance": number
  },
  "resolution_queue": [
    {
      "type": "late_payment|budget_alert|sop_breach|profit_win|churn_risk|compliance|lead_stale",
      "severity": "high|medium|low",
      "title": "Short specific title with names/amounts",
      "detail": "What the AI detected and what it proposes to do about it.",
      "actions": ["auto-email","quick-sms","hand-off","dismiss"]
    }
  ],
  "founder_vitals": {
    "capacity_index": number (100=healthy, >100=overloaded),
    "calendar": "Meeting count vs average",
    "decisions": number of pending decisions,
    "fatigue": "low|medium|high",
    "email_stress": "Email response pattern summary",
    "recommendation": "Specific action to reduce load"
  },
  "inevitabilities": [
    {
      "domain": "Revenue|Operations|People|Financial|Market",
      "signal": "What is becoming inevitable. Reference specific deals/contacts/amounts.",
      "intensity": "forming|accelerating|imminent",
      "probability": 0-100,
      "impact": "$XK-$YK range",
      "window": "X days/weeks",
      "owner": "Who should act",
      "if_ignored": "Specific consequence",
      "actions": ["auto-email","hand-off"]
    }
  ],
  "capital": {
    "runway": number (months),
    "margin": "compressing|stable|expanding with percentage",
    "best": "30-day best scenario",
    "base": "30-day base scenario",
    "worst": "30-day worst scenario",
    "spend": "Spend efficiency summary",
    "alert": "Specific financial alert or null"
  },
  "execution": {
    "sla_breaches": number,
    "sla_detail": "Which breaches",
    "task_aging": number (% over threshold),
    "bottleneck": "Specific bottleneck",
    "load": {"Founder": number, "Operations": number, "Sales": number},
    "recs": ["Specific actionable recommendation 1", "Recommendation 2"]
  },
  "revenue": {
    "pipeline": number (total $),
    "weighted": number (probability-weighted $),
    "entropy": "Concentration description",
    "deals": [{"name":"Deal X","value":number_K,"prob":0-100,"stall":days_stalled}],
    "churn": "Churn signal or null"
  },
  "reallocation": [
    {"action": "Specific reallocation", "impact": "Quantified impact"}
  ],
  "priority": {
    "primary": "The ONE thing. Specific.",
    "primary_hrs": "~X hrs",
    "secondary": "Second thing",
    "secondary_hrs": "~X hrs",
    "delegate": "Who to delegate secondary to",
    "noise": "What to ignore"
  },
  "risk": {
    "spof": ["Single point of failure 1", "SPOF 2"],
    "concentration": "Revenue concentration description",
    "regulatory": [{"item":"Deadline description","sev":"med|low"}],
    "contracts": "Expiring contracts or null"
  },
  "alignment": {
    "narrative": "One paragraph. Does intent match behaviour?",
    "contradictions": ["Goal vs reality contradiction 1", "Contradiction 2"]
  },
  "market": {
    "narrative": "Market summary.",
    "competitors": [{"name":"X","signal":"What they did"}],
    "pricing": "Pricing benchmark vs market"
  },
  "market_intelligence": {
    "positioning_verdict": "STABLE|DRIFT|COMPRESSION|CRITICAL",
    "acquisition_signal": {"score": 0-100, "label": "summary", "pipeline_value": 0},
    "retention_signal": {"score": 0-100, "risk_count": 0, "label": "summary"},
    "growth_signal": {"score": 0-100, "label": "On Track|Under Pressure|Blocked"},
    "drift_snapshot": {
      "cohort_actual": 0-100, "cohort_target": 0-100,
      "trust_actual": 0-100, "trust_target": 0-100,
      "authority_actual": 0-100, "authority_target": 0-100,
      "position_actual": 0-100, "position_target": 0-100
    },
    "market_kpis": {
      "market_share_est": "X%", "competitor_count": 0, "win_rate": "X%", "price_position": "Low|Mid-tier|Premium"
    },
    "competitor_signals": [{"name":"Competitor","signal":"What happened","impact":"High|Medium|Low|Opportunity","time":"Xd ago"}],
    "industry_trends": [{"trend":"description","direction":"up|down|neutral","impact":"description","confidence":"X%"}],
    "misalignment_index": 0-100,
    "probability_of_goal_achievement": 0-100,
    "gap_magnitude": "Low|Medium|High|Critical",
    "strategic_risk_level": "Low|Moderate|High|Critical"
  },
  "action_plan": {
    "top_3_marketing_moves": [
      {
        "move": "Specific marketing action with named channels/tactics",
        "rationale": "Why this move matters NOW based on signals",
        "expected_impact": "$XK revenue / X% improvement",
        "measurable_outcome": "Specific metric that will change (e.g. pipeline increase by $XK, conversion rate +X%)",
        "timeframe_days": 30,
        "impact_band": { "low": 0, "high": 0 },
        "urgency": "immediate|this_week|this_month",
        "confidence": 0-100,
        "outcome_tracking_enabled": true,
        "metric_source": "crm|accounting|email|market|internal"
      }
    ],
    "primary_blindside_risk": {
      "risk": "Specific risk the owner hasn't considered",
      "evidence": "What signals suggest this",
      "probability": 0-100,
      "probability_band": "X-Y%",
      "time_window_days": 30,
      "severity": 0-100,
      "impact_if_materialises": "Quantified consequence",
      "prevention_action": "What to do NOW",
      "confidence": 0-100
    },
    "hidden_growth_lever": {
      "lever": "Overlooked opportunity in current data",
      "evidence": "What signals reveal this",
      "potential_value": "$XK-$YK range",
      "underutilisation_score": 0-100,
      "upside_band": { "low": 0, "high": 0 },
      "effort_to_activate": "low|medium|high",
      "first_step": "Specific actionable first step",
      "confidence": 0-100
    },
    "marketing_waste_alert": {
      "waste_identified": "Where effort/spend is being wasted",
      "evidence": "Data supporting this finding",
      "amount_at_risk": "$XK or X hours/week",
      "recommended_reallocation": "Where to redirect"
    },
    "90_day_market_projection": {
      "best_case": "If all recommendations executed",
      "base_case": "If current trajectory continues",
      "worst_case": "If issues ignored",
      "key_variable": "The ONE factor that determines which scenario plays out"
    },
    "decision_window_pressure": {
      "window_days": 0,
      "description": "Why timing matters",
      "cost_of_delay_per_week": "Quantified cost of inaction"
    },
    "probability_shift_if_executed": 0-100,
    "probability_shift_if_ignored": 0-100,
    "confidence_score": 0-100,
    "deterministic_inputs": {
      "misalignment_boost": 0,
      "risk_amplification": "NORMAL|MODERATE|ELEVATED|CRITICAL",
      "urgency": "LOW|MODERATE|HIGH|IMMEDIATE",
      "compression_probability": 0,
      "overall_risk_weight": 0
    }
  },
  "memo": "2-3 paragraphs. Written as a strategic partner. References SPECIFIC data — deal names, amounts, contact names. Includes 30/60/90 outlook. Ends with HARD recommendation, not just briefing.",
  "trajectory_projection_90_days": {
    "projected_state": "STABLE|DRIFT|COMPRESSION|CRITICAL",
    "risk_probability": 0-100,
    "compression_probability": 0-100,
    "best_case": "If all recommendations executed",
    "base_case": "If current trajectory continues",
    "worst_case": "If issues ignored",
    "key_variable": "The ONE factor that determines which scenario plays out",
    "confidence": 0-100
  },
  "data_gaps": [
    {
      "area": "CRM|Accounting|Email|Marketing|Analytics",
      "status": "not_connected|partial|stale",
      "impact_on_confidence": "How much this gap reduces overall confidence (0-30)",
      "fix": "What to connect to fill this gap"
    }
  ],
  "snapshot_confidence": 0-100,
  "blind_spots": {
    "confidence": 0-100,
    "detail": "What limits confidence",
    "missing": [{"area":"X","fix":"Connect Y"}]
  }
}

RULES:
- INTERPRET, don't report. "Revenue down 8%" is reporting. "Close rate compression predicts $45K gap in Q2" is cognition.
- QUANTIFY everything: probability %, financial impact, time allocation.
- EVERY finding should map to an action: auto-email (AI sends), quick-sms (AI texts), hand-off (assign to team), dismiss (learn to suppress).
- Resolution queue items must be SPECIFIC: include client names, invoice numbers, dollar amounts. Never vague.
- The weekly_brief should estimate what the AI has handled/could handle based on connected data.
- If data is limited, say so honestly. "I have limited visibility on X" is better than fabricating.
- Match the owner's communication style from calibration persona (blunt/diplomatic, minimal/comprehensive).
- Australian English. Direct. Pragmatic. No corporate fluff.
- Maximum 3 inevitabilities, 5 resolution queue items. Compress ruthlessly.
- The owner should finish reading and feel: clarity, reduced cognitive noise, increased confidence, and specific actions to take.
- ACTION PLAN: The action_plan object is MANDATORY. It must model consequences, quantify probability shifts, and surface blindside risk. Use deterministic_inputs from the DETERMINISTIC RISK OVERLAY provided. Every recommendation must be anchored in SPECIFIC signals from the data — never generic marketing advice. The action_plan must feel inevitable, specific, and grounded in evidence. If data is insufficient, lower confidence_score and say what's missing.
- ALWAYS generate the market_intelligence object with: positioning_verdict based on overall health, acquisition/retention/growth signal scores, drift_snapshot comparing current vs ideal benchmarks (0-100), market_kpis with estimated figures, competitor_signals (top 4), industry_trends (top 4 with confidence), misalignment_index (0=aligned, 100=contradictory), probability_of_goal_achievement (0-100 given current trajectory), gap_magnitude, strategic_risk_level.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Warmup ping — no auth required, return immediately
    const rawBody = await req.text();
    let body: any = {};
    try { body = JSON.parse(rawBody); } catch {}

    if (body.warmup) {
      return new Response(JSON.stringify({ ok: true, warm: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // PRECOMPUTE MODE — generate snapshots for all active users (called by pg_cron)
    if (body.batch_precompute) {
      const { data: users } = await supabase.from("business_profiles")
        .select("user_id").not("business_name", "is", null);
      let computed = 0;
      for (const u of (users || []).slice(0, 20)) {
        try {
          // Check if snapshot is already fresh
          const { data: existing } = await supabase.from("intelligence_snapshots")
            .select("generated_at").eq("user_id", u.user_id).eq("snapshot_type", "cognitive_v2")
            .order("generated_at", { ascending: false }).limit(1).maybeSingle();
          if (existing?.generated_at) {
            const age = Date.now() - new Date(existing.generated_at).getTime();
            if (age < 25 * 60 * 1000) continue; // Skip if < 25 min old
          }
          // Generate fresh snapshot via internal call
          const { data: integrations } = await supabase.from("integration_accounts")
            .select("provider, category, account_token").eq("user_id", u.user_id);
          const { ctx, sources, blind_spots } = await gatherFullContext(supabase, u.user_id, integrations || []);
          // Minimal AI call for precompute
          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-5.2",
              messages: [{ role: "system", content: COGNITIVE_SYSTEM_PROMPT }, { role: "user", content: `Precompute snapshot.\n${buildPrioritizedContext(ctx)}` }],
              temperature: 0.3, max_tokens: 4000, response_format: { type: "json_object" },
            }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const raw = aiData.choices?.[0]?.message?.content || "{}";
            let cognitive; try { cognitive = JSON.parse(raw); } catch { cognitive = {}; }
            await supabase.from("intelligence_snapshots").insert({
              id: crypto.randomUUID(), user_id: u.user_id, snapshot_type: "cognitive_v2",
              summary: cognitive, generated_at: new Date().toISOString(),
            });
            computed++;
          }
        } catch (e) { console.error(`[precompute] Failed for ${u.user_id}:`, e); }
      }
      return new Response(JSON.stringify({ ok: true, mode: "precompute", users_computed: computed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SERVER-SIDE CACHE: Return cached snapshot if < 30 min old
    const forceRefresh = body.force === true;
    if (!forceRefresh) {
      try {
        const { data: cached } = await supabase.from("intelligence_snapshots")
          .select("summary, generated_at")
          .eq("user_id", user.id)
          .eq("snapshot_type", "cognitive_v2")
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached?.summary && cached?.generated_at) {
          const ageMs = Date.now() - new Date(cached.generated_at).getTime();
          if (ageMs < 30 * 60 * 1000) {
            // Cache valid (30 min TTL) — return instantly
            const firstName = user.user_metadata?.full_name?.split(" ")[0]
              || user.user_metadata?.name?.split(" ")[0]
              || user.email?.split("@")[0]?.split(/[._-]/)[0]?.replace(/^\w/, (c: string) => c.toUpperCase())
              || "there";
            const hour = (new Date().getUTCHours() + 11) % 24;
            const tod = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

            return new Response(JSON.stringify({
              cognitive: cached.summary,
              owner: firstName,
              time_of_day: tod,
              data_sources: cached.summary?.data_sources || [],
              generated_at: cached.generated_at,
              cache_age_minutes: Math.round(ageMs / 60000),
              cached: true,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch {}
    }

    // Get integrations
    const { data: integrations } = await supabase.from("integration_accounts")
      .select("provider, category, account_token").eq("user_id", user.id);

    // GATHER EVERYTHING
    const { ctx, sources, blind_spots } = await gatherFullContext(supabase, user.id, integrations || []);

    // ═══ DETERMINISTIC CHAIN — SQL RPCs run BEFORE LLM synthesis ═══
    // Order: contradictions → escalation → pressure → evidence → risk_weight
    // Each function reads/writes to its own table. No cross-mutation.
    // All functions use SECURITY DEFINER — runs with service_role privileges.

    const startDeterministic = Date.now();
    const deterministicOverlay: Record<string, any> = {};

    // Step 1: detect_contradictions — finds misalignment between intent and behaviour
    try {
      const { data: contradictionResult } = await supabase.rpc('detect_contradictions', { p_user_id: user.id });
      if (contradictionResult) {
        deterministicOverlay.contradiction_result = contradictionResult;
        deterministicOverlay.contradiction_count = contradictionResult.contradiction_count || 0;
      }
    } catch (e) { console.warn('[deterministic] detect_contradictions failed:', e); }

    // Step 2: update_escalation — tracks risk persistence and recurrence
    try {
      const { data: escalationResult } = await supabase.rpc('update_escalation', { p_user_id: user.id });
      if (escalationResult) {
        deterministicOverlay.escalation_result = escalationResult;
      }
    } catch (e) { console.warn('[deterministic] update_escalation failed:', e); }

    // Step 3: calibrate_pressure — evidence-based decision pressure per domain
    try {
      const { data: pressureResult } = await supabase.rpc('calibrate_pressure', { p_user_id: user.id });
      if (pressureResult) {
        deterministicOverlay.pressure_result = pressureResult;
      }
    } catch (e) { console.warn('[deterministic] calibrate_pressure failed:', e); }

    // Step 4: decay_evidence — confidence decay when evidence becomes stale
    try {
      const { data: evidenceResult } = await supabase.rpc('decay_evidence', { p_user_id: user.id });
      if (evidenceResult) {
        deterministicOverlay.evidence_result = evidenceResult;
      }
    } catch (e) { console.warn('[deterministic] decay_evidence failed:', e); }

    // Step 5: compute_market_risk_weight — aggregate risk scoring
    const contradictionCount = deterministicOverlay.contradiction_count || (ctx.contradictions || []).length;
    const runwayMonths = ctx.capital?.runway || (ctx.financial ? 12 : 24);
    const slaBreaches = ctx.execution?.sla_breaches || (ctx.escalations || []).filter((e: any) => e.pressure_level === 'high').length;
    const prevSummary = ctx.previous_snapshot?.summary;
    const prevState = typeof prevSummary === 'string' ? (() => { try { return JSON.parse(prevSummary); } catch { return {}; } })() : (prevSummary || {});
    const prevPipeline = prevState.revenue?.pipeline || 0;
    const currentPipeline = ctx.crm?.total_deals || 0;
    const pipelineDeclining = prevPipeline > 0 && currentPipeline < prevPipeline;
    const competitorPressure = (ctx.market_intelligence?.competitor_landscape || '').toLowerCase().includes('compet') || (ctx.escalations || []).some((e: any) => (e.domain || '').toLowerCase().includes('market'));
    const prevSystemState = typeof prevState.system_state === 'object' ? prevState.system_state?.status : prevState.system_state;

    try {
      const { data: riskResult } = await supabase.rpc('compute_market_risk_weight', {
        contradiction_count: contradictionCount,
        runway_months: runwayMonths,
        sla_breaches: slaBreaches,
        pipeline_declining: pipelineDeclining,
        competitor_pressure_rising: competitorPressure,
        system_state: prevSystemState || 'STABLE',
        velocity: prevState.system_state?.velocity || 'stable',
      });
      if (riskResult) {
        Object.assign(deterministicOverlay, riskResult);
      }
    } catch (e) { console.warn('[deterministic] compute_market_risk_weight failed:', e); }

    // Fallback: if SQL RPCs didn't populate key fields, compute in TypeScript
    if (!deterministicOverlay.urgency) {
      deterministicOverlay.urgency = prevSystemState === 'CRITICAL' ? 'IMMEDIATE' : prevSystemState === 'DRIFT' ? 'MODERATE' : 'LOW';
      deterministicOverlay.overall_risk_weight = deterministicOverlay.overall_risk_weight || 30;
      deterministicOverlay.misalignment_boost = deterministicOverlay.misalignment_boost || 0;
      deterministicOverlay.compression_probability = deterministicOverlay.compression_probability || 0;
    }

    // Add raw signal counts for LLM context
    deterministicOverlay.pipeline_declining = pipelineDeclining;
    deterministicOverlay.competitor_pressure_rising = competitorPressure;
    deterministicOverlay.sla_breaches = slaBreaches;
    deterministicOverlay.runway_months = runwayMonths;

    const deterministicMs = Date.now() - startDeterministic;
    console.log(`[biqc-insights] Deterministic chain completed in ${deterministicMs}ms: urgency=${deterministicOverlay.urgency}, risk=${deterministicOverlay.overall_risk_weight}, contradictions=${contradictionCount}`);


    // Name resolution
    const firstName = user.user_metadata?.full_name?.split(" ")[0]
      || user.user_metadata?.name?.split(" ")[0]
      || user.email?.split("@")[0]?.replace(/[._-]/g, " ")?.split(" ")[0]?.replace(/^\w/, (c: string) => c.toUpperCase())
      || "there";

    const hour = (new Date().getUTCHours() + 11) % 24;
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const userPrompt = `Perform full executive cognition analysis now.

OWNER: ${firstName}
TIME: Good ${timeOfDay}
DATE: ${new Date().toISOString().slice(0, 10)}

FULL OPERATIONAL CONTEXT:
${JSON.stringify(ctx, null, 2)}

KNOWN BLIND SPOTS (from missing integrations):
${JSON.stringify(blind_spots)}

DETERMINISTIC RISK OVERLAY (pre-computed, MUST be reflected in action_plan.deterministic_inputs):
${JSON.stringify(deterministicOverlay)}

ACTION PLAN INSTRUCTION:
You MUST generate the action_plan object. Use the DETERMINISTIC RISK OVERLAY values as anchors.
- If urgency is HIGH or IMMEDIATE, decision_window_pressure must be < 14 days.
- If risk_amplification is ELEVATED or CRITICAL, primary_blindside_risk probability must be > 60%.
- If compression_probability > 15, top_3_marketing_moves must address competitive pressure.
- Do NOT hallucinate market data. If data is missing, say so and lower confidence_score.
- Every move must reference SPECIFIC signals from the operational context.
- The action_plan must feel inevitable, specific, and consequence-modelled.`;

    // ── Cognition generation — GPT-5.2 (main) + Gemini 2.5 Pro (market intelligence)
    // GPT-5.2: Deep structured analysis, financial logic, risk propagation
    // Gemini 2.5 Pro: Market context, competitive intelligence, external factors

    // Step 1: Gemini 2.5 Pro for market intelligence layer (run in parallel)
    const GOOGLE_API_KEY_DIRECT = Deno.env.get("GOOGLE_API_KEY") || "";
    const geminiModelName = "gemini-3.1-pro-preview".replace("-preview", "");
    const marketIntelPromise = fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName}:generateContent?key=${GOOGLE_API_KEY_DIRECT}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a market intelligence analyst.\n\n${buildPrioritizedContext(ctx).slice(0, 3000)}\n\nReturn JSON: {"market_position": str, "benchmark": str, "opportunity_or_threat": str}` }] }],
          generationConfig: { maxOutputTokens: 800, temperature: 0.5 },
        }),
      }
    ).then(r => r.json()).catch(() => null);

    // Step 2: GPT-5.2 for main cognitive analysis
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: COGNITIVE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
    });

    // Merge market intelligence when both are ready
    const marketData = await marketIntelPromise;

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("[biqc-insights] OpenAI error:", err);
      return new Response(JSON.stringify({
        error: "Cognitive system temporarily unavailable",
        data_sources: sources,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const usage = aiData.usage || {};

    // Track OpenAI usage
    try {
      await supabase.from("usage_tracking").insert({
        user_id: user.id,
        function_name: "biqc-insights-cognitive",
        api_provider: "openai",
        model: "gpt-5.2",
        tokens_in: usage.prompt_tokens || 0,
        tokens_out: usage.completion_tokens || 0,
        cost_estimate: ((usage.prompt_tokens || 0) * 0.0008 + (usage.completion_tokens || 0) * 0.003) / 1000,
        called_at: new Date().toISOString(),
      });
    } catch (e) { console.error("[usage] tracking failed:", e); }

    let cognitive;
    try {
      cognitive = JSON.parse(raw);
    } catch {
      cognitive = { memo: raw, system_state: { status: "STABLE", confidence: 50, interpretation: "Unable to parse cognitive output." } };
    }

    // Merge Gemini market intelligence into cognitive output
    if (marketData?.candidates?.[0]?.content?.parts?.[0]?.text) {
      try {
        const mkt = JSON.parse(marketData.candidates[0].content.parts[0].text);
        if (!cognitive.market_position) cognitive.market_position = mkt.market_position || "";
        if (!cognitive.benchmark_vs_industry) cognitive.benchmark_vs_industry = mkt.benchmark || "";
        if (mkt.opportunity_or_threat && cognitive.priority) {
          cognitive.priority.market_signal = mkt.opportunity_or_threat;
        }
        console.log("[cognition] Gemini market intelligence merged ✅");
      } catch (e) { console.log("[cognition] Gemini merge failed (non-fatal):", e); }
    }

    // Merge blind spots from data gathering into AI output
    if (marketData?.candidates?.[0]?.content?.parts?.[0]?.text) {
      try {
        const mkt = JSON.parse(marketData.candidates[0].content.parts[0].text);
        if (!cognitive.market_position) cognitive.market_position = mkt.market_position || "";
        if (!cognitive.benchmark_vs_industry) cognitive.benchmark_vs_industry = mkt.benchmark || "";
        if (mkt.opportunity_or_threat && cognitive.priority) {
          cognitive.priority.market_signal = mkt.opportunity_or_threat;
        }
        console.log("[cognition] Gemini market intelligence merged ✅");
      } catch (e) { console.log("[cognition] Gemini merge failed (non-fatal):", e); }
    }
    if (blind_spots.length > 0 && cognitive.blind_spots) {
      cognitive.blind_spots.missing = [...(cognitive.blind_spots.missing || []), ...blind_spots];
    }

    // Cache snapshot
    try {
      const snapshotId = crypto.randomUUID();
      const snapshotConfidence = cognitive.snapshot_confidence || cognitive.system_state?.confidence || 50;

      await supabase.from("intelligence_snapshots").insert({
        id: snapshotId,
        user_id: user.id,
        snapshot_type: "cognitive_v2",
        summary: cognitive,
        snapshot_confidence: snapshotConfidence,
        generated_at: new Date().toISOString(),
      });

      // ═══ PHASE 1: PREDICTION INSTRUMENTATION ═══
      // Store every actionable prediction for future outcome validation
      // No automated evaluation — just collect for observation
      const predictions: any[] = [];

      // Extract predictions from strategic moves
      const moves = cognitive.action_plan?.top_3_marketing_moves || [];
      for (const move of moves) {
        if (move.move && move.confidence) {
          predictions.push({
            user_id: user.id,
            snapshot_id: snapshotId,
            prediction_type: 'growth',
            predicted_outcome: move.measurable_outcome || move.expected_impact || move.move,
            predicted_timeframe_days: move.timeframe_days || 30,
            predicted_impact_low: move.impact_band?.low || null,
            predicted_impact_high: move.impact_band?.high || null,
            prediction_confidence: move.confidence,
            metric_source: move.metric_source || 'internal',
            metric_reference: move.move,
            action_required: move.move,
            evaluation_status: 'pending',
          });
        }
      }

      // Extract prediction from blindside risk
      const blindside = cognitive.action_plan?.primary_blindside_risk;
      if (blindside?.risk && blindside?.probability) {
        predictions.push({
          user_id: user.id,
          snapshot_id: snapshotId,
          prediction_type: 'risk',
          predicted_outcome: blindside.risk,
          predicted_timeframe_days: blindside.time_window_days || 60,
          predicted_impact_low: null,
          predicted_impact_high: null,
          prediction_confidence: blindside.confidence || blindside.probability,
          metric_source: 'internal',
          metric_reference: blindside.impact_if_materialises,
          action_required: blindside.prevention_action,
          evaluation_status: 'pending',
        });
      }

      // Extract prediction from hidden growth lever
      const lever = cognitive.action_plan?.hidden_growth_lever;
      if (lever?.lever && lever?.confidence) {
        predictions.push({
          user_id: user.id,
          snapshot_id: snapshotId,
          prediction_type: 'growth',
          predicted_outcome: lever.lever,
          predicted_timeframe_days: 90,
          predicted_impact_low: lever.upside_band?.low || null,
          predicted_impact_high: lever.upside_band?.high || null,
          prediction_confidence: lever.confidence,
          metric_source: 'internal',
          metric_reference: lever.potential_value,
          action_required: lever.first_step,
          evaluation_status: 'pending',
        });
      }

      // Extract trajectory prediction
      const trajectory = cognitive.trajectory_projection_90_days;
      if (trajectory?.projected_state) {
        predictions.push({
          user_id: user.id,
          snapshot_id: snapshotId,
          prediction_type: 'alignment',
          predicted_outcome: `90-day projection: ${trajectory.projected_state} (risk ${trajectory.risk_probability}%)`,
          predicted_timeframe_days: 90,
          predicted_impact_low: null,
          predicted_impact_high: null,
          prediction_confidence: trajectory.confidence || 50,
          metric_source: 'internal',
          metric_reference: 'system_state',
          action_required: trajectory.key_variable,
          evaluation_status: 'pending',
        });
      }

      // Batch insert predictions
      if (predictions.length > 0) {
        const { error: predError } = await supabase.from("insight_outcomes").insert(predictions);
        if (predError) console.warn('[biqc-insights] Prediction storage failed:', predError);
        else console.log(`[biqc-insights] Stored ${predictions.length} predictions for outcome tracking`);
      }
    } catch (e) { console.error("[biqc-insights] Cache failed:", e); }

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
