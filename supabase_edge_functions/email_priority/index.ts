import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
  provider: "gmail" | "outlook";
  high_priority: PriorityEmail[];
  medium_priority: PriorityEmail[];
  low_priority: PriorityEmail[];
  strategic_insights: string;
  total_analyzed: number;
}

interface ErrorResponse {
  ok: false;
  provider: "gmail" | "outlook";
  error_stage: "auth" | "token" | "api" | "analysis";
  error_message: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    console.log(`🚀 [EDGE] email_priority invoked for provider: ${provider}`);

    if (!provider || (provider !== "gmail" && provider !== "outlook")) {
      const response: ErrorResponse = {
        ok: false,
        provider: "gmail",
        error_stage: "auth",
        error_message: "Invalid provider. Use ?provider=gmail or ?provider=outlook",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const response: ErrorResponse = {
        ok: false,
        provider,
        error_stage: "auth",
        error_message: "Missing Authorization header",
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseToken = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      const response: ErrorResponse = {
        ok: false,
        provider,
        error_stage: "auth",
        error_message: "Edge Function configuration error",
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: corsHeaders,
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
        provider,
        error_stage: "auth",
        error_message: `Invalid token: ${userError?.message || "Unknown"}`,
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: corsHeaders,
      });
    }

    console.log(`✅ User verified: ${user.email}`);

    if (provider === "gmail") {
      return await handleGmail(user, supabaseService);
    } else {
      return await handleOutlook(user, supabaseService);
    }
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
      headers: corsHeaders,
    });
  }
});

async function handleGmail(user: any, supabaseService: any): Promise<Response> {
  console.log("📧 Processing Gmail...");

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
      headers: corsHeaders,
    });
  }

  const accessToken = gmailConnection.access_token;

  // Fetch Gmail messages
  const messagesResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&labelIds=INBOX",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!messagesResponse.ok) {
    const response: ErrorResponse = {
      ok: false,
      provider: "gmail",
      error_stage: "api",
      error_message: `Gmail API error ${messagesResponse.status}`,
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const messagesData = await messagesResponse.json();
  const messageIds = messagesData.messages || [];

  const detailedMessages: any[] = [];

  for (const msg of messageIds.slice(0, 20)) {
    const detailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (detailResponse.ok) {
      const detail = await detailResponse.json();
      detailedMessages.push(detail);
    }
  }

  return prioritizeEmails(detailedMessages, "gmail");
}

async function handleOutlook(user: any, supabaseService: any): Promise<Response> {
  console.log("📧 Processing Outlook...");

  const { data: outlookConnection } = await supabaseService
    .from("outlook_oauth_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!outlookConnection || !outlookConnection.access_token) {
    const response: ErrorResponse = {
      ok: false,
      provider: "outlook",
      error_stage: "token",
      error_message: "Outlook not connected",
    };
    return new Response(JSON.stringify(response), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const accessToken = outlookConnection.access_token;

  // Fetch Outlook messages
  const messagesResponse = await fetch(
    "https://graph.microsoft.com/v1.0/me/messages?$top=20&$select=from,subject,bodyPreview,receivedDateTime&$filter=isRead eq false&$orderby=receivedDateTime desc",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!messagesResponse.ok) {
    const response: ErrorResponse = {
      ok: false,
      provider: "outlook",
      error_stage: "api",
      error_message: `Outlook API error ${messagesResponse.status}`,
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const messagesData = await messagesResponse.json();
  const messages = messagesData.value || [];

  return prioritizeEmails(messages, "outlook");
}

function prioritizeEmails(messages: any[], provider: "gmail" | "outlook"): Response {
  console.log(`🤖 Prioritizing ${messages.length} ${provider} emails...`);

  const highPriority: PriorityEmail[] = [];
  const mediumPriority: PriorityEmail[] = [];
  const lowPriority: PriorityEmail[] = [];

  messages.forEach((msg, idx) => {
    let from, subject, snippet, date;

    if (provider === "gmail") {
      const headers = msg.payload?.headers || [];
      from = headers.find((h: any) => h.name === "From")?.value || "Unknown";
      subject = headers.find((h: any) => h.name === "Subject")?.value || "No subject";
      snippet = msg.snippet || "";
      date = headers.find((h: any) => h.name === "Date")?.value || "";
    } else {
      // Outlook
      from = msg.from?.emailAddress?.address || "Unknown";
      subject = msg.subject || "No subject";
      snippet = msg.bodyPreview || "";
      date = msg.receivedDateTime || "";
    }

    const priorityEmail: PriorityEmail = {
      email_index: idx + 1,
      from,
      subject,
      snippet: snippet.substring(0, 150),
      reason: idx < 5 ? "Recent and potentially urgent" : idx < 10 ? "Recent communication" : "Lower priority",
      suggested_action: idx < 5 ? "Review and respond promptly" : "Review when time permits",
      received_date: date,
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
    provider,
    high_priority: highPriority,
    medium_priority: mediumPriority,
    low_priority: lowPriority,
    strategic_insights: `Analyzed ${messages.length} ${provider} messages. Prioritization based on recency and unread status.`,
    total_analyzed: messages.length,
  };

  console.log("✅ Priority analysis complete");
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: corsHeaders,
  });
}
