# BIQc Forensic 10x Signup + Capability Audit
Date: 2026-03-20  
Target: `https://biqc.thestrategysquad.com`  
Branch Context: `origin/main` and working branch point to the same HEAD commit (`1e98a0d9` at audit time).

---

## A) 10x Test Account Sign-ups (Live Run) — Evidence and Scores

Run artifact:
- JSON result: `/workspace/.screenshots/run10x_20260320_093459/run10x_results.json`
- Screenshot bundle root: `/workspace/.screenshots/run10x_20260320_093459/`
- Total screenshots: 50 (5 per account)

Scoring scale:
- 10 = fully successful and robust UX
- 8-9 = successful with minor friction
- 6-7 = partially successful / degraded
- <=5 = failure / blocker

### Account-by-account forensic scoring

| Account | AU Business Website Used | Signup Score | Login Score | Onboarding Website Step Score | Screenshot Proof |
|---|---:|---:|---:|---:|---|
| `auto10x_20260320_093459_01@biqctest.io` | `qantas.com` | 9 | 9 | 8 | `account_01/01_register_page.png`, `account_01/02_register_submit_result.png`, `account_01/03_after_login.png`, `account_01/04_onboarding_landing.png`, `account_01/05_onboarding_website_step.png` |
| `auto10x_20260320_093459_02@biqctest.io` | `woolworths.com.au` | 9 | 9 | 8 | `account_02/01_register_page.png` ... `account_02/05_onboarding_website_step.png` |
| `auto10x_20260320_093459_03@biqctest.io` | `telstra.com.au` | 9 | 9 | 8 | `account_03/01_register_page.png` ... `account_03/05_onboarding_website_step.png` |
| `auto10x_20260320_093459_04@biqctest.io` | `commbank.com.au` | 9 | 9 | 8 | `account_04/01_register_page.png` ... `account_04/05_onboarding_website_step.png` |
| `auto10x_20260320_093459_05@biqctest.io` | `bunnings.com.au` | 9 | 9 | 8 | `account_05/01_register_page.png` ... `account_05/05_onboarding_website_step.png` |
| `auto10x_20260320_093459_06@biqctest.io` | `anz.com.au` | 9 | 9 | 8 | `account_06/01_register_page.png` ... `account_06/05_onboarding_website_step.png` |
| `auto10x_20260320_093459_07@biqctest.io` | `westpac.com.au` | 9 | 9 | 8 | `account_07/01_register_page.png` ... `account_07/05_onboarding_website_step.png` |
| `auto10x_20260320_093459_08@biqctest.io` | `seek.com.au` | 9 | 9 | 8 | `account_08/01_register_page.png` ... `account_08/05_onboarding_website_step.png` |
| `auto10x_20260320_093459_09@biqctest.io` | `atlassian.com` | 9 | 9 | 8 | `account_09/01_register_page.png` ... `account_09/05_onboarding_website_step.png` |
| `auto10x_20260320_093459_10@biqctest.io` | `jbhifi.com.au` | 9 | 9 | 8 | `account_10/01_register_page.png` ... `account_10/05_onboarding_website_step.png` |

#### Why these are not 10/10
- Signup (9/10): UX accepted all submissions and created usable accounts; to reach 10/10 add deterministic inline confirmation state (not just toast + redirect).
- Login (9/10): all accounts authenticated and reached an authenticated route; to reach 10/10 reduce route variability and ensure deterministic first destination.
- Onboarding website step (8/10): website step and detect action were reached for all 10; to reach 10/10 include explicit “enrichment success/failure” event with persisted status and user-visible diagnostics.

---

## B) Sign Pages and Subpage Features — Itemized Scores

Evidence sources:
- Fresh run screenshots under `/workspace/.screenshots/run10x_20260320_093459/`
- Prior forensic screenshots under `/workspace/.screenshots/`

| Page / Feature | Score | Reason for Score | What is required for 10/10 | Screenshot Proof |
|---|---:|---|---|---|
| Login page load (`/login-supabase`) | 9 | Loads reliably and supports OAuth + email/password | Add explicit security headers on frontend HTML response too | `audit_p3_04_login_page.jpeg`, `account_01/03_after_login.png` |
| Login email/password auth | 9 | 10/10 accounts authenticated successfully | Add deterministic post-login route messaging and telemetry for failed bootstrap paths | `account_01/03_after_login.png` ... `account_10/03_after_login.png` |
| Login error handling | 8 | Inline message exists and is visible in prior audits | Include localized codes and lockout countdown state persistence | `fa_app_landing.png` (from prior audit set) |
| Forgot password link presence | 9 | Verified present in prior forensic checks | Add tested success screenshot for reset email sent state in this run | `audit_p3_05_reset_password.jpeg` |
| Register page load (`/register-supabase`) | 9 | Loaded for all 10 account flows | Add field-level completion hints and stronger password policy meter | `account_01/01_register_page.png` |
| Register required fields behavior | 9 | All required fields accepted and submitted | Add structured validation per field (industry, company constraints) | `account_01/02_register_submit_result.png` |
| Register OAuth buttons visibility | 8 | Present and visible; OAuth path not executed in 10x run | Execute OAuth E2E with controlled sandbox accounts | `audit_p3_06_register.jpeg` |
| Reset password page (`/reset-password`) | 8 | UI present and functional in prior evidence | Add current-run screenshot evidence and token lifecycle verification | `audit_p3_05_reset_password.jpeg`, `audit_p3_05_reset_submitted.jpeg` |
| Onboarding entry route (`/onboarding`) | 8 | Accessible from authenticated accounts, page renders | Enforce deterministic entry guard messaging when calibration incomplete | `account_01/04_onboarding_landing.png` |
| Onboarding website input step | 8 | Website field reached and detect triggered for all 10 | Persist and expose detection result state + retry reason | `account_01/05_onboarding_website_step.png` ... `account_10/05_onboarding_website_step.png` |
| Onboarding progress/nav controls | 8 | Next flow works to website step | Add explicit step breadcrumbs + robust state recovery if API timeout | `account_01/04_onboarding_landing.png` |

---

## C) End-to-End Platform Capability (Pages, tabs, clickables, sections)

Evidence sources:
- `/workspace/.screenshots/*`
- `/workspace/test_reports/iteration_131.json`, `iteration_143.json`, `iteration_144.json`, `iteration_148.json`, `iteration_151.json`, `iteration_152.json`, `iteration_153.json`, `iteration_154.json`

| Page / Feature | Score | Reason for Score | What is required for 10/10 | Screenshot Proof |
|---|---:|---|---|---|
| Homepage (`/`) hero + CTA | 9 | Strong visual + clear CTA flow | Add CSP/security headers on HTML and performance budget checks | `audit_p3_07_homepage.jpeg` |
| Public Integrations page (`/our-integrations`) | 9 | Filter chips/cards visible and coherent | Add pagination/perf telemetry and verified knowledge-base route consistency | `audit_p3_08_our_integrations.jpeg` |
| Advisor overview (`/advisor`) | 8 | Loads with business state, tabs, and fallback truth messaging | Eliminate remaining greeting/context sync issues under degraded states | `audit_02_advisor_overview.jpeg`, `forensic_advisor.jpeg` |
| Advisor tab: Money | 7 | Tab works but often blocked by integration state | Improve guided next actions and reconnection diagnostics | `audit_02_tab_money.jpeg` |
| Advisor tab: Revenue | 7 | Tab renders but placeholder/connect states common | Add cached sample insights when data missing + cleaner remediation CTA | `audit_02_tab_revenue.jpeg` |
| Advisor tab: Operations | 7 | Renders and routes but often low-data | Add data quality panel with exact missing sources | `audit_02_tab_operations.jpeg` |
| Advisor tab: People | 7 | Renders and supports panel navigation | Fix occasional state mismatch around email-connected indicators | `audit_02_tab_people.jpeg` |
| Advisor tab: Market | 8 | Functional with signal views | Improve saturation/demand confidence transparency and source lineage UI | `audit_02_tab_market.jpeg`, `audit_03_market_overview.jpeg` |
| Market subtab: Focus | 8 | Available and navigable | Add stronger user-facing interpretation and confidence context | `audit_03_market_focus.jpeg` |
| Market subtab: Saturation | 8 | Loads and displays fallback/analysis state | Show explicit dependency map when data unavailable | `audit_03_market_saturation.jpeg` |
| Market subtab: Demand | 8 | Works with tab switching and content state | Add richer trend compare period and export | `audit_03_market_demand.jpeg` |
| Market subtab: Friction | 8 | Accessible and renders state | Add concrete remediation paths tied to actions | `audit_03_market_friction.jpeg` |
| Market subtab: Reports | 8 | Tab is navigable and coherent | Add direct report generation quality checks | `audit_03_market_reports.jpeg` |
| Integrations page | 7 | Major crash fixed (iteration 148), still timing/truth banner inconsistencies reported in iteration 152 | Resolve connected-count race and truth-state banner visibility | `audit_p2_04_integrations_all.jpeg`, `audit_p2_04_integrations_connected.jpeg` |
| Email Inbox (`/email-inbox`) | 7 | Renders and controls present; historical 401 issues seen | Harden JWT propagation to priority analysis edge calls | `audit_p2_02_email_inbox.jpeg` |
| Calendar (`/calendar`) | 9 | Real events were validated in prior forensic runs | Add deterministic sync health and stale-data alerting | `audit_p2_03_calendar.jpeg`, `calendar_detailed.jpeg` |
| Actions (`/actions`) | 8 | Queue renders and cards actionable | Fully align resolution flags with live integration truth to avoid false positives | `audit_06_actions.jpeg`, `actions_detailed.jpeg` |
| Alerts (`/alerts`) | 8 | Stable and clear empty/active states | Add explainability links per alert source | `alerts_page.jpeg` |
| Automations (`/automations`) | 8 | Accessible and stable | Add richer automation opportunities with confidence and trigger provenance | `automations_page.jpeg` |
| Decisions (`/decisions`) | 8 | Stable and clear no-pending state | Add stronger transition into decision creation/assignment workflows | `decisions_detailed.jpeg` |
| Board Room (`/board-room`) | 9 | Diagnosis flows and shell validated; handoff behavior verified | Add deterministic SLA and historical diagnosis comparison controls | `audit_05_board_room.jpeg`, `boardroom_diagnosis_result.jpeg` |
| War Room (`/war-room`) | 6 | Historically unstable in some iterations (Edge function degraded paths) | Stabilize strategic-console-ai and improve error observability + fallback quality | `audit_04_war_room.jpeg`, `war_room_detailed.jpeg` |
| Reports (`/reports`) | 8 | Renders and report options are available | Add stronger report integrity metadata and generation status history | `audit_p2_11_reports.jpeg` |
| Settings (`/settings`) | 8 | Tabs load and page is stable | Improve calibration status diagnostics and settings save confirmation detail | `audit_p2_09_settings.jpeg` |
| Business DNA (`/business-profile`) | 8 | Form and fields load | Reduce initial loading latency and expose autosave status clearly | `business_dna_loaded.jpeg` |
| Data Health (`/data-health`) | 9 | Rich system/data quality surface and controls visible | Add source-level drilldowns and remediation runbooks inline | `audit_p2_07_data_health.jpeg`, `data_health_detailed.jpeg` |
| Forensic Audit (`/forensic-audit`) | 8 | Tooling is present and runnable | Add deterministic result schema scoring and export audit trail | `audit_p2_10_forensic.jpeg` |
| Exposure Scan (`/exposure-scan`) | 8 | Functional scan UI validated | Add transparent job state, retries, and source confidence card | `audit_p2_08_exposure_scan.jpeg` |
| Marketing Intelligence (`/marketing-intelligence`) | 8 | Page and flow validated | Add multi-competitor reproducibility score and scan lineage | `audit_p2_12_marketing_intelligence.jpeg` |
| Marketing Automation (`/marketing-automation`) | 8 | Tool page works and generated content flow exists | Add quality guardrails and anti-hallucination source locking | `marketing_automation_page.jpeg` |
| A/B Testing (`/ab-testing`) | 8 | Draft experiments visible and working | Add experiment lifecycle and statistical significance indicators | `ab_testing_page.jpeg` |
| Compliance (`/compliance`) | 8 | Page loads and baseline analysis visible | Add policy-source traceability and risk ownership assignment | `compliance_page.jpeg` |
| BIQc Legal (`/biqc-legal`) | 9 | Tabbed legal architecture verified in recent iterations | Add legal versioning/date stamps and downloadable bundles | `audit_p4_07_trust_dropdown.jpeg` + iteration 154 evidence |
| More Features (`/more-features`) | 8 | UX redesign verified; bug fixed in iteration 154 | Add deterministic back-button testid and waitlist field fidelity | iteration 154 evidence + `audit_p4_05_our_integrations.jpeg` |
| Upgrade / Foundation packaging | 9 | $349 package and route behavior verified in iterations 153/154 | Add checkout resilience tests + pricing copy consistency checks | iteration 153/154 evidence |

---

## D) Security Vulnerability Forensic Assessment — Scores and Fixes

Live probe evidence:
- API headers/auth checks executed on 2026-03-20 (local script output captured in terminal logs).

| Security Item | Score | Reason for Score | What is required for 10/10 |
|---|---:|---|---|
| HTTPS + HSTS on API | 9 | `Strict-Transport-Security` present on API | Add same strict policy at all HTML/static endpoints |
| Auth rejection on invalid login | 9 | `/api/auth/supabase/login` returns `401` with clear error | Add adaptive risk scoring + anomaly eventing |
| API security headers (CSP/XFO/nosniff) | 9 | Present on tested API endpoints | Expand defense headers consistently to frontend HTML routes |
| Frontend HTML response hardening | 6 | Tested HTML routes showed only `Server` header in quick probe | Add CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy to frontend responses |
| Session/auth flow resilience | 8 | 10x login flow succeeded and reached authenticated routes | Add explicit token lifecycle telemetry and automatic recovery UX |
| OAuth pathway robustness | 6 | Historical iterations flagged intermittent provider/config issues | Add environment validation gate before deployment + callback health checks |
| Integration truth-gate integrity | 8 | Iterations 151/152 confirm truth-state messaging and anti-fabrication controls | Fix integrations banner/count race to ensure UI and API truth are always aligned |
| Edge function deployment reliability | 5 | Iteration 147 showed deployment gap when CLI unavailable; production drift risk | Add guaranteed CI/CD deployment path + post-deploy smoke tests + rollback |
| Input handling robustness (frontend) | 7 | Iteration 146 found `.trim()` TypeError edge case in MySoundBoard | Enforce strict input normalization and type-safe guards in all send paths |
| Unauthorized file upload risk (historical code audit) | 5 | Prior dossier flags unprotected upload endpoint in monolith audit context | Enforce auth middleware + file-type restrictions + quota/virus scan on all upload paths |

---

## E) Last 10 Execution Chats (Iteration Artifacts) — Detailed Verification

Interpreted “last 10 chats” as latest 10 available iteration execution reports:
- `143, 144, 145, 146, 147, 148, 151, 152, 153, 154`

| Iteration | Score | Reason for Score | What is required for 10/10 | Evidence |
|---|---:|---|---|---|
| 143 | 8 | Sidebar/back-button/decision-card checks passed; live decision cards not visually validated due sync state | Add deterministic live-data replay fixture for visual verification | `/workspace/test_reports/iteration_143.json` |
| 144 | 9 | All 5 requested handoff/shell features passed | Add regression screenshots in same run artifact set and latency checks | `/workspace/test_reports/iteration_144.json` |
| 145 | 9 | Queue migration checks all passed, compile/import clean | Add production runtime queue observability and failure injection tests | `/workspace/test_reports/iteration_145.json` |
| 146 | 7 | Backend contracts passed; frontend partially blocked by admin access and MySoundBoard TypeError risk | Add admin test harness + fix `.trim()` edge case permanently | `/workspace/test_reports/iteration_146.json` |
| 147 | 6 | Correct code patch but deployment blocked; production behavior still failing | Introduce deploy-capable pipeline/credentials and mandatory post-deploy verification | `/workspace/test_reports/iteration_147.json` |
| 148 | 8 | Critical integrations crash fixed; free-tier pages validated | Remove remaining transient failures and improve loading behavior on DNA page | `/workspace/test_reports/iteration_148.json` |
| 151 | 9 | Truth-gate and anti-fabrication behavior verified strongly | Reduce slow endpoint response and add continuous truth-state UI contract tests | `/workspace/test_reports/iteration_151.json` |
| 152 | 8 | Truth-gate + auth route restoration passed; integrations UI count/banner mismatch remains | Fix state timing/race conditions and enforce UI/API truth synchronization tests | `/workspace/test_reports/iteration_152.json` |
| 153 | 9 | Launch packaging routes and paid plan behavior verified with strong pass rate | Add waitlist-specific UX fields and checkout reliability metrics | `/workspace/test_reports/iteration_153.json` |
| 154 | 9 | UX/UI redesign validated; MoreFeatures bug fixed | Finalize selector/testid consistency and expand automated detail-view regression tests | `/workspace/test_reports/iteration_154.json` |

---

## F) Documentation Audit — Itemized Scores

| Documentation Item | Score | Reason for Score | What is required for 10/10 | Evidence |
|---|---:|---|---|---|
| `README.md` | 1 | Contains only placeholder text (`# Here are your Instructions`) and does not describe product setup/promise | Replace with full product overview, setup, architecture, test credentials policy, deployment, troubleshooting | `/workspace/README.md` |
| `BIQC_TECHNICAL_DOSSIER.md` | 8 | Deep technical depth and risk mapping, but includes historical assumptions and broad claims that need freshness markers | Add generated-at/version stamps per section and validated “current state” markers | `/workspace/BIQC_TECHNICAL_DOSSIER.md` |
| `frontend/public/PRD.md` | 6 | Strong intent but contains stale credentials/tasks and mixed historical statuses | Split into “current release PRD” + archived history, remove stale secrets/credentials | `/workspace/frontend/public/PRD.md` |
| `reports/USER_JOURNEY_SIGNUP_TO_ADVISOR.md` | 8 | End-to-end user flow is detailed and useful | Align with current routing/feature flags and attach per-step test IDs + screenshot references | `/workspace/reports/USER_JOURNEY_SIGNUP_TO_ADVISOR.md` |
| `test_reports/qa_10accounts_20260311.md` | 7 | Valuable baseline but partially incomplete screenshot coverage in historical run | Update with fully complete 10/10 screenshot set and deterministic reproducibility script references | `/workspace/test_reports/qa_10accounts_20260311.md`, fresh run evidence |
| `test_reports/forensic_stabilisation_20260311.md` | 8 | Strong forensic structure and actionability | Refresh to remove code-verified-only sections by adding current production screenshot proof | `/workspace/test_reports/forensic_stabilisation_20260311.md` |

---

## G) Raw Screenshot Inventory Pointers (for immediate verification)

- Fresh 10x signup run: `/workspace/.screenshots/run10x_20260320_093459/`
- Prior full-platform forensic set: `/workspace/.screenshots/`
- Example high-value files:
  - `/workspace/.screenshots/audit_p3_04_login_page.jpeg`
  - `/workspace/.screenshots/audit_p3_05_reset_password.jpeg`
  - `/workspace/.screenshots/audit_p3_06_register.jpeg`
  - `/workspace/.screenshots/audit_02_advisor_overview.jpeg`
  - `/workspace/.screenshots/audit_03_market_overview.jpeg`
  - `/workspace/.screenshots/audit_04_war_room.jpeg`
  - `/workspace/.screenshots/audit_05_board_room.jpeg`
  - `/workspace/.screenshots/audit_p2_04_integrations_connected.jpeg`
  - `/workspace/.screenshots/audit_p2_07_data_health.jpeg`
  - `/workspace/.screenshots/audit_p2_11_reports.jpeg`

