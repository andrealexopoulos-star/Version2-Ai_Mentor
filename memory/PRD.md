# BIQC Strategic Advisor Platform - PRD

## Architecture — FINAL
- **server.py**: 974 lines (pure orchestrator — init, middleware, router registration)
- **core/ai_core.py**: 1,508 lines (AI response generation, system prompts, cognitive context)
- **Route modules**: 16 files, 9,204 lines total
- **Frontend**: CalibrationAdvisor refactored with CalibrationComponents sub-components
- **Smart-Retry**: 3-tier fallback (website_url → step-only → manual summary)

## Cumulative Test Results: 224/224 (100%)
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
- P3: Run `012_prompt_audit_logs.sql` migration
- P3: Further decompose CalibrationAdvisor.js WOW summary + calibrating states
