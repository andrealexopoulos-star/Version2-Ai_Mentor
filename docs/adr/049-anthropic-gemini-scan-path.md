# ADR-049 — Anthropic + Gemini in the URL Scan Synthesis Path

- **Status:** Accepted (WIRE-IN-with-observability posture)
- **Date:** 2026-05-04
- **Author:** P0-Marjo-E9 agent (BIQc platform)
- **Supersedes / Related:** PR #449 (CMO scan edge coverage), Contract v2 (Secure No-Silent-Failure), feedback_zero_401_tolerance
- **Decision authority:** Andreas (CTO) — code `13041978` required to push

---

## 1. Context

PR #449 acknowledged that Anthropic and Gemini providers were "configured in other functions, not proven in scan path." Contract v2 forbids silent ambiguity at the synthesis layer, where customer-grade intelligence is generated for the Chief Marketing Officer (CMO) report:

- Executive Summary
- CMO Executive Brief
- SWOT (with competitor SWOT)
- Strategic Roadmap / CMO Priority Actions
- UVP, market position, recommended keywords

If the synthesis pass falls back silently to a single provider, BIQc users receive intelligence labeled "Trinity-grade" that was actually OpenAI-only — a Contract v2 violation (false confidence) and a Trinity-tier feature parity gap.

## 2. State of the world (2026-05-04)

### 2.1 Code is wired

Anthropic and Gemini are fully implemented in `backend/core/llm_router.py`:

- `_anthropic_chat()` (lines 362-403) — calls `https://api.anthropic.com/v1/messages` with `claude-opus-4-6` (default).
- `_gemini_chat()` (lines 337-359) — calls `https://generativelanguage.googleapis.com/v1beta/models/...` with `gemini-3-pro-preview` (default).
- `llm_trinity_chat()` (lines 489-635) — fans out to OpenAI + Gemini + Anthropic in parallel, then synthesizes via Anthropic Opus (with OpenAI/Gemini fallback chain).

### 2.2 Scan path uses Trinity

The URL Scan synthesis call lives at `backend/routes/calibration.py:2272-2293` and dispatches via `core.ai_core.get_ai_response(..., metadata={"force_trinity": True})`. The `force_trinity` flag in `core/ai_core.py:87-96` unconditionally routes to `llm_trinity_chat`.

So the **code path is correct** — Trinity is invoked for CMO synthesis.

### 2.3 Production secret presence is unverified

- `docs/CALIBRATION_SECRET_MATRIX.md` (canonical) lists `OPENAI_API_KEY` as required for `deep-web-recon`, `market-analysis-ai`, etc., but **does NOT list `ANTHROPIC_API_KEY` or `GOOGLE_API_KEY`**.
- `AZURE_ENV_VARS_CHECKLIST.md` does not include them in the biqc-api block.
- `backend/.env.example` defines them but marks Gemini "(optional)".

### 2.4 Silent fallback risk

`llm_trinity_chat` (lines 516, 529, 542) skips a provider when the key is absent (`if KEY:`). At line 576 it returns the single survivor. **No telemetry is emitted today distinguishing "Trinity-with-3-providers" from "Trinity-with-1-provider".**

This is the Contract v2 ambiguity surface that PR #449 flagged.

## 3. Decision

**ACCEPT WIRE-IN with mandatory observability.**

Rationale:

1. **The code is already wired** — there is no architectural reason to retreat to single-provider synthesis. Multi-provider quorum cross-checks LLM hallucination on SWOT and roadmap items, which directly improves CMO-report quality. This is the retention moat at the synthesis layer.

2. **The cost ceiling is acceptable.** Synthesis is the only Trinity leg in the scan path; deep-web-recon, semrush, browse-ai, etc. remain single-provider OpenAI/Perplexity. Per-scan synthesis cost is roughly 3x the OpenAI-only baseline at the input-token volume (~10-20k input, ~2k output). At Pro-tier scan cadence this is bounded.

3. **The retreat to NOT-REQUIRED would be wrong.** Andreas's standing rules forbid "fallback to empty" and "confident default when data absent." A silent collapse from 3-provider quorum to 1-provider synthesis is the same anti-pattern at the LLM layer.

4. **The MISSING piece is observability, not wiring.** We need to emit a `provider_trace` for every Trinity invocation that records which providers participated, which produced output, and which one synthesized — surfaced internally (Contract v2 INTERNAL layer) and never leaked externally.

## 4. Implementation

This ADR is shipped together with these code changes (this PR):

### 4.1 Provider-trace logging in `llm_trinity_chat`

`backend/core/llm_router.py` is augmented with a lightweight in-process trace emitter:

```python
def _emit_trinity_trace(*, requested: list[str], succeeded: list[str], failed: list[dict],
                        synthesis_provider: str | None, user_id: str | None, feature: str) -> None:
    """Internal-only structured log for Trinity provider participation."""
    logger.info(
        "[Trinity Trace] requested=%s succeeded=%s failed=%s synth=%s user=%s feature=%s",
        requested, succeeded, failed, synthesis_provider, str(user_id or "")[:8], feature,
    )
```

Called at the end of every `llm_trinity_chat` invocation. Output is structured for downstream parsing into `enrichment_traces` (E2) once that table ships.

### 4.2 Quorum-state classification

The trace records a `quorum_state` derived from the success set:

- `FULL_QUORUM` — 3 providers participated and synthesis ran on Opus.
- `PARTIAL_QUORUM` — 2 providers participated.
- `SINGLE_PROVIDER` — only 1 provider had a key/succeeded. **This maps to Contract v2 external state `DEGRADED`** for any caller that surfaces Trinity quality signals.
- `FAILED` — no provider succeeded → exception propagates (existing behavior).

### 4.3 `get_router_config()` extension

The health endpoint output now includes a `quorum_capability` field:

```python
{
  "providers": {"openai": True, "google": False, "anthropic": False},
  "quorum_capability": "SINGLE_PROVIDER",  # or PARTIAL/FULL
}
```

This surfaces the deployment-state truth so the daily health check (`ops_daily_health_check_procedure.md`) can flag a missing key as P0.

### 4.4 Tests

`backend/tests/test_llm_quorum.py` covers:

1. `get_router_config()` reports `quorum_capability` matching key presence.
2. `_emit_trinity_trace` produces structured output with all required fields.
3. `_classify_quorum_state` returns the correct enum for each provider-count.

End-to-end Trinity calls are NOT exercised in unit tests (no live API keys in CI) — they are covered by the existing `test_iteration127_trinity_deep_scan.py` smoke suite against production.

## 5. Compensating coverage

Even before the production keys are provisioned, this PR closes the Contract v2 ambiguity surface:

| Risk | Mitigation in this PR |
|---|---|
| Silent collapse to 1-provider synthesis | `quorum_state=SINGLE_PROVIDER` is logged and surfaced via `get_router_config()` |
| Deployment-state drift (key gets removed) | Daily health check can read `quorum_capability` and fire P0 if it regresses below FULL_QUORUM |
| LLM hallucination on SWOT items | Trinity Opus synthesis (when keys present) cross-validates 3 candidates → reduces single-model bias |
| External leak of provider names | `_emit_trinity_trace` is INTERNAL only; sanitizer (Contract v2) keeps `quorum_state` out of frontend payloads |

## 6. Alternatives considered

### Alt-A: NOT-REQUIRED ADR (single-provider OpenAI-only)

Rejected. The 2026-04-23 SEMRUSH P0 forensics established that BIQc cannot afford "confident-default-when-data-absent" patterns. A single-provider synthesis with a Trinity-grade UI label is the same anti-pattern at the LLM layer — it tells Pro-tier users they're getting cross-validated intelligence when they're not.

### Alt-B: Wire-in without observability

Rejected. This is the current state PR #449 flagged. Wiring without trace emission means we can't answer "did this CMO report come from quorum or single-provider?" — Contract v2 forbids that ambiguity.

### Alt-C: Hard-fail when ANTHROPIC_API_KEY/GOOGLE_API_KEY missing

Considered. This would force key provisioning. Rejected for now because it introduces a deploy-time blast radius (one missing env var bricks all scans). Better path: log + alert via daily health check, then promote to hard-fail once all environments are confirmed provisioned. **Revisit gate: once `quorum_capability=FULL_QUORUM` has been green for 7 consecutive days in production**, this ADR should be amended to switch the policy to hard-fail.

## 7. When to revisit

- **Trigger 1:** `ANTHROPIC_API_KEY` and `GOOGLE_API_KEY` are confirmed provisioned in all environments → switch to hard-fail (Alt-C).
- **Trigger 2:** E2 (`enrichment_traces` table) ships → bind `_emit_trinity_trace` to write a row per scan synthesis, not just a log line.
- **Trigger 3:** Trinity cost ceiling exceeds budget at GA scan cadence → revisit synthesis-only-on-Pro-tier, OpenAI-only on Trial.
- **Trigger 4:** A new flagship model from any provider (Anthropic / OpenAI / Google) supersedes the current default → update `ROUTE_TABLE` defaults.

## 8. References

- `BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.md` — the "no silent failure + no internal leakage" rule this ADR enforces at the LLM layer.
- `feedback_zero_401_tolerance.md` — the standing rule that bans fallback-to-empty.
- `feedback_ask_biqc_brand_name.md` — the brand-name rule (Trinity surfaces are still labeled "BIQc Trinity", never "OpenAI", "Claude", "Gemini").
- `docs/CALIBRATION_SECRET_MATRIX.md` — to be amended in a follow-up to add `ANTHROPIC_API_KEY` and `GOOGLE_API_KEY` to the optional-degradation column once Trigger 1 fires.
- `backend/core/llm_router.py` — the wired implementation.
- `backend/routes/calibration.py:2272-2293` — the scan-path entry to Trinity synthesis.
- `backend/core/ai_core.py:87-96` — the `force_trinity` dispatch.

---

**This ADR is binding. Code `13041978` required to push the implementation.**
