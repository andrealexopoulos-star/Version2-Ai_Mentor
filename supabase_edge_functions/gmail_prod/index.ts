import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    console.log("[EDGE] gmail_prod invoked", {
      action,
      timestamp: new Date().toISOString(),
    });

    // Handle OAuth callback
    if (action === "process_callback") {
      const { code, user_id } = body;

      if (!code || !user_id) {
        return new Response(JSON.stringify({ ok: false, error: "Missing code or user_id" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          code: code,
          redirect_uri: `${Deno.env.get("BACKEND_URL")}/api/auth/gmail/callback`,
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenResponse.ok) {
        return new Response(JSON.stringify({ ok: false, error: "Token exchange failed" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const tokens = await tokenResponse.json();
      const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const userInfo = await userResponse.json();
      const googleEmail = userInfo.email;
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await supabaseService.from("gmail_connections").upsert(
        {
          user_id,
          email: googleEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: expiresAt,
          scopes: "https://www.googleapis.com/auth/gmail.readonly",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      await supabaseService.from("email_connections").upsert(
        {
          user_id,
          provider: "gmail",
          connected: true,
          connected_email: googleEmail,
          inbox_type: "standard",
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      return new Response(JSON.stringify({ ok: true, provider: "gmail", connected: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Handle status check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, connected: false, provider: "gmail", error_stage: "auth", error_message: "Missing auth" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseAnon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, connected: false, provider: "gmail", error_stage: "auth", error_message: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log("[EDGE] gmail_prod status check", { user_id: user.id });

    const { data: connection } = await supabaseService
      .from("gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!connection?.access_token) {
      return new Response(JSON.stringify({ ok: true, connected: false, provider: "gmail" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
      headers: { Authorization: `Bearer ${connection.access_token}` },
    });

    if (!gmailResponse.ok) {
      return new Response(JSON.stringify({ ok: true, connected: false, provider: "gmail" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const data = await gmailResponse.json();
    const labels = data.labels || [];
    const hasPriority = labels.some((l: any) => l.id === "CATEGORY_PRIMARY" || l.id === "IMPORTANT");
    const inboxType = hasPriority ? "priority" : "standard";

    await supabaseService.from("email_connections").upsert(
      {
        user_id: user.id,
        provider: "gmail",
        connected: true,
        connected_email: user.email,
        inbox_type: inboxType,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return new Response(
      JSON.stringify({ ok: true, connected: true, provider: "gmail", inbox_type: inboxType, labels_count: labels.length }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[EDGE] gmail_prod error:", error);
    return new Response(
      JSON.stringify({ ok: false, connected: false, provider: "gmail", error_stage: "gmail_api", error_message: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
