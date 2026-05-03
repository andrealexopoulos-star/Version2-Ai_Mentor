import { planCtaHref } from '../lib/subscriptionUi';

describe('pricing plan CTA routing', () => {
  it('preserves selected plan for authenticated users', () => {
    expect(planCtaHref({ id: 'u1' }, 'pro')).toBe('/subscribe?plan=pro');
    expect(planCtaHref({ id: 'u1' }, 'growth')).toBe('/subscribe?plan=starter');
  });

  it('preserves selected plan via next param for unauthenticated users', () => {
    expect(planCtaHref(null, 'business')).toBe('/speak-with-local-specialist');
    expect(planCtaHref(null, 'pro')).toContain('/register-supabase?next=');
    expect(decodeURIComponent(planCtaHref(null, 'pro').split('next=')[1])).toBe('/subscribe?plan=pro');
  });
});
