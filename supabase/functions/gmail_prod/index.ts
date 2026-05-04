// ═══════════════════════════════════════════════════════════════
// GMAIL_PROD — Unified Gmail edge function
//
// Handles three actions:
//   1. store_tokens  — called by backend OAuth callback
//   2. process_callback — legacy direct OAuth handling
//   3. (no action)  — status check via Gmail API call
//
// Also supports ?provider=all for multi-provider status
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, enforceUserOwnership } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE;

// ── helpers ───────────────────────────────────────────────────────────────────

async function upsertEmailConnection(
  sb: any,
  userId: string,
  provider: string,
  email: string | null,
  inboxType = "standard"
) {
  // email_connections uses (user_id, provider) as logical unique key
  const { error } = await sb.from("email_connections").upsert(
    {
      user_id: userId,
      provider,
      connected: true,
      connected_email: email,
      inbox_type: inboxType,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "active",
    },
    { onConflict: "id" }  // upsert by PK; if no match inserts new row
  );
  if (error) {
    // Fallback: try insert only
    await sb.from("email_connections").insert({
      user_id: userId,
      provider,
      connected: true,
      connected_email: email,
      inbox_type: inboxType,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "active",
    }).select().maybeSingle();
  }
}

async function detectGmailInboxType(accessToken: string): Promise<string> {
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "standard";
    const data = await res.json();
    const labels: any[] = data.labels || [];
    const hasPriority = labels.some((l) => l.id === "CATEGORY_PRIMARY" || l.id === "IMPORTANT");
    return hasPriority ? "priority" : "standard";
  } catch { return "standard"; }
}

// ── main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error || "Unauthorized" }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }

  // Phase 1.X health-check handler (2026-05-05 code 13041978):
  // Andreas mandate "every edge function returns 200 on health check".
  // GET = reachability probe. The function's normal status-check flow uses POST.
  if (req.method === "GET" && !new URL(req.url).searchParams.get("provider")) {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "gmail_prod",
        reachable: true,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // Phase 1.X auth-symmetry hard-fix (2026-05-05 code 13041978):
    // Body parse only meaningful on POST; GET/no-body callers must not 400 here.
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action;
    const url    = new URL(req.url);

    // ── ACTION: store_tokens ─────────────────────────────────────────────────
    // Called by backend Gmail OAuth callback after code exchange
    if (action === "store_tokens") {
      const { user_id, access_token, refresh_token, expires_at, account_email, account_name } = body;
      const ownership = enforceUserOwnership(auth, user_id);
      if (!ownership.ok) {
        return new Response(JSON.stringify({ ok: false, error: ownership.error }), {
          status: ownership.status,
          headers: corsHeaders(req),
        });
      }

      if (!user_id || !access_token) {
        return new Response(JSON.stringify({ ok: false, error: "Missing user_id or access_token" }), {
          status: 400, headers: corsHeaders(req),
        });
      }

      // Store in gmail_connections
      const { error: tokenErr } = await adminSb.from("gmail_connections").upsert(
        {
          user_id,
          email: account_email,
          access_token,
          refresh_token,
          token_expiry: expires_at,
          scopes: "https://www.googleapis.com/auth/gmail.readonly",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (tokenErr) {
        console.error("[gmail_prod] token write failed:", tokenErr);
        return new Response(JSON.stringify({ ok: false, error: tokenErr.message }), {
          status: 500, headers: corsHeaders(req),
        });
      }

      // Detect inbox type
      const inboxType = await detectGmailInboxType(access_token);

      // Update canonical email_connections table
      await upsertEmailConnection(adminSb, user_id, "gmail", account_email, inboxType);

      console.log(`[gmail_prod] ✅ Tokens stored for ${account_email}, inbox: ${inboxType}`);
      return new Response(JSON.stringify({ ok: true, connected: true, inbox_type: inboxType }), {
        headers: corsHeaders(req),
      });
    }

    // ── ACTION: process_callback (legacy direct OAuth) ───────────────────────
    if (action === "process_callback") {
      const { code, user_id } = body;
      if (!code || !user_id) {
        return new Response(JSON.stringify({ ok: false, error: "Missing code or user_id" }), {
          status: 400, headers: corsHeaders(req),
        });
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     Deno.env.get("GOOGLE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          code,
          redirect_uri:  `${Deno.env.get("BACKEND_URL") || ""}/api/auth/gmail/callback`,
          grant_type:    "authorization_code",
        }),
      });
      if (!tokenRes.ok) {
        return new Response(JSON.stringify({ ok: false, error: "Token exchange failed" }), {
          status: 400, headers: corsHeaders(req),
        });
      }

      const tokens = await tokenRes.json();
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userRes.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await adminSb.from("gmail_connections").upsert(
        { user_id, email: userInfo.email, access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expiry: expiresAt, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      await upsertEmailConnection(adminSb, user_id, "gmail", userInfo.email);

      return new Response(JSON.stringify({ ok: true, provider: "gmail", connected: true }), {
        headers: corsHeaders(req),
      });
    }

    // ── STATUS CHECK ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    const providerParam = url.searchParams.get("provider") || "gmail";

    // Multi-provider check
    if (providerParam === "all") {
      const userId = auth.isServiceRole ? String(body.user_id || "").trim() : auth.userId;

      if (!userId) {
        return new Response(JSON.stringify({ ok: false, error: "Authentication required" }), {
          status: 401, headers: corsHeaders(req),
        });
      }

      const [gmailRow, outlookRow, icloudRow] = await Promise.all([
        adminSb.from("gmail_connections").select("email, access_token, token_expiry").eq("user_id", userId).maybeSingle(),
        adminSb.from("outlook_oauth_tokens").select("account_email, access_token, expires_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        adminSb.from("icloud_connections").select("apple_id_email, connected").eq("user_id", userId).maybeSingle(),
      ]);

      const now = new Date();
      const gmailExpired = gmailRow.data?.token_expiry ? new Date(gmailRow.data.token_expiry) < now : false;
      const outlookExpired = outlookRow.data?.expires_at ? new Date(outlookRow.data.expires_at) < now : false;

      return new Response(JSON.stringify({
        ok: true,
        providers: {
          gmail:   { connected: !!(gmailRow.data?.access_token) && !gmailExpired,   email: gmailRow.data?.email,   token_expired: gmailExpired },
          outlook: { connected: !!(outlookRow.data?.access_token) && !outlookExpired, email: outlookRow.data?.account_email, token_expired: outlookExpired },
          icloud:  { connected: !!(icloudRow.data?.connected), email: icloudRow.data?.apple_id_email },
        },
      }), { headers: corsHeaders(req) });
    }

    // Single provider status (original response schema preserved)
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, connected: false, error: "Missing authorization" }), {
        status: 401, headers: corsHeaders(req),
      });
    }

    const userId: string | null = auth.isServiceRole
      ? String(body.user_id || "").trim() || null
      : auth.userId;

    if (!userId) {
      return new Response(JSON.stringify({ ok: false, connected: false, provider: "gmail", error: "Invalid session" }), {
        status: 401, headers: corsHeaders(req),
      });
    }

    const { data: conn } = await adminSb
      .from("gmail_connections")
      .select("email, access_token, token_expiry")
      .eq("user_id", userId)
      .maybeSingle();

    if (!conn?.access_token) {
      return new Response(JSON.stringify({ ok: true, connected: false, provider: "gmail" }), {
        headers: corsHeaders(req),
      });
    }

    // Validate token by calling Gmail API
    const now = new Date();
    const tokenExpired = conn.token_expiry ? new Date(conn.token_expiry) < now : false;
    if (tokenExpired) {
      return new Response(JSON.stringify({ ok: true, connected: false, provider: "gmail", needs_reconnect: true, error: "Token expired" }), {
        headers: corsHeaders(req),
      });
    }

    const gmailCheck = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });

    if (!gmailCheck.ok) {
      // Token rejected by Google — mark as needing reconnect
      await adminSb.from("email_connections")
        .update({ sync_status: "token_expired", updated_at: new Date().toISOString() })
        .eq("user_id", userId).eq("provider", "gmail");
      return new Response(JSON.stringify({ ok: true, connected: false, provider: "gmail", needs_reconnect: true }), {
        headers: corsHeaders(req),
      });
    }

    const data = await gmailCheck.json();
    const labels: any[] = data.labels || [];
    const inboxType = labels.some((l) => l.id === "CATEGORY_PRIMARY") ? "priority" : "standard";

    return new Response(JSON.stringify({
      ok: true, connected: true, provider: "gmail",
      email: conn.email, inbox_type: inboxType, labels_count: labels.length,
    }), { headers: corsHeaders(req) });

  } catch (err: any) {
    console.error("[gmail_prod] error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: corsHeaders(req),
    });
  }
});
