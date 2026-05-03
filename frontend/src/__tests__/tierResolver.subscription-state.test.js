import { resolveTier } from '../lib/tierResolver';

describe('tierResolver subscription gating', () => {
  it('does not grant pro by default for non-trialing users', () => {
    const tier = resolveTier({
      email: 'new-user@example.com',
      subscription_tier: null,
      subscription_status: null,
      trial_expires_at: new Date(Date.now() + 86400000).toISOString(),
      trial_tier: null,
      on_trial: false,
    });
    expect(tier).toBe('free');
  });

  it('grants starter/pro only when trialing is explicit', () => {
    const starterTier = resolveTier({
      email: 'trial@example.com',
      subscription_status: 'trialing',
      trial_expires_at: new Date(Date.now() + 86400000).toISOString(),
      trial_tier: null,
      on_trial: true,
    });
    const proTier = resolveTier({
      email: 'trial-pro@example.com',
      subscription_status: 'trialing',
      trial_expires_at: new Date(Date.now() + 86400000).toISOString(),
      trial_tier: 'pro',
      on_trial: true,
    });
    expect(starterTier).toBe('starter');
    expect(proTier).toBe('pro');
  });
});
