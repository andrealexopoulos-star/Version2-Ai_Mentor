# BIQc Cognition Platform — Sprint Plan & Tech Debt Registry
## Feb 2026 | Priority: Trust → Intelligence → Revenue

---

## SPRINT 1: TRUST FOUNDATION (Parallel-Safe)
*Goal: Bulletproof identity, verification, and data integrity*

| # | Task | Type | Parallel? | Status |
|---|------|------|-----------|--------|
| 1.1 | Enhanced `calibration-business-dna` Edge Function — deterministic identity signal extraction (ABN, phone, address, socials, emails, geographic) | Edge Function | Independent | READY TO DEPLOY |
| 1.2 | `business-identity-lookup` Edge Function — ABR free API integration for ABN/name lookup | Edge Function | Independent | READY TO DEPLOY |
| 1.3 | Frontend ForensicIdentityCard with ABN lookup button + confidence scoring | Frontend | Independent | DONE |
| 1.4 | Flow reorder: Identity Verification BEFORE footprint scoring | Frontend | Independent | DONE |
| 1.5 | Snapshot CTA gating (hidden during ANALYZING, 3s delay after READY) | Frontend | Independent | DONE |
| 1.6 | Integration truth suppression layer (no CRM = no claims) | Frontend | Independent | DONE |
| 1.7 | Market page scroll fix | Frontend | Independent | DONE |
| 1.8 | Soundboard integration onboarding auto-message | Frontend | Independent | DONE |

**Deployment Steps for 1.1 + 1.2:**
```bash
# 1. Deploy enhanced calibration-business-dna
supabase functions deploy calibration-business-dna

# 2. Deploy new business-identity-lookup
supabase functions deploy business-identity-lookup

# 3. Set ABR GUID secret (register free at abr.business.gov.au/Tools/WebServices)
supabase secrets set ABR_GUID=your-guid-here
```

---

## SPRINT 2: INTELLIGENCE DEPTH (Parallel-Safe)
*Goal: Make the platform actually intelligent with real data queries*

| # | Task | Type | Parallel? | Depends On |
|---|------|------|-----------|------------|
| 2.1 | `query-integrations-data` Edge Function — Soundboard queries real integration data (Google Ads spend, leads, etc.) | Edge Function | Yes | Sprint 1 complete |
| 2.2 | Soundboard BNA Updates — Allow chat to update Business DNA with confirmation + snapshot refresh | Edge Function + Frontend | Yes | Sprint 1 complete |
| 2.3 | Google Ads Integration — Full OAuth flow + data feed | Edge Function + Frontend | Yes | Independent |
| 2.4 | Business Verification Score badge on dashboard header | Frontend | Yes | Sprint 1 complete |
| 2.5 | Supabase Security Audit — RLS policies review for all tables | SQL | Yes | Independent |

### 2.1 — Soundboard Integrated Queries
- New Edge Function: `query-integrations-data`
- Accepts natural language query + user context
- Routes to appropriate integration API (HubSpot CRM, Google Ads, email)
- Returns structured answer for Soundboard to display
- Falls back to "Connect [integration] to answer this" if not connected

### 2.2 — Soundboard BNA Updates
- Chat detects intent to update business profile
- Shows confirmation card: "Update [field] to [value]?"
- On confirm: writes to `business_profiles` table
- Triggers cognitive snapshot refresh via `biqc-insights-cognitive`
- Shows "Profile updated. Snapshot refreshing..." feedback

### 2.3 — Google Ads Integration
- OAuth 2.0 flow via Supabase Edge Function
- Store refresh token in `integration_accounts` table
- Data pull: campaign spend, clicks, impressions, conversions
- Feed into `observation_events` for cognitive engine consumption
- Display connection status on Market page channels grid

### 2.4 — Business Verification Score Badge
- Small badge in dashboard header showing identity confidence
- Color-coded: green (High), amber (Medium), red (Low)
- Click opens: "Improve your score: connect CRM, verify ABN, add address"
- Drives integration adoption

### 2.5 — Supabase Security Audit
- Review RLS policies on all tables
- Ensure user_id scoping on all queries
- Review Edge Function auth patterns
- Check for missing policies on new tables

---

## SPRINT 3: REVENUE & MONETISATION (Sequential)
*Goal: Gate premium features behind Stripe paywall*

| # | Task | Type | Parallel? | Depends On |
|---|------|------|-----------|------------|
| 3.1 | Stripe integration — Payment flow for Pro plan | Edge Function + Frontend | No | Sprint 2 complete |
| 3.2 | Feature gating — Forensic Calibration behind paywall | Frontend | No | 3.1 |
| 3.3 | Feature gating — Executive Strategic Brief behind paywall | Frontend | No | 3.1 |
| 3.4 | Subscription management — Cancel, upgrade, downgrade | Edge Function + Frontend | No | 3.1 |

### Stripe Implementation Plan:
- Test key available in pod environment
- Create `stripe-checkout` Edge Function for session creation
- Create `stripe-webhook` Edge Function for event handling
- Store subscription status in `user_subscriptions` table
- Frontend checks subscription before rendering premium features
- Show upgrade CTA with clear value proposition

---

## SPRINT 4: PLATFORM PERFORMANCE (Parallel-Safe)
*Goal: Complete backend migration and auto-refresh*

| # | Task | Type | Parallel? |
|---|------|------|-----------|
| 4.1 | Migrate `merge_emission_layer.py` → SQL function | SQL | Yes |
| 4.2 | Migrate `watchtower_engine.py` → SQL function | SQL | Yes |
| 4.3 | Migrate `silence_detection.py` → SQL function | SQL | Yes |
| 4.4 | SQL Triggers: auto-refresh snapshots on integration connect | SQL | Yes |
| 4.5 | SQL Triggers: auto-refresh on calibration complete | SQL | Yes |
| 4.6 | Real Channel APIs: Meta Ads via Merge.dev | Edge Function | Yes |
| 4.7 | Real Channel APIs: LinkedIn via direct API | Edge Function | Yes |
| 4.8 | Real Channel APIs: GA4 via direct API | Edge Function | Yes |

---

## SPRINT 5: TECH DEBT & CLEANUP (Parallel-Safe)
*Goal: Clean, maintainable, production-ready codebase*

| # | Task | Type | Parallel? |
|---|------|------|-----------|
| 5.1 | CSS Consolidation: 13 files → `index.css` + `mobile.css` | Frontend | Yes |
| 5.2 | Legacy page cleanup: remove 8+ superseded pages | Frontend | Yes |
| 5.3 | Recover missing Edge Functions: `intelligence-snapshot`, `social-enrichment` | Edge Function | Yes |
| 5.4 | Consolidate duplicate Supabase secrets | Config | Yes |
| 5.5 | Add missing Merge.dev webhook handler route | Edge Function | Yes |
| 5.6 | Consolidate CRM_TERMS to shared constants (done) | Frontend | DONE |

---

## INTELLIGENCE ENHANCEMENT IDEAS (Backlog)

### Data Quality & Trust
- [ ] **Cross-reference ABN with ASIC** — Verify company registration status
- [ ] **Domain age & WHOIS lookup** — Add domain registration date as trust signal
- [ ] **Google Business Profile verification** — Confirm GBP listing matches identity
- [ ] **SSL certificate check** — Verify website security for trust scoring

### Cognitive Engine Upgrades
- [ ] **Multi-source contradiction detection** — Flag when different integrations report conflicting data
- [ ] **Predictive decay modelling** — Forecast when data freshness will drop below threshold
- [ ] **Competitor monitoring webhooks** — Alert when competitor's digital footprint changes
- [ ] **Seasonal trend detection** — Identify cyclical patterns in business metrics
- [ ] **Goal trajectory projection** — Show "at current pace, you'll hit goal by [date]"

### User Experience
- [ ] **Smart onboarding prompts** — Suggest next integration based on data gaps
- [ ] **Weekly intelligence digest email** — Auto-generated executive summary
- [ ] **Custom alert thresholds** — Let users set their own warning levels
- [ ] **Mobile push notifications** — Critical alerts via PWA
- [ ] **Shareable intelligence reports** — PDF export with branding

### Platform Scale
- [ ] **Multi-workspace support** — Agency mode for managing multiple SMBs
- [ ] **White-label options** — Custom branding for agency partners
- [ ] **API access for Pro users** — Programmatic access to cognitive data
- [ ] **Webhook integrations** — Push events to external systems (Slack, Zapier)

---

## DEPLOYMENT CHECKLIST

### Edge Functions Ready to Deploy:
1. `calibration-business-dna` (enhanced) — `/app/supabase/functions/calibration-business-dna/index.ts`
2. `business-identity-lookup` (new) — `/app/supabase/functions/business-identity-lookup/index.ts`

### Required Secrets:
- `ABR_GUID` — Free registration at https://abr.business.gov.au/Tools/WebServices (allow up to 5 days for approval)

### No New SQL Migrations Required
All changes are Edge Function + Frontend only.
