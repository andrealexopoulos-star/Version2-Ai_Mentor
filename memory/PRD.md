# BIQC Strategic Advisor Platform - PRD

## Architecture — FINAL
- **server.py**: 171 lines (pure orchestrator)
- **core/**: models.py (362), helpers.py (215), config.py (139), ai_core.py (1,508)
- **Route modules**: 16 files, 9,204 lines total
- **Frontend**: Midnight Navy dark theme, Playfair Display + JetBrains Mono typography
- **Calibration sub-components**: 5 files (CalibrationComponents, WowSummary, CalibratingSession, ExecutiveReveal, ContinuitySuite)

## Brand Identity — Sovereign Command
- Background: Midnight Navy #0A0F1E
- Accents: Sentinel Cyan #00F0FF
- Typography: Playfair Display (headings), Inter (body), JetBrains Mono (data/ticker)
- Aesthetic: Cinematic, high-density, Australian-executive

## Cumulative Test Results: 286/286 (100%)
| Iteration | Tests | Phase |
|-----------|-------|-------|
| 26-33 | 224 | Monolith deconstruction |
| 34 | 16 | Clean Sweep Refactoring |
| 35 | 29 | Deployment Readiness |
| 36 | 17 | Brand Overhaul |

## Pages
- `/` — Landing (Sovereign Command hero, Threat Ticker, 6 Sigma comparison, 3-tier pricing, Trust teaser)
- `/trust` — The Vault (AES-256 badge, Australian sovereignty, 6 security principles)
- `/login-supabase` — Auth (Google, Microsoft, email)
- `/calibration` — Onboarding wizard
- `/advisor` — Main dashboard
- `/admin/prompts` — Prompt Lab (super-admin)

## Deployment Status
- **Code**: 100% functional, all tests pass
- **Blocker**: Platform base image needs change from mongo variant (Emergent support ticket)

## Backlog
- P0: Resolve deployment base image (Emergent support)
- P1: Implement live integrations (Outlook, Google Drive, Xero, Stripe, HubSpot)
- P2: Performance optimization on data-heavy pages
- P2: Slim core/ai_core.py (1,508 lines)
- P3: Further decompose CalibrationAdvisor.js remaining inline logic
