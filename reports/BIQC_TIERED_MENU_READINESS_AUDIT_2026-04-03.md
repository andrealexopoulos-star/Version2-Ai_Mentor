# BIQc Tiered Menu Readiness Audit

Date: 2026-04-03  
Scope: production menu behavior, route gating, Foundation and More Features readiness, and admin/internal surfaces.

## Source Of Truth Reviewed
- `frontend/src/components/DashboardLayout.js`
- `frontend/src/components/MobileNav.js`
- `frontend/src/config/routeAccessConfig.js`
- `frontend/src/lib/tierResolver.js`
- `backend/tier_resolver.py`
- `frontend/src/pages/BIQcFoundationPage.js`
- `frontend/src/pages/MoreFeaturesPage.js`
- `frontend/src/App.js`

## Menu Audit Outcome

### Core Menu (Client Facing)
| Menu Item | Route | Access Class | Current Status | Readiness |
|---|---|---|---|---|
| BIQc Overview | `/advisor` | Free | Active | Fully working |
| Ask BIQc | `/soundboard` | Free | Active | Fully working |
| Inbox | `/email-inbox` | Free | Active | Fully working |
| Calendar | `/calendar` | Free | Active | Fully working |
| Market & Position | `/market` | Free | Active | Working with dependency depth variation |
| Competitive Benchmark | `/competitive-benchmark` | Free | Active | Working with vendor dependency |
| Business DNA | `/business-profile` | Free | Active | Fully working |
| Actions | `/actions` | Free | Active | Fully working |
| Alerts | `/alerts` | Free | Active | Fully working |
| Data Health | `/data-health` | Free | Active | Fully working |
| Connectors | `/integrations` | Free | Active | Fully working |
| Settings | `/settings` | Free | Active | Fully working |
| BIQc Foundation | `/biqc-foundation` | Free entry to paid package | Active | Fully working |
| More Features | `/more-features` | Free entry to staged features | Active | Fully working |

### Foundation Module Readiness
| Module | Route | Current Gate | Runtime Status | Readiness |
|---|---|---|---|---|
| Exposure Scan | `/exposure-scan` | Paid/Foundation | Live | Fully working |
| Marketing Auto | `/marketing-automation` | Paid/Foundation | Live beta | Working with limitations |
| Reports | `/reports` | Paid/Foundation | Live | Fully working |
| Decision Tracker | `/decisions` | Paid/Foundation | Live | Fully working |
| SOP Generator | `/sop-generator` | Paid/Foundation | Live | Fully working |
| Ingestion Audit | `/forensic-audit` | Paid/Foundation | Live | Fully working |
| Revenue | `/revenue` | Paid/Foundation | Live | Fully working |
| Billing | `/billing` | Paid/Foundation | Live | Fully working |
| Operations | `/operations` | Paid/Foundation | Live | Fully working |
| Marketing Intelligence | `/marketing-intelligence` | Paid/Foundation | Live | Fully working |
| Boardroom | `/board-room` | Paid/Foundation | Live | Fully working |

### More Features (Staged)
| Module | Route | Current Gate | Runtime Status | Readiness |
|---|---|---|---|---|
| Risk & Workforce | `/risk` | Waitlist | Partial | Staged |
| Compliance | `/compliance` | Waitlist | Partial | Staged |
| War Room | `/war-room` | Waitlist | Partial | Staged |
| Intel Centre | `/intel-centre` | Waitlist | Partial | Staged |
| Analysis | `/analysis` | Waitlist | Partial | Staged |
| Diagnosis | `/diagnosis` | Waitlist | Partial | Staged |
| Automations | `/automations` | Waitlist | Partial | Staged |
| Documents Library | `/documents` | Waitlist | Partial | Staged |
| Watchtower | `/watchtower` | Waitlist | Partial | Staged |
| Data Center | `/data-center` | Waitlist | Partial | Staged |
| Market Analysis | `/market-analysis` | Waitlist | Partial | Staged |
| Ops Advisory Centre | `/ops-advisory` | Waitlist | Partial | Staged |
| Operator Intelligence | `/operator` | Waitlist | Partial | Staged |

### Admin/Internal Surfaces
| Surface | Route | Access | Status |
|---|---|---|---|
| Admin Dashboard | `/admin` | Super Admin | Active |
| Pricing Control | `/admin/pricing` | Super Admin | Active |
| UX Feedback | `/admin/ux-feedback` | Super Admin | Active |
| Scope Checkpoints | `/admin/scope-checkpoints` | Super Admin | Active |
| Prompt Lab | `/admin/prompt-lab` | Super Admin | Active |
| Support Console | `/support-admin` | Super Admin | Active |
| Observability | `/observability` | Super Admin | Active |

## Parity And Drift Findings
- Desktop/mobile label parity improved for flagship nav labels (`Ask BIQc`, `Inbox`).
- Admin route coverage was expanded in route access config to remove untracked admin-gate drift risk.
- Tier runtime now supports structured multi-paid tiers (`starter`, `pro`, `enterprise`, `custom_build`) while preserving legacy aliases.

## Working Now vs Staged Summary
- Fully working: core free menu + Foundation entry surfaces + major paid Foundation modules.
- Working with limitations: modules that rely on supplier depth quality (especially marketing and external intelligence enrichment).
- Staged: waitlist modules in More Features remain intentional post-foundation rollout candidates.
