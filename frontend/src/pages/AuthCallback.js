import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (hasProcessed.current) return;
      hasProcessed.current = true;

      // Emergent Auth returns the session_id in URL fragment: #session_id=...
      const hash = window.location.hash || '';
      const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      const sessionId = params.get('session_id');

      if (!sessionId) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        const res = await apiClient.post('/auth/google/exchange', { session_id: sessionId });
        const { access_token, user } = res.data;
        localStorage.setItem('token', access_token);

        // Clear fragment to avoid re-processing
        window.history.replaceState({}, document.title, window.location.pathname);

        // Check if onboarding is needed
        try {
          const onboardingRes = await apiClient.get('/onboarding/status');
          if (!onboardingRes.data.completed) {
            toast.success('Welcome! Let\'s set up your profile');
            navigate('/onboarding', { replace: true });
            return;
          }
        } catch (err) {
          console.error('Error checking onboarding status:', err);
        }

        toast.success('Signed in with Google');
        navigate('/dashboard', { replace: true });
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Google sign-in failed');
        navigate('/login', { replace: true });
      }
    };

    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Signing you in…</div>
    </div>
  );
};

export default AuthCallback;
