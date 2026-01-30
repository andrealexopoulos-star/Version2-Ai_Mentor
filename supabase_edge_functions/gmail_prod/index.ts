import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface GmailLabel {
  id: string;
  name: string;
  type?: string;
}

interface SuccessResponse {
  ok: true;
  connected: true;
  provider: "gmail";
  inbox_type: "priority" | "standard";
  labels_count: number;
  remediation?: string;
}

interface DisconnectedResponse {
  ok: true;
  connected: false;
  provider: "gmail";
}

interface ErrorResponse {
  ok: false;
  connected: false;
  provider: "gmail";
  error_stage: "auth" | "token" | "gmail_api";
  error_message: string;
}

type ApiResponse = SuccessResponse | DisconnectedResponse | ErrorResponse;

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== GMAIL PRODUCTION EDGE FUNCTION STARTED ===");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Missing or invalid Authorization header");
      const response: ErrorResponse = {
        ok: false,
        connected: false,
        provider: "gmail",
        error_stage: "auth",
        error_message: "Missing Authorization header",
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseToken = authHeader.replace("Bearer ", "");
    console.log("✅ Supabase JWT extracted");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("❌ Missing Supabase environment variables");
      const response: ErrorResponse = {
        ok: false,
        connected: false,
        provider: "gmail",
        error_stage: "auth",
        error_message: "Edge Function configuration error",
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anon client for user authentication
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Service role client for database operations (bypasses RLS)
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseAnon.auth.getUser(supabaseToken);

    if (userError || !user) {
      console.error("❌ Failed to verify user:", userError);
      const response: ErrorResponse = {
        ok: false,
        connected: false,
        provider: "gmail",
        error_stage: "auth",
        error_message: `Invalid or expired token: ${userError?.message || "Unknown"}`,
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ User verified: ${user.email} (${user.id})`);

    // Check gmail_connections table for stored tokens using SERVICE ROLE (bypasses RLS)
    console.log("🔍 Checking gmail_connections table for tokens (using service role)...");
    
    const { data: gmailConnection, error: connectionError } = await supabaseService
      .from("gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectionError) {
      console.error("❌ Error querying gmail_connections:", connectionError);
      const response: ErrorResponse = {
        ok: false,
        connected: false,
        provider: "gmail",
        error_stage: "token",
        error_message: `Database error: ${connectionError.message}`,
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!gmailConnection) {
      console.log("❌ No Gmail connection found in database for user:", user.id);
      const response: DisconnectedResponse = {
        ok: true,
        connected: false,
        provider: "gmail",
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log retrieved data to prove success
    console.log("✅ Gmail connection retrieved from database:");
    console.log(`  - Email: ${gmailConnection.email}`);
    console.log(`  - Token Expiry: ${gmailConnection.token_expiry}`);
    console.log(`  - Scopes: ${gmailConnection.scopes}`);

    const accessTokenFromDB = gmailConnection.access_token;
    const refreshTokenFromDB = gmailConnection.refresh_token;

    if (!accessTokenFromDB) {
      console.error("❌ No access token in gmail_connections");
      const response: DisconnectedResponse = {
        ok: true,
        connected: false,
        provider: "gmail",
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Gmail tokens retrieved from database");
    console.log(`  - Access token: Present`);
    console.log(`  - Refresh token: ${refreshTokenFromDB ? "Present" : "Missing"}`);

    let accessToken = accessTokenFromDB;
    const refreshToken = refreshTokenFromDB;

    const callGmailApi = async (token: string): Promise<{ labels: GmailLabel[]; error?: string }> => {
      try {
        console.log("📧 Calling Gmail API...");
        const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!gmailResponse.ok) {
          const errorText = await gmailResponse.text();
          console.error(`❌ Gmail API error (${gmailResponse.status}):`, errorText);
          return { labels: [], error: `Gmail API returned ${gmailResponse.status}: ${errorText}` };
        }

        const data = await gmailResponse.json();
        console.log(`✅ Gmail API success - received ${data.labels?.length || 0} labels`);
        return { labels: data.labels || [] };
      } catch (error) {
        console.error("❌ Gmail API call failed:", error);
        return { labels: [], error: error.message };
      }
    };

    let gmailResult = await callGmailApi(accessToken);

    if (gmailResult.error && gmailResult.error.includes("401") && refreshToken) {
      console.log("🔄 Access token expired, attempting refresh...");

      const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

      if (!googleClientId || !googleClientSecret) {
        console.error("❌ Missing Google OAuth credentials for token refresh");
        const response: ErrorResponse = {
          ok: false,
          connected: false,
          provider: "gmail",
          error_stage: "token",
          error_message: "Cannot refresh token - missing credentials",
        };
        return new Response(JSON.stringify(response), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }).toString(),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error("❌ Token refresh failed:", errorText);
          const response: ErrorResponse = {
            ok: false,
            connected: false,
            provider: "gmail",
            error_stage: "token",
            error_message: `Token refresh failed: ${errorText}`,
          };
          return new Response(JSON.stringify(response), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;
        console.log("✅ Access token refreshed successfully");

        gmailResult = await callGmailApi(accessToken);
      } catch (refreshError) {
        console.error("❌ Token refresh exception:", refreshError);
        const response: ErrorResponse = {
          ok: false,
          connected: false,
          provider: "gmail",
          error_stage: "token",
          error_message: `Token refresh failed: ${refreshError.message}`,
        };
        return new Response(JSON.stringify(response), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (gmailResult.error) {
      console.error("❌ Gmail API failed after all retry attempts");
      const response: ErrorResponse = {
        ok: false,
        connected: false,
        provider: "gmail",
        error_stage: "gmail_api",
        error_message: gmailResult.error,
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const labels = gmailResult.labels;

    console.log("🔍 Detecting Priority Inbox...");
    const hasCategoryPrimary = labels.some((label) => label.id === "CATEGORY_PERSONAL" || label.id === "CATEGORY_PRIMARY");
    const hasImportant = labels.some((label) => label.id === "IMPORTANT");
    const hasSocial = labels.some((label) => label.id === "CATEGORY_SOCIAL");
    const hasPromotions = labels.some((label) => label.id === "CATEGORY_PROMOTIONS");

    const priorityInboxEnabled = hasCategoryPrimary || (hasImportant && (hasSocial || hasPromotions));
    const inboxType = priorityInboxEnabled ? "priority" : "standard";

    console.log(`📊 Priority Inbox detection:`);
    console.log(`  - CATEGORY_PRIMARY: ${hasCategoryPrimary}`);
    console.log(`  - IMPORTANT: ${hasImportant}`);
    console.log(`  - CATEGORY_SOCIAL: ${hasSocial}`);
    console.log(`  - CATEGORY_PROMOTIONS: ${hasPromotions}`);
    console.log(`  - Inbox Type: ${inboxType}`);

    console.log("💾 Upserting gmail_connections using service role...");

    const connectionData = {
      user_id: user.id,
      email: user.email,
      scopes: "https://www.googleapis.com/auth/gmail.readonly",
      access_token: accessToken,
      refresh_token: refreshToken || null,
      token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseService
      .from("gmail_connections")
      .upsert(connectionData, { onConflict: "user_id" });

    if (upsertError) {
      console.error("⚠️ Failed to upsert gmail_connections:", upsertError);
    } else {
      console.log("✅ gmail_connections upserted successfully");
    }

    // CANONICAL: Write to email_connections (single source of truth)
    console.log("💾 Upserting email_connections (canonical source)...");
    
    const { error: canonicalError } = await supabaseService
      .from("email_connections")
      .upsert({
        user_id: user.id,
        provider: "gmail",
        connected: true,
        connected_email: user.email,
        inbox_type: inboxType === "priority" ? "priority" : "standard",
        connected_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        sync_status: "active",
      }, {
        onConflict: "user_id"
      });

    if (canonicalError) {
      console.error("❌ Failed to upsert email_connections:", canonicalError);
    } else {
      console.log("✅ email_connections upserted - Gmail is now the active provider");
    }

    const response: SuccessResponse = {
      ok: true,
      connected: true,
      provider: "gmail",
      inbox_type: inboxType,
      labels_count: labels.length,
    };

    if (inboxType === "standard") {
      response.remediation = "Enable Priority Inbox in Gmail settings";
    }

    console.log("✅ SUCCESS:", response);
    console.log("=== GMAIL PRODUCTION EDGE FUNCTION COMPLETE ===");

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);

    const response: ErrorResponse = {
      ok: false,
      connected: false,
      provider: "gmail",
      error_stage: "gmail_api",
      error_message: `Unexpected error: ${error.message}`,
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
