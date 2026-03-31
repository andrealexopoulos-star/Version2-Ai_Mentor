import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-calibration-run-id, x-calibration-step, x-proxy-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Backward-compat shim:
// Keep legacy `calibration_psych` URL alive, but route behavior to canonical `calibration-psych`.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!supabaseUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_URL missing" }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/calibration-psych`, {
      method: "POST",
      headers: {
        "Authorization": req.headers.get("authorization") || "",
        "apikey": req.headers.get("apikey") || "",
        "Content-Type": "application/json",
        "X-Calibration-Run-Id": req.headers.get("x-calibration-run-id") || "",
        "X-Calibration-Step": req.headers.get("x-calibration-step") || "",
        "X-Proxy-Request-Id": req.headers.get("x-proxy-request-id") || "",
      },
      body: JSON.stringify(payload || {}),
    });
    const text = await edgeRes.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {}
    return new Response(typeof parsed === "string" ? parsed : JSON.stringify(parsed), {
      status: edgeRes.status,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: corsHeaders,
    });
  }
});
