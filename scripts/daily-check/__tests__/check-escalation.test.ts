/**
 * Tests for check-escalation.ts — F6 P0-1 patch.
 *
 * Verifies that the escalation logic correctly identifies the *prior* run
 * (not the just-persisted current run) when deciding whether to escalate
 * severity to PAGE.
 *
 * Per peer reviewer R10: this regression test guards against the
 * "persist-run runs before check-escalation; escalation reads the run we
 * just inserted" bug class.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { pickPriorRun } from '../check-escalation.js';

interface PriorRun {
  id: string;
  overall_status: string;
  run_at: string;
  workflow_run_id: string | null;
}

const ISO = (offsetSeconds: number) => new Date(Date.parse('2026-05-04T19:00:00Z') + offsetSeconds * 1000).toISOString();

describe('pickPriorRun — escalation prior-run picker', () => {
  it('returns null when there are no rows', () => {
    const result = pickPriorRun([], 'run-1', ISO(0));
    assert.equal(result, null);
  });

  it('returns null when the only row is the current run (matched by workflow_run_id)', () => {
    const rows: PriorRun[] = [
      { id: 'r1', overall_status: 'FAIL', run_at: ISO(0), workflow_run_id: 'run-current' },
    ];
    const result = pickPriorRun(rows, 'run-current', ISO(0));
    assert.equal(result, null);
  });

  it('returns the prior row when the current row is at index 0 and prior at index 1', () => {
    const rows: PriorRun[] = [
      { id: 'r-current', overall_status: 'FAIL', run_at: ISO(0), workflow_run_id: 'run-current' },
      { id: 'r-prior', overall_status: 'FAIL', run_at: ISO(-43200), workflow_run_id: 'run-prior' }, // 12h ago
    ];
    const result = pickPriorRun(rows, 'run-current', ISO(0));
    assert.equal(result?.id, 'r-prior');
    assert.equal(result?.overall_status, 'FAIL');
  });

  it('handles rows with null workflow_run_id by falling back to run_at proximity', () => {
    const rows: PriorRun[] = [
      // current run, no workflow_run_id (legacy row)
      { id: 'r-current', overall_status: 'FAIL', run_at: ISO(0), workflow_run_id: null },
      // genuine prior, 12h ago
      { id: 'r-prior', overall_status: 'PASS', run_at: ISO(-43200), workflow_run_id: null },
    ];
    const result = pickPriorRun(rows, 'run-current', ISO(0));
    assert.equal(result?.id, 'r-prior');
    assert.equal(result?.overall_status, 'PASS');
  });

  it('does not escalate when no genuine prior exists (only one row, which is us)', () => {
    const rows: PriorRun[] = [
      { id: 'r-current', overall_status: 'FAIL', run_at: ISO(0), workflow_run_id: 'run-current' },
    ];
    const result = pickPriorRun(rows, 'run-current', ISO(0));
    assert.equal(result, null);
  });

  it('belt-and-braces: even with no IDs at all, never returns the most-recent row', () => {
    const rows: PriorRun[] = [
      { id: 'r-most-recent', overall_status: 'FAIL', run_at: ISO(0), workflow_run_id: null },
      { id: 'r-older', overall_status: 'PASS', run_at: ISO(-43200), workflow_run_id: null },
    ];
    // Pass null current ID and null current run_at — last-resort path.
    const result = pickPriorRun(rows, null, null);
    assert.notEqual(result?.id, 'r-most-recent', 'must never pick the most-recent row');
    assert.equal(result?.id, 'r-older');
  });
});

describe('escalation scenarios — full sequence simulation', () => {
  /**
   * Helper: simulate the database state at a given point in time and ask
   * pickPriorRun what it would conclude. The "current run" is always the
   * most-recently-inserted one (we mimic persist-run.ts having just inserted).
   */
  function simulate(
    history: { status: 'PASS' | 'FAIL'; runId: string }[],
  ): { priorStatus: string | null; wouldEscalate: boolean } {
    if (history.length === 0) return { priorStatus: null, wouldEscalate: false };
    const current = history[history.length - 1];
    // DB returns DESC by run_at. Last 2 rows = current + immediate prior.
    const rows: PriorRun[] = history
      .slice()
      .reverse()
      .slice(0, 2)
      .map((h, i) => ({
        id: h.runId,
        overall_status: h.status,
        run_at: ISO(-i * 43200), // each entry is 12h apart
        workflow_run_id: h.runId,
      }));
    const prior = pickPriorRun(rows, current.runId, ISO(0));
    return {
      priorStatus: prior?.overall_status ?? null,
      wouldEscalate: prior?.overall_status === 'FAIL' && current.status === 'FAIL',
    };
  }

  it('PASS, FAIL, FAIL → current is the 4th FAIL just persisted; sees prior FAIL → ESCALATE', () => {
    // Per task spec: simulate 3 historical runs (PASS, FAIL, FAIL),
    // then the 4th (current) is also FAIL. Escalation must trigger.
    const history: { status: 'PASS' | 'FAIL'; runId: string }[] = [
      { status: 'PASS', runId: 'r1' },
      { status: 'FAIL', runId: 'r2' },
      { status: 'FAIL', runId: 'r3' },
      { status: 'FAIL', runId: 'r4-current' },
    ];
    const result = simulate(history);
    assert.equal(result.priorStatus, 'FAIL', 'should see r3 (FAIL) as prior, not r4 (current)');
    assert.equal(result.wouldEscalate, true, 'two consecutive FAILs must escalate');
  });

  it('PASS, FAIL, FAIL, PASS → current is PASS so no escalation regardless', () => {
    // Per task spec: 4th row is PASS — no escalation should happen.
    const history: { status: 'PASS' | 'FAIL'; runId: string }[] = [
      { status: 'PASS', runId: 'r1' },
      { status: 'FAIL', runId: 'r2' },
      { status: 'FAIL', runId: 'r3' },
      { status: 'PASS', runId: 'r4-current' },
    ];
    const result = simulate(history);
    // pickPriorRun would return r3 (FAIL), but escalation only fires if
    // current is also FAIL. So wouldEscalate=false.
    assert.equal(result.priorStatus, 'FAIL', 'prior was r3 FAIL');
    assert.equal(result.wouldEscalate, false, 'current PASS prevents escalation');
  });

  it('first-ever FAIL: only 1 historical row, which is us → no escalation', () => {
    const history: { status: 'PASS' | 'FAIL'; runId: string }[] = [{ status: 'FAIL', runId: 'r1-current' }];
    const result = simulate(history);
    assert.equal(result.priorStatus, null, 'no prior run exists yet');
    assert.equal(result.wouldEscalate, false);
  });

  it('after a single PASS then a FAIL → no escalation (only one FAIL in sequence)', () => {
    const history: { status: 'PASS' | 'FAIL'; runId: string }[] = [
      { status: 'PASS', runId: 'r1' },
      { status: 'FAIL', runId: 'r2-current' },
    ];
    const result = simulate(history);
    assert.equal(result.priorStatus, 'PASS', 'should see r1 (PASS) as prior');
    assert.equal(result.wouldEscalate, false);
  });
});
