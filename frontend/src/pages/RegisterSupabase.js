import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { Input } from '../components/ui/input';
import RecaptchaGate from '../components/RecaptchaGate';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Eye, EyeOff, Shield, Lock, Zap, Activity } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { EVENTS, trackActivationStep, trackEvent } from '../lib/analytics';

const DISPLAY = fontFamily.display;

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
  const recaptchaEnabled = Boolean(process.env.REACT_APP_RECAPTCHA_SITE_KEY);
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '', full_name: '', company_name: '', industry: ''
  });

  const passwordsMatch = formData.password === formData.confirmPassword;
  const isFormValid = formData.email && formData.password && formData.password.length >= 6 && formData.full_name && formData.confirmPassword && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.full_name) { toast.error('Please fill in all required fields'); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      if (recaptchaEnabled) {
        if (!captchaToken) { toast.error('Please complete the captcha verification.'); return; }
        await apiClient.post('/auth/recaptcha/verify', { token: captchaToken });
      }
      await signUp(formData.email, formData.password, {
        full_name: formData.full_name, company_name: formData.company_name, industry: formData.industry, role: 'user'
      });
      trackEvent(EVENTS.ACTIVATION_SIGNUP_COMPLETE, { method: 'email' });
      trackActivationStep('signup_complete', { method: 'email' });
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
    if (recaptchaEnabled && !captchaToken) {
      toast.error('Please complete the captcha verification first.');
      return;
    }
    setOauthLoading(true);
    trackActivationStep('signup_oauth_started', { provider });
    try {
      if (recaptchaEnabled) {
        await apiClient.post('/auth/recaptcha/verify', { token: captchaToken });
      }
      const result = await signInWithOAuth(provider);
      if (result?.url) { window.location.href = result.url; }
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

  const inputStyle = { fontFamily: fontFamily.body, background: '#0A1018', border: '1px solid #243140', color: '#F4F7FA', caretColor: '#F4F7FA' };

  return (
    <div className="min-h-screen flex" style={{ background: '#0F1720' }}>
      {/* Left: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-20 py-12 overflow-y-auto">
        <div className="max-w-sm w-full mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 mb-8 text-sm transition-colors hover:text-[#FF6A00]" style={{ color: '#64748B', fontFamily: fontFamily.body }} data-testid="register-back-to-home-link">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FF6A00', width: 40, height: 40, minWidth: 40 }}>
              <span className="text-white font-bold text-sm" style={{ fontFamily: fontFamily.mono }}>B</span>
            </div>
            <div className="min-w-0">
              <span className="text-xl font-semibold text-[#F4F7FA] block" style={{ fontFamily: DISPLAY }}>BIQc</span>
              <span className="text-[10px] text-[#64748B] -mt-0.5 block truncate" style={{ fontFamily: fontFamily.mono }}>powered by The Strategy Squad</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: DISPLAY }}>Get started</h1>
          <p className="text-sm text-[#9FB0C3] mb-4" style={{ fontFamily: fontFamily.body }}>Create your account to access sovereign intelligence.</p>

          {!hasSupabaseConfig && (
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: '#F59E0B', background: 'rgba(245,158,11,0.12)', color: '#FDE68A', fontFamily: fontFamily.body }}
              data-testid="register-supabase-config-missing"
            >
              <p className="font-semibold text-[#FBBF24] mb-1">Local setup required</p>
              <p className="text-[#FDE68A]/90 leading-relaxed">
                Set <code className="text-xs bg-black/30 px-1 rounded">REACT_APP_SUPABASE_URL</code> and{' '}
                <code className="text-xs bg-black/30 px-1 rounded">REACT_APP_SUPABASE_ANON_KEY</code> in <code className="text-xs bg-black/30 px-1 rounded">frontend/.env</code> (Supabase → Settings → API), then restart <code className="text-xs bg-black/30 px-1 rounded">npm start</code>.
              </p>
            </div>
          )}

          {/* Contextual integration hint — shown when arriving from the integrations page */}
          {integrationLabel && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
              style={{ background: 'rgba(255,106,0,0.07)', border: '1px solid rgba(255,106,0,0.2)' }}>
              <Zap className="w-4 h-4 flex-shrink-0" style={{ color: '#FF6A00' }} />
              <p className="text-xs" style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>
                After setup you'll connect <span style={{ color: '#FF6A00' }}>{integrationLabel}</span> to power your AI intelligence.
              </p>
            </div>
          )}

          {/* OAuth */}
          <div className="space-y-3 mb-5">
            <button type="button" onClick={() => handleOAuthSignIn('google')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full h-11 flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-all hover:bg-white/10 disabled:opacity-50"
              style={{ fontFamily: fontFamily.body, color: '#F4F7FA', background: '#141C26', border: '1px solid #243140' }}
              data-testid="register-google-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: "#FF6A00", fontFamily: "\x27JetBrains Mono\x27, monospace" }}>connecting...</span> : (
                <><svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EF4444" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</>
              )}
            </button>
            <button type="button" onClick={() => handleOAuthSignIn('azure')} disabled={!hasSupabaseConfig || oauthLoading || loading}
              className="w-full h-11 flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-all hover:bg-white/10 disabled:opacity-50"
              style={{ fontFamily: fontFamily.body, color: '#F4F7FA', background: '#141C26', border: '1px solid #243140' }}
              data-testid="register-microsoft-btn">
              {oauthLoading ? <span className="text-xs" style={{ color: "#FF6A00", fontFamily: "\x27JetBrains Mono\x27, monospace" }}>connecting...</span> : (
                <><svg className="w-5 h-5" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>Continue with Microsoft</>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: '#243140' }} />
            <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>or register with email</span>
            <div className="flex-1 h-px" style={{ background: '#243140' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Full Name <span className="text-[#EF4444]">*</span></label>
              <Input id="full_name" type="text" value={formData.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="John Doe" className="h-11 text-sm rounded-xl" style={inputStyle} required data-testid="register-name-input" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Email <span className="text-[#EF4444]">*</span></label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} placeholder="you@company.com" className="h-11 text-sm rounded-xl" style={inputStyle} required data-testid="register-email-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Company</label>
                <Input id="company_name" type="text" value={formData.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Your Company" className="h-11 text-sm rounded-xl" style={inputStyle} data-testid="register-company-input" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Industry</label>
                <Input id="industry" type="text" value={formData.industry} onChange={(e) => set('industry', e.target.value)} placeholder="Technology" className="h-11 text-sm rounded-xl" style={inputStyle} data-testid="register-industry-input" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Password <span className="text-[#EF4444]">*</span></label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 6 characters" className="h-11 pr-12 text-sm rounded-xl" style={{ ...inputStyle, WebkitTextSecurity: showPassword ? 'none' : 'disc' }} required minLength={6} data-testid="register-password-input" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#9FB0C3]" data-testid="register-toggle-password">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Confirm Password <span className="text-[#EF4444]">*</span></label>
              <Input id="confirmPassword" type={showPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Re-enter password" className="h-11 text-sm rounded-xl"
                style={{ ...inputStyle, borderColor: formData.confirmPassword && !passwordsMatch ? '#EF4444' : '#243140', WebkitTextSecurity: showPassword ? 'none' : 'disc' }}
                required minLength={6} data-testid="register-confirm-password-input" />
              {formData.confirmPassword && !passwordsMatch && <p className="text-xs mt-1 text-[#EF4444]" data-testid="password-mismatch-error">Passwords do not match</p>}
            </div>

            <button type="submit" disabled={!hasSupabaseConfig || loading || oauthLoading || !isFormValid}
              className="w-full h-12 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: '#FF6A00', fontFamily: fontFamily.body, boxShadow: '0 4px 16px rgba(255,106,0,0.3)', width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              data-testid="register-submit-btn">
              {loading ? "Creating account..." : "Create account"}
            </button>
            {recaptchaEnabled && (
              <RecaptchaGate onTokenChange={setCaptchaToken} testId="register-recaptcha" />
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#64748B]" style={{ fontFamily: fontFamily.body }}>
              Already have an account?{' '}
              <Link to="/login-supabase" className="font-semibold text-[#FF6A00] hover:text-[#FF8C33] transition-colors" data-testid="register-login-link">Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right: Trust Panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center px-12" style={{ background: '#0A1018', borderLeft: '1px solid #243140' }}>
        <div className="max-w-sm">
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#FF6A00] block mb-5" style={{ fontFamily: fontFamily.mono }}>Sovereign Intelligence</span>
          <h2 className="text-3xl font-normal text-[#F4F7FA] mb-3 leading-snug" style={{ fontFamily: DISPLAY }}>
            Transform chaos into strategic clarity.
          </h2>
          <p className="text-sm text-[#9FB0C3] mb-8 leading-relaxed" style={{ fontFamily: fontFamily.body }}>Join forward-thinking leaders leveraging sovereign AI for competitive advantage.</p>

          <div className="space-y-3">
            {[
              { icon: Zap, label: '15+ hours saved weekly', desc: 'Automated intelligence gathering' },
              { icon: Activity, label: '8-12% cash bleed detected', desc: 'Revenue protection on autopilot' },
              { icon: Shield, label: '97% SOP compliance', desc: 'Operational consistency assured' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={{ background: '#141C26', border: '1px solid #243140' }}>
                <item.icon className="w-4 h-4 text-[#FF6A00] shrink-0" />
                <div>
                  <span className="text-sm font-medium text-[#F4F7FA] block" style={{ fontFamily: fontFamily.body }}>{item.label}</span>
                  <span className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: '#10B98110', border: '1px solid #10B98120' }}>
            <Lock className="w-4 h-4 text-[#10B981]" />
            <span className="text-xs text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>100% Australian data sovereignty guaranteed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterSupabase;
