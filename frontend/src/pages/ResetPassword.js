import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Lock, CheckCircle2, Info } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { getAppBaseUrl } from '../config/urls';

/* ── Mockup-aligned CSS-variable font stacks ── */
const DISPLAY = 'var(--font-display, ' + fontFamily.display + ')';
const UI      = 'var(--font-ui, '      + fontFamily.body    + ')';
const MONO    = 'var(--font-mono, '    + fontFamily.mono    + ')';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppBaseUrl()}/update-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success('Reset email sent');
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden" style={{ background: '#FAFAFA' }}>
      {/* Background orbs */}
      <div className="fixed -top-[300px] -right-[200px] w-[700px] h-[700px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(232,93,0,0.15) 0%, transparent 60%)', opacity: 0.5, filter: 'blur(80px)', animation: 'orbDriftSlow 20s ease-in-out infinite' }} />
      <div className="fixed -bottom-[300px] -left-[200px] w-[700px] h-[700px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(192,200,212,0.1) 0%, transparent 60%)', opacity: 0.6, filter: 'blur(80px)', animation: 'orbDriftSlow 24s ease-in-out infinite reverse' }} />
      <style>{`@keyframes orbDriftSlow { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px, -30px) scale(1.15); } }`}</style>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6">
        <Link to="/" className="flex items-center gap-3" style={{ color: 'var(--ink-display, #0A0A0A)', textDecoration: 'none' }}>
          <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: 'var(--lava, #E85D00)', boxShadow: '0 0 16px var(--lava, #E85D00)' }} />
          <span className="text-[22px] font-semibold" style={{ fontFamily: DISPLAY }}>BIQc</span>
        </Link>
        <Link to="/login-supabase" className="text-sm px-4 py-2 rounded-lg transition-colors" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: UI }} data-testid="reset-back-link">
          ← Back to sign in
        </Link>
      </nav>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-[480px]">
          <div className="p-10" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))', borderRadius: 'var(--r-2xl, 20px)', boxShadow: 'var(--elev-3, 0 12px 40px rgba(0,0,0,0.4))' }} data-testid="reset-card">
            {sent ? (
              <div className="text-center" data-testid="reset-sent">
                <div className="w-14 h-14 flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--positive-wash, rgba(16,185,129,0.12))', borderRadius: 'var(--r-lg, 12px)' }}>
                  <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--positive, #10B981)' }} />
                </div>
                <h1 className="text-2xl font-semibold mb-3" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)', lineHeight: 1.05 }}>Check your email</h1>
                <p className="text-sm leading-relaxed mb-6" style={{ fontFamily: UI, color: 'var(--ink-secondary, #8FA0B8)' }}>
                  We've sent a password reset link to <strong style={{ color: 'var(--ink-display, #0A0A0A)' }}>{email}</strong>. Click the link in the email to set a new password.
                </p>
                <p className="text-xs mb-6" style={{ fontFamily: MONO, color: 'var(--ink-muted, #708499)' }}>Didn't receive it? Check spam or try again.</p>
                <button onClick={() => setSent(false)} className="text-sm transition-colors" style={{ color: 'var(--lava, #E85D00)', fontFamily: UI }} data-testid="reset-try-again">
                  Send again
                </button>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 flex items-center justify-center mb-6" style={{ background: 'var(--lava-wash, rgba(232,93,0,0.12))', borderRadius: 'var(--r-lg, 12px)' }}>
                  <Lock className="w-6 h-6" style={{ color: 'var(--lava, #E85D00)' }} />
                </div>
                <h1 className="mb-3" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)', fontSize: '40px', letterSpacing: 'var(--ls-tight, -0.035em)', lineHeight: 1.05, fontWeight: 'var(--fw-display, 400)' }}>
                  Reset your <em style={{ fontStyle: 'italic', color: 'var(--lava, #E85D00)' }}>password</em>.
                </h1>
                <p className="text-base leading-relaxed" style={{ fontFamily: UI, color: 'var(--ink-secondary, #8FA0B8)' }}>
                  Enter the email tied to your BIQc account. We'll send a one-time link that signs you in and lets you set a new password.
                </p>

                <form onSubmit={handleReset} data-testid="reset-form">
                  <div className="flex flex-col gap-1.5 mt-7">
                    <label htmlFor="reset-email" className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #708499)' }}>Work email</label>
                    <Input id="reset-email" type="email" inputMode="email" autoComplete="email" value={email}
                      onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com.au" required
                      className="h-12 text-sm"
                      style={{ fontFamily: UI, background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink, #C8D4E4)' }}
                      data-testid="reset-email-input" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 mt-6 text-[15px] font-semibold transition-all disabled:opacity-50 hover:brightness-110"
                    style={{ background: 'var(--lava, #E85D00)', color: 'white', height: 48, fontFamily: UI, border: 'none', borderRadius: 'var(--r-md, 8px)', cursor: 'pointer', padding: '16px' }}
                    data-testid="reset-submit-btn">
                    {loading ? 'Sending...' : <>Send reset link<span className="ml-1">→</span></>}
                  </button>
                </form>

                <p className="text-sm mt-6 text-center" style={{ fontFamily: UI, color: 'var(--ink-secondary, #8FA0B8)' }}>
                  Remembered it?{' '}
                  <Link to="/login-supabase" className="font-medium" style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }}>
                    Back to sign in →
                  </Link>
                </p>
              </>
            )}
          </div>

          {/* SSO info aside */}
          <div className="flex items-start gap-4 mt-6 p-5" style={{ background: 'var(--surface-2, #F1F5F9)', border: '1px solid var(--border, rgba(140,170,210,0.12))', borderRadius: 'var(--r-lg, 12px)' }}>
            <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: 'var(--lava-wash, rgba(232,93,0,0.12))', borderRadius: 'var(--r-md, 8px)' }}>
              <Info className="w-4 h-4" style={{ color: 'var(--lava, #E85D00)' }} />
            </div>
            <p className="text-[13px] leading-relaxed" style={{ fontFamily: UI, color: 'var(--ink-secondary, #8FA0B8)' }}>
              <strong style={{ color: 'var(--ink-display, #0A0A0A)' }}>Heads up.</strong> If you signed up with Google, Microsoft, or SAML, this won't work — use the same SSO button you used originally on the sign-in page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
