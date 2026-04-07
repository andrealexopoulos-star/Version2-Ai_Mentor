import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

type JsonMap = Record<string, unknown>;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "");
  if (!clean || clean.length % 2 !== 0) return new Uint8Array();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

async function hmacSha256Hex(secret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = hexToBytes(a);
  const right = hexToBytes(b);
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

function normalizeBase64Url(input: string): string {
  return String(input || "")
    .trim()
    .replace(/^sha256=/i, "")
    .replace(/"/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeCategory(raw: unknown): string {
  const text = String(raw || "").toLowerCase();
  if (text.includes("crm") || text.includes("opportunit") || text.includes("deal")) return "crm";
  if (text.includes("account") || text.includes("invoice") || text.includes("payment")) return "accounting";
  if (text.includes("market") || text.includes("campaign")) return "marketing";
  if (text.includes("calendar")) return "calendar";
  return "unknown";
}

function buildDedupeKey(eventId: string, tenantId: string, category: string, entity: string, occurredAt: string): string {
  return [eventId, tenantId, category, entity, occurredAt].join("|").slice(0, 500);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const startedAt = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webhookSecret = Deno.env.get("MERGE_WEBHOOK_SECRET");
    const featureEnabled = (Deno.env.get("FEATURE_MERGE_WEBHOOK_ENABLED") || "true").toLowerCase();
    if (!["1", "true", "yes"].includes(featureEnabled)) {
      return new Response(JSON.stringify({ ok: true, accepted: false, reason: "FEATURE_MERGE_WEBHOOK_ENABLED=false" }), {
        status: 202,
        headers: corsHeaders(req),
      });
    }
    if (!supabaseUrl || !serviceRole || !webhookSecret) {
      throw new Error("Missing required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MERGE_WEBHOOK_SECRET");
    }

    const signatureHeader =
      req.headers.get("x-merge-signature") ||
      req.headers.get("X-Merge-Signature") ||
      req.headers.get("x-merge-webhook-signature") ||
      req.headers.get("X-Merge-Webhook-Signature") ||
      "";
    const rawBody = await req.text();
    const expectedSignature = await hmacSha256Hex(webhookSecret, rawBody);
    const providedSignature = signatureHeader.replace(/^sha256=/i, "").trim();
    const expectedBytes = await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
      new TextEncoder().encode(rawBody),
    );
    const expectedB64Url = normalizeBase64Url(btoa(String.fromCharCode(...new Uint8Array(expectedBytes))));
    const providedB64Url = normalizeBase64Url(signatureHeader);
    if (!safeEqualHex(providedSignature, expectedSignature) && expectedB64Url !== providedB64Url) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid webhook signature" }), {
        status: 401,
        headers: corsHeaders(req),
      });
    }

    const payload = (JSON.parse(rawBody || "{}") || {}) as JsonMap;
    const rawEvents = Array.isArray(payload.events)
      ? payload.events
      : Array.isArray(payload.data)
      ? payload.data
      : [payload];

    const sb = createClient(supabaseUrl, serviceRole);
    const summaries: JsonMap[] = [];

    for (const row of rawEvents) {
      const event = (row && typeof row === "object") ? (row as JsonMap) : {};
      const accountToken = String(event.account_token || payload.account_token || "").trim();
      const provider = String(event.provider || payload.provider || "merge").toLowerCase();
      const eventType = String(event.event_type || event.type || payload.type || "unknown");
      const eventId = String(event.id || event.event_id || crypto.randomUUID());
      const occurredAt = String(event.occurred_at || event.timestamp || payload.timestamp || new Date().toISOString());
      const entity = String(event.model || event.entity || event.object || "unknown");
      const category = normalizeCategory(event.category || eventType || entity);

      if (!accountToken || category === "unknown") {
        summaries.push({ event_id: eventId, status: "ignored", reason: "missing account token or unsupported category" });
        continue;
      }

      const integrationResp = await sb
        .from("integration_accounts")
        .select("user_id, category, provider")
        .eq("account_token", accountToken)
        .limit(1)
        .maybeSingle();

      if (integrationResp.error || !integrationResp.data?.user_id) {
        summaries.push({ event_id: eventId, status: "ignored", reason: "integration account not found for token" });
        continue;
      }

      const tenantId = String(integrationResp.data.user_id);
      const dedupeKey = buildDedupeKey(eventId, tenantId, category, entity, occurredAt);
      const insertResp = await sb
        .schema("business_core")
        .from("webhook_events")
        .insert({
          tenant_id: tenantId,
          provider,
          category,
          event_type: eventType,
          event_id: eventId,
          entity_type: entity,
          event_timestamp: occurredAt,
          idempotency_key: dedupeKey,
          payload: event,
          status: "received",
          received_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (insertResp.error) {
        const msg = String(insertResp.error.message || "").toLowerCase();
        if (msg.includes("duplicate") || msg.includes("unique")) {
          summaries.push({ event_id: eventId, status: "duplicate" });
          continue;
        }
        throw new Error(insertResp.error.message);
      }

      summaries.push({
        event_id: eventId,
        status: "received",
        tenant_id: tenantId,
        category,
        provider,
        webhook_event_id: insertResp.data?.id || null,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      received: summaries.filter((item) => item.status === "received").length,
      duplicate: summaries.filter((item) => item.status === "duplicate").length,
      ignored: summaries.filter((item) => item.status === "ignored").length,
      latency_ms: Date.now() - startedAt,
      events: summaries,
    }), {
      status: 200,
      headers: corsHeaders(req),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unhandled webhook ingest error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: corsHeaders(req),
    });
  }
});
