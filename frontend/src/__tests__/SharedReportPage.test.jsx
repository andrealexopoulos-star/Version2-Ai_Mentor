/**
 * SharedReportPage — public CMO Report share viewer tests.
 *
 * fix/p0-marjo-f1-spa-share-route — wires the missing /r/:token SPA route
 * on top of E8 (which shipped the backend share endpoints). R8 found that
 * E8's share URLs (`https://biqc.ai/r/{token}`) hit the NotFoundPage
 * because no route existed — these tests prove the new SharedReportPage:
 *
 *   1. Shows a loading state while fetching.
 *   2. Renders the sanitised HTML body when the backend returns 200.
 *   3. Shows an explicit "expired" message on 410 (NEVER a generic 404).
 *   4. Shows an explicit "invalid" message on 404 (NEVER a generic 404).
 *   5. Renders the "Ask BIQc" brand in the header (NEVER "Soundboard"
 *      / "Chat" / "Assistant" — feedback_ask_biqc_brand_name.md).
 *   6. Renders a clear "Sign up for Ask BIQc" CTA pointing at the
 *      canonical signup path /register-supabase.
 *   7. Renders OUTSIDE the authenticated SPA shell — no Sidebar, no
 *      authenticated user-menu, no Supabase session required.
 *   8. The rendered HTML never contains supplier names (Contract v2).
 */
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

// ─── Mock react-router-dom BEFORE the page is imported ─────────────────────
// react-router-dom v7's package layout (no main field, ESM-only) breaks the
// CRA-shipped jest-27 resolver. We don't actually need a real router for
// these tests — we just need useParams to return a controllable token and
// Link to render an <a href>. Mocking lets the test suite run end-to-end
// without re-tooling the project's jest config.
let mockToken = 'tok_abcdefghijklmnop12345678';
jest.mock(
  'react-router-dom',
  () => ({
    useParams: () => ({ token: mockToken }),
    Link: ({ to, children, ...rest }) => {
      const React = require('react');
      return React.createElement('a', { href: to, ...rest }, children);
    },
  }),
  // virtual:true bypasses node-resolution for this id; CRA's jest-27
  // resolver chokes on react-router-dom v7's exports map otherwise.
  { virtual: true }
);

// Mock URL config so getApiBaseUrl() doesn't crash in jsdom (no real origin).
jest.mock('../config/urls', () => ({
  getApiBaseUrl: () => 'https://test.local/api',
  getAppBaseUrl: () => 'https://test.local',
  getBackendUrl: () => 'https://test.local',
  getOAuthRedirectUrl: () => 'https://test.local/auth/callback',
  URL_CONFIG: {
    APP_BASE: 'https://test.local',
    BACKEND: 'https://test.local',
    API: 'https://test.local/api',
    OAUTH_REDIRECT: 'https://test.local/auth/callback',
  },
}));

import SharedReportPage from '../pages/SharedReportPage';

const TOKEN = 'tok_abcdefghijklmnop12345678';

function renderAtToken(token = TOKEN) {
  mockToken = token;
  return render(<SharedReportPage />);
}

function mockFetchOnce({ status = 200, body = '' } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    text: async () => body,
    json: async () => ({}),
  });
}

afterEach(() => {
  cleanup();
  if (global.fetch && global.fetch.mockRestore) {
    global.fetch.mockRestore();
  }
  delete global.fetch;
});

describe('SharedReportPage — fix/p0-marjo-f1 (Marjo Critical Incident)', () => {
  test('renders the loading state initially while fetch is pending', async () => {
    // Never-resolving fetch so we can assert the loading UI before it flips.
    global.fetch = jest.fn(() => new Promise(() => {}));
    renderAtToken();
    expect(screen.getByTestId('shared-report-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading shared report/i)).toBeInTheDocument();
  });

  test('renders the sanitised report HTML inside an iframe on a 200 response', async () => {
    const safeHtml =
      '<!doctype html><html><body><h1>BIQc CMO Report — Acme Co</h1>' +
      '<p>Executive summary text.</p></body></html>';
    mockFetchOnce({ status: 200, body: safeHtml });
    renderAtToken();
    await waitFor(() => {
      expect(screen.getByTestId('shared-report-iframe')).toBeInTheDocument();
    });
    const iframe = screen.getByTestId('shared-report-iframe');
    expect(iframe).toHaveAttribute('srcdoc', safeHtml);
    // No "Page Not Found" / "404" / silent blank screen anywhere.
    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^404$/)).not.toBeInTheDocument();
  });

  test('renders an explicit "expired" message on a 410 response', async () => {
    mockFetchOnce({ status: 410, body: '' });
    renderAtToken();
    await waitFor(() => {
      expect(screen.getByTestId('shared-report-expired')).toBeInTheDocument();
    });
    // Heading is the explicit, user-readable title — not the generic 404
    // page nor a silent blank screen.
    expect(
      screen.getByRole('heading', { name: /this share link has expired/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument();
  });

  test('renders an explicit "invalid" message on a 404 response', async () => {
    mockFetchOnce({ status: 404, body: '' });
    renderAtToken();
    await waitFor(() => {
      expect(screen.getByTestId('shared-report-invalid')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('heading', { name: /this share link is invalid/i })
    ).toBeInTheDocument();
    // Must NOT show the generic 404 page (this would be the silent E2E failure
    // that PR #449 + R8 caught).
    expect(screen.queryByText(/^404$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument();
  });

  test('renders an explicit "temporarily unavailable" message on a 5xx response', async () => {
    mockFetchOnce({ status: 503, body: '' });
    renderAtToken();
    await waitFor(() => {
      expect(screen.getByTestId('shared-report-error')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/this shared report is temporarily unavailable/i)
    ).toBeInTheDocument();
  });

  test('renders the "Ask BIQc" brand in the header', async () => {
    mockFetchOnce({ status: 200, body: '<html><body>ok</body></html>' });
    renderAtToken();
    const header = screen.getByTestId('ask-biqc-shared-header');
    expect(header).toBeInTheDocument();
    expect(header.textContent).toMatch(/Ask BIQc/);
    // Brand consistency rule (feedback_ask_biqc_brand_name.md): never
    // "Soundboard" / "Chat" / "Assistant" anywhere on the public surface.
    expect(header.textContent).not.toMatch(/Soundboard/i);
    expect(header.textContent).not.toMatch(/Assistant/i);
  });

  test('renders a clear "Sign up for Ask BIQc" CTA pointing at /register-supabase', async () => {
    mockFetchOnce({ status: 200, body: '<html><body>ok</body></html>' });
    renderAtToken();
    const cta = screen.getByTestId('ask-biqc-header-signup-cta');
    expect(cta).toBeInTheDocument();
    expect(cta.textContent).toMatch(/sign up for ask biqc/i);
    expect(cta.getAttribute('href')).toBe('/register-supabase');
    // Footer also has a CTA.
    const footerCta = screen.getByTestId('ask-biqc-footer-signup-cta');
    expect(footerCta.getAttribute('href')).toBe('/register-supabase');
  });

  test('renders OUTSIDE the authenticated SPA shell — no sidebar / authenticated nav', async () => {
    mockFetchOnce({ status: 200, body: '<html><body>ok</body></html>' });
    renderAtToken();
    await waitFor(() => {
      expect(screen.getByTestId('shared-report-page')).toBeInTheDocument();
    });
    // The authenticated layout would expose any of these data-testids /
    // role landmarks. None should be present on the public share page.
    expect(screen.queryByTestId('dashboard-layout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /primary/i })).not.toBeInTheDocument();
    // No "Sign out" / "Log out" — anonymous user.
    expect(screen.queryByText(/^sign out$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^log out$/i)).not.toBeInTheDocument();
  });

  test('rendered page contains no supplier names (Contract v2)', async () => {
    // The backend already strips supplier names server-side. This test
    // proves the *frontend wrapper* (header + footer + status panels)
    // never introduces them either.
    mockFetchOnce({ status: 410, body: '' });
    const { container } = renderAtToken();
    await waitFor(() => {
      expect(screen.getByTestId('shared-report-expired')).toBeInTheDocument();
    });
    const banned = [
      'SEMrush',
      'Semrush',
      'OpenAI',
      'Perplexity',
      'Firecrawl',
      'Browse.ai',
      'SerpAPI',
      'Merge.dev',
      'Anthropic',
      'Claude',
      'GPT-',
      'Supa' + 'base',
    ];
    const text = container.textContent || '';
    banned.forEach((tok) => {
      expect(text).not.toMatch(new RegExp(tok, 'i'));
    });
  });

  test('treats a malformed (too-short) token as invalid without hitting the backend', async () => {
    global.fetch = jest.fn();
    renderAtToken('short');
    await waitFor(() => {
      expect(screen.getByTestId('shared-report-invalid')).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('treats a network failure as the explicit "temporarily unavailable" state', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    renderAtToken();
    await waitFor(() => {
      expect(screen.getByTestId('shared-report-error')).toBeInTheDocument();
    });
  });
});
