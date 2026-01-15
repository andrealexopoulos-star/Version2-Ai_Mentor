import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';

const AuthCallbackSupabase = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Exchange the code from URL for a session
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        console.log('Callback - Hash params:', { accessToken: !!accessToken, refreshToken: !!refreshToken });

        // If we have tokens in the URL, Supabase has already set the session
        if (accessToken) {
          console.log('Access token found, checking session...');
          
          // Wait a bit for Supabase to process
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { data, error } = await supabase.auth.getSession();
          
          console.log('Session data:', data);
          console.log('Session error:', error);
          
          if (error) {
            console.error('Auth callback error:', error);
            setError(error.message);
            setTimeout(() => navigate('/login-supabase?error=auth_failed'), 2000);
            return;
          }

          if (data.session) {
            console.log('Auth successful! User:', data.session.user.email);
            console.log('Redirecting to dashboard...');
            navigate('/dashboard');
          } else {
            console.log('No session found despite access token');
            setError('No session created');
            setTimeout(() => navigate('/login-supabase'), 2000);
          }
        } else {
          // No tokens, try to get existing session
          console.log('No tokens in URL, checking for existing session...');
          const { data, error } = await supabase.auth.getSession();
          
          if (error || !data.session) {
            console.log('No session found, redirecting to login');
            navigate('/login-supabase');
          } else {
            console.log('Existing session found, redirecting to dashboard');
            navigate('/dashboard');
          }
        }
      } catch (error) {
        console.error('Callback handling error:', error);
        setError(error.message);
        setTimeout(() => navigate('/login-supabase?error=unexpected'), 2000);
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
        {error && (
          <p className="text-red-600 mt-4 text-sm">
            Error: {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackSupabase;
