import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Eye, EyeOff, Shield, Lock, Activity, Zap } from 'lucide-react';

const AZ = '#007AFF';
const MINT = '#00D995';
const SL = '#1E293B';
const MU = '#64748B';
const HEAD = "'Inter Tight',sans-serif";
const MONO = "'JetBrains Mono',monospace";

const glass = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.35)',
  boxShadow: '0 24px 48px -12px rgba(0,0,0,0.06)',
};

const LoginSupabase = () => {
  const navigate = useNavigate();
  const { signIn, signInWithOAuth } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error('Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      await signIn(formData.email, formData.password);
      toast.success('Welcome back!');
    } catch (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found')) {
        toast.error("Invalid email or password. Don't have an account? Sign up below.");
      } else {
        toast.error(error.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider) => {
    const providerName = provider === 'google' ? 'Google' : 'Microsoft';
    setOauthLoading(true);
    try {
      const result = await signInWithOAuth(provider);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      toast.error(`${providerName} sign-in failed. Please try again.`);
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative" style={{ fontFamily: HEAD }}>
      <style>{`
        @keyframes float-bg{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes shimmer-line{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        .auth-living-bg{background:radial-gradient(ellipse at 20% 0%,rgba(0,122,255,0.06),transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(0,217,149,0.05),transparent 50%),radial-gradient(ellipse at 50% 50%,rgba(0,122,255,0.03),transparent 40%);background-size:400% 400%;animation:float-bg 20s ease infinite}
        .auth-input:focus{border-color:${AZ}!important;box-shadow:0 0 0 3px rgba(0,122,255,0.1)!important}
      `}</style>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 bg-white auth-living-bg">
        <div className="max-w-md w-full mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 mb-10 transition-colors font-medium text-sm"
            style={{ color: MU, fontFamily: HEAD }}
            data-testid="login-back-to-home-link"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="mb-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${AZ}, ${MINT})` }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl" style={{ color: SL, fontFamily: HEAD }}>BIQc</span>
                <span className="text-[10px] -mt-1" style={{ color: MU, fontFamily: MONO }}>powered by The Strategy Squad</span>
              </div>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: SL, fontFamily: HEAD }}>
              Welcome back
            </h1>
            <p style={{ color: MU }} className="text-sm">Sign in to your sovereign intelligence platform</p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuthSignIn('google')}
              disabled={oauthLoading || loading}
              className="w-full h-12 flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-all hover:shadow-md disabled:opacity-50"
              style={{ ...glass, color: SL, fontFamily: HEAD }}
              data-testid="login-google-btn"
            >
              {oauthLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOAuthSignIn('azure')}
              disabled={oauthLoading || loading}
              className="w-full h-12 flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-all hover:shadow-md disabled:opacity-50"
              style={{ ...glass, color: SL, fontFamily: HEAD }}
              data-testid="login-microsoft-btn"
            >
              {oauthLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  Continue with Microsoft
                </>
              )}
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white" style={{ color: MU, fontFamily: HEAD, fontSize: 12 }}>Or continue with email</span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider" style={{ color: MU }}>Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@company.com"
                className="mt-2 h-12 text-sm rounded-xl auth-input"
                style={{ border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)', fontFamily: HEAD }}
                required
                data-testid="login-email-input"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider" style={{ color: MU }}>Password</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                  className="h-12 pr-12 text-sm rounded-xl auth-input"
                  style={{ border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)', fontFamily: HEAD }}
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: MU }}
                  data-testid="login-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="w-full h-12 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${AZ}, #0055CC)`, fontFamily: HEAD, boxShadow: '0 4px 14px rgba(0,122,255,0.25)' }}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: MU }}>
              Don't have an account?{' '}
              <Link to="/register-supabase" className="font-semibold transition-colors" style={{ color: AZ }} data-testid="login-signup-link">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Hidden on mobile */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden" style={{ background: SL }}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 20%, rgba(0,122,255,0.12), transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(0,217,149,0.08), transparent 50%)` }} />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-12">
            <p className="text-[11px] uppercase tracking-[0.3em] font-semibold mb-6" style={{ fontFamily: MONO, color: AZ }}>Sovereign Intelligence</p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight mb-4" style={{ fontFamily: HEAD }}>
              Your business intelligence,<br/>protected by design.
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              100% Australian data sovereignty. Zero-leakage AI. Military-grade encryption.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Shield, label: 'AES-256 Encryption', sub: 'Defence-grade protection', accent: MINT },
              { icon: Activity, label: 'Real-time Signals', sub: 'Business intelligence on autopilot', accent: AZ },
              { icon: Lock, label: 'Zero Leakage', sub: 'Siloed AI instances per client', accent: MINT },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${item.accent}15` }}>
                  <item.icon className="w-4 h-4" style={{ color: item.accent }} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white" style={{ fontFamily: HEAD }}>{item.label}</p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: MONO }}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center gap-3 px-5 py-3 rounded-xl" style={{ background: 'rgba(0,122,255,0.1)', border: '1px solid rgba(0,122,255,0.15)' }}>
            <Lock className="w-4 h-4" style={{ color: AZ }} />
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: MONO }}>
              Data hosted exclusively in Sydney & Melbourne
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginSupabase;
