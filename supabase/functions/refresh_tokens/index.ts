// ═══════════════════════════════════════════════════════════════
// REFRESH_TOKENS — OAuth token refresh for Gmail + Outlook
//
// Refreshes expiring tokens and updates Supabase tables.
// Called by pg_cron every 30 minutes (see migration 052).
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
//          AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_SECRET    = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const AZURE_CLIENT_ID  = Deno.env.get("AZURE_CLIENT_ID") || "";
const AZURE_SECRET     = Deno.env.get("AZURE_CLIENT_SECRET") || "";
const AZURE_TENANT     = Deno.env.get("AZURE_TENANT_ID") || "common";

// ── Gmail token refresh ───────────────────────────────────────────────────────

async function refreshGmailToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail refresh failed (${res.status}): ${err.slice(0, 200)}`);
  }
  return res.json();
}

// ── Outlook token refresh ─────────────────────────────────────────────────────

async function refreshOutlookToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read offline_access",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outlook refresh failed (${res.status}): ${err.slice(0, 200)}`);
  }
  return res.json();
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const results: any = { gmail: [], outlook: [], errors: [] };

  const now = new Date();
  const refreshWindow = new Date(now.getTime() + 10 * 60 * 1000); // refresh if expiring within 10 min

  // ── Refresh Gmail tokens ────────────────────────────────────────────────────
  if (GOOGLE_CLIENT_ID && GOOGLE_SECRET) {
    const { data: gmailRows } = await adminSb
      .from("gmail_connections")
      .select("user_id, refresh_token, token_expiry")
      .not("refresh_token", "is", null)
      .or(`token_expiry.is.null,token_expiry.lte.${refreshWindow.toISOString()}`);

    for (const row of (gmailRows || [])) {
      try {
        const newTokens = await refreshGmailToken(row.refresh_token);
        const expiresAt = new Date(now.getTime() + newTokens.expires_in * 1000).toISOString();
        await adminSb.from("gmail_connections").update({
          access_token: newTokens.access_token,
          token_expiry: expiresAt,
          updated_at: now.toISOString(),
        }).eq("user_id", row.user_id);
        results.gmail.push({ user_id: row.user_id, status: "refreshed" });
      } catch (e: any) {
        results.errors.push({ provider: "gmail", user_id: row.user_id, error: e.message });
        // Mark connection as needing re-auth
        await adminSb.from("email_connections")
          .update({ sync_status: "token_expired", updated_at: now.toISOString() })
          .eq("user_id", row.user_id).eq("provider", "gmail");
      }
    }
  }

  // ── Refresh Outlook tokens ──────────────────────────────────────────────────
  if (AZURE_CLIENT_ID && AZURE_SECRET) {
    const { data: outlookRows } = await adminSb
      .from("outlook_oauth_tokens")
      .select("user_id, refresh_token, expires_at")
      .not("refresh_token", "is", null)
      .or(`expires_at.is.null,expires_at.lte.${refreshWindow.toISOString()}`);

    for (const row of (outlookRows || [])) {
      try {
        const newTokens = await refreshOutlookToken(row.refresh_token);
        const expiresAt = new Date(now.getTime() + newTokens.expires_in * 1000).toISOString();
        await adminSb.from("outlook_oauth_tokens").update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || row.refresh_token,
          expires_at: expiresAt,
          updated_at: now.toISOString(),
        }).eq("user_id", row.user_id);
        results.outlook.push({ user_id: row.user_id, status: "refreshed" });
      } catch (e: any) {
        results.errors.push({ provider: "outlook", user_id: row.user_id, error: e.message });
        await adminSb.from("email_connections")
          .update({ sync_status: "token_expired", updated_at: now.toISOString() })
          .eq("user_id", row.user_id).eq("provider", "outlook");
      }
    }
  }

  console.log("[refresh_tokens] Complete:", JSON.stringify(results));
  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
});
