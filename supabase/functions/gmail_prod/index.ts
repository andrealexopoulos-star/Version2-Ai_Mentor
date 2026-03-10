// ═══════════════════════════════════════════════════════════════
// GMAIL_PROD — Connection status check
// Returns: { ok: true, connected: bool, email?: string }
// Also supports multi-provider check via ?provider=all
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, connected: false }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userSb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: { user }, error } = await userSb.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ ok: false, connected: false }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;
  const url = new URL(req.url);
  const providerParam = url.searchParams.get("provider") || "gmail";

  // Multi-provider mode: returns status of all providers at once
  if (providerParam === "all") {
    const [gmailRow, outlookRow, icloudRow, imapRow] = await Promise.all([
      adminSb.from("gmail_connections").select("email, access_token").eq("user_id", userId).maybeSingle(),
      adminSb.from("outlook_oauth_tokens").select("account_email, access_token").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      adminSb.from("icloud_connections").select("apple_id_email, connected").eq("user_id", userId).maybeSingle(),
      adminSb.from("imap_connections").select("imap_host, username, connected").eq("user_id", userId).limit(1).maybeSingle(),
    ]);

    return new Response(JSON.stringify({
      ok: true,
      providers: {
        gmail:   { connected: !!(gmailRow.data?.access_token),   email: gmailRow.data?.email },
        outlook: { connected: !!(outlookRow.data?.access_token), email: outlookRow.data?.account_email },
        icloud:  { connected: !!(icloudRow.data?.connected),     email: icloudRow.data?.apple_id_email },
        imap:    { connected: !!(imapRow.data?.connected),       host: imapRow.data?.imap_host },
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Single provider mode (original response schema preserved)
  if (providerParam === "gmail") {
    const { data } = await adminSb
      .from("gmail_connections")
      .select("email, access_token")
      .eq("user_id", userId)
      .maybeSingle();

    return new Response(JSON.stringify({
      ok: true,
      connected: !!(data?.access_token),
      email: data?.email || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (providerParam === "outlook") {
    const { data } = await adminSb
      .from("outlook_oauth_tokens")
      .select("account_email, access_token")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return new Response(JSON.stringify({
      ok: true,
      connected: !!(data?.access_token),
      email: data?.account_email || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, connected: false }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
