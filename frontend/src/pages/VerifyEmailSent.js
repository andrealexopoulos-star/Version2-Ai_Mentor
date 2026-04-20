import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import BiqcLogoCard from '../components/BiqcLogoCard';
import useForceLightTheme from '../hooks/useForceLightTheme';
import { getApiBaseUrl } from '../config/urls';
import { supabase } from '../context/SupabaseAuthContext';

const DISPLAY = 'var(--font-marketing-display, "Geist", sans-serif)';
const UI      = 'var(--font-marketing-ui, "Geist", sans-serif)';
const MONO    = 'var(--font-marketing-ui, "Geist", sans-serif)';

/**
 * Post-signup landing page. The user has just completed Stripe signup
 * and is sitting on a valid Supabase session but has NOT yet clicked
 * the link in their E1 verification email.
 *
 * We:
 *   1. Show a calm "check your inbox" card.
 *   2. Poll /auth/verification-status every 5s so if the user clicks
 *      the link in another tab (or on mobile), this page flips to the
 *      success state and auto-redirects to /advisor.
 *   3. Expose a "Resend" button that hits /auth/resend-verification-email
 *      with a 60-second cooldown enforced server-side.
 */
const VerifyEmailSent = () => {
  useForceLightTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const pollRef = useRef(null);

  const fetchToken = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch {
      return null;
    }
  };

  // Pull the signed-in user's email for the headline ("We sent a link to …").
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setEmail(data?.user?.email || '');
      } catch {
        // non-fatal
      }
    })();
  }, []);

  // Poll verification-status every 5 seconds. Stops the moment we see
  // verified=true and redirects to /advisor after a short celebratory pause.
  useEffect(() => {
    const poll = async () => {
      const token = await fetchToken();
      if (!token) return;
      try {
        const resp = await fetch(`${getApiBaseUrl()}/auth/verification-status`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data?.verified) {
          setVerified(true);
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => navigate('/advisor', { replace: true }), 1500);
        }
      } catch {
        // non-fatal — next tick will retry.
      }
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [navigate]);

  // Cooldown tick-down.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      const token = await fetchToken();
      if (!token) {
        toast.error('Please sign in again to resend.');
        return;
      }
      const resp = await fetch(`${getApiBaseUrl()}/auth/resend-verification-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(data.detail || 'Could not resend — please try again.');
        return;
      }
      if (data.status === 'cooldown') {
        setCooldown(data.retry_after || 60);
        toast.message(`Please wait ${data.retry_after || 60}s before resending.`);
      } else if (data.status === 'already_verified') {
        setVerified(true);
        toast.success('Already verified — redirecting…');
      } else {
        setCooldown(60);
        toast.success('New verification email sent.');
      }
    } catch (err) {
      toast.error(err.message || 'Could not resend.');
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // no-op
    }
    navigate('/login-supabase', { replace: true });
  };

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
        <div className="max-w-sm w-full text-center">
          <div className="mb-8"><BiqcLogoCard size="sm" to="/" /></div>
          <div style={{
            background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)',
            border: '1px solid rgba(10,10,10,0.06)', borderRadius: '20px', padding: '32px',
            boxShadow: '0 14px 40px rgba(10,10,10,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}>
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#16A34A' }} />
            <h1 className="mb-2" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)', fontSize: '24px', fontWeight: 600, letterSpacing: '-0.025em' }}>
              Email verified
            </h1>
            <p className="text-sm" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
              Taking you to your dashboard…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
      <div className="max-w-sm w-full">
        <div className="mb-8"><BiqcLogoCard size="sm" to="/" /></div>

        <div
          style={{
            background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)',
            border: '1px solid rgba(10,10,10,0.06)', borderRadius: '20px', padding: '32px',
            boxShadow: '0 14px 40px rgba(10,10,10,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
          data-testid="verify-email-sent-card"
        >
          <div
            className="w-14 h-14 flex items-center justify-center mb-6"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.08)', borderRadius: '12px' }}
          >
            <Mail className="w-6 h-6" style={{ color: 'var(--lava, #E85D00)' }} />
          </div>

          <h1 className="mb-3" style={{
            fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)',
            fontSize: '28px', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15,
          }}>
            Check your inbox
          </h1>
          <p className="text-sm leading-relaxed" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
            We sent a verification link{email ? <> to <strong style={{ color: 'var(--ink-display, #0A0A0A)' }}>{email}</strong></> : null}.
            Click the button in the email to activate your BIQc account and start your first intelligence brief.
          </p>

          <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(232,93,0,0.08)', border: '1px solid rgba(232,93,0,0.18)' }}>
            <p className="text-[13px]" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
              <strong style={{ color: 'var(--ink-display, #0A0A0A)' }}>Your trial is already live.</strong>{' '}
              This page auto-refreshes the moment you click the link.
            </p>
          </div>

          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="w-full flex items-center justify-center gap-2 mt-6 h-12 text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: '#FFFFFF', color: 'var(--ink-display, #0A0A0A)', fontFamily: UI,
              border: '1px solid rgba(10,10,10,0.1)', borderRadius: '999px', cursor: (resending || cooldown > 0) ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.005em',
            }}
            data-testid="verify-resend-btn"
          >
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {cooldown > 0 ? `Resend in ${cooldown}s` : (resending ? 'Sending…' : 'Resend verification email')}
          </button>

          <div className="flex items-center justify-between mt-6 text-[13px]" style={{ fontFamily: UI }}>
            <p style={{ color: 'var(--ink-muted, #737373)' }}>
              Wrong email?{' '}
              <button onClick={handleSignOut} className="font-medium" style={{ color: 'var(--lava, #E85D00)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} data-testid="verify-signout-btn">
                Sign out
              </button>
            </p>
            <a href="mailto:support@biqc.ai" style={{ color: 'var(--ink-muted, #737373)', textDecoration: 'none' }}>
              Need help?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailSent;
