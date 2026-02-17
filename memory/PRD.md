# BIQc Platform — Product Requirements Document

## Core Identity
BIQc is the Executive Cognitive Layer — a Sovereign Strategic Partner for Australian SMEs.
Brand tone: Premium, Calm, Sovereign. Focus on Strategic Clarity, Inevitability Detection, Decision Velocity.

## What's Been Implemented

### BIQc Insights Command Surface (Latest)
- **Intelligence Status Bar:** Sticky top panel with Stable/Elevated/Critical badges, color-coded (green/amber/red)
- **Priority Compression:** Center-focused, max 3 compressed signals, generous whitespace, executive typography (Inter Tight + Playfair Display)
- **Opportunity Monitor:** Vertical stack for mobile, Cost of Waiting + Drift Projection cards
- **Executive Memo:** Strategic direction rendered as high-trust briefing, calm typography, wide margins, zero charts
- **Pulse Baselines:** Fact ledger grid display (2-col on desktop, 1-col on mobile)
- **Quick Nav:** 3 action tiles (Strategic Console, Business DNA, Integrations) for calibrated users
- **SWR-powered:** Stale-while-revalidate caching for instant loads + background refresh
- **Data Pipeline:** Bound to /api/executive-mirror which parallel-fetches: user_operator_profile, intelligence_snapshots, business_profiles, strategic_console_state

### Previous Implementations
- ASI-Grade Forensic Audit completed (FORENSIC_AUDIT_20260217.md)
- 24-Node Sidebar with calibration visibility gating
- Dynamic Gap-Filling (17-point Strategic Audit)
- Performance indexes (5 layers, 50+ indexes)
- Skeleton loaders, SWR caching, mobile Titan Glass optimization
- Parallel backend fetches (asyncio.gather)
- Scoring logic extracted to core/scoring.py

### Sidebar Data Anchors
| Node | Executive Job | Data Anchor |
|------|-------------|-------------|
| Intel Centre | Signal Aggregation | observation_events |
| SOP Generator | Strategic Discipline | sops |
| Data Center | Structural Awareness | data_files |
| Diagnosis | Inevitability Detection | diagnoses |
| Email Inbox | Priority Compression | email_intelligence |

## System Status: PARTIALLY CONNECTED
**Single Blocker:** business_profiles RLS policy prevents INSERT/SELECT.
Fix RLS → SYSTEM SOVEREIGN.

## Backlog
### P0 (User Action)
- [ ] Fix RLS on business_profiles
### P1
- [ ] E2E calibration flow
- [ ] Seed test data for BIQc Insights visual verification
### P2
- [ ] Continue profile.py decomposition
- [ ] Video call feature
- [ ] Mobile responsive full audit
