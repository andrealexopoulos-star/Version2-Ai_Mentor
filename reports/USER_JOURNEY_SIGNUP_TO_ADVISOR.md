# BIQc — Exact User Journey: Signup to Advisor Dashboard
## Every Step, Every Screen, Every Decision Point

---

## STEP 1: Landing Page
**URL:** `/` (HomePage.js)
**What user sees:**
- "Run Your Business Like The Big Players Without The Cost"
- "Try It For Free" button (orange, center)
- "Already have an account? Log in" link
- Top nav: Platform, Intelligence, Integrations, Pricing, Blog, Trust

**User action:** Clicks "Try It For Free" → navigates to `/register-supabase`

---

## STEP 2: Registration Page
**URL:** `/register-supabase` (RegisterSupabase.js)
**What user sees:**
- Left panel: registration form
- Right panel: "Your business intelligence, protected by design" + trust badges
- Two OAuth buttons: "Continue with Google", "Continue with Microsoft"
- OR manual form with fields:
  - Full Name (required)
  - Email (required)
  - Company Name (optional)
  - Industry (optional)
  - Password (required, min 6 chars)
  - Confirm Password (required)
- "Sign up" button

**What happens on submit:**
1. `supabase.auth.signUp()` called with email, password, and metadata (full_name, company_name, industry, role: 'user')
2. Success toast: "Account created! Please check your email to confirm."
3. Redirect to `/login-supabase`

**If OAuth:** Supabase handles redirect flow → returns to app with session

---

## STEP 3: Email Confirmation
**What user sees:** Email from Supabase with confirmation link
**What happens:** User clicks link → Supabase confirms email → user can now log in
**Note:** If email confirmation is disabled in Supabase settings, this step is skipped.

---

## STEP 4: Login Page
**URL:** `/login-supabase` (LoginSupabase.js)
**What user sees:**
- Left panel: login form
  - "Continue with Google" button
  - "Continue with Microsoft" button
  - Email input (placeholder: "you@company.com")
  - Password input
  - "Forgot password?" link
  - "Sign in" button (orange)
  - "Don't have an account? Sign up" link
- Right panel: "Your business intelligence, protected by design" + trust badges

**User action:** Enters credentials → clicks "Sign in"

**What happens on submit:**
1. `supabase.auth.signInWithPassword()` called
2. On success: Supabase session created in browser
3. SupabaseAuthContext detects session via `onAuthStateChange`
4. Bootstrap sequence begins (Step 5)

---

## STEP 5: Auth Bootstrap (Invisible to User — Happens in Background)
**What user sees:** Loading screen with:
- Pulsing orange "B" logo
- "Good [morning/afternoon/evening]."
- "Establishing secure connection..."
- Animated progress bar

**What happens behind the scenes (SupabaseAuthContext.js lines 252-354):**

1. **Calibration check:** `GET /api/calibration/status` with auth token
   - Backend checks `strategic_console_state` table for `is_complete = true`
   - Backend checks `user_operator_profile` for `persona_calibration_status = 'complete'`
   - Returns `{ status: 'COMPLETE' }` or `{ status: 'IN_PROGRESS' }` or `{ status: 'NOT_STARTED' }`

2. **Routing decision:**
   - If calibration status = `COMPLETE` → `authState = READY`
   - If calibration status ≠ `COMPLETE` → `authState = NEEDS_CALIBRATION`
   - If backend returns HTTP 401/403 → sign out, redirect to login
   - If backend returns non-JSON (proxy error) → fail-closed, `NEEDS_CALIBRATION`
   - If backend fetch fails entirely → **fail-open**, treat as `READY` (to prevent blocking)

3. **If READY — Onboarding check:** `GET /api/onboarding/status`
   - Returns `{ completed: true/false, current_step: N }`
   - If completed = false → `onboardingStatus.completed = false`
   - If request fails → **fail-open**, treat as completed

---

## STEP 6A: If NEEDS_CALIBRATION → Calibration Flow
**URL:** `/calibration` (CalibrationAdvisor.js)
**ProtectedRoute enforces this redirect.**

### Phase 1: Cognitive Ignition Screen
- Animated loading screen: "Initialising cognitive engine..."
- User's name displayed
- Transitions automatically after animation completes

### Phase 2: Welcome Handshake
**What user sees:**
- "Welcome, [First Name]"
- Website URL input field (pre-filled if profile has website)
- "Start Audit" button → triggers website scrape
- "I don't have a website" fallback → manual summary entry

### Phase 3: Analyzing
- Progress animation while backend scrapes website
- Backend calls: website text extraction, AI analysis, identity signal generation

### Phase 4: Forensic Identity Verification
**What user sees:**
- Identity signals extracted from website (business name, industry, services, etc.)
- User can confirm, regenerate, or reject identity
- ABN lookup available (Australian Business Number)
- "Confirm Identity" button

### Phase 5: Chief Marketing Summary (Footprint Report)
**What user sees:**
- AI-generated marketing footprint report based on website analysis
- Digital presence assessment
- "Continue" button to proceed

### Phase 6: Executive CMO Snapshot
- Intelligence data display based on website analysis
- Market positioning signals
- "Continue" button

### Phase 7: Forensic Calibration (Optional)
- Deeper calibration questions
- Can be skipped

### Phase 8: Calibrating Session (Interactive)
**What user sees:**
- Multi-step wizard or chat-style calibration
- Questions about business strategy, goals, challenges
- Each answer refines the cognitive profile
- `calMode` can be 'wizard' (structured) or 'chat' (conversational)

### Phase 9: Executive Reveal
- Animated reveal of completed calibration
- Summary of what the system learned

### Phase 10: Calibration Complete
- Backend writes `strategic_console_state.is_complete = true`
- Backend writes `user_operator_profile.persona_calibration_status = 'complete'`
- Redirect to `/advisor`

**Super Admin shortcut:** Admin users see a "Skip (Admin)" button to bypass calibration entirely.

---

## STEP 6B: If READY but Onboarding Incomplete → Onboarding
**URL:** `/onboarding` redirects to `/onboarding-decision` (OnboardingDecision.js)
**ProtectedRoute enforces this redirect for non-exempt paths.**

### Onboarding Decision Screen
**What user sees:**
- "Welcome to BIQC"
- "Let's set up your intelligent advisor"
- "This 5-minute setup helps us understand your context and deliver relevant insights."
- Two options:
  1. **"Complete Setup Now"** — "5 minutes to unlock personalized intelligence and insights" → goes to `/onboarding`
  2. **"I'll Do This Later"** — "You'll be asked again next time you sign in" → sets `sessionStorage.onboarding_deferred`, navigates to `/advisor`

### If user chooses "Complete Setup Now":
**URL:** `/onboarding` (OnboardingWizard.js)

**8-step wizard:**

**Step 1: Welcome**
- Welcome message
- Overview of what will be asked

**Step 2: Business Identity**
- Business name
- Business stage (dropdown)
- Industry
- Location

**Step 3: Website**
- Website URL input
- Option to enrich profile from website (AI auto-fill)

**Step 4: Market & Customers**
- Target market description
- Customer segments

**Step 5: Products & Services**
- Products/services description
- Unique value proposition

**Step 6: Team**
- Team size
- Key roles

**Step 7: Goals & Strategy**
- Short-term goals
- Long-term goals
- Main challenges
- Growth strategy

**Step 8: BIQC Preferences**
- AI communication style preferences
- Intelligence focus areas

**Each step:**
- Auto-saves progress
- Progress bar visible at top
- Back/Next navigation
- Can skip individual fields

**On completion:**
- Backend marks onboarding as completed
- `onboardingStatus.completed = true`
- Navigates to `/advisor`

---

## STEP 7: Advisor Dashboard (Final Destination)
**URL:** `/advisor` (AdvisorWatchtower.js)
**This is the main post-login page for all calibrated users.**

### What user sees on first load:

**Top:** System state banner
- Color-coded: Green (STABLE/On Track), Amber (DRIFT/Market Shift), Orange (COMPRESSION/Under Pressure), Red (CRITICAL/At Risk)
- Refresh button

**Header:** "Good [morning/afternoon/evening], [First Name]."
- DataConfidence badge (top right)

**Check-in Alerts:** (CheckInAlerts component)
- Any scheduled check-in reminders

**5 Cognition Tabs:** (horizontally scrollable)
1. **Money** (orange icon) — "Cash, invoices, margins, runway, spend" — requires: accounting
2. **Revenue** (blue icon) — "Pipeline, deals, leads, churn, pricing" — requires: CRM
3. **Operations** (green icon) — "Tasks, SOPs, bottlenecks, delivery" — requires: CRM
4. **People** (red icon) — "Capacity, calendar, decisions, burnout" — requires: email
5. **Market** (purple icon) — "Competitors, positioning, trends, regulatory" — requires: none

**Tab Content (for active tab):**
- If integration NOT connected: "CRM Not Connected" / "Accounting Not Connected" etc. with "Connect [Tool]" CTA button linking to `/integrations`
- If integration connected but no data: "Insufficient data to generate insight."
- If data exists:
  - AI Insight paragraph (from cognitive snapshot)
  - Up to 3 metric cards (label + value + color)
  - Tab-specific details:
    - Revenue: Deal pipeline table (name, stall days, value, probability)
    - Money: Invoice list, cash flow metrics
    - Operations: SLA breaches, bottleneck details
    - People: Capacity, fatigue, calendar density
    - Market: Competitor landscape, positioning verdict
  - Resolution items with action buttons (Auto-Email, Quick-SMS, Hand Off, Complete, Ignore)

**For a brand new user with zero integrations:**
- All 5 tabs show "Not Connected" empty states
- Each tab has a specific "Connect [Tool]" CTA
- The Market tab may show basic positioning data from calibration website scrape
- No intelligence, no metrics, no insights visible

---

## COMPLETE FLOW SUMMARY

```
Landing Page (/)
    ↓ Click "Try It For Free"
Register (/register-supabase)
    ↓ Submit form
Email Confirmation (inbox)
    ↓ Click confirm link
Login (/login-supabase)
    ↓ Enter credentials
Loading Screen (2-5 seconds)
    ↓ Calibration check
    ├── NOT CALIBRATED → Calibration (/calibration)
    │     ↓ 10-phase flow (website scrape → identity → marketing → strategy)
    │     ↓ Complete
    │     └── → Advisor (/advisor)
    └── CALIBRATED → Onboarding check
          ├── NOT COMPLETED → Onboarding Decision (/onboarding-decision)
          │     ├── "Complete Setup Now" → Onboarding Wizard (/onboarding)
          │     │     ↓ 8-step wizard (identity → website → market → product → team → goals → preferences)
          │     │     ↓ Complete
          │     │     └── → Advisor (/advisor)
          │     └── "I'll Do This Later" → Advisor (/advisor) directly
          └── COMPLETED → Advisor (/advisor) directly
```

---

## TIME ESTIMATES

| Step | Duration | Can Skip? |
|------|----------|-----------|
| Registration | 1-2 minutes | No |
| Email confirmation | 0-5 minutes | Depends on Supabase config |
| Login | 30 seconds | No |
| Loading/bootstrap | 2-5 seconds | No |
| Calibration (full) | 5-15 minutes | Admin only |
| Onboarding wizard (full) | 5-10 minutes | Yes (defer) |
| **Total to Advisor (first time, full):** | **12-32 minutes** | |
| **Total to Advisor (defer everything):** | **3-8 minutes** | |

---

## CRITICAL OBSERVATION

A first-time user who completes everything spends **12-32 minutes** before seeing the Advisor Dashboard. When they arrive, if they haven't connected any integrations (which is NOT part of calibration or onboarding), they see 5 tabs all showing "Not Connected" empty states.

The integration connection step is NOT part of the guided flow. It exists as:
1. A setup checklist on `/dashboard` (which is redirected to `/advisor` and never seen)
2. CTAs inside each empty tab on the Advisor page

The user's first experience of the Advisor Dashboard — after up to 32 minutes of setup — is an empty intelligence surface.
