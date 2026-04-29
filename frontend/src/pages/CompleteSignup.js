import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

import { supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { getApiBaseUrl } from '../config/urls';
import { fontFamily } from '../design-system/tokens';
import BiqcLogoCard from '../components/BiqcLogoCard';
import PlanPicker, { PLAN_OPTIONS } from '../components/PlanPicker';
import StripeCardField from '../components/StripeCardField';
import { hasStripeKey } from '../lib/stripeJs';
import useForceLightTheme from '../hooks/useForceLightTheme';

const DISPLAY = 'var(--font-marketing-display, "Geist", sans-serif)';
const UI      = 'var(--font-marketing-ui, "Geist", sans-serif)';
const MONO    = 'var(--font-mono, ' + fontFamily.mono + ')';

/**
 * /complete-signup — card-capture gate for OAuth-originated users.
 *
 * Path here is: user signed up via "Continue with Google/Microsoft" on
 * /register-supabase or /login-supabase → AuthCallbackSupabase fetched
 * their subscription state and redirected here because it wasn't yet
 * active/trialing. We pick up the already-signed-in session and run the
 * same Stripe trial flow as RegisterSupabase (steps 2–4), skipping the
 * Supabase signup step (already done) and the E1 verification email
 * (OAuth provider already verified the inbox).
 *
 * On success → /advisor. On failure → persistent red banner + retry,
 * same UX shape as RegisterSupabase.
 *
 * Shipped 2026-04-20 closing the OAuth-bypass hole that let Microsoft
 * sign-ups reach /advisor without card on file.
 */
const CompleteSignup = () => {
  useForceLightTheme();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [loadingSession, setLoadingSession] = useState(true);

  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [cardReady, setCardReady] = useState(false);
  const [cardError, setCardError] = useState('');
  const [trialFailureMessage, setTrialFailureMessage] = useState('');
  const [trialStep, setTrialStep] = useState('idle'); // idle | intent | confirm | subscribe | done
  const [loading, setLoading] = useState(false);
  const cardRef = useRef(null);
  const stripeConfigured = hasStripeKey();

  // ── Pull the OAuth-signed-in user from the Supabase session ──
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session?.access_token) {
          // No session → send them back to sign in
          navigate('/login-supabase', { replace: true });
          return;
        }
        setSession(data.session);
        const u = data.session.user;
        setUserEmail(u?.email || '');
        setUserName(u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || '');
      } catch (_e) {
        navigate('/login-supabase', { replace: true });
      } finally {
        setLoadingSession(false);
      }
    })();
  }, [navigate]);

  const selectedPlanDetails = useMemo(
    () => PLAN_OPTIONS.find(p => p.id === selectedPlan) || PLAN_OPTIONS[0],
    [selectedPlan]
  );

  const trialSummary = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const endStr = end.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    // PlanPicker's PLAN_OPTIONS use `.price` ("$69") + `.period` ("AUD/mo").
    // Prefix with "A" so the microcopy reads "A$69" instead of a bare "$69"
    // that could be mistaken for USD. Fall back to the currently-selected
    // plan's own fields, never to a hardcoded price (Andreas 2026-04-20
    // bug: microcopy was showing A$199 regardless of selection).
    const rawPrice = selectedPlanDetails?.price || '$69';
    const price = rawPrice.startsWith('A') ? rawPrice : `A${rawPrice}`;
    const period = selectedPlanDetails?.period || 'AUD/mo';
    return {
      endStr,
      planName: selectedPlanDetails?.name || 'Growth',
      price,
      period,
    };
  }, [selectedPlanDetails]);

  const reportSignupError = (step, message, rawStripeError = null, extra = {}) => {
    try {
      const se = rawStripeError || {};
      const payload = {
        step,
        message: String(message || '').slice(0, 500),
        email: userEmail || null,
        plan: selectedPlan || null,
        stripe_error_code: se.code || null,
        stripe_decline_code: se.decline_code || null,
        stripe_error_type: se.type || null,
        stripe_error_param: se.param || null,
        raw: rawStripeError ? {
          type: se.type, code: se.code, decline_code: se.decline_code,
          param: se.param, message: se.message,
        } : null,
        ...extra,
      };
      console.error('[complete-signup-error]', step, payload);
      apiClient.post('/diagnostics/signup-error', payload).catch(() => {});
    } catch (_e) {}
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!session) return;
    if (loading || trialStep !== 'idle') return;
    setTrialFailureMessage('');
    setCardError('');
    setLoading(true);

    try {
      // ── Step 2: signup-create-setup-intent (backend creates Stripe Customer + SI) ──
      setTrialStep('intent');
      let customer_id, client_secret;
      try {
        const res = await apiClient.post('/stripe/signup-create-setup-intent', { plan: selectedPlan });
        customer_id = res.data?.customer_id;
        client_secret = res.data?.client_secret;
      } catch (err) {
        const detail = err?.response?.data?.detail || '';
        if (err?.response?.status === 409) {
          toast.success('Your subscription is already active. Taking you in.');
          navigate('/advisor');
          return;
        }
        reportSignupError('setup_intent', detail || err?.message || 'signup-create-setup-intent failed',
          null, { http_status: err?.response?.status, path: 'complete-signup' });
        toast.error(detail || 'Could not start your trial setup. Please try again.');
        setTrialFailureMessage(`Couldn't prepare Stripe setup: ${detail || err?.message || 'unknown error'}. Click Start trial again.`);
        setTrialStep('idle');
        return;
      }
      if (!customer_id || !client_secret) {
        reportSignupError('setup_intent', 'missing customer_id or client_secret', null, { customer_id, has_client_secret: !!client_secret, path: 'complete-signup' });
        toast.error('Trial setup returned an incomplete response. Please try again.');
        setTrialFailureMessage('Stripe setup returned an incomplete response. Please try again.');
        setTrialStep('idle');
        return;
      }

      // ── Step 3: Elements confirms the card ──
      setTrialStep('confirm');
      if (!cardRef.current) {
        reportSignupError('card_confirm', 'card form not ready', null, { path: 'complete-signup' });
        toast.error('Card form not ready yet — wait a moment and retry.');
        setTrialFailureMessage('The card form is still loading — wait a couple of seconds and try again.');
        setTrialStep('idle');
        return;
      }

      // 2026-04-20 Andreas P0: stripe.confirmSetup was hanging indefinitely
      // on live cards (across TWO different cards, no bank SMS/push ever
      // received — so the request never even reached the user's bank).
      // Wrap the confirm in a 45s timeout so a hung promise can't trap the
      // user forever. On timeout we abort, log, and let them retry with a
      // different card or method.
      const CONFIRM_TIMEOUT_MS = 45000;
      let timedOut = false;
      // Pass the signed-in user's email + name so Stripe has them for
      // billing_details (we hid those fields from the Element UI to
      // suppress Link, which means Stripe requires them in confirmParams).
      const confirmPromise = cardRef.current.confirmWith(client_secret, {
        email: userEmail || undefined,
        name: userName || undefined,
      });
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          timedOut = true;
          resolve({ error: 'Card confirmation timed out after 45 seconds.', rawError: { type: 'client_timeout', duration_ms: CONFIRM_TIMEOUT_MS } });
        }, CONFIRM_TIMEOUT_MS);
      });
      const confirm = await Promise.race([confirmPromise, timeoutPromise]);
      if (confirm.error) {
        reportSignupError('card_confirm', confirm.error, confirm.rawError,
          { customer_id, path: 'complete-signup', timed_out: timedOut });
        toast.error(confirm.error);
        setCardError(confirm.error);
        const hint = timedOut
          ? 'No response from Stripe in 45 seconds. This usually means the card was silently rejected or blocked. Try a different card, or use Apple Pay / Google Pay if shown.'
          : 'Double-check the card details below and click Start trial again.';
        setTrialFailureMessage(`Card couldn't be confirmed: ${confirm.error} ${hint}`);
        setTrialStep('idle');
        return;
      }
      const payment_method_id = confirm.paymentMethodId;

      // ── Step 4: Server creates trialing subscription ──
      setTrialStep('subscribe');
      try {
        await apiClient.post('/stripe/confirm-trial-signup', {
          customer_id,
          payment_method_id,
          plan: selectedPlan,
        });
      } catch (err) {
        const detail = err?.response?.data?.detail || '';
        reportSignupError('confirm_trial', detail || err?.message || 'confirm-trial-signup failed', null, {
          http_status: err?.response?.status,
          customer_id,
          payment_method_id,
          path: 'complete-signup',
        });
        toast.error(detail || 'Could not finalize your subscription.');
        setTrialFailureMessage(detail
          ? `Subscription creation failed: ${detail}. Your card is on file. Click Start trial again, or contact support@biqc.ai.`
          : 'Subscription creation failed. Your card is on file — click Start trial again, or contact support@biqc.ai.');
        setTrialStep('idle');
        return;
      }

      // Success → the backend already updated users.subscription_status to
      // 'trialing' and sent E2 (welcome) if appropriate. Send them to the
      // onboarding-decision page so they pick their path (connect inbox /
      // calibrate / guided session) before they land in the platform; without
      // this, fresh users skip onboarding entirely and hit empty dashboards +
      // /onboarding-decision bounces on every Intelligence page.
      setTrialStep('done');
      setTrialFailureMessage('');
      toast.success(`Trial started. Free until ${trialSummary.endStr}.`);
      navigate('/onboarding-decision');
    } finally {
      setLoading(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
        <BiqcLogoCard size="md" to={null} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
      <nav className="px-6 sm:px-10 py-6">
        <BiqcLogoCard size="sm" to="/" />
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-[540px]">
          <span className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.08em]"
            style={{ background: 'rgba(232,93,0,0.12)', color: '#E85D00', border: '1px solid rgba(232,93,0,0.08)', fontFamily: MONO }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#E85D00', boxShadow: '0 0 8px #E85D00' }} />
            14 days of Growth
          </span>
          <h1 className="mb-2" style={{ fontFamily: DISPLAY, color: '#0A0A0A', fontSize: '42px', letterSpacing: '-0.035em', lineHeight: 1.05, fontWeight: 600 }}>
            One last step, <em style={{ fontStyle: 'italic', color: '#E85D00' }}>{userName.split(' ')[0] || 'there'}</em>.
          </h1>
          <p className="text-base mb-6" style={{ fontFamily: UI, color: '#525252' }}>
            Your account <strong style={{ color: '#0A0A0A' }}>{userEmail}</strong> is signed in. Add a card to start your 14-day free trial — cancel any time in the first 14 days for <strong style={{ color: '#0A0A0A' }}>$0</strong>.
          </p>

          <form onSubmit={handleSubmit} data-testid="complete-signup-form" style={{
            background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)',
            border: '1px solid rgba(10,10,10,0.06)',
            borderRadius: 20,
            padding: 28,
            boxShadow: '0 14px 40px rgba(10,10,10,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}>
            <div style={{ marginBottom: 18 }}>
              <PlanPicker value={selectedPlan} onChange={setSelectedPlan} disabled={loading || trialStep !== 'idle'} />
            </div>

            <div style={{ marginBottom: 14, textAlign: 'center' }}>
              <p style={{ fontFamily: UI, color: '#525252', fontSize: 13.5, marginBottom: 6 }}>
                Still unsure?
              </p>
              <button
                type="button"
                onClick={() => navigate('/speak-with-local-specialist')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#E85D00',
                  fontFamily: UI,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
                data-testid="complete-signup-book-demo"
              >
                Speak with a Local Specialist
              </button>
            </div>

            {stripeConfigured ? (
              <StripeCardField
                ref={cardRef}
                onReady={() => setCardReady(true)}
                onError={(msg) => setCardError(msg)}
                disabled={loading || trialStep !== 'idle'}
              />
            ) : (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)', fontSize: 12.5, color: '#EF4444', fontFamily: MONO }}>
                Stripe publishable key missing. Ask support to restore REACT_APP_STRIPE_PUBLISHABLE_KEY.
              </div>
            )}

            <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(10,10,10,0.03)', border: '1px solid rgba(10,10,10,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Lock size={14} strokeWidth={2} style={{ color: '#525252', marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 12.5, color: '#525252', lineHeight: 1.5, fontFamily: UI }}>
                  <strong style={{ color: '#0A0A0A', fontWeight: 600 }}>Free until {trialSummary.endStr}.</strong>{' '}
                  Then {trialSummary.price} {trialSummary.period} for {trialSummary.planName}. Your card goes straight to Stripe — BIQc never sees the number.
                </div>
              </div>
            </div>

            {trialFailureMessage && (
              <div style={{
                marginTop: 16, padding: '14px 16px', borderRadius: 12,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.24)',
                color: '#B91C1C', fontFamily: UI, fontSize: 13.5, lineHeight: 1.5,
              }} data-testid="complete-trial-failure-banner" role="alert">
                <strong style={{ display: 'block', marginBottom: 4 }}>Trial couldn't start</strong>
                <span style={{ color: '#525252' }}>{trialFailureMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!stripeConfigured || loading || !cardReady}
              className="w-full flex items-center justify-center gap-2 mt-5 text-[15px] font-medium transition-all disabled:opacity-50"
              style={{
                background: '#0A0A0A', color: '#FFFFFF', height: 48, fontFamily: UI,
                boxShadow: '0 4px 12px rgba(10,10,10,0.12)', border: '1px solid #0A0A0A',
                borderRadius: '999px', cursor: 'pointer', padding: '16px', letterSpacing: '-0.005em',
              }}
              data-testid="complete-signup-submit">
              {trialStep === 'intent'    ? 'Preparing Stripe...' :
               trialStep === 'confirm'   ? 'Confirming with your bank — up to 30s...' :
               trialStep === 'subscribe' ? 'Starting trial...' :
               trialStep === 'done'      ? 'Done — taking you in...' :
               <>Start 14-day free trial <span className="ml-1">→</span></>}
            </button>
            {trialStep === 'confirm' && (
              <p className="text-xs mt-3 text-center" style={{ fontFamily: MONO, color: '#737373' }}>
                Your bank may send an SMS or push-notification to approve this card. Complete it, then hold on — don't refresh.
              </p>
            )}
          </form>

          <p className="text-[13px] mt-6 text-center" style={{ fontFamily: UI, color: '#737373' }}>
            Want to use a different account?{' '}
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/login-supabase', { replace: true }); }}
              style={{ color: '#E85D00', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
              data-testid="complete-signup-signout">
              Sign out
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompleteSignup;
