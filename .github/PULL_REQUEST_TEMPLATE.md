<!-- 2026-05-05 (13041978) — PR template enforcing OPS Manual entry 01 principles. -->

## Summary

<!-- 1–3 sentences. What changed and why. -->

## Code 13041978 approval

- [ ] This PR has explicit Andreas approval with code `13041978`.

## Token metering & no-drop guarantee (per OPS Manual entry 01)

If this PR adds, modifies, or moves any LLM call site:

- [ ] Every new LLM call routes through `llm_router.llm_chat_with_usage` (Python) or `recordUsage()` / `recordUsageSonar()` (Deno).
- [ ] `user_id` and `tier` are threaded into every `llm_chat*` call (otherwise `_record_usage` short-circuits silently at line 265).
- [ ] `request_id` is set so the idempotency unique index can prevent double-counting.
- [ ] If this is a new background loop or cron schedule: a row is added to `public.background_loop_registry` with `default_enabled`, `excluded_tiers`, `tokens_estimate_per_user_run`, and `off_consequence_summary`.
- [ ] If this is a new LLM provider: a row is added to `public.llm_providers` with default pricing.
- [ ] CI script `scripts/check-no-orphan-llm-calls.sh` passes locally.

## Zero-regression rollout (per principle P6)

- [ ] Change ships behind a feature flag (default OFF).
- [ ] Dual-write or shadow-write strategy documented if changing existing metering paths.
- [ ] Synthetic E2E test extended if a new billable surface is introduced.

## Test plan

<!-- Checklist of how this was verified. Include reconciliation if metering touched. -->

- [ ] Frontend build: `cd frontend && CI=false npm run build` passes
- [ ] Backend tests: relevant pytest suite green
- [ ] Live MCP query (if applicable): expected row counts match
- [ ] Reconciliation soak: N/A or pending

## OPS Manual reference

<!-- Link to the relevant section of /Users/andreasalexopoulos/Documents/BIQc-Ops-Manual/entries/<entry>.html -->

OPS Manual entry: …

🤖 Generated under code 13041978 oversight.
