# Calibration 2.0 Zero-Regression Protocol

## Mandate

This protocol defines non-negotiable execution controls for Calibration 2.0, Priority Inbox redesign, Calendar uplift, and full motion-system hardening.

- Zero drop
- Zero regression
- Zero unapproved fallback
- Zero assumption-driven behavior changes
- Zero silent scope changes

## Scope Covered

- Signup -> Auth -> Calibration -> Market flow
- Priority Inbox intelligence UX and data pipeline
- Calendar data integrity, CRUD, and date editing
- Reports generation and report quota gating
- Calibration storage contracts and telemetry contracts

## Current Working Tree Baseline

The repository currently includes uncommitted modifications and must be treated as a moving baseline until explicitly frozen:

- `backend/routes/email.py`
- `frontend/src/context/SupabaseAuthContext.js`
- `frontend/src/hooks/useSnapshot.js`
- `frontend/src/pages/AuthCallbackSupabase.js`
- `frontend/src/pages/ResetPassword.js`
- `supabase/functions/calibration-business-dna/index.ts`

No production deployment may occur without explicit approval and validation against this protocol.

## Execution Phases and Approval Gates

### Phase A — Baseline and Control Plane

Allowed:
- Source-of-truth maps
- Dependency maps
- Contract maps
- Regression matrix
- Telemetry/event taxonomy design
- No behavior changes

Approval output:
- Signed baseline map
- Signed test matrix
- Signed contract map

### Phase B — Calendar Reliability

Allowed:
- Event window correctness
- Date-time edit correctness
- CRUD capability completion
- Token/scope consistency

Approval output:
- CRUD matrix pass
- Date-time regression pass
- Mobile parity check pass

### Phase C — Priority Inbox Redesign

Allowed:
- Source-of-truth consolidation
- Explainability payload and UI
- Thread intelligence and action rail
- Visual redesign in approved style system

Approval output:
- Data consistency pass
- Interaction parity pass
- Provider parity pass

### Phase D — End-to-End Motion System

Allowed:
- Unified motion token system
- Route transition choreography
- Reduced-motion compliance
- De-duplication of animation definitions

Approval output:
- Route choreography pass
- A11y pass
- Performance budget pass

## Hard Change Rules

1. No hidden behavior edits outside approved phase.
2. No fallback behavior unless approved in writing.
3. No database schema change without migration and rollback path.
4. No edge function swap without canonical registry update.
5. No cross-feature edits without dependency impact note.
6. Every file change must map to one approved requirement.

## Regression Test Classes (Mandatory)

- Functional regression (API + UI)
- State-machine regression (calibration routing and completion authority)
- Data integrity regression (storage writes, source/provenance maps)
- Visual regression (critical journey snapshots)
- Accessibility regression (motion and keyboard/contrast checks)
- Performance regression (time-to-wow, first-contentful insight)

## Completion Authority Rules

Routing authority remains:
1. `strategic_console_state.is_complete = true`
2. fallback: `user_operator_profile.persona_calibration_status = 'complete'`
3. else user requires calibration

No bypass may be added or changed without explicit approval.

## Fallback Control

Fallbacks are disabled by default at design level. Any fallback requires:

- Trigger condition
- User-visible disclosure
- Telemetry event
- Recovery path
- Approval reference

## Deployment Guard

Deployment blocked unless all are true:

- Phase approval granted
- Regression suite pass
- Contract validation pass
- Migration validation pass (if applicable)
- Rollback path validated

