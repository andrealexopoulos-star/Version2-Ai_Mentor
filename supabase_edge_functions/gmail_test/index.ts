// =====================================================
// GMAIL TEST EDGE FUNCTION
// Verifies Supabase user, uses Google OAuth token,
// calls Gmail API, returns REAL data
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Type definitions
interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

interface GmailLabel {
  id: string;
  name: string;
  type?: string;
}

interface SuccessResponse {
  ok: true;
  gmail_connected: true;
  labels_count: number;
  sample_labels: string[];
}

interface ErrorResponse {
  ok: false;
  gmail_connected: false;
  error_stage: "auth" | "token" | "gmail_api";
  error_message: string;
  remediation: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

serve(async (req: Request): Promise<Response> => {
  // CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== GMAIL TEST EDGE FUNCTION STARTED ===");

    // ========================================
    // STEP 1: Extract Supabase JWT from Authorization header
    // ========================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Missing or invalid Authorization header");
      const response: ErrorResponse = {
        ok: false,
        gmail_connected: false,
        error_stage: "auth",
        error_message: "Missing Authorization header",
        remediation: "Include 'Authorization: Bearer <supabase_token>' header",
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseToken = authHeader.replace("Bearer ", "");
    console.log("✅ Supabase JWT extracted");

    // ========================================
    // STEP 2: Create Supabase client and verify JWT
    // ========================================
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ Missing Supabase environment variables");
      const response: ErrorResponse = {
        ok: false,
        gmail_connected: false,
        error_stage: "auth",
        error_message: "Edge Function configuration error",
        remediation: "Contact support - missing Supabase credentials",
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // ========================================
    // STEP 3: Get authenticated user
    // ========================================
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(supabaseToken);

    if (userError || !user) {
      console.error("❌ Failed to verify user:", userError);
      const response: ErrorResponse = {
        ok: false,
        gmail_connected: false,
        error_stage: "auth",
        error_message: `Invalid or expired token: ${userError?.message || "Unknown"}`,
        remediation: "Re-authenticate with Supabase",
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ User verified: ${user.email} (${user.id})`);

    // ========================================
    // STEP 4: Extract Google OAuth tokens from user identities
    // ========================================
    const googleIdentity = user.identities?.find((identity) => identity.provider === "google");

    if (!googleIdentity) {
      console.error("❌ No Google identity found for user");
      const response: ErrorResponse = {
        ok: false,
        gmail_connected: false,
        error_stage: "token",
        error_message: "User has not connected Google account",
        remediation: "Sign in with Google to connect Gmail",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract tokens from identity
    const providerToken = (googleIdentity as any).provider_token;
    const providerRefreshToken = (googleIdentity as any).provider_refresh_token;

    if (!providerToken) {
      console.error("❌ Google access token not found in identity");
      const response: ErrorResponse = {
        ok: false,
        gmail_connected: false,
        error_stage: "token",
        error_message: "Google access token missing",
        remediation: "Reconnect Google account with Gmail scope",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Google tokens extracted from identity");
    console.log(`  - Access token: ${providerToken ? "Present" : "Missing"}`);
    console.log(`  - Refresh token: ${providerRefreshToken ? "Present" : "Missing"}`);

    let accessToken = providerToken;
    const refreshToken = providerRefreshToken;

    // ========================================
    // STEP 5: Call Gmail API to get labels
    // ========================================
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

    // First attempt with current access token
    let gmailResult = await callGmailApi(accessToken);

    // ========================================
    // STEP 6: If 401, attempt token refresh
    // ========================================
    if (gmailResult.error && gmailResult.error.includes("401") && refreshToken) {
      console.log("🔄 Access token expired, attempting refresh...");

      const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

      if (!googleClientId || !googleClientSecret) {
        console.error("❌ Missing Google OAuth credentials for token refresh");
        const response: ErrorResponse = {
          ok: false,
          gmail_connected: false,
          error_stage: "token",
          error_message: "Cannot refresh token - missing credentials",
          remediation: "Contact support - OAuth configuration error",
        };
        return new Response(JSON.stringify(response), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh the access token
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
            gmail_connected: false,
            error_stage: "token",
            error_message: `Token refresh failed: ${errorText}`,
            remediation: "Reconnect Google account",
          };
          return new Response(JSON.stringify(response), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;
        console.log("✅ Access token refreshed successfully");

        // Retry Gmail API call with new token
        gmailResult = await callGmailApi(accessToken);
      } catch (refreshError) {
        console.error("❌ Token refresh exception:", refreshError);
        const response: ErrorResponse = {
          ok: false,
          gmail_connected: false,
          error_stage: "token",
          error_message: `Token refresh failed: ${refreshError.message}`,
          remediation: "Reconnect Google account",
        };
        return new Response(JSON.stringify(response), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check final Gmail result
    if (gmailResult.error) {
      console.error("❌ Gmail API failed after all retry attempts");
      const response: ErrorResponse = {
        ok: false,
        gmail_connected: false,
        error_stage: "gmail_api",
        error_message: gmailResult.error,
        remediation: "Check Gmail API permissions and scopes",
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const labels = gmailResult.labels;

    // ========================================
    // STEP 7: Upsert gmail_connections table
    // ========================================
    console.log("💾 Upserting gmail_connections...");

    const connectionData = {
      user_id: user.id,
      email: user.email,
      scopes: "https://www.googleapis.com/auth/gmail.readonly", // Update based on actual scopes if available
      access_token: accessToken,
      refresh_token: refreshToken || null,
      token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("gmail_connections")
      .upsert(connectionData, { onConflict: "user_id" });

    if (upsertError) {
      console.error("⚠️ Failed to upsert gmail_connections:", upsertError);
      // Non-fatal - continue to return success
    } else {
      console.log("✅ gmail_connections upserted successfully");
    }

    // ========================================
    // STEP 8: Return success response
    // ========================================
    const sampleLabels = labels.slice(0, 3).map((label) => label.name);

    const response: SuccessResponse = {
      ok: true,
      gmail_connected: true,
      labels_count: labels.length,
      sample_labels: sampleLabels,
    };

    console.log("✅ SUCCESS:", response);
    console.log("=== GMAIL TEST EDGE FUNCTION COMPLETE ===");

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);

    const response: ErrorResponse = {
      ok: false,
      gmail_connected: false,
      error_stage: "gmail_api",
      error_message: `Unexpected error: ${error.message}`,
      remediation: "Contact support with error details",
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
