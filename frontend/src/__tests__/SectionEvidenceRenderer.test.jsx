/**
 * SectionEvidenceRenderer tests — E6 / fix/p0-marjo-e6-cmo-section-evidence
 *
 * Covers the 5-state contract from
 * BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2:
 *   DATA_AVAILABLE | INSUFFICIENT_SIGNAL | DEGRADED | PROCESSING | DATA_UNAVAILABLE
 *
 * Plus the placeholder denylist (Marketing-101 phrases + bare placeholder
 * tokens) which is the failure mode of PR #449.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SectionEvidenceRenderer, {
  SECTION_STATE,
  StateBanner,
  ProvenancePill,
  isPlaceholderText,
  PLACEHOLDER_EXACT,
  PLACEHOLDER_PHRASES,
  getSection,
} from '../components/SectionEvidenceRenderer';

describe('SectionEvidenceRenderer — 5-state contract', () => {
  it('renders children when state is DATA_AVAILABLE', () => {
    const section = {
      state: SECTION_STATE.DATA_AVAILABLE,
      evidence: { items: ['Real evidence-backed item'] },
      reason: null,
      source_trace_ids: ['trace-1', 'trace-2'],
    };
    render(
      <SectionEvidenceRenderer section={section}>
        {(evidence) => <div data-testid="content">{evidence.items.join(',')}</div>}
      </SectionEvidenceRenderer>,
    );
    expect(screen.getByTestId('content')).toHaveTextContent('Real evidence-backed item');
    // Provenance pill shown
    expect(screen.getByTestId('provenance-pill')).toBeInTheDocument();
    // No state banner
    expect(screen.queryByTestId(/section-state-banner-/)).not.toBeInTheDocument();
  });

  it('renders INSUFFICIENT_SIGNAL banner with sanitised reason — no children, no fake data', () => {
    const section = {
      state: SECTION_STATE.INSUFFICIENT_SIGNAL,
      evidence: null,
      reason: "We couldn't gather enough public review data for this business.",
      source_trace_ids: [],
    };
    render(
      <SectionEvidenceRenderer section={section}>
        {() => <div data-testid="content">should not render</div>}
      </SectionEvidenceRenderer>,
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    const banner = screen.getByTestId('section-state-banner-insufficient_signal');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("couldn't gather enough public review data");
  });

  it('renders DEGRADED banner with retry CTA + still renders evidence when present', () => {
    const onRetry = jest.fn();
    const section = {
      state: SECTION_STATE.DEGRADED,
      evidence: { partial: true, items: ['Partial item'] },
      reason: 'Partial intelligence — re-run scan for fuller view.',
      source_trace_ids: ['trace-7'],
    };
    render(
      <SectionEvidenceRenderer section={section} onRetry={onRetry}>
        {(evidence) => <div data-testid="content">{evidence.items[0]}</div>}
      </SectionEvidenceRenderer>,
    );
    expect(screen.getByTestId('content')).toHaveTextContent('Partial item');
    expect(screen.getByTestId('section-state-banner-degraded')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('section-retry-degraded'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders PROCESSING banner with spinner and processing copy', () => {
    const section = {
      state: SECTION_STATE.PROCESSING,
      evidence: null,
      reason: 'Deep intelligence is still processing.',
      source_trace_ids: [],
    };
    render(
      <SectionEvidenceRenderer section={section}>
        {() => <div data-testid="content">should not render</div>}
      </SectionEvidenceRenderer>,
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    const banner = screen.getByTestId('section-state-banner-processing');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/processing/i);
  });

  it('renders DATA_UNAVAILABLE banner with retry CTA', () => {
    const onRetry = jest.fn();
    const section = {
      state: SECTION_STATE.DATA_UNAVAILABLE,
      evidence: null,
      reason: 'Intelligence signal unavailable for this scan.',
      source_trace_ids: [],
    };
    render(
      <SectionEvidenceRenderer section={section} onRetry={onRetry} />,
    );
    expect(screen.getByTestId('section-state-banner-data_unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('section-retry-data_unavailable'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('treats null/undefined section as DATA_UNAVAILABLE (defensive)', () => {
    render(<SectionEvidenceRenderer section={null} />);
    expect(screen.getByTestId('section-state-banner-data_unavailable')).toBeInTheDocument();
  });

  it('coerces unknown state to DATA_UNAVAILABLE — never trusts arbitrary strings', () => {
    const section = {
      state: 'UNKNOWN_STATE_FROM_BAD_BACKEND',
      evidence: null,
      reason: null,
      source_trace_ids: [],
    };
    render(<SectionEvidenceRenderer section={section} />);
    expect(screen.getByTestId('section-state-banner-data_unavailable')).toBeInTheDocument();
  });
});

describe('Placeholder denylist — PR #449 failure-mode guard', () => {
  it('matches bare placeholder tokens (TBD, Lorem ipsum, Various, …)', () => {
    expect(isPlaceholderText('TBD')).toBe(true);
    expect(isPlaceholderText('Lorem ipsum')).toBe(true);
    expect(isPlaceholderText('Various')).toBe(true);
    expect(isPlaceholderText('Strong')).toBe(true);
    expect(isPlaceholderText('Coming soon')).toBe(true);
    expect(isPlaceholderText('Insufficient evidence to produce report')).toBe(true);
    expect(isPlaceholderText('N/A')).toBe(true);
  });

  it('matches Marketing-101 phrase patterns (the PR #449 SWOT failure mode)', () => {
    expect(isPlaceholderText('You should improve your social media presence.')).toBe(true);
    expect(isPlaceholderText('Increase your brand awareness across regions.')).toBe(true);
    expect(isPlaceholderText('Create a content calendar for the next quarter.')).toBe(true);
    expect(isPlaceholderText('Leverage your social media channels.')).toBe(true);
    expect(isPlaceholderText('Build an email list of qualified prospects.')).toBe(true);
    expect(isPlaceholderText('Optimize your SEO across the site.')).toBe(true);
    expect(isPlaceholderText('Optimise your SEO for AU search terms.')).toBe(true);
    expect(isPlaceholderText('Differentiate from competitors in your category.')).toBe(true);
  });

  it('does NOT match evidence-backed text that mentions the same noun by accident', () => {
    expect(
      isPlaceholderText(
        'Direct competitor "ACME Roofing" mentions a 4.7-star Google Business profile vs your unrated profile.',
      ),
    ).toBe(false);
    expect(
      isPlaceholderText(
        'Your domain authority of 28 lags Joe\'s Plumbing (DA 41) and Roofing Co (DA 38).',
      ),
    ).toBe(false);
    expect(isPlaceholderText('')).toBe(false);
    expect(isPlaceholderText(null)).toBe(false);
    expect(isPlaceholderText(123)).toBe(false);
  });

  it('exposes the same denylist constants as the backend (cross-platform parity check)', () => {
    expect(PLACEHOLDER_EXACT.has('TBD')).toBe(true);
    expect(PLACEHOLDER_EXACT.has('Lorem ipsum')).toBe(true);
    expect(PLACEHOLDER_PHRASES.length).toBeGreaterThanOrEqual(8);
  });
});

describe('ProvenancePill — source-trace pill', () => {
  it('renders nothing when no trace ids', () => {
    const { container } = render(<ProvenancePill traceIds={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders pill with count + tooltip when trace ids present', () => {
    render(<ProvenancePill traceIds={['t1', 't2', 't3']} />);
    const pill = screen.getByTestId('provenance-pill');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('Source (3)');
    expect(pill.getAttribute('title')).toContain('t1');
  });
});

describe('getSection — defensive accessor', () => {
  it('returns null when report is null', () => {
    expect(getSection(null, 'swot_strengths')).toBeNull();
  });
  it('returns null when report has no sections key', () => {
    expect(getSection({}, 'swot_strengths')).toBeNull();
  });
  it('returns null when section id is not present', () => {
    expect(getSection({ sections: {} }, 'swot_strengths')).toBeNull();
  });
  it('returns the section payload when present', () => {
    const section = { state: SECTION_STATE.DATA_AVAILABLE, evidence: {}, reason: null, source_trace_ids: [] };
    expect(getSection({ sections: { swot_strengths: section } }, 'swot_strengths')).toBe(section);
  });
});
