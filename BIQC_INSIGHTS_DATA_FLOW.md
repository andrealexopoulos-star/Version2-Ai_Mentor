# BIQC INSIGHTS — COMPLETE DATA FLOW VERIFICATION

## OVERVIEW

BIQC Insights operates entirely on the **frontend** with **direct Supabase queries**. 
There is **NO backend processing** for the narrative generation.
The narrative is generated **client-side** based on real-time integration status.

---

## DATA SOURCES (WHERE DATA COMES FROM)

### 1. Supabase Database Tables (Direct Queries)

**Table: `email_connections`**
- **Purpose**: Track email integration status per user
- **Query**: `SELECT * FROM email_connections WHERE user_id = {current_user_id}`
- **Data Retrieved**:
  - `provider` (gmail or outlook)
  - `connected` (boolean)
  - `connected_email` (email address)
  - `connected_at` (timestamp)
- **Location in code**: `/app/frontend/src/pages/Advisor.js` line 182-189

**Table: `integration_accounts`**
- **Purpose**: Track Merge.dev integrations (CRM, Accounting, etc.)
- **Query 1**: `SELECT * FROM integration_accounts WHERE user_id = {current_user_id} AND category = 'crm'`
  - Returns: HubSpot connection status
- **Query 2**: `SELECT * FROM integration_accounts WHERE user_id = {current_user_id} AND category = 'accounting'`
  - Returns: Xero connection status
- **Data Retrieved**:
  - `provider` (HubSpot, Xero, etc.)
  - `category` (crm, accounting)
  - `connected_at` (timestamp)
- **Location in code**: `/app/frontend/src/pages/Advisor.js` lines 191-209

### 2. Browser LocalStorage (User Behavior Tracking)

**Key: `biqc_focus_history`**
- **Purpose**: Track which focus areas user has selected over time
- **Structure**: Array of `{ area: 'growth', timestamp: '2025-01-31...' }`
- **Used for**: Behavioral reinforcement threshold (detects recurrence)
- **Location in code**: `/app/frontend/src/pages/Advisor.js` lines 122-123, 152-160

**Key: `biqc_intelligence_state`**
- **Purpose**: Persist intelligence thresholds for Soundboard access
- **Structure**: `{ thresholds: {...}, integrations: {...}, lastUpdated: '...' }`
- **Used for**: Cross-component intelligence awareness
- **Location in code**: `/app/frontend/src/pages/Advisor.js` lines 134-143

### 3. User Interaction State (React State)

**State: `selectedFocus`**
- **Purpose**: Currently selected focus area
- **Set by**: User clicking a focus area card
- **Location**: Line 56

**State: `activeTab`**
- **Purpose**: Currently active tab ('focus' or 'diagnosis')
- **Set by**: User clicking tab
- **Location**: Line 55

---

## PROCESSING PIPELINE (HOW DATA IS PROCESSED)

### STEP 1: Integration Status Fetch (On Component Mount)

**Function**: `fetchRealIntegrationStatus()`
**Trigger**: Component mount (`useEffect` line 165)
**Process**:
1. Get current Supabase session
2. Query `email_connections` table → extract email provider and timestamp
3. Query `integration_accounts` for `category='crm'` → extract CRM status
4. Query `integration_accounts` for `category='accounting'` → extract accounting status
5. Store in `integrationData` state

**Output**: 
```javascript
{
  email: { connected: true/false, provider: 'gmail'/'outlook', connectedAt: timestamp },
  calendar: { connected: false, connectedAt: null },
  crm: { connected: true/false, connectedAt: timestamp },
  accounting: { connected: true/false, connectedAt: timestamp },
  dataPresent: true/false
}
```

---

### STEP 2: Intelligence Threshold Detection (When Integration Data Changes)

**Function**: `detectThresholds()`
**Trigger**: When `integrationData` or `selectedFocus` changes (`useEffect` line 76)
**Process**:

**Threshold 1: TIME CONSISTENCY**
- Calculate age of oldest connected integration
- If age > 24 hours → `timeConsistency = true`

**Threshold 2: CROSS-SOURCE REINFORCEMENT**
- Count number of connected integrations
- If count >= 2 → `crossSourceReinforcement = true`

**Threshold 3: BEHAVIORAL REINFORCEMENT**
- Read `biqc_focus_history` from localStorage
- Count how many times current focus has been selected
- If count >= 2 → `behaviouralReinforcement = true`

**Output**:
```javascript
{
  timeConsistency: true/false,
  crossSourceReinforcement: true/false,
  behaviouralReinforcement: true/false
}
```

**Side Effect**: Persists to localStorage as `biqc_intelligence_state`

---

### STEP 3: Narrative Generation (When Context Changes)

**Function**: `generateNarrative()`
**Trigger**: When `integrationData`, `selectedFocus`, `activeTab`, or `intelligenceState` changes (`useEffect` line 234)

**Inputs**:
- `integrationData` (from Supabase)
- `intelligenceState` (from threshold detection)
- `activeTab` (user interaction)
- `selectedFocus` (user interaction)

**Decision Tree**:

```
IF connectedCount = 0:
  → "Nothing here yet" narratives
  
ELSE IF connectedCount = 1:
  IF email.connected:
    IF timeConsistency = true:
      → "Pattern stabilising" narratives
    ELSE:
      → "Early signal" narratives
  ELSE IF calendar/crm/accounting.connected:
    → "Partial signal" narratives
    
ELSE (connectedCount >= 2):
  IF crossSourceReinforcement AND timeConsistency:
    → "Intelligence forming" narratives (highest confidence)
  ELSE IF crossSourceReinforcement:
    → "Signal forming" narratives
  ELSE:
    → "Signal forming" narratives
```

**Each narrative varies based on**:
- Active tab (focus vs diagnosis)
- Selected focus area
- Which specific integrations are connected
- Which thresholds are met

**Output**:
```javascript
{
  text: "Human-readable narrative string",
  confidence: "minimal signal" | "early signal" | "partial signal" | "signal forming" | "pattern stabilising" | "intelligence forming",
  loading: false
}
```

---

### STEP 4: Typewriter Display (Render to User)

**Component**: `NarrativeTypewriter`
**Location**: `/app/frontend/src/components/NarrativeTypewriter.js`
**Trigger**: When `narrativeState.text` changes

**Process**:
1. Receives narrative text and trigger key
2. Compares trigger to last trigger
3. If different → types out character by character
4. If same → displays full text immediately
5. Variable speed: pauses at punctuation (300ms at `.`, 150ms at `,`)

**Trigger Key**: `${activeTab}-${selectedFocus}-${email.connected}-${calendar.connected}-${crm.connected}`

**Output**: Text appears on screen with natural typing animation

---

## COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ USER OPENS BIQC INSIGHTS PAGE                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: FETCH INTEGRATION STATUS                            │
│                                                              │
│ → Query Supabase: email_connections table                   │
│ → Query Supabase: integration_accounts (category='crm')     │
│ → Query Supabase: integration_accounts (category='accounting')│
│ → Store in integrationData state                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: DETECT INTELLIGENCE THRESHOLDS                      │
│                                                              │
│ → Calculate integration age (time consistency)              │
│ → Count connected sources (cross-source reinforcement)      │
│ → Read focus history from localStorage (behavioral)         │
│ → Store in intelligenceState                                │
│ → Persist to localStorage for Soundboard                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: GENERATE NARRATIVE                                  │
│                                                              │
│ → Evaluate: connectedCount, thresholds, tab, focus          │
│ → Select appropriate human-language narrative                │
│ → Assign confidence level                                   │
│ → Store in narrativeState                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: RENDER WITH TYPEWRITER                              │
│                                                              │
│ → NarrativeTypewriter component receives text               │
│ → Checks if trigger changed                                 │
│ → If changed: types out with natural pacing                 │
│ → If same: displays immediately                             │
│ → User sees narrative on screen                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ USER INTERACTIONS TRIGGER RE-EVALUATION                     │
│                                                              │
│ → User selects focus area → narrative regenerates           │
│ → User switches tab → narrative regenerates                 │
│ → User connects new integration → full cycle repeats        │
└─────────────────────────────────────────────────────────────┘
```

---

## WHAT BIQC INSIGHTS CURRENTLY DOES **NOT** USE

❌ **Backend API calls** for narrative generation  
❌ **AI/LLM calls** for text generation  
❌ **Email content analysis** (doesn't read actual emails)  
❌ **Calendar event analysis** (doesn't read actual events)  
❌ **CRM data analysis** (doesn't read actual customer records)  
❌ **Accounting transaction analysis** (doesn't read actual transactions)  

**Current behavior**: Narrative is based **ONLY on connection status and timestamps**, not actual data content.

---

## INTELLIGENCE THRESHOLDS — WHAT TRIGGERS THEM

### Time Consistency
- **Data**: `connected_at` timestamps from Supabase tables
- **Calculation**: `NOW - oldest_connection_timestamp > 24 hours`
- **Effect**: Changes language from "early days" to "has been connected for a while"

### Cross-Source Reinforcement
- **Data**: Count of connected integrations
- **Calculation**: `connected_count >= 2`
- **Effect**: Changes language to mention "what's showing up across multiple areas"

### Behavioral Reinforcement
- **Data**: Focus area selection history in localStorage
- **Calculation**: `same_focus_count >= 2`
- **Effect**: Changes language to "you keep coming back to this"

---

## CONFIDENCE LEVELS — WHAT THEY MEAN

| Confidence Level | Trigger Condition | Example Language |
|-----------------|-------------------|------------------|
| **minimal signal** | 0 integrations connected | "Nothing here yet" |
| **early signal** | 1 integration, recent | "Early days—watching..." |
| **partial signal** | Calendar/CRM/Accounting only | "Visible but missing context" |
| **signal forming** | 2+ integrations connected | "Things are starting to line up" |
| **pattern stabilising** | Time consistency OR behavioral reinforcement | "Becoming more consistent over time" |
| **intelligence forming** | Cross-source + time consistency | "This is no longer isolated" |

---

## CURRENT LIMITATIONS

1. **No actual data analysis**: Only checks IF connections exist, not WHAT data they contain
2. **No email content reading**: Doesn't analyze email subjects, senders, or content
3. **No calendar event reading**: Doesn't analyze meeting patterns or schedules
4. **No CRM relationship analysis**: Doesn't analyze customer interactions
5. **No accounting transaction analysis**: Doesn't analyze financial flows

**Result**: All narratives are based on **connection metadata only**, not actual business activity.

---

## FUTURE ENHANCEMENT PATHS

To make narratives more intelligent, the system would need to:

1. **Email Analysis**: 
   - Call backend endpoint to analyze email priority/patterns
   - Use `/api/email/priority-inbox` data
   - Incorporate actual conversation themes into narrative

2. **Calendar Analysis**:
   - Analyze meeting frequency, durations, patterns
   - Detect schedule pressure or time fragmentation

3. **CRM Analysis**:
   - Analyze customer interaction frequency
   - Detect relationship health patterns

4. **Accounting Analysis**:
   - Analyze cash flow patterns
   - Detect financial health indicators

**Current state**: None of this is implemented. Narrative is **connection-aware only**.

---

## SUMMARY

**Current BIQC Insights Data Flow**:
1. Queries Supabase for integration connection status (yes/no + timestamps)
2. Reads user behavior from localStorage (focus selections)
3. Detects 3 intelligence thresholds (time, cross-source, behavioral)
4. Generates human-language narrative based on these factors
5. Displays with typewriter effect

**What it does NOT do**:
- Analyze actual email/calendar/CRM/accounting content
- Make backend API calls for intelligence
- Use AI to generate narratives (narratives are hardcoded based on state)
- Access real business activity data

**Intelligence is currently based on**:
- Connection existence (yes/no)
- Connection age (timestamp math)
- User focus patterns (localStorage)
- Tab and focus selection (UI state)

**NOT based on**:
- Actual email content
- Actual calendar events
- Actual customer data
- Actual financial transactions
