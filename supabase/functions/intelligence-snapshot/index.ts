import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { recordUsage, recordUsageSonar } from "../_shared/metering.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const PERPLEXITY_KEY = Deno.env.get("Perplexity_API") || "";
const MERGE_API_KEY = Deno.env.get("MERGE_API_KEY") || "";
const MERGE_CACHE_HOURS = 6;
const SNAPSHOT_MODEL = "gpt-4o-mini";

const SYSTEM = "You are BIQc, a Cognitive Intelligence System for an Australian business owner. " +
  "You sit above operational systems and perform signal perception, pattern recognition, decision compression, and executive framing. " +
  "Return strict JSON with: system_state, system_state_interpretation, inevitabilities, priority_compression, opportunity_decay, " +
  "executive_memo, strategic_alignment_check, market_position, confidence_level, data_freshness.";

async function restUpsert(table: string, data: Record<string, unknown>, onConflict: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=merge-duplicates",
      "on-conflict": onConflict,
    },
    body: JSON.stringify(data),
  }).catch((e) => console.error(`[restUpsert] ${table} failed:`, e));
}

async function mergeFetch(token: string, endpoint: string, limit = 20): Promise<any[]> {
  if (!MERGE_API_KEY || !token || token === "connected") return [];
  try {
    const res = await fetch(`https://api.merge.dev/api/${endpoint}?page_size=${limit}`, {
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        "X-Account-Token": token,
      },
    });
    if (!res.ok) return [];
    const payload = await res.json();
    return payload?.results || [];
  } catch {
    return [];
  }
}

async function perplexitySearch(query: string, userId: string = "", action: string = "market_recon"): Promise<string> {
  if (!PERPLEXITY_KEY) return "";
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: query }],
        max_tokens: 400,
      }),
    });
    if (!res.ok) return "";
    const payload = await res.json();
    const answer = payload?.choices?.[0]?.message?.content || "";
    // usage_ledger emit (systemic metering — Track B v2)
    recordUsageSonar({
      userId,
      model: "sonar",
      promptText: query,
      responseText: answer,
      feature: "intelligence_snapshot",
      action,
    });
    return answer;
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Phase 1.X health-check handler (2026-05-05 code 13041978):
  // Andreas mandate "every edge function returns 200 on health check".
  // Reachability probe = bare GET. Functional callers always POST with body.
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "intelligence-snapshot",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  try {
    // Phase 1.X auth-symmetry note (2026-05-05 code 13041978):
    // This function already trusts AuthResult — the prior 400-on-GET was caused
    // by no GET reachability handler above. service_role callers must inject
    // user_id; user-JWT callers come straight from auth.userId/auth.user.id.
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const authUserId = auth.user?.id || auth.userId || "";
    const userId = auth.isServiceRole ? String((body as any)?.user_id || "") : authUserId;
    if (!userId || userId === "service_role") {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fast cache path
    const existingSnap = await sb
      .from("intelligence_snapshots")
      .select("generated_at, executive_memo")
      .eq("user_id", userId)
      .eq("snapshot_type", "cognitive_full")
      .order("generated_at", { ascending: false })
      .limit(1);

    if (existingSnap.data?.length) {
      const lastGen = new Date(existingSnap.data[0].generated_at);
      const ageMinutes = (Date.now() - lastGen.getTime()) / 60000;
      if (ageMinutes < 14) {
        return new Response(JSON.stringify({
          status: "cached",
          cognitive: existingSnap.data[0].executive_memo,
          generated_at: existingSnap.data[0].generated_at,
          cache_age_minutes: Math.round(ageMinutes),
        }), {
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    const [profileRes, emailsRes, signalsRes, stratRes, cogRes, opRes, intRes] = await Promise.all([
      sb.from("business_profiles").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("outlook_emails").select("subject,from_address,body_preview,received_date,is_read").eq("user_id", userId).order("received_date", { ascending: false }).limit(15),
      sb.from("observation_events").select("signal_name,payload,source,domain,observed_at,confidence").eq("user_id", userId).order("observed_at", { ascending: false }).limit(20),
      sb.from("strategy_profiles").select("mission_statement,vision_statement,short_term_goals,long_term_goals,primary_challenges,growth_strategy").eq("user_id", userId).maybeSingle(),
      sb.from("cognitive_profiles").select("immutable_reality,behavioural_truth,delivery_preference").eq("user_id", userId).maybeSingle(),
      sb.from("user_operator_profile").select("agent_persona,operator_profile,persona_calibration_status,agent_instructions").eq("user_id", userId).maybeSingle(),
      sb.from("integration_accounts").select("provider,category,account_token").eq("user_id", userId),
    ]);

    const profile = profileRes.data || {};
    const emails = emailsRes.data || [];
    const signals = signalsRes.data || [];
    const strategy = stratRes.data || null;
    const cognitive = cogRes.data || null;
    const calibration = opRes.data || null;
    const integrations = intRes.data || [];

    let crmToken = "";
    let finToken = "";
    let crmProvider = "";
    let finProvider = "";
    for (const it of integrations) {
      if (it.category === "crm" && it.account_token && it.account_token !== "connected") {
        crmToken = it.account_token;
        crmProvider = it.provider;
      }
      if ((it.category === "accounting" || it.category === "financial") && it.account_token && it.account_token !== "connected") {
        finToken = it.account_token;
        finProvider = it.provider;
      }
    }

    const [contacts, deals, accounts, invoices] = await Promise.all([
      crmToken ? mergeFetch(crmToken, "crm/v1/contacts", 30) : Promise.resolve([]),
      crmToken ? mergeFetch(crmToken, "crm/v1/opportunities", 25) : Promise.resolve([]),
      finToken ? mergeFetch(finToken, "accounting/v1/accounts", 25) : Promise.resolve([]),
      finToken ? mergeFetch(finToken, "accounting/v1/invoices", 20) : Promise.resolve([]),
    ]);

    const marketQuerySeed = `${profile?.industry || ""} ${profile?.location || "Australia"}`.trim();
    const [marketTrends, marketCompetitors, marketRegulatory] = marketQuerySeed
      ? await Promise.all([
          perplexitySearch(`${marketQuerySeed} market trends outlook ${new Date().getFullYear()}`, userId, "market_trends"),
          perplexitySearch(`${profile?.business_name || marketQuerySeed} competitors`, userId, "competitors"),
          perplexitySearch(`${marketQuerySeed} regulation compliance changes ${new Date().getFullYear()}`, userId, "regulatory"),
        ])
      : ["", "", ""];

    const context = {
      business: profile,
      strategy,
      cognitive,
      calibration,
      emails: emails.slice(0, 10).map((e) => ({
        subject: e.subject,
        from: e.from_address,
        date: e.received_date,
        read: e.is_read,
        preview: String(e.body_preview || "").slice(0, 120),
      })),
      signals: signals.slice(0, 15),
      crm: crmProvider
        ? {
            provider: crmProvider,
            contacts: contacts.length,
            deals: deals.slice(0, 10),
          }
        : null,
      financial: finProvider
        ? {
            provider: finProvider,
            accounts: accounts.slice(0, 5),
            invoices: invoices.slice(0, 8),
          }
        : null,
      market: {
        trends: marketTrends,
        competitors: marketCompetitors,
        regulatory: marketRegulatory,
      },
    };

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SNAPSHOT_MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Generate executive intelligence snapshot from:\n${JSON.stringify(context)}` },
        ],
        temperature: 0.6,
        max_tokens: 1200,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[intelligence-snapshot] OpenAI error:", errText);
      return new Response(JSON.stringify({ error: "AI unavailable" }), {
        status: 502,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content || "{}";
    const usage = aiData?.usage || {};

    // usage_ledger emit (systemic metering — Track B v2)
    recordUsage({
      userId,
      model: SNAPSHOT_MODEL,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cachedInputTokens: usage.prompt_tokens_details?.cached_tokens || 0,
      feature: "intelligence_snapshot",
    });
    let cognitiveOutput: any;
    try {
      cognitiveOutput = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    } catch {
      cognitiveOutput = { executive_memo: raw, system_state: "STABLE" };
    }

    const generatedAt = new Date().toISOString();
    const score = cognitiveOutput.system_state === "CRITICAL"
      ? 0.2
      : cognitiveOutput.system_state === "COMPRESSION"
      ? 0.4
      : cognitiveOutput.system_state === "DRIFT"
      ? 0.6
      : 0.9;

    await Promise.all([
      restUpsert("intelligence_snapshots", {
        user_id: userId,
        snapshot_type: "cognitive_full",
        executive_memo: cognitiveOutput,
        resolution_score: score,
        generated_at: generatedAt,
        summary: "",
      }, "user_id,snapshot_type"),
      restUpsert("intelligence_snapshots", {
        user_id: userId,
        snapshot_type: "data_context",
        executive_memo: { context },
        resolution_score: score,
        generated_at: generatedAt,
        summary: "",
      }, "user_id,snapshot_type"),
    ]);

    return new Response(JSON.stringify({
      status: "snapshot_updated",
      cognitive: cognitiveOutput,
      generated_at: generatedAt,
      cache_age_minutes: 0,
      merge_cache_hours: MERGE_CACHE_HOURS,
    }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
