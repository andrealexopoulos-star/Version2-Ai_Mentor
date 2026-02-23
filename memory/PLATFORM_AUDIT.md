# BIQc Platform — Comprehensive End-to-End Audit
## Date: 2026-02-23 | Test Client: andre@thestrategysquad.com.au

---

## 1. ROUTE MAP (58 total routes)

### Public Website (15 routes) — ALL PASS
| Route | Page | Status |
|-------|------|--------|
| `/` | Homepage (Liquid Steel) | OK |
| `/platform` | Platform overview | OK |
| `/intelligence` | Intelligence overview | OK |
| `/our-integrations` | Integrations overview | OK |
| `/pricing` | Pricing | OK |
| `/trust` | Trust landing | OK |
| `/trust/terms` | Terms & Conditions | OK |
| `/trust/privacy` | Privacy Policy | OK |
| `/trust/dpa` | Data Processing Agreement | OK |
| `/trust/security` | Security & Infrastructure | OK |
| `/trust/centre` | Trust Centre | OK |
| `/contact` | Contact page | OK |
| `/login-supabase` | Login | OK |
| `/register-supabase` | Register | OK |
| `/auth/callback` | OAuth callback | OK |

### Authenticated Platform (20 routes in sidebar)
| Route | Page | Data Source | Status |
|-------|------|------------|--------|
| `/advisor` | BIQc Insights | Supabase Edge: biqc-insights-cognitive | LIVE |
| `/revenue` | Revenue Intelligence | Backend: /integrations/crm/deals + /accounting/summary | HYBRID (live + demo fallback) |
| `/operations` | Operations | Backend: /snapshot/latest | HYBRID |
| `/risk` | Risk Intelligence | Backend: /snapshot/latest | HYBRID |
| `/compliance` | Compliance | STATIC DEMO DATA | PLACEHOLDER |
| `/market` | Market Intelligence | Backend: /snapshot/latest | HYBRID |
| `/alerts` | Alert Centre | Backend: /intelligence/watchtower | HYBRID |
| `/email-inbox` | Priority Inbox | Backend: /email/priority-inbox | LIVE |
| `/actions` | Action Centre | STATIC DEMO DATA | PLACEHOLDER |
| `/automations` | Automations | STATIC DEMO DATA | PLACEHOLDER |
| `/integrations` | Integrations Setup | Backend: /integrations/merge/* + Edge emails | LIVE |
| `/data-health` | Data Health | Backend: /integrations/merge/connected + /intelligence/data-readiness | HYBRID |
| `/reports` | Reports | STATIC DEMO DATA | PLACEHOLDER |
| `/audit-log` | Audit Log | STATIC DEMO DATA | PLACEHOLDER |
| `/business-profile` | Business DNA | Backend: /business-profile/* | LIVE |
| `/settings` | Settings | Backend: /auth/supabase/me + /business-profile | LIVE |

### Legacy Routes (16 routes, not in sidebar)
| Route | Page | Status |
|-------|------|--------|
| `/oac` | Ops Advisory Centre | LIVE (legacy) |
| `/intel-centre` | Intel Centre | LIVE (legacy) |
| `/diagnosis` | Diagnosis | LIVE (Edge: boardroom-diagnosis) |
| `/analysis` | Analysis | LIVE (backend AI) |
| `/market-analysis` | Market Analysis | LIVE (backend AI) |
| `/sop-generator` | SOP Generator | LIVE (Edge: sop-generator) |
| `/data-center` | Data Center | LIVE (file management) |
| `/documents` | Documents | LIVE |
| `/connect-email` | Connect Email | LIVE (OAuth) |
| `/calendar` | Calendar | LIVE (Outlook calendar) |
| `/soundboard` | SoundBoard (full page) | LIVE (backend: /soundboard/chat) |
| `/watchtower` | Watchtower | LIVE (backend) |
| `/war-room` | War Room Console | LIVE (Edge: strategic-console-ai) |
| `/board-room` | Board Room | LIVE (backend AI) |
| `/intelligence-baseline` | Intelligence Baseline | LIVE |
| `/operator` | Operator Dashboard | LIVE |

### Demo/Preview Routes (11 routes, public)
| Route | Purpose |
|-------|---------|
| `/platform/login` | Demo login screen |
| `/platform/overview` | Demo exec overview |
| `/platform/revenue` | Demo revenue module |
| `/platform/alerts` | Demo alerts |
| `/platform/automations` | Demo automations |
| `/platform/integrations-demo` | Demo integrations |
| `/platform/industry/msp` | MSP industry view |
| `/platform/industry/construction` | Construction view |
| `/platform/industry/consulting` | Consulting view |
| `/platform/industry/agency` | Agency view |
| `/platform/industry/saas` | SaaS view |

---

## 2. ARCHITECTURE: SUPABASE vs EMERGENT

### Supabase Edge Functions (13 active + 1 duplicate)
| Function | AI Provider | Data Sources | Called By |
|----------|------------|--------------|----------|
| biqc-insights-cognitive | OpenAI + Perplexity | Merge CRM, Email, Business Profile | Frontend (useSnapshot) |
| calibration-psych | OpenAI (gpt-4o-mini) | User responses | Frontend (CalibrationAdvisor) |
| calibration-sync | OpenAI | Calibration data | Frontend (post-calibration) |
| calibration-business-dna | OpenAI + Firecrawl | Website URL | Frontend (calibration) |
| checkin-manager | None | Supabase DB | Frontend (CheckInAlerts) |
| strategic-console-ai | OpenAI + Perplexity | Merge + DB | Frontend (WarRoomConsole) |
| boardroom-diagnosis | OpenAI + Merge | CRM + DB | Frontend (Diagnosis) |
| intelligence-bridge | None | Supabase DB | System |
| watchtower-brain | OpenAI | Observation events | pg_cron |
| competitor-monitor | OpenAI + Perplexity | Web scraping | pg_cron |
| cfo-cash-analysis | OpenAI + Merge | Accounting data | pg_cron |
| market-analysis-ai | OpenAI + Firecrawl | Web data | pg_cron |
| sop-generator | OpenAI | User input | Frontend (SOPGenerator) |
| calibration_psych | DUPLICATE — should be deleted | | |

### Emergent Backend (FastAPI) — 120+ endpoints
| Category | Key Routes | AI Used |
|----------|-----------|---------|
| Soundboard | /soundboard/chat | OpenAI gpt-4o |
| Calibration | /calibration/* | OpenAI gpt-4o |
| Boardroom | /boardroom/respond | OpenAI gpt-4o |
| Research | /research/analyze-website | OpenAI gpt-4o |
| Email AI | /email/analyze-priority, /suggest-reply | OpenAI gpt-4o |
| Generation | /generate/sop, /action-plan, /checklist | OpenAI gpt-4o |
| Integrations | /integrations/* | Merge.dev API (no AI) |
| Auth | /auth/* | Supabase Auth (no AI) |
| Data | /business-profile/*, /data-center/* | Supabase DB (no AI) |
| Email Sync | /outlook/*, /gmail/* | Microsoft Graph / Google API |

---

## 3. LIVE DATA vs PLACEHOLDER DATA

### LIVE (from real integrations)
- **HubSpot CRM**: 30 contacts, 25 deals (via Merge.dev)
- **Outlook Email**: Synced emails, calendar events
- **Cognitive Engine**: AI-generated insights from all sources
- **Business Profile**: User-entered data from calibration
- **Soundboard**: Real AI conversations (OpenAI)

### PLACEHOLDER / DEMO DATA (hardcoded)
| Page | What's Fake |
|------|------------|
| `/actions` | 5 action items with pre-written email drafts |
| `/automations` | 8 automation workflows with run counts |
| `/compliance` | 96% compliance score, 5 obligations, 5 document statuses |
| `/reports` | 3 report cards, 6 report history items |
| `/audit-log` | 10 log entries with timestamps |
| `/revenue` | Churn signals (3 clients), monthly trend chart, deal velocity metrics |
| `/operations` | 3 bottlenecks, 5 SOP performance bars, 3 team members |
| `/risk` | Financial/operational/market risk items, 4 risk timeline events |
| `/market` | 4 competitor signals, 4 industry trends |

### FEATURES FROM INTEGRATIONS (what's real)
- **Revenue page**: Pipeline total, active deals, stalled count, win rate — from HubSpot
- **Data Health**: Connected system list, health scores — from Merge.dev connected status
- **Alerts**: Watchtower events — from backend intelligence engine
- **BIQc Insights**: Full cognitive analysis — from biqc-insights-cognitive Edge Function
- **Email Inbox**: Real emails with AI priority scoring — from Outlook/Gmail

---

## 4. TECH DEBT

### Critical
1. **calibration_psych** (underscore variant) is a duplicate Edge Function — DELETE IT
2. **5 un-versioned Edge Functions** on Supabase with no source in git: calibration-voice, intelligence-snapshot, rapid-task, signal-evaluator, social-enrichment
3. **Merge.dev webhook handler** missing — secret exists but no API route
4. **EMERGENT_LLM_KEY** in .env is unused — remove
5. **Xero data not in cognitive engine** — Edge Function needs financial data integration (code provided at /app/memory/EDGE_FUNCTION_FINANCIAL_DATA.js)

### Moderate
6. **60+ spinners** remain in legacy pages (action-initiated — Save, Submit buttons)
7. **16 legacy pages** accessible by URL but not in sidebar navigation
8. **Duplicate Azure/Microsoft secrets** in Supabase need consolidation
9. **Lottie dependency** removed from CognitiveLoadingScreen but package still in node_modules

### Low
10. **ESLint warnings** in 5 files (missing deps in useEffect/useMemo)
11. **Bundle size** 495KB gzipped — above recommended 200KB threshold
12. **CSS variables** mixed with inline styles — no single design token system

---

## 5. BACKLOG (Prioritised)

### P0 — Customer-Blocking
- Deploy Edge Function financial data code to Supabase
- Verify Xero data appears in cognitive engine after deployment

### P1 — Feature Completion
- Wire `/actions` to real email/SMS sending (Supabase Edge or backend)
- Wire `/automations` to real workflow engine
- Wire `/compliance` to document tracking in Supabase
- Wire `/reports` to real report generation (PDF export)
- Wire `/audit-log` to real activity tracking (Supabase audit table)
- Calibration: detect duplicate answers, adapt questions

### P2 — Platform Polish
- Industry-specific UI customization (menu/data based on selected industry)
- Consolidate 16 legacy pages (remove or integrate into new sidebar)
- Remove calibration_psych duplicate Edge Function
- Recover 5 un-versioned Edge Functions into git

### P3 — Technical
- Implement Merge.dev webhook handler
- Code splitting to reduce bundle size
- Consolidate design tokens (CSS vars vs inline styles)
- Add comprehensive error boundaries
