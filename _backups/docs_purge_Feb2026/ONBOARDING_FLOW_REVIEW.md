# ============================================================
# BIQC ONBOARDING FLOW - COMPLETE REVIEW
# ============================================================

## TRIGGER: WHEN IS ONBOARDING SHOWN?
## ============================================================

### PRIMARY TRIGGER:
**After OAuth Authentication (Google/Microsoft Sign-In)**

Flow:
```
User signs in with Google/Microsoft
        ↓
AuthCallbackSupabase.js handles OAuth callback
        ↓
Checks if user profile exists (line 115, 126)
        ↓
IF profile missing → navigate('/onboarding')
IF profile exists → navigate('/advisor')
```

### SECONDARY TRIGGER:
**Direct Navigation**
- URL: `/onboarding`
- Route: Protected (requires authentication)
- Auto-resumes if partially completed

### SKIP CONDITIONS:
- IF onboarding already completed → Redirect to /dashboard
- IF no onboarding data → Start fresh


## THE 3 BUSINESS STAGES
## ============================================================

### STAGE 1: BUSINESS IDEA 💡
**Label:** "Business Idea"
**Icon:** Lightbulb
**Description:** "I have a concept but haven't started yet"
**Color:** Orange (#FF9500)

**Total Steps:** 7

**Questions:**

**Step 1: Basics**
1. What's your business idea called?
2. In one sentence, what problem does it solve?
3. What industry or sector?

**Step 2: Your Concept**
1. Who is your ideal customer?
2. What makes your idea unique?

**Step 3: Target Market**
1. Where will you operate? (Local/State-wide/National/International)
2. Do you have competitors? (Yes/Not sure/No)

**Step 4: Timeline**
1. When do you plan to launch? (1-3 months / 3-6 months / 6-12 months / 12+ months / still planning)
2. What's your biggest challenge right now?

**Step 5: Resources**
1. Do you have funding or capital? (Bootstrapping / Seeking / Secured / Not thought about it)
2. How much time can you dedicate per week? (<5 / 5-10 / 10-20 / 20-40 / 40+)

**Step 6: Tools**
1. What tools do you currently use? (Multiple choice: Xero, HubSpot, Slack, Google Workspace, Notion, Stripe, None, Other)
2. Website or social media (optional)

**Step 7: Preferences**
1. How do you prefer to receive advice? (Quick & Concise / Detailed & Thorough / Conversational)
2. Time availability for implementation (<2 hours/week → 20+ hours/week)


---

### STAGE 2: STARTUP 🚀
**Label:** "Startup"
**Icon:** Rocket
**Description:** "Launched recently, building traction"
**Color:** Purple (#7C3AED)

**Total Steps:** 7

**Questions:**

**Step 1: Basics**
1. Business Name
2. Industry
3. When did you launch? (month picker)

**Step 2: Product/Service**
1. What do you offer? (description)
2. Business model (B2B / B2C / B2B2C / Marketplace / SaaS / Subscription / Other)

**Step 3: Traction**
1. Do you have paying customers? (Yes / Trialing/testing / Not yet)
2. Monthly revenue range (Pre-revenue / <$1K / $1K-$5K / $5K-$10K / $10K-$50K / $50K+)

**Step 4: Team**
1. Team size (Just me / 2-5 / 6-10 / 11-25 / 26-50 / 51+)
2. Are you hiring or planning to hire? (Actively / Planning / Not now)

**Step 5: Funding**
1. Funding stage (Bootstrapped / Friends & Family / Angel / Seed / Series A / Series B+)
2. Are you actively fundraising? (Yes actively / Planning soon / Not at this time)

**Step 6: Tools**
1. What tools do you currently use? (Same as Idea stage)
2. Website or social media (optional)

**Step 7: Preferences**
1. How do you prefer to receive advice? (Quick & Concise / Detailed & Thorough / Conversational)
2. Time availability for implementation (<2 hours/week → 20+ hours/week)


---

### STAGE 3: ESTABLISHED BUSINESS 🏢
**Label:** "Established Business"
**Icon:** Building2
**Description:** "Operational with consistent revenue"
**Color:** Blue (#0066FF)

**Total Steps:** 7

**Questions:**

**Step 1: Basics**
1. Business Name
2. ABN (Australian Business Number)
3. Industry (Technology / Retail / Professional Services / Food / Healthcare / Manufacturing / Construction / Other)
4. Years in operation (1-2 / 2-5 / 5-10 / 10+)

**Step 2: Operations**
1. What do you offer? (description of products/services)
2. Business model (B2B / B2C / B2B2C / Hybrid)

**Step 3: Performance**
1. Annual revenue range (<$100K / $100K-$500K / $500K-$1M / $1M-$5M / $5M-$10M / $10M+)
2. Customer count (<10 / 10-50 / 50-100 / 100-500 / 500-1000 / 1000+)
3. What's your primary growth challenge? (open text)

**Step 4: Team**
1. Team size (Just me / 2-5 / 6-10 / 11-25 / 26-50 / 51+)
2. Are you hiring or planning to hire? (Actively / Planning / Not now)

**Step 5: Growth**
1. What are your main growth goals? (Multiple choice: Increase revenue / Expand market / Improve efficiency / Scale team / New products / Better margins)
2. Are you considering expansion or exit? (Grow / Expand / Exit/sale / Maintain current size)

**Step 6: Tools**
1. What tools do you currently use? (Same as other stages)
2. Website or social media (optional)

**Step 7: Preferences**
1. How do you prefer to receive advice? (Quick & Concise / Detailed & Thorough / Conversational)
2. Time availability for implementation (<2 hours/week → 20+ hours/week)


## ONBOARDING FLOW MECHANICS
## ============================================================

### PROGRESS TRACKING:
- Saved to backend after each step: POST /onboarding/save
- Persisted in Supabase `onboarding` table
- Can resume from last step if user exits

### COMPLETION:
- Final step → POST /business-profile (saves all data)
- Marks onboarding as complete
- Redirects to: /advisor (Watchtower page)

### SKIP/BYPASS:
- No "Skip Onboarding" button visible
- User must complete or will see onboarding on next login


## DATA CAPTURED (ALL STAGES)
## ============================================================

### Common Fields (All Stages):
- business_name
- industry
- current_tools (array)
- website
- advice_style (concise / detailed / conversational)
- time_availability

### Idea-Specific:
- problem_statement
- target_customer
- unique_value
- operating_regions
- has_competitors
- launch_timeline
- biggest_challenge
- funding_status
- time_commitment

### Startup-Specific:
- launch_date
- product_description
- business_model
- has_customers
- revenue_range
- team_size
- hiring_status
- funding_stage
- fundraising_status

### Established-Specific:
- abn
- years_operating
- products_services
- revenue_range
- customer_count
- growth_challenge
- team_size
- hiring_status
- growth_goals (array)
- exit_strategy


## CURRENT STATE ASSESSMENT
## ============================================================

### ✅ STRENGTHS:
- Adaptive questionnaire (different for each stage)
- Progress saving (can resume)
- Clean UI/UX
- Appropriate depth per stage

### ⚠️ AREAS FOR REVIEW:
- No "Skip" option (forces completion)
- 7 steps may feel long for established businesses who want quick access
- No preview of questions before stage selection
- Advice style question may not be clear to users
- Tools question includes "None yet" - may confuse established businesses

### ❓ OBSERVATIONS:
- Stage selection is permanent (can't change after selection without restart)
- Progress indicator shows percentage
- Back button allows correction
- All data saved to business_profile on completion
