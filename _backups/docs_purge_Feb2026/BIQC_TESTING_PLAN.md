# BIQC TESTING PLAN: Your Real Business
**Date:** 2025-01-20
**Goal:** Validate BIQC provides relevant business insights from your Outlook emails

---

## PRE-TEST CHECKLIST

✅ Supabase Auth working
✅ Outlook integration on Supabase
✅ Cognitive Core on Supabase
✅ Email storage on Supabase
✅ Intelligence collections ready
✅ Backend running and stable

---

## TESTING WORKFLOW

### PHASE 1: Setup & Connection (5 minutes)

**Step 1: Login**
1. Go to: https://intelligence-hub-12.preview.emergentagent.com/login-supabase
2. Sign in with your real business account (Google or Microsoft)
3. Verify you land on `/advisor` page

**Step 2: Connect Outlook**
1. Navigate to `/integrations`
2. Click "Connect" on Microsoft Outlook
3. Authenticate with your business Microsoft account
4. Grant permissions (Mail.Read, Calendar.Read)
5. Verify redirect back to integrations with "Connected" status

**Expected:** ✅ Outlook shows "Connected" with your email

---

### PHASE 2: Sync Email Data (5-10 minutes)

**Step 3: Initial Email Sync**
1. On integrations page, look for "Sync Now" or similar button
2. OR navigate to `/advisor` and BIQC should auto-trigger sync
3. Wait for sync to complete (50-100 recent emails)

**What's happening behind the scenes:**
- Fetches emails from Microsoft Graph API
- Stores in Supabase `outlook_emails` table
- Generates email intelligence (clients, patterns, relationships)
- Stores in `email_intelligence` table

**Expected:** Email count increases, no errors

---

### PHASE 3: Test BIQC Email Analysis (Critical Test)

**Step 4: Ask BIQC for Email Insights**
Go to `/advisor` and ask BIQC questions like:

**Test Question 1: Client Identification**
> "Who are my most important clients based on my emails?"

**Expected BIQC Response:**
- Should identify top clients by email frequency
- Should recognize key relationships
- Should provide specific names/companies (not generic)

**Test Question 2: Communication Patterns**
> "What patterns do you see in my client communications?"

**Expected BIQC Response:**
- Communication frequency insights
- Response time patterns
- Topics discussed with clients
- Should reference ACTUAL email data

**Test Question 3: Business Intelligence**
> "What does my email history tell you about my business?"

**Expected BIQC Response:**
- Industry insights from email content
- Client types/segments
- Business stage indicators
- Revenue signals
- Should be SPECIFIC to YOUR business

**Test Question 4: Strategic Recommendations**
> "Based on my emails, what should I prioritize this week?"

**Expected BIQC Response:**
- Specific email-based recommendations
- Urgent client follow-ups
- Relationship maintenance priorities
- Should reference actual pending emails

---

### PHASE 4: Test Calendar Intelligence (if time permits)

**Step 5: Sync Calendar**
1. Navigate to integrations or calendar section
2. Trigger calendar sync
3. Wait for sync completion

**Step 6: Ask Calendar Questions**
> "How is my time allocated based on my calendar?"
> "Who do I meet with most frequently?"

**Expected:**
- Meeting load analysis
- Time scarcity indicators
- Key collaborators identified

---

### PHASE 5: Test Cognitive Core Learning

**Step 7: Multiple Interactions**
1. Have a conversation with BIQC (3-5 messages)
2. Ask about your business goals
3. Ask for advice on a specific challenge
4. See if BIQC remembers context from earlier messages

**Expected:**
- BIQC should remember what you said earlier in conversation
- Should provide increasingly personalized advice
- Should reference your business profile

---

## SUCCESS CRITERIA

### ✅ BIQC Working Correctly If:

**Email Analysis:**
- [ ] BIQC identifies actual clients from your emails (specific names)
- [ ] Provides insights based on real email patterns (not generic)
- [ ] References specific email data in responses
- [ ] Recommendations are relevant to YOUR business

**Cognitive Core:**
- [ ] BIQC remembers conversation context
- [ ] Personalizes responses based on your business profile
- [ ] Tracks preferences and patterns
- [ ] Advice becomes more specific over time

**Data Integration:**
- [ ] Email count shows synced emails
- [ ] Connection status shows "Connected"
- [ ] No 500 errors when asking questions
- [ ] Responses are coherent and relevant

---

## FAILURE INDICATORS

### ❌ BIQC NOT Working If:

**Generic Responses:**
- BIQC gives generic business advice (not specific to you)
- Can't name any actual clients
- Doesn't reference email data
- Advice could apply to any business

**Technical Errors:**
- 500 errors when asking questions
- "No email data available" despite sync
- Cognitive Core errors in logs
- Foreign key constraint violations

**Data Issues:**
- Email count stays at 0 after sync
- Connection status shows "Not connected" after setup
- Intelligence endpoints return empty
- No business profile data

---

## MONITORING DURING TEST

### Backend Logs to Watch:
```bash
tail -f /var/log/supervisor/backend.err.log | grep "Error\|BIQC\|Cognitive\|email"
```

**Look for:**
- ✅ "Cognitive Core initialized with Supabase"
- ✅ Email sync success messages
- ❌ Foreign key constraint errors
- ❌ Schema cache errors (PGRST204)

---

## TEST SCENARIOS

### Scenario 1: Cold Start (New User)
- Login for first time
- Connect Outlook
- Sync emails
- Ask BIQC questions
- **Expected:** BIQC provides insights even with minimal data

### Scenario 2: Warm Data (After Sync)
- Already connected Outlook
- Emails synced (50-100 messages)
- Multiple conversations with BIQC
- **Expected:** Rich, personalized insights

### Scenario 3: Deep Intelligence (Full Sync)
- Comprehensive email sync (3-year history if available)
- Multiple document uploads
- Extensive chat history
- **Expected:** BIQC demonstrates deep understanding of your business

---

## WHAT TO TEST WITH YOUR BUSINESS

**Your Real Data:**
1. Your actual Microsoft Outlook business account
2. Real client emails
3. Real calendar meetings
4. Your actual business challenges

**Questions to Ask BIQC:**
1. "Analyze my client relationships"
2. "What are my business's key challenges based on my emails?"
3. "Who needs a follow-up this week?"
4. "What patterns do you see in my communications?"
5. "How can I improve client relationships?"

**Expected:**
BIQC should provide insights that are:
- ✅ Specific to YOUR clients
- ✅ Relevant to YOUR industry
- ✅ Based on YOUR actual email data
- ✅ Actionable for YOUR business

---

## NEXT STEPS

1. **I'll verify backend is running properly**
2. **You test BIQC with your real business**
3. **Report back:**
   - Does BIQC identify your real clients?
   - Are insights relevant and specific?
   - Any errors or generic responses?
4. **Based on results:**
   - If working: Finish last 45 refs + mobile
   - If issues: Fix BIQC first, then finish migration

---

**Ready to test?** Let me verify backend is healthy first...