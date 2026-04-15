import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { Input } from '../components/ui/input';
import RecaptchaGate from '../components/RecaptchaGate';
import { toast } from 'sonner';
import { Eye, EyeOff, Check } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { EVENTS, trackActivationStep, trackEvent } from '../lib/analytics';

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

  const passwordsMatch = formData.password === formData.confirmPassword;
  const isFormValid = formData.email && formData.password && formData.password.length >= 6 && formData.full_name && formData.confirmPassword && passwordsMatch;

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
        }
      );
      trackEvent(EVENTS.ACTIVATION_SIGNUP_COMPLETE, { method: 'email' });
      trackActivationStep('signup_complete', { method: 'email' });
      // Google Ads conversion — new sign-up
      if (window.gtag) {
        window.gtag('event', 'conversion', { send_to: 'AW-18002554945', event_category: 'signup', event_label: 'email_registration' });
        window.gtag('event', 'sign_up', { method: 'email' });
      }
      toast.success('Account created! Please check your email to confirm.');
      navigate('/login-supabase');
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

  const inputStyle = { fontFamily: UI, background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink, #C8D4E4)', caretColor: 'var(--ink-display, #EDF1F7)' };

  return (
    <div className="min-h-screen flex" style={{ background: '#080C14' }}>
      {/* Left: Registration Form */}
      <div className="flex-[1.1] flex flex-col justify-center px-6 sm:px-8 md:px-16 lg:px-20 py-6 sm:py-12 overflow-y-auto" style={{ background: '#080C14' }}>
        <div className="max-w-[460px] w-full mx-auto">
          {/* Mobile-only brand */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: 'var(--lava, #E85D00)' }} />
            <span className="text-lg font-semibold text-white" style={{ fontFamily: DISPLAY }}>BIQc</span>
          </div>

          <span className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.08em]" style={{ background: 'var(--lava-wash, rgba(232,93,0,0.12))', color: 'var(--lava, #E85D00)', border: '1px solid var(--lava-soft, rgba(232,93,0,0.08))', fontFamily: MONO }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--lava, #E85D00)', boxShadow: '0 0 8px var(--lava, #E85D00)' }} />
            14 days of Pro · No card
          </span>

          <h1 className="mb-2" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #EDF1F7)', fontSize: '48px', letterSpacing: 'var(--ls-tight, -0.035em)', lineHeight: 1.05, fontWeight: 'var(--fw-display, 400)' }}>
            Start your <em style={{ fontStyle: 'italic', color: 'var(--lava, #E85D00)' }}>free trial</em>.
          </h1>
          <p className="text-base mb-2" style={{ fontFamily: UI, color: 'var(--ink-secondary, #8FA0B8)' }}>
            Connect Outlook or Gmail and BIQc starts reading the room within 90 seconds.
          </p>

          {!hasSupabaseConfig && (
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: '#F59E0B', background: 'rgba(245,158,11,0.12)', color: '#FDE68A', fontFamily: UI }}
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
              <span className="text-xs" style={{ fontFamily: UI, color: 'var(--ink-secondary, #8FA0B8)' }}>
                After setup you'll connect <span style={{ color: 'var(--lava, #E85D00)' }}>{integrationLabel}</span> to power your AI intelligence.
              </span>
            </div>
          )}

          {/* SSO row */}
          <div className="flex flex-col gap-3 mt-7 mb-6">
            <button type="button" onClick={() => handleOAuthSignIn('google')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 text-sm font-medium transition-all disabled:opacity-50"
              style={{ fontFamily: UI, color: 'var(--ink-display, #EDF1F7)', background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))', borderRadius: 'var(--r-md, 8px)', padding: '14px 18px', cursor: 'pointer' }}
              data-testid="register-google-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: 'var(--lava, #E85D00)', fontFamily: MONO }}>connecting...</span> : (
                <><svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EF4444" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</>
              )}
            </button>
            <button type="button" onClick={() => handleOAuthSignIn('azure')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 text-sm font-medium transition-all disabled:opacity-50"
              style={{ fontFamily: UI, color: 'var(--ink-display, #EDF1F7)', background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))', borderRadius: 'var(--r-md, 8px)', padding: '14px 18px', cursor: 'pointer' }}
              data-testid="register-microsoft-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: 'var(--lava, #E85D00)', fontFamily: MONO }}>connecting...</span> : (
                <><svg className="w-5 h-5 shrink-0" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>Continue with Microsoft</>
              )}
            </button>
          </div>

          <div className="flex items-center gap-4" style={{ margin: '28px 0' }}>
            <div className="flex-1 h-px" style={{ background: 'var(--border, rgba(140,170,210,0.12))' }} />
            <span className="text-[10px] uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #708499)' }}>or use email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border, rgba(140,170,210,0.12))' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="full_name" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #708499)' }}>Full name</label>
                <Input id="full_name" type="text" value={formData.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="John Doe" className="h-12 text-sm" style={inputStyle} required data-testid="register-name-input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #708499)' }}>Work email</label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} placeholder="you@yourbusiness.com.au" className="h-12 text-sm" style={inputStyle} required data-testid="register-email-input" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="company_name" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #708499)' }}>Business name</label>
                  <Input id="company_name" type="text" value={formData.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Your Business Name" className="h-12 text-sm" style={inputStyle} data-testid="register-company-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="industry" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #708499)' }}>Team size</label>
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
                <label htmlFor="password" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #708499)' }}>Password</label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 6 characters" className="h-12 pr-12 text-sm" style={inputStyle} required minLength={6} data-testid="register-password-input" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--ink-muted, #708499)' }} data-testid="register-toggle-password">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #708499)' }}>Confirm password</label>
                <Input id="confirmPassword" type={showPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Re-enter password" className="h-12 text-sm"
                  style={{ ...inputStyle, borderColor: formData.confirmPassword && !passwordsMatch ? 'var(--danger, #EF4444)' : 'var(--border, rgba(140,170,210,0.12))' }}
                  required minLength={6} data-testid="register-confirm-password-input" />
                {formData.confirmPassword && !passwordsMatch && <p className="text-xs mt-1 text-[#EF4444]" data-testid="password-mismatch-error">Passwords do not match</p>}
              </div>
            </div>

            <button type="submit" disabled={!hasSupabaseConfig || loading || oauthLoading || !isFormValid}
              className="w-full flex items-center justify-center gap-2 mt-6 text-[15px] font-semibold transition-all disabled:opacity-50 hover:brightness-110"
              style={{ background: 'var(--lava, #E85D00)', color: 'white', height: 48, fontFamily: UI, boxShadow: '0 4px 16px rgba(232,93,0,0.3)', border: 'none', borderRadius: 'var(--r-md, 8px)', cursor: 'pointer', padding: '16px' }}
              data-testid="register-submit-btn">
              {loading ? 'Creating account...' : <>Create account<span className="ml-1">→</span></>}
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
              <div className="rounded-xl border px-3 py-3 mt-4" style={{ borderColor: 'var(--border, rgba(140,170,210,0.12))', background: 'rgba(14,22,40,0.5)' }} data-testid="register-fallback-captcha">
                <p className="text-xs mb-2" style={{ color: 'var(--ink-muted, #708499)', fontFamily: UI }}>
                  Verification required: solve {fallbackChallenge.prompt}
                </p>
                <Input type="number" value={fallbackAnswer} onChange={(e) => setFallbackAnswer(e.target.value)} placeholder="Your answer" className="h-10 text-sm" style={inputStyle} data-testid="register-fallback-captcha-input" />
              </div>
            )}
          </form>

          <p className="text-xs text-center mt-4 leading-relaxed" style={{ fontFamily: UI, color: 'var(--ink-muted, #708499)' }}>
            By creating an account you agree to our <Link to="/trust#terms" style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }}>terms</Link> and <Link to="/trust#privacy" style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }}>privacy policy</Link>. SOC 2 in progress. Australian-sovereign data.
          </p>

          <p className="text-sm mt-7 text-center" style={{ fontFamily: UI, color: 'var(--ink-secondary, #8FA0B8)' }}>
            Already a customer?{' '}
            <Link to="/login-supabase" className="font-medium" style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }} data-testid="register-login-link">
              Sign in →
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Brand Panel — #0A0A0A hardcoded per mockup auth spec */}
      <aside className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden" style={{ background: '#0A0A0A', color: '#FFFFFF', padding: '48px 40px' }}>
        {/* Animated orbs */}
        <div className="absolute -top-[200px] -left-[200px] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #E85D00 0%, transparent 60%)', opacity: 0.3, filter: 'blur(80px)', animation: 'orbDrift 16s ease-in-out infinite' }} />
        <div className="absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #C0C8D4 0%, transparent 60%)', opacity: 0.2, filter: 'blur(60px)', animation: 'orbDrift 20s ease-in-out infinite reverse' }} />
        <style>{`@keyframes orbDrift { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px, 40px) scale(1.18); } }`}</style>

        <Link to="/" className="relative z-10 flex items-center gap-3" style={{ color: '#FFFFFF', textDecoration: 'none' }}>
          <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: 'var(--lava, #E85D00)', boxShadow: '0 0 16px var(--lava, #E85D00)' }} />
          <span className="text-2xl font-semibold" style={{ fontFamily: DISPLAY }}>BIQc</span>
        </Link>

        <div className="relative z-10 max-w-[480px] mt-12">
          <h2 className="font-medium leading-[1.05] mb-4" style={{ fontFamily: DISPLAY, color: '#FFFFFF', fontSize: 'clamp(2.4rem, 4vw, 3.4rem)', letterSpacing: 'var(--ls-tight, -0.035em)' }}>
            The only feed that <em style={{ fontStyle: 'italic', color: 'var(--lava-warm, #FF7A1A)' }}>knows what changed</em> while you slept.
          </h2>
          <p className="text-base leading-relaxed mb-7" style={{ fontFamily: UI, color: 'rgba(255,255,255,0.65)', maxWidth: 420 }}>
            Two minutes from sign-up to your first quiet brief. No setup calls. No 14-step wizard. Just connect your inbox and watch the room.
          </p>

          <div className="flex flex-col gap-3 mb-8">
            {['14 days of Pro features, no credit card', 'Auto-detects 19 of the 23 most common SMB risks', 'Read-only by default — we never write to your tools', 'Cancel in two clicks. Export your data anytime.'].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
                <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'var(--lava, #E85D00)' }}>
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span style={{ fontFamily: UI }}>{item}</span>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-r-xl" style={{ borderLeft: '2px solid var(--lava, #E85D00)', background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-sm leading-relaxed mb-3" style={{ fontFamily: UI, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>
              "I signed up on a Tuesday. By Wednesday morning BIQc had already flagged a $12k churn risk we'd missed in the inbox. Paid for itself the first week."
            </p>
            <span className="text-[11px] uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--lava-warm, #FF7A1A)' }}>
              — Marcus Tate, founder · Northbridge Logistics
            </span>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 flex-wrap">
          {['SOC 2 in progress', 'Sovereign AU', 'Read-only default'].map((t, i) => (
            <span key={i} className="text-[11px] uppercase tracking-[0.04em]" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.4)' }}>{t}</span>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default RegisterSupabase;
