# BIQC (Business IQ Centre) - Product Requirements Document

## Original Problem Statement
Migrate BIQC application from MongoDB to Supabase (PostgreSQL) and stabilize for investor demo. Primary goal: fully functional advisor chat, seamless mobile UX, and working Outlook integration with Priority Inbox.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Google/Microsoft OAuth, Email/Password)
- **AI**: OpenAI GPT via Emergent LLM Key
- **Email**: Microsoft Graph API via Supabase Edge Function

## What's Been Implemented

### Session: January 23, 2025

#### ✅ COMPLETED
1. **Auth Redirect Loop** - Fixed by proper session handling and user ID sync
2. **Azure Client ID** - Restored correct ID: `5d6e3cbb-cd88-4694-aa19-9b7115666866`
3. **Outlook OAuth Flow** - Now uses Supabase Edge Function correctly
4. **User ID Sync** - Fixed duplicate user ID issue between auth.users and public.users
5. **RLS Policies** - Added service_role policies for all critical tables
6. **Priority Inbox Analysis** - Fixed MongoDB-style function call to Supabase
7. **Notification Polling** - Disabled via feature flag for demo (no console noise)
8. **Manifest Icons** - Created logo192.png and logo512.png
9. **Suggest Reply Feature** - BIQC-style decisive replies with advisor rationale
10. **Reply Modal UI** - Updated to render new response format

#### 🔧 KEY FIXES APPLIED
- `/app/backend/auth_supabase.py` - User profile creation with ID migration
- `/app/backend/server.py` - Priority analysis write fix, Suggest Reply endpoint
- `/app/frontend/src/pages/EmailInbox.js` - Reply modal rendering
- `/app/frontend/src/components/DashboardLayout.js` - Notification polling disabled
- `/app/frontend/public/logo192.png` & `logo512.png` - PWA icons created

## Database Schema (Supabase)

### Key Tables
- `users` - User profiles (synced with auth.users)
- `outlook_oauth_tokens` - Microsoft OAuth tokens (from Edge Function)
- `outlook_emails` - Synced emails from Outlook
- `email_priority_analysis` - BIQC priority analysis results
- `onboarding` - User onboarding status
- `chat_history` - Advisor chat history
- `cognitive_profiles` - BIQC cognitive core data
- `business_profiles` - User business information

### Required RLS Policies
```sql
CREATE POLICY "Service role full access" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.outlook_oauth_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.outlook_emails FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.onboarding FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.chat_history FOR ALL TO service_role USING (true) WITH CHECK (true);
```

## Prioritized Backlog

### P0 - DONE ✅
- [x] Auth redirect loop
- [x] Outlook OAuth connection
- [x] Priority Inbox display
- [x] Suggest Reply feature
- [x] Console error cleanup for demo

### P1 - HIGH PRIORITY
- [ ] Email sync verification (ensure emails populate after OAuth)
- [ ] New user signup flow testing
- [ ] Google Calendar integration
- [ ] Gmail integration

### P2 - MEDIUM PRIORITY
- [ ] Theme toggle fix
- [ ] Password reset flow
- [ ] 2FA implementation
- [ ] Notifications endpoint fix (currently disabled)

### P3 - BACKLOG
- [ ] Serper.dev integration for live data
- [ ] Backend refactoring (break down server.py)
- [ ] BIQC meta-layer (beliefs, decisions, drift tracking)
- [ ] CRM integrations (HubSpot, Salesforce, Xero)

## Key URLs
- **App**: https://watchtower-ai.preview.emergentagent.com
- **Supabase**: https://uxyqpdfftxpkzeppqtvk.supabase.co

## Credentials
- **Test Account**: (create via Microsoft OAuth)
- **Azure Client ID**: `5d6e3cbb-cd88-4694-aa19-9b7115666866`

---
*Last Updated: January 23, 2025*

### Session: February 05, 2026

#### ✅ COMPLETED
1. **Cognitive Core Observe** - Supabase-safe updates with JSON merge and no Mongo syntax
2. **Merge File Storage Connect** - Merge link token accepts categories; frontend now opens file_storage flow
3. **MongoDB Elimination (server.py)** - Replaced legacy db.* queries with Supabase for chat sessions, analyses, data center, business profiles, advisory history, admin stats, dashboard stats, notifications, and soundboard delete
4. **Integrations UI Test IDs** - Added data-testid coverage for Integrations interactions
5. **Canonical Intelligence Moments** - Activated revenue risk, founder strain, and strategy drift moments with calibration weighting, Cognitive Core delivery preferences, and constitution checks in watchtower generation
6. **Controlled User Purge** - Executed Supabase + Mongo deletions for specified user IDs per destructive purge request
7. **Calibration Advisor Activation** - Added calibration routing override, live advisor flow, and Supabase writes for Q1–Q9 with AI draft generation and post-calibration scaffolding
8. **Silence Intervention System** - Implemented silence detection, escalation ladder, engagement risk scoring, and consequence memory updates with Watchtower events
9. **Regeneration Governance** - Added controlled regeneration proposals with evidence gating, consequence tracking, and explicit response actions
10. **Env URL Alignment** - Updated frontend REACT_APP_BACKEND_URL to https://beta.thestrategysquad.com
11. **Calibration-first Auth Guard** - Replaced auth bootstrap with calibration-first gating and auth-state routing
12. **Login URL Fix** - Set Welcome Back page home link and OAuth redirect to beta.thestrategysquad.com
13. **Calibration Status Guard** - Enforced deterministic /api/calibration/status responses (NEEDS_CALIBRATION/COMPLETE only)

#### ✅ TESTING
- `GET /api/health`
- Integrations page load (auth-gated login view)
- `python -c` import of truth_engine_rpc
- `GET /api/health` (post-calibration changes)
- Calibration route load (auth-gated login view)
- `python -c` import of silence_detection/intelligence_automation_worker
- `python -c` import of regeneration_governance
- Calibration-first auth guard update (manual auth flow pending)

*Last Updated: February 05, 2026*
