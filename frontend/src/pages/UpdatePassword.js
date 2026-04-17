import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import BiqcLogoCard from '../components/BiqcLogoCard';

const DISPLAY = 'var(--font-marketing-display, "Geist", sans-serif)';
const UI      = 'var(--font-marketing-ui, "Geist", sans-serif)';

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

  const inputStyle = { fontFamily: UI, background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.1)', color: 'var(--ink-display, #0A0A0A)' };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
      <div className="max-w-sm w-full">
        {/* Hovering BIQc.ai logo card */}
        <div className="mb-8">
          <BiqcLogoCard size="sm" to="/" />
        </div>

        <div style={{ background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)', border: '1px solid rgba(10,10,10,0.06)', borderRadius: '20px', padding: '32px', boxShadow: '0 14px 40px rgba(10,10,10,0.08), inset 0 1px 0 rgba(255,255,255,0.5)' }}>
          {done ? (
            <div className="text-center" data-testid="password-updated">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#16A34A' }} />
              <h1 className="mb-2" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)', fontSize: '24px', fontWeight: 600, letterSpacing: '-0.025em' }}>Password updated</h1>
              <p className="text-sm" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>Redirecting to your dashboard...</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center" data-testid="password-loading">
              <KeyRound className="w-8 h-8 mx-auto mb-4" style={{ color: 'var(--lava, #E85D00)' }} />
              <h1 className="mb-2" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)', fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>Verifying reset link...</h1>
              <p className="text-sm" style={{ fontFamily: UI, color: 'var(--ink-muted, #737373)' }}>If this takes too long, the link may have expired.</p>
            </div>
          ) : (
            <>
              <h1 className="mb-2" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)', fontSize: '24px', fontWeight: 600, letterSpacing: '-0.025em' }}>Set new password</h1>
              <p className="text-sm mb-8" style={{ fontFamily: UI, color: 'var(--ink-secondary, #525252)' }}>Choose a strong password for your account.</p>

              <form onSubmit={handleUpdate} className="space-y-5" data-testid="update-password-form">
                <div>
                  <label className="text-xs font-semibold block mb-1.5 uppercase tracking-wider" style={{ fontFamily: UI, color: 'var(--ink-muted, #737373)' }}>New Password</label>
                  <div className="relative">
                    <Input type={showPwd ? 'text' : 'password'} value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8}
                      className="h-12 pr-12 text-sm rounded-xl"
                      style={inputStyle}
                      data-testid="new-password-input" />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-muted, #737373)' }}>
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5 uppercase tracking-wider" style={{ fontFamily: UI, color: 'var(--ink-muted, #737373)' }}>Confirm Password</label>
                  <Input type="password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" required
                    className="h-12 text-sm rounded-xl"
                    style={inputStyle}
                    data-testid="confirm-password-input" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full h-12 text-sm font-medium transition-all disabled:opacity-50"
                  style={{ background: '#0A0A0A', color: '#FFFFFF', fontFamily: UI, border: '1px solid #0A0A0A', borderRadius: '999px', cursor: 'pointer', letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.12)' }}
                  data-testid="update-password-btn">
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdatePassword;
