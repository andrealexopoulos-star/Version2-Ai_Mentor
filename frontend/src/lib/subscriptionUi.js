export const canonicalCheckoutPlanId = (rawPlan) => {
  const value = String(rawPlan || '').toLowerCase().trim();
  if (value === 'growth' || value === 'lite' || value === 'foundation') return 'starter';
  if (value === 'professional') return 'pro';
  if (value === 'starter' || value === 'pro' || value === 'business') return value;
  return 'starter';
};

export const hasActiveSubscription = (user) => {
  const status = (user?.subscription_status || '').toLowerCase().trim();
  const isSubscribed = status === 'active' || status === 'trialing';
  return isSubscribed && Boolean(user?.stripe_subscription_id);
};

export const planCtaHref = (user, planId) => {
  if (planId === 'business') return '/speak-with-local-specialist';
  const normalizedPlan = canonicalCheckoutPlanId(planId);
  const subscribeNext = `/subscribe?plan=${normalizedPlan}`;
  return user ? subscribeNext : `/register-supabase?next=${encodeURIComponent(subscribeNext)}`;
};
