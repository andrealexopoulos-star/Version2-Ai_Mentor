import { hasActiveSubscription } from '../lib/subscriptionUi';

describe('subscribe current-plan visibility guard', () => {
  it('returns false for first-time users without active subscription', () => {
    expect(hasActiveSubscription({ subscription_status: null, stripe_subscription_id: null })).toBe(false);
    expect(hasActiveSubscription({ subscription_status: 'trialing', stripe_subscription_id: null })).toBe(false);
  });

  it('returns true only for active/trialing with stripe subscription id', () => {
    expect(hasActiveSubscription({ subscription_status: 'active', stripe_subscription_id: 'sub_123' })).toBe(true);
    expect(hasActiveSubscription({ subscription_status: 'trialing', stripe_subscription_id: 'sub_123' })).toBe(true);
    expect(hasActiveSubscription({ subscription_status: 'canceled', stripe_subscription_id: 'sub_123' })).toBe(false);
  });
});
