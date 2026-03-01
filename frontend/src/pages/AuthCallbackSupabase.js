import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';

const AuthCallbackSupabase = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError || !data.session) {
          navigate('/login-supabase', { replace: true });
          return;
        }

        navigate('/advisor', { replace: true });
      } catch (e) {
        if (mounted) {
          setError(e.message);
          setTimeout(() => navigate('/login-supabase', { replace: true }), 2000);
        }
      }
    };

    resolve();
    return () => { mounted = false; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1720' }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: '#FF6A00' }}>
          <span className="text-white font-bold text-xl" style={{ fontFamily: "'JetBrains Mono', monospace" }}>B</span>
        </div>
        <p className="text-sm text-[#9FB0C3]">{error ? `Error: ${error}` : 'Completing sign in...'}</p>
      </div>
    </div>
  );
};

export default AuthCallbackSupabase;
