import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';

const AuthCallbackSupabase = () => {
  const navigate = useNavigate();
  const { refreshSession } = useSupabaseAuth();
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('=== AUTH CALLBACK STARTED ===');
        console.log('Current URL:', window.location.href);
        setStatus('Extracting tokens...');
        
        // Microsoft/Azure sends tokens in query params, Google sends in hash
        // Check BOTH locations
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const errorCode = hashParams.get('error') || queryParams.get('error');
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
        
        console.log('Token check:', { 
          accessToken: accessToken ? 'Present' : 'Missing',
          refreshToken: refreshToken ? 'Present' : 'Missing',
          error: errorCode,
          errorDescription: errorDescription,
          hashParams: window.location.hash,
          queryParams: window.location.search
        });
        
        // Handle OAuth errors
        if (errorCode) {
          console.error('❌ OAuth error:', errorCode, errorDescription);
          setError(`OAuth failed: ${errorDescription || errorCode}`);
          setTimeout(() => navigate('/login-supabase?error=oauth_failed'), 2000);
          return;
        }

        if (accessToken) {
          console.log('✅ Access token found in URL');
          setStatus('Creating session...');
          
          // Set the session with Supabase
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          console.log('Session creation result:', {
            hasSession: !!sessionData.session,
            userId: sessionData.session?.user?.id,
            email: sessionData.session?.user?.email,
            error: sessionError?.message
          });
          
          if (sessionError) {
            console.error('❌ Failed to create session:', sessionError);
            setError(sessionError.message);
            setTimeout(() => navigate('/login-supabase?error=session_failed'), 2000);
            return;
          }

          if (sessionData.session) {
            console.log('✅ Session created! User:', sessionData.session.user.email);
            setStatus('Verifying session...');
            
            // CRITICAL: Force refresh the auth context to pick up the new session
            if (refreshSession) {
              await refreshSession();
            }
            
            // Wait for session to propagate
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Verify session is actually set
            const { data: verifyData } = await supabase.auth.getSession();
            console.log('Session verification:', {
              hasSession: !!verifyData.session,
              email: verifyData.session?.user?.email
            });
            
            if (!verifyData.session) {
              console.error('❌ Session not persisted after setSession');
              setError('Session failed to persist');
              setTimeout(() => navigate('/login-supabase?error=session_not_persisted'), 2000);
              return;
            }
            
            setStatus('Checking profile...');
            
            // Check if user needs onboarding
            try {
              // STEP 2: CALIBRATION STATUS CHECK — query Supabase directly
              const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
              const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

              // Query user_operator_profile for persona_calibration_status
              const calCheckRes = await fetch(
                `${supabaseUrl}/rest/v1/user_operator_profile?user_id=eq.${sessionData.session.user.id}&select=persona_calibration_status`,
                {
                  headers: {
                    'Authorization': `Bearer ${sessionData.session.access_token}`,
                    'apikey': supabaseKey,
                  }
                }
              );

              let needsCalibration = true;
              if (calCheckRes.ok) {
                const calRows = await calCheckRes.json();
                if (calRows.length > 0 && calRows[0].persona_calibration_status === 'complete') {
                  needsCalibration = false;
                }
              }

              // Fallback: check legacy endpoint if new table query failed
              if (needsCalibration) {
                try {
                  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
                  const legacyRes = await fetch(`${BACKEND_URL}/api/calibration/status`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${sessionData.session.access_token}` }
                  });
                  if (legacyRes.ok) {
                    const legacyData = await legacyRes.json();
                    if (legacyData.status === 'COMPLETE') needsCalibration = false;
                  }
                } catch { /* legacy unavailable, proceed with new system */ }
              }

              if (needsCalibration) {
                console.log('[GUARD] ➤ Calibration needed, routing to /calibration');
                navigate('/calibration', { replace: true });
                return;
              }

              // STEP 3: BUSINESS PROFILE STATE CHECK (post-calibration)
              const response = await fetch(`${BACKEND_URL}/api/auth/check-profile`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${sessionData.session.access_token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (!response.ok) {
                const errorStatus = response.status;
                console.error(`[GUARD] ❌ Context load failed: ${errorStatus}`);
                setError(`Failed to load your business context (HTTP ${errorStatus})`);
                setStatus('Unable to verify your account. Please retry.');
                return; // STOP - no routing
              }
              
              const profileData = await response.json();
              console.log('[GUARD] ✅ Context load ok:', { 
                needs_onboarding: profileData.needs_onboarding,
                onboarding_status: profileData.onboarding_status
              });
              
              const businessContext = {
                user_id: sessionData.session.user.id,
                account_id: profileData.user?.account_id || null,
                business_profile_id: profileData.user?.business_profile_id || profileData.user?.id || null,
                onboarding_status: profileData.onboarding_status || 'calibration_required',
                calibration_status: profileData.calibration_status || null,
                cached_at: Date.now()
              };
              localStorage.setItem('biqc_context_v1', JSON.stringify(businessContext));
              console.log(`[CONTEXT] ✅ cached biqc_context_v1 (cached_at=${new Date(businessContext.cached_at).toISOString()})`);
              
              if (profileData.needs_onboarding || profileData.onboarding_status === 'calibration_required') {
                console.log('[GUARD] Routing decision = calibration');
                navigate('/calibration', { replace: true });
              } else {
                console.log('[GUARD] ✅ Calibration complete. routing to /advisor');
                navigate('/advisor', { replace: true });
              }
            } catch (profileCheckError) {
              console.error('❌ Error checking profile:', profileCheckError);
              
              // HARD GATE: Show error UI, do NOT route to advisor/onboarding
              setError('Network error loading your profile');
              setStatus('Please retry or contact support if this persists.');
              return; // STOP routing
            }
          } else {
            console.log('❌ No session despite access token');
            setError('No session created');
            setTimeout(() => navigate('/login-supabase'), 2000);
          }
        } else {
          console.log('No tokens in URL, checking for existing session...');
          setStatus('Checking existing session...');
          const { data, error } = await supabase.auth.getSession();
          
          if (error || !data.session) {
            console.log('No session found, redirecting to login');
            navigate('/login-supabase');
          } else {
            console.log('Existing session found, redirecting to biqc-insights');
            navigate('/advisor', { replace: true });
          }
        }
      } catch (error) {
        console.error('Callback handling error:', error);
        setError(error.message);
        setTimeout(() => navigate('/login-supabase?error=unexpected'), 2000);
      }
    };

    handleCallback();
  }, [navigate, refreshSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Completing sign in...
        </h2>
        <p className="text-gray-600">
          {status}
        </p>
        {error && (
          <p className="text-red-600 mt-4 text-sm">
            Error: {error}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-4">
          Check browser console for detailed logs
        </p>
      </div>
    </div>
  );
};

export default AuthCallbackSupabase;
