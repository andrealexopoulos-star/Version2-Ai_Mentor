import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import BiqcLogoCard from '../components/BiqcLogoCard';
import useForceLightTheme from '../hooks/useForceLightTheme';
import { getApiBaseUrl } from '../config/urls';

const DISPLAY = 'var(--font-marketing-display, "Geist", sans-serif)';
const UI      = 'var(--font-marketing-ui, "Geist", sans-serif)';

/**
 * /verify-email — the destination for the link inside the E1 verification
 * email. Reads the `token` query param, POSTs it to the backend, renders
 * one of: loading / success / already_verified / expired / invalid.
 *
 * On success the user is nudged to /login-supabase — the verification
 * flow ends here because the backend's E2 "you're verified" email will
 * arrive a moment later and carry its own sign-in button.
 */
const VerifyEmail = () => {
  useForceLightTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState('loading'); // loading | success | already | expired | invalid | error
  const [error, setError] = useState('');

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const token = qs.get('token');
    if (!token) {
      setState('invalid');
      setError('This link is missing the verification token.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${getApiBaseUrl()}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await resp.json().catch(() => ({}));
        if (cancelled) return;

        if (resp.ok) {
          if (data.status === 'verified') {
            setState('success');
            toast.success('Email verified');
          } else if (data.status === 'already_verified') {
            setState('already');
          } else {
            setState('success');
          }
        } else if (resp.status === 410) {
          setState('expired');
          setError(data.detail || 'This verification link has expired.');
        } else if (resp.status === 404) {
          setState('invalid');
          setError(data.detail || 'This verification link is invalid or has already been used.');
        } else {
          setState('error');
          setError(data.detail || 'Verification failed — please try again.');
        }
      } catch (_err) {
        if (!cancelled) {
          setState('error');
          setError('Network error — please try again.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [location.search]);

  const title = {
    loading: 'Verifying your email…',
    success: "You're verified",
    already: 'Already verified',
    expired: 'This link has expired',
    invalid: 'Invalid verification link',
    error: 'Something went wrong',
  }[state];

  const body = {
    loading: 'Checking your link — this usually takes a second.',
    success: 'Your BIQc account is now active. Sign in to start your first intelligence brief.',
    already: "Your email was already verified. You're good to go — sign in below.",
    expired: error,
    invalid: error,
    error: error,
  }[state];

  const Icon = {
    loading: Loader2,
    success: CheckCircle2,
    already: CheckCircle2,
    expired: XCircle,
    invalid: XCircle,
    error: XCircle,
  }[state];

  const iconColor = (state === 'success' || state === 'already') ? '#16A34A'
                  : state === 'loading' ? 'var(--lava, #E85D00)'
                  : '#B91C1C';

  const primaryAction = (state === 'success' || state === 'already') ? (
    <button
      onClick={() => navigate('/login-supabase')}
      className="w-full h-12 text-sm font-medium transition-all"
      style={{
        background: '#0A0A0A', color: '#FFFFFF', fontFamily: UI,
        border: '1px solid #0A0A0A', borderRadius: '999px', cursor: 'pointer',
        letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.12)',
      }}
      data-testid="verify-go-signin"
    >
      Sign in to BIQc →
    </button>
  ) : (state === 'expired' || state === 'invalid' || state === 'error') ? (
    <Link
      to="/verify-email-sent"
      className="block w-full h-12 text-sm font-medium text-center leading-[3rem] transition-all"
      style={{
        background: '#0A0A0A', color: '#FFFFFF', fontFamily: UI,
        border: '1px solid #0A0A0A', borderRadius: '999px', textDecoration: 'none',
        letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.12)',
      }}
      data-testid="verify-go-resend"
    >
      Request a new link →
    </Link>
  ) : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
      <div className="max-w-sm w-full">
        <div className="mb-8">
          <BiqcLogoCard size="sm" to="/" />
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)',
            border: '1px solid rgba(10,10,10,0.06)', borderRadius: '20px', padding: '32px',
            boxShadow: '0 14px 40px rgba(10,10,10,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
          data-testid={`verify-state-${state}`}
        >
          <div
            className="w-14 h-14 flex items-center justify-center mb-6"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.08)', borderRadius: '12px' }}
          >
            <Icon className={`w-6 h-6 ${state === 'loading' ? 'animate-spin' : ''}`} style={{ color: iconColor }} />
          </div>

          <h1 className="mb-3" style={{
            fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)',
            fontSize: '28px', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15,
          }}>
            {title}
          </h1>
          <p className="text-sm leading-relaxed mb-8" style={{
            fontFamily: UI, color: 'var(--ink-secondary, #525252)',
          }}>
            {body}
          </p>

          {primaryAction}

          {state !== 'loading' && (
            <p className="text-xs mt-6 text-center" style={{ fontFamily: UI, color: 'var(--ink-muted, #737373)' }}>
              Need help? <a href="mailto:support@biqc.ai" style={{ color: 'var(--lava, #E85D00)' }}>support@biqc.ai</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
