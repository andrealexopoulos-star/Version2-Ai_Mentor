import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Lock, CheckCircle2, Info } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { getAppBaseUrl } from '../config/urls';
import BiqcLogoCard from '../components/BiqcLogoCard';

/* ── Marketing-aligned font stacks (Merge aesthetic — Geist) ── */
const DISPLAY = 'var(--font-marketing-display, "Geist", sans-serif)';
const UI      = 'var(--font-marketing-ui, "Geist", sans-serif)';
const MONO    = 'var(--font-marketing-ui, "Geist", sans-serif)';

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
    <div className="min-h-screen flex flex-col relative overflow-x-hidden" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
      {/* Background orbs — subtle orange bloom + silver counter */}
      <div className="fixed -top-[300px] -right-[200px] w-[700px] h-[700px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(232,93,0,0.12) 0%, transparent 60%)', opacity: 0.6, filter: 'blur(80px)', animation: 'orbDriftSlow 20s ease-in-out infinite' }} />
      <div className="fixed -bottom-[300px] -left-[200px] w-[700px] h-[700px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,177,189,0.25) 0%, transparent 60%)', opacity: 0.7, filter: 'blur(80px)', animation: 'orbDriftSlow 24s ease-in-out infinite reverse' }} />
      <style>{`@keyframes orbDriftSlow { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px, -30px) scale(1.15); } }`}</style>

      {/* Nav — hovering logo card */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6">
        <BiqcLogoCard size="sm" to="/" />
        <Link to="/login-supabase" className="text-sm px-4 py-2 rounded-lg transition-colors" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: UI }} data-testid="reset-back-link">
          ← Back to sign in
        </Link>
      </nav>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-[480px]">
          <div className="p-10" style={{ background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)', border: '1px solid rgba(10,10,10,0.06)', borderRadius: '20px', boxShadow: '0 14px 40px rgba(10,10,10,0.08), inset 0 1px 0 rgba(255,255,255,0.5)' }} data-testid="reset-card">
            {sent ? (
              <div className="text-center" data-testid="reset-sent">
                <div className="w-14 h-14 flex items-center justify-center mx-auto mb-6" style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.08)', borderRadius: '12px' }}>
                  <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--positive, #10B981)' }} />
                </div>
                <h1 className="mb-3" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)', fontSize: '28px', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}>Check your email</h1>
                <p className="text-sm leading-relaxed mb-6" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
                  We've sent a password reset link to <strong style={{ color: 'var(--ink-display, #0A0A0A)' }}>{email}</strong>. Click the link in the email to set a new password.
                </p>
                <p className="text-xs mb-6" style={{ fontFamily: MONO, color: 'var(--ink-muted, #737373)' }}>Didn't receive it? Check spam or try again.</p>
                <button onClick={() => setSent(false)} className="text-sm font-medium transition-colors" style={{ color: 'var(--lava, #E85D00)', fontFamily: UI }} data-testid="reset-try-again">
                  Send again
                </button>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 flex items-center justify-center mb-6" style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.08)', borderRadius: '12px' }}>
                  <Lock className="w-6 h-6" style={{ color: 'var(--lava, #E85D00)' }} />
                </div>
                <h1 className="mb-3" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)', fontSize: '40px', letterSpacing: '-0.035em', lineHeight: 1.05, fontWeight: 600 }}>
                  Reset your <em style={{ fontStyle: 'italic', color: 'var(--lava, #E85D00)' }}>password</em>.
                </h1>
                <p className="text-base leading-relaxed" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
                  Enter the email tied to your BIQc account. We'll send a one-time link that signs you in and lets you set a new password.
                </p>

                <form onSubmit={handleReset} data-testid="reset-form">
                  <div className="flex flex-col gap-1.5 mt-7">
                    <label htmlFor="reset-email" className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: 'var(--ink-muted, #737373)' }}>Work email</label>
                    <Input id="reset-email" type="email" inputMode="email" autoComplete="email" value={email}
                      onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com.au" required
                      className="h-12 text-sm"
                      style={{ fontFamily: UI, background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.1)', borderRadius: '8px', color: 'var(--ink-display, #0A0A0A)' }}
                      data-testid="reset-email-input" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 mt-6 text-[15px] font-medium transition-all disabled:opacity-50"
                    style={{ background: '#0A0A0A', color: '#FFFFFF', height: 48, fontFamily: UI, border: '1px solid #0A0A0A', borderRadius: '999px', cursor: 'pointer', padding: '16px', letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.12)' }}
                    data-testid="reset-submit-btn">
                    {loading ? 'Sending...' : <>Send reset link<span className="ml-1">→</span></>}
                  </button>
                </form>

                <p className="text-sm mt-6 text-center" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
                  Remembered it?{' '}
                  <Link to="/login-supabase" className="font-medium" style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }}>
                    Back to sign in →
                  </Link>
                </p>
              </>
            )}
          </div>

          {/* SSO info aside */}
          <div className="flex items-start gap-4 mt-6 p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.08)', borderRadius: '12px' }}>
            <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: 'var(--canvas-sage-soft, #F7F8F2)', borderRadius: '8px' }}>
              <Info className="w-4 h-4" style={{ color: 'var(--lava, #E85D00)' }} />
            </div>
            <p className="text-[13px] leading-relaxed" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>
              <strong style={{ color: 'var(--ink-display, #0A0A0A)' }}>Heads up.</strong> If you signed up with Google, Microsoft, or SAML, this won't work — use the same SSO button you used originally on the sign-in page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
