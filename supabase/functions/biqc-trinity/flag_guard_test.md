# biqc-trinity — `trinity_synthesis_enabled` flag guard test strategy

Sprint D #28c wired migration 124's `trinity_synthesis_enabled` kill-switch
into `supabase/functions/biqc-trinity/index.ts`. Deno tests are not yet run
in CI for this repo, so this file documents the manual verification plan
Andreas (or an on-call) runs after deploys that touch the guard.

The guard lives in the `isTrinityEnabled(sb)` helper called from the main
`Deno.serve` handler, right after request-body parsing and BEFORE the
`Promise.allSettled([callModel(...), callModel(...), callModel(...)])` fan-out.

## What the guard does

- Cheap single `SELECT enabled FROM public.feature_flags WHERE flag_key = 'trinity_synthesis_enabled'`.
- Result cached for the invocation (one SELECT per edge-fn call, not per leg).
- If `enabled = false` → returns **HTTP 503** with body
  `{"error":"trinity_synthesis paused by admin","reason":"feature_flag"}` —
  no provider calls fire.
- If `enabled = true` or row missing → proceeds normally.
- On **any** flag-lookup error (table missing, RLS denies, network timeout,
  malformed response) → **defaults to ENABLED** (fail-open) and logs
  `[TRINITY] flag lookup errored, defaulting to ENABLED: ...`. This is
  intentional: a feature-flag subsystem hiccup must **not** cascade into a
  platform-wide Trinity outage.

## Manual test plan

Pre-reqs: a test Supabase JWT in `$TOKEN`, project URL in `$SUPABASE_URL`,
service-role access for the toggle step.

### Happy path (flag ON — default state)

```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/biqc-trinity" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is 2+2?","business_context":"test","mode_requested":"trinity"}'
```

Expected: HTTP 200 with `{"reply": "...", "conversation_id": "...", "mode": "trinity", ...}`.
Edge-fn logs show `[TRINITY] Dispatching to GPT-5.2, Claude Opus 4.6, Gemini 2.5 Pro in parallel...`.

### Kill-switch (flag OFF)

Toggle OFF via the super-admin UI (or SQL):

```sql
UPDATE public.feature_flags
SET enabled = false, updated_at = now()
WHERE flag_key = 'trinity_synthesis_enabled';
```

Immediately re-run the same curl:

```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/biqc-trinity" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is 2+2?","mode_requested":"trinity"}'
```

Expected:

- HTTP **503** status
- Body: `{"error":"trinity_synthesis paused by admin","reason":"feature_flag"}`
- Edge-fn logs show `[TRINITY] trinity_synthesis_enabled=false — short-circuit 503`
- **No** `[TRINITY] Dispatching to GPT-5.2 ...` log line — confirms providers were NOT called
- **No** new rows in `usage_ledger` with `feature='biqc_trinity'` (no spend)

Re-enable:

```sql
UPDATE public.feature_flags
SET enabled = true, updated_at = now()
WHERE flag_key = 'trinity_synthesis_enabled';
```

### Fail-open on flag error

Simulated via temporarily revoking RLS `SELECT` on `public.feature_flags`
for the service role (destructive — do only in a scratch project):

```sql
DROP POLICY IF EXISTS "Service role full access on feature_flags" ON public.feature_flags;
```

Re-run the curl. Expected:

- HTTP 200 (Trinity still runs — fail-open)
- Edge-fn logs show `[TRINITY] flag lookup errored, defaulting to ENABLED: ...`
- Providers are called normally

Restore the policy:

```sql
CREATE POLICY "Service role full access on feature_flags"
  ON public.feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true);
```

## Regression watchlist

- Changes to `isTrinityEnabled()` — keep it failing OPEN.
- Changes to the handler ordering — the guard MUST run **before** the
  `Promise.allSettled` fan-out. Any refactor that moves the guard below the
  provider dispatch defeats its purpose (money still burns).
- Changes to `corsHeaders(req)` inclusion on the 503 path — the frontend
  needs CORS on failure responses or it sees a network error instead of the
  503 JSON payload.
- The `adminSb` client must stay a service-role client so the SELECT does
  not require the caller's JWT to have `authenticated` RLS rights.
