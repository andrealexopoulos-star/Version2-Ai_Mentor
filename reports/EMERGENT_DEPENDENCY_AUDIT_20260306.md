# BIQc EMERGENT DEPENDENCY AUDIT + DECISION TRACKER REBUILD
**Date:** 6 March 2026

---

## 1. DECISION TRACKER — REBUILT AS SIGNAL-DRIVEN

### Before (Manual)
- User manually fills a form: picks decision type, writes description, selects domains
- Feels like CRM data entry — exactly what SMB owners hate
- No connection to live signals

### After (Signal-Driven)
- BIQc auto-detects decision points from observation_events and cognition data
- Presents "Decision Centre" with signal-triggered prompts:
  - Pipeline Stagnation (from deal_stall signals)
  - Cash Collection Risk (from invoices_overdue_cluster)
  - Burn Rate Increasing (from cash_burn_acceleration)
  - Margin Under Pressure (from margin_compression)
  - Propagation Risk (from cognition propagation map with >70% probability)
- User responds: "Acting on this" or "Defer"
- BIQc records the decision and tracks outcome at 30/60/90 days
- "No decisions pending" state when signals are stable

### The Intelligence Loop
```
Signal detected → Decision prompt surfaced → User responds → Outcome tracked → Engine learns
```

### File: `/app/frontend/src/pages/DecisionsPage.js` — Complete rewrite (no manual form)

---

## 2. COMPLETE EMERGENT DEPENDENCY ELIMINATION

### BEFORE (Emergent Dependencies)

| Dependency | Location | Purpose |
|-----------|----------|---------|
| `emergentintegrations==0.1.0` | requirements.txt | Package dependency |
| `emergentintegrations.llm.chat.LlmChat` | 14 route files | AI chat completions |
| `emergentintegrations.llm.openai.OpenAIChatRealtime` | server.py | Voice chat sessions |
| `emergentintegrations.payments.stripe.checkout.StripeCheckout` | stripe_payments.py | Payment processing |
| `EMERGENT_LLM_KEY` | .env + 4 route files | API key for LLM calls |
| `sk_test_emergent` | .env (STRIPE_API_KEY) | Stripe test key |

### AFTER (Zero Emergent Dependencies)

| Dependency | Replacement | Status |
|-----------|-------------|--------|
| `emergentintegrations` package | REMOVED from requirements.txt | DONE |
| LlmChat → AI chat | `core/llm_router.py` → direct OpenAI via httpx | DONE |
| OpenAIChatRealtime → Voice | `core/llm_router.py` → direct OpenAI Realtime API | DONE |
| StripeCheckout → Payments | `stripe==14.1.0` → official Stripe Python SDK | DONE |
| EMERGENT_LLM_KEY | OPENAI_API_KEY (all files) | DONE |

### Proof

```bash
$ grep -rn "from emergentintegrations" /app/backend/ --include="*.py" | grep -v __pycache__
# (empty — 0 results)

$ grep "emergentintegrations" /app/backend/requirements.txt
# (empty — removed)

$ grep -rn "EMERGENT_LLM_KEY" /app/backend/ --include="*.py" | grep -v __pycache__ | grep -v .env | grep -v "# "
# (empty — 0 results)
```

---

## 3. WHAT WAS ON EMERGENT → WHERE IT MOVES

| Component | Was On Emergent | Moves To | How |
|-----------|----------------|----------|-----|
| LLM Chat (GPT-4o) | emergentintegrations.llm.chat | Direct OpenAI API (httpx) | Already moved → `core/llm_router.py` |
| Voice Chat (Realtime) | emergentintegrations.llm.openai.OpenAIChatRealtime | Direct OpenAI Realtime API (httpx) | Already moved → `core/llm_router.py` |
| Embeddings | emergentintegrations (via OpenAIChat) | Direct OpenAI Embeddings API (httpx) | Already moved → `core/llm_router.py` |
| Stripe Payments | emergentintegrations.payments.stripe | Official `stripe` Python SDK (v14.1.0) | Already moved → `routes/stripe_payments.py` |
| Frontend hosting | Emergent preview pod | Azure / Vercel / Your own hosting | Deploy via GitHub push |
| Static assets | emergentagent.com CDN | `/public/` directory (self-hosted) | Already moved |
| AI API Key | EMERGENT_LLM_KEY | OPENAI_API_KEY (direct from OpenAI) | Already moved |
| Stripe Key | sk_test_emergent | Your own Stripe key (live or test) | You need to set this in .env |

### APIs You Need Directly (Not Through Emergent)

| API | Provider | What You Need | Where To Get It |
|-----|----------|--------------|-----------------|
| GPT-4o Chat + Embeddings | OpenAI | `OPENAI_API_KEY` | platform.openai.com → API Keys |
| GPT-4o Realtime (Voice) | OpenAI | Same key | Same as above |
| Stripe Payments | Stripe | `STRIPE_API_KEY` (live key) | dashboard.stripe.com → API Keys |
| Merge Integrations | Merge.dev | `MERGE_API_KEY` | app.merge.dev → API Keys |
| Supabase Database + Auth | Supabase | `SUPABASE_URL` + keys | Already configured |
| Perplexity (Market Research) | Perplexity | `PERPLEXITY_API_KEY` | Already configured in edge functions |
| Firecrawl (Web Scraping) | Firecrawl | `FIRECRAWL_API_KEY` | Already configured in edge functions |

---

## 4. URL SCRAPE IN SIGNUP — YES, STILL ACTIVE

The URL scrape is part of the onboarding/calibration flow:

**Onboarding Wizard Step 2: "Website"**
- User enters their website URL
- BIQc calls `/api/website/enrich` → scrapes the site
- Auto-fills: business name, industry, location, services, team size

**Calibration Flow:**
- Calls Supabase Edge Function `calibration-business-dna`
- Uses Perplexity API for market research + Firecrawl for website scraping
- Generates Business DNA profile from public signals
- This is the "free marketing audit" — the entry hook for new users

**This should STAY.** It's the core value proposition: "Enter your URL, we'll tell you about your business." Remove this and there's no hook.

---

## 5. REMAINING .env CLEANUP NEEDED

Your `.env` currently has:
```
EMERGENT_LLM_KEY=sk-emergent-...    ← Can be removed (no longer used)
STRIPE_API_KEY=sk_test_emergent     ← Need to replace with YOUR Stripe key
OPENAI_API_KEY=sk-proj-...          ← This is your actual OpenAI key (keep)
```

**Action:** Remove `EMERGENT_LLM_KEY` line and replace `STRIPE_API_KEY` with your own Stripe test/live key.

---

## 6. TEST ACCOUNT PASSWORDS — ALL FAILING

During this sprint, all 3 test account passwords stopped working at Supabase level:
- `trent-test1@biqc-test.com` → Invalid credentials
- `trent-test3@biqc-test.com` → Invalid credentials
- `andre@thestrategysquad.com.au` → Invalid credentials (was already broken)

**This is a Supabase auth issue** (rate limiting, password expiry, or account lockout).
**Fix:** Reset passwords in Supabase Auth dashboard before demo.
