# BIQc FORENSIC PLATFORM AUDIT — Feb 26, 2026
## Truth Assessment: Completed vs Placeholder vs Synthetic

---

## 1. ONBOARDING FLOW
**Status:** ✅ Implemented (Flow Mechanics) | 🟡 Intelligence Depth Incomplete

**What IS complete:**
- Enforced flow path (Domain → Identity Verification → CMS → Snapshot → Dashboard)
- WOW summary validation logic
- Identity approval gate with 4 buttons + confidence scoring
- CTA sequencing with 3s gating
- Snapshot fast path + timeout
- No skip-to-dashboard loophole (admin skip exists, gated by role)
- Perplexity-first 5-query domain scan (identity, services, market, team, competitors)
- Deterministic identity signal extraction (ABN, phone, email, address, socials)

**What is NOT complete:**
- Full 13-layer scoring uses field-existence checks, not weighted components
- No saturation modelling engine
- No category positioning map engine
- No trust footprint detection (testimonials/certifications counted but not scored)
- No demand capture modelling
- No funnel friction engine
- Competitor data from Perplexity is narrative, not structured comparison

**Synthetic Risk:** 🟡 MEDIUM
- 13-layer footprint score IS based on real extracted data, but scoring is binary (field exists = 100%, partial = 50%)
- No weighted scoring formula — this is honest but shallow
- "High confidence 11/13 layers scored" is technically accurate but may overstate depth

---

## 2. CHIEF MARKETING SUMMARY
**Status:** 🟡 Partially Implemented

**What IS complete:**
- Structured summary rendering with 13 layers
- SMB field mapping from extracted data
- No empty card rendering (conditional suppression)
- Confidence capping by identity confidence
- Digital gaps detection
- Leverage points identification

**What is NOT complete:**
- No weighted component scoring formula
- No local density score
- No trust footprint scoring engine
- No category positioning mapping engine
- Confidence is count-based (layers scored / total), not quality-weighted

**Synthetic Risk:** 🟡 MEDIUM
- Scores are real (derived from data), but simplistic
- No fabricated numbers — all from extracted fields
- "Market Presence Score 61/100" is a real calculation but not a sophisticated model

---

## 3. MARKET TAB
**Status:** 🟡 Intelligence Layer Functional | ✅ Integration Suppression Active

**What IS complete:**
- Integration status via canonical endpoint
- CRM connected/not connected logic
- Integration truth suppression (CRM_TERMS filtering) — VERIFIED
- Conditional rendering when data absent
- Action buttons on insights ("Execute in Chat")
- Reports tab
- Scroll fix

**What is NOT complete:**
- No unified Market Presence Score on this page
- No saturation modelling
- No demand capture gap logic
- No cross-channel consistency scan
- No ad saturation score
- No local density modelling

**Synthetic Risk:** ✅ LOW
- CRM claims suppressed when no CRM connected — VERIFIED in code
- Pipeline/churn/lead metrics null without integration — VERIFIED
- No placeholder data found in MarketPage.js

---

## 4. REVENUE PAGE
**Status:** ✅ Clean — Reads Real Data Only

**Verified in code (RevenuePage.js line 55):** `// Use ONLY real data — no demo fallback`
- Only renders deals if CRM data exists
- Shows "Connect CRM to view revenue data" when no integration
- DataConfidence component shows data source
- No hardcoded values found

**Synthetic Risk:** ✅ NONE

---

## 5. RISK PAGE
**Status:** ✅ Conditional Rendering — No Placeholders Found

- Risk metrics read from cognitive snapshot
- Suppression active for no-data states
- No hardcoded risk values found

**Synthetic Risk:** ✅ NONE

---

## 6. OPERATIONS PAGE
**Status:** 🟡 Reads Snapshot — No Deep Modelling

- Reads from cognitive snapshot (execution, SLA, bottleneck)
- No hardcoded operations data found
- Still imports FloatingSoundboard (should use DashboardLayout panel)

**Synthetic Risk:** ✅ LOW
- Data comes from snapshot, which is AI-generated from real signals
- No fabricated metrics

---

## 7. ADVISOR WATCHTOWER (BIQc Overview)
**Status:** 🟡 Functional — Reads Snapshot

- Groups alerts by domain from cognitive snapshot
- Revenue details only shown if `rev.pipeline || rev.weighted || rev.churn` exists
- No hardcoded values found
- Still imports FloatingSoundboard

**Synthetic Risk:** ✅ LOW

---

## 8. DATA HEALTH PAGE
**Status:** 🔴 CRITICAL — DEMO FALLBACK ACTIVE

**File:** `DataHealthPage.js` lines 64-74
```javascript
// If no live data, use demo
if (systems.length === 0) {
  [
    { name: 'Xero', status: 'connected', health: 98 },
    { name: 'HubSpot', status: 'connected', health: 95 },
    { name: 'Outlook', status: 'connected', health: 100 },
    ...
  ].forEach(s => systems.push(s));
}
```

**Also line 79:** `const dqCompleteness = readiness?.score ? Math.round(readiness.score) : 94;`
— Falls back to 94% completeness when no real data.

**This is a PLACEHOLDER VIOLATION.** Shows fake connected integrations when none exist.

**FIX REQUIRED:** Replace demo fallback with "No integrations connected" empty state.

---

## 9. INDUSTRY DEMO PAGES
**Status:** 🔴 HARDCODED DEMO DATA

**Files:**
- `pages/website/platform/industries/SaaSView.js` — Hardcoded metrics, fake executive memo with specific client names ("Nexus Corp $2.4K MRR")
- `pages/website/platform/industries/AgencyView.js` — Same pattern
- `pages/website/platform/industries/ConsultingView.js` — Same pattern

**Risk:** These are public-facing DEMO pages, not authenticated pages. If they're linked from the product tour, they show synthetic data that implies real platform capability.

**Assessment:** These are acceptable as marketing demos IF clearly labeled as demo/example. NOT acceptable if presented as real intelligence.

---

## 10. AUTH DEBUG PAGE
**Status:** 🟡 Development Tool — Not User-Facing

**File:** `AuthDebug.js` line 45 — Uses `testing@biqc.demo` test email
**Assessment:** Development tool only, not visible to users. LOW risk.

---

## 11. COMPLIANCE PAGE
**Status:** 🟡 Reads Snapshot — No Deep Modelling

- No compliance engine exists
- Reads regulatory data from cognitive snapshot if present
- No hardcoded compliance data found

**Synthetic Risk:** ✅ LOW

---

## 12. SOUNDBOARD / CHAT
**Status:** ✅ Partially Deterministic

**What IS done:**
- Routes data queries to Edge Function
- Shows integration status on first Market visit
- BNA update with confirmation
- Source attribution on responses

**What is NOT done (from audit C5):**
- Chat doesn't explicitly refuse unsupported requests
- Chat doesn't reference snapshot signals in responses
- No structured source attribution per response

**Synthetic Risk:** ✅ LOW — uses real data via Soundboard backend

---

## 13. PRICING & TIERS
**Status:** 🔴 NOT IMPLEMENTED

- No subscription enforcement
- No feature gating (Forensic Calibration shows "Coming soon" text only)
- No Stripe integration
- UI references tier capabilities without enforcement

**Synthetic Risk:** 🟡 MEDIUM — Pricing page shows plans/features that don't enforce

---

## 14. WORKFORCE / PEOPLE
**Status:** 🔴 NOT BUILT — No dedicated module exists

---

## 15. GROWTH / SCENARIO PLANNING
**Status:** 🔴 NOT BUILT — No scenario engine exists

---

## 16. OLD FloatingSoundboard IMPORTS
**Status:** 🟡 CLEANUP NEEDED

Pages still importing the old FloatingSoundboard (now replaced by DashboardLayout panel):
- OperationsPage.js
- AdvisorWatchtower.js
- RevenuePage.js
- AutomationsPageAuth.js
- RiskPage.js

These should be removed since DashboardLayout now includes the persistent panel.

---

## CRITICAL FIXES REQUIRED (Priority Order)

### FIX 1: DataHealthPage demo fallback (🔴 P0)
Remove hardcoded demo systems. Replace with empty state.

### FIX 2: Remove old FloatingSoundboard imports (🟡 P1)
Remove from 5 pages that still import it.

### FIX 3: DataHealthPage completeness fallback (🟡 P1)
Remove `94` fallback — show "No data" instead.

---

## PLATFORM STATE SUMMARY

| Domain | Status | Synthetic Risk |
|--------|--------|----------------|
| Flow Mechanics | ✅ Solid | None |
| Data Suppression | ✅ Strong (CRM_TERMS) | None |
| Digital Footprint Depth | 🟡 Binary scoring | Low |
| Market Intelligence | 🟡 Perplexity-powered | Low |
| Revenue/Risk/Ops | ✅ Clean — real data only | None |
| Data Health Page | 🔴 Demo fallback active | **HIGH** |
| Industry Demos | 🔴 Hardcoded demo data | Medium (marketing) |
| Workforce Intelligence | 🔴 Not built | N/A |
| Growth Modelling | 🔴 Not built | N/A |
| Tier Architecture | 🔴 Not built | Medium |
| Scoring Engine | 🟡 Exists but simplistic | Low |
| Confidence Indicators | ✅ Implemented | None |
| Placeholder Removal | 🟡 1 critical violation found | **DataHealthPage** |

## HARD TRUTH

The platform is **cleaner than the audit expected**. Previous sessions successfully purged most fake data from Revenue, Risk, Operations, and Market pages.

**One critical violation remains:** DataHealthPage shows fake connected integrations when none exist.

**The gap is NOT widespread placeholder contamination.** It's:
1. One demo fallback in DataHealthPage
2. Simplistic scoring (binary, not weighted)
3. Missing deep modelling layers (workforce, growth, scenarios)
4. Stale FloatingSoundboard imports
