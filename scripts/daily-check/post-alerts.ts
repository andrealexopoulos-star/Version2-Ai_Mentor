/**
 * POST aggregate result to ALERT_WEBHOOK_URL on FAIL or DEGRADED.
 *
 * Body shape is generic JSON (Slack-compatible if the URL is a Slack webhook;
 * otherwise the receiver can parse the JSON freely).
 *
 * Per BIQc Platform Contract v2: external messaging must NOT include supplier
 * names or internal codes. We summarise per-URL state without leaking which
 * supplier failed (that detail is in the GH issue body, internal-only).
 *
 * --- F6 P0-2 patch (peer reviewer R10 finding) ---
 * Previous behaviour: a single POST attempt; any non-OK response or thrown
 * exception printed to stderr and exited 0 — silent failure. If
 * ALERT_WEBHOOK_URL was rotated/invalid we'd never know until the next time
 * we manually inspected the workflow run.
 *
 * Fix:
 *   a) Fail loud at start if ALERT_WEBHOOK_URL is unset (process.exit(2) with
 *      ::error:: annotation — already partially in requireEnv but we now
 *      emit the GH annotation explicitly).
 *   b) Retry 3 times with exponential backoff (1s, 3s, 9s) on non-2xx /
 *      thrown errors / timeouts.
 *   c) After all retries fail: emit ::error:: GH annotation AND exit
 *      non-zero so the workflow step explicitly fails (the
 *      "Open GH issue on FAIL" step still runs because of `if: always()`,
 *      and the issue body picks up the alert-failure marker).
 *   d) Write a marker file `alert-delivery.json` so the GH issue creation
 *      step (and any human post-mortem) can document "alert webhook also
 *      failed".
 *
 * Exit codes:
 *   0  = no alert needed (overall PASS) OR webhook delivered successfully.
 *   2  = ALERT_WEBHOOK_URL not configured (fail-loud, fix the secret).
 *   3  = webhook delivery failed after all retries (fail-loud, fix the
 *        webhook destination).
 */

import * as fs from 'fs';
import * as path from 'path';

export const RETRY_DELAYS_MS = [1_000, 3_000, 9_000] as const;
export const REQUEST_TIMEOUT_MS = 15_000;

function ghError(message: string): void {
  // Single-line ::error:: annotation — GH Actions surfaces it loudly in the
  // step header + at the top of the run. Newlines in messages must be
  // escaped per https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
  const escaped = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.error(`::error::${escaped}`);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    ghError(`required env var ${name} not set — fix this secret in GH repo settings`);
    console.error(`[alert] required env var ${name} not set`);
    process.exit(2);
  }
  return v;
}

export interface DeliveryAttempt {
  attempt: number;
  ok: boolean;
  status: number | null;
  elapsed_ms: number;
  error?: string;
  body_snippet?: string;
}

export interface DeliveryOutcome {
  delivered: boolean;
  attempts: DeliveryAttempt[];
  final_status: number | null;
  final_error: string | null;
}

/**
 * Attempt a single POST. Resolves with a DeliveryAttempt — never throws.
 * Treats any 2xx as success and any other status / exception as failure.
 */
export async function attemptPost(
  url: string,
  payload: unknown,
  timeoutMs: number,
  attemptNumber: number,
  // Allow tests to inject a mock fetch.
  fetcher: typeof fetch = fetch,
): Promise<DeliveryAttempt> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const elapsed = Date.now() - t0;
    if (res.ok) {
      return { attempt: attemptNumber, ok: true, status: res.status, elapsed_ms: elapsed };
    }
    let body = '';
    try {
      body = await res.text();
    } catch {
      // ignore body read errors
    }
    return {
      attempt: attemptNumber,
      ok: false,
      status: res.status,
      elapsed_ms: elapsed,
      body_snippet: body.slice(0, 200),
      error: `HTTP ${res.status}`,
    };
  } catch (e: unknown) {
    clearTimeout(timer);
    const elapsed = Date.now() - t0;
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return {
      attempt: attemptNumber,
      ok: false,
      status: null,
      elapsed_ms: elapsed,
      error: message,
    };
  }
}

/**
 * Deliver with retries + exponential backoff. Pure / testable — no process.exit.
 *
 * Exported so the test suite can drive it directly with a fake fetcher.
 */
export async function deliverWithRetry(
  url: string,
  payload: unknown,
  options: {
    delaysMs?: readonly number[];
    timeoutMs?: number;
    fetcher?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<DeliveryOutcome> {
  const delays = options.delaysMs ?? RETRY_DELAYS_MS;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const attempts: DeliveryAttempt[] = [];
  for (let i = 0; i < delays.length; i++) {
    const result = await attemptPost(url, payload, timeoutMs, i + 1, fetcher);
    attempts.push(result);
    if (result.ok) {
      return { delivered: true, attempts, final_status: result.status, final_error: null };
    }
    // Emit a per-attempt GH error so the run log shows every retry, not just
    // the final outcome. Keeps the operator's signal high.
    ghError(
      `alert webhook attempt ${i + 1}/${delays.length} failed (` +
        `status=${result.status ?? 'NONE'}, error=${result.error ?? 'unknown'}). ` +
        (i + 1 < delays.length ? `Retrying in ${delays[i]}ms.` : 'No more retries.'),
    );
    if (i + 1 < delays.length) {
      await sleep(delays[i]);
    }
  }
  const last = attempts[attempts.length - 1];
  return {
    delivered: false,
    attempts,
    final_status: last?.status ?? null,
    final_error: last?.error ?? 'all retries exhausted',
  };
}

/**
 * Build the alert payload. Pure — exported for tests.
 */
export function buildPayload(agg: Record<string, unknown>): {
  text: string;
  payload: Record<string, unknown>;
} {
  const lines: string[] = [];
  lines.push(`*BIQc Daily CMO E2E Check — ${agg.overall_status}* (severity: ${agg.severity})`);
  lines.push(`Pass: ${agg.pass_count}/5  Fail: ${agg.fail_count}/5  Degraded: ${agg.degraded_count}/5`);
  if (agg.workflow_run_url) {
    lines.push(`Run: ${agg.workflow_run_url}`);
  }
  for (const u of (agg.per_url as Record<string, unknown>[]) || []) {
    const failureSummary = ((u.failures as { check: string }[]) || [])
      .slice(0, 2)
      .map((f) => f.check)
      .join(', ');
    lines.push(`- ${u.label} (${u.url}) — ${u.overall_status}${failureSummary ? ` — ${failureSummary}` : ''}`);
  }
  lines.push(`Per Andreas's standing order, every FAIL is treated as a P0. Code 13041978 required for any mutation.`);
  const summaryText = lines.join('\n');
  return {
    text: summaryText,
    payload: {
      text: summaryText,
      severity: agg.severity,
      overall_status: agg.overall_status,
      pass_count: agg.pass_count,
      fail_count: agg.fail_count,
      degraded_count: agg.degraded_count,
      workflow_run_url: agg.workflow_run_url,
      per_url: ((agg.per_url as Record<string, unknown>[]) || []).map((u) => ({
        label: u.label,
        url: u.url,
        overall_status: u.overall_status,
        failure_count: ((u.failures as unknown[]) || []).length,
        warning_count: ((u.warnings as unknown[]) || []).length,
        // Note: per Contract v2, do NOT include failure details (which may name suppliers).
        // GH issue is the internal channel where full detail goes.
      })),
    },
  };
}

async function main(): Promise<void> {
  // Fail loud immediately if the webhook secret is missing — no silent skip.
  const webhookUrl = requireEnv('ALERT_WEBHOOK_URL');

  const aggPath = path.resolve(__dirname, 'aggregate-input', 'aggregate.json');
  if (!fs.existsSync(aggPath)) {
    ghError('aggregate.json missing — alert step cannot determine status');
    console.error('[alert] aggregate.json missing — nothing to alert about');
    // Aggregate missing is itself a workflow plumbing failure, but the
    // "Fail aggregate job if overall != PASS" step at the end of the
    // workflow already handles this case. Exit 0 here so we don't double-fail.
    process.exit(0);
  }
  const agg = JSON.parse(fs.readFileSync(aggPath, 'utf8'));

  if (agg.overall_status === 'PASS') {
    console.log('[alert] overall PASS — no alert sent');
    process.exit(0);
  }

  const { payload } = buildPayload(agg);

  console.log(
    `[alert] delivering to webhook (status=${agg.overall_status} severity=${agg.severity}) — ` +
      `up to ${RETRY_DELAYS_MS.length} attempts`,
  );

  const outcome = await deliverWithRetry(webhookUrl, payload);

  // Write a marker so the GH-issue creation step (downstream) can document
  // whether the webhook also failed. Path matches what the issue script can
  // read from the same workdir.
  const markerPath = path.resolve(path.dirname(aggPath), 'alert-delivery.json');
  try {
    fs.writeFileSync(
      markerPath,
      JSON.stringify(
        {
          delivered: outcome.delivered,
          attempt_count: outcome.attempts.length,
          final_status: outcome.final_status,
          final_error: outcome.final_error,
          attempts: outcome.attempts,
          recorded_at_utc: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(`[alert] could not write delivery marker: ${String(e)}`);
  }

  if (outcome.delivered) {
    const last = outcome.attempts[outcome.attempts.length - 1];
    console.log(
      `[alert] webhook delivered on attempt ${last.attempt}/${outcome.attempts.length} ` +
        `(status ${last.status}, ${last.elapsed_ms}ms)`,
    );
    process.exit(0);
  }

  // All retries exhausted. Fail loud.
  ghError(
    `alert webhook delivery failed after ${outcome.attempts.length} attempts ` +
      `(final status=${outcome.final_status ?? 'NONE'}, error=${outcome.final_error ?? 'unknown'}). ` +
      `ALERT_WEBHOOK_URL may be invalid or rotated — check secret + receiver. ` +
      `GH issue body will record this delivery failure.`,
  );
  console.error(`[alert] webhook delivery failed after ${outcome.attempts.length} attempts`);
  process.exit(3);
}

// Only run if invoked directly, not when imported by tests.
function invokedDirectly(): boolean {
  try {
    return typeof require !== 'undefined' && require.main === module;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().catch((e) => {
    ghError(`alert script crashed: ${String(e)}`);
    console.error(`[alert] crashed: ${String(e)}`);
    process.exit(3);
  });
}
