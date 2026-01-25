import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface StatusResponse {
  ok: true;
  provider: "gmail" | "outlook";
  connected: boolean;
  needs_reconnect?: boolean;
  connected_email?: string;
  error?: string;
}

interface ErrorResponse {
  ok: false;
  provider: "gmail" | "outlook";
  error: string;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== INTEGRATION STATUS CHECK STARTED ===");

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    if (!provider || (provider !== "gmail" && provider !== "outlook")) {
      const response: ErrorResponse = {
        ok: false,
        provider: "gmail",
        error: "Invalid provider. Must be 'gmail' or 'outlook'",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Checking status for provider: ${provider}`);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const response: ErrorResponse = {
        ok: false,
        provider: provider as "gmail" | "outlook",
        error: "Missing Authorization header",
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseToken = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      const response: ErrorResponse = {
        ok: false,
        provider: provider as "gmail" | "outlook",
        error: "Edge Function configuration error",
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseAnon.auth.getUser(supabaseToken);

    if (userError || !user) {
      const response: ErrorResponse = {
        ok: false,
        provider: provider as "gmail" | "outlook",
        error: `Authentication failed: ${userError?.message || "Unknown"}`,
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ User verified: ${user.email} (${user.id})`);

    if (provider === "gmail") {
      const { data: gmailConnection } = await supabaseService
        .from("gmail_connections")
        .select("email, token_expiry")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!gmailConnection) {
        const response: StatusResponse = {
          ok: true,
          provider: "gmail",
          connected: false,
        };
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenExpiry = new Date(gmailConnection.token_expiry);
      const needsRefresh = tokenExpiry < new Date();

      const response: StatusResponse = {
        ok: true,
        provider: "gmail",
        connected: true,
        needs_reconnect: needsRefresh,
        connected_email: gmailConnection.email,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const { data: outlookConnection } = await supabaseService
        .from("outlook_oauth_tokens")
        .select("account_email, expires_at")
        .eq("user_id", user.id)
        .eq("provider", "microsoft")
        .maybeSingle();

      if (!outlookConnection) {
        const response: StatusResponse = {
          ok: true,
          provider: "outlook",
          connected: false,
        };
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenExpiry = new Date(outlookConnection.expires_at);
      const needsRefresh = tokenExpiry < new Date();

      const response: StatusResponse = {
        ok: true,
        provider: "outlook",
        connected: true,
        needs_reconnect: needsRefresh,
        connected_email: outlookConnection.account_email,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
    const response: ErrorResponse = {
      ok: false,
      provider: "gmail",
      error: error.message,
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }
});
