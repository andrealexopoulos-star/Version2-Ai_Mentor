/**
 * Tests for post-alerts.ts — F6 P0-2 patch.
 *
 * Verifies that the webhook delivery:
 *   a) succeeds quickly on a 200 (no retries),
 *   b) retries 3 times with exponential backoff on 5xx,
 *   c) retries 3 times on transport errors / timeouts,
 *   d) emits a non-zero exit signal on final failure (we test
 *      `deliverWithRetry` directly so we can observe the outcome object;
 *      the CLI wrapper that calls process.exit is a thin shell over it),
 *   e) builds a Contract-v2-compliant payload that omits supplier names
 *      from per-URL failure detail.
 *
 * Per peer reviewer R10: no silent webhook failures. Every miss must be
 * loud (GH error annotation) AND propagated as a non-zero step exit.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  attemptPost,
  buildPayload,
  deliverWithRetry,
  RETRY_DELAYS_MS,
  type DeliveryAttempt,
} from '../post-alerts.js';

/** Mock fetch factory — returns a sequence of responses. */
function mockFetch(responses: Array<{ status: number; body?: string } | { throw: string }>): {
  fetch: typeof fetch;
  calls: number;
} {
  let i = 0;
  const obj = {
    calls: 0,
    fetch: (async (_url: RequestInfo | URL, _init?: RequestInit) => {
      obj.calls += 1;
      const next = responses[Math.min(i, responses.length - 1)];
      i += 1;
      if (next && 'throw' in next) {
        throw new Error(next.throw);
      }
      const r = next as { status: number; body?: string };
      return new Response(r.body ?? '', { status: r.status });
    }) as unknown as typeof fetch,
  };
  return obj;
}

/** No-op sleep that resolves immediately — keeps tests fast. */
const fastSleep = async (_ms: number): Promise<void> => Promise.resolve();

describe('attemptPost — single attempt behaviour', () => {
  it('returns ok=true on a 200', async () => {
    const m = mockFetch([{ status: 200, body: 'ok' }]);
    const result: DeliveryAttempt = await attemptPost('https://example/webhook', { x: 1 }, 5000, 1, m.fetch);
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.attempt, 1);
    assert.equal(m.calls, 1);
  });

  it('returns ok=false on a 500 with body snippet', async () => {
    const m = mockFetch([{ status: 500, body: 'internal server error blob' }]);
    const result = await attemptPost('https://example/webhook', { x: 1 }, 5000, 2, m.fetch);
    assert.equal(result.ok, false);
    assert.equal(result.status, 500);
    assert.equal(result.attempt, 2);
    assert.ok(result.body_snippet?.includes('internal'));
    assert.ok(result.error?.includes('500'));
  });

  it('returns ok=false on a transport throw', async () => {
    const m = mockFetch([{ throw: 'ECONNRESET' }]);
    const result = await attemptPost('https://example/webhook', { x: 1 }, 5000, 1, m.fetch);
    assert.equal(result.ok, false);
    assert.equal(result.status, null);
    assert.ok(result.error?.includes('ECONNRESET'));
  });
});

describe('deliverWithRetry — full retry policy', () => {
  it('200 on first attempt: no retries, delivered=true', async () => {
    const m = mockFetch([{ status: 200 }]);
    const outcome = await deliverWithRetry('https://example/webhook', { x: 1 }, {
      delaysMs: RETRY_DELAYS_MS,
      fetcher: m.fetch,
      sleep: fastSleep,
    });
    assert.equal(outcome.delivered, true);
    assert.equal(outcome.attempts.length, 1);
    assert.equal(outcome.final_status, 200);
    assert.equal(m.calls, 1);
  });

  it('500 on all 3 attempts: delivered=false with 3 attempts recorded', async () => {
    const m = mockFetch([{ status: 500 }, { status: 500 }, { status: 500 }]);
    const outcome = await deliverWithRetry('https://example/webhook', { x: 1 }, {
      delaysMs: [1, 1, 1], // tiny delays for the test
      fetcher: m.fetch,
      sleep: fastSleep,
    });
    assert.equal(outcome.delivered, false);
    assert.equal(outcome.attempts.length, 3);
    assert.equal(outcome.final_status, 500);
    assert.equal(m.calls, 3);
    assert.ok(outcome.attempts.every((a) => a.ok === false));
  });

  it('500 then 500 then 200: succeeds on attempt 3', async () => {
    const m = mockFetch([{ status: 500 }, { status: 500 }, { status: 200 }]);
    const outcome = await deliverWithRetry('https://example/webhook', { x: 1 }, {
      delaysMs: [1, 1, 1],
      fetcher: m.fetch,
      sleep: fastSleep,
    });
    assert.equal(outcome.delivered, true);
    assert.equal(outcome.attempts.length, 3);
    assert.equal(outcome.final_status, 200);
    assert.equal(m.calls, 3);
  });

  it('all 3 attempts throw (timeout / network): delivered=false, error captured', async () => {
    const m = mockFetch([{ throw: 'AbortError' }, { throw: 'AbortError' }, { throw: 'AbortError' }]);
    const outcome = await deliverWithRetry('https://example/webhook', { x: 1 }, {
      delaysMs: [1, 1, 1],
      fetcher: m.fetch,
      sleep: fastSleep,
    });
    assert.equal(outcome.delivered, false);
    assert.equal(outcome.attempts.length, 3);
    assert.equal(outcome.final_status, null);
    assert.ok(outcome.final_error?.includes('AbortError'));
  });

  it('honours the configured backoff delay sequence', async () => {
    // Spy on sleep calls to verify exponential-backoff sequence.
    const sleeps: number[] = [];
    const recordingSleep = async (ms: number) => {
      sleeps.push(ms);
    };
    const m = mockFetch([{ status: 503 }, { status: 503 }, { status: 503 }]);
    await deliverWithRetry('https://example/webhook', { x: 1 }, {
      delaysMs: [1000, 3000, 9000], // exact sequence we ship
      fetcher: m.fetch,
      sleep: recordingSleep,
    });
    // We should sleep BETWEEN attempts (after attempt 1 and after attempt 2),
    // not after the final attempt.
    assert.deepEqual(sleeps, [1000, 3000]);
  });

  it('default delaysMs = 1s, 3s, 9s exponential', () => {
    assert.deepEqual([...RETRY_DELAYS_MS], [1000, 3000, 9000]);
  });
});

describe('buildPayload — Contract v2 compliance', () => {
  const sampleAgg = {
    overall_status: 'FAIL',
    severity: 'CRITICAL',
    pass_count: 4,
    fail_count: 1,
    degraded_count: 0,
    workflow_run_url: 'https://github.com/x/y/actions/runs/123',
    per_url: [
      {
        label: 'sms-global',
        url: 'www.smsglobal.com',
        overall_status: 'PASS',
        failures: [],
        warnings: [],
      },
      {
        label: 'jims-mowing',
        url: 'www.jimsmowing.com.au',
        overall_status: 'FAIL',
        failures: [
          { check: 'edge_fn_zero_401', detail: 'SEMrush returned 401 — leak detail in GH issue only' },
          { check: 'cmo_section_count', detail: 'only 18 of 25 sections rendered' },
        ],
        warnings: [],
      },
    ],
  };

  it('renders a Slack-friendly text summary', () => {
    const { text } = buildPayload(sampleAgg);
    assert.ok(text.includes('Daily CMO E2E Check'));
    assert.ok(text.includes('FAIL'));
    assert.ok(text.includes('Pass: 4/5'));
    assert.ok(text.includes('jims-mowing'));
    assert.ok(text.includes('13041978'), 'must include code-required-for-mutation reminder');
  });

  it('per_url payload entries omit failure detail strings (Contract v2)', () => {
    const { payload } = buildPayload(sampleAgg);
    const perUrl = payload.per_url as Array<Record<string, unknown>>;
    const failed = perUrl.find((u) => u.label === 'jims-mowing');
    assert.ok(failed, 'failed URL must be present');
    assert.equal(failed!.failure_count, 2, 'count is fine');
    assert.equal('failures' in failed!, false, 'failure detail must NOT leak (supplier name protection)');
    // Stringify the whole payload and check no supplier name leaks.
    const json = JSON.stringify(payload);
    assert.equal(json.includes('SEMrush'), false, 'SEMrush must not appear in webhook payload');
  });

  it('text summary includes only check NAMES not detail strings', () => {
    const { text } = buildPayload(sampleAgg);
    // Check name appears (it's a code identifier, not a supplier name).
    assert.ok(text.includes('edge_fn_zero_401') || text.includes('cmo_section_count'));
    // But the detail (which contains "SEMrush") must NOT.
    assert.equal(text.includes('SEMrush'), false);
  });
});
