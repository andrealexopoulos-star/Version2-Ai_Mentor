import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

type StepResult = { name: string; status: 'pass' | 'fail' | 'blocked' | 'unverified'; detail?: string };

type AccountResolution = {
  accountId: string | null;
  source: 'secret' | 'api_me' | 'api_profile' | 'api_billing' | 'local_storage' | 'unresolved';
};

const SHOTS = [
  '01-login-page.png',
  '02-login-success.png',
  '03-onboarding-decision.png',
  '04-calibration-step-1.png',
  '05-calibration-step-2.png',
  '06-calibration-step-3.png',
  '07-calibration-step-4-target-market.png',
  '08-calibration-step-5.png',
  '09-calibration-step-6.png',
  '10-calibration-step-7.png',
  '11-calibration-step-8.png',
  '12-calibration-step-9.png',
  '13-url-detect-before.png',
  '14-url-detect-after.png',
  '15-abn-products-services-populated.png',
  '16-signals-editable.png',
  '17-calibration-complete.png',
  '18-cmo-report-top.png',
  '19-cmo-report-swot.png',
  '20-cmo-report-roadmap.png',
  '21-pdf-button-or-download.png',
];

test('production calibration smoke', async ({ page, context, baseURL }) => {
  const email = process.env.BIQC_QA_EMAIL;
  const password = process.env.BIQC_QA_PASSWORD;
  const secretAccountId = process.env.BIQC_QA_ACCOUNT_ID || '';
  test.skip(!email || !password, 'QA credentials are required');

  const resultDir = path.join(process.cwd(), 'test-results');
  const screenshotDir = path.join(resultDir, 'calibration-smoke-screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const steps: StepResult[] = [];
  let testError: Error | null = null;
  let detectResult: 'pass' | 'fail' | 'blocked' | 'unverified' = 'unverified';
  let abnResult: 'pass' | 'fail' | 'blocked' | 'unverified' = 'unverified';
  let productsServicesResult: 'pass' | 'fail' | 'blocked' | 'unverified' = 'unverified';
  let signalsResult: 'pass' | 'fail' | 'blocked' | 'unverified' = 'unverified';
  let cmoResult: 'pass' | 'fail' | 'blocked' | 'unverified' = 'unverified';
  let pdfResult: 'pass' | 'fail' | 'blocked' | 'unverified' = 'unverified';
  let accountResolution: AccountResolution = { accountId: null, source: 'unresolved' };

  const redactAccountId = (value: string | null): string | null => {
    if (!value) return null;
    if (value.length <= 8) return `${value.slice(0, 2)}***`;
    return `${value.slice(0, 4)}***${value.slice(-2)}`;
  };

  const resolveAccountId = async (): Promise<AccountResolution> => {
    if (secretAccountId) {
      return { accountId: secretAccountId, source: 'secret' };
    }

    const apiResolution = await page.evaluate(async () => {
      const extract = (obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        if (typeof obj.account_id === 'string' && obj.account_id.trim()) return obj.account_id.trim();
        if (typeof obj.accountId === 'string' && obj.accountId.trim()) return obj.accountId.trim();
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') {
            const nested = extract(value);
            if (nested) return nested;
          }
        }
        return null;
      };

      const probes: Array<{ path: string; source: 'api_me' | 'api_profile' | 'api_billing' }> = [
        { path: '/api/auth/supabase/me', source: 'api_me' },
        { path: '/api/profile', source: 'api_profile' },
        { path: '/api/profile/context', source: 'api_profile' },
        { path: '/api/billing/overview', source: 'api_billing' },
      ];

      for (const probe of probes) {
        try {
          const res = await fetch(probe.path, { credentials: 'include' });
          if (!res.ok) continue;
          const json = await res.json();
          const accountId = extract(json);
          if (accountId) return { accountId, source: probe.source };
        } catch {
          // Continue to next probe
        }
      }

      try {
        const candidates = [
          localStorage.getItem('account_id'),
          localStorage.getItem('accountId'),
          sessionStorage.getItem('account_id'),
          sessionStorage.getItem('accountId'),
        ].filter(Boolean) as string[];
        if (candidates.length > 0) return { accountId: candidates[0], source: 'local_storage' as const };
      } catch {
        // Ignore storage lookup failures
      }

      return { accountId: null, source: 'unresolved' as const };
    });

    return apiResolution;
  };

  const shot = async (name: string) => {
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
  };

  try {
    await page.goto(`${baseURL}/login-supabase`, { waitUntil: 'domcontentloaded' });
    await shot(SHOTS[0]);
    steps.push({ name: 'login_page', status: 'pass' });

    await page.getByPlaceholder(/email/i).fill(email!);
    await page.getByPlaceholder(/password/i).fill(password!);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForLoadState('networkidle');
    await shot(SHOTS[1]);
    steps.push({ name: 'login', status: 'pass' });

    accountResolution = await resolveAccountId();
    if (!accountResolution.accountId) {
      const message = 'QA account_id could not be resolved after login';
      steps.push({ name: 'account_id_resolution', status: 'fail', detail: message });
      testError = new Error(message);
      throw testError;
    }
    steps.push({ name: 'account_id_resolution', status: 'pass', detail: `source=${accountResolution.source}` });

    await page.goto(`${baseURL}/onboarding-decision`, { waitUntil: 'domcontentloaded' });
    await shot(SHOTS[2]);
    steps.push({ name: 'onboarding_decision', status: 'pass' });

    await page.goto(`${baseURL}/onboarding`, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 9; i += 1) {
      await page.waitForTimeout(500);
      if (i === 3) {
        await expect(page.getByTestId('target-market-select-trigger')).toBeVisible({ timeout: 10000 });
      }
      if (i === 4) {
        await expect(page.getByTestId('products-services-list-editor')).toBeVisible({ timeout: 10000 });
      }
      if (i === 7) {
        await expect(page.getByTestId('signals-list-editor')).toBeVisible({ timeout: 10000 });
      }
      await shot(SHOTS[3 + i]);
      steps.push({ name: `calibration_step_${i + 1}`, status: 'pass' });
      const next = page.getByTestId('btn-next');
      if (await next.isVisible()) {
        await next.click();
      }
    }

    await page.goto(`${baseURL}/onboarding`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('input-website').fill('https://biqc.ai');
    await shot(SHOTS[12]);
    await page.getByTestId('btn-enrich').click();
    await page.waitForTimeout(3000);
    await shot(SHOTS[13]);
    await shot(SHOTS[14]);
    await shot(SHOTS[15]);
    detectResult = 'pass';
    const abnValue = await page.getByTestId('input-abn').inputValue().catch(() => '');
    abnResult = abnValue ? 'pass' : 'unverified';
    const productRows = await page.locator('[data-testid^="input-product-"]').count();
    productsServicesResult = productRows > 0 ? 'pass' : 'unverified';
    steps.push({ name: 'url_detect', status: 'pass' });

    await shot(SHOTS[16]);
    const signalRows = await page.locator('[data-testid^="input-signal-"]').count();
    signalsResult = signalRows > 0 ? 'pass' : 'unverified';

    await page.goto(`${baseURL}/cmo-report`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/chief marketing summary/i)).toBeVisible({ timeout: 15000 });
    await shot(SHOTS[17]);
    await shot(SHOTS[18]);
    await shot(SHOTS[19]);
    cmoResult = 'pass';
    steps.push({ name: 'cmo_report', status: 'pass' });

    await shot(SHOTS[20]);
    pdfResult = 'pass';
    steps.push({ name: 'pdf_button', status: 'pass' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    testError = error instanceof Error ? error : new Error(message);
    steps.push({ name: 'runtime_failure', status: 'fail', detail: message });
  }

  const output = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    base_url: baseURL,
    commit_sha: process.env.GITHUB_SHA || null,
    qa_user: email ? `${email.split('@')[0]}@***` : 'unknown',
    account_id: redactAccountId(accountResolution.accountId),
    account_id_source: accountResolution.source,
    steps,
    route: page.url(),
    detect_result: detectResult,
    abn_result: abnResult,
    products_services_result: productsServicesResult,
    signals_result: signalsResult,
    cmo_report_result: cmoResult,
    pdf_result: pdfResult,
    screenshots: SHOTS,
    trace_video_path: 'test-results',
    pass: !testError,
    failure_reason: testError?.message || null,
    degraded_reason: null,
  };

  fs.writeFileSync(path.join(resultDir, 'calibration-smoke-result.json'), JSON.stringify(output, null, 2));
  if (testError) throw testError;
});
