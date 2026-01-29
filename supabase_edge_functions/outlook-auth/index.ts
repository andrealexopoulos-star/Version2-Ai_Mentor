import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface OutlookMailFolder {
  id: string;
  displayName: string;
}

interface SuccessResponse {
  ok: true;
  connected: true;
  provider: "outlook";
  inbox_type: "focused" | "standard";
  emails_synced?: number;
}

interface DisconnectedResponse {
  ok: true;
  connected: false;
  provider: "outlook";
}

interface ErrorResponse {
  ok: false;
  connected: false;
  provider: "outlook";
  error_stage: "auth" | "token" | "graph_api" | "database";
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
    console.log("=== OUTLOOK AUTH EDGE FUNCTION STARTED ===");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Missing or invalid Authorization header");
      const response: ErrorResponse = {
        ok: false,
        connected: false,
        provider: "outlook",
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
        provider: "outlook",
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
        provider: "outlook",
        error_stage: "auth",
        error_message: `Invalid or expired token: ${userError?.message || "Unknown"}`,
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ User verified: ${user.email} (${user.id})`);

    // Check outlook_oauth_tokens table for stored tokens using SERVICE ROLE (bypasses RLS)
    console.log("🔍 Checking outlook_oauth_tokens table for tokens (using service role)...");
    
    const { data: outlookConnection, error: connectionError } = await supabaseService
      .from("outlook_oauth_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectionError) {
      console.error("❌ Error querying outlook_oauth_tokens:", connectionError);
      const response: ErrorResponse = {
        ok: false,
        connected: false,
        provider: "outlook",
        error_stage: "database",
        error_message: `Database error: ${connectionError.message}`,
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!outlookConnection) {
      console.log("❌ No Outlook connection found in database for user:", user.id);
      const response: DisconnectedResponse = {
        ok: true,
        connected: false,
        provider: "outlook",
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log retrieved data
    console.log("✅ Outlook connection retrieved from database:");
    console.log(`  - Email: ${outlookConnection.account_email}`);
    console.log(`  - Token Expiry: ${outlookConnection.expires_at}`);

    const accessTokenFromDB = outlookConnection.access_token;
    const refreshTokenFromDB = outlookConnection.refresh_token;

    if (!accessTokenFromDB) {
      console.error("❌ No access token in outlook_oauth_tokens");
      const response: DisconnectedResponse = {
        ok: true,
        connected: false,
        provider: "outlook",
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Outlook tokens retrieved from database");
    console.log(`  - Access token: Present`);
    console.log(`  - Refresh token: ${refreshTokenFromDB ? "Present" : "Missing"}`);

    let accessToken = accessTokenFromDB;
    const refreshToken = refreshTokenFromDB;

    // Function to call Microsoft Graph API
    const callGraphApi = async (token: string): Promise<{ folders: OutlookMailFolder[]; error?: string }> => {
      try {
        console.log("📧 Calling Microsoft Graph API...");
        const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!graphResponse.ok) {
          const errorText = await graphResponse.text();
          console.error(`❌ Graph API error (${graphResponse.status}):`, errorText);
          return { folders: [], error: `Graph API returned ${graphResponse.status}: ${errorText}` };
        }

        const data = await graphResponse.json();
        console.log(`✅ Graph API success - received ${data.value?.length || 0} folders`);
        return { folders: data.value || [] };
      } catch (error) {
        console.error("❌ Graph API call failed:", error);
        return { folders: [], error: (error as Error).message };
      }
    };

    let graphResult = await callGraphApi(accessToken);

    // Refresh token if expired
    if (graphResult.error && graphResult.error.includes("401") && refreshToken) {
      console.log("🔄 Access token expired, attempting refresh...");

      const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
      const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

      if (!azureClientId || !azureClientSecret) {
        console.error("❌ Missing Azure OAuth credentials for token refresh");
        const response: ErrorResponse = {
          ok: false,
          connected: false,
          provider: "outlook",
          error_stage: "token",
          error_message: "Cannot refresh token - missing credentials",
        };
        return new Response(JSON.stringify(response), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const refreshResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: azureClientId,
            client_secret: azureClientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
            scope: "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic",
          }).toString(),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error("❌ Token refresh failed:", errorText);
          const response: ErrorResponse = {
            ok: false,
            connected: false,
            provider: "outlook",
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

        // Update database with new token
        const expiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();
        await supabaseService
          .from("outlook_oauth_tokens")
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || refreshToken,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        graphResult = await callGraphApi(accessToken);
      } catch (refreshError) {
        console.error("❌ Token refresh exception:", refreshError);
        const response: ErrorResponse = {
          ok: false,
          connected: false,
          provider: "outlook",
          error_stage: "token",
          error_message: `Token refresh failed: ${(refreshError as Error).message}`,
        };
        return new Response(JSON.stringify(response), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (graphResult.error) {
      console.error("❌ Graph API failed after all retry attempts");
      const response: ErrorResponse = {
        ok: false,
        connected: false,
        provider: "outlook",
        error_stage: "graph_api",
        error_message: graphResult.error,
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const folders = graphResult.folders;

    // Detect Focused Inbox
    console.log("🔍 Detecting Focused Inbox...");
    const folderNames = folders.map((folder) => folder.displayName);
    const hasFocused = folderNames.includes("Focused");
    const hasOther = folderNames.includes("Other");
    
    const focusedInboxEnabled = hasFocused && hasOther;
    const inboxType = focusedInboxEnabled ? "focused" : "standard";

    console.log(`📊 Focused Inbox detection:`);
    console.log(`  - Focused folder: ${hasFocused}`);
    console.log(`  - Other folder: ${hasOther}`);
    console.log(`  - Inbox Type: ${inboxType}`);

    // Update inbox_type in database
    console.log("💾 Updating outlook_oauth_tokens with inbox type...");
    
    const { error: updateError } = await supabaseService
      .from("outlook_oauth_tokens")
      .update({
        inbox_type: inboxType,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("⚠️ Failed to update inbox_type:", updateError);
    } else {
      console.log("✅ inbox_type updated successfully");
    }

    const response: SuccessResponse = {
      ok: true,
      connected: true,
      provider: "outlook",
      inbox_type: inboxType,
    };

    console.log("✅ SUCCESS:", response);
    console.log("=== OUTLOOK AUTH EDGE FUNCTION COMPLETE ===");

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);

    const response: ErrorResponse = {
      ok: false,
      connected: false,
      provider: "outlook",
      error_stage: "graph_api",
      error_message: `Unexpected error: ${(error as Error).message}`,
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
