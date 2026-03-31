import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { getBackendUrl } from '../config/urls';

const fetchWithTimeout = async (url, options = {}, timeoutMs = 6000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

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
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing sign in...');

  useEffect(() => {
    let mounted = true;
    let authSubscription = null;
    let safetyTimeout = null;
    let loginRedirectTimeout = null;

    const routeAfterAuth = async (session) => {
      if (!session?.access_token) {
        navigate('/advisor', { replace: true });
        return;
      }

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      try {
        const backendUrl = getBackendUrl();
        const [mergeRes, outlookRes, gmailRes] = await Promise.allSettled([
          fetchWithTimeout(`${backendUrl}/api/integrations/merge/connected`, { headers }),
          fetchWithTimeout(`${backendUrl}/api/outlook/status`, { headers }),
          fetchWithTimeout(`${backendUrl}/api/gmail/status`, { headers }),
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
          navigate('/integrations?onboarding=1&source=auth-callback-probe-failed', { replace: true });
        } else if (hasConnectedTools) {
          navigate('/advisor', { replace: true });
        } else {
          navigate('/integrations?onboarding=1&source=auth-callback', { replace: true });
        }
      } catch {
        navigate('/integrations?onboarding=1&source=auth-callback-error', { replace: true });
      }
    };

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          (window.location.hash || '').startsWith('#')
            ? window.location.hash.slice(1)
            : (window.location.hash || '')
        );

        // OAuth provider returned an error
        const oauthError = params.get('error') || hashParams.get('error');
        const oauthErrorDesc = params.get('error_description') || hashParams.get('error_description');
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

        // Fallback for providers that return token fragments directly.
        const accessToken = params.get('access_token') || hashParams.get('access_token');
        const refreshToken = params.get('refresh_token') || hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            console.error('[AuthCallback] setSession error:', setSessionError.message);
          }
        }

        // Both PKCE (after exchange) and implicit flow: session should now exist
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!mounted) return;

        if (data?.session) {
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

        // Safety timeout — if nothing fires in 10 s, send to login
        safetyTimeout = setTimeout(() => {
          authSubscription?.unsubscribe();
          authSubscription = null;
          if (mounted) navigate('/login-supabase', { replace: true });
        }, 10000);

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
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--biqc-bg)' }}>
      <style>{`
        @keyframes biqcPulse{0%,100%{opacity:0.4;transform:scale(0.95)}50%{opacity:1;transform:scale(1.05)}}
        @keyframes biqcBar{0%{width:0}100%{width:100%}}
      `}</style>
      <div className="text-center space-y-5">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
          style={{ background: '#FF6A00', animation: 'biqcPulse 2s ease-in-out infinite' }}
        >
          <span className="text-white font-bold text-xl" style={{ fontFamily: "'JetBrains Mono', monospace" }}>B</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--biqc-text-2)', fontFamily: "'Inter', sans-serif" }}>{status}</p>
        <div className="w-40 mx-auto">
          <div className="h-0.5 rounded-full overflow-hidden" style={{ background: '#243140' }}>
            <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#FF6A00,#FF8C33)', animation: 'biqcBar 3s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackSupabase;
