import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { Input } from '../components/ui/input';
import RecaptchaGate from '../components/RecaptchaGate';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Eye, EyeOff, Shield, Lock, Activity, Zap } from 'lucide-react';
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
  const recaptchaEnabled = Boolean(process.env.REACT_APP_RECAPTCHA_SITE_KEY);
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
          setLoginError('Please complete the captcha verification.');
          return;
        }
        try {
          await apiClient.post('/auth/recaptcha/verify', { token: captchaToken });
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
      toast.error('Please complete the captcha verification first.');
      return;
    }
    setOauthLoading(true);
    try {
      if (recaptchaOperational) {
        try {
          await apiClient.post('/auth/recaptcha/verify', { token: captchaToken });
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
    <div className="min-h-screen flex" style={{ background: 'var(--biqc-bg)' }}>
      {/* Left: Login Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 md:px-16 lg:px-20 py-6 sm:py-12" style={{ background: 'var(--biqc-bg)' }}>
        <div className="max-w-sm w-full mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 mb-10 text-sm transition-colors hover:text-[#FF6A00]" style={{ color: '#64748B', fontFamily: fontFamily.body }} data-testid="login-back-to-home-link">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FF6A00', width: 40, height: 40, minWidth: 40 }}>
              <span className="text-white font-bold text-sm" style={{ fontFamily: fontFamily.mono }}>B</span>
            </div>
            <div className="min-w-0">
              <span className="text-xl font-semibold text-[#F4F7FA] block" style={{ fontFamily: DISPLAY }}>BIQc</span>
              <span className="text-[10px] text-[#64748B] -mt-0.5 block truncate" style={{ fontFamily: fontFamily.mono }}>powered by The Strategy Squad</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: DISPLAY }}>Welcome back</h1>
          <p className="text-sm text-[#9FB0C3] mb-8" style={{ fontFamily: fontFamily.body }}>Sign in to your sovereign intelligence platform.</p>

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

          {/* OAuth */}
          <div className="space-y-3 mb-6">
            <button type="button" onClick={() => handleOAuthSignIn('google')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full h-12 flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-all hover:bg-white/10 disabled:opacity-50"
              style={{ fontFamily: fontFamily.body, color: 'var(--biqc-text)', background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
              data-testid="login-google-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: "#FF6A00", fontFamily: "\x27JetBrains Mono\x27, monospace" }}>connecting...</span> : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EF4444" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </>
              )}
            </button>
            <button type="button" onClick={() => handleOAuthSignIn('azure')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full h-12 flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-all hover:bg-white/10 disabled:opacity-50"
              style={{ fontFamily: fontFamily.body, color: 'var(--biqc-text)', background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
              data-testid="login-microsoft-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: "#FF6A00", fontFamily: "\x27JetBrains Mono\x27, monospace" }}>connecting...</span> : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>
                  Continue with Microsoft
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: '#243140' }} />
            <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>or continue with email</span>
            <div className="flex-1 h-px" style={{ background: '#243140' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Email</label>
              <Input id="email" type="email" inputMode="email" autoComplete="email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@company.com" required
                className="h-12 text-sm rounded-xl"
                style={{ fontFamily: fontFamily.body, background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                data-testid="login-email-input" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Password</label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" enterKeyHint="go"
                  value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password" required
                  className="h-12 pr-12 text-sm rounded-xl"
                  style={{ fontFamily: fontFamily.body, background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)', WebkitTextSecurity: showPassword ? 'none' : 'disc' }}
                  data-testid="login-password-input" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#9FB0C3] transition-colors"
                  data-testid="login-toggle-password">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right -mt-2">
              <Link to="/reset-password" className="text-xs text-[#64748B] hover:text-[#FF6A00] transition-colors" style={{ fontFamily: fontFamily.body }} data-testid="login-forgot-password">
                Forgot password?
              </Link>
            </div>

            {/* Inline error message — WCAG compliant, persistent */}
            {loginError && (
              <div
                role="alert"
                aria-live="polite"
                data-testid="login-error-message"
                className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontFamily: fontFamily.body }}
              >
                <span className="text-base leading-none mt-0.5">⚠</span>
                <span>{loginError}</span>
              </div>
            )}

            {recaptchaEnabled && (
              <RecaptchaGate
                onTokenChange={setCaptchaToken}
                onStatusChange={handleRecaptchaStatus}
                testId="login-recaptcha"
              />
            )}
            {recaptchaEnabled && captchaUnavailable && (
              <div
                className="rounded-xl border px-3 py-3 text-xs"
                style={{ borderColor: '#334155', background: 'rgba(15,23,42,0.5)', color: '#94A3B8', fontFamily: fontFamily.body }}
                data-testid="login-recaptcha-fallback-note"
              >
                Captcha widget unavailable ({captchaStatusReason || 'init_failed'}). Using backup verification challenge.
              </div>
            )}
            {fallbackRequired && fallbackChallenge && (
              <div className="rounded-xl border px-3 py-3" style={{ borderColor: '#334155', background: 'rgba(15,23,42,0.5)' }} data-testid="login-fallback-captcha">
                <p className="text-xs mb-2" style={{ color: '#94A3B8', fontFamily: fontFamily.body }}>
                  Verification required: solve {fallbackChallenge.prompt}
                </p>
                <Input
                  type="number"
                  value={fallbackAnswer}
                  onChange={(e) => setFallbackAnswer(e.target.value)}
                  placeholder="Your answer"
                  className="h-10 text-sm rounded-lg"
                  style={{ fontFamily: fontFamily.body, background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                  data-testid="login-fallback-captcha-input"
                />
              </div>
            )}

            <div style={{ width: '100%' }}>
                <button type="submit" disabled={!hasSupabaseConfig || loading || oauthLoading || (lockoutUntil && Date.now() < lockoutUntil)}
                style={{ background: '#FF6A00', color: 'white', width: '100%', height: '48px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: fontFamily.body, boxShadow: '0 4px 16px rgba(255,106,0,0.3)', opacity: !hasSupabaseConfig || loading || oauthLoading || (lockoutUntil && Date.now() < lockoutUntil) ? 0.5 : 1, WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
                aria-busy={loading}
                data-testid="login-submit-btn">
                {loading ? "Signing in..." : (lockoutUntil && Date.now() < lockoutUntil ? `Retry in ${Math.max(1, cooldownSeconds)}s` : "Sign in")}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-[#64748B]" style={{ fontFamily: fontFamily.body }}>
              Don't have an account?{' '}
              <Link to="/register-supabase" className="font-semibold text-[#FF6A00] hover:text-[#FF8C33] transition-colors" data-testid="login-signup-link">Sign up</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right: Trust Panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center px-12" style={{ background: 'var(--biqc-bg-input)', borderLeft: '1px solid var(--biqc-border)' }}>
        <div className="max-w-sm">
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#FF6A00] block mb-5" style={{ fontFamily: fontFamily.mono }}>Sovereign Intelligence</span>
          <h2 className="text-3xl font-normal text-[#F4F7FA] mb-3 leading-snug" style={{ fontFamily: DISPLAY }}>
            Your business intelligence, protected by design.
          </h2>
          <p className="text-sm text-[#9FB0C3] mb-8 leading-relaxed" style={{ fontFamily: fontFamily.body }}>100% Australian data sovereignty. Zero leakage. Military-grade encryption.</p>

          <div className="space-y-3">
            {[
              { icon: Lock, label: 'AES-256 Encryption', desc: 'Defence-grade protection at rest & in transit' },
              { icon: Zap, label: 'Real-time Signals', desc: 'Business intelligence on autopilot' },
              { icon: Eye, label: 'Zero Leakage', desc: 'Siloed AI instances per client' },
              { icon: Shield, label: 'Australian Hosted', desc: 'Sydney & Melbourne — zero offshore processing' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                <item.icon className="w-4 h-4 text-[#FF6A00] shrink-0" />
                <div>
                  <span className="text-sm font-medium text-[#F4F7FA] block" style={{ fontFamily: fontFamily.body }}>{item.label}</span>
                  <span className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: '#10B98110', border: '1px solid #10B98120' }}>
            <Shield className="w-4 h-4 text-[#10B981]" />
            <span className="text-xs text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>Data hosted exclusively in Sydney & Melbourne</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginSupabase;
