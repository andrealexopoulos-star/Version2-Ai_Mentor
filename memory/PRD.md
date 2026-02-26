# BIQc Platform — Complete Backlog, Tech Debt & Next Agent Handoff
## Updated: 2026-02-25

---

## CRITICAL: PRODUCTION DOMAIN LOCK
**The next agent MUST fork to: `biqc.thestrategysquad.com`**
- Preview URL is NOT production
- All testing must validate against production domain
- All deployment must target production
- Supabase project: `uxyqpdfftxpkzeppqtvk`

---

## SECTION 1: PRIORITISED BACKLOG

### P0 — Revenue Enablement
| # | Item | Effort | Status |
|---|---|---|---|
| 1 | **Stripe Paid Gating** — Feature-gate Forensic Calibration + Strategic Brief behind Stripe payment. Test key available in pod environment. | 4hrs | NOT STARTED |
| 2 | **Free Plan Boundary Enforcement** — Free: Market & Positioning, Email, 1 channel, Landing Page Generator (generate/preview/export only). No hosting/publishing/campaign. | 2hrs | PARTIALLY DONE (UI gating exists for forensic, needs Stripe) |

### P1 — Core Intelligence
| # | Item | Effort | Status |
|---|---|---|---|
| 3 | **Soundboard Integrated Queries** — Edge Function `query-integrations-data` for real YoY queries (Google Ads spend, leads, monthly comparisons). Returns numeric values + source + confidence. | 3hrs | NOT STARTED |
| 4 | **Soundboard BNA Updates** — Detect update intent in chat, show confirmation, write to business_profiles, trigger snapshot refresh. | 2hrs | NOT STARTED |
| 5 | **Desktop Soundboard Console** — Right-panel full-height persistent console on desktop. Layout ready (flex container in DashboardLayout), needs content component with session history + active conversation. | 3hrs | LAYOUT READY, CONTENT NOT BUILT |
| 6 | **Google Ads Integration** — Wire Google Ads API (Merge.dev or direct OAuth). User creating connection. | 3hrs | WAITING ON USER |

### P2 — Platform Depth
| # | Item | Effort | Status |
|---|---|---|---|
| 7 | **SQL Triggers for Auto-Refresh** — `on_integration_connect`, `on_calibration_complete`, `on_profile_update` → invalidate snapshot, trigger regeneration. | 2hrs | NOT STARTED |
| 8 | **Merge Emission Layer → SQL + pg_cron** — Replace merge_emission_layer.py (699 lines) with SQL functions + scheduled job. 11 signal types. | 4hrs | NOT STARTED |
| 9 | **Silence Detection → SQL** — Replace silence_detection.py (371 lines) | 2hrs | NOT STARTED |
| 10 | **Watchtower Engine → SQL** — Replace watchtower_engine.py (621 lines) | 4hrs | NOT STARTED |
| 11 | **Real Channel APIs** — Meta Ads, LinkedIn, GA4, Email Platform via Merge.dev | 8hrs+ | SHELLS ONLY |
| 12 | **Email Notification System** — Notify on critical state changes (DRIFT→CRITICAL, blindside risk) | 3hrs | NOT STARTED |

### P3 — Consolidation & Quality
| # | Item | Effort | Status |
|---|---|---|---|
| 13 | **Delete 5 Dead CSS Files** — 1,099 lines of unused CSS | 15min | NOT STARTED |
| 14 | **Delete 8 Legacy Pages** — Superseded by Liquid Steel pages | 1hr | NOT STARTED |
| 15 | **Python Engine Deprecation** — Remove 4 engines after dual-run validation (1,016 lines) | 1hr | SQL DEPLOYED, PYTHON STILL ACTIVE |
| 16 | **Settings Page CSS Vars** — 38 legacy var(--) references → Liquid Steel hardcoded values | 1hr | PARTIALLY DONE |
| 17 | **WCAG Color Contrast** — #64748B → #8494A7 for 4.5:1 ratio | 1hr | NOT STARTED |
| 18 | **Password Reset Email Branding** — Custom Supabase email template with BIQc branding | 1hr | NOT STARTED |
| 19 | **Tutorial Modal Styling** — Already fixed to dark theme. Persistence fixed. Verify on production. | 30min | DONE, NEEDS PROD VERIFY |
| 20 | **Service Worker PWA Caching** — Validate offline behaviour for installed app | 2hrs | NOT STARTED |

---

## SECTION 2: TECH DEBT

### Critical Tech Debt
| # | Debt | Risk | Lines Affected |
|---|---|---|---|
| 1 | **8 Python engines still running alongside SQL functions** — Dual execution path. Python not yet deprecated. | Divergence risk if Python and SQL produce different results | 3,041 lines |
| 2 | **3 Edge Functions deployed without source in git** — email_priority, intelligence-snapshot, social-enrichment. Cannot redeploy if lost. | Stability risk — unrecoverable if Supabase resets | UNKNOWN |
| 3 | **5 dead CSS files** — Not imported anywhere, 1,099 lines of dead code | Bundle bloat, confusion | 1,099 lines |
| 4 | **8 legacy pages** — Superseded but still in routes, importable | Confusion, dead code | ~2,000 lines |
| 5 | **Settings page uses 38 old CSS variables** — Works because vars defined in index.css, but inconsistent with Liquid Steel hardcoded approach | Visual inconsistency risk | 38 references |
| 6 | **useCalibrationState.js — 440+ lines** — Complex state machine, source of recurring bugs | Bug recurrence | 440 lines |
| 7 | **Snapshot agent (Python) still exists** — Redundant with biqc-insights-cognitive Edge Function | Dual execution | 334 lines |

### Moderate Tech Debt
| # | Debt | Risk |
|---|---|---|
| 8 | **Missing webhook handler for Merge.dev** — Secret exists, no route handles events | Missed integration events |
| 9 | **Duplicate Supabase secrets** — Audit found duplicates | Confusion |
| 10 | **App.js warmup still calls biqc-insights-cognitive** — Now returns 200 but still unnecessary alongside warm-cognitive-engine | Wasted request |
| 11 | **MiniChart component in RevenuePage** — Unused after demo data removal | Dead code |
| 12 | **13 CSS files total** — Should be 2 (index.css + mobile.css) | Maintenance burden |

---

## SECTION 3: MOBILE APP MIGRATION PRIORITIES

### Phase 1 — Real Device Validation (IMMEDIATE)
| # | Item | What | Status |
|---|---|---|---|
| 1 | Test bottom nav on real Android | MobileNav component exists (lg:hidden), needs real device verify | BUILT, UNTESTED ON DEVICE |
| 2 | Test soundboard modal on real Android | Full-screen with keyboard viewport listener | BUILT, UNTESTED |
| 3 | Test PWA install + splash screen | Manifest updated (BIQc, #0F1720 theme) | UPDATED, UNTESTED |
| 4 | Test OAuth on mobile browser | Redirect-based (not popup) | BUILT, UNTESTED |
| 5 | Test password reset on mobile | Reset page exists | BUILT, UNTESTED |

### Phase 2 — Mobile Performance
| # | Item | What |
|---|---|---|
| 6 | useSnapshot cached-first with 5s timeout | IMPLEMENTED — verify on 4G |
| 7 | Parallelized Market page (Promise.allSettled) | IMPLEMENTED |
| 8 | Edge Function warm-cognitive-engine | DEPLOYED |
| 9 | Reduce Insights first-load to <5s p95 | IMPLEMENTED (fast path via /api/snapshot/latest) |

### Phase 3 — Mobile UX Polish
| # | Item | What |
|---|---|---|
| 10 | Safe area handling | CSS env(safe-area-inset-bottom) ADDED |
| 11 | Reduced motion support | @media prefers-reduced-motion ADDED |
| 12 | 44px touch targets | Global CSS enforcement ADDED |
| 13 | Scrollbar-hide on tabs | ADDED |
| 14 | Font minimum 11px on mobile | Global CSS ADDED |

### Phase 4 — Mobile Push + Offline
| # | Item | What |
|---|---|---|
| 15 | PWA push notifications for critical alerts | NOT STARTED |
| 16 | Offline snapshot cache via Service Worker | NOT STARTED |
| 17 | Background sync for integration data | NOT STARTED |

---

## SECTION 4: SUPABASE SECURITY AUDIT (REQUIRED)

### RLS Status
| Table | RLS Enabled | Policies | Status |
|---|---|---|---|
| contradiction_memory | YES | service_role + user read | COMPLIANT |
| decision_pressure | YES | service_role + user read | COMPLIANT |
| evidence_freshness | YES | service_role + user read | COMPLIANT |
| escalation_memory | YES | service_role + user read | COMPLIANT |
| observation_events | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| watchtower_insights | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| intelligence_snapshots | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| business_profiles | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| user_operator_profile | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| strategic_console_state | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| email_connections | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| outlook_emails | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| chat_history | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| soundboard_conversations | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| accounts | UNKNOWN | UNKNOWN | AUDIT NEEDED |
| users | UNKNOWN | UNKNOWN | AUDIT NEEDED |

### Required Audit Actions
1. Run `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` to get full RLS status
2. For each table without RLS: enable and add service_role + authenticated user policies
3. Verify no cross-tenant data exposure via RLS bypass
4. Verify service_role key not exposed in frontend (it's in backend .env only — CONFIRM)
5. Audit Edge Function token validation (all use supabase.auth.getUser())

### Edge Function Security Review
| Function | Auth Check | Writes DB | RLS Safe | Status |
|---|---|---|---|---|
| biqc-insights-cognitive | YES (getUser) | YES (snapshots) | Uses service_role | REVIEW |
| calibration-business-dna | YES (getUser) | YES (business_profiles) | Uses service_role | REVIEW |
| calibration-psych | YES (getUser) | YES | Uses service_role | REVIEW |
| warm-cognitive-engine | NO (warmup only) | NO | N/A | SAFE |
| boardroom-diagnosis | YES | YES | Uses service_role | REVIEW |
| competitor-monitor | YES | UNKNOWN | UNKNOWN | REVIEW |
| cfo-cash-analysis | YES | UNKNOWN | UNKNOWN | REVIEW |
| market-analysis-ai | YES | UNKNOWN | UNKNOWN | REVIEW |
| strategic-console-ai | YES | UNKNOWN | UNKNOWN | REVIEW |
| email_priority | NO SOURCE IN GIT | UNKNOWN | UNKNOWN | CRITICAL — RECOVER SOURCE |
| intelligence-snapshot | NO SOURCE IN GIT | UNKNOWN | UNKNOWN | CRITICAL — RECOVER SOURCE |
| social-enrichment | NO SOURCE IN GIT | UNKNOWN | UNKNOWN | CRITICAL — RECOVER SOURCE |

### Secrets Audit
- Verify all Supabase secrets match between Edge Functions and backend .env
- Verify no secret exposed in frontend code (search for service_role_key in frontend/)
- Verify OPENAI_API_KEY, MERGE_API_KEY, PERPLEXITY_API_KEY, FIRECRAWL_API_KEY all in Supabase secrets only

---

## SECTION 5: SQL FUNCTIONS DEPLOYED

| Function | Purpose | Table | Status |
|---|---|---|---|
| compute_market_risk_weight() | Aggregate risk scoring | N/A (returns JSON) | DEPLOYED + WIRED |
| detect_contradictions() | Misalignment detection | contradiction_memory | DEPLOYED + WIRED |
| calibrate_pressure() | Decision pressure scoring | decision_pressure | DEPLOYED + WIRED |
| decay_evidence() | Confidence decay | evidence_freshness | DEPLOYED + WIRED |
| update_escalation() | Risk persistence tracking | escalation_memory | DEPLOYED + WIRED |

All 5 called by biqc-insights-cognitive in order before LLM synthesis.

---

## SECTION 6: ARCHITECTURE INVARIANTS (DO NOT BREAK)

1. **Supabase-first** — All cognition in Edge Functions + SQL. FastAPI is routing/proxy only.
2. **Single cognition path** — biqc-insights-cognitive is the ONLY cognitive engine. No per-tab calls.
3. **Deterministic chain** — 5 SQL RPCs execute BEFORE every LLM call. Order is immutable.
4. **Frontend renders only** — No client-side scoring, probability calculation, or risk computation.
5. **Restricted zones** — ProtectedRoute.js (e37403cb) and SupabaseAuthContext.js (44fe02cf) MUST NOT be modified.
6. **No new tables** without explicit justification.
7. **No new /api/* backend endpoints** for cognition.
8. **channelsData** from /api/integrations/channels/status is canonical integration source.
9. **useSnapshot** is the single data source for all authenticated pages.

---

## SECTION 7: CREDENTIALS

- **User**: andre@thestrategysquad.com.au
- **Password**: BIQc_Test_2026!
- **Role**: superadmin
- **Supabase URL**: https://uxyqpdfftxpkzeppqtvk.supabase.co
- **Production domain**: biqc.thestrategysquad.com
