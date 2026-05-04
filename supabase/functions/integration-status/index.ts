import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const auth = await verifyAuth(req);
  if (!auth.ok || (!auth.userId && !auth.isServiceRole)) {
    return new Response(JSON.stringify({ ok: false, error: auth.error || "Unauthorized" }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }

  // Phase 1.X health-check handler (2026-05-05 code 13041978):
  // Andreas mandate "every edge function returns 200 on health check".
  // Reachability ping = GET with NO ?provider param. Functional GET callers
  // include ?provider=gmail|outlook and continue past this gate.
  if (req.method === "GET" && !new URL(req.url).searchParams.get("provider")) {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "integration-status",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");
    if (!provider || (provider !== "gmail" && provider !== "outlook")) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid provider. Must be gmail or outlook" }), {
        status: 400,
        headers: corsHeaders(req),
      });
    }

    // Phase 1.X auth-symmetry hard-fix (2026-05-05 code 13041978):
    // Body parse only meaningful when client sends one. GET with provider param
    // never has a body, so don't fail-400 on unparseable empty body.
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const userIdFromQuery = url.searchParams.get("user_id");
    const userId = auth.isServiceRole
      ? String(body.user_id || userIdFromQuery || "").trim()
      : auth.userId;
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: "user_id required for service role calls" }), {
        status: 400,
        headers: corsHeaders(req),
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    if (provider === "gmail") {
      const { data: gmailConnection } = await sb
        .from("gmail_connections")
        .select("email, token_expiry")
        .eq("user_id", userId)
        .maybeSingle();
      if (!gmailConnection) {
        return new Response(JSON.stringify({ ok: true, provider: "gmail", connected: false }), {
          status: 200,
          headers: corsHeaders(req),
        });
      }
      const tokenExpiry = new Date(gmailConnection.token_expiry);
      return new Response(JSON.stringify({
        ok: true,
        provider: "gmail",
        connected: true,
        needs_reconnect: tokenExpiry < new Date(),
        connected_email: gmailConnection.email,
      }), { status: 200, headers: corsHeaders(req) });
    }

    const { data: outlookConnection } = await sb
      .from("outlook_oauth_tokens")
      .select("account_email, expires_at")
      .eq("user_id", userId)
      .eq("provider", "microsoft")
      .maybeSingle();
    if (!outlookConnection) {
      return new Response(JSON.stringify({ ok: true, provider: "outlook", connected: false }), {
        status: 200,
        headers: corsHeaders(req),
      });
    }
    const tokenExpiry = new Date(outlookConnection.expires_at);
    return new Response(JSON.stringify({
      ok: true,
      provider: "outlook",
      connected: true,
      needs_reconnect: tokenExpiry < new Date(),
      connected_email: outlookConnection.account_email,
    }), { status: 200, headers: corsHeaders(req) });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 500,
      headers: corsHeaders(req),
    });
  }
});
