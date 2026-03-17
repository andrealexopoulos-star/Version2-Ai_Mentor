import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';

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

    const routeAfterAuth = async (session) => {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      if (!backendUrl || !session?.access_token) {
        navigate('/advisor', { replace: true });
        return;
      }

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      try {
        const [mergeRes, outlookRes, gmailRes] = await Promise.allSettled([
          fetch(`${backendUrl}/api/integrations/merge/connected`, { headers }),
          fetch(`${backendUrl}/api/outlook/status`, { headers }),
          fetch(`${backendUrl}/api/gmail/status`, { headers }),
        ]);

        let hasConnectedTools = false;

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

        if (hasConnectedTools) {
          navigate('/advisor', { replace: true });
        } else {
          navigate('/integrations?onboarding=1&source=auth-callback', { replace: true });
        }
      } catch {
        navigate('/advisor', { replace: true });
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
            setTimeout(() => navigate('/login-supabase', { replace: true }), 2500);
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
          await routeAfterAuth(data.session);
          return;
        }

        // Session not yet available — wait for onAuthStateChange (covers edge cases / timing)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (!mounted) { subscription.unsubscribe(); return; }
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
            subscription.unsubscribe();
            routeAfterAuth(session);
          }
        });

        // Safety timeout — if nothing fires in 5 s, send to login
        const timeout = setTimeout(() => {
          subscription.unsubscribe();
          if (mounted) navigate('/login-supabase', { replace: true });
        }, 5000);

        return () => {
          clearTimeout(timeout);
          subscription.unsubscribe();
        };

      } catch (e) {
        console.error('[AuthCallback] Unexpected error:', e.message);
        if (mounted) {
          setStatus(`Error: ${e.message}`);
          setTimeout(() => navigate('/login-supabase', { replace: true }), 2500);
        }
      }
    };

    handleCallback();
    return () => { mounted = false; };
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
