# BIQc Zero Regression Release Playbook

This playbook is the mandatory standard for releasing BIQc without website or platform regression.

Related operating documents:
- `docs/operations/ZD_ZR_ZA_MANAGER.md`
- `docs/operations/UNIFIED_PLATFORM_AUDIT_EXECUTION_BLUEPRINT.md`

## Release Objective

Deliver production changes with:
- no website experience regression,
- no calibration or intelligence contract regression,
- no auth/routing regression,
- no silent edge-function failure regression.
- no un-attributed high-impact advisor recommendation.

## Non-Negotiable Gates

All of the following must pass in CI/CD before release is accepted:

1. Website change gate
- Protected website paths require explicit approval token.
- Unapproved website changes block release.

2. Pre-prod forensic gate
- Required release secrets present.
- Critical edge probes return expected non-5xx contracts.
- Any unexpected 5xx is a blocking failure.

3. Image pin gate
- Frontend and backend app services converge to expected image tag.
- Tag drift is blocking.

4. Routing and auth smoke gate
- `https://biqc.ai` returns homepage baseline.
- `https://biqc.ai/calibration` serves SPA route.
- `https://biqc.ai/api/health` returns 200.
- `https://biqc-api.azurewebsites.net/api/health` returns 200.
- Auth-gated probes return `401` or `403` where expected.

5. Domain binding and identity gate
- `biqc.ai` remains bound to frontend web app.
- Supabase `site_url` remains locked to `https://biqc.ai`.

## Golden User Journeys (Post-Deploy)

Run these as post-deploy evidence checks:

1. Onboarding scan journey
- Start calibration with known test domain.
- Confirm `What We Found` cards render.
- Confirm no malformed JSON-like claims in cards.

2. Intelligence card journey
- Confirm Customer Review Intelligence renders evidence when public signals exist.
- If evidence is insufficient, confirm reasoned insufficiency copy (not generic/free-tier blanket).

3. SoundBoard continuity journey
- Create chat conversation.
- Confirm returned `conversation_id` is retrievable.

## Visual Regression Policy

For calibration intelligence surfaces:
- Use only approved Liquid Steel + Lava Orange palette and shades.
- No unapproved accent colors in core intelligence cards.

## Rollback Triggers (Immediate)

Rollback must be executed if any of these occur:
- Homepage, calibration route, or health checks fail post-deploy.
- Edge contract gate reports unexpected 5xx.
- Auth routing no longer returns expected gated statuses.
- SoundBoard conversation retrieval fails for newly created conversations.
- Critical UI corruption on onboarding/calibration path.

## Rollback Procedure

1. Stop forward deploys.
2. Re-point frontend and backend to last known good image tags.
3. Re-run smoke checks on production domain and direct app hosts.
4. Capture incident note with failing step, SHA, and rollback SHA.
5. Open corrective patch branch with regression root cause and test evidence.

## Evidence Required in Release Record

Each production release record must include:
- commit SHA and workflow run URL,
- forensic gate version marker and result,
- smoke test outcomes for website/API/auth routes,
- image pin verification outcomes,
- rollback decision (not needed / executed).

