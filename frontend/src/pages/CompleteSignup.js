import { Navigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { hasActiveSubscription } from '../lib/subscriptionUi';
import { LoadingScreen } from '../components/ProtectedRoute';

/**
 * /complete-signup — post-auth routing decision point.
 *
 * 2026-05-05 (13041978): Made idempotent — no longer unconditionally redirects
 * to /subscribe. Checks user state and routes appropriately:
 *
 *   1. While auth context is still hydrating → render LoadingScreen.
 *      (rationale: Codex reviewer caught this 2026-05-05 — useSupabaseAuth()
 *      fills user/subscription_status asynchronously after fetchUserProfile's
 *      /api/auth/supabase/me call. Without this guard, the first render
 *      sees user=null, hasActiveSubscription returns false, and the redirect
 *      to /subscribe fires before auth has hydrated. That re-introduces the
 *      original bug for active subscribers.)
 *
 *   2. If user has an active/trialing subscription → /soundboard (in-app)
 *      (rationale: they don't need to subscribe; they're already a paying
 *      customer who somehow got bounced here. Send them into the platform.)
 *
 *   3. If a `plan` query param is present → /subscribe?plan=... (intentional
 *      "pick a plan" flow, e.g. user clicked a tier card on /pricing)
 *
 *   4. Otherwise → /subscribe (no plan preselected; they need to choose)
 *
 * Andreas reported 2026-05-05: existing-customer login was bouncing to
 * /subscribe via this redirect. Root causes were two:
 *   (a) AuthCallbackSupabase over-strict gate (fixed in same PR)
 *   (b) This file's unconditional /subscribe redirect (fixed here)
 */
const CompleteSignup = () => {
  const [searchParams] = useSearchParams();
  const { user, loading } = useSupabaseAuth();

  const plan = String(searchParams.get('plan') || '').trim();
  const redirectParams = new URLSearchParams(searchParams);
  if (plan) {
    redirectParams.set('plan', plan);
  }
  redirectParams.set('from', '/complete-signup');

  // Auth hydration guard. Without this, the first render fires with user=null
  // and hasActiveSubscription(null) returns false, redirecting active
  // subscribers to /subscribe before the auth context has fetched their
  // profile. This re-introduces the exact bug we're fixing. Hold the
  // redirect until loading flips to false.
  if (loading) {
    return <LoadingScreen />;
  }

  // Idempotent: if user already has an active/trialing sub and there's no
  // intentional plan-pick query, send them straight into the app.
  if (user && hasActiveSubscription(user) && !plan) {
    return <Navigate to="/soundboard" replace />;
  }

  return <Navigate to={`/subscribe?${redirectParams.toString()}`} replace />;
};

export default CompleteSignup;
