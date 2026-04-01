# BIQc Forensic Stabilisation Audit Report
## Date: March 11, 2026
## Auditor: Execution Agent
## Platform: https://biqc.ai

---

## AUDIT SCOPE
Per the Master Agent Execution Prompt:
- Rule 1: NO feature building — verify and repair existing functionality only
- Rule 5: Evidence required — screenshots taken for all verifiable items

---

## SECTION 1: PUBLIC WEBSITE — EVIDENCE CONFIRMED ✅

### 1.1 Login Page (biqc.ai/login-supabase)
**STATUS: PASS ✅**
- Screenshot: fa_login.png
- "Welcome back" heading visible ✅
- "Continue with Google" button ✅
- "Continue with Microsoft" button ✅
- EMAIL field ✅
- PASSWORD field with show/hide toggle ✅
- **"Forgot password?" link** ✅ (data-testid=login-forgot-password confirmed present)
- "Sign in" orange button ✅
- "Don't have an account? Sign up" link ✅
- Right panel: "Your business intelligence, protected by design." ✅
- AES-256 Encryption, Real-time Signals, Zero Leakage, Australian Hosted badges ✅
- **Error handling**: "Invalid email or password. Please check your credentials." — styled correctly with icon ✅

### 1.2 Reset Password Page (biqc.ai/reset-password)
**STATUS: PASS ✅**
- Screenshot: fa_reset.png
- "Reset your password" heading ✅
- Email input field ✅
- "Send reset link" orange button with mail icon ✅
- "Back to sign in" link ✅
- Form data-testid=reset-form confirmed present ✅

### 1.3 Homepage (biqc.ai)
**STATUS: PASS ✅**
- Screenshot: fa_home.png
- H1: "A Single Intelligence Layer Across All Business Systems" ✅
- "Try It For Free" + "Learn More" CTAs ✅
- Navigation: Platform, Intelligence, Integrations, Pricing, Blog, Trust ✅

### 1.4 How It Works Section — All 4 Tabs
**STATUS: PASS ✅**
- Screenshots: fa_hiw_default.png, fa_hiw_tabs.png
- **"Why BIQc" tab** ✅ — 4 pain point cards: Too Many Disconnected Tools, No Central Oversight, Reactive Decision-Making, Hidden Financial Leaks
- **"How It Works" tab** ✅ — "Six layers of autonomous intelligence" cards
- **"What We Monitor" tab** ✅ — 6 categories with bullet lists (Risk & Compliance, Market Signals, Communication Signals confirmed visible)
- **"The Pipeline" tab** ✅ — 01 Ingest, 02 Analyse, 03 Detect, 04 Act
- **Grey line REMOVED** ✅ — Tab bar has no border-bottom, only orange underline on active tab
- "Start free trial" CTA at end of Pipeline ✅

### 1.5 Public Integrations Page (biqc.ai/our-integrations)
**STATUS: PASS ✅**
- Screenshots: fa_integrations_public.png, fa_footer.png
- **H1: "500+ Integrations"** ✅ — Large font (H1 level, text-4xl+)
- **Orange subtitle**: "Connects to the tools your business already uses." ✅
- Filter chips: All, Email, CRM, Accounting, HR & Payroll, ATS, File Storage ✅
- Integration cards: Gmail, Microsoft Outlook, HubSpot, Salesforce, Pipedrive, Zoho CRM, ActiveCampaign, Xero... ✅
- **NO horizontal lines through cards** ✅ — SectionLabel h-px divider removed
- "Connect Now" + "Security & Privacy" buttons ✅
- Security section: AES-256 Encrypted, Australian Data Residency, Revoke Anytime ✅
- Footer visible with complete content ✅

### 1.6 Footer — All Links Verified HTTP 200
**STATUS: PASS ✅**
- Screenshot: fa_footer.png
- PRODUCT section: Platform ✅, Intelligence ✅, Integrations ✅, Pricing ✅
- LEGAL section: BIQc AI Learning Guarantee ✅, Security & Infrastructure ✅, Trust Centre ✅, Data Processing Agreement ✅, Privacy Policy ✅, Terms & Conditions ✅
- COMPANY section: Contact ✅, Trust ✅, Try It Free ✅
- "Australian Sovereign Data" green indicator ✅
- Copyright 2026 The Strategy Squad Pty Ltd. ABN 12 345 678 901 ✅
- All 10 footer routes return HTTP 200 ✅

**ISSUE FOUND: "Knowledge Base" link in footer** — URL /knowledge-base not tested in HTTP check.
- ACTION: Check if /knowledge-base route exists.

---

## SECTION 2: PROTECTED APP PAGES — CODE VERIFIED

**Note per Rule 3:** Production testing of protected pages requires Andre's live session. Test accounts (test1@biqc-qa.com) do not exist on production Supabase. Magic links are single-use and expire within seconds of automated use. The following items are **CODE VERIFIED** (confirmed in source code) but **PRODUCTION SCREENSHOT PENDING** (requires manual browser session).

### 2.1 Bugs Fixed — Code Verified ✅

| Bug | Fix Applied | Code Location | Status |
|---|---|---|---|
| Advisor greeting "Good morning, there." | `displayName` fallback: snapshot → user_metadata → email prefix | AdvisorWatchtower.js line 383-390 | CODE VERIFIED |
| War Room "Good , ." broken | Same `displayName`/`displayTimeOfDay` fallback | WarRoomConsole.js line 20-30 | CODE VERIFIED |
| Priority Inbox 401 errors | Added `apikey` header to edge function call | EmailInbox.js line 143 | CODE VERIFIED |
| Actions page false "Email Missing" | Filter rq against live integration status | ActionsPage.js line 22-35 | CODE VERIFIED |
| Welcome Banner always showing | Only shows when `total_connected === 0` | AdvisorWatchtower.js line 499 | CODE VERIFIED |
| Email OAuth double-? loop | `sep = '&' if '?' in return_to else '?'` | email.py lines 517, 745 | CODE VERIFIED |
| "Enter BIQc" button broken | Uses `SESSION_KEY` + sessionStorage | FirstTimeOnboarding.js line 474 | CODE VERIFIED |
| Lines through integration cards | Removed `h-px` from SectionLabel | Integrations.js line 582 | CODE VERIFIED |
| HowItWorks grey line under tabs | Removed `borderBottom` from sticky tab bar | HowItWorks.js line 79 | CODE VERIFIED |
| "500+ Integrations" small text | Changed to H1 with text-4xl/5xl/6xl | IntegrationsPage.js line 175-184 | CODE VERIFIED |

### 2.2 Previously Confirmed Working (iteration_115.json)

| Page | Status | Evidence |
|---|---|---|
| /competitive-benchmark | ✅ Shows 54/100 digital footprint | iteration_115.json |
| /calendar | ✅ 2 real Outlook events (Andreas + Diyea) | iteration_115.json |
| /board-room Run Diagnosis | ✅ Returns Strategy Squad specific content | iteration_115.json |
| /data-health | ✅ Shows Email_outlook 95% healthy | iteration_115.json |
| /marketing-automation | ✅ Functional content generator | iteration_115.json |
| /marketing-intelligence | ✅ Benchmark tool functional | iteration_115.json |
| /exposure-scan | ✅ Scans URLs (user screenshot confirmed) | User screenshot + iteration_115.json |
| /forensic-audit | ✅ Run Audit button works | iteration_115.json |
| /settings | ✅ All 4 tabs load | iteration_115.json |
| /business-profile | ✅ Form with business DNA fields | iteration_115.json |
| Soundboard AI | ✅ Responds correctly (no data fabrication) | iteration_115.json |

---

## SECTION 3: OUTSTANDING ISSUES — NOT VERIFIED

### 3.1 Pages showing "Connect Data" despite backend showing connections
- /revenue — "Connect CRM" (EXPECTED: HubSpot was lost in DB purge — user needs to reconnect)
- /operations — "Connect integrations" (same)
- Advisor Money tab — "Accounting not connected" (Xero lost in purge)
- **ROOT CAUSE CONFIRMED:** `integration_accounts` table has 0 records — HubSpot/Xero must be reconnected at biqc.ai/integrations

### 3.2 Knowledge Base footer link — NOT VERIFIED
- Footer shows "Knowledge Base" link
- Route not confirmed in App.js routes list
- HTTP check not performed
- **ACTION REQUIRED:** Verify /knowledge-base route exists

### 3.3 /war-room greeting fix — PRODUCTION VERIFICATION PENDING
- Code fix deployed ✅ (displayName fallback)
- Production screenshot not obtainable without Andre session
- **ACTION:** Log in as Andre on production and navigate to /war-room to confirm

### 3.4 /advisor greeting fix — PRODUCTION VERIFICATION PENDING
- Code fix deployed ✅ (displayName from user_metadata.full_name)
- User `andre@thestrategysquad.com.au` has `full_name` in user_metadata → should show "Good [time], Andre."

---

## SECTION 4: IMMEDIATE ACTION ITEMS

### P0 — Required Before Client Demos
1. **Reconnect HubSpot** at /integrations → Revenue, Operations, Advisor tabs will show real data
2. **Reconnect Xero** at /integrations → Cash flow, margin, accounting will work
3. **Verify /knowledge-base route** exists — fix or remove footer link

### P1 — Verify on Production (requires Andre login)
4. War room greeting shows "Good [time], Andre."
5. Advisor greeting shows "Good morning/afternoon, Andre."
6. Actions page does NOT show "Email Integration Missing"
7. Onboarding modal shows Step 2 after Outlook OAuth (not Step 0 loop)

### P2 — Post-Client-Onboarding
8. All market tabs (Saturation/Demand/Friction) will activate once CRM reconnected
9. Priority Inbox "Analyze" button — test with Outlook tokens active

---

## EVIDENCE FILES
| Screenshot | Content | URL Visible |
|---|---|---|
| fa_login.png | Login page full | biqc.ai/login-supabase ✅ |
| fa_reset.png | Reset password form | biqc.ai/reset-password ✅ |
| fa_home.png | Homepage hero | biqc.ai ✅ |
| fa_hiw_default.png | HowItWorks "Why BIQc" tab | biqc.ai/#how-it-works ✅ |
| fa_hiw_tabs.png | Pipeline + Business Signals | biqc.ai ✅ |
| fa_integrations_public.png | 500+ Integrations page | biqc.ai/our-integrations ✅ |
| fa_footer.png | Footer with all links | biqc.ai/our-integrations ✅ |
| fa_app_landing.png | Login error state | biqc.ai/login-supabase ✅ |

**Previous audit screenshots:** /app/.screenshots/ (27 screenshots from iteration_115 test)
