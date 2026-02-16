# BIQC Strategic Advisor Platform - PRD

## Architecture — FINAL (Post Clean Sweep)
- **server.py**: 171 lines (pure orchestrator — init, middleware, router registration)
- **core/models.py**: 362 lines (all Pydantic models)
- **core/helpers.py**: 215 lines (file parsing, search, auth utilities)
- **core/config.py**: 139 lines (middleware, env vars, service initialization)
- **core/ai_core.py**: 1,508 lines (AI response generation, system prompts, cognitive context)
- **Route modules**: 16 files, 9,204 lines total
- **Frontend CalibrationAdvisor.js**: 323 lines (state manager, uses 5 sub-components)
- **Calibration sub-components**: CalibrationComponents.js (160), WowSummary.js (137), CalibratingSession.js (142), ExecutiveReveal.js (54), ContinuitySuite.js (48)

## Cumulative Test Results: 240/240 (100%)
| Iteration | Tests | Phase |
|-----------|-------|-------|
| 26 | 14 | Security P0 |
| 27 | 39 | Phase 2 Extraction |
| 28 | 51 | Final Cleanup |
| 29 | 35 | Cognitive Migration |
| 30 | 36 | Route Sync Audit |
| 31 | 9 | Prompt Lab |
| 32 | 9 | Beta Launch Clearance |
| 33 | 31 | Final Slice |
| 34 | 16 | Clean Sweep Refactoring |

## Route Module Inventory (16 modules)
| Module | Lines | Routes |
|--------|-------|--------|
| profile.py | 2,033 | 14 |
| email.py | 1,818 | 18 |
| calibration.py | 1,167 | 12 |
| integrations.py | 1,128 | 20 |
| onboarding.py | 595 | 8 |
| generation.py | 564 | 17 |
| research.py | 451 | 1 |
| cognitive.py | 273 | 9 |
| soundboard.py | 257 | 5 |
| boardroom.py | 245 | 2 |
| admin.py | 237 | 10 |
| data_center.py | 130 | 7 |
| auth.py | 112 | 5 |
| intelligence.py | 94 | 6 |
| watchtower.py | 71 | 4 |
| facts.py | 29 | 2 |

## Backlog
- P1: Implement Live Integrations (Outlook, Google Drive, Xero, Stripe, HubSpot)
- P2: Performance optimization on data-heavy pages
- P3: Further decompose CalibrationAdvisor.js remaining inline logic
