// ═══════════════════════════════════════════════════════════════
// customer-reviews-deep — Deno edge-function tests
//
// Self-contained, no live network. Each test stubs `fetch` to
// simulate a specific upstream condition and asserts the response
// shape against the BIQc Platform Contract v2.
//
// Run: deno test --allow-net --allow-env --allow-read \
//        supabase/functions/customer-reviews-deep/test.ts
// ═══════════════════════════════════════════════════════════════

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Test helpers ─────────────────────────────────────────────────────────
//
// We use Deno's stub mechanism for fetch. `setupEnv` ensures the edge
// function module sees expected env vars. Each test installs its own
// `fetch` stub that maps URL prefixes to fake JSON responses.

function setupEnv(opts: Partial<Record<string, string>> = {}) {
  const defaults: Record<string, string> = {
    SUPABASE_URL: "https://stub.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "stub-service-role-key",
    SERPER_API_KEY: "stub-serper-key",
    FIRECRAWL_API_KEY: "stub-firecrawl-key",
    OPENAI_API_KEY: "stub-openai-key",
    ANTHROPIC_API_KEY: "stub-anthropic-key",
    GOOGLE_API_KEY: "stub-gemini-key",
    ALLOWED_ORIGINS: "https://biqc.ai,http://localhost:3000",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...opts })) {
    if (v === "" || v === undefined) {
      Deno.env.delete(k);
    } else {
      Deno.env.set(k, v);
    }
  }
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function installFetch(handler: FetchHandler) {
  const original = globalThis.fetch;
  globalThis.fetch = (input: any, init?: any) => {
    const url = typeof input === "string" ? input : (input?.url ?? String(input));
    return Promise.resolve(handler(url, init));
  };
  return () => { globalThis.fetch = original; };
}

function jsonResponse(status: number, body: any): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Build a fetch handler that simulates a fully-working pipeline.
function happyPathHandler(): FetchHandler {
  return (url, init) => {
    // Auth — supabase.auth.getUser
    if (url.includes("/auth/v1/user")) {
      return jsonResponse(200, { id: "user-123", email: "test@example.com" });
    }
    // Serper places
    if (url.includes("google.serper.dev/places")) {
      return jsonResponse(200, {
        places: [{
          title: "Acme Bakery",
          address: "123 George St, Sydney NSW",
          rating: 4.6,
          ratingCount: 312,
          placeId: "ChIJxyz",
        }],
      });
    }
    // Serper search
    if (url.includes("google.serper.dev/search")) {
      return jsonResponse(200, {
        organic: [
          { snippet: "Best sourdough in the inner west, friendly staff and quick service.", link: "x", title: "y" },
          { snippet: "Coffee was burnt and the queue was 20 minutes long.", link: "x", title: "y" },
        ],
      });
    }
    // Firecrawl scrape — Trustpilot-style
    if (url.includes("api.firecrawl.dev")) {
      const body = init?.body ? String(init.body) : "";
      if (body.includes("trustpilot")) {
        return jsonResponse(200, {
          data: {
            markdown:
              "TrustScore 4.3\n\n312 reviews\n\nRated 5 out of 5 stars\nJane • verified\nGreat customer service, would order again.\nDate of experience: 2026-04-10\n\nRated 2 out of 5 stars\nBob • verified\nPackaging was damaged on arrival.\nDate of experience: 2026-03-12\n",
            html: '"ratingValue":"4.3","reviewCount":"312"',
          },
        });
      }
      if (body.includes("productreview")) {
        return jsonResponse(200, {
          data: {
            markdown: "4.5 / 5\n\n89 reviews\n\n5.0 / 5\nLoved the experience, will recommend.\n10 March 2026\n\n3.0 / 5\nAverage at best. Could be better.\n2 February 2026",
            html: '"ratingValue":"4.5","reviewCount":"89"',
          },
        });
      }
      if (body.includes("yelp")) {
        return jsonResponse(200, {
          data: {
            markdown: "4.2 stars 47 reviews",
            html: '"@type":"Review","reviewBody":"Solid place for brunch","ratingValue":"4","datePublished":"2026-03-20","author":{"name":"Sam Williams"} "@type":"Review","reviewBody":"Service was painfully slow today","ratingValue":"2","datePublished":"2026-04-01","author":{"name":"Lee Chan"} "ratingValue":"4.2","reviewCount":"47"',
          },
        });
      }
      if (body.includes("facebook")) {
        // Facebook commonly fails / login-walled; simulate a soft 200 with no signal
        return jsonResponse(200, {
          data: { markdown: "", html: "" },
        });
      }
      return jsonResponse(200, { data: { markdown: "", html: "" } });
    }
    // OpenAI sentiment + themes
    if (url.includes("api.openai.com")) {
      return jsonResponse(200, {
        choices: [{
          message: {
            content: JSON.stringify([
              { id: 0, sentiment: "positive", themes: ["customer service", "quality"] },
              { id: 1, sentiment: "negative", themes: ["packaging", "damage"] },
              { id: 2, sentiment: "positive", themes: ["recommendation"] },
              { id: 3, sentiment: "neutral", themes: ["average"] },
            ]),
          },
        }],
      });
    }
    if (url.includes("api.anthropic.com")) {
      return jsonResponse(200, {
        content: [{ text: JSON.stringify([{ id: 0, sentiment: "positive", themes: ["service"] }]) }],
      });
    }
    if (url.includes("generativelanguage.googleapis.com")) {
      return jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: JSON.stringify([{ id: 0, sentiment: "positive", themes: ["service"] }]) }] } }],
      });
    }
    // Supabase trace insert (REST PostgREST)
    if (url.includes("/rest/v1/provider_traces")) {
      return jsonResponse(201, {});
    }
    return jsonResponse(404, { error: "stub-fetch: unmatched url", url });
  };
}

// Import-based test approach: dynamic import the edge module after env+stub
// are installed so the module captures the stubbed fetch at module load.
async function importHandler(): Promise<(req: Request) => Promise<Response>> {
  // Reset module cache by appending a cache-bust query
  const mod = await import(`./index.ts?v=${Math.random()}`);
  // Deno.serve is invoked at module load — capture the handler via the
  // last-registered serve callback. We use a lightweight monkey-patch
  // installed BEFORE the import.
  return (mod as any).__handler || ((req: Request) => Promise.resolve(new Response("not-installed", { status: 500 })));
}

// Because the edge function uses top-level `Deno.serve`, we monkey-patch
// `Deno.serve` BEFORE importing to capture the handler closure.
function patchServe(): { handler: (req: Request) => Promise<Response> | Response } {
  const captured: { handler: (req: Request) => Promise<Response> | Response } = {
    handler: (_req: Request) => new Response("not-installed", { status: 500 }),
  };
  (Deno as any).serve = (h: any) => {
    captured.handler = h;
    return { addr: { port: 0 } } as any;
  };
  return captured;
}

// ── Tests ────────────────────────────────────────────────────────────────

Deno.test("test_unauth_returns_401_no_anon_bypass", async () => {
  setupEnv();
  const restore = installFetch(happyPathHandler());
  const captured = patchServe();
  await import(`./index.ts?v=${Math.random()}_t1`);

  const req = new Request("https://stub/customer-reviews-deep", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ business_name: "Acme", domain: "acme.com.au" }),
  });
  const res = await captured.handler(req);
  assertEquals(res.status, 401, "missing Authorization header MUST return 401 (zero-401-fallback rule)");
  const body = await res.json();
  // Sanitised — never expose auth-path detail
  assert(!JSON.stringify(body).toLowerCase().includes("bearer"), "must not leak auth header internals");
  assert(!JSON.stringify(body).toLowerCase().includes("service_role"), "must not leak service_role internals");
  restore();
});

Deno.test("test_missing_firecrawl_key_marks_platform_insufficient_no_crash", async () => {
  setupEnv({ FIRECRAWL_API_KEY: "" });
  const restore = installFetch(happyPathHandler());
  const captured = patchServe();
  await import(`./index.ts?v=${Math.random()}_t2`);

  const req = new Request("https://stub/customer-reviews-deep", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer stub-service-role-key",
    },
    body: JSON.stringify({
      user_id: "user-1",
      business_name: "Acme Bakery",
      domain: "acmebakery.com.au",
      location: "Sydney NSW",
    }),
  });
  const res = await captured.handler(req);
  assertEquals(res.status, 200, "missing scrape provider key MUST NOT crash the scan");
  const body = await res.json();
  assert(Array.isArray(body.platforms), "platforms array still returned");
  // Trustpilot/PR/Yelp/FB platforms should be present and marked insufficient.
  const trustpilot = body.platforms.find((p: any) => p.platform === "trustpilot");
  assert(trustpilot, "trustpilot platform record present");
  assert(["INSUFFICIENT_SIGNAL", "DATA_UNAVAILABLE"].includes(trustpilot.state),
    `trustpilot state should be INSUFFICIENT_SIGNAL or DATA_UNAVAILABLE, got: ${trustpilot.state}`);
  // External response top-level state is one of the contract enum values.
  assert(
    ["DATA_AVAILABLE", "DATA_UNAVAILABLE", "INSUFFICIENT_SIGNAL", "PROCESSING", "DEGRADED"].includes(body.state),
    `top-level state must be in Contract v2 enum, got: ${body.state}`,
  );
  restore();
});

Deno.test("test_response_shape_per_contract_v2_includes_required_fields", async () => {
  setupEnv();
  const restore = installFetch(happyPathHandler());
  const captured = patchServe();
  await import(`./index.ts?v=${Math.random()}_t3`);

  const req = new Request("https://stub/customer-reviews-deep", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer stub-service-role-key",
    },
    body: JSON.stringify({
      user_id: "user-1",
      business_name: "Acme Bakery",
      domain: "acmebakery.com.au",
      location: "Sydney NSW",
    }),
  });
  const res = await captured.handler(req);
  assertEquals(res.status, 200);
  const body = await res.json();
  // Top-level shape
  assert("ok" in body, "ok field present");
  assert("state" in body, "state field present (Contract v2)");
  assert("platforms" in body && Array.isArray(body.platforms), "platforms array");
  assert("aggregated" in body, "aggregated key");
  assertEquals(body.platforms.length, 5, "all 5 platforms covered");
  const platformIds = body.platforms.map((p: any) => p.platform).sort();
  assertEquals(platformIds, ["facebook", "google_maps", "productreview_au", "trustpilot", "yelp"]);
  // Aggregated shape
  assert("weighted_avg_rating" in body.aggregated, "weighted_avg_rating");
  assert("sentiment_distribution" in body.aggregated, "sentiment_distribution");
  assert("velocity_total" in body.aggregated, "velocity_total");
  assert("themes_top" in body.aggregated, "themes_top");
  // Each platform record
  for (const p of body.platforms) {
    assert(typeof p.found === "boolean", `${p.platform}.found is boolean`);
    assert(["DATA_AVAILABLE", "DATA_UNAVAILABLE", "INSUFFICIENT_SIGNAL", "PROCESSING", "DEGRADED"].includes(p.state),
      `${p.platform}.state in enum, got ${p.state}`);
    assert(Array.isArray(p.recent_reviews), `${p.platform}.recent_reviews is array`);
    assert("review_velocity" in p, `${p.platform}.review_velocity present`);
  }
  restore();
});

// Note: a stricter "no banned tokens in external payload" test belongs at
// the calibration.py boundary (which is responsible for the final
// sanitisation pass before responses leave for the frontend). The edge
// function may legitimately surface internal `ai_errors` for
// calibration.py to consume — those are stripped at the boundary.
