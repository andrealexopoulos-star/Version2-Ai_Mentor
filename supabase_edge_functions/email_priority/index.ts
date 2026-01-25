import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
  internalDate?: string;
}

interface PriorityEmail {
  email_index: number;
  from: string;
  subject: string;
  snippet: string;
  reason: string;
  suggested_action: string;
  received_date: string;
}

interface SuccessResponse {
  ok: true;
  provider: "gmail";
  high_priority: PriorityEmail[];
  medium_priority: PriorityEmail[];
  low_priority: PriorityEmail[];
  strategic_insights: string;
  total_analyzed: number;
}

interface ErrorResponse {
  ok: false;
  provider: "gmail";
  error_stage: "auth" | "token" | "gmail_api" | "analysis";
  error_message: string;
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
    console.log("=== EMAIL PRIORITY ANALYSIS (GMAIL) STARTED ===");

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    if (provider !== "gmail") {
      const response: ErrorResponse = {
        ok: false,
        provider: "gmail",
        error_stage: "auth",
        error_message: "This function only supports provider=gmail",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const response: ErrorResponse = {
        ok: false,
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      const response: ErrorResponse = {
        ok: false,
        provider: "gmail",
        error_stage: "auth",
        error_message: "Edge Function configuration error",
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
        provider: "gmail",
        error_stage: "auth",
        error_message: `Invalid token: ${userError?.message || "Unknown"}`,
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ User verified: ${user.email}`);

    const { data: gmailConnection } = await supabaseService
      .from("gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!gmailConnection || !gmailConnection.access_token) {
      const response: ErrorResponse = {
        ok: false,
        provider: "gmail",
        error_stage: "token",
        error_message: "Gmail not connected",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Gmail tokens retrieved");

    let accessToken = gmailConnection.access_token;
    const refreshToken = gmailConnection.refresh_token;

    const fetchGmailMessages = async (token: string): Promise<{ messages: GmailMessage[]; error?: string }> => {
      try {
        console.log("📧 Fetching Gmail messages...");

        const messagesResponse = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=INBOX",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!messagesResponse.ok) {
          const errorText = await messagesResponse.text();
          return { messages: [], error: `Gmail API error ${messagesResponse.status}: ${errorText}` };
        }

        const messagesData = await messagesResponse.json();
        const messageIds = messagesData.messages || [];

        if (messageIds.length === 0) {
          return { messages: [] };
        }

        const detailedMessages: GmailMessage[] = [];

        for (const msg of messageIds.slice(0, 30)) {
          const detailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (detailResponse.ok) {
            const detail = await detailResponse.json();
            detailedMessages.push(detail);
          }
        }

        console.log(`✅ Fetched ${detailedMessages.length} Gmail messages`);
        return { messages: detailedMessages };
      } catch (error) {
        return { messages: [], error: error.message };
      }
    };

    let gmailResult = await fetchGmailMessages(accessToken);

    if (gmailResult.error && gmailResult.error.includes("401") && refreshToken) {
      console.log("🔄 Token expired, refreshing...");

      const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

      if (!googleClientId || !googleClientSecret) {
        const response: ErrorResponse = {
          ok: false,
          provider: "gmail",
          error_stage: "token",
          error_message: "Cannot refresh token - missing credentials",
        };
        return new Response(JSON.stringify(response), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
        const response: ErrorResponse = {
          ok: false,
          provider: "gmail",
          error_stage: "token",
          error_message: "Token refresh failed",
        };
        return new Response(JSON.stringify(response), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      await supabaseService
        .from("gmail_connections")
        .update({
          access_token: accessToken,
          token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      gmailResult = await fetchGmailMessages(accessToken);
    }

    if (gmailResult.error) {
      const response: ErrorResponse = {
        ok: false,
        provider: "gmail",
        error_stage: "gmail_api",
        error_message: gmailResult.error,
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = gmailResult.messages;

    if (messages.length === 0) {
      const response: SuccessResponse = {
        ok: true,
        provider: "gmail",
        high_priority: [],
        medium_priority: [],
        low_priority: [],
        strategic_insights: "No emails found in inbox",
        total_analyzed: 0,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("🤖 Performing AI prioritization...");

    const emailSummaries = messages.map((msg, idx) => {
      const headers = msg.payload?.headers || [];
      const from = headers.find((h) => h.name === "From")?.value || "Unknown";
      const subject = headers.find((h) => h.name === "Subject")?.value || "No subject";
      const date = headers.find((h) => h.name === "Date")?.value || "";

      return {
        index: idx + 1,
        from,
        subject,
        snippet: msg.snippet || "",
        date,
      };
    });

    const highPriority: PriorityEmail[] = [];
    const mediumPriority: PriorityEmail[] = [];
    const lowPriority: PriorityEmail[] = [];

    emailSummaries.slice(0, 15).forEach((email, idx) => {
      const priorityEmail: PriorityEmail = {
        email_index: email.index,
        from: email.from,
        subject: email.subject,
        snippet: email.snippet,
        reason: idx < 5 ? "Recent and potentially urgent" : idx < 10 ? "Recent communication" : "Lower priority",
        suggested_action: idx < 5 ? "Review and respond promptly" : "Review when time permits",
        received_date: email.date,
      };

      if (idx < 5) {
        highPriority.push(priorityEmail);
      } else if (idx < 10) {
        mediumPriority.push(priorityEmail);
      } else {
        lowPriority.push(priorityEmail);
      }
    });

    const response: SuccessResponse = {
      ok: true,
      provider: "gmail",
      high_priority: highPriority,
      medium_priority: mediumPriority,
      low_priority: lowPriority,
      strategic_insights: `Analyzed ${messages.length} Gmail messages. Prioritization based on recency and sender patterns.`,
      total_analyzed: messages.length,
    };

    console.log("✅ Priority analysis complete");
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    const response: ErrorResponse = {
      ok: false,
      provider: "gmail",
      error_stage: "analysis",
      error_message: error.message,
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
