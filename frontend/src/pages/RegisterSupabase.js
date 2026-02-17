import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Eye, EyeOff, Shield, Lock, Zap, Activity } from 'lucide-react';

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

const RegisterSupabase = () => {
  const navigate = useNavigate();
  const { signUp, signInWithOAuth } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '', full_name: '', company_name: '', industry: ''
  });

  const passwordsMatch = formData.password === formData.confirmPassword;
  const isFormValid = formData.email && formData.password && formData.password.length >= 6 && formData.full_name && formData.confirmPassword && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.full_name) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await signUp(formData.email, formData.password, {
        full_name: formData.full_name,
        company_name: formData.company_name,
        industry: formData.industry,
        role: 'user'
      });
      toast.success('Account created! Please check your email to confirm.');
      navigate('/login-supabase');
    } catch (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered') || msg.includes('duplicate')) {
        toast.error('An account with this email already exists. Please sign in instead.');
        setTimeout(() => navigate('/login-supabase'), 2000);
      } else {
        toast.error(error.message || 'Registration failed. Please try again.');
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
      if (result?.url) { window.location.href = result.url; }
    } catch (error) {
      toast.error(`${providerName} signup failed. Please try again.`);
      setOauthLoading(false);
    }
  };

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  return (
    <div className="min-h-screen flex relative" style={{ fontFamily: HEAD }}>
      <style>{`
        @keyframes float-bg{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .auth-living-bg{background:radial-gradient(ellipse at 20% 0%,rgba(0,122,255,0.06),transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(0,217,149,0.05),transparent 50%),radial-gradient(ellipse at 50% 50%,rgba(0,122,255,0.03),transparent 40%);background-size:400% 400%;animation:float-bg 20s ease infinite}
        .auth-input:focus{border-color:${AZ}!important;box-shadow:0 0 0 3px rgba(0,122,255,0.1)!important}
      `}</style>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 bg-white auth-living-bg">
        <div className="max-w-md w-full mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 mb-8 transition-colors font-medium text-sm"
            style={{ color: MU, fontFamily: HEAD }}
            data-testid="register-back-to-home-link"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${AZ}, ${MINT})` }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl" style={{ color: SL, fontFamily: HEAD }}>BIQc</span>
                <span className="text-[10px] -mt-1" style={{ color: MU, fontFamily: MONO }}>powered by The Strategy Squad</span>
              </div>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: SL, fontFamily: HEAD }}>
              Get started
            </h1>
            <p style={{ color: MU }} className="text-sm">Create your account to access sovereign intelligence</p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-5">
            <button
              type="button"
              onClick={() => handleOAuthSignIn('google')}
              disabled={oauthLoading || loading}
              className="w-full h-11 flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-all hover:shadow-md disabled:opacity-50"
              style={{ ...glass, color: SL, fontFamily: HEAD }}
              data-testid="register-google-btn"
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
              className="w-full h-11 flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-all hover:shadow-md disabled:opacity-50"
              style={{ ...glass, color: SL, fontFamily: HEAD }}
              data-testid="register-microsoft-btn"
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

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white" style={{ color: MU, fontFamily: HEAD, fontSize: 12 }}>Or register with email</span>
            </div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name" className="text-xs font-semibold uppercase tracking-wider" style={{ color: MU }}>
                Full Name <span style={{ color: '#EF4444' }}>*</span>
              </Label>
              <Input id="full_name" type="text" value={formData.full_name} onChange={(e) => set('full_name', e.target.value)}
                placeholder="John Doe" className="mt-1.5 h-11 text-sm rounded-xl auth-input"
                style={{ border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)', fontFamily: HEAD }}
                required data-testid="register-name-input" />
            </div>

            <div>
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider" style={{ color: MU }}>
                Email <span style={{ color: '#EF4444' }}>*</span>
              </Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => set('email', e.target.value)}
                placeholder="you@company.com" className="mt-1.5 h-11 text-sm rounded-xl auth-input"
                style={{ border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)', fontFamily: HEAD }}
                required data-testid="register-email-input" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="company_name" className="text-xs font-semibold uppercase tracking-wider" style={{ color: MU }}>Company</Label>
                <Input id="company_name" type="text" value={formData.company_name} onChange={(e) => set('company_name', e.target.value)}
                  placeholder="Your Company" className="mt-1.5 h-11 text-sm rounded-xl auth-input"
                  style={{ border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)', fontFamily: HEAD }}
                  data-testid="register-company-input" />
              </div>
              <div>
                <Label htmlFor="industry" className="text-xs font-semibold uppercase tracking-wider" style={{ color: MU }}>Industry</Label>
                <Input id="industry" type="text" value={formData.industry} onChange={(e) => set('industry', e.target.value)}
                  placeholder="Technology" className="mt-1.5 h-11 text-sm rounded-xl auth-input"
                  style={{ border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)', fontFamily: HEAD }}
                  data-testid="register-industry-input" />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider" style={{ color: MU }}>
                Password <span style={{ color: '#EF4444' }}>*</span>
              </Label>
              <div className="relative mt-1.5">
                <Input id="password" type={showPassword ? 'text' : 'password'} value={formData.password}
                  onChange={(e) => set('password', e.target.value)} placeholder="Min 6 characters"
                  className="h-11 pr-12 text-sm rounded-xl auth-input"
                  style={{ border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)', fontFamily: HEAD }}
                  required minLength={6} data-testid="register-password-input" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: MU }}
                  data-testid="register-toggle-password">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider" style={{ color: MU }}>
                Confirm Password <span style={{ color: '#EF4444' }}>*</span>
              </Label>
              <div className="relative mt-1.5">
                <Input id="confirmPassword" type={showPassword ? 'text' : 'password'} value={formData.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Re-enter password"
                  className="h-11 text-sm rounded-xl auth-input"
                  style={{
                    border: `1px solid ${formData.confirmPassword && !passwordsMatch ? '#EF4444' : 'rgba(0,0,0,0.08)'}`,
                    background: 'rgba(255,255,255,0.7)', fontFamily: HEAD
                  }}
                  required minLength={6} data-testid="register-confirm-password-input" />
              </div>
              {formData.confirmPassword && !passwordsMatch && (
                <p className="text-xs mt-1" style={{ color: '#EF4444' }} data-testid="password-mismatch-error">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || oauthLoading || !isFormValid}
              className="w-full h-12 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${AZ}, #0055CC)`, fontFamily: HEAD, boxShadow: '0 4px 14px rgba(0,122,255,0.25)' }}
              data-testid="register-submit-btn"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: MU }}>
              Already have an account?{' '}
              <Link to="/login-supabase" className="font-semibold transition-colors" style={{ color: AZ }} data-testid="register-login-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel — Titan Glass */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #1a2744 0%, #243b5c 40%, #1e3350 100%)' }}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 20% 10%, rgba(0,122,255,0.18), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(0,217,149,0.12), transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.06), transparent 60%)` }} />
        <div className="absolute inset-0" style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', background: 'rgba(26,39,68,0.3)' }} />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-12">
            <p className="text-[11px] uppercase tracking-[0.3em] font-semibold mb-6" style={{ fontFamily: MONO, color: MINT }}>Sovereign Intelligence</p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight mb-4" style={{ fontFamily: HEAD }}>
              Transform chaos into<br/>strategic clarity.
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Join forward-thinking leaders leveraging sovereign AI for competitive advantage.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: Zap, label: '15+ hours saved weekly', sub: 'Automated intelligence gathering', accent: AZ },
              { icon: Activity, label: '8-12% cash bleed detected', sub: 'Revenue protection on autopilot', accent: MINT },
              { icon: Shield, label: '97% SOP compliance', sub: 'Operational consistency assured', accent: AZ },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${item.accent}18` }}>
                  <item.icon className="w-4 h-4" style={{ color: item.accent }} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white" style={{ fontFamily: HEAD }}>{item.label}</p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: MONO }}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center gap-3 px-5 py-3 rounded-xl" style={{ background: 'rgba(0,217,149,0.1)', border: '1px solid rgba(0,217,149,0.18)' }}>
            <Lock className="w-4 h-4" style={{ color: MINT }} />
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: MONO }}>
              100% Australian data sovereignty guaranteed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterSupabase;
