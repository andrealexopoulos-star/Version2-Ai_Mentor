import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { Input } from '../components/ui/input';
import RecaptchaGate from '../components/RecaptchaGate';
import { toast } from 'sonner';
import { Eye, EyeOff, Check, Lock } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { EVENTS, trackActivationStep, trackEvent } from '../lib/analytics';
import BiqcLogoCard from '../components/BiqcLogoCard';
import PlanPicker, { PLAN_OPTIONS } from '../components/PlanPicker';
import StripeCardField from '../components/StripeCardField';
import { hasStripeKey } from '../lib/stripeJs';
import useForceLightTheme from '../hooks/useForceLightTheme';

/* ── Mockup-aligned CSS-variable font stacks ── */
const DISPLAY = 'var(--font-display, ' + fontFamily.display + ')';
const UI      = 'var(--font-ui, '      + fontFamily.body    + ')';
const MONO    = 'var(--font-mono, '    + fontFamily.mono    + ')';

// Friendly label mapping for integration names
const INTEGRATION_LABELS = {
  gmail: 'Gmail', outlook: 'Microsoft Outlook', hubspot: 'HubSpot',
  salesforce: 'Salesforce', xero: 'Xero', quickbooks: 'QuickBooks',
  bamboohr: 'BambooHR', 'google-drive': 'Google Drive', notion: 'Notion',
  pipedrive: 'Pipedrive', crm: 'your CRM', accounting: 'your accounting system',
  email: 'your email', hris: 'your HR system', ats: 'your ATS',
};

const RegisterSupabase = () => {
  useForceLightTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pendingIntegration = searchParams.get('integration');
  const integrationLabel = pendingIntegration ? (INTEGRATION_LABELS[pendingIntegration] || pendingIntegration) : null;
  const { signUp, signInWithOAuth, hasSupabaseConfig } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [captchaStatusReason, setCaptchaStatusReason] = useState('');
  const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';
  const recaptchaAction = 'register';
  const recaptchaDisabled = String(process.env.REACT_APP_RECAPTCHA_DISABLED || '').toLowerCase() === 'true';
  const recaptchaEnabled = Boolean(recaptchaSiteKey) && !recaptchaDisabled;
  const recaptchaStrict = String(process.env.REACT_APP_RECAPTCHA_STRICT || '').toLowerCase() === 'true';
  const recaptchaOperational = recaptchaEnabled && !captchaUnavailable;
  const [fallbackChallenge, setFallbackChallenge] = useState(null);
  const [fallbackAnswer, setFallbackAnswer] = useState('');
  const fallbackRequired = recaptchaEnabled && captchaUnavailable && !recaptchaStrict;
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '', full_name: '', company_name: '', industry: ''
  });
  // Phase 6.11 — CC-mandatory signup state
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [cardReady, setCardReady] = useState(false);
  const [cardError, setCardError] = useState('');
  const [trialStep, setTrialStep] = useState('idle'); // idle | auth | intent | confirm | subscribe | done
  const cardRef = useRef(null);
  const stripeConfigured = hasStripeKey();

  const passwordsMatch = formData.password === formData.confirmPassword;
  const isFormValid = formData.email && formData.password && formData.password.length >= 6 && formData.full_name && formData.confirmPassword && passwordsMatch && selectedPlan && cardReady;

  // Trial summary: 14 days from now, price from selected plan
  const trialSummary = (() => {
    const end = new Date();
    end.setDate(end.getDate() + 14);
    const endStr = end.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    const plan = PLAN_OPTIONS.find((p) => p.id === selectedPlan) || PLAN_OPTIONS[0];
    return { endStr, price: plan.price, period: plan.period, planName: plan.name };
  })();

  const buildFallbackChallenge = () => {
    const left = Math.floor(Math.random() * 8) + 2;
    const right = Math.floor(Math.random() * 8) + 2;
    return { prompt: `${left} + ${right}`, result: left + right };
  };

  useEffect(() => {
    if (fallbackRequired && !fallbackChallenge) {
      setFallbackChallenge(buildFallbackChallenge());
      return;
    }
    if (!fallbackRequired) {
      setFallbackChallenge(null);
      setFallbackAnswer('');
    }
  }, [fallbackChallenge, fallbackRequired]);

  const handleRecaptchaStatus = ({ status, reason }) => {
    if (status === 'ready') {
      setCaptchaUnavailable(false);
      setCaptchaStatusReason('');
      return;
    }
    if (status === 'error') {
      setCaptchaUnavailable(true);
      setCaptchaStatusReason(reason || 'init_failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.full_name) { toast.error('Please fill in all required fields'); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (recaptchaStrict && recaptchaEnabled && captchaUnavailable) { toast.error('Captcha service is unavailable. Please try again shortly.'); return; }
    if (fallbackRequired) {
      if (!fallbackChallenge || Number(fallbackAnswer) !== Number(fallbackChallenge.result)) {
        toast.error('Please solve the verification challenge first.');
        if (!fallbackChallenge) setFallbackChallenge(buildFallbackChallenge());
        return;
      }
    }
    setLoading(true);
    try {
      if (recaptchaOperational) {
        if (!captchaToken) {
          if (recaptchaStrict) {
            toast.error('Please complete the captcha verification.');
            return;
          }
          setCaptchaUnavailable(true);
          setCaptchaStatusReason('token_missing');
          if (!fallbackChallenge) setFallbackChallenge(buildFallbackChallenge());
          toast.error('Captcha token unavailable. Solve the backup challenge and retry.');
          return;
        }
        try {
          await apiClient.post('/auth/recaptcha/verify', {
            token: captchaToken,
            expectedAction: recaptchaAction,
            siteKey: recaptchaSiteKey,
          });
        } catch {
          if (recaptchaStrict) {
            toast.error('Captcha verification failed. Please refresh and try again.');
            return;
          }
          setCaptchaUnavailable(true);
          setCaptchaToken('');
          if (!fallbackChallenge) setFallbackChallenge(buildFallbackChallenge());
          toast.error('Captcha verification is unavailable. Solve the backup challenge and retry.');
          return;
        }
      }
      // Step 13 / P1-8 — pass the captcha token through so the backend can
      // verify it before creating the Supabase auth user. When a token is
      // provided, signUp routes through /api/auth/supabase/signup; when it
      // isn't (captcha disabled/unavailable in dev), signUp falls back to
      // the direct Supabase client path.
      // ── Step 1: Supabase auth signup (creates user + session) ──
      // If reCAPTCHA is unavailable and the fallback math challenge was
      // shown, pass the prompt + answer to the backend so it can verify
      // there instead of failing closed. This keeps ALL signups on the
      // backend admin.create_user path (no client-direct bypass).
      setTrialStep('auth');
      await signUp(
        formData.email,
        formData.password,
        {
          full_name: formData.full_name,
          company_name: formData.company_name,
          industry: formData.industry,
          role: 'user',
        },
        {
          recaptchaToken: recaptchaOperational ? captchaToken : '',
          recaptchaAction,
          fallbackChallengePrompt: fallbackRequired && fallbackChallenge ? fallbackChallenge.prompt : '',
          fallbackChallengeAnswer: fallbackRequired && fallbackChallenge ? String(fallbackAnswer || '') : '',
        }
      );
      trackEvent(EVENTS.ACTIVATION_SIGNUP_COMPLETE, { method: 'email' });
      trackActivationStep('signup_complete', { method: 'email' });

      // ── Session-presence guard ──
      // With the 2026-04-19 P0 signup fix, the backend uses
      // admin.create_user(email_confirm=True) + signs in the user
      // immediately, so a session should be present here 100% of the time.
      // If it's not, try an explicit signInWithPassword with the creds the
      // user just provided before giving up — the old behaviour of punting
      // to /login-supabase caused trials to never start (Andreas 2026-04-19
      // test incident).
      let sessionData = (await supabase.auth.getSession()).data;
      if (!sessionData?.session?.access_token) {
        try {
          const { data: signinData } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
          if (signinData?.session) {
            sessionData = { session: signinData.session };
          }
        } catch (_) {}
      }
      if (!sessionData?.session?.access_token) {
        toast.error('Account created but we could not sign you in automatically. Please sign in to continue your trial.');
        navigate('/login-supabase');
        return;
      }

      // ── Step 2: Stripe SetupIntent (server creates Customer + SI) ──
      setTrialStep('intent');
      let customer_id, client_secret;
      try {
        const res = await apiClient.post('/stripe/signup-create-setup-intent', { plan: selectedPlan });
        customer_id = res.data?.customer_id;
        client_secret = res.data?.client_secret;
      } catch (err) {
        const detail = err?.response?.data?.detail || '';
        if (err?.response?.status === 409) {
          // User already has subscription — jump straight to app
          toast.success('Your subscription is already active. Taking you in.');
          navigate('/calibration');
          return;
        }
        toast.error(detail || 'Could not start your trial setup. Please try again.');
        setTrialStep('idle');
        return;
      }

      if (!customer_id || !client_secret) {
        toast.error('Trial setup returned an incomplete response. Please try again.');
        setTrialStep('idle');
        return;
      }

      // ── Step 3: Stripe Elements confirms the card against the SI ──
      setTrialStep('confirm');
      if (!cardRef.current) {
        toast.error('Card form not ready yet. Please wait a moment and retry.');
        setTrialStep('idle');
        return;
      }
      const confirm = await cardRef.current.confirmWith(client_secret);
      if (confirm.error) {
        toast.error(confirm.error);
        setCardError(confirm.error);
        setTrialStep('idle');
        return;
      }
      const payment_method_id = confirm.paymentMethodId;

      // ── Step 4: Server creates trialing subscription ──
      setTrialStep('subscribe');
      try {
        // Trial length is server-determined (backend enforces 14-day one-shot
        // per user_id to block post-cancel trial-replay — Codex P1 fix).
        await apiClient.post('/stripe/confirm-trial-signup', {
          customer_id,
          payment_method_id,
          plan: selectedPlan,
        });
      } catch (err) {
        const detail = err?.response?.data?.detail || '';
        toast.error(detail || 'Could not finalize your subscription. Your card is on file — please contact support if this persists.');
        setTrialStep('idle');
        return;
      }

      // Google Ads conversion — new sign-up with trial
      if (window.gtag) {
        window.gtag('event', 'conversion', { send_to: 'AW-18002554945', event_category: 'signup', event_label: 'email_registration_trial' });
        window.gtag('event', 'sign_up', { method: 'email', plan: selectedPlan });
      }

      setTrialStep('done');
      toast.success(`Trial started. Free until ${trialSummary.endStr}.`);
      navigate('/calibration');
    } catch (error) {
      const raw = error.message || '';
      if (raw.includes('Supabase is not configured')) {
        toast.error('Configure Supabase in frontend/.env first (see yellow box above).');
        return;
      }
      const msg = raw.toLowerCase();
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered') || msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('An account with this email already exists. Please sign in instead.');
        setTimeout(() => navigate('/login-supabase'), 2000);
      } else if (msg.includes('weak') || msg.includes('password')) {
        toast.error('Password is too weak. Use at least 6 characters with a mix of letters and numbers.');
      } else if (msg.includes('invalid') && msg.includes('email')) {
        toast.error('Please enter a valid email address.');
      } else if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) {
        toast.error('Too many attempts. Please wait a moment and try again.');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(error.message || 'Registration failed. Please try again.');
      }
    } finally { setLoading(false); }
  };

  const handleOAuthSignIn = async (provider) => {
    const providerName = provider === 'google' ? 'Google' : 'Microsoft';
    if (recaptchaStrict && recaptchaEnabled && captchaUnavailable) {
      toast.error('Captcha service is unavailable. Please try again shortly.');
      return;
    }
    if (fallbackRequired) {
      if (!fallbackChallenge || Number(fallbackAnswer) !== Number(fallbackChallenge.result)) {
        toast.error('Please solve the verification challenge first.');
        if (!fallbackChallenge) setFallbackChallenge(buildFallbackChallenge());
        return;
      }
    } else if (recaptchaOperational && !captchaToken) {
      if (recaptchaStrict) {
        toast.error('Please complete the captcha verification first.');
        return;
      }
      setCaptchaUnavailable(true);
      setCaptchaStatusReason('token_missing');
      if (!fallbackChallenge) setFallbackChallenge(buildFallbackChallenge());
      toast.error('Captcha token unavailable. Solve the backup challenge first.');
      return;
    }
    setOauthLoading(true);
    trackActivationStep('signup_oauth_started', { provider });
    try {
      if (recaptchaOperational) {
        try {
          await apiClient.post('/auth/recaptcha/verify', {
            token: captchaToken,
            expectedAction: recaptchaAction,
            siteKey: recaptchaSiteKey,
          });
        } catch {
          if (recaptchaStrict) {
            toast.error('Captcha verification failed. Please refresh and retry.');
            return;
          }
          setCaptchaUnavailable(true);
          setCaptchaToken('');
          if (!fallbackChallenge) setFallbackChallenge(buildFallbackChallenge());
          toast.error('Captcha verification is unavailable. Solve the backup challenge and retry.');
          return;
        }
      }
      const result = await signInWithOAuth(provider);
      if (result?.url) {
        // Flag for conversion tracking in AuthCallbackSupabase
        try { localStorage.setItem('biqc_pending_signup', provider); } catch {}
        window.location.href = result.url;
      }
    } catch (error) {
      const msg = error?.message || '';
      if (msg.includes('Supabase is not configured')) {
        toast.error('Configure Supabase in frontend/.env first (see yellow box above).');
      } else {
        toast.error(`${providerName} signup failed. Please try again.`);
      }
    } finally {
      setOauthLoading(false);
    }
  };

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const inputStyle = { fontFamily: UI, background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.1)', borderRadius: '8px', color: 'var(--ink-display, #0A0A0A)', caretColor: 'var(--ink-display, #0A0A0A)' };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
      {/* Left: Registration Form */}
      <div className="flex-[1.1] flex flex-col justify-center px-6 sm:px-8 md:px-16 lg:px-20 py-6 sm:py-12 overflow-y-auto" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
        <div className="max-w-[460px] w-full mx-auto">
          {/* Mobile-only brand — hovering logo card */}
          <div className="mb-8 lg:hidden">
            <BiqcLogoCard size="sm" to="/" />
          </div>

          <span className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.08em]" style={{ background: 'var(--lava-wash, rgba(232,93,0,0.12))', color: 'var(--lava, #E85D00)', border: '1px solid var(--lava-soft, rgba(232,93,0,0.08))', fontFamily: MONO }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--lava, #E85D00)', boxShadow: '0 0 8px var(--lava, #E85D00)' }} />
            14 days of Pro · No card
          </span>

          <h1 className="mb-2" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)', fontSize: '48px', letterSpacing: 'var(--ls-tight, -0.035em)', lineHeight: 1.05, fontWeight: 'var(--fw-display, 400)' }}>
            Start your <em style={{ fontStyle: 'italic', color: 'var(--lava, #E85D00)' }}>free trial</em>.
          </h1>
          <p className="text-base mb-2" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
            Connect Outlook or Gmail and BIQc starts reading the room within 90 seconds.
          </p>

          {!hasSupabaseConfig && (
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: '#F59E0B', background: 'rgba(245,158,11,0.12)', color: 'var(--warning, #D97706)', fontFamily: UI }}
              data-testid="register-supabase-config-missing"
            >
              <p className="font-semibold text-[#FBBF24] mb-1">Local setup required</p>
              <p className="text-[#FDE68A]/90 leading-relaxed">
                Set <code className="text-xs bg-black/30 px-1 rounded">REACT_APP_SUPABASE_URL</code> and{' '}
                <code className="text-xs bg-black/30 px-1 rounded">REACT_APP_SUPABASE_ANON_KEY</code> in <code className="text-xs bg-black/30 px-1 rounded">frontend/.env</code> (Supabase → Settings → API), then restart <code className="text-xs bg-black/30 px-1 rounded">npm start</code>.
              </p>
            </div>
          )}

          {/* Contextual integration hint */}
          {integrationLabel && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
              style={{ background: 'var(--lava-wash, rgba(232,93,0,0.07))', border: '1px solid var(--lava-soft, rgba(232,93,0,0.08))' }}>
              <span className="text-xs" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
                After setup you'll connect <span style={{ color: 'var(--lava, #E85D00)' }}>{integrationLabel}</span> to power your AI intelligence.
              </span>
            </div>
          )}

          {/* SSO row */}
          <div className="flex flex-col gap-3 mt-7 mb-6">
            <button type="button" onClick={() => handleOAuthSignIn('google')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 text-sm font-medium transition-all disabled:opacity-50"
              style={{ fontFamily: UI, color: 'var(--ink-display, #0A0A0A)', background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.1)', borderRadius: '8px', padding: '14px 18px', cursor: 'pointer' }}
              data-testid="register-google-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: 'var(--lava, #E85D00)', fontFamily: MONO }}>connecting...</span> : (
                <><svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EF4444" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</>
              )}
            </button>
            <button type="button" onClick={() => handleOAuthSignIn('azure')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 text-sm font-medium transition-all disabled:opacity-50"
              style={{ fontFamily: UI, color: 'var(--ink-display, #0A0A0A)', background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.1)', borderRadius: '8px', padding: '14px 18px', cursor: 'pointer' }}
              data-testid="register-microsoft-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: 'var(--lava, #E85D00)', fontFamily: MONO }}>connecting...</span> : (
                <><svg className="w-5 h-5 shrink-0" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>Continue with Microsoft</>
              )}
            </button>
          </div>

          <div className="flex items-center gap-4" style={{ margin: '28px 0' }}>
            <div className="flex-1 h-px" style={{ background: 'var(--border, rgba(140,170,210,0.12))' }} />
            <span className="text-[10px] uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #737373)' }}>or use email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border, rgba(140,170,210,0.12))' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Phase 6.11 — plan picker + Stripe Elements card capture.
                14-day free trial, auto-charged at T+14. Card goes straight
                to Stripe; BIQc never sees the number. */}
            <PlanPicker value={selectedPlan} onChange={setSelectedPlan} disabled={loading || trialStep !== 'idle'} />

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="full_name" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #737373)' }}>Full name</label>
                <Input id="full_name" type="text" value={formData.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="John Doe" className="h-12 text-sm" style={inputStyle} required data-testid="register-name-input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #737373)' }}>Work email</label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} placeholder="you@yourbusiness.com.au" className="h-12 text-sm" style={inputStyle} required data-testid="register-email-input" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="company_name" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #737373)' }}>Business name</label>
                  <Input id="company_name" type="text" value={formData.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Your Business Name" className="h-12 text-sm" style={inputStyle} data-testid="register-company-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="industry" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #737373)' }}>Team size</label>
                  <select id="industry" value={formData.industry} onChange={(e) => set('industry', e.target.value)} className="h-12 text-sm px-4 appearance-none cursor-pointer" style={inputStyle} data-testid="register-industry-input">
                    <option value="">Just me</option>
                    <option value="2-10">2–10</option>
                    <option value="11-50">11–50</option>
                    <option value="51-200">51–200</option>
                    <option value="200+">200+</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #737373)' }}>Password</label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 6 characters" className="h-12 pr-12 text-sm" style={inputStyle} required minLength={6} data-testid="register-password-input" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--ink-muted, #737373)' }} data-testid="register-toggle-password">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #737373)' }}>Confirm password</label>
                <Input id="confirmPassword" type={showPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Re-enter password" className="h-12 text-sm"
                  style={{ ...inputStyle, borderColor: formData.confirmPassword && !passwordsMatch ? 'var(--danger, #EF4444)' : 'var(--border, rgba(140,170,210,0.12))' }}
                  required minLength={6} data-testid="register-confirm-password-input" />
                {formData.confirmPassword && !passwordsMatch && <p className="text-xs mt-1 text-[#EF4444]" data-testid="password-mismatch-error">Passwords do not match</p>}
              </div>
            </div>

            {/* ── Card capture (Stripe Elements) ── */}
            <div style={{ marginTop: 20 }}>
              {stripeConfigured ? (
                <StripeCardField
                  ref={cardRef}
                  onReady={() => setCardReady(true)}
                  onError={(msg) => setCardError(msg)}
                  disabled={loading || trialStep !== 'idle'}
                />
              ) : (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--danger-wash, rgba(239,68,68,0.08))',
                  border: '1px solid var(--danger-soft, rgba(239,68,68,0.2))',
                  fontSize: 12.5,
                  color: 'var(--danger, #EF4444)',
                  fontFamily: MONO,
                  letterSpacing: '-0.003em',
                }}>
                  Stripe is not configured. Set REACT_APP_STRIPE_PUBLISHABLE_KEY in Azure App Service → biqc-web → Configuration.
                </div>
              )}
            </div>

            {/* ── Trust microcopy (Phase 6.11 spec) ── */}
            <div style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(10,10,10,0.03)',
              border: '1px solid rgba(10,10,10,0.06)',
              fontFamily: UI,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Lock size={14} strokeWidth={2} style={{ color: 'var(--ink-secondary, #525252)', marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 12.5, color: 'var(--ink-secondary, #525252)', lineHeight: 1.5, letterSpacing: '-0.003em' }}>
                  <strong style={{ color: 'var(--ink-display, #0A0A0A)', fontWeight: 600 }}>Free until {trialSummary.endStr}.</strong>{' '}
                  Then {trialSummary.price} {trialSummary.period} for {trialSummary.planName}.{' '}
                  Cancel any time in the first 14 days for <strong style={{ color: 'var(--ink-display, #0A0A0A)', fontWeight: 600 }}>$0</strong>.{' '}
                  Your card goes straight to Stripe — BIQc never sees the number.
                </div>
              </div>
            </div>

            <button type="submit" disabled={!hasSupabaseConfig || !stripeConfigured || loading || oauthLoading || !isFormValid}
              className="w-full flex items-center justify-center gap-2 mt-5 text-[15px] font-medium transition-all disabled:opacity-50"
              style={{ background: '#0A0A0A', color: '#FFFFFF', height: 48, fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)', boxShadow: '0 4px 12px rgba(10,10,10,0.12)', border: '1px solid #0A0A0A', borderRadius: '999px', cursor: 'pointer', padding: '16px', letterSpacing: '-0.005em' }}
              data-testid="register-submit-btn">
              {loading ? (
                trialStep === 'auth' ? 'Creating account...' :
                trialStep === 'intent' ? 'Preparing trial setup...' :
                trialStep === 'confirm' ? 'Securing your card...' :
                trialStep === 'subscribe' ? 'Starting your trial...' :
                'Working...'
              ) : <>Start 14-day free trial<span className="ml-1">→</span></>}
            </button>

            {recaptchaEnabled && (
              <div className="mt-4">
                <RecaptchaGate
                  onTokenChange={setCaptchaToken}
                  onStatusChange={handleRecaptchaStatus}
                  action={recaptchaAction}
                  testId="register-recaptcha"
                />
              </div>
            )}
            {fallbackRequired && fallbackChallenge && (
              <div className="rounded-xl border px-3 py-3 mt-4" style={{ borderColor: 'rgba(10,10,10,0.1)', background: '#FFFFFF' }} data-testid="register-fallback-captcha">
                <p className="text-xs mb-2" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: UI }}>
                  Verification required: solve {fallbackChallenge.prompt}
                </p>
                <Input type="number" value={fallbackAnswer} onChange={(e) => setFallbackAnswer(e.target.value)} placeholder="Your answer" className="h-10 text-sm" style={inputStyle} data-testid="register-fallback-captcha-input" />
              </div>
            )}
          </form>

          <p className="text-xs text-center mt-4 leading-relaxed" style={{ fontFamily: UI, color: 'var(--ink-muted, #737373)' }}>
            By creating an account you agree to our <Link to="/trust/terms" style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }}>terms</Link> and <Link to="/trust/privacy" style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }}>privacy policy</Link>. SOC 2 in progress. Australian-sovereign data.
          </p>

          <p className="text-sm mt-7 text-center" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
            Already a customer?{' '}
            <Link to="/login-supabase" className="font-medium" style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }} data-testid="register-login-link">
              Sign in →
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Brand Panel — liquid-steel silver gradient with dark text (Merge aesthetic) */}
      <aside className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #F6F7F9 0%, #E4EAF2 50%, #C8D4E4 100%)', color: 'var(--ink-display, #0A0A0A)', padding: '48px 40px' }}>
        {/* Soft orange bloom — subtle identity */}
        <div className="absolute -top-[160px] -right-[160px] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(232,93,0,0.18) 0%, transparent 65%)', opacity: 0.6, filter: 'blur(70px)', animation: 'orbDrift 18s ease-in-out infinite' }} />
        {/* Silver counter-orb for depth */}
        <div className="absolute -bottom-[220px] -left-[220px] w-[520px] h-[520px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,177,189,0.35) 0%, transparent 60%)', opacity: 0.5, filter: 'blur(80px)', animation: 'orbDrift 22s ease-in-out infinite reverse' }} />
        <style>{`@keyframes orbDrift { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-24px, 32px) scale(1.12); } }`}</style>

        {/* Hovering BIQc.ai logo card — centered */}
        <div className="relative z-10 flex justify-center">
          <BiqcLogoCard size="md" to="/" />
        </div>

        <div className="relative z-10 max-w-[520px] mt-12 mx-auto text-center">
          <h2 className="font-semibold leading-[1.05] mb-4" style={{ fontFamily: 'var(--font-marketing-display, "Geist", sans-serif)', color: 'var(--ink-display, #0A0A0A)', fontSize: 'clamp(2.4rem, 4vw, 3.4rem)', letterSpacing: '-0.035em' }}>
            The only feed that <em style={{ fontStyle: 'italic', color: 'var(--lava, #E85D00)' }}>knows what changed</em> while you slept.
          </h2>
          <p className="text-base leading-relaxed mb-7 mx-auto" style={{ fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)', color: 'var(--ink-secondary, #525252)', maxWidth: 440 }}>
            Two minutes from sign-up to your first quiet brief. No setup calls. No 14-step wizard. Just connect your inbox and watch the room.
          </p>

          <div className="flex flex-col gap-3 mb-8 max-w-[440px] mx-auto text-left">
            {['14 days of full Growth features — cancel anytime before day 14 for $0', 'Auto-detects 19 of the 23 most common SMB risks', 'Read-only by default — we never write to your tools', 'Cancel in two clicks. Export your data anytime.'].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
                <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'var(--lava, #E85D00)' }}>
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span style={{ fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)' }}>{item}</span>
              </div>
            ))}
          </div>

          <div className="mx-auto max-w-[440px] relative" style={{ padding: '28px 24px', background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(10,10,10,0.06)', borderRadius: '16px', boxShadow: '0 4px 14px rgba(10,10,10,0.04)' }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'var(--lava, #E85D00)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif', lineHeight: 1, boxShadow: '0 4px 12px rgba(232,93,0,0.3)' }}>“</div>
            <p className="text-sm leading-relaxed mb-3" style={{ fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)', color: 'var(--ink, #171717)', fontStyle: 'italic' }}>
              I signed up on a Tuesday. By Wednesday morning BIQc had already flagged a $12k churn risk we'd missed in the inbox. Paid for itself the first week.
            </p>
            <span className="block text-[11px] uppercase tracking-[0.08em]" style={{ fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)', color: 'var(--ink-secondary, #525252)', fontWeight: 600 }}>
              — Marcus Tate, founder · Northbridge Logistics
            </span>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 flex-wrap justify-center">
          {['SOC 2 in progress', 'Sovereign AU', 'Read-only default'].map((t, i) => (
            <span key={i} className="text-[11px] uppercase tracking-[0.04em]" style={{ fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)', color: 'var(--ink-muted, #737373)', fontWeight: 500 }}>{t}</span>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default RegisterSupabase;
