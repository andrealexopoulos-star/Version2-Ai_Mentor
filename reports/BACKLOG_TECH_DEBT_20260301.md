# BIQc — Complete Backlog & Tech Debt Register
## As of 1 March 2026

---

## 🔴 CRITICAL (Blocking Users NOW)

### 1. Production Dashboard Blank Screen
- **Status**: BROKEN in production
- **Cause**: Backend returns 401 on `/api/calibration/status` → dashboard renders empty
- **Root cause**: Auth token from Supabase not accepted by FastAPI backend (JWT_SECRET mismatch or CORS)
- **Fix needed**: Verify JWT_SECRET in Azure/production matches Supabase project JWT secret
- **Code fix done**: 401 now fails-closed (redirects to calibration instead of blank screen)
- **Deploy needed**: YES — Save to GitHub, redeploy to production

### 2. Mobile Login Button Broken
- **Status**: BROKEN on mobile
- **Cause**: CSS mobile-reconstruction.css overrides make "Sign in" button render as tiny blue circle
- **Fix needed**: Scope button CSS override to exclude login/register forms

### 3. Console Errors (19 errors in production)
- **Status**: FIXED in code, NOT deployed
- **Fixes**: response.clone() for body stream, reduced console noise, 401 fail-closed
- **Deploy needed**: YES

---

## 🟠 HIGH PRIORITY (Affects Quality)

### 4. Extraction Prompt Instructs Hallucination
- **What**: `calibration-business-dna` Edge Function prompt says "make intelligent inferences"
- **Impact**: AI fabricates revenue range, customer count, team size when not found
- **Fix**: Change prompt to "If information not available, return null"
- **Where**: `supabase/functions/calibration-business-dna/index.ts` line ~85

### 5. Context Truncation at 8000 Characters
- **What**: Cognitive snapshot truncates all business context at 8000 chars via `substring(0, 8000)`
- **Impact**: CRM deals, emails, observations may be completely cut
- **Fix**: Implement priority-based context assembly (profile first, then deals, then emails)
- **Where**: `supabase/functions/biqc-insights-cognitive/index.ts`

### 6. SoundBoard Has No RAG/Vector Retrieval
- **What**: Chat sends flat text context to GPT-4o, no embeddings, no semantic search
- **Impact**: Generic responses, no cross-session memory, context window saturation at scale
- **Fix**: Implement Supabase pgvector for business context embeddings

### 7. Website Claims vs Actual Capabilities Gap (38 items)
- **Full report**: `/app/reports/WEBSITE_VS_CAPABILITY_AUDIT_20260227.md`
- **Top gaps**: Daily intelligence briefing (not built), automated corrective workflows (not built), 14-day trial (not implemented), invoice tracking (not built), staff utilisation (not built)

---

## 🟡 MEDIUM PRIORITY (Feature Completion)

### 8. Intelligence Spine Activation
- **Status**: SQL deployed, code deployed, NOT activated
- **Remaining**: Deploy `031-036` SQL migrations, enable spine, wait 14 days, validate
- **Blocks**: Deterministic Risk Baseline, probabilistic modelling

### 9. Stripe Checkout Wiring
- **Status**: Backend routes built, Subscribe page built
- **Remaining**: Deploy `029_payment_transactions.sql`, test with real Stripe key, verify webhook

### 10. DSEE Scan Timeout
- **What**: DSEE scans take 40-90 seconds, frontend timeout at 90s
- **Impact**: Some scans timeout for users
- **Fix**: Parallelize Serper API calls, add progress indicator

### 11. Deep Market Modeling Tabs Gated
- **What**: Saturation, Demand, Friction tabs need TierGate for free users
- **Status**: TierGate component exists but Market sub-tab gating not enforced

### 12. Competitor Classification Under SERP Fallback
- **What**: Bunnings misclassified as SingleLocation when using SERP fallback (403)
- **Fix**: Add SERP structural heuristics (store locator detection, multi-pin)

### 13. Mobile App (Expo React Native)
- **Status**: 6 screens built, NOT tested on device
- **Remaining**: Install on phone via Expo Go, test auth flow, test chat, App Store submission

---

## 🔵 LOW PRIORITY (Tech Debt)

### 14. CSS Tech Debt (13 files)
- `mobile-fixes.css` — has residual destructive rules
- `mobile-reconstruction.css` — new file, may conflict with mobile-fixes
- 13 total CSS files with overlap
- **Fix**: Consolidate into 2 files (global + mobile)

### 15. Legacy Page Cleanup (8+ pages)
- CognitiveV2Mockup, IntelCentre, OperatorDashboard — stub pages
- Website platform demo pages — contain removed synthetic data references
- **Fix**: Remove or archive unused pages

### 16. Python Backend Modules Still Active
- `contradiction_engine.py`, `pressure_calibration.py`, `evidence_freshness.py`, `silence_detection.py` — now replaced by SQL functions
- **Fix**: Remove Python modules, keep only SQL versions

### 17. Duplicate Supabase Secrets
- Audit found duplicate keys in Supabase secrets panel
- **Fix**: Consolidate in Supabase Dashboard

### 18. Edge Function Source Recovery
- `intelligence-snapshot` and `social-enrichment` deployed on Supabase but source not in git
- **Fix**: Export from Supabase Dashboard, add to repo

### 19. Temperature Settings Too High
- `boardroom-diagnosis`: 0.7 (should be 0.3-0.4 for diagnostics)
- `strategic-console-ai`: 0.7 (should be 0.4)
- `market-analysis-ai`: 0.6 (should be 0.3-0.4)
- **Fix**: Lower temperatures in Edge Function code

### 20. No Token Usage Tracking
- No Edge Function or backend route logs token consumption
- Cannot measure AI cost per user
- **Fix**: Add token counting to Intelligence Spine instrumentation

### 21. No Prompt Injection Protection
- User input goes directly to LLM in SoundBoard, Boardroom, Diagnosis
- **Fix**: Input sanitization layer before all LLM calls

---

## 📋 SQL MIGRATIONS NOT YET DEPLOYED

| Migration | Content | Status |
|-----------|---------|--------|
| `029_payment_transactions.sql` | Stripe payment tracking | NEEDS DEPLOY |
| `031_intelligence_spine_public.sql` | Spine tables + feature flags | NEEDS DEPLOY |
| `032_spine_hardening.sql` | Append-only governance, durable queue | NEEDS DEPLOY |
| `033_risk_baseline.sql` | Deterministic risk function v1 | NEEDS DEPLOY |
| `034_configurable_risk_weights.sql` | Industry weight configs | NEEDS DEPLOY |
| `035_risk_baseline_hardening.sql` | Backtest + industry codes | NEEDS DEPLOY |
| `036_risk_calibration_analytics.sql` | Distribution + dominance analytics | NEEDS DEPLOY |

---

## 📋 EDGE FUNCTIONS TO REDEPLOY

| Function | Change | Status |
|----------|--------|--------|
| `calibration-business-dna` | Fix extraction prompt (remove "make inferences") | NEEDS CHANGE + DEPLOY |
| `biqc-insights-cognitive` | Fix 8000 char truncation | NEEDS CHANGE + DEPLOY |
| `scrape-business-profile` | Already deployed | DONE |

---

## 📋 AZURE DEPLOYMENT

| Item | Status |
|------|--------|
| Dockerfile.backend | CREATED |
| Dockerfile.frontend | CREATED |
| docker-compose.yml | CREATED |
| deploy/azure-deploy.sh | CREATED |
| deploy/AZURE_GUIDE.md | CREATED |
| Actual Azure deployment | NOT DONE — user needs to run script |

---

## 📊 PLATFORM SCORES

| Metric | Score |
|--------|-------|
| Architecture Maturity | 9/10 |
| Feature Completeness | 6/10 |
| Production Stability | 4/10 (blank screen) |
| Mobile Quality | 7/10 |
| AI Quality | 5/10 (hallucination prompt) |
| Enterprise Defensibility | 7/10 |
| Cognitive Coverage | 74/100 |
| Technical Capability | 78/100 |
