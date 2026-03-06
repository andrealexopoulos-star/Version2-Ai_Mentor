# BIQc SALES READINESS ASSESSMENT
**Date:** 6 March 2026
**Verdict: CONDITIONALLY READY — 3 blockers must be resolved before first customer onboarding**

---

## WHAT'S WORKING (Ready to Demo & Sell)

### Core Intelligence Engine — LIVE
- Cognition Core SQL engine computing stability scores, instability indices, propagation maps
- 1,878 live observation_events flowing from HubSpot CRM + Xero accounting
- Emission scheduler running every 15 minutes (autonomous, no manual trigger)
- 5 signal types detecting: deal_stall, invoices_overdue, cash_burn, pipeline_decay, margin_compression

### SoundBoard AI Advisor — LIVE
- References specific deal names, amounts, stall durations from live CRM data
- Business DNA context injected (revenue, team size, challenges, goals)
- Response contract enforced: Situation → Decision → This-Week Action → Risk
- Personalization guardrail: BLOCKED / DEGRADED / FULL modes
- 12/12 benchmark PASS, 0% generic response rate
- Voice chat with business-context instructions (OpenAI Realtime)

### Calibration Flow — LIVE
- Full onboarding wizard (14 steps)
- Business identity lookup via ABN
- Website scraping + Perplexity research for Business DNA extraction
- CMO Marketing Summary generation
- Post-CMO integration overlay (email/CRM connect prompts)

### Platform Infrastructure — LIVE
- Auth: Supabase auth (email + Google + Microsoft OAuth)
- All critical API endpoints returning 200
- Design token system (77 files tokenized)
- Mobile responsive across 390px / 768px / 1440px
- Zero emergentagent.com AI dependency (direct OpenAI)
- LLM router with per-task model + timeout configuration

### Subscription & Payments — LIVE
- Stripe checkout endpoint functional (needs package_id + origin_url)
- 4-tier pricing: Free ($0), Foundation ($750), Performance ($1,950), Growth ($3,900)
- Tier gates on Revenue, Operations, Automations pages

---

## BLOCKERS (Must Fix Before First Customer)

### BLOCKER 1: Andre's Account Login — BROKEN
- `andre@thestrategysquad.com.au` cannot log in (password invalid)
- This is the ONLY account with real HubSpot + Xero + Outlook integrations
- Without this, you cannot demo live CRM/accounting intelligence to a customer
- **Fix:** Reset password in Supabase Auth dashboard (2 minutes)
- **Owner:** You (Supabase dashboard access required)

### BLOCKER 2: Cloudflare CDN Cache — Serving Old Code
- `beta.thestrategysquad.com` serves cached production builds from weeks ago
- All frontend fixes (font tokens, color consolidation, Revenue page, logo, etc.) only visible on preview URL
- **Fix:** Either purge Cloudflare cache OR deploy to production hosting (Azure)
- The `beta` A record points to Cloudflare IP `172.66.2.113` which proxies to an unknown origin — NOT the Emergent preview pod
- **Owner:** You (need to identify and access the Cloudflare account, or update the origin server)
- **Alternative:** Demo using `strategy-platform-1.preview.emergentagent.com` directly

### BLOCKER 3: observation_events Deduplication
- The emission scheduler creates ~87 events per 15-minute cycle
- Without a unique constraint, duplicates accumulate (1,878 events, many duplicates)
- This inflates signal counts and could confuse the AI with redundant data
- **Fix:** Run this SQL in Supabase SQL Editor:
```sql
ALTER TABLE observation_events ADD COLUMN IF NOT EXISTS fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_events_dedup
ON observation_events(user_id, signal_name, fingerprint)
WHERE fingerprint IS NOT NULL;
```
- **Owner:** You (Supabase SQL Editor access)

---

## NOT BLOCKERS BUT NEED ATTENTION (Post-First-Sale)

### 1. Revenue Page — Partially Wired
- Shows "Revenue Intelligence" with signal count when signals exist (FIXED)
- Shows SoundBoard quick-query buttons when CRM deals endpoint fails (FIXED)
- BUT: Pipeline chart, scenario modeling, concentration visualization only render when Merge CRM API returns live deal objects (not just observation_events)
- **Impact:** Low for first sale — SoundBoard gives the same data narratively
- **Timeline:** 1-2 days to wire observation_events into pipeline visualisation

### 2. Market Page Tabs — Partially Data-Bound
- Focus tab: Populated from cognitive snapshot (has data if calibrated)
- Saturation/Demand/Friction tabs: Render from snapshot data, may show generic if snapshot is stale
- **Impact:** Medium — these tabs show real data from calibration but don't update from live signals yet
- **Timeline:** 1-2 days to wire cognition/market + observation_events

### 3. Operations Page — Empty for Most Users
- Shows enterprise gate (contact form) for free/basic users
- For paid users: shows capacity data only if HRIS/project management tool connected
- **Impact:** Low — most first customers won't have HRIS connected
- **Timeline:** Not needed for first sale

### 4. Watchtower Intelligence — Workspace Initialization
- Returns 400: "Workspace not initialized"
- Requires watchtower workspace setup per user
- **Impact:** Medium — the watchtower powers some market signals
- **Timeline:** Need to auto-initialize workspace on first calibration completion

### 5. Test Account 2 — Invalid Credentials
- `trent-test2@biqc-test.com` password doesn't work
- **Impact:** Low — test1 and test3 work fine
- **Owner:** You (Supabase password reset)

### 6. calibration-business-dna Edge Function — 18 Second Cold Start
- First call takes 18s (Supabase cold start + Perplexity + Firecrawl)
- Subsequent calls are faster
- **Impact:** Medium — new user's first calibration feels slow
- **Mitigation:** Deploy `warm-cognitive-engine` scheduled function to keep it warm

### 7. Expo Mobile App — Built But Not Deployed
- All 5 screens built and connected to APIs
- Push notification service implemented
- NOT submitted to App Store or TestFlight
- **Impact:** None for first sale — web app is primary
- **Timeline:** 1 week for TestFlight submission

---

## WHAT A FIRST CUSTOMER EXPERIENCES (Happy Path)

1. **Visit** `beta.thestrategysquad.com` → See hero: "A Single Intelligence Layer Across All Business Systems"
2. **Register** → Email + password + company name + industry
3. **Calibrate** → Enter website URL → BIQc scrapes, researches, builds Business DNA profile (~3 min)
4. **See CMO Summary** → Marketing audit with competitive positioning, digital footprint score
5. **Connect Integrations** → Click to connect HubSpot/Xero/Outlook via Merge OAuth
6. **Wait 15 minutes** → Emission scheduler creates first observation_events from their CRM/accounting
7. **Ask SoundBoard** → "What's my biggest risk?" → Gets specific response referencing their actual deals, invoices, cash flow
8. **See Advisor Dashboard** → Stability score, system state, propagation map, Daily Brief
9. **Track Decisions** → Record strategic decisions, get 30/60/90 day checkpoint reminders
10. **Subscribe** → Choose tier, pay via Stripe

---

## DEMO SCRIPT (For Tomorrow)

**Best demo path:**
1. Log in as `trent-test1@biqc-test.com` (has seeded Campos Coffee profile + 10 test signals)
2. Show Advisor page → Stability Score 75, system state, cognition tabs
3. Open SoundBoard → Ask "What deals are stalled?" → AI names specific deals with stall durations
4. Ask "What's my biggest risk?" → AI references cash flow from B2B payment terms
5. Show Decisions page → Record a decision → Show checkpoint timeline
6. Show Competitive Benchmark → Digital Footprint score + percentile
7. Show Daily Brief banner → "Your Business Brief is ready"
8. If time: Show voice chat → AI knows the business by name

**Use preview URL:** `strategy-platform-1.preview.emergentagent.com`
**NOT** `beta.thestrategysquad.com` (cached old code)

---

## SUMMARY

| Area | Status | Blocker? |
|------|--------|----------|
| Auth (register/login) | WORKING | No |
| Calibration (onboarding) | WORKING | No |
| Cognition Core (SQL engine) | WORKING | No |
| SoundBoard (AI advisor) | WORKING — data-bound | No |
| Voice Chat | WORKING | No |
| Observation Events (pipeline) | WORKING — 1,878 events | No |
| Emission Scheduler | WORKING — 15 min cycles | No |
| Decision Tracker | WORKING | No |
| Competitive Benchmark | WORKING | No |
| Daily Brief | WORKING | No |
| Stripe Payments | WORKING | No |
| Andre's Account | BROKEN password | YES |
| Production Domain (beta.) | CACHED old code | YES |
| Event Deduplication | MISSING unique constraint | YES |
| Revenue Page Visualizations | PARTIAL — needs Merge API | No (SoundBoard covers) |
| Market Sub-tabs | PARTIAL — needs signal refresh | No |
| Mobile App | BUILT not deployed | No |
