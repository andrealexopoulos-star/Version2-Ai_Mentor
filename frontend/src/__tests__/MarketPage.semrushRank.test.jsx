/**
 * F15 (2026-05-04) — Frontend transition robustness for the
 * `semrush_rank → authority_rank` rename.
 *
 * R2D renamed `semrush_rank` to `authority_rank` in the Contract v2 sanitizer
 * (backend/core/response_sanitizer.py:_KEY_RENAMES) to close the last
 * banned-token leak under BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.
 *
 * MarketPage.js was the only frontend consumer (R-R2D verified). F15 updated
 * it to read `authority_rank ?? semrush_rank` so that:
 *   1. NEW responses (post-deploy) render via `authority_rank`
 *   2. OLD cached responses (pre-deploy, still in 24h Supabase scan_cache TTL)
 *      continue to render via the legacy `semrush_rank` fallback
 *
 * Without the fallback the rank section would silently disappear for any
 * customer whose scan_cache row was populated before deploy — a UX regression
 * during the rollover window.
 *
 * This file validates the rendering function that mirrors MarketPage's exact
 * logic (extracting the inline JSX would require module-level refactor for
 * what is a leaf rendering decision — a pure-function test is sufficient
 * and avoids the whole DashboardLayout / SupabaseAuthContext / apiClient
 * mock surface).
 */

/* global describe, it, expect */

import React from 'react';
import { render, screen } from '@testing-library/react';

/**
 * Mirrors the exact rendering branch in MarketPage.js (post-F15) at the
 * "Domain rank" subsection of the "Organic Search Performance" Panel.
 * If MarketPage's logic ever drifts from this, the assertion will surface
 * during code review (the test name + comment block is the lookout).
 */
function DomainRankBlock({ seoAnalysis }) {
  const rank = seoAnalysis.authority_rank ?? seoAnalysis.semrush_rank;
  if (rank == null) return null;
  return (
    <div data-testid="domain-rank">
      <p>Domain rank</p>
      <p data-testid="rank-value">{rank.toLocaleString()}</p>
    </div>
  );
}

describe('F15 — semrush_rank → authority_rank transition', () => {
  it('renders authority_rank when only the new key is present (post-deploy responses)', () => {
    render(<DomainRankBlock seoAnalysis={{ authority_rank: 145000 }} />);
    expect(screen.getByTestId('domain-rank')).toBeInTheDocument();
    expect(screen.getByTestId('rank-value')).toHaveTextContent('145,000');
  });

  it('renders semrush_rank when only the legacy key is present (cached pre-deploy responses)', () => {
    render(<DomainRankBlock seoAnalysis={{ semrush_rank: 145000 }} />);
    expect(screen.getByTestId('domain-rank')).toBeInTheDocument();
    expect(screen.getByTestId('rank-value')).toHaveTextContent('145,000');
  });

  it('prefers authority_rank when BOTH keys are present (sanitiser-renamed wins)', () => {
    // If both arrive (defensive double-write), authority_rank takes precedence
    // because that's the contract-v2 canonical name.
    render(<DomainRankBlock seoAnalysis={{ authority_rank: 145000, semrush_rank: 999999 }} />);
    expect(screen.getByTestId('rank-value')).toHaveTextContent('145,000');
  });

  it('renders nothing when neither key is present (avoids "Domain rank: undefined" bug)', () => {
    const { container } = render(<DomainRankBlock seoAnalysis={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when both keys are explicitly null (Contract v2 INSUFFICIENT_SIGNAL upstream)', () => {
    const { container } = render(<DomainRankBlock seoAnalysis={{ authority_rank: null, semrush_rank: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('handles authority_rank=0 (treats 0 as a real value, not nullish)', () => {
    // rank=0 is technically a real number. ?? operator only falls through on
    // null/undefined. This guards against a refactor accidentally using
    // `||` which would skip the 0-rank case.
    render(<DomainRankBlock seoAnalysis={{ authority_rank: 0 }} />);
    expect(screen.getByTestId('rank-value')).toHaveTextContent('0');
  });
});
