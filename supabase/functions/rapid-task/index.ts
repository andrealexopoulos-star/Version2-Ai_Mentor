import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { verifyAuth, enforceUserOwnership } from "../_shared/auth.ts";
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
    const userId = String(body.user_id || auth.userId || "").trim();
    const ownership = enforceUserOwnership(auth, userId);
    if (!ownership.ok) {
      return new Response(JSON.stringify({ ok: false, error: ownership.error }), {
        status: ownership.status,
        headers: corsHeaders(req),
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const task = {
      user_id: userId,
      title: String(body.title || "Untitled rapid task"),
      description: String(body.description || ""),
      status: "pending",
      created_at: new Date().toISOString(),
      source: "rapid-task",
    };
    await sb.from("intelligence_actions").insert({
      id: crypto.randomUUID(),
      user_id: task.user_id,
      source: "rapid-task",
      source_id: `rapid_task_${Date.now()}`,
      domain: "operations",
      severity: "medium",
      title: task.title,
      description: task.description,
      suggested_action: "Execute and track completion.",
      status: "action_required",
      created_at: task.created_at,
    });

    return new Response(JSON.stringify({ ok: true, task }), {
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
