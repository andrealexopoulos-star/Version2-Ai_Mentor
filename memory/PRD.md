# BIQC Strategic Advisor Platform - PRD

## Architecture — FINAL
- **server.py**: 171 lines (pure orchestrator)
- **core/**: models.py (362), helpers.py (215), config.py (139), ai_core.py (1,508)
- **Route modules**: 16 files
- **Frontend**: Sovereign Sentinel dark theme (#050505 + #00F5FF)

## Brand — Sovereign Sentinel
- Background: #050505 (true black)
- Accents: Sentinel Cyan #00F5FF
- Headlines: Inter Tight (black weight)
- Data/Metrics: Geist Mono
- Body: Inter

## Pages
- `/` — Sovereign Command landing (hero, ticker, comparison, pricing, trust teaser)
- `/trust` — The Vault (AES-256, sovereignty, 6 security principles)
- `/login-supabase`, `/register-supabase` — Auth
- `/calibration` — Onboarding wizard
- `/advisor` — Main dashboard
- `/admin/prompts` — Prompt Lab

## Deployment
- Code: 100% functional
- Blocker: Platform base image needs change from mongo variant

## Backlog
- P0: Resolve deployment base image (Emergent support)
- P1: Implement live integrations (Outlook, Google Drive, Xero, Stripe, HubSpot)
- P2: Performance optimization on data-heavy pages
- P2: Login/register visual alignment to Sovereign theme
- P3: Mobile responsive testing for dark theme
