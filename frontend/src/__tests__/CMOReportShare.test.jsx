/**
 * CMOReportPage — Share button tests.
 *
 * fix/p0-marjo-e8-share-function (PR #449 follow-up).
 *
 * PR #449 admitted: "Share action could silently no-op". These tests prove:
 *   1. Clicking Share opens a modal with a copyable URL on success.
 *   2. Clicking Share with a 5xx response shows an explicit error banner
 *      (NEVER silently disappears).
 *   3. While the request is in-flight the button is disabled to prevent
 *      double-submit creating two share rows for one click.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Mock heavy module-level deps BEFORE importing the page ──────────────
jest.mock('../lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../components/DashboardLayout', () => {
  const React = require('react');
  return function DashboardLayoutMock({ children }) {
    return React.createElement('div', { 'data-testid': 'dashboard-layout-mock' }, children);
  };
});

jest.mock('../components/ui/skeleton-loader', () => ({
  PageSkeleton: () => null,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// IntersectionObserver isn't available in jsdom by default — stub it
// so the gauge + progress bars don't crash on mount.
beforeAll(() => {
  global.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import CMOReportPage from '../pages/CMOReportPage';


function _resolveCmoReport(data = {}) {
  apiClient.get.mockResolvedValue({
    data: {
      company_name: 'Acme Co',
      report_date: '01/05/2026',
      executive_summary: 'Acme summary.',
      market_position: { overall: 72, brand: 70, digital: 76, sentiment: 68, competitive: 65 },
      competitors: [],
      position_dots: [],
      swot: { strengths: ['A'], weaknesses: ['B'], opportunities: ['C'], threats: ['D'] },
      reviews: { rating: 0, count: 0, positive_pct: 0, neutral_pct: 0, negative_pct: 0 },
      review_themes: { positive: [], negative: [] },
      review_excerpts: [],
      roadmap: { quick_wins: [], priorities: [], strategic: [] },
      geographic: { established: [], growth: [] },
      ...data,
    },
  });
}


describe('CMOReportPage — Share Report (fix/p0-marjo-e8)', () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    toast.success.mockClear();
    toast.error.mockClear();
    toast.info.mockClear();
  });

  it('opens the share modal with a copyable URL on success', async () => {
    _resolveCmoReport();
    apiClient.post.mockResolvedValue({
      data: {
        ok: true,
        share_url: 'https://biqc.ai/r/abcdefghijklmnopqrstuvwxyz0123456789ABC',
        expires_at: '2026-05-11T07:00:00Z',
        share_event_id: 'se-1',
        mechanism: 'shareable_link',
      },
    });

    render(<CMOReportPage />);

    // Wait for the report to load — Share button only appears post-load.
    const shareBtn = await screen.findByTestId('cmo-share-button');
    fireEvent.click(shareBtn);

    // Modal opens immediately (in loading state) so user knows the click registered.
    expect(await screen.findByTestId('cmo-share-modal')).toBeInTheDocument();

    // After the POST resolves, the URL input + Copy button render.
    const urlInput = await screen.findByTestId('cmo-share-url');
    expect(urlInput.value).toBe('https://biqc.ai/r/abcdefghijklmnopqrstuvwxyz0123456789ABC');
    expect(screen.getByTestId('cmo-share-copy')).toBeInTheDocument();
    expect(screen.queryByTestId('cmo-share-error')).not.toBeInTheDocument();

    // Backend was called with the correct path.
    expect(apiClient.post).toHaveBeenCalledWith('/reports/cmo-report/share', {});

    // Success toast fired — no silent flow.
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Share link ready'));
  });

  it('shows an explicit error banner on 5xx — NEVER silent no-op', async () => {
    _resolveCmoReport();
    const err = new Error('boom');
    err.response = { status: 502, data: {} };
    apiClient.post.mockRejectedValue(err);

    render(<CMOReportPage />);
    const shareBtn = await screen.findByTestId('cmo-share-button');
    fireEvent.click(shareBtn);

    // Modal opens, then surfaces the error banner.
    const errorBanner = await screen.findByTestId('cmo-share-error');
    expect(errorBanner).toBeInTheDocument();
    expect(errorBanner.textContent).toMatch(/temporarily unavailable|try again/i);

    // Retry button visible — user can recover without leaving the modal.
    expect(screen.getByTestId('cmo-share-retry')).toBeInTheDocument();

    // No URL field rendered when the request failed.
    expect(screen.queryByTestId('cmo-share-url')).not.toBeInTheDocument();

    // Destructive toast fired — proves explicit failure feedback.
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('disables the Share button while the request is in flight (prevents double-submit)', async () => {
    _resolveCmoReport();
    // Make the post hang so we can inspect the in-flight state.
    let resolveFn;
    apiClient.post.mockReturnValue(new Promise((res) => { resolveFn = res; }));

    render(<CMOReportPage />);
    const shareBtn = await screen.findByTestId('cmo-share-button');

    fireEvent.click(shareBtn);

    // While in-flight: button disabled, aria-busy true, label changes.
    await waitFor(() => expect(shareBtn).toBeDisabled());
    expect(shareBtn.getAttribute('aria-busy')).toBe('true');
    expect(shareBtn.textContent).toMatch(/Preparing/i);

    // Loading row visible inside the modal.
    expect(screen.getByTestId('cmo-share-loading')).toBeInTheDocument();

    // A second click while in-flight does NOT trigger another POST.
    fireEvent.click(shareBtn);
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    // Resolve the promise to clean up.
    resolveFn({
      data: {
        ok: true,
        share_url: 'https://biqc.ai/r/abcdefghijklmnopqrstuvwxyz0123456789XYZ',
        expires_at: '2026-05-11T07:00:00Z',
        share_event_id: 'se-2',
        mechanism: 'shareable_link',
      },
    });
    await waitFor(() => expect(shareBtn).not.toBeDisabled());
  });

  it('treats a 200 with empty share_url as a failure (Contract v2 — no silent success)', async () => {
    _resolveCmoReport();
    apiClient.post.mockResolvedValue({ data: { ok: true } });

    render(<CMOReportPage />);
    const shareBtn = await screen.findByTestId('cmo-share-button');
    fireEvent.click(shareBtn);

    // Error banner surfaces because the response had no usable URL.
    const errorBanner = await screen.findByTestId('cmo-share-error');
    expect(errorBanner).toBeInTheDocument();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
