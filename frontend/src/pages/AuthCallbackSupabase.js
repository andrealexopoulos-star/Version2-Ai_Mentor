import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';

const AuthCallbackSupabase = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from URL params
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          navigate('/login-supabase?error=auth_failed');
          return;
        }

        if (data.session) {
          // User is authenticated
          console.log('Auth successful, redirecting to dashboard');
          navigate('/dashboard');
        } else {
          // No session found
          console.log('No session found, redirecting to login');
          navigate('/login-supabase');
        }
      } catch (error) {
        console.error('Callback handling error:', error);
        navigate('/login-supabase?error=unexpected');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Completing sign in...
        </h2>
        <p className="text-gray-600">
          Please wait while we authenticate you
        </p>
      </div>
    </div>
  );
};

export default AuthCallbackSupabase;
