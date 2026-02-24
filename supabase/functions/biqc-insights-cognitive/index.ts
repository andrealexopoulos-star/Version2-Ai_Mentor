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
const PERPLEXITY_KEY = Deno.env.get("PERPLEXITY_API_KEY") || Deno.env.get("Perplexity_API") || "";

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
  if (!PERPLEXITY_KEY) return "";
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PERPLEXITY_KEY}`, "Content-Type": "application/json" },
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
    "burn_rate_overlay": "Cash runway summary."
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
  "memo": "2-3 paragraphs. Written as a strategic partner. References SPECIFIC data — deal names, amounts, contact names. Includes 30/60/90 outlook. Ends with HARD recommendation, not just briefing.",
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
- The owner should finish reading and feel: clarity, reduced cognitive noise, increased confidence, and specific actions to take.`;

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

    const body = await req.json().catch(() => ({}));

    // Warmup ping — return immediately
    if (body.warmup) {
      return new Response(JSON.stringify({ ok: true, warm: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
              model: "gpt-4o-mini",
              messages: [{ role: "system", content: COGNITIVE_SYSTEM_PROMPT }, { role: "user", content: `Precompute snapshot.\n${JSON.stringify(ctx).substring(0, 8000)}` }],
              temperature: 0.5, max_tokens: 3000, response_format: { type: "json_object" },
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
${JSON.stringify(blind_spots)}`;

    // Call GPT-4o
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: COGNITIVE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 4000,
        response_format: { type: "json_object" },
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
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const usage = aiData.usage || {};

    // Track OpenAI usage
    try {
      await supabase.from("usage_tracking").insert({
        user_id: user.id,
        function_name: "biqc-insights-cognitive",
        api_provider: "openai",
        model: "gpt-4o-mini",
        tokens_in: usage.prompt_tokens || 0,
        tokens_out: usage.completion_tokens || 0,
        cost_estimate: ((usage.prompt_tokens || 0) * 0.00015 + (usage.completion_tokens || 0) * 0.0006) / 1000,
        called_at: new Date().toISOString(),
      });
    } catch (e) { console.error("[usage] tracking failed:", e); }

    let cognitive;
    try {
      cognitive = JSON.parse(raw);
    } catch {
      cognitive = { memo: raw, system_state: { status: "STABLE", confidence: 50, interpretation: "Unable to parse cognitive output." } };
    }

    // Merge blind spots from data gathering into AI output
    if (blind_spots.length > 0 && cognitive.blind_spots) {
      cognitive.blind_spots.missing = [...(cognitive.blind_spots.missing || []), ...blind_spots];
    }

    // Cache snapshot
    try {
      await supabase.from("intelligence_snapshots").insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        snapshot_type: "cognitive_v2",
        summary: cognitive,
        generated_at: new Date().toISOString(),
      });
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
