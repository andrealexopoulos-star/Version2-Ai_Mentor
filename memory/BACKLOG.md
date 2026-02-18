# BIQc Platform — Full Technical Debt & Backlog

## Last Updated: 18 Feb 2026

---

## P0 — CRITICAL (Blocking Production)

### Deploy to Production
- All code changes are in preview instance only
- Calibration column fixes, OAuth redirect fixes, snapshot engine, admin console — all need deployment
- **Action:** Save to GitHub → Deploy

### Calibration Redirect Loop (Production)
- Code writes to non-existent columns (`calibration_status`, `calibration_completed_at`)
- Fixed in preview code but NOT deployed to production
- Current workaround: manual SQL to unstick users
- **Fix is in:** calibration.py column remapping

### audit_business_profiles Trigger
- User has disabled and re-enabled with fixed function
- Verify it works on production after deployment
- **Risk:** If trigger reverts, ALL business_profiles writes fail silently

---

## P1 — HIGH PRIORITY

### Cost Tracking per User
- Need `usage_tracking` Supabase table
- Log every Edge Function call, OpenAI tokens, Firecrawl searches, Merge.dev API calls
- Show per-user cost in Admin Console
- Requires redeploying all 6 Edge Functions with tracking calls
- **Table schema needed:**
  ```
  usage_tracking: id, user_id, function_name, provider (openai/firecrawl/merge), 
  tokens_used, cost_estimate, created_at
  ```

### User Suspend Function
- Add `is_suspended` column to users table (or use existing field)
- Frontend: check on login, redirect to "Account suspended" screen
- Admin Console: toggle button per user
- **Backend:** Add middleware check in `get_current_user`

### User Impersonation
- Admin clicks "View as user" → frontend switches to that user's data
- Banner: "Viewing as [user] — Exit"
- Store impersonated user_id in session/localStorage
- All API calls pass impersonated user_id
- **Security:** Only superadmin can impersonate

### Deploy Edge Functions
- `calibration-business-dna` — NOT deployed yet (auto-fills Business DNA from website)
- `market-analysis-ai` — deployed but needs parallel fetch optimization
- **Action:** User deploys from code provided in chat

### Wire Market Analysis Page
- Frontend `/market-analysis` page exists but calls old Python backend
- Needs rewiring to call `market-analysis-ai` Edge Function
- User inputs product/service + region → SWOT analysis

---

## P2 — MEDIUM PRIORITY

### profile.py Decomposition (1,917 lines)
- Largest file in codebase — tech debt
- Should split into:
  - `routes/business_profile.py` — CRUD operations
  - `routes/scoring.py` — business score calculations (partially done → `core/scoring.py`)
  - `routes/oac.py` — OAC recommendations
  - `routes/notifications.py` — dismissed notifications
- **Risk:** Breaking changes if not careful

### email.py Cleanup (1,855 lines)
- OAuth flows for Outlook + Gmail
- Email sync, priority analysis
- Should split into:
  - `routes/email_auth.py` — OAuth flows
  - `routes/email_sync.py` — sync and analysis

### Pages with No AI/Edge Binding
These pages exist but don't use the cognitive layer:
| Page | Current State | Should Do |
|------|--------------|-----------|
| SoundBoard | Basic chat | Connect to strategic-console-ai for context-aware conversations |
| Operator View | Static | Read from snapshot for operational overview |
| Calendar | Basic | Parse calendar for decision windows, meeting load analysis |
| Intel Centre | Score display | Should aggregate all signal data from snapshot |
| SOP Generator | Form-based | Could use AI to generate SOPs from business DNA |

### Backend Endpoints with No Frontend
20+ endpoints have no frontend caller:
- `/advisory/*` — full advisory system with no UI
- `/account/users/invite` — team invitation system not wired
- `/admin/prompts/*` — prompt management lab (PromptLab page exists but limited)
- `/analyses` and `/analyses/{id}` — analysis CRUD not wired to frontend
- **Action:** Wire these to appropriate pages or remove dead code

### Integration Disconnect/Reconnect Buttons
- Users cannot disconnect HubSpot/Xero from the Integrations page
- Disconnect logic exists in backend but frontend buttons only show for email
- Need: disconnect button on each integration card + refresh/reconnect

### Mobile Responsive Audit
- Titan Glass CSS has mobile blur reduction
- Full audit needed on 375px/390px viewport for all authenticated pages
- Board Room diagnosis cards need mobile stack testing

---

## P3 — LOW PRIORITY / FUTURE

### Video Call Feature
- Mentioned by user but not built
- No code, no route, no component exists
- Would need: Jitsi/Twilio/Daily.co integration

### Background Auto-Refresh Scheduler
- Currently snapshot refreshes every 15 min while user is active
- Need: background Supabase cron job to refresh snapshots for all users periodically
- Supabase `pg_cron` extension can trigger Edge Function on schedule

### Onboarding Flow Redesign
- Current: manual URL input → calibration-psych → 9 questions
- Should: URL → calibration-business-dna fills ALL DNA → calibration-psych for persona → done
- Two Edge Functions exist but not chained together in the frontend flow

### Intelligence Pipeline Automation
- email_sync_worker.py exists but may not be running in production
- intelligence_automation_worker.py exists but untested
- Need: verify workers run, process new emails → observation_events automatically

### Subscription/Billing System
- Settings page has "Billing" tab
- Pricing page shows 3 tiers (Free/$29/$99)
- No actual payment integration (Stripe not wired beyond Merge.dev)
- Need: Stripe Checkout + webhook for subscription management

### Health Monitoring
- No alerting for Edge Function failures
- No monitoring for API latency
- No error tracking (Sentry/similar)
- Backend `/api/health` exists but no external monitoring

### Full-Text Search Across Platform
- Performance indexes include GIN indexes for full-text search on SOPs, documents, analyses
- No search UI exists that uses this
- Could add global search bar in header

### Data Export
- No way for users to export their data
- GDPR/privacy requirement for Australian businesses
- Need: "Export my data" button in Settings

---

## Tech Debt Summary

| Category | Count | Effort |
|----------|-------|--------|
| P0 Critical | 3 items | Deploy resolves all |
| P1 High | 5 items | 2-3 sessions |
| P2 Medium | 6 items | 4-5 sessions |
| P3 Future | 8 items | Ongoing |
| Orphaned endpoints | 20+ | Audit needed |
| Large files to split | 2 (profile.py, email.py) | 1-2 sessions |

---

## Edge Function Status

| Function | Deployed | Optimized | Tracking |
|----------|----------|-----------|----------|
| intelligence-snapshot | Yes | Yes (parallel) | No |
| biqc-insights-cognitive | Yes | No (sequential) | No |
| strategic-console-ai | Yes | No (sequential) | No |
| boardroom-diagnosis | Yes | No (sequential) | No |
| market-analysis-ai | Yes | No (sequential) | No |
| calibration-psych | Yes | N/A | No |
| calibration-business-dna | **NOT DEPLOYED** | N/A | No |
