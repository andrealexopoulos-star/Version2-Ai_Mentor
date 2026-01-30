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

  console.log("[EDGE] outlook-auth START", new Date().toISOString());

  try {
    const body = await req.json();
    console.log("[EDGE] Body received:", JSON.stringify(body));

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("[EDGE] Environment check:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!serviceRoleKey,
    });

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[EDGE] Missing Supabase credentials");
      return new Response(
        JSON.stringify({ ok: false, error: "Missing credentials" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log("[EDGE] Supabase client created");

    const action = body.action;
    console.log("[EDGE] Action:", action);

    // NEW: Handle store_tokens action (backend already exchanged tokens)
    if (action === "store_tokens") {
      console.log("[EDGE] Storing pre-exchanged tokens");

      const { user_id, access_token, refresh_token, expires_at, account_email, account_name } = body;

      console.log("[EDGE] Token data:", {
        user_id,
        account_email,
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
        expires_at,
      });

      if (!user_id || !access_token) {
        console.error("[EDGE] Missing required fields");
        return new Response(
          JSON.stringify({ ok: false, error: "Missing user_id or access_token" }),
          { status: 400, headers: corsHeaders }
        );
      }

      console.log("[EDGE] Writing to outlook_oauth_tokens...");
      const { data: tokenData, error: tokenError } = await supabase
        .from("outlook_oauth_tokens")
        .upsert({
          user_id,
          access_token,
          refresh_token,
          expires_at,
          account_email,
          account_name: account_name || "",
          provider: "microsoft",
          updated_at: new Date().toISOString(),
        })
        .select();

      if (tokenError) {
        console.error("[EDGE] Token write error:", JSON.stringify(tokenError));
        return new Response(
          JSON.stringify({ ok: false, error: `Token write failed: ${tokenError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log("[EDGE] Tokens written successfully:", tokenData);

      console.log("[EDGE] Writing to email_connections...");
      const { data: connData, error: connError } = await supabase
        .from("email_connections")
        .upsert({
          user_id,
          provider: "outlook",
          connected: true,
          connected_email: account_email,
          inbox_type: "standard",
          connected_at: new Date().toISOString(),
        })
        .select();

      if (connError) {
        console.error("[EDGE] Connection write error:", JSON.stringify(connError));
        return new Response(
          JSON.stringify({ ok: false, error: `Connection write failed: ${connError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log("[EDGE] Connection written successfully:", connData);
      console.log("EMAIL_CONNECTION_SAVED", { user_id, provider: "outlook" });
      console.log("[EDGE] SUCCESS - Outlook connected for user:", user_id);

      return new Response(
        JSON.stringify({ ok: true, provider: "outlook", connected: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Status check
    console.log("[EDGE] Status check requested");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[EDGE] No auth header, returning disconnected");
      return new Response(
        JSON.stringify({ ok: true, connected: false, provider: "outlook" }),
        { status: 200, headers: corsHeaders }
      );
    }

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (userError || !user) {
      console.log("[EDGE] Invalid user token");
      return new Response(
        JSON.stringify({ ok: true, connected: false, provider: "outlook" }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log("[EDGE] Status check for user:", user.id);

    const { data: emailConn } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "outlook")
      .maybeSingle();

    console.log("[EDGE] Connection query result:", emailConn);

    if (emailConn?.connected) {
      console.log("[EDGE] User is connected");
      return new Response(
        JSON.stringify({
          ok: true,
          connected: true,
          provider: "outlook",
          account_email: emailConn.connected_email,
          inbox_type: emailConn.inbox_type,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log("[EDGE] User not connected");
    return new Response(
      JSON.stringify({ ok: true, connected: false, provider: "outlook" }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[EDGE] FATAL ERROR:", error);
    console.error("[EDGE] Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
