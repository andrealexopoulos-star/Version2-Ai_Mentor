import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { getBackendUrl } from '../config/urls';
import BiqcLogoCard from '../components/BiqcLogoCard';
import useForceLightTheme from '../hooks/useForceLightTheme';

/**
 * AuthCallbackSupabase — handles both PKCE and implicit OAuth flows.
 *
 * PKCE flow  (Supabase v2 default): URL has ?code=XXXX
 *   → must call exchangeCodeForSession(code) to get a session
 *
 * Implicit flow (legacy / some providers): URL has #access_token=...
 *   → detectSessionInUrl:true in the Supabase client handles it automatically
 *   → getSession() will return the session immediately
 *
 * Both paths end at /advisor on success, /login-supabase on failure.
 */
const AuthCallbackSupabase = () => {
  useForceLightTheme();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing sign in...');

  useEffect(() => {
    let mounted = true;
    let authSubscription = null;
    let safetyTimeout = null;
    let loginRedirectTimeout = null;

    const consumeNextPath = () => {
      const search = new URLSearchParams(window.location.search);
      const fromQuery = String(search.get('next') || '');
      if (fromQuery.startsWith('/')) return fromQuery;
      try {
        const fromStorage = String(sessionStorage.getItem('biqc_auth_next') || '');
        if (fromStorage.startsWith('/')) return fromStorage;
      } catch {}
      return '';
    };

    const clearNextPath = () => {
      try { sessionStorage.removeItem('biqc_auth_next'); } catch {}
    };

    const extractPlanFromPath = (path) => {
      const raw = String(path || '').trim();
      if (!raw.startsWith('/')) return '';
      const queryStart = raw.indexOf('?');
      if (queryStart < 0) return '';
      const params = new URLSearchParams(raw.slice(queryStart + 1));
      const plan = String(params.get('plan') || '').trim().toLowerCase();
      if (!plan) return '';
      if (plan === 'growth' || plan === 'foundation') return 'starter';
      if (plan === 'professional') return 'pro';
      return plan;
    };

    const buildCompleteSignupTarget = (nextPath = '') => {
      const params = new URLSearchParams();
      const normalizedPlan = extractPlanFromPath(nextPath);
      if (normalizedPlan) params.set('plan', normalizedPlan);
      params.set('from', '/auth/callback');
      return `/complete-signup?${params.toString()}`;
    };

    const routeAfterAuth = async (session) => {
      if (!session?.access_token) {
        navigate('/soundboard', { replace: true });
        return;
      }
      const pendingNextPath = consumeNextPath();

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      // ─── P0 2026-04-23 billing hard-gate (Andreas CTO directive) ─────
      // Revenue risk: Gmail OAuth user reached /onboarding-decision with
      // subscription_status=null AND stripe_customer_id=null. The previous
      // gate (subscription_status only) + fail-OPEN on /auth/me errors let
      // card-less users into the app.
      //
      // New contract:
      //   - Hard truth field: stripe_customer_id. If null, user has
      //     definitively never been through /complete-signup.
      //   - Fail CLOSED on any /auth/me error (non-2xx, exception, timeout).
      //     /complete-signup is idempotent — safe to route there. Never
      //     let a transient error drop a user into the app card-less.
      //   - Only super_admin / superadmin / is_master_account bypasses.
      try {
        const backendUrl = getBackendUrl();
        const meRes = await fetch(`${backendUrl}/api/auth/supabase/me`, { headers });
        if (!meRes.ok) {
          clearNextPath();
          navigate(buildCompleteSignupTarget(pendingNextPath), { replace: true });
          return;
        }
        const meData = await meRes.json();
        const u = meData?.user || {};
        const role = String(u.role || '').toLowerCase();
        const isSuperadmin =
          role === 'superadmin' || role === 'super_admin' || u.is_master_account === true;
        if (!isSuperadmin) {
          const hasStripeCustomer =
            typeof u.stripe_customer_id === 'string' && u.stripe_customer_id.length > 0;
          const status = String(u.subscription_status || '').toLowerCase();
          const hasTrialOrPaid = status === 'active' || status === 'trialing';
          if (!hasStripeCustomer || !hasTrialOrPaid) {
            clearNextPath();
            navigate(buildCompleteSignupTarget(pendingNextPath), { replace: true });
            return;
          }
        }
      } catch (_e) {
        // FAIL CLOSED. Do not let a transient /auth/me error bypass the
        // billing gate. /complete-signup is idempotent and routes back
        // in if the user already has a sub.
        clearNextPath();
        navigate(buildCompleteSignupTarget(pendingNextPath), { replace: true });
        return;
      }

      if (pendingNextPath) {
        clearNextPath();
        navigate(pendingNextPath, { replace: true });
        return;
      }

      try {
        const backendUrl = getBackendUrl();
        const [mergeRes, outlookRes, gmailRes] = await Promise.allSettled([
          fetch(`${backendUrl}/api/integrations/merge/connected`, { headers }),
          fetch(`${backendUrl}/api/outlook/status`, { headers }),
          fetch(`${backendUrl}/api/gmail/status`, { headers }),
        ]);

        let hasConnectedTools = false;
        const anyProbeSucceeded =
          (mergeRes.status === 'fulfilled' && mergeRes.value.ok) ||
          (outlookRes.status === 'fulfilled' && outlookRes.value.ok) ||
          (gmailRes.status === 'fulfilled' && gmailRes.value.ok);

        if (mergeRes.status === 'fulfilled' && mergeRes.value.ok) {
          const mergeData = await mergeRes.value.json();
          const integrations = mergeData?.integrations || {};
          hasConnectedTools = hasConnectedTools || Object.values(integrations).some((entry) => entry?.connected);
        }

        if (outlookRes.status === 'fulfilled' && outlookRes.value.ok) {
          const outlookData = await outlookRes.value.json();
          hasConnectedTools = hasConnectedTools || (Boolean(outlookData?.connected) && !Boolean(outlookData?.token_expired));
        }

        if (gmailRes.status === 'fulfilled' && gmailRes.value.ok) {
          const gmailData = await gmailRes.value.json();
          hasConnectedTools = hasConnectedTools || (Boolean(gmailData?.connected) && !Boolean(gmailData?.needs_reconnect));
        }

        if (!anyProbeSucceeded) {
          clearNextPath();
          navigate('/integrations?onboarding=1&source=auth-callback-probe-failed', { replace: true });
        } else if (hasConnectedTools) {
          clearNextPath();
          navigate('/soundboard', { replace: true });
        } else {
          clearNextPath();
          navigate('/integrations?onboarding=1&source=auth-callback', { replace: true });
        }
      } catch {
        clearNextPath();
        navigate('/integrations?onboarding=1&source=auth-callback-error', { replace: true });
      }
    };

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);

        // OAuth provider returned an error
        const oauthError = params.get('error');
        const oauthErrorDesc = params.get('error_description');
        if (oauthError) {
          console.error('[AuthCallback] OAuth error:', oauthError, oauthErrorDesc);
          if (mounted) {
            setStatus(`Sign in failed: ${oauthErrorDesc || oauthError}`);
            loginRedirectTimeout = setTimeout(() => navigate('/login-supabase', { replace: true }), 2500);
          }
          return;
        }

        // PKCE flow — exchange the one-time code for a session
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[AuthCallback] exchangeCodeForSession error:', exchangeError.message);
            // Don't throw — fall through and try getSession() in case session was set another way
          }
        }

        // Both PKCE (after exchange) and implicit flow: session should now exist
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!mounted) return;

        if (data?.session) {
          // GA4 sign-up event — routed to the single gtag config in
          // public/index.html (G-KN4CB0XTVY). Andreas 2026-04-20:
          // consolidated analytics to a single GA4 property; Google Ads
          // conversion tag (AW-…) was removed so `send_to` is omitted.
          try {
            const pendingSignup = localStorage.getItem('biqc_pending_signup');
            if (pendingSignup && window.gtag) {
              window.gtag('event', 'sign_up', { method: pendingSignup });
              localStorage.removeItem('biqc_pending_signup');
            }
          } catch {}
          await routeAfterAuth(data.session);
          return;
        }

        // Session not yet available — wait for onAuthStateChange (covers edge cases / timing)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (!mounted) { return; }
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
            subscription.unsubscribe();
            authSubscription = null;
            routeAfterAuth(session);
          }
        });
        authSubscription = subscription;

        // Safety timeout — if nothing fires in 5 s, send to login
        safetyTimeout = setTimeout(() => {
          authSubscription?.unsubscribe();
          authSubscription = null;
          if (mounted) navigate('/login-supabase', { replace: true });
        }, 5000);

      } catch (e) {
        console.error('[AuthCallback] Unexpected error:', e.message);
        if (mounted) {
          setStatus(`Error: ${e.message}`);
          loginRedirectTimeout = setTimeout(() => navigate('/login-supabase', { replace: true }), 2500);
        }
      }
    };

    handleCallback();
    return () => {
      mounted = false;
      if (safetyTimeout) clearTimeout(safetyTimeout);
      if (loginRedirectTimeout) clearTimeout(loginRedirectTimeout);
      authSubscription?.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
      <style>{`
        @keyframes biqcBar{0%{width:0}100%{width:100%}}
      `}</style>
      <div className="text-center flex flex-col items-center gap-6">
        {/* Hovering BIQc.ai logo card — replaces the pulsing orange circle */}
        <BiqcLogoCard size="md" to={null} static />
        <p className="text-sm" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)', maxWidth: 300 }}>{status}</p>
        <div className="w-48 mx-auto">
          <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(10,10,10,0.08)' }}>
            <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #E85D00, #FF8C33)', animation: 'biqcBar 3s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackSupabase;
