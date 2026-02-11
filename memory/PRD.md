# BIQC Platform — PRD

## Baseline Initialization & Executive Synthesis Sprint (Feb 2026)

### Part 1 — Database-Backed Baseline — PASS
- `POST /api/intelligence/cold-read` now inserts `baseline_initialized` into `intelligence_snapshots` when events_created == 0
- SQL proof: Record exists with `snapshot_type: baseline_initialized`, `domains.enabled: [sales, finance, operations]`, `domains.integrations_checked: [HubSpot, Xero, outlook]`
- WOW Landing displays: green dot + "Baseline Initialized — Checked: HubSpot, Xero, outlook | Monitoring: sales, finance, operations"
- Persists across page refresh (DB-backed, not local state)

### Part 2 — Data Readiness Panel — PASS
- `GET /api/intelligence/data-readiness` returns per-integration: provider, category, status, connected_at, observation_events count
- Operator View renders Data Readiness section with real DB state
- API confirmed: HubSpot (crm, 0 events, since 2026-02-06), Xero (accounting, 0 events, since 2026-02-09), Outlook (email, 0 events, since 2026-02-11)

### Part 3 — Executive Memo — PASS
- Data-bound, no hallucination
- References: "andre" (user name), "Professional Services" (confirmed industry fact), "3 connected data sources (HubSpot, Xero, outlook)" (DB integration count), "sales, finance, operations" (enabled domains)
- Full text: "andre, based on your confirmed Professional Services focus and 3 connected data sources (HubSpot, Xero, outlook), I have initialized monitoring across sales, finance, operations. Baseline established — I will surface material changes as they occur."

### Part 4 — Run Analysis Feedback — PASS  
- events_created == 0: Toast shows "Baseline Initialized. No material changes detected yet."
- events_created > 0: Normal intelligence output
- No animation in this sprint

### Endpoints Added/Modified
- `POST /api/intelligence/cold-read` — now inserts baseline_initialized snapshot
- `GET /api/intelligence/baseline-snapshot` — returns latest baseline snapshot
- `GET /api/intelligence/data-readiness` — per-integration status from DB

### Files Modified
- `backend/server.py` — 3 endpoint changes
- `frontend/src/pages/AdvisorWatchtower.js` — Executive Memo, Baseline display, Run Analysis feedback
- `frontend/src/pages/OperatorDashboard.js` — Data Readiness panel
