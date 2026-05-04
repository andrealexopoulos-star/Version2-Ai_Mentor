/**
 * POST aggregate result to ALERT_WEBHOOK_URL on FAIL or DEGRADED.
 *
 * Body shape is generic JSON (Slack-compatible if the URL is a Slack webhook;
 * otherwise the receiver can parse the JSON freely).
 *
 * Per BIQc Platform Contract v2: external messaging must NOT include supplier
 * names or internal codes. We summarise per-URL state without leaking which
 * supplier failed (that detail is in the GH issue body, internal-only).
 */

import * as fs from 'fs';
import * as path from 'path';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[alert] required env var ${name} not set`);
    process.exit(2);
  }
  return v;
}

async function main(): Promise<void> {
  const webhookUrl = requireEnv('ALERT_WEBHOOK_URL');
  const aggPath = path.resolve(__dirname, 'aggregate-input', 'aggregate.json');
  if (!fs.existsSync(aggPath)) {
    console.error('[alert] aggregate.json missing — nothing to alert about');
    process.exit(0);
  }
  const agg = JSON.parse(fs.readFileSync(aggPath, 'utf8'));

  if (agg.overall_status === 'PASS') {
    console.log('[alert] overall PASS — no alert sent');
    process.exit(0);
  }

  // Build a compact, supplier-name-free summary.
  const lines: string[] = [];
  lines.push(`*BIQc Daily CMO E2E Check — ${agg.overall_status}* (severity: ${agg.severity})`);
  lines.push(`Pass: ${agg.pass_count}/5  Fail: ${agg.fail_count}/5  Degraded: ${agg.degraded_count}/5`);
  if (agg.workflow_run_url) {
    lines.push(`Run: ${agg.workflow_run_url}`);
  }
  for (const u of agg.per_url || []) {
    const failureSummary = (u.failures || []).slice(0, 2).map((f: any) => f.check).join(', ');
    lines.push(`- ${u.label} (${u.url}) — ${u.overall_status}${failureSummary ? ` — ${failureSummary}` : ''}`);
  }
  lines.push(`Per Andreas's standing order, every FAIL is treated as a P0. Code 13041978 required for any mutation.`);

  const summaryText = lines.join('\n');

  // Slack-compatible payload (works for generic webhooks too — they get a `text` + `attachments` JSON envelope).
  const payload = {
    text: summaryText,
    severity: agg.severity,
    overall_status: agg.overall_status,
    pass_count: agg.pass_count,
    fail_count: agg.fail_count,
    degraded_count: agg.degraded_count,
    workflow_run_url: agg.workflow_run_url,
    per_url: (agg.per_url || []).map((u: any) => ({
      label: u.label,
      url: u.url,
      overall_status: u.overall_status,
      failure_count: (u.failures || []).length,
      warning_count: (u.warnings || []).length,
      // Note: per Contract v2, do NOT include failure details (which may name suppliers).
      // GH issue is the internal channel where full detail goes.
    })),
  };

  const t0 = Date.now();
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const elapsed = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[alert] webhook returned ${res.status} after ${elapsed}ms: ${body.slice(0, 200)}`);
      process.exit(0); // do not fail the workflow over a webhook delivery hiccup
    }
    console.log(`[alert] posted to webhook in ${elapsed}ms (status ${res.status})`);
  } catch (e) {
    console.error(`[alert] webhook POST crashed: ${String(e)}`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(`[alert] crashed: ${String(e)}`);
  process.exit(0);
});
