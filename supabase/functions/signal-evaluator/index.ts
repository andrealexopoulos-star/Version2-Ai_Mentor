import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error || "Unauthorized" }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const allUsersMode = Boolean(body.all_users || body.batch);
    if (allUsersMode && !auth.isServiceRole) {
      return new Response(JSON.stringify({ ok: false, error: "service_role token required for all-users loops" }), {
        status: 403,
        headers: corsHeaders(req),
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const targets: string[] = allUsersMode
      ? ((await sb.from("business_profiles").select("user_id").limit(250)).data || []).map((r: any) => r.user_id)
      : [String(body.user_id || auth.userId || "").trim()].filter(Boolean);

    const evaluations = targets.map((userId) => ({
      user_id: userId,
      score: Number(body.score || 0),
      signal_type: String(body.signal_type || "generic"),
      evaluated_at: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({
      ok: true,
      all_users_mode: allUsersMode,
      evaluated_count: evaluations.length,
      evaluations,
    }), {
      status: 200,
      headers: corsHeaders(req),
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 500,
      headers: corsHeaders(req),
    });
  }
});
