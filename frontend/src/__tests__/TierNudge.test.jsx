import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TierNudge from '../components/TierNudge';

// Mock auth context — tier resolution happens via this hook.
const mockUseSupabaseAuth = jest.fn();
jest.mock('../context/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => mockUseSupabaseAuth(),
}));

const STARTER_USER   = { email: 'starter@example.com',  subscription_tier: 'starter' };
const PRO_USER       = { email: 'pro@example.com',      subscription_tier: 'pro' };
const BUSINESS_USER  = { email: 'biz@example.com',      subscription_tier: 'business' };
const FREE_USER      = { email: 'free@example.com',     subscription_tier: 'free' };

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('TierNudge — Sprint B #13 (per-tier capability nudges)', () => {
  beforeEach(() => {
    mockUseSupabaseAuth.mockReset();
    localStorage.clear();
  });

  it('renders nothing when user already has access to the required tier', () => {
    mockUseSupabaseAuth.mockReturnValue({ user: PRO_USER });
    const { container } = renderIn(<TierNudge featureKey="advisor_depth" />);
    // advisor_depth requires 'pro' — PRO_USER has it → should render nothing.
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the user has MORE than the required tier', () => {
    mockUseSupabaseAuth.mockReturnValue({ user: BUSINESS_USER });
    const { container } = renderIn(<TierNudge featureKey="advisor_depth" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a nudge for Starter user pointing at Pro', () => {
    mockUseSupabaseAuth.mockReturnValue({ user: STARTER_USER });
    renderIn(<TierNudge featureKey="advisor_depth" />);
    const nudge = screen.getByTestId('tier-nudge');
    expect(nudge).toBeInTheDocument();
    expect(nudge).toHaveAttribute('data-required-tier', 'pro');
    expect(screen.getByText(/Unlock/i)).toBeInTheDocument();
    expect(screen.getByText(/Deeper AI-routed analysis/i)).toBeInTheDocument();
    // CTA points at /subscribe with feature param
    const cta = nudge.querySelector('a');
    expect(cta).toHaveAttribute('href', expect.stringContaining('/subscribe?from=nudge_advisor_depth'));
  });

  it('renders a nudge for Free user pointing at Business for integrations_15', () => {
    mockUseSupabaseAuth.mockReturnValue({ user: FREE_USER });
    renderIn(<TierNudge featureKey="integrations_15" />);
    const nudge = screen.getByTestId('tier-nudge');
    expect(nudge).toHaveAttribute('data-required-tier', 'business');
  });

  it('dismiss button persists across renders via localStorage', () => {
    mockUseSupabaseAuth.mockReturnValue({ user: STARTER_USER });
    const { container, unmount } = renderIn(<TierNudge featureKey="advisor_depth" />);
    const dismiss = screen.getByLabelText('Dismiss upgrade suggestion');
    fireEvent.click(dismiss);
    // After click the nudge is removed
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem('biqc_tier_nudge_dismissed_v1_advisor_depth')).toBe('1');

    // Re-render and confirm the nudge stays dismissed
    unmount();
    const { container: second } = renderIn(<TierNudge featureKey="advisor_depth" />);
    expect(second).toBeEmptyDOMElement();
  });

  it('dismissal is scoped per feature — dismissing one does not hide another', () => {
    mockUseSupabaseAuth.mockReturnValue({ user: STARTER_USER });
    localStorage.setItem('biqc_tier_nudge_dismissed_v1_advisor_depth', '1');

    const { container } = renderIn(<TierNudge featureKey="advisor_depth" />);
    expect(container).toBeEmptyDOMElement();

    const { getByTestId } = renderIn(<TierNudge featureKey="advisor_volume" />);
    expect(getByTestId('tier-nudge')).toBeInTheDocument();
  });

  it('supports ad-hoc usage without a featureKey', () => {
    mockUseSupabaseAuth.mockReturnValue({ user: STARTER_USER });
    renderIn(
      <TierNudge label="Deeper market compare" requiredTier="business" hint="Hint text" />
    );
    const nudge = screen.getByTestId('tier-nudge');
    expect(nudge).toHaveAttribute('data-required-tier', 'business');
    expect(nudge).toHaveAttribute('data-feature', 'adhoc');
    expect(screen.getByText(/Deeper market compare/)).toBeInTheDocument();
  });

  it('renders nothing for unknown requiredTier (guards typos in usage)', () => {
    mockUseSupabaseAuth.mockReturnValue({ user: STARTER_USER });
    const { container } = renderIn(<TierNudge label="X" requiredTier="tier_that_does_not_exist" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when neither featureKey nor label provided', () => {
    mockUseSupabaseAuth.mockReturnValue({ user: STARTER_USER });
    const { container } = renderIn(<TierNudge requiredTier="pro" />);
    expect(container).toBeEmptyDOMElement();
  });
});
