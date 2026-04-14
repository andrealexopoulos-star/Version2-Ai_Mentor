import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const DISPLAY = "var(--font-display)";

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase sets session from the reset link hash automatically
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true);
    });
    // Also check if session already exists (link already processed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success('Password updated successfully');
      setTimeout(() => navigate('/advisor', { replace: true }), 2000);
    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'var(--biqc-bg)' }}>
      <div className="max-w-sm w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#E85D00' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: fontFamily.mono }}>B</span>
          </div>
          <span className="text-xl font-semibold text-[var(--ink-display)]" style={{ fontFamily: DISPLAY }}>BIQc</span>
        </div>

        {done ? (
          <div className="text-center" data-testid="password-updated">
            <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-4" />
            <h1 className="text-2xl font-normal text-[var(--ink-display)] mb-2" style={{ fontFamily: DISPLAY }}>Password updated</h1>
            <p className="text-sm text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.body }}>Redirecting to your dashboard...</p>
          </div>
        ) : !sessionReady ? (
          <div className="text-center" data-testid="password-loading">
            <KeyRound className="w-8 h-8 text-[#E85D00] mx-auto mb-4" />
            <h1 className="text-xl font-normal text-[var(--ink-display)] mb-2" style={{ fontFamily: DISPLAY }}>Verifying reset link...</h1>
            <p className="text-sm text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.body }}>If this takes too long, the link may have expired.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-normal text-[var(--ink-display)] mb-2" style={{ fontFamily: DISPLAY }}>Set new password</h1>
            <p className="text-sm text-[var(--ink-secondary)] mb-8" style={{ fontFamily: fontFamily.body }}>Choose a strong password for your account.</p>

            <form onSubmit={handleUpdate} className="space-y-5" data-testid="update-password-form">
              <div>
                <label className="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>New Password</label>
                <div className="relative">
                  <Input type={showPwd ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8}
                    className="h-12 pr-12 text-sm rounded-xl"
                    style={{ fontFamily: fontFamily.body, background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                    data-testid="new-password-input" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5 uppercase tracking-wider" style={{ fontFamily: fontFamily.body }}>Confirm Password</label>
                <Input type="password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" required
                  className="h-12 text-sm rounded-xl"
                  style={{ fontFamily: fontFamily.body, background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                  data-testid="confirm-password-input" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full h-12 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: '#E85D00', fontFamily: fontFamily.body }}
                data-testid="update-password-btn">
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default UpdatePassword;
