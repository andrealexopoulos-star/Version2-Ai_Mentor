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

    console.log("[EDGE] outlook-auth invoked", {
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

      const tokenResponse = await fetch(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: Deno.env.get("AZURE_CLIENT_ID")!,
            client_secret: Deno.env.get("AZURE_CLIENT_SECRET")!,
            code: code,
            redirect_uri: `${Deno.env.get("BACKEND_URL")}/api/auth/outlook/callback`,
            grant_type: "authorization_code",
            scope: "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic",
          }).toString(),
        }
      );

      if (!tokenResponse.ok) {
        return new Response(JSON.stringify({ ok: false, error: "Token exchange failed" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const tokens = await tokenResponse.json();
      const userResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const userInfo = await userResponse.json();
      const microsoftEmail = userInfo.mail || userInfo.userPrincipalName;
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await supabaseService.from("outlook_oauth_tokens").upsert(
        {
          user_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          account_email: microsoftEmail,
          account_name: userInfo.displayName,
          provider: "microsoft",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      await supabaseService.from("email_connections").upsert(
        {
          user_id,
          provider: "outlook",
          connected: true,
          connected_email: microsoftEmail,
          inbox_type: "standard",
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      return new Response(JSON.stringify({ ok: true, provider: "outlook", connected: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Handle status check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, connected: false, provider: "outlook", error_stage: "auth", error_message: "Missing auth" }),
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
        JSON.stringify({ ok: false, connected: false, provider: "outlook", error_stage: "auth", error_message: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log("[EDGE] outlook-auth status check", { user_id: user.id });

    const { data: connection } = await supabaseService
      .from("outlook_oauth_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!connection?.access_token) {
      return new Response(JSON.stringify({ ok: true, connected: false, provider: "outlook" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders", {
      headers: { Authorization: `Bearer ${connection.access_token}` },
    });

    if (!graphResponse.ok) {
      return new Response(JSON.stringify({ ok: true, connected: false, provider: "outlook" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const folders = await graphResponse.json();
    const folderNames = folders.value?.map((f: any) => f.displayName) || [];
    const inboxType = folderNames.includes("Focused") && folderNames.includes("Other") ? "focused" : "standard";

    await supabaseService.from("email_connections").upsert(
      {
        user_id: user.id,
        provider: "outlook",
        connected: true,
        connected_email: connection.account_email,
        inbox_type: inboxType,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return new Response(
      JSON.stringify({ ok: true, connected: true, provider: "outlook", inbox_type: inboxType, account_email: connection.account_email }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[EDGE] outlook-auth error:", error);
    return new Response(
      JSON.stringify({ ok: false, connected: false, provider: "outlook", error_stage: "graph_api", error_message: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
