// ═══════════════════════════════════════════════════════════════
// EMAIL PRIORITY — Supabase Edge Function v2
//
// Providers: Gmail, Outlook, iCloud (IMAP), Generic IMAP
// AI: OpenAI GPT-4o-mini — classify high/medium/low + extract actions
// Storage: Writes results to priority_inbox + email_tasks tables
// Schedule: Called by cron every 10 minutes (see migration 052)
//
// Secrets required:
//   OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY")!;

// ── Token retrieval ───────────────────────────────────────────────────────────

async function getGmailTokens(sb: any, userId: string) {
  const { data, error } = await sb
    .from("gmail_connections")
    .select("access_token, refresh_token, token_expiry, email")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw { code: "NO_TOKEN", provider: "gmail", message: "Gmail not connected. Please connect Gmail in Integrations." };
  if (!data.access_token) throw { code: "NO_TOKEN", provider: "gmail", message: "Gmail access token missing. Please reconnect Gmail." };
  return data;
}

async function getOutlookTokens(sb: any, userId: string) {
  const { data, error } = await sb
    .from("outlook_oauth_tokens")
    .select("access_token, refresh_token, expires_at, account_email")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) throw { code: "NO_TOKEN", provider: "outlook", message: "Outlook not connected. Please connect Outlook in Integrations." };
  if (!data.access_token) throw { code: "NO_TOKEN", provider: "outlook", message: "Outlook access token missing. Please reconnect Outlook." };
  return data;
}

async function getIcloudCredentials(sb: any, userId: string) {
  const { data, error } = await sb
    .from("icloud_connections")
    .select("apple_id_email, app_password")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw { code: "NO_TOKEN", provider: "icloud", message: "iCloud not connected. Please connect iCloud in Integrations." };
  return data;
}

async function getImapCredentials(sb: any, userId: string, host?: string) {
  const query = sb.from("imap_connections").select("imap_host, imap_port, username, password, use_ssl").eq("user_id", userId);
  if (host) query.eq("imap_host", host);
  const { data, error } = await query.limit(1).single();
  if (error || !data) throw { code: "NO_TOKEN", provider: "imap", message: "IMAP not connected. Please connect your email server in Integrations." };
  return data;
}

// ── Email fetchers ────────────────────────────────────────────────────────────

async function fetchGmailEmails(accessToken: string, maxResults = 30): Promise<any[]> {
  // List inbox message IDs
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX&q=is:unread OR newer_than:3d`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (listRes.status === 401) throw { code: "TOKEN_EXPIRED", provider: "gmail", message: "Gmail token expired. Please reconnect Gmail." };
  if (!listRes.ok) throw { code: "API_ERROR", provider: "gmail", message: `Gmail API error: ${listRes.status}` };
  const { messages = [] } = await listRes.json();
  if (!messages.length) return [];

  // Fetch metadata in parallel (cap at 25 to avoid rate limits)
  const toFetch = messages.slice(0, 25);
  const emails = await Promise.all(
    toFetch.map(async (m: any) => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!r.ok) return null;
        const d = await r.json();
        const hdrs = d.payload?.headers || [];
        const get = (n: string) => hdrs.find((h: any) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
        return {
          id: m.id,
          thread_id: d.threadId,
          from_address: get("From"),
          subject: get("Subject"),
          received_date: get("Date"),
          snippet: d.snippet || "",
        };
      } catch { return null; }
    })
  );
  return emails.filter(Boolean) as any[];
}

async function fetchOutlookEmails(accessToken: string, maxResults = 30): Promise<any[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages` +
    `?$top=${maxResults}` +
    `&$select=id,from,subject,receivedDateTime,bodyPreview,conversationId` +
    `&$orderby=receivedDateTime desc` +
    `&$filter=isRead eq false or receivedDateTime ge ${new Date(Date.now() - 3 * 86400000).toISOString()}`,
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
  );
  if (res.status === 401) throw { code: "TOKEN_EXPIRED", provider: "outlook", message: "Outlook token expired. Please reconnect Outlook." };
  if (!res.ok) throw { code: "API_ERROR", provider: "outlook", message: `Outlook API error: ${res.status}` };
  const data = await res.json();
  return (data.value || []).map((m: any) => ({
    id: m.id,
    thread_id: m.conversationId,
    from_address: m.from?.emailAddress
      ? `${m.from.emailAddress.name || ""} <${m.from.emailAddress.address}>`
      : "",
    subject: m.subject || "(no subject)",
    received_date: m.receivedDateTime || "",
    snippet: m.bodyPreview || "",
  }));
}

// iCloud: uses Apple's IMAP server (imap.mail.me.com:993)
// Note: Deno Edge Functions do not support raw TCP connections.
// iCloud email fetch is handled via a background FastAPI job.
// This function returns a placeholder to allow schema/UI testing.
async function fetchIcloudEmails(_credentials: any): Promise<any[]> {
  // TODO: Implement via backend Python job that fetches via imaplib
  // and stores results in priority_inbox directly.
  throw { code: "PROVIDER_UNAVAILABLE", provider: "icloud", message: "iCloud sync runs as a background job. Check back in a few minutes." };
}

// Generic IMAP: same limitation as iCloud — TCP not available in Deno.
async function fetchImapEmails(_credentials: any): Promise<any[]> {
  throw { code: "PROVIDER_UNAVAILABLE", provider: "imap", message: "IMAP sync runs as a background job. Check back in a few minutes." };
}

// ── AI classification ─────────────────────────────────────────────────────────

async function classifyWithAI(emails: any[]): Promise<any[]> {
  if (!emails.length) return [];
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not configured");

  const emailSummary = emails.slice(0, 20).map((e, i) =>
    `[${i}] From: ${e.from_address || "Unknown"}\nSubject: ${e.subject || "(no subject)"}\nDate: ${e.received_date}\nPreview: ${(e.snippet || "").slice(0, 150)}`
  ).join("\n\n---\n\n");

  const systemPrompt = `You are an AI executive email triage assistant. Classify each email as high, medium, or low priority for a busy business leader.

CLASSIFICATION RULES:
HIGH: Client escalations, financial/legal urgency, board/CEO messages, overdue responses (>48h), contract/deal decisions, time-critical deadlines within 24h.
MEDIUM: Project updates, colleague requests, client queries with 2-5 day window, vendor communications, meeting requests.
LOW: Newsletters, marketing emails, FYI notifications, automated reports, social media digests.

For each email return EXACTLY this JSON structure:
{"index": N, "priority": "high|medium|low", "reason": "one sentence", "suggested_action": "specific action", "action_item": "task text or null", "due_date": "YYYY-MM-DD or null"}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze these ${emails.length} emails and return a JSON array:\n\n${emailSummary}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const completion = await res.json();
  const content = completion.choices?.[0]?.message?.content || "{}";

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse AI classification response");
  }

  // Handle both array and {results: [...]} format
  const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.emails || Object.values(parsed)[0] || []);

  // Merge AI results back into email objects
  return emails.map((email, i) => {
    const aiResult = results.find((r: any) => r.index === i) || {};
    return {
      ...email,
      priority_level: ["high", "medium", "low"].includes(aiResult.priority) ? aiResult.priority : "medium",
      reason: aiResult.reason || "Classified by AI",
      suggested_action: aiResult.suggested_action || "Review",
      action_item: aiResult.action_item || null,
      due_date: aiResult.due_date || null,
    };
  });
}

// ── Persist to Supabase ───────────────────────────────────────────────────────

async function persistResults(sb: any, userId: string, provider: string, classifiedEmails: any[]) {
  if (!classifiedEmails.length) return;

  const inboxRows = classifiedEmails.map(e => ({
    user_id: userId,
    provider,
    email_id: e.id,
    thread_id: e.thread_id || null,
    from_address: e.from_address || "",
    subject: e.subject || "",
    snippet: e.snippet || "",
    received_date: e.received_date ? new Date(e.received_date).toISOString() : null,
    priority_level: e.priority_level,
    reason: e.reason,
    suggested_action: e.suggested_action,
    ai_model: "gemini-3-flash-preview",
    analyzed_at: new Date().toISOString(),
  }));

  // Upsert — idempotent on (user_id, provider, email_id)
  await sb.from("priority_inbox").upsert(inboxRows, {
    onConflict: "user_id,provider,email_id",
    ignoreDuplicates: false,
  });

  // Insert action items for emails that have them
  const taskRows = classifiedEmails
    .filter(e => e.action_item)
    .map(e => ({
      user_id: userId,
      provider,
      email_id: e.id,
      task_text: e.action_item,
      due_date: e.due_date || null,
      status: "pending",
    }));

  if (taskRows.length) {
    await sb.from("email_tasks").upsert(taskRows, { onConflict: "user_id,provider,email_id", ignoreDuplicates: true });
  }
}

function buildStrategicInsights(emails: any[]): string {
  if (!emails.length) return "No emails analyzed.";
  const high = emails.filter(e => e.priority_level === "high").length;
  const med  = emails.filter(e => e.priority_level === "medium").length;
  const low  = emails.filter(e => e.priority_level === "low").length;
  const tasks = emails.filter(e => e.action_item).length;
  const senders = [...new Set(emails.filter(e => e.priority_level === "high").map(e => e.from_address?.split("<")[0]?.trim()).filter(Boolean))].slice(0, 3);

  let insight = `${emails.length} emails analyzed: ${high} high priority, ${med} medium, ${low} low.`;
  if (tasks > 0) insight += ` ${tasks} action item${tasks > 1 ? "s" : ""} extracted.`;
  if (senders.length) insight += ` Key senders requiring attention: ${senders.join(", ")}.`;
  if (high === 0) insight += " No urgent items — inbox is under control.";
  return insight;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "Missing authorization header" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Dual client: user client for auth, service client for DB writes
  const userSb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Authenticate user
  const { data: { user }, error: authError } = await userSb.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ ok: false, error: "Authentication failed" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;
  let provider = "gmail";
  try {
    const body = await req.json().catch(() => ({}));
    provider = body.provider || new URL(req.url).searchParams.get("provider") || "gmail";
  } catch { /* use default */ }

  try {
    // 1. Fetch tokens
    let emails: any[] = [];
    switch (provider) {
      case "gmail": {
        const tokens = await getGmailTokens(adminSb, userId);
        emails = await fetchGmailEmails(tokens.access_token);
        break;
      }
      case "outlook": {
        const tokens = await getOutlookTokens(adminSb, userId);
        emails = await fetchOutlookEmails(tokens.access_token);
        break;
      }
      case "icloud": {
        const creds = await getIcloudCredentials(adminSb, userId);
        emails = await fetchIcloudEmails(creds);
        break;
      }
      case "imap": {
        const creds = await getImapCredentials(adminSb, userId);
        emails = await fetchImapEmails(creds);
        break;
      }
      default:
        return new Response(JSON.stringify({ ok: false, error: `Unknown provider: ${provider}. Supported: gmail, outlook, icloud, imap` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (!emails.length) {
      return new Response(JSON.stringify({
        ok: true,
        provider,
        high_priority: [],
        medium_priority: [],
        low_priority: [],
        strategic_insights: "Your inbox is clear — no recent unread emails found.",
        total_analyzed: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. AI classification
    const classified = await classifyWithAI(emails);

    // 3. Persist to Supabase
    await persistResults(adminSb, userId, provider, classified);

    // 4. Record run summary
    const high = classified.filter(e => e.priority_level === "high");
    const med  = classified.filter(e => e.priority_level === "medium");
    const low  = classified.filter(e => e.priority_level === "low");
    const insights = buildStrategicInsights(classified);

    await adminSb.from("email_intelligence_runs").insert({
      user_id: userId,
      provider,
      total_analyzed: classified.length,
      high_count: high.length,
      medium_count: med.length,
      low_count: low.length,
      strategic_insights: insights,
    });

    return new Response(JSON.stringify({
      ok: true,
      provider,
      high_priority: high,
      medium_priority: med,
      low_priority: low,
      strategic_insights: insights,
      total_analyzed: classified.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    // Known provider errors (no token, expired, etc.)
    if (err.code) {
      return new Response(JSON.stringify({ ok: false, code: err.code, provider: err.provider, error: err.message }), {
        status: err.code === "TOKEN_EXPIRED" ? 401 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[email_priority] Unexpected error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || "Internal error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
