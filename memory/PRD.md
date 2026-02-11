# BIQC Platform — Product Requirements Document

## Original Problem Statement
The BIQC platform is a strategic business intelligence system backed by Supabase. It provides AI-driven intelligence through a Board Room interface, Watchtower continuous monitoring, escalation memory, contradiction detection, and pressure calibration.

## Core Architecture
- **Backend**: FastAPI with modularized routes in `routes/` directory
- **Frontend**: React with Supabase Auth context
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o via Emergent LLM Key

## What's Been Implemented

### Data Plane & Auth (COMPLETE)
- Supabase as single source of truth (MongoDB decommissioned)
- `user_operator_profile` as sole authority for calibration/onboarding state
- Admin route enforcement, SDK guardrails

### Global Fact Authority (COMPLETE)
- `fact_resolution.py` prevents redundant questioning across all AI interfaces
- Integrated into Board Room, Chat, and Onboarding flows

### Codebase Modularization (IN PROGRESS)
- 7 route groups extracted: admin, boardroom, calibration, facts, intelligence, onboarding, watchtower
- `server.py` still ~9000+ lines — remaining routes need extraction

### UX Stage 1: Priority Compression (COMPLETE — Feb 2026)
- **Backend**: `rank_domains()` function in `routes/boardroom.py` scores domains by severity (40), pressure (30), contradiction (+15 each), persistence (capped 15), decision window compression (20/10/5)
- **Response**: `priority_compression` field with `primary`, `secondary` (max 3), `collapsed` structure
- **Frontend**: BoardRoom.js renders Primary Focus card, Secondary items, collapsible evidence, expandable collapsed domains
- **Invariants preserved**: resolve_facts injection, escalation logic, pressure logic, route paths, SDK guardrails

## Prioritized Backlog

### P0
- Delete "SAFE TO DELETE" Category C routes per forensic audit

### P1
- Complete modularization of `server.py` (chat, business profile, settings, legacy integrations)

### P2
- Performance optimization for data-heavy pages (Business DNA, Settings)
- Remove dead `calibration_status` writes from `routes/calibration.py`
- War Room Fact Authority integration

### P3
- E2E authenticated testing of Board Room Priority Compression view
