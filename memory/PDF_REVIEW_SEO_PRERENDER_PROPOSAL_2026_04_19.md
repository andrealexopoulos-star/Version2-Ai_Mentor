# SEO / crawler-visibility proposal — PDF review #4

**Date:** 2026-04-19 (overnight work, review morning of 2026-04-20)
**Driving source:** external BIQc Website Review, item #4

---

## The reviewer's point

> The site is still a client-side-rendered SPA that's invisible to Google, LinkedIn previews, and AI agents / crawlers.

This is the item most directly tied to Andreas's comment about marketing spend not converting. Ads → site → crawlers/AI agents can't read the site → no discovery loop, no organic, broken link previews, nothing to index.

## What's actually broken vs not

Audited `frontend/public/index.html` tonight. The picture is more nuanced:

| Surface | State | Notes |
|---|---|---|
| `<title>` | ✅ good — "BIQc — Business Intelligence Centre" | — |
| `<meta description>` | 🟡 generic — "Your personalised AI business advisor that continuously learns your business" | Reads as marketing-speak, doesn't explain the product. Update when positioning lock ships. |
| Open Graph (og:*) | ✅ present — title/description/image/locale/type/url | LinkedIn + Slack + Facebook previews should work. Untested live. |
| Twitter Card | ✅ present — summary_large_image | Should work. Untested live. |
| Canonical URL | ✅ present | — |
| Schema.org SoftwareApplication | ✅ present (fixed tonight) | Removed fabricated `aggregateRating`, fixed price 0 → 69 AUD. See [commit pending]. |
| Schema.org Organization | ✅ present | — |
| Robots meta | ✅ full-index | — |
| **Main body content** | ❌ empty `<div id="root">` — all text injected by React after JS loads | This is the CSR-SPA problem the reviewer flagged. Google's crawler does run JS but indexes CSR content ~1-2 weeks slower than SSR. AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) frequently DO NOT execute JS at all and see a blank page. |

### What this actually means

- **LinkedIn / Twitter / Slack link previews:** should work because they read meta tags only. (Confirm by pasting a link into LinkedIn's Post Inspector.)
- **Google indexing:** works, but delayed. Google's rendering service queues JS-rendered pages separately and can take 1-4 weeks to refresh.
- **AI crawlers (GPT/Claude/Perplexity):** see `<div id="root"></div>` + a `<noscript>` tag. BIQc is functionally invisible to them. This matters because ChatGPT Search, Claude Web, Perplexity, and similar tools are an increasingly large source of discovery for Australian SMB buyers.
- **Page speed / LCP:** not directly a SEO issue but contributes to Google Core Web Vitals score. The current CRA-served setup has a moderate LCP.

## Options, ranked by effort/risk

### Option 1 — Static prerender of marketing routes only (recommended)

Render 5-10 marketing routes (`/`, `/platform`, `/intelligence`, `/pricing`, `/about`, `/trust/*`) to static HTML at build time. Keep app routes (`/login-supabase`, `/register-supabase`, `/calibration`, etc.) as CSR. Ship HTML to the CDN alongside the CSR app.

- **Effort:** ~4-8 hours (Dockerfile + build script + smoke test)
- **Risk:** moderate — prerender can inline sensitive data if not careful; app routes must be explicitly EXCLUDED
- **Tool choice:**
  - `react-snap` — most popular, but last maintained 2020 and not React 19 compatible. Would need a fork/patch. ⚠️
  - `puppeteer` + custom prerender script — more control, more code. Reliable with React 19.
  - `rendertron` or a serverless Cloudflare Worker — runtime pre-rendering; fine for crawlers but adds a dependency.

**My recommendation:** custom Puppeteer script run as a Docker build step. ~100 lines. Output goes to `build/` alongside the normal CRA assets. nginx serves the prerendered `.html` for `/`, `/platform`, etc., and the SPA shell for everything else.

### Option 2 — Migrate to Next.js App Router

Best long-term outcome (true SSR, streaming, edge caching, automatic SEO, React Server Components). BUT:
- 2-4 week migration for a repo this size
- Requires route-by-route audit (auth context, client-only hooks like `useForceLightTheme`, framer-motion, etc.)
- Breaks the current `react-router-dom` setup entirely

Don't do this tonight. Candidate for a Q2 project. Worth costing before committing.

### Option 3 — Minimal fix: hardcoded marketing content in `<noscript>` or pre-body placeholder

Add a machine-readable `<noscript>` block with the marketing copy (one paragraph per marketing route). This is a hack — Google's guidelines discourage it — but AI crawlers will see something real.

- **Effort:** ~1 hour
- **Risk:** can be flagged as cloaking by Google if done carelessly
- **Value:** marginal — better than current, far worse than prerender

### Option 4 — Just wait

Google does index SPAs eventually. If marketing spend is being wasted specifically because ads aren't converting, the SEO issue is not the ad conversion problem (that's the signup flow, which we fixed today). Organic discovery is a medium-term asset.

## Tonight's delivery

I did not ship a prerender tonight because:
1. `react-snap` doesn't support React 19 → needs a custom Puppeteer script
2. The Dockerfile.frontend would need a parallel rebuild + new smoke-test CI step
3. Shipping a half-working prerender at 11pm is the definition of cutting a corner

What I *did* do:
- Removed the fabricated Schema.org aggregate rating (fake `4.8 / 500` reviews) — that's worse than no structured data because Google penalizes it and a discerning buyer or press outlet reviewing the site would catch it
- Fixed the Schema.org price (0 → 69 AUD)
- Everything else in `index.html` (OG, Twitter Card, canonical, robots) was already in good shape

## Recommendation

Schedule Option 1 (Puppeteer prerender of marketing routes) as a dedicated half-day effort, not a late-night rush. I'll open it as an RFC PR with:
- The Puppeteer script
- Dockerfile changes
- Explicit route allow-list (no authenticated routes)
- Smoke test validating every marketing route renders non-empty body HTML
- A rollback plan (feature-flag the nginx routing to fall back to SPA serving if prerender is bad)

## What to do with this document

Say "yes Option 1" and I'll ship the RFC PR in the next session. Or push back with different priorities.
