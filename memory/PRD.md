# BIQc Platform - Product Requirements Document

## Design System: Liquid Steel
- **Background**: #0F1720, panels #141C26, sidebar #0A1018
- **Borders**: 1px solid #243140
- **Text**: #FFFFFF (headings), #F4F7FA (primary), #9FB0C3 (secondary), #64748B (muted)
- **Accent**: #FF6A00 (alerts, actions, active states)
- **Typography**: Cormorant Garamond (elegant serif headings), Inter (body), JetBrains Mono (metrics)

## Transformation Complete — All Phases

### Phase 1 ✅ Fonts + Naming (iteration_55 — 100%)
### Phase 2 ✅ Login/Register (iteration_56 — 100%)
### Phase 3 ✅ Platform Layout (iteration_57 — 100%)
### Phase 4 ✅ Super Admin Portal — 8 Pages (iteration_58 + 59 — 100%)

## Super Admin Portal — 8 Enterprise Governance Pages

| Page | What It Contains | Real Data? |
|---|---|---|
| Command Centre | Platform health, worker status, Edge Functions, strategic inevitabilities | YES — health.py API |
| User Admin | Search, user list, detail panel, suspend/unsuspend, impersonate | YES — admin.py API |
| Governance | Role hierarchy (5 tiers), audit trail, data sovereignty, governance controls | PARTIAL — roles real, controls planned |
| Security | 10 hardening items, 10 procurement readiness items with status badges | Status tracking — features planned |
| AI Governance | 12 AI agents listed, token tracking, prompt audit, governance controls | YES — usage_tracking + prompt_audit_logs |
| Commercial | MRR/ARR, revenue intelligence, sales pipeline, subscription tiers | MOCK — needs Stripe |
| Operations | 6 kill switches, automation rules, team oversight | Visual — needs backend |
| Growth | Growth infrastructure, trust signals, config intelligence | PARTIAL |

## Next: Rest of Migration
- Theme individual page content (AdvisorWatchtower, Settings, Integrations, etc.)
- Each page's internal content needs dark theme styling

## Test Credentials
- Superadmin: andre@thestrategysquad.com.au / BIQc_Test_2026!
