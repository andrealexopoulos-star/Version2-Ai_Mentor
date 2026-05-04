import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

  // Phase 1.X health-check handler (2026-05-05 code 13041978):
  // Andreas mandate "every edge function returns 200 on health check".
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "outlook_auth",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Phase 1.X auth-symmetry hard-fix (2026-05-05 code 13041978):
    // Body parse only meaningful on POST/PUT; non-body methods would 400 here.
    const body = req.method === "POST" || req.method === "PUT" ? await req.json().catch(() => ({})) : {};
    const action = body.action;

    if (action === "store_tokens") {
      const { user_id, access_token, refresh_token, expires_at, account_email, account_name } = body;
      const ownership = enforceUserOwnership(auth, user_id);
      if (!ownership.ok) {
        return new Response(JSON.stringify({ ok: false, error: ownership.error }), {
          status: ownership.status,
          headers: corsHeaders(req),
        });
      }
      if (!user_id || !access_token) {
        return new Response(JSON.stringify({ ok: false, error: "Missing user_id or access_token" }), {
          status: 400,
          headers: corsHeaders(req),
        });
      }

      let inboxType = "standard";
      try {
        const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (graphResponse.ok) {
          const folders = await graphResponse.json();
          const folderNames = folders.value?.map((f: any) => f.displayName) || [];
          inboxType = folderNames.includes("Focused") && folderNames.includes("Other") ? "focused" : "standard";
        }
      } catch {
        // Leave fallback inbox type.
      }

      await supabaseService.from("outlook_oauth_tokens").upsert(
        {
          user_id,
          access_token,
          refresh_token,
          expires_at,
          account_email,
          account_name,
          provider: "microsoft",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      await supabaseService.from("email_connections").upsert(
        {
          user_id,
          provider: "outlook",
          connected: true,
          connected_email: account_email,
          inbox_type: inboxType,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      return new Response(JSON.stringify({ ok: true, connected: true }), {
        status: 200,
        headers: corsHeaders(req),
      });
    }

    const userId = auth.isServiceRole ? String(body.user_id || "").trim() : auth.userId;
    if (!userId) {
      return new Response(
        JSON.stringify({ ok: false, connected: false, provider: "outlook", error_stage: "auth", error_message: "Invalid token" }),
        { status: 401, headers: corsHeaders(req) },
      );
    }

    const { data: connection } = await supabaseService
      .from("outlook_oauth_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!connection?.access_token) {
      return new Response(JSON.stringify({ ok: true, connected: false, provider: "outlook" }), {
        status: 200,
        headers: corsHeaders(req),
      });
    }

    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders", {
      headers: { Authorization: `Bearer ${connection.access_token}` },
    });
    if (!graphResponse.ok) {
      return new Response(JSON.stringify({ ok: true, connected: false, provider: "outlook" }), {
        status: 200,
        headers: corsHeaders(req),
      });
    }

    const folders = await graphResponse.json();
    const folderNames = folders.value?.map((f: any) => f.displayName) || [];
    const inboxType = folderNames.includes("Focused") && folderNames.includes("Other") ? "focused" : "standard";
    await supabaseService.from("email_connections").upsert(
      {
        user_id: userId,
        provider: "outlook",
        connected: true,
        connected_email: connection.account_email,
        inbox_type: inboxType,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return new Response(
      JSON.stringify({ ok: true, connected: true, provider: "outlook", inbox_type: inboxType, account_email: connection.account_email }),
      { status: 200, headers: corsHeaders(req) },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, connected: false, provider: "outlook", error_stage: "graph_api", error_message: (error as Error).message }),
      { status: 500, headers: corsHeaders(req) },
    );
  }
});
