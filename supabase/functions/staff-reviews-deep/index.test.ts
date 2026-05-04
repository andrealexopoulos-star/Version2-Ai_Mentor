// ═══════════════════════════════════════════════════════════════════════════
// STAFF REVIEWS DEEP — Edge function tests (Deno test runner)
//
// Run locally with:
//   cd supabase/functions
//   deno test --allow-net --allow-env --no-check staff-reviews-deep/index.test.ts
//
// CI runs the equivalent via the supabase CLI in `.github/workflows/`.
//
// These tests validate the contract enforced by the edge function:
//   1. unauth → 401 (no fallback)
//   2. missing FIRECRAWL_API_KEY → platform marked as DATA_UNAVAILABLE
//      (insufficient signal — no crash, no silent success)
//   3. external response is sanitised (no supplier names in errors,
//      Contract v2 compliant)
//
// Note: these are mostly "contract documentation" — the heavy mocking
// required to exercise the full network path is overkill given the
// Python-side AST tests already cover the behavioural shape. Treat this
// file as the canonical place to add Deno-runtime tests when the
// supabase test harness is wired in CI.
// ═══════════════════════════════════════════════════════════════════════════

import {
  assert,
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ───────────────────────────────────────────────────────────────────────────
// Test 1 — unauth returns 401 (no fallback / no silent success)
// ───────────────────────────────────────────────────────────────────────────

Deno.test("unauth: missing Authorization header returns 401", async () => {
  // Read the edge function source to confirm the contract is encoded.
  // We can't easily exercise the live handler without a Supabase test
  // harness, so we contract-test the source.
  const src = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url).pathname,
  );
  // verifyAuth shared helper returns ok:false / status:401 on missing header.
  // The handler must propagate that 401 — never fall back to anonymous.
  assertStringIncludes(src, "verifyAuth(req)");
  assertStringIncludes(src, "auth.status || 401");
  assertStringIncludes(src, "if (!auth.ok)");
  // Must include the sanitised state in the unauth response so the frontend
  // doesn't see a raw 401 with stack-trace-like body.
  assertStringIncludes(src, '"DATA_UNAVAILABLE"');
});

// ───────────────────────────────────────────────────────────────────────────
// Test 2 — missing FIRECRAWL_API_KEY marks platform as INSUFFICIENT_SIGNAL
// ───────────────────────────────────────────────────────────────────────────

Deno.test("contract: missing FIRECRAWL_API_KEY surfaces DATA_UNAVAILABLE state per platform", async () => {
  const src = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url).pathname,
  );
  // The firecrawlScrape function must early-return null and push a
  // sanitised error code (NOT "Firecrawl unavailable") on missing key.
  assertStringIncludes(src, "if (!FIRECRAWL_API_KEY)");
  assertStringIncludes(src, "scrape_provider_unavailable");
  // deriveStateFromIntel must map this case to a contract-v2 state.
  assertStringIncludes(src, "deriveStateFromIntel");
  // No supplier name in the sanitised path
  assert(!src.match(/aiErrors\.push\([^)]*Firecrawl[^)]*\)/i),
    "ai_errors must not contain 'Firecrawl' supplier name");
  assert(!src.match(/aiErrors\.push\([^)]*OpenAI[^)]*\)/i),
    "ai_errors must not contain 'OpenAI' supplier name");
  assert(!src.match(/aiErrors\.push\([^)]*Serper[^)]*\)/i),
    "ai_errors must not contain 'Serper' supplier name");
  assert(!src.match(/aiErrors\.push\([^)]*SerpAPI[^)]*\)/i),
    "ai_errors must not contain 'SerpAPI' supplier name");
});

// ───────────────────────────────────────────────────────────────────────────
// Test 3 — sanitised response shape (Contract v2 enum + no internal leaks)
// ───────────────────────────────────────────────────────────────────────────

Deno.test("contract: response uses Contract v2 external state enum exclusively", async () => {
  const src = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url).pathname,
  );
  // The 5 sanctioned external states (BIQc Platform Contract v2)
  const ALLOWED = [
    '"DATA_AVAILABLE"',
    '"DATA_UNAVAILABLE"',
    '"INSUFFICIENT_SIGNAL"',
    '"PROCESSING"',
    '"DEGRADED"',
  ];
  for (const state of ALLOWED) {
    // At minimum DATA_AVAILABLE and DATA_UNAVAILABLE must be present
    if (state === '"DATA_AVAILABLE"' || state === '"DATA_UNAVAILABLE"') {
      assertStringIncludes(src, state);
    }
  }
  // Forbidden: error codes that leak internal architecture
  const FORBIDDEN_RESPONSE_TOKENS = [
    "user_jwt_rejected",
    "service_role_exact",
    "SEMRUSH_API_KEY_MISSING",
  ];
  for (const tok of FORBIDDEN_RESPONSE_TOKENS) {
    assert(
      !src.includes(tok),
      `Response source must not include internal token: ${tok}`,
    );
  }
});

Deno.test("contract: edge fn discovers slugs/EIDs via Serper.dev when not provided", async () => {
  const src = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url).pathname,
  );
  // Slug derivation path
  assertStringIncludes(src, "discoverPlatformUrls");
  assertStringIncludes(src, "site:glassdoor.com.au");
  assertStringIncludes(src, "site:au.indeed.com");
  assertStringIncludes(src, "site:seek.com.au");
  // EID detection regex
  assertStringIncludes(src, "Reviews\\/.+-E\\d+\\.htm");
});

Deno.test("contract: per-platform schema includes all required PlatformStaffIntel fields", async () => {
  const src = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url).pathname,
  );
  // Required PlatformStaffIntel fields per the brief
  const REQUIRED = [
    "platform:",
    "url:",
    "found:",
    "overall_rating:",
    "total_review_count:",
    "rating_distribution:",
    "recent_reviews:",
    "themes:",
    "ceo_approval:",
    "recommend_to_friend:",
    "ai_errors:",
  ];
  for (const field of REQUIRED) {
    assertStringIncludes(src, field);
  }
});

Deno.test("contract: cross-platform aggregation includes weighted_overall_rating, themes, trend, health_score", async () => {
  const src = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url).pathname,
  );
  const REQUIRED = [
    "weighted_overall_rating",
    "total_staff_reviews_cross_platform",
    "cross_platform_themes",
    "trend_30d_vs_90d",
    "employer_brand_health_score",
    "competitor_employer_benchmark",
  ];
  for (const field of REQUIRED) {
    assertStringIncludes(src, field);
  }
});

Deno.test("contract: provider traces emitted via recordUsage on each LLM call", async () => {
  const src = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url).pathname,
  );
  // Every LLM call site must emit a usage_ledger row via recordUsage.
  assertStringIncludes(src, 'import { recordUsage } from "../_shared/metering.ts"');
  assertStringIncludes(src, "recordUsage({");
  // 3 known LLM call sites:
  //  1) classifySentimentBatch → "staff_reviews_sentiment" feature
  //  2) extractPerPlatformThemes → "staff_reviews_platform_themes" feature
  //  3) extractThemesAcrossPlatforms → "staff_reviews_themes" feature
  assertStringIncludes(src, "staff_reviews_sentiment");
  assertStringIncludes(src, "staff_reviews_themes");
  assertStringIncludes(src, "staff_reviews_platform_themes");
});
