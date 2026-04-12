import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Mail, CheckCircle2, KeyRound } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { getAppBaseUrl } from '../config/urls';

const DISPLAY = "'Cormorant Garamond', Georgia, serif";

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
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'var(--biqc-bg)' }}>
      <div className="max-w-sm w-full">
        <Link to="/login-supabase" className="inline-flex items-center gap-2 mb-8 text-sm transition-colors hover:text-[#E85D00]" style={{ color: '#64748B', fontFamily: fontFamily.body }} data-testid="reset-back-link">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#E85D00' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: fontFamily.mono }}>B</span>
          </div>
          <span className="text-xl font-semibold text-[#EDF1F7]" style={{ fontFamily: DISPLAY }}>BIQc</span>
        </div>

        {sent ? (
          <div className="text-center" data-testid="reset-sent">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#10B98115' }}>
              <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
            </div>
            <h1 className="text-2xl font-normal text-[#EDF1F7] mb-3" style={{ fontFamily: DISPLAY }}>Check your email</h1>
            <p className="text-sm text-[#9FB0C3] mb-6 leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              We've sent a password reset link to <strong className="text-[#EDF1F7]">{email}</strong>. Click the link in the email to set a new password.
            </p>
            <p className="text-xs text-[#64748B] mb-8" style={{ fontFamily: fontFamily.mono }}>Didn't receive it? Check spam or try again.</p>
            <button onClick={() => setSent(false)} className="text-sm text-[#E85D00] hover:text-[#FF8C33] transition-colors" style={{ fontFamily: fontFamily.body }} data-testid="reset-try-again">
              Send again
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-normal text-[#EDF1F7] mb-2" style={{ fontFamily: DISPLAY }}>Reset your password</h1>
            <p className="text-sm text-[#9FB0C3] mb-8" style={{ fontFamily: fontFamily.body }}>Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleReset} className="space-y-5" data-testid="reset-form">
              <div>
                <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Email</label>
                <Input type="email" inputMode="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required
                  className="h-12 text-sm rounded-xl"
                  style={{ fontFamily: fontFamily.body, background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                  data-testid="reset-email-input" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full h-12 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#E85D00', fontFamily: fontFamily.body }}
                data-testid="reset-submit-btn">
                {loading ? 'Sending...' : <><Mail className="w-4 h-4" /> Send reset link</>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
