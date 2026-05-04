// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE BRIDGE — Supabase Edge Function
// File: supabase/functions/intelligence-bridge/index.ts
//
// Deploy: supabase functions deploy intelligence-bridge
// ═══════════════════════════════════════════════════════════════
//
// SECRETS REQUIRED:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// PURPOSE:
//   Converts Watchtower findings + Snapshot open_risks/contradictions
//   into intelligence_actions (actionable items for the user).
//
// TRIGGERS:
//   Called by: snapshot generation, watchtower position changes
//   POST /functions/v1/intelligence-bridge
//   Body: { "user_id": "...", "snapshot": {...} }
//     OR: { "user_id": "...", "finding": {...} }
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, enforceUserOwnership } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RISK_SUGGESTIONS: Record<string, Record<string, string>> = {
  finance: {
    CRITICAL: "Review cash position immediately. Check outstanding invoices and upcoming payments.",
    DETERIORATING: "Investigate cash flow trend. Consider following up on overdue invoices.",
    ELEVATED: "Monitor financial metrics closely. Review upcoming payment obligations.",
  },
  sales: {
    CRITICAL: "Pipeline requires immediate attention. Review deal stages and client engagement.",
    DETERIORATING: "Sales velocity is slowing. Review lead follow-up timing and conversion rates.",
    ELEVATED: "Sales signals shifting. Check pipeline health and lead quality.",
  },
  operations: {
    CRITICAL: "Operational breakdown detected. Review team workload and process compliance.",
    DETERIORATING: "Operational drift detected. Check SOP adherence and task completion rates.",
    ELEVATED: "Operations showing strain. Monitor process efficiency and bottlenecks.",
  },
  team: {
    CRITICAL: "Team signals are concerning. Review workload distribution and engagement.",
    DETERIORATING: "Team dynamics shifting. Monitor communication patterns and meeting frequency.",
    ELEVATED: "Team engagement fluctuating. Check workload balance.",
  },
  market: {
    CRITICAL: "Market conditions have shifted significantly. Review competitive positioning.",
    DETERIORATING: "Market signals weakening. Check competitor activity and customer sentiment.",
    ELEVATED: "Market movement detected. Review competitive landscape.",
  },
};

function suggestAction(domain: string, position: string): string {
  return RISK_SUGGESTIONS[domain]?.[position] ||
    `Review your ${domain} position and take corrective action.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error || "Unauthorized" }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }

  // Phase 1.X health-check handler (2026-05-05 code 13041978):
  // Andreas mandate "every edge function returns 200 on health check". Without
  // this guard, GET hits req.json() below and 500s with "Unexpected end of JSON input".
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "intelligence-bridge",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const userId = body.user_id || auth.userId;
    const ownership = enforceUserOwnership(auth, userId);
    if (!ownership.ok) {
      return new Response(JSON.stringify({ ok: false, error: ownership.error }), {
        status: ownership.status,
        headers: corsHeaders(req),
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: corsHeaders(req),
      });
    }

    let actionsCreated = 0;

    // Load existing action source_ids for deduplication
    const { data: existing } = await sb
      .from("intelligence_actions")
      .select("source_id")
      .eq("user_id", userId);
    const existingIds = new Set((existing || []).map((a: any) => a.source_id));

    // MODE 1: Process a full snapshot (open_risks + contradictions)
    if (body.snapshot) {
      const snapshot = body.snapshot;

      // Process open risks
      for (const risk of (snapshot.open_risks || [])) {
        const sourceId = `risk_${risk.domain}_${(snapshot.id || "").substring(0, 8)}`;
        if (existingIds.has(sourceId)) continue;

        const severity = ["CRITICAL", "DETERIORATING"].includes(risk.position) ? "high" : "medium";
        const persistence = risk.persistence_hours ? ` (persisting ${risk.persistence_hours}h)` : "";

        const { error } = await sb.from("intelligence_actions").insert({
          id: crypto.randomUUID(),
          user_id: userId,
          source: "watchtower",
          source_id: sourceId,
          domain: risk.domain,
          severity,
          title: `${risk.domain.charAt(0).toUpperCase() + risk.domain.slice(1)} position: ${risk.position}`,
          description: `Your ${risk.domain} domain has moved to ${risk.position}${persistence}. Detected ${risk.times_detected || 1} time(s).`,
          suggested_action: suggestAction(risk.domain, risk.position),
          status: "action_required",
          created_at: new Date().toISOString(),
        });

        if (!error) actionsCreated++;
      }

      // Process contradictions
      for (const contra of (snapshot.contradictions || [])) {
        const sourceId = `contra_${contra.domain || "unknown"}_${(snapshot.id || "").substring(0, 8)}`;
        if (existingIds.has(sourceId)) continue;

        const { error } = await sb.from("intelligence_actions").insert({
          id: crypto.randomUUID(),
          user_id: userId,
          source: "contradiction_engine",
          source_id: sourceId,
          domain: contra.domain || "general",
          severity: "medium",
          title: `Contradiction detected in ${contra.domain || "your data"}`,
          description: `A ${contra.type || "data"} contradiction has been detected ${contra.times_detected || 1} time(s). This may indicate conflicting signals in your business data.`,
          suggested_action: "Review the conflicting data points and confirm which is accurate",
          status: "action_required",
          created_at: new Date().toISOString(),
        });

        if (!error) actionsCreated++;
      }
    }

    // MODE 2: Process a single watchtower finding
    if (body.finding) {
      const f = body.finding;
      const sourceId = `wt_${f.id || crypto.randomUUID().substring(0, 8)}`;

      if (!existingIds.has(sourceId)) {
        const severity = ["CRITICAL", "DETERIORATING"].includes(f.new_position) ? "high" : "medium";

        const { error } = await sb.from("intelligence_actions").insert({
          id: crypto.randomUUID(),
          user_id: userId,
          source: "watchtower",
          source_id: sourceId,
          domain: f.domain || "general",
          severity,
          title: `${(f.domain || "Business").charAt(0).toUpperCase() + (f.domain || "business").slice(1)}: ${f.old_position || "?"} → ${f.new_position || "?"}`,
          description: f.reason || "Position change detected by Watchtower.",
          suggested_action: suggestAction(f.domain || "general", f.new_position || "ELEVATED"),
          status: "action_required",
          created_at: new Date().toISOString(),
        });

        if (!error) actionsCreated++;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      actions_created: actionsCreated,
      user_id: userId,
    }), {
      headers: corsHeaders(req),
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders(req),
    });
  }
});
