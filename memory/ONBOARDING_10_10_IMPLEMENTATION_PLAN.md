# BIQc ONBOARDING 10/10 IMPLEMENTATION PLAN
## Leadership Presentation — Step-by-Step Execution Proposal
### Prepared: 20 February 2026

---

## EXECUTIVE SUMMARY

This proposal maps the BIQc Onboarding Upgrade Specification to our **existing architecture** (React frontend, FastAPI backend, Supabase PostgreSQL/Edge Functions/Auth, OpenAI, Perplexity, Merge.dev) and identifies **specific new capabilities** required. Every step names the exact file, endpoint, edge function, SQL table, or supplier involved.

**Current Final Scores → Target 10/10:**

| Dimension | Current | Target | Primary Lever |
|---|---|---|---|
| No Need Overcome | 5/10 | 10/10 | Pre-account Snapshot (value before commitment) |
| No Trust Overcome | 7/10 | 10/10 | Privacy handshake + scope transparency |
| No Hurry Overcome | 3/10 | 10/10 | Truthful urgency + opportunity decay in onboarding |
| TTFV | 6/10 | 10/10 | Instant Snapshot (<20s) before signup |
| Emotional Activation | 4/10 | 10/10 | Delta WOW + micro-insights + consequence framing |
| Cognitive Respect | 6/10 | 10/10 | Progressive nav + plain labels + next-best-action |
| Retention Likelihood | 5/10 | 10/10 | Session-1 integration gate + checklist |
| Strategic Differentiation | 7/10 | 10/10 | "Sovereign Intelligence Partner" reinforced at every step |

**Total estimated effort:** 280–480 engineering hours across 8 weeks
**No rebuilds.** All work is additive, feature-flagged, and A/B tested.

---

## CURRENT ARCHITECTURE MAP

```
FRONTEND (React + Craco)
├── LandingIntelligent.js          ← Hero, CTAs, social proof
├── RegisterSupabase.js            ← 6-field registration
├── LoginSupabase.js               ← Social auth + email
├── CalibrationAdvisor.js          ← Orchestrator
├── useCalibrationState.js         ← Edge function calls
├── CalibratingSession.js          ← Wizard/Chat UI
├── WowSummary.js                  ← Profile reveal
├── AdvisorWatchtower.js           ← Main dashboard
├── DashboardLayout.js             ← Sidebar nav (20+ items)
└── TutorialOverlay.js             ← Tutorial system (just built)

BACKEND (FastAPI)
├── routes/calibration.py          ← /calibration/status, /answer, /init
├── routes/integrations.py         ← Merge.dev, cold-read, ingestion
├── routes/intelligence.py         ← Snapshots, baselines
├── routes/auth.py                 ← JWT + Supabase auth
├── routes/profile.py              ← Business profile CRUD
└── routes/onboarding.py           ← Onboarding state

SUPABASE EDGE FUNCTIONS
├── calibration-psych              ← AI calibration Q&A
├── intelligence-snapshot          ← Cognitive snapshot generation
├── deep-web-recon                 ← Public signal scanning
├── boardroom-diagnosis            ← BoardRoom AI
├── strategic-console-ai           ← WarRoom AI
├── gmail_prod                     ← Gmail integration
└── email_priority                 ← Email prioritisation

DATABASE (Supabase PostgreSQL)
├── users                          ← Auth users
├── business_profiles              ← Business DNA
├── user_operator_profile          ← Calibration state, operator profile
├── strategic_console_state        ← Console state persistence
├── intelligence_snapshots         ← Cached cognitive snapshots
└── calibration_answers            ← Individual question answers
```

---

## PHASE 1: HERO & CTA FIX (Week 1) — P0
**Scores targeted:** No Need 5→7, No Hurry 3→5

### Step 1.1: Fix Hero Headline Render

**Problem:** Typewriter animation renders mid-sentence ("intelligen...") on first paint.
**File:** `/app/frontend/src/pages/LandingIntelligent.js`

**Implementation:**
- Replace the animated headline with static server-rendered text
- Apply a post-hydration underline-sweep CSS animation (180ms, once per session)
- Add `@media (prefers-reduced-motion: reduce)` to disable animation
- Headline text change: "Turn business signals into decisions — in minutes."

**Mockup:**
![Hero CTA Mockup](https://static.prod-images.emergentagent.com/jobs/86ec0e34-7ffe-44b2-90f0-644a3b011de5/images/7628bfab13e7ccb962e37b50df6c997dfa0be277bf670774fdd535f318744bb7.png)

**Commentary:** The mockup shows the corrected hero with static headline, single primary CTA "Run free BIQc Snapshot", social proof logo strip below, and 3 compressed value tiles moved above the fold. The dual-CTA ambiguity is eliminated.

### Step 1.2: Replace Dual CTA Architecture

**File:** `/app/frontend/src/pages/LandingIntelligent.js`

**Current:** "Start for free" + "Get a demo" (ambiguous)
**Proposed:**
- Primary: "Run free BIQc Snapshot" → Opens Snapshot modal (Step 2)
- Secondary: "Book a live demo" → Routes to Calendly/scheduler
- Differentiator text under each button

### Step 1.3: Add Social Proof Block

**File:** `/app/frontend/src/pages/LandingIntelligent.js`

**Current:** "Trusted by growing Australian businesses" (no evidence)
**Proposed:**
- Logo strip (8 logos) — requires real client permission
- 2 proof cards with: company name, role, quantified outcome, industry
- If logos unavailable: anonymised case studies ("Australian retail chain, 120 staff — outcome...")
- **Rule:** No fake logos. No vague claims. Real evidence or omit.

### Step 1.4: Move Value Props Above Fold

**File:** `/app/frontend/src/pages/LandingIntelligent.js`

Compress "What's in it for you?" section (Reclaim Time, Plug Leaks, Enforce Standards) into 3 compact icon tiles directly below the hero CTA.

**Effort:** 6–10 hrs frontend, 4–6 hrs content/design
**Dependencies:** Client permission for logos; copy approval
**Risk:** Low. CSS/markup changes only.

---

## PHASE 2: INSTANT SNAPSHOT (Weeks 2–3) — P0
**Scores targeted:** No Need 7→9, TTFV 6→9, No Hurry 5→7

This is the highest-leverage change: value BEFORE account creation.

### Step 2.1: New Supabase Edge Function — `public-snapshot`

**Purpose:** Accept a URL, crawl public signals, return structured findings in <20 seconds.

**Architecture:**
```
User enters URL in modal
    → Frontend calls Supabase Edge Function: public-snapshot
    → Edge function orchestrates:
        1. Website crawl (scrape key pages: home, about, pricing, FAQ)
        2. Extract signals (services, pricing, team size indicators, tech stack)
        3. Check public review sites (Google Business, Trustpilot)
        4. Competitor detection (similar businesses in same industry/location)
    → Returns JSON: { signals_found: N, findings: [...], competitors: [...] }
```

**Suppliers involved:**
| Supplier | Role | New/Existing |
|---|---|---|
| Supabase Edge Functions | Host the `public-snapshot` function | Existing |
| OpenAI (via emergentintegrations) | Parse/summarise crawled content | Existing |
| Perplexity API | Competitive intelligence lookup | Existing |
| **Firecrawl or Jina Reader** | Website crawling/scraping service | **NEW — evaluate** |

**New supplier evaluation — Website crawling:**
- **Option A: Firecrawl** — Purpose-built for LLM-ready web scraping. Returns clean markdown. Has `/scrape` endpoint that returns structured content in seconds.
- **Option B: Jina Reader** — Simpler. Prefix any URL with `r.jina.ai/` to get cleaned content.
- **Option C: BIQc's existing `deep-web-recon` Edge Function** — Already does public signal scanning. May be extended.
- **Recommendation:** Extend `deep-web-recon` first (it already exists and has Supabase secrets configured). Add Firecrawl as fallback for sites that block the current crawler.

**New SQL table:**
```sql
CREATE TABLE public_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_url TEXT NOT NULL,
    scan_result JSONB,
    signals_count INTEGER DEFAULT 0,
    findings JSONB DEFAULT '[]',
    competitors JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    converted_to_user_id UUID REFERENCES auth.users(id) -- linked after signup
);
```

**Mockup:**
![Snapshot Modal Mockup](https://static.prod-images.emergentagent.com/jobs/86ec0e34-7ffe-44b2-90f0-644a3b011de5/images/ed99dd87014e5cbcc97dc0b9951ceed872bcf8617b4d0363f36d457311328edd.png)

**Commentary:** The modal shows a 4-step progress stepper with live findings appearing on the right as the scan progresses. Each finding is a concrete, verifiable fact ("Found pricing page", "Detected 2 competitors"). No fabricated statistics. The user sees immediate value before creating an account.

### Step 2.2: Snapshot Modal Component

**New file:** `/app/frontend/src/components/SnapshotModal.js`

**Behaviour:**
1. User clicks "Run free BIQc Snapshot" on landing page
2. Modal opens with URL input
3. User submits URL → calls `public-snapshot` edge function (no auth required)
4. Stepper shows progress: Scanning → Extracting → Detecting → Generating
5. Live findings populate on the right panel
6. On completion: show Snapshot preview card with 3 key findings
7. CTA: "Save and continue" → routes to registration (with snapshot_id in state)

**Effort:** 40–70 hrs (edge function: 30–60, frontend: 10–15)
**Dependencies:** Website crawling service; Supabase Edge Function deployment
**Risk:** Medium. Scan latency must be <20s. Need fallback for sites that block crawling.

---

## PHASE 3: REGISTRATION SIMPLIFICATION (Week 2) — P0
**Scores targeted:** No Need 9→10, Retention 5→7

### Step 3.1: Reduce Registration Form

**File:** `/app/frontend/src/pages/RegisterSupabase.js`

**Current:** 6 fields (Full Name*, Email*, Company, Industry, Password*, Confirm Password*)
**Proposed:** 3 fields (Email*, Password*, Full Name optional)

**Removed fields:**
- Company → Already captured in Calibration Q1 ("What's the name of the business?")
- Industry → Already captured in Calibration Q1
- Confirm Password → Redundant with show/hide toggle (already exists)

### Step 3.2: Add Progress Breadcrumb

**File:** `/app/frontend/src/pages/RegisterSupabase.js`

Add top breadcrumb: `Step 1 of 3: Account → Calibration → Connect`

This activates the Zeigarnik Effect — user knows there are 3 steps and wants to complete them.

### Step 3.3: Post-Snapshot Context

If the user came from the Snapshot modal, registration heading changes to:
"Save your Snapshot and build your BIQc workspace"

The snapshot_id is passed in state and linked to the user after account creation:
```sql
UPDATE public_snapshots SET converted_to_user_id = $1 WHERE id = $2;
```

**Mockup:**
![Registration Mockup](https://static.prod-images.emergentagent.com/jobs/86ec0e34-7ffe-44b2-90f0-644a3b011de5/images/a2c60ace4ea8978937bcb8c24bed38c7b3e159d7a217d111b9653eb926d16454.png)

**Commentary:** Simplified to 3 fields with progress breadcrumb. The right panel retains sovereignty messaging. The heading references the Snapshot to maintain continuity. Google/Microsoft social auth remains prominent for one-click signup.

**Effort:** 18–30 hrs
**Dependencies:** Auth config (Supabase handles most of this)

---

## PHASE 4: PRIVACY HANDSHAKE (Week 2) — P0
**Scores targeted:** No Trust 7→10

### Step 4.1: Welcome Confirmation Screen

**File:** `/app/frontend/src/components/ProtectedRoute.js` (post-auth routing)

After successful auth, interpose a 2-second "Workspace ready" screen:
- "Welcome, {first_name}. Your BIQc environment is ready."
- "Next: 3-minute calibration to tailor BIQc to your business."
- Staged progress: Creating workspace ✓ → Preparing Snapshot ✓ → Starting calibration...

### Step 4.2: Privacy Handshake Modal

**New file:** `/app/frontend/src/components/PrivacyHandshake.js`

Shown on first login per user. Non-blocking (dismissable). Content:
- "You own your data and outputs."
- "We don't train shared models on your workspace data by default." (policy-flagged)
- "Integrations are optional and can be revoked at any time."
- "Access is permission-based and scoped."

**Policy flag implementation:**
```sql
-- New column on accounts table or tenant_settings
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS policy_flags JSONB DEFAULT '{"no_train_default": true, "au_data_residency": true}';
```

Backend endpoint:
```python
@router.get("/privacy/policy-flags")
async def get_policy_flags(current_user: dict = Depends(get_current_user)):
    # Returns tenant-specific policy flags
    # Privacy claims are ONLY displayed if the flag is true
```

**Mockup:**
![Privacy Handshake Mockup](https://static.prod-images.emergentagent.com/jobs/86ec0e34-7ffe-44b2-90f0-644a3b011de5/images/092deed627cb8792e85aa71d486e5c186a82a60147be26659937827582acb7bb.png)

**Commentary:** The privacy handshake appears once on first login. It uses configuration-driven policy flags — claims like "no training" only display if technically and contractually true. This follows enterprise AI trust patterns (OpenAI, Microsoft Copilot, Salesforce Agentforce).

**Effort:** 12–20 hrs
**Dependencies:** Security/Legal sign-off on copy; policy flag truth source

---

## PHASE 5: CALIBRATION ENHANCEMENTS (Week 4) — P1
**Scores targeted:** Emotional Activation 4→8, Cognitive Respect 6→9

### Step 5.1: Rename "Begin Audit" → "Start Calibration"

**File:** `/app/frontend/src/components/calibration/CalibrationComponents.js`

Single-line change. "Audit" implies scrutiny; "Calibration" implies personalisation.

### Step 5.2: Micro-Insight Interstitials

**File:** `/app/frontend/src/hooks/useCalibrationState.js`

After questions 3 and 6, inject an interstitial card: "What BIQc already found"

**Data source:** The `public-snapshot` scan results (already captured in Phase 2).

**Implementation:**
```javascript
// In applyResponse or handleWizardContinue, after steps 3 and 6:
if (currentStep === 3 || currentStep === 6) {
  // Fetch pre-computed scan findings from the snapshot
  const findings = await apiClient.get('/snapshot/findings');
  setInterstitialFindings(findings.data);
  setShowInterstitial(true); // Show for 5 seconds or until "Continue"
}
```

**Content rules (anti-fabrication):**
- Every item must come from the actual scan (found pages, detected tools, review count)
- Each item has a "How we found this" tooltip (source: "Public website crawl")
- NO invented percentages. NO "73% of similar businesses..." unless computed from BIQc's own dataset.

### Step 5.3: Emotional Acknowledgments

**File:** `/app/frontend/src/hooks/useCalibrationState.js` (edge function prompts)

Replace functional acknowledgments with contextual affirmations:

| Current | Proposed |
|---|---|
| "Got it." | "Great — this helps BIQc detect relevant threats earlier." |
| "Noted." | "Understood — we'll tune your monitoring priorities." |
| "Data-driven decision-making noted." | "Strong approach — BIQc will weight data signals highest for you." |

**Implementation:** Update the `calibration-psych` Supabase Edge Function system prompt to include instruction: "After acknowledging a user answer, always connect it to a specific BIQc capability that will be tuned. Never respond with just 'Got it' or 'Noted'."

### Step 5.4: Move Social Handles to Post-WOW

**File:** `/app/frontend/src/components/calibration/CalibrationComponents.js`

Remove the "Strategic Expansion — Add Social Handles" drawer from WelcomeHandshake.
Defer to after the WOW moment confirmation or the integration prompt step.

**Effort:** 24–40 hrs
**Dependencies:** Snapshot scan data available; Edge Function prompt update

---

## PHASE 6: WOW MOMENT UPGRADE (Weeks 4–5) — P1
**Scores targeted:** Emotional Activation 8→10, Strategic Differentiation 7→10

### Step 6.1: Delta Visualisation

**File:** `/app/frontend/src/components/calibration/WowSummary.js`

**Current:** Single-column profile review
**Proposed:** Two-column comparison:
- Left: "You told us" (user's calibration answers)
- Right: "BIQc found (public signals)" (scan-derived data)

Differences highlighted:
- Green "Added" tag: BIQc found something the user didn't mention
- Amber "Possible mismatch" tag: BIQc's finding differs from user's answer

**Data source:**
```javascript
// Compare user answers (from calibration) with scan findings (from public_snapshots)
const delta = computeDelta(userAnswers, scanFindings);
// delta = { added: [...], matches: [...], mismatches: [...] }
```

### Step 6.2: Competitive Context Module

Add a compact section: "Comparable businesses detected"

**Data source:** `deep-web-recon` Edge Function (already exists) + Perplexity API results.

Every inferred competitor is labelled "Inferred from public signals" with a "Verify" toggle. No unverifiable ranking claims.

### Step 6.3: Consequence Framing on Confirmation

Replace "Confirm" button with:
- Primary: "Confirm and start monitoring"
- Secondary: "Edit Snapshot"
- Below CTA: "Next: connect one tool to unlock full intelligence."

**Mockup:**
![WOW Delta Mockup](https://static.prod-images.emergentagent.com/jobs/86ec0e34-7ffe-44b2-90f0-644a3b011de5/images/3bc526bb0f115a5622266d282dd418d3722737167e5a8946d1d6aca042b5e5fc.png)

**Commentary:** The two-column delta view creates cognitive surprise ("how did it know that?"). Green/amber badges clearly distinguish AI-inferred from user-confirmed data. The consequence-framed CTA tells users exactly what happens next.

**Effort:** 28–45 hrs
**Dependencies:** Diff computation engine; scan data

---

## PHASE 7: INTEGRATION GATE (Weeks 3–5) — P0
**Scores targeted:** Retention 7→10, No Hurry 7→10

This is the **single highest-retention-impact change**. Currently, integrations are buried in navigation. This creates a mandatory (but skippable) step immediately after the WOW moment.

### Step 7.1: Integration Gate Page

**New file:** `/app/frontend/src/pages/IntegrationGate.js`
**New route:** `/onboarding/connect` (inserted between WOW confirm and dashboard)

**Behaviour:**
1. After WOW "Confirm and start monitoring" → route to `/onboarding/connect`
2. Shows 6 connector cards based on what's available:
   - Google Workspace (via existing Google OAuth)
   - Microsoft 365 (via existing Microsoft OAuth)
   - Xero (via Merge.dev — existing)
   - HubSpot (via Merge.dev — existing)
   - QuickBooks (via Merge.dev — existing)
   - Slack (via Merge.dev — existing)
3. Each card shows:
   - Connector icon + name
   - "What BIQc will access" (connector-specific scope list)
   - "What BIQc will never do" (connector-specific exclusions)
   - "Connect" button
4. "Skip for now" link at bottom with: "You'll see limited insights until a tool is connected."

### Step 7.2: Connector Scope Definitions

**New backend endpoint:** `GET /api/integrations/connectors/catalogue`

Returns catalogue of available connectors with scope descriptions:

```json
[
  {
    "id": "google_workspace",
    "name": "Google Workspace",
    "icon": "google",
    "accesses": ["Read-only email metadata", "Calendar events (read-only)"],
    "never_does": ["Send emails", "Delete events", "Access attachments"],
    "trust_statement": "Not used for training shared models",
    "oauth_provider": "google"
  },
  {
    "id": "xero",
    "name": "Xero",
    "icon": "xero",
    "accesses": ["Read-only financial reports", "Invoice metadata"],
    "never_does": ["Create invoices", "Modify transactions"],
    "trust_statement": "Not used for training shared models",
    "oauth_provider": "merge",
    "merge_category": "accounting"
  }
]
```

### Step 7.3: Integration Success + Coverage Delta

After successful OAuth:
```json
{
  "status": "connected",
  "capabilities_unlocked": ["email_threat_monitoring", "calendar_analysis"],
  "coverage_delta": 0.22
}
```

Show: "Integration connected. Now monitoring: {n} sources. Coverage: {old}% → {new}%"

### Step 7.4: Routing Update

**File:** `/app/frontend/src/hooks/useCalibrationState.js`

After WOW confirmation, instead of routing directly to `/advisor`:
```javascript
// In handleConfirmWow → triggerComplete flow:
// Instead of: window.location.href = '/advisor'
// Route to: window.location.href = '/onboarding/connect'
```

**File:** `/app/frontend/src/App.js`
```javascript
<Route path="/onboarding/connect" element={<ProtectedRoute><IntegrationGate /></ProtectedRoute>} />
```

**Mockup:**
![Integration Gate Mockup](https://static.prod-images.emergentagent.com/jobs/86ec0e34-7ffe-44b2-90f0-644a3b011de5/images/2e21cfa19fcc632e034f05b1268835ae39cbb94090ce9d3ca272bbccba4f418d.png)

**Commentary:** The integration gate shows 6 connectors with clear scope transparency. Each card explicitly states what BIQc accesses and what it never does. The trust block at the bottom reinforces data sovereignty. "Skip for now" exists but is de-emphasised with consequence text.

**Existing suppliers leveraged:**
- **Merge.dev** (existing) — Handles CRM, Accounting, HR integrations via unified API
- **Google OAuth** (existing) — Workspace integration
- **Microsoft OAuth** (existing) — M365 integration
- **Supabase Auth** (existing) — Session management

**Effort:** 50–90 hrs
**Dependencies:** OAuth configuration per connector; Merge.dev connector catalogue; Security review

---

## PHASE 8: DASHBOARD HANDOFF (Weeks 5–7) — P1
**Scores targeted:** Cognitive Respect 9→10, Retention 10→10

### Step 8.1: First Session Checklist

**File:** `/app/frontend/src/components/DashboardLayout.js`

Add a collapsible "Finish setup" docked panel for new users (visible until all tasks complete):

```
Finish setup (3 steps)
✓ Connect one tool          [Completed]
○ Review top 3 insights     [Start →]
○ Set your first standard   [Start →]
```

**Backend:** Track checklist state in `user_operator_profile.operator_profile.onboarding_checklist`:
```json
{
  "integration_connected": true,
  "insights_reviewed": false,
  "first_standard_set": false,
  "checklist_completed_at": null
}
```

### Step 8.2: Progressive Navigation

**File:** `/app/frontend/src/components/DashboardLayout.js`

For users where `onboarding_checklist.checklist_completed_at` is null, show reduced nav:
- Home (BIQc Insights)
- Actions (Force Memos)
- Integrations
- Security
- Help
- "Show all navigation →" toggle

Current 20+ items remain accessible but hidden behind toggle.

### Step 8.3: Plain-Language Glossary

**File:** `/app/frontend/src/components/DashboardLayout.js` + `AdvisorWatchtower.js`

Add grey subtitle synonyms to jargon terms:

| Term | Plain Label |
|---|---|
| Inevitabilities | Upcoming risks & opportunities |
| Priority Compression | Workload bottleneck risk |
| Opportunity Decay | Time-sensitive opportunities |
| Force Memos | Action alerts |

Add "Use plain labels" toggle (persisted in localStorage):
```javascript
const [plainLabels, setPlainLabels] = useState(
  localStorage.getItem('biqc_plain_labels') === 'true'
);
```

### Step 8.4: Next Best Action Module

**File:** `/app/frontend/src/pages/AdvisorWatchtower.js`

Add top-of-dashboard card: "Do this next (5 minutes)"

Shows exactly one recommended action (not a list) computed from:
- Unconnected integrations → "Connect email to unlock threat monitoring"
- Unreviewed insights → "Review your first force memo"
- Stale calibration → "Update your business goals"

### Step 8.5: Intelligence Completeness Indicator

**File:** `/app/frontend/src/pages/AdvisorWatchtower.js`

Coverage bar: "Monitoring coverage: {x}%"

Computed from:
```python
coverage = 0
if has_business_profile: coverage += 20
if has_calibration: coverage += 20  
if has_email_connected: coverage += 20
if has_crm_connected: coverage += 20
if has_accounting_connected: coverage += 20
```

**Mockup:**
![Dashboard First Session Mockup](https://static.prod-images.emergentagent.com/jobs/86ec0e34-7ffe-44b2-90f0-644a3b011de5/images/92de303255ff8edb792407ec19619359c49325d60dfb42bbbef7e60a56015577.png)

**Commentary:** The dashboard shows reduced navigation (6 items vs 20+), a docked setup checklist, a "Do this next" action card, and a coverage indicator. Jargon terms have plain-language subtitles. The user has a clear pathway instead of 20+ options.

**Effort:** 40–80 hrs
**Dependencies:** Feature flags; onboarding state tracking

---

## PHASE 9: TELEMETRY PIPELINE (Week 2 onwards) — P0
**Scores targeted:** All (measurement enables optimisation)

### Step 9.1: Telemetry Events Endpoint

**New file:** `/app/backend/routes/telemetry.py`

```python
@router.post("/telemetry/events")
async def track_events(request: Request, current_user: dict = Depends(get_current_user)):
    # Store events in Supabase
    # Privacy: NO raw content, emails, PII — only counts, timings, categorical flags
```

**New SQL table:**
```sql
CREATE TABLE onboarding_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    event_name TEXT NOT NULL,
    event_props JSONB DEFAULT '{}',
    client_ts TIMESTAMPTZ,
    server_ts TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_telemetry_user ON onboarding_telemetry(user_id);
CREATE INDEX idx_telemetry_event ON onboarding_telemetry(event_name);
```

### Step 9.2: Event Taxonomy

| Event | Trigger | Props |
|---|---|---|
| `cta_clicked` | Landing CTA click | `{cta, page}` |
| `snapshot_started` | Snapshot URL submitted | `{input_type}` |
| `snapshot_completed` | Snapshot scan done | `{duration_ms, signals_found}` |
| `account_created` | Registration complete | `{method}` |
| `privacy_handshake_opened` | Handshake modal shown | `{}` |
| `calibration_completed` | All 9 questions done | `{duration_ms}` |
| `wow_confirmed` | Snapshot confirmed | `{edited_fields_count}` |
| `integration_oauth_started` | Connect button clicked | `{connector}` |
| `integration_oauth_completed` | OAuth success | `{connector, duration_ms}` |
| `first_actionable_insight_rendered` | Dashboard insight shown | `{insight_type}` |

**Effort:** 16–30 hrs
**Dependencies:** Event taxonomy sign-off

---

## PHASE 10: SHAREABLE SNAPSHOT EXPORT (Weeks 7–8) — P2
**Scores targeted:** Strategic Differentiation 10→10

### Step 10.1: PDF Export

**New supplier evaluation:**
- **Option A: Puppeteer/Playwright** — Render React component to PDF server-side
- **Option B: React-PDF (@react-pdf/renderer)** — Generate PDF directly in frontend
- **Recommendation:** React-PDF for speed; Puppeteer for pixel-perfect fidelity

### Step 10.2: Share with Team

"Share with team" button generates a unique invite link that allows a colleague to view the Snapshot (read-only) and optionally create their own account.

**Effort:** 24–40 hrs

---

## COMPLETE ROLLOUT TIMELINE

```
Week 1:  Hero render fix + CTA clarity + social proof        [P0]
Week 2:  Registration simplification + Privacy handshake      [P0]
         Telemetry pipeline (parallel)                        [P0]
Week 3:  Snapshot modal + public-snapshot edge function       [P0]
Week 4:  Calibration micro-insights + emotional acks          [P1]
         WOW delta visualisation                              [P1]
Week 5:  Integration gate (OAuth framework)                   [P0]
Week 6:  Dashboard progressive nav + checklist                [P1]
Week 7:  Dashboard next-best-action + coverage indicator      [P1]
         Plain-language toggle                                [P1]
Week 8:  Shareable Snapshot export (PDF)                      [P2]
```

---

## SUPPLIER SUMMARY

| Supplier | Current/New | Usage | Phase |
|---|---|---|---|
| Supabase (Auth, DB, Edge Functions) | Existing | Auth, state, edge functions | All |
| OpenAI (via emergentintegrations) | Existing | Snapshot analysis, calibration AI | 2, 5, 6 |
| Perplexity API | Existing | Competitive intelligence | 2, 6 |
| Merge.dev | Existing | CRM/Accounting/HR integrations | 7 |
| Google OAuth | Existing | Google Workspace connector | 7 |
| Microsoft OAuth | Existing | M365 connector | 7 |
| **Firecrawl** | **NEW (evaluate)** | Website crawling for Snapshot | 2 |
| **React-PDF** | **NEW (evaluate)** | PDF Snapshot export | 10 |

**No new major vendors required.** The existing stack (Supabase + OpenAI + Perplexity + Merge.dev) covers 95% of the implementation. Firecrawl is the only new external dependency, and the existing `deep-web-recon` edge function may suffice.

---

## PROJECTED SCORE UPLIFT BY PHASE

| Phase | Dimension | Before | After | Evidence |
|---|---|---|---|---|
| 1 (Hero/CTA) | No Need | 5 | 7 | Value props above fold; clear CTA |
| 2 (Snapshot) | TTFV | 6 | 9 | Value in <20s, before signup |
| 2 (Snapshot) | No Need | 7 | 9 | Instant personalised insight |
| 3 (Registration) | Retention | 5 | 7 | 30-40% friction reduction |
| 4 (Privacy) | No Trust | 7 | 10 | Explicit, policy-driven claims |
| 5 (Calibration) | Emotional Activation | 4 | 8 | Micro-insights + validation |
| 6 (WOW Delta) | Emotional Activation | 8 | 10 | Delta surprise + competitor context |
| 7 (Integration) | Retention | 7 | 10 | Session-1 integration connection |
| 7 (Integration) | No Hurry | 5 | 10 | Consequence framing + value unlock |
| 8 (Dashboard) | Cognitive Respect | 6 | 10 | Progressive nav + plain labels |
| 9 (Telemetry) | All | — | — | Measurement enables continuous optimisation |

---

## RISK REGISTER

| Risk | Impact | Mitigation |
|---|---|---|
| Snapshot scan >20s latency | High | Cache common domains; timeout fallback to manual summary |
| Client logos unavailable | Medium | Use anonymised case studies with real outcomes |
| Privacy claims don't match architecture | Critical | Policy-flag system; Legal/Security sign-off gate |
| OAuth integration errors | High | Comprehensive error handling; retry with user guidance |
| A/B test insufficient sample | Medium | Run tests longer; use Bayesian methods for small samples |

---

## ACCEPTANCE CRITERIA FOR 10/10

Per the specification, "10/10" is defined operationally:

- [ ] **≥60%** of new users reach "first actionable insight" within one session
- [ ] **≥50%** connect at least one integration in session 1
- [ ] **≥80%** OAuth completion rate (of those who start)
- [ ] **<2%** report privacy concern via feedback
- [ ] Registration completion rate improves materially (A/B tested)
- [ ] TTFV ≤6 minutes median
- [ ] 30-day retention improves with statistically reliable lift
- [ ] 90-day retention improves with guardrails (no trust regressions)

---

*This is a proposal document. No code has been modified. All changes require feature-flagging, A/B testing with guardrails, and Security/Legal sign-off on privacy copy before production deployment.*
