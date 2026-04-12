import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { Input } from '../components/ui/input';
import RecaptchaGate from '../components/RecaptchaGate';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const DISPLAY = fontFamily.display;

const LoginSupabase = () => {
  const navigate = useNavigate();
  const { signIn, signInWithOAuth, hasSupabaseConfig, authState } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [captchaStatusReason, setCaptchaStatusReason] = useState('');
  const [fallbackChallenge, setFallbackChallenge] = useState(null);
  const [fallbackAnswer, setFallbackAnswer] = useState('');
  const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';
  const recaptchaAction = 'login';
  const recaptchaDisabled = String(process.env.REACT_APP_RECAPTCHA_DISABLED || '').toLowerCase() === 'true';
  const recaptchaEnabled = Boolean(recaptchaSiteKey) && !recaptchaDisabled;
  const recaptchaStrict = String(process.env.REACT_APP_RECAPTCHA_STRICT || '').toLowerCase() === 'true';
  const recaptchaOperational = recaptchaEnabled && !captchaUnavailable;
  const fallbackRequired = (recaptchaEnabled && captchaUnavailable && !recaptchaStrict) || (!recaptchaEnabled && failedAttempts >= 3);

  const buildFallbackChallenge = () => {
    const left = Math.floor(Math.random() * 8) + 2;
    const right = Math.floor(Math.random() * 8) + 2;
    return { prompt: `${left} + ${right}`, result: left + right };
  };

  useEffect(() => {
    if (!lockoutUntil) return undefined;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining <= 0) {
        setLockoutUntil(0);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset_auth') !== '1') return;

    const resetLocalAuth = async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}

      try {
        localStorage.removeItem('biqc-auth');
        Object.keys(localStorage)
          .filter((key) => key.startsWith('sb-'))
          .forEach((key) => localStorage.removeItem(key));

        Object.keys(sessionStorage)
          .filter((key) => key.startsWith('biqc_auth_bootstrap_'))
          .forEach((key) => sessionStorage.removeItem(key));
      } catch {}

      params.delete('reset_auth');
      const query = params.toString();
      window.history.replaceState({}, '', `/login-supabase${query ? `?${query}` : ''}`);
    };

    resetLocalAuth();
  }, []);

  useEffect(() => {
    if (fallbackRequired && !fallbackChallenge) {
      setFallbackChallenge(buildFallbackChallenge());
      return;
    }
    if (!fallbackRequired && !recaptchaEnabled && failedAttempts < 3) {
      setFallbackChallenge(null);
      setFallbackAnswer('');
    }
  }, [failedAttempts, fallbackChallenge, fallbackRequired, recaptchaEnabled]);

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
    setLoginError('');
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setLoginError(`Too many failed attempts. Please wait ${Math.max(1, cooldownSeconds)} seconds and try again.`);
      return;
    }
    if (!formData.email || !formData.password) {
      setLoginError('Please enter both email and password');
      return;
    }
    if (recaptchaStrict && recaptchaEnabled && captchaUnavailable) {
      setLoginError('Captcha service is unavailable. Please try again in a moment.');
      return;
    }
    if (fallbackRequired) {
      if (!fallbackChallenge) {
        setFallbackChallenge(buildFallbackChallenge());
        setLoginError('Please complete the verification challenge.');
        return;
      }
      if (Number(fallbackAnswer) !== Number(fallbackChallenge.result)) {
        setLoginError('Verification answer is incorrect. Please try again.');
        setFallbackChallenge(buildFallbackChallenge());
        setFallbackAnswer('');
        return;
      }
    }
    setLoading(true);
    try {
      if (recaptchaOperational) {
        if (!captchaToken) {
          if (recaptchaStrict) {
            setLoginError('Please complete the captcha verification.');
            return;
          }
          setCaptchaUnavailable(true);
          setCaptchaStatusReason('token_missing');
          if (!fallbackChallenge) setFallbackChallenge(buildFallbackChallenge());
          setLoginError('Captcha token unavailable. Solve the verification challenge and try again.');
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
            setLoginError('Captcha verification failed. Please refresh and try again.');
            return;
          }
          setCaptchaUnavailable(true);
          setCaptchaToken('');
          if (!fallbackChallenge) setFallbackChallenge(buildFallbackChallenge());
          setLoginError('Captcha verification is unavailable. Solve the verification challenge and try again.');
          return;
        }
      }
      const authResult = await signIn(formData.email, formData.password);
      setFailedAttempts(0);
      setLockoutUntil(0);
      setCooldownSeconds(0);
      setFallbackChallenge(null);
      setFallbackAnswer('');
      toast.success('Welcome back!');
      try { sessionStorage.setItem('biqc_auth_recent_login', String(Date.now())); } catch {}
      navigate(authState === AUTH_STATE.NEEDS_CALIBRATION ? '/calibration' : '/advisor', { replace: true });
    } catch (error) {
      const rawMsg = error.message || '';
      if (rawMsg.includes('Supabase is not configured')) {
        setLoginError('Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to frontend/.env, then restart npm start. See the yellow box above.');
        return;
      }
      const nextFailedAttempts = failedAttempts + 1;
      setFailedAttempts(nextFailedAttempts);
      if (nextFailedAttempts >= 3) {
        const lockoutSeconds = Math.min(30, nextFailedAttempts * 5);
        setLockoutUntil(Date.now() + lockoutSeconds * 1000);
        setCooldownSeconds(lockoutSeconds);
      }
      const msg = rawMsg.toLowerCase();
      if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found') ||
          msg.includes('body stream') || msg.includes('json') || msg.includes('failed to fetch') ||
          msg.includes('unable to') || msg.includes('email') || msg.includes('password')) {
        setLoginError("Invalid email or password. Please check your credentials.");
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setLoginError('Network error. Please check your connection and try again.');
      } else {
        setLoginError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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
      toast.error('Captcha token unavailable. Solve the verification challenge first.');
      return;
    }
    setOauthLoading(true);
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
          toast.error('Captcha verification is unavailable. Solve the verification challenge to continue.');
          return;
        }
      }
      const result = await signInWithOAuth(provider);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      const msg = error?.message || '';
      if (msg.includes('Supabase is not configured')) {
        toast.error('Configure Supabase in frontend/.env first (see yellow box above).');
      } else {
        toast.error(`${providerName} sign-in failed. Please try again.`);
      }
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#080C14' }}>
      {/* Left: Brand Panel — #0A0A0A hardcoded per mockup auth spec */}
      <aside className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden" style={{ background: '#0A0A0A', color: '#FFFFFF', padding: '48px 40px' }}>
        {/* Animated orbs */}
        <div className="absolute -top-[200px] -left-[200px] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #E85D00 0%, transparent 60%)', opacity: 0.3, filter: 'blur(80px)', animation: 'orbDrift 16s ease-in-out infinite' }} />
        <div className="absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #C0C8D4 0%, transparent 60%)', opacity: 0.2, filter: 'blur(60px)', animation: 'orbDrift 20s ease-in-out infinite reverse' }} />
        <style>{`@keyframes orbDrift { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px, 40px) scale(1.18); } }`}</style>

        <Link to="/" className="relative z-10 flex items-center gap-3" style={{ color: '#FFFFFF', textDecoration: 'none' }}>
          <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#E85D00', boxShadow: '0 0 16px #E85D00' }} />
          <span className="text-2xl font-semibold" style={{ fontFamily: DISPLAY }}>BIQc</span>
        </Link>

        <div className="relative z-10 max-w-[480px] mt-12">
          <h2 className="font-medium leading-[1.05] mb-4" style={{ fontFamily: DISPLAY, color: '#FFFFFF', fontSize: 'clamp(2.4rem, 4vw, 3.4rem)', letterSpacing: '-0.02em' }}>
            Welcome back to your <em style={{ fontStyle: 'italic', color: '#E85D00' }}>operator brain</em>.
          </h2>
          <p className="text-base leading-relaxed mb-8" style={{ fontFamily: fontFamily.body, color: 'rgba(255,255,255,0.65)', maxWidth: 420 }}>
            Two clicks away from the only quiet feed that knows what changed in your business while you slept.
          </p>
          <div className="pl-5 rounded-r-xl" style={{ borderLeft: '2px solid #E85D00', padding: '20px 20px 20px 20px', background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-sm leading-relaxed mb-2" style={{ fontFamily: fontFamily.body, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>
              "We replaced four dashboards and a Notion page with BIQc. I now read one feed a day and that is the entire job."
            </p>
            <span className="text-[11px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
              — Eleanor Cho, founder · Olive Lane Studios
            </span>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 flex-wrap">
          {['SOC 2 Type II in progress', 'Sovereign AU data', 'Read-only by default'].map((t, i) => (
            <span key={i} className="text-[11px] uppercase tracking-[0.04em]" style={{ fontFamily: fontFamily.mono, color: 'rgba(255,255,255,0.4)' }}>{t}</span>
          ))}
        </div>
      </aside>

      {/* Right: Login Form */}
      <div className="flex-[1.1] flex flex-col justify-center px-6 sm:px-8 md:px-16 lg:px-20 py-6 sm:py-12" style={{ background: '#080C14' }}>
        <div className="max-w-[460px] w-full mx-auto">
          {/* Mobile-only brand */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#E85D00' }} />
            <span className="text-lg font-semibold text-white" style={{ fontFamily: DISPLAY }}>BIQc</span>
          </div>

          <h1 className="font-semibold mb-2" style={{ fontFamily: DISPLAY, color: '#EDF1F7', fontSize: '48px', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            Sign in to <em style={{ fontStyle: 'italic', color: '#E85D00' }}>BIQc</em>.
          </h1>
          <p className="text-sm mb-7" style={{ fontFamily: fontFamily.body, color: '#708499' }}>
            Use the same Google or Microsoft account that holds your inbox.
          </p>

          {!hasSupabaseConfig && (
            <div
              className="mb-6 rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: '#F59E0B', background: 'rgba(245,158,11,0.12)', color: '#FDE68A', fontFamily: fontFamily.body }}
              data-testid="login-supabase-config-missing"
            >
              <p className="font-semibold text-[#FBBF24] mb-1">Local setup required</p>
              <p className="text-[#FDE68A]/90 leading-relaxed">
                OAuth and email sign-in need your Supabase project. In <code className="text-xs bg-black/30 px-1 rounded">frontend/.env</code> set{' '}
                <code className="text-xs bg-black/30 px-1 rounded">REACT_APP_SUPABASE_URL</code> and{' '}
                <code className="text-xs bg-black/30 px-1 rounded">REACT_APP_SUPABASE_ANON_KEY</code> (Supabase Dashboard → Settings → API). Copy from{' '}
                <code className="text-xs bg-black/30 px-1 rounded">.env.example</code>, then restart <code className="text-xs bg-black/30 px-1 rounded">npm start</code>.
              </p>
            </div>
          )}

          {/* SSO row */}
          <div className="flex flex-col gap-3 mb-6">
            <button type="button" onClick={() => handleOAuthSignIn('google')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ fontFamily: fontFamily.body, color: '#EDF1F7', background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)', padding: '14px 18px', cursor: 'pointer' }}
              data-testid="login-google-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>connecting...</span> : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EF4444" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </>
              )}
            </button>
            <button type="button" onClick={() => handleOAuthSignIn('azure')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ fontFamily: fontFamily.body, color: '#EDF1F7', background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)', padding: '14px 18px', cursor: 'pointer' }}
              data-testid="login-microsoft-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>connecting...</span> : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>
                  Continue with Microsoft
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(140,170,210,0.15)' }} />
            <span className="text-[10px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>or use email</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(140,170,210,0.15)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>Work email</label>
                <Input id="email" type="email" inputMode="email" autoComplete="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@yourbusiness.com.au" required
                  className="h-12 text-sm rounded-xl"
                  style={{ fontFamily: fontFamily.body, background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)', color: '#EDF1F7' }}
                  data-testid="login-email-input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>Password</label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" enterKeyHint="go"
                    value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••••" required
                    className="h-12 pr-12 text-sm rounded-xl"
                    style={{ fontFamily: fontFamily.body, background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)', color: '#EDF1F7' }}
                    data-testid="login-password-input" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#708499' }}
                    data-testid="login-toggle-password">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Link to="/reset-password" className="text-xs self-end transition-colors" style={{ color: '#E85D00', fontFamily: fontFamily.body, textDecoration: 'none' }} data-testid="login-forgot-password">
                  Forgot password →
                </Link>
              </div>
            </div>

            {loginError && (
              <div
                role="alert"
                aria-live="polite"
                data-testid="login-error-message"
                className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm mt-5"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontFamily: fontFamily.body }}
              >
                <span className="text-base leading-none mt-0.5">⚠</span>
                <span>{loginError}</span>
              </div>
            )}

            {recaptchaEnabled && (
              <div className="mt-5">
                <RecaptchaGate
                  onTokenChange={setCaptchaToken}
                  onStatusChange={handleRecaptchaStatus}
                  action={recaptchaAction}
                  testId="login-recaptcha"
                />
              </div>
            )}
            {fallbackRequired && fallbackChallenge && (
              <div className="rounded-xl border px-3 py-3 mt-5" style={{ borderColor: 'rgba(140,170,210,0.15)', background: 'rgba(14,22,40,0.5)' }} data-testid="login-fallback-captcha">
                <p className="text-xs mb-2" style={{ color: '#708499', fontFamily: fontFamily.body }}>
                  Verification required: solve {fallbackChallenge.prompt}
                </p>
                <Input
                  type="number"
                  value={fallbackAnswer}
                  onChange={(e) => setFallbackAnswer(e.target.value)}
                  placeholder="Your answer"
                  className="h-10 text-sm rounded-lg"
                  style={{ fontFamily: fontFamily.body, background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)', color: '#EDF1F7' }}
                  data-testid="login-fallback-captcha-input"
                />
              </div>
            )}

            <button type="submit" disabled={!hasSupabaseConfig || loading || oauthLoading || (lockoutUntil && Date.now() < lockoutUntil)}
              className="w-full flex items-center justify-center gap-2 mt-6 rounded-xl text-[15px] font-semibold transition-all disabled:opacity-50"
              style={{ background: '#E85D00', color: 'white', height: 48, fontFamily: fontFamily.body, boxShadow: '0 4px 16px rgba(232,93,0,0.3)', border: 'none', cursor: 'pointer' }}
              aria-busy={loading}
              data-testid="login-submit-btn">
              {loading ? 'Signing in...' : (lockoutUntil && Date.now() < lockoutUntil ? `Retry in ${Math.max(1, cooldownSeconds)}s` : <>Sign in<span className="ml-1">→</span></>)}
            </button>
          </form>

          <p className="text-sm mt-7 text-center" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
            New to BIQc?{' '}
            <Link to="/register-supabase" className="font-medium" style={{ color: '#E85D00', textDecoration: 'none' }} data-testid="login-signup-link">
              Start your free account →
            </Link>
          </p>
        </div>
      </div>

    </div>
  );
};

export default LoginSupabase;
