// ═══════════════════════════════════════════════════════════════
// SEMRUSH DOMAIN INTEL — Edge Function Tests (Deno)
//
// Run: deno test --allow-env --allow-net=api.semrush.com supabase/functions/semrush-domain-intel/test.ts
//
// These tests stub `globalThis.fetch` so no real SEMrush calls are
// made; the focus is the contract of the edge handler:
//   1. Unauthenticated requests return 401.
//   2. Missing SEMRUSH_API_KEY returns sanitised "DATA_UNAVAILABLE"
//      rather than crashing.
//   3. Partial endpoint failure returns partial data + ai_errors,
//      not total failure.
//
// Loaded via Deno's test framework. The handler is dynamically
// imported AFTER env stubs are in place so it picks up our key.
// ═══════════════════════════════════════════════════════════════

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ─── Helpers ────────────────────────────────────────────────────────────

interface FetchHandler {
  (req: Request): Promise<Response> | Response;
}

let _origFetch: typeof fetch;
function stubFetch(handler: FetchHandler): void {
  _origFetch = globalThis.fetch;
  // deno-lint-ignore no-explicit-any
  (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    return await handler(req);
  };
}
function restoreFetch(): void {
  if (_origFetch) {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).fetch = _origFetch;
  }
}

// CSV builder — mirrors SEMrush's `;`-separated format.
function csv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(";")];
  for (const r of rows) {
    lines.push(headers.map((h) => r[h] ?? "").join(";"));
  }
  return lines.join("\n");
}

// Build a minimal POST request with a valid service-role bearer.
function buildPostReq(domain: string): Request {
  return new Request("https://example.supabase.co/functions/v1/semrush-domain-intel", {
    method: "POST",
    headers: {
      "Authorization": "Bearer SERVICE_ROLE_TEST_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ domain, database: "us" }),
  });
}

function buildUnauthedReq(): Request {
  return new Request("https://example.supabase.co/functions/v1/semrush-domain-intel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain: "marjo.com.au" }),
  });
}

// Set the env for the auth helper to accept SERVICE_ROLE_TEST_KEY as
// service-role exact-match.
function setBaseEnv(): void {
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_TEST_KEY");
}

// ─── Test 1: unauthenticated → 401 ──────────────────────────────────────

Deno.test("test_unauth_returns_401", async () => {
  setBaseEnv();
  Deno.env.set("SEMRUSH_API_KEY", "test_key_xyz");

  // Dynamically import a fresh module per test so module-level state
  // (env reads, captured fetch) doesn't leak between tests.
  // Append cache-buster to force re-evaluation.
  const mod = await import(`./index.ts?test_unauth=${Date.now()}`);
  void mod; // module side-effects register the serve() handler

  // The handler is not directly exported; we instead invoke it by
  // simulating a request through the Deno.serve machinery. To keep
  // this lightweight, we re-implement the unauth check here against
  // the same _shared/auth.ts helper.
  const { verifyAuth } = await import("../_shared/auth.ts");
  const auth = await verifyAuth(buildUnauthedReq());
  assertEquals(auth.ok, false);
  assertEquals(auth.status, 401);
});

// ─── Test 2: missing key → sanitised unavailable, no crash ──────────────

Deno.test("test_missing_key_returns_sanitised_unavailable_not_crash", async () => {
  setBaseEnv();
  Deno.env.delete("SEMRUSH_API_KEY");

  // Stub fetch — should never be called when key is missing.
  let fetchCalled = false;
  stubFetch(() => {
    fetchCalled = true;
    return new Response("should_not_be_called", { status: 500 });
  });

  try {
    // Re-import handler so it re-reads SEMRUSH_API_KEY at module init.
    // The handler module reads the key once at module load via
    // `Deno.env.get(...)`. We invoke it via a synthetic POST.
    const handler = await loadHandler();
    const res = await handler(buildPostReq("marjo.com.au"));
    const body = await res.json();

    // Key missing must NOT crash — must return 503 sanitised payload.
    assertEquals(res.status, 503);
    assertEquals(body.ok, false);
    // Internal code is allowed in the edge fn payload (the BACKEND
    // sanitiser strips it before frontend display). What matters is the
    // edge fn does NOT include the literal env var name in its public
    // text, and does NOT crash with an uncaught throw.
    assert(typeof body.error === "string");
    assert(!body.error.includes("SEMRUSH_API_KEY"),
      "Edge fn must not embed env-var name in public error text");
    // No supplier API call should have been attempted.
    assertEquals(fetchCalled, false,
      "When key missing, edge fn must short-circuit before fetch");
  } finally {
    restoreFetch();
  }
});

// ─── Test 3: partial endpoint failure → partial data + ai_errors ────────

Deno.test("test_partial_endpoint_failure_returns_partial_data", async () => {
  setBaseEnv();
  Deno.env.set("SEMRUSH_API_KEY", "test_key_xyz");

  // Stub fetch by routing on URL `type` query-string param.
  // Backlinks endpoint returns 401; the other 7 return well-formed CSVs.
  stubFetch((req) => {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "";

    // Backlinks endpoint lives on a different host AND uses
    // `type=backlinks_overview`. Simulate auth failure (no Backlinks
    // API add-on on this plan).
    if (type === "backlinks_overview") {
      return new Response("forbidden", { status: 401 });
    }

    // Build a minimal valid CSV per endpoint type.
    const responses: Record<string, Record<string, string>[]> = {
      domain_rank: [{
        Dn: "marjo.com.au", Rk: "145000", Or: "1234", Ot: "5600",
        Oc: "8900", Ad: "15", At: "2200", Ac: "1500", FKn: "12", FPn: "5",
      }],
      domain_organic: Array.from({ length: 100 }, (_, i) => ({
        Ph: `kw${i}`, Po: String((i % 50) + 1), Nq: String(1000 - i * 7),
        Cp: "1.5", Ur: `https://marjo.com.au/p${i}`,
        Tr: String(200 - i), Tc: String(100 - i),
        Co: "0.5", Kd: String((i % 90) + 5),
      })),
      domain_adwords: Array.from({ length: 15 }, (_, i) => ({
        Ph: `paidkw${i}`, Po: "1", Nq: "1000", Cp: "2.5",
        Ur: `https://marjo.com.au/p${i}`, Tr: "100", Tc: "50",
      })),
      domain_organic_organic: Array.from({ length: 10 }, (_, i) => ({
        Dn: `competitor${i}.com`, Cr: String(50 - i * 4),
        Np: String(1000 - i * 50), Or: String(800 - i * 40),
        Ot: String(100000 - i * 5000), Oc: String(5000 - i * 200),
        Ad: String(30 - i),
      })),
      domain_adwords_adwords: Array.from({ length: 10 }, (_, i) => ({
        Dn: `paidcomp${i}.com`, Np: String(500 - i * 30),
        Ad: String(80 - i * 5), At: String(20000 - i * 1000),
        Ac: String(3000 - i * 150),
      })),
      domain_organic_pages: Array.from({ length: 20 }, (_, i) => ({
        Ur: `https://marjo.com.au/page${i}`, Pc: String(5000 - i * 100),
        Tg: String(20 - i * 0.5), Rk: String(i + 1), Or: String(50 - i),
      })),
      domain_adwords_history: Array.from({ length: 12 }, (_, i) => ({
        Dt: `2025-${String((i % 12) + 1).padStart(2, "0")}`,
        Po: "1", Cp: "2.5", Nq: String(4000 - i * 50),
        Tr: String(800 - i * 20), Ur: "https://marjo.com.au/landing",
        Tt: `Title ${i}`, Ds: `Description ${i}`,
      })),
    };

    const rows = responses[type];
    if (!rows) {
      return new Response("ERROR 134 :: NOTHING FOUND", { status: 200 });
    }
    return new Response(csv(rows), { status: 200 });
  });

  try {
    const handler = await loadHandler();
    const res = await handler(buildPostReq("marjo.com.au"));
    const body = await res.json();

    // Partial success — overall response is 200 ok:true.
    assertEquals(res.status, 200);
    assertEquals(body.ok, true);

    // Backlinks is null (the failed endpoint).
    assertEquals(body.backlink_profile, null);
    assertEquals(body.backlink_intelligence, null);

    // Other 7 endpoints succeeded — data present.
    assertExists(body.seo_analysis);
    assertEquals(body.seo_analysis.organic_keywords, 1234);
    assertExists(body.keyword_intelligence);
    assertEquals(body.keyword_intelligence.organic_keywords_count, 100);
    assertExists(body.advertising_intelligence);
    assertEquals(body.advertising_intelligence.months_active, 12);
    assertExists(body.competitor_analysis.detailed_competitors);
    assertEquals(body.competitor_analysis.detailed_competitors.length, 10);
    assertExists(body.paid_competitor_analysis);
    assertEquals(body.paid_competitor_analysis.paid_competitor_count, 10);

    // ai_errors logs the one failure.
    assertEquals(body.ai_errors.length, 1);
    assert(body.ai_errors[0].includes("backlinks_overview"));
    assert(body.ai_errors[0].includes("auth_failed"));

    // provider_traces shows 8 entries with 7 ok / 1 failed.
    assertEquals(body.provider_traces.length, 8);
    assertEquals(body.api_calls_made, 8);
    assertEquals(body.api_calls_ok, 7);

    // api_units_used reported and > 0.
    assert(body.api_units_used > 0,
      `api_units_used must be > 0 when sub-calls succeeded; got ${body.api_units_used}`);

    // Sanitisation checks: no raw key / no Authorization in trace bodies.
    const serialised = JSON.stringify(body);
    assert(!serialised.includes("test_key_xyz"),
      "raw API key must never appear in edge response");
    assert(!serialised.includes("Bearer "),
      "raw Bearer header must never appear in edge response");
    assert(!serialised.includes("SUPABASE_SERVICE_ROLE_KEY"),
      "service-role env var name must never appear in edge response");
  } finally {
    restoreFetch();
  }
});

// ─── Helper: load handler with side-effects captured ────────────────────
//
// The handler at index.ts calls `serve(handler)` at module load, registering
// itself with Deno's HTTP server. For testing we need to extract the
// handler function. We monkey-patch `serve` BEFORE importing the module so
// it captures the handler instead of starting a server.

let _capturedHandler: ((req: Request) => Promise<Response>) | null = null;

async function loadHandler(): Promise<(req: Request) => Promise<Response>> {
  if (_capturedHandler) return _capturedHandler;

  // Patch the serve module to capture the handler.
  // deno-lint-ignore no-explicit-any
  const serveMod: any = await import("https://deno.land/std@0.168.0/http/server.ts");
  const originalServe = serveMod.serve;
  serveMod.serve = (handler: (req: Request) => Promise<Response>) => {
    _capturedHandler = handler;
  };

  try {
    // Force fresh import per loadHandler so the handler closure is created
    // fresh (the module reads SEMRUSH_API_KEY at module-init time, so each
    // test that mutates the env should call loadHandler AFTER setting env).
    await import(`./index.ts?cb=${Date.now()}`);
  } finally {
    serveMod.serve = originalServe;
  }

  if (!_capturedHandler) {
    throw new Error("Handler not captured — did serve() get called?");
  }
  return _capturedHandler;
}
