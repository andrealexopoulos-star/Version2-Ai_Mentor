# Forensic Wave 2 Zero-Drop Audit

## Scope

This audit re-checks four release-critical surfaces at code-contract depth:

1. Competitive Benchmark  
2. Market + Position  
3. BIQc Overview / Advisor Watchtower contract boundary  
4. Email Priority Inbox + Calendar

## Confirmed Critical Drift

### 1) Duplicate watchtower path with competing contracts

- Duplicate route definition existed for `GET /api/intelligence/watchtower` across:
  - `backend/routes/integrations.py` (canonical: positions + events contract)
  - `backend/routes/intelligence_modules.py` (raw RPC contract)
- This created silent precedence risk where router order could change behavior unexpectedly.
- **Remediation implemented**: raw route moved to `GET /api/intelligence/watchtower/positions` in `intelligence_modules.py`.

### 2) Market confidence and status overstatement risk

- `MarketPage` previously defaulted missing status to `STABLE`.
- Banner confidence was not normalized consistently when values arrived as `0..1`.
- Watchtower availability evaluated true for empty event arrays.
- **Remediation implemented**:
  - Added `UNKNOWN` status.
  - Introduced normalized banner confidence.
  - Tightened watchtower availability checks to require non-empty signal payload.
  - Added explicit "supporting signals live but primary narrative calibrating" state.

### 3) Inbox truth and trust clarity gaps

- Connected mailbox identity was captured but not surfaced.
- Freshness messaging was split across disconnected locations.
- Reclassify update did not filter by provider.
- Priority section empty-state copy overstated urgency.
- **Remediation implemented**:
  - Connected account shown in header.
  - Unified freshness line near KPI cards.
  - Reclassify now filters by provider + email id.
  - Empty bucket copy corrected.
  - Detail panel supports high/medium/low reclassification parity.

### 4) Calendar sync honesty and degraded-state transparency

- Header badge always implied synced state.
- Calendar intelligence object fallback used raw JSON stringify.
- Partial load errors were hidden when event data still existed.
- **Remediation implemented**:
  - State-driven sync badge (`Syncing`, `Loading`, `Degraded`, `Synced`, `No events`).
  - Human-readable intelligence summary formatting.
  - Inline degraded warning added when partial failures occur.

### 5) SQL contract hardening and cron execution drift

- `get_priority_inbox` in migration history was `SECURITY DEFINER` with caller-controlled `p_user_id`.
- `trigger_email_priority_refresh()` was a queue-log stub instead of true edge invocation.
- **Remediation implemented in new migration**:
  - `supabase/migrations/069_forensic_zero_drop_hardening.sql`
  - Replaces `trigger_email_priority_refresh()` to dispatch real `net.http_post` calls with service-role auth.
  - Replaces `get_priority_inbox` as `SECURITY INVOKER` with controlled search path.

### 6) Cognition tenancy hardening (remaining permissive RLS family)

- The cognition foundation tables still had legacy `tenant_read ... USING (true)` policies from the original platform migration.
- **Remediation implemented in new migration**:
  - `supabase/migrations/070_rls_tenant_lockdown_cognition.sql`
  - Restricts authenticated `SELECT` to `tenant_id = auth.uid()` across:
    - `episodic_memory`
    - `semantic_memory`
    - `context_summaries`
    - `marketing_benchmarks`
    - `action_log`
    - `llm_call_log`
  - Preserves service-role maintenance with explicit `TO service_role USING (true) WITH CHECK (true)` policies.

## Validation Run

- Frontend production build: **passes** (warnings only, mostly pre-existing hook dependency warnings).
- Backend focused integration file (`test_integration_truth_iteration120.py`): **skipped** in local environment.
- Backend route slice (`test_iteration33_route_slice.py`): **fails due environment/base URL missing**, not due these changes.

## Remaining Workstreams (next PRs)

1. Source-of-truth unification between `priority_inbox` and `email_priority_analysis`.
2. Gmail parity hardening for backend analysis/reply paths.
3. Provenance drawers and per-claim source chains in benchmark/market cards.
4. Zero-regression gates for degraded-state and confidence-claim anti-patterns.
