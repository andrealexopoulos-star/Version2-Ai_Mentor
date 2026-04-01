# Calibration + CMO Report + Competitor Intelligence Forensic Correction
Date: 2026-03-20  
Target: `https://biqc.ai`

This document is a corrective deep review focused only on:
1) calibration execution fidelity,  
2) CMO report detail availability and correctness,  
3) competitor intelligence reliability.

---

## 1) Live Evidence Executed

### 1.1 Deep probe run (new evidence)
- JSON: `/workspace/.screenshots/deep_calibration_probe_20260320_120812/deep_probe_results.json`
- Screenshot folders:
  - `/workspace/.screenshots/deep_calibration_probe_20260320_120812/auto10x_20260320_093459_01_at_biqctest.io/`
  - `/workspace/.screenshots/deep_calibration_probe_20260320_120812/auto10x_20260320_093459_02_at_biqctest.io/`
  - `/workspace/.screenshots/deep_calibration_probe_20260320_120812/auto10x_20260320_093459_03_at_biqctest.io/`

### 1.2 Deep probe summary (hard numbers)
- Accounts tested: **3**
- `cmo_report_reached`: **0**
- `cmo_snapshot_reached`: **0**
- Calibration route behavior: all 3 accounts requested `/calibration` but ended at advisor shell (`entry_url` captured as advisor route state).

### 1.3 API competitor checks (hard numbers)
From each tested account:
- `GET /api/marketing/benchmark/latest` -> `200 {"status":"no_benchmark"}`
- `POST /api/marketing/benchmark` -> `200 {"status":"feature_disabled","message":"Marketing benchmarks not yet enabled"}`
- `GET /api/competitive-benchmark/scores` -> `404 Not Found`
- `POST /api/competitive-benchmark/refresh` -> `404 Not Found`

---

## 2) Calibration — Every Phase Note + Corrected Scores

Scoring definition:
- 10 = phase is reachable, reliable, and complete with stable evidence
- 7-9 = reachable with partial friction
- 4-6 = inconsistent / degraded
- 1-3 = blocked/unreachable in production path

| Calibration Phase | Score | Forensic Note | What must be done for 10/10 |
|---|---:|---|---|
| Route access to `/calibration` | **2/10** | Deep probe shows route requested but user lands in advisor shell state. | Fix route guard logic so `/calibration` stays reachable for non-complete users during auth bootstrap. |
| Cognitive Ignition | **1/10** | Not reached in deep probe because route gating blocks calibration entry. | Resolve route gate first, then verify ignition renders for new users. |
| Welcome Handshake (website input) | **1/10** | `website-url-input` absent in deep probe for all 3 accounts. | Unblock calibration route and assert selector appears for non-calibrated users. |
| Analyzing state | **1/10** | `analyzing-state` absent because precondition stage not reachable. | Ensure begin-audit flow reaches analyzing with observable progress and timeout fallback. |
| Forensic Identity Verification | **1/10** | `forensic-identity-card` never reached in deep probe (0/3). | Repair earlier phases and guarantee identity stage transition after scan/manual fallback. |
| Chief Marketing Summary (CMO report) | **1/10** | `chief-marketing-summary` never reached in deep probe (0/3). | Restore full transition chain: identity confirm -> wow_summary render. |
| Agent Calibration Chat | **1/10** | Not reached; blocked upstream. | Re-establish flow after CMO confirm and validate chat start selectors. |
| Post-CMO Integration Overlay | **1/10** | Overlay never reached because CMO stage unreachable. | Validate CMO confirm wiring (`handleConfirmWow`) and integration_connect transition. |
| Executive CMO Snapshot (“Here’s what BIQc found”) | **1/10** | `cmo-snapshot` never reached in deep probe (0/3). | Ensure integration_connect completion reliably transitions to `intelligence-first`. |
| Calibration completion path | **2/10** | Flow completion exists in code but not operationally reachable in tested path. | Fix guard + transitions and run full E2E from signup -> complete -> market/advisor. |

### Critical root-cause note (code-level)
`frontend/src/components/ProtectedRoute.js` contains calibration-route gating during `AUTH_STATE.LOADING`:
- For `/calibration`, if cached state is not `NEEDS_CALIBRATION` (including missing cache), it redirects to `/advisor`.
- This can push fresh sessions away from calibration before bootstrap finalizes.

This is directly consistent with deep probe outcomes (`entry_url` not staying on calibration).

---

## 3) CMO Report Detail Audit — Corrected Strength/Weakness Scoring

CMO component has rich structure in code (`ChiefMarketingSummary.js`) but production reachability in tested accounts is blocked.

### 3.1 CMO report reachability score
- **1/10**
- Reason: section not reachable in 3/3 deep probes.
- 10/10 requirement: route flow must reach CMO stage for fresh accounts, then validate all CMO sections with screenshots.

### 3.2 CMO section-level score corrections

| CMO Section (by `data-testid`) | Code Completeness | Runtime Reachability | Corrected Score | Note |
|---|---:|---:|---:|---|
| `business-summary` | High | Not reached | **2/10** | Good template logic, zero production evidence in this deep run. |
| `presence-score` | High | Not reached | **2/10** | Scoring UI exists; not validated live in current flow. |
| `communication-audit` | High | Not reached | **2/10** | Expand/collapse and advice exist in code; not reached. |
| `geographic-presence` | Medium-High | Not reached | **2/10** | Data path exists; runtime blocked. |
| `competitor-intelligence` | Medium | Not reached + dependency caveat | **2/10** | Section explicitly defers detailed scoring to Exposure Scan path. |
| `recommendations` | High | Not reached | **2/10** | Recommendation logic exists but not observed for tested accounts. |
| Continue CTA `cms-continue-btn` | High | Not reached | **2/10** | Action path not verifiable in blocked flow. |

### 3.3 CMO competitor-intelligence subsection correctness
- Corrected score: **2/10**
- Reason:
  - Not reached for tested accounts.
  - Even in code, detailed competitor scoring is explicitly deferred to Exposure Scan, not resolved in CMO itself.
- Needed for 10/10:
  - Reachability restored.
  - Real competitor data shown with source lineage and confidence.
  - No “go elsewhere” dependency to get core competitor insight.

---

## 4) Competitor Intelligence — Corrected Strong Scoring

### 4.1 Competitive benchmark page functional score: **3/10**
Reason:
- Page shell loads, but no real benchmark score flow for tested accounts.
- UI communicates “complete calibration first”; deep probe indicates calibration path itself is blocked.

### 4.2 Endpoint health scorecard

| Endpoint | Score | Evidence | Required for 10/10 |
|---|---:|---|---|
| `GET /api/marketing/benchmark/latest` | **4/10** | Returns 200 but only `{"status":"no_benchmark"}` | Return actual benchmark object after successful scan for calibrated users. |
| `POST /api/marketing/benchmark` | **2/10** | Returns `feature_disabled` for tested accounts | Enable benchmark feature flag and process jobs to completion. |
| `GET /api/competitive-benchmark/scores` | **1/10** | 404 | Either restore route or remove all dependencies/documentation references. |
| `POST /api/competitive-benchmark/refresh` | **1/10** | 404 | Same as above; route consistency required. |

### 4.3 Competitor compare UX score: **2/10**
Reason:
- Analyse action does not produce stable visible competitor result in deep probe.
- API backplane reports benchmark feature disabled.

### 4.4 Root causes (forensic)
1) **Feature flag disabled** for marketing benchmark path in runtime (`feature_disabled` response).  
2) **Legacy endpoint mismatch** (`/api/competitive-benchmark/*` returns 404 while newer flow is under `/api/marketing/benchmark*`).  
3) **Calibration gate issue** prevents the user path from producing preconditions benchmark expects.

---

## 5) Security + Integrity Notes for This Scope

| Item | Score | Note | 10/10 requirement |
|---|---:|---|---|
| Truthfulness of “no data” states | **8/10** | No fabricated competitor benchmark returned; mostly honest “no benchmark / disabled.” | Keep honesty and add explicit reason banner + admin remediation hint. |
| Capability promise alignment | **2/10** | User-facing competitor intelligence promise is ahead of live enabled backend state in tested path. | Align marketing copy and feature flags with deployed capability. |
| Route consistency (old vs new APIs) | **2/10** | Mixed expectations; legacy benchmark endpoints return 404. | Standardize on one endpoint family and remove dead references/tests. |

---

## 6) Immediate Fix Order (strict)

1. **Fix calibration route gating first** (`ProtectedRoute.js` loading-state behavior for `/calibration`).  
2. **Enable benchmark feature flag** for production accounts that should have competitor intelligence.  
3. **Resolve benchmark endpoint contract** (either restore `/competitive-benchmark/*` or remove all stale dependencies and tests).  
4. **Run a fresh end-to-end validation**: signup -> calibration full -> identity -> CMO -> integration overlay -> snapshot -> competitive benchmark with real score returned.  
5. **Only after successful flow, update scoring upward** with screenshot proof per stage.

