// ═══════════════════════════════════════════════════════════════
// CHECKIN MANAGER — Supabase Edge Function
// Deploy: supabase functions deploy checkin-manager
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════
//
// Handles recalibration (14-day cycle) + weekly video check-in alerts.
// Replaces FastAPI endpoints: /checkins/pending, /schedule, /postpone, /dismiss
//
// ROUTES (via action field):
//   POST { action: "pending" }   — get pending alerts
//   POST { action: "schedule", type, scheduled_for, notes? }
//   POST { action: "postpone", check_in_id, new_date }
//   POST { action: "dismiss" }
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "pending";

    // ═══ PENDING — Check what's due ═══
    if (action === "pending") {
      const now = new Date();

      // Last calibration date
      let lastCalibration: string | null = null;
      const { data: scs } = await sb.from("strategic_console_state")
        .select("updated_at").eq("user_id", userId).maybeSingle();
      if (scs?.updated_at) lastCalibration = scs.updated_at;

      if (!lastCalibration) {
        const { data: op } = await sb.from("user_operator_profile")
          .select("operator_profile").eq("user_id", userId).maybeSingle();
        if (op?.operator_profile?.console_state?.updated_at) {
          lastCalibration = op.operator_profile.console_state.updated_at;
        }
      }

      // Scheduled check-ins
      const { data: scheduled } = await sb.from("calibration_schedules")
        .select("*").eq("user_id", userId).eq("status", "pending")
        .order("scheduled_for", { ascending: true });

      // Recalibration due? (every 14 days)
      let recalDue = false;
      let recalDaysOverdue = 0;
      if (lastCalibration) {
        const lastDt = new Date(lastCalibration);
        const daysSince = Math.floor((now.getTime() - lastDt.getTime()) / (1000 * 60 * 60 * 24));
        recalDue = daysSince >= 14;
        recalDaysOverdue = Math.max(0, daysSince - 14);
      } else {
        recalDue = true;
      }

      // Check for recent dismissal
      const { data: dismissed } = await sb.from("calibration_schedules")
        .select("scheduled_for").eq("user_id", userId).eq("type", "recalibration_dismissed")
        .eq("status", "dismissed").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (dismissed?.scheduled_for) {
        const dismissedUntil = new Date(dismissed.scheduled_for);
        if (now < dismissedUntil) recalDue = false;
      }

      // Weekly video check-in due?
      let videoDue = true;
      const { data: lastVideo } = await sb.from("calibration_schedules")
        .select("completed_at, scheduled_for").eq("user_id", userId).eq("type", "video_checkin")
        .in("status", ["completed", "pending"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (lastVideo) {
        const lastVDate = new Date(lastVideo.completed_at || lastVideo.scheduled_for);
        const daysSinceVideo = Math.floor((now.getTime() - lastVDate.getTime()) / (1000 * 60 * 60 * 24));
        videoDue = daysSinceVideo >= 7;
      }

      const alerts: any[] = [];
      if (recalDue) {
        alerts.push({
          type: "recalibration",
          title: "Recalibration Due",
          message: `Your business profile was last calibrated ${recalDaysOverdue + 14} days ago. Recalibrate to keep insights accurate.`,
          overdue_days: recalDaysOverdue,
          severity: recalDaysOverdue > 7 ? "high" : "medium",
        });
      }
      if (videoDue) {
        alerts.push({
          type: "video_checkin",
          title: "Weekly Check-In Available",
          message: "Schedule a video check-in with your BIQc advisor to review progress and priorities.",
          severity: "low",
        });
      }

      return new Response(JSON.stringify({
        alerts,
        scheduled: scheduled || [],
        last_calibration: lastCalibration,
        recalibration_due: recalDue,
        video_checkin_due: videoDue,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══ SCHEDULE — Book a recalibration or video check-in ═══
    if (action === "schedule") {
      const checkinId = crypto.randomUUID();
      const { error } = await sb.from("calibration_schedules").insert({
        id: checkinId,
        user_id: userId,
        type: body.type || "video_checkin",
        scheduled_for: body.scheduled_for,
        notes: body.notes || null,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, check_in_id: checkinId, scheduled_for: body.scheduled_for }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ POSTPONE — Move to a new date ═══
    if (action === "postpone") {
      const { error } = await sb.from("calibration_schedules").update({
        scheduled_for: body.new_date,
        postponed_at: new Date().toISOString(),
      }).eq("id", body.check_in_id).eq("user_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, new_date: body.new_date }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ DISMISS — Snooze recalibration for 7 days ═══
    if (action === "dismiss") {
      const dismissUntil = new Date();
      dismissUntil.setDate(dismissUntil.getDate() + 7);
      await sb.from("calibration_schedules").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        type: "recalibration_dismissed",
        scheduled_for: dismissUntil.toISOString(),
        status: "dismissed",
        created_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ ok: true, dismissed_until: dismissUntil.toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
