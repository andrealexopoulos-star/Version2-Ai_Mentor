import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const AUTH_STATE = {
  LOADING: 'LOADING',
  NEEDS_CALIBRATION: 'NEEDS_CALIBRATION',
  READY: 'READY',
  ERROR: 'ERROR',
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'biqc-auth'
  }
});

const SupabaseAuthContext = createContext(null);

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [authState, setAuthState] = useState(AUTH_STATE.LOADING);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const initializeAuth = async () => {
      try {
        if (retryCount >= MAX_RETRIES) {
          console.error('[Auth] Max retries reached, stopping initialization');
          if (isMounted) {
            setLoading(false);
            setInitialized(true);
            setAuthHydrated(true);
          }
          return;
        }
        
        retryCount++;
        console.log(`[Auth] Initializing auth state... (attempt ${retryCount}/${MAX_RETRIES})`);
        
        let retries = 3;
        let sessionData = null;
        
        while (retries > 0 && !sessionData) {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('[Auth] Error getting session:', error);
            retries--;
            if (retries > 0) {
              await new Promise(r => setTimeout(r, 500));
            }
          } else {
            sessionData = data;
          }
        }
        
        if (!isMounted) return;
        
        const currentSession = sessionData?.session;
        console.log('[Auth] Initial session:', currentSession ? `User: ${currentSession.user?.email}` : 'No session');
        
        setSession(currentSession);
        if (currentSession?.user) {
          await fetchUserProfile(currentSession.user.id, currentSession);
        } else {
          setLoading(false);
        }
        setInitialized(true);
        setAuthHydrated(true);
      } catch (error) {
        if (!isMounted) return;
        console.error('[Auth] Initialization error:', error);
        setLoading(false);
        setInitialized(true);
        setAuthHydrated(true);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      console.log('[Auth] Auth state changed:', event, session ? `User: ${session.user?.email}` : 'No session');
      
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId, existingSession) => {
    try {
      if (existingSession?.user) {
        const fallbackUser = {
          id: existingSession.user.id,
          email: existingSession.user.email,
          full_name: existingSession.user.user_metadata?.full_name || existingSession.user.user_metadata?.name || existingSession.user.email,
          company_name: existingSession.user.user_metadata?.company_name || null,
          industry: existingSession.user.user_metadata?.industry || null,
          role: existingSession.user.user_metadata?.role || 'user',
          subscription_tier: 'free',
          is_master_account: existingSession.user.email === 'andre@thestrategysquad.com.au'
        };
        setUser(fallbackUser);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('[Auth] Error in fetchUserProfile:', error);
      setLoading(false);
    }
  };

  const signUp = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata }
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([{
            id: data.user.id,
            email: data.user.email,
            full_name: metadata.full_name || null,
            company_name: metadata.company_name || null,
            industry: metadata.industry || null,
            role: metadata.role || null,
            subscription_tier: 'free',
            is_master_account: email === 'andre@thestrategysquad.com.au',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }

        const { error: cognitiveError } = await supabase
          .from('cognitive_profiles')
          .insert([{
            user_id: data.user.id,
            immutable_reality: {},
            behavioural_truth: {},
            delivery_preference: {},
            consequence_memory: {},
            last_updated: new Date().toISOString()
          }]);

        if (cognitiveError) {
          console.error('Error creating cognitive profile:', cognitiveError);
        }
      }

      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signInWithOAuth = async (provider) => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
          queryParams: {
            ...(provider === 'google' && { prompt: 'select_account', access_type: 'offline' }),
            ...(provider === 'azure' && { prompt: 'select_account' })
          }
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('OAuth error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setSession(null);
      throw error;
    }
  };

  // CALIBRATION CHECK — single source of truth: user_operator_profile.persona_calibration_status
  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        setAuthState(AUTH_STATE.LOADING);

        const activeSession = session || (await supabase.auth.getSession()).data.session;

        if (!activeSession) {
          if (!cancelled) setAuthState(AUTH_STATE.READY);
          return;
        }

        const accessToken = activeSession.access_token;
        if (!accessToken) {
          if (!cancelled) setAuthState(AUTH_STATE.READY);
          return;
        }

        let calibrationComplete = false;

        // Check user_operator_profile directly via Supabase REST
        try {
          const userId = activeSession.user.id;
          
          const opRes = await fetch(
            `${SUPABASE_URL}/rest/v1/user_operator_profile?user_id=eq.${userId}&select=persona_calibration_status`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'apikey': SUPABASE_ANON_KEY,
              }
            }
          );
          
          if (opRes.ok) {
            const rows = await opRes.json();
            if (rows.length > 0 && rows[0].persona_calibration_status === 'complete') {
              calibrationComplete = true;
              console.log('[Auth] user_operator_profile confirms COMPLETE');
            }
          }
        } catch (e) {
          console.warn('[Auth] user_operator_profile check failed:', e.message);
        }

        // Fallback: backend endpoint (also reads user_operator_profile)
        if (!calibrationComplete) {
          try {
            const calRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calibration/status`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (calRes.ok) {
              const cal = await calRes.json();
              if (cal.status === 'COMPLETE') {
                calibrationComplete = true;
                console.log('[Auth] Backend confirms COMPLETE');
              }
            }
          } catch { /* non-fatal */ }
        }

        if (!cancelled) {
          if (calibrationComplete) {
            setAuthState(AUTH_STATE.READY);
          } else {
            console.log('[Auth] Calibration incomplete → NEEDS_CALIBRATION');
            setAuthState(AUTH_STATE.NEEDS_CALIBRATION);
          }
        }

      } catch (err) {
        console.error('[AUTH BOOTSTRAP ERROR]', err.message);
        if (!cancelled) {
          setAuthState(AUTH_STATE.READY);
        }
      }
    };

    bootstrap();

    return () => { cancelled = true; };
  }, [authHydrated, session]);

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      if (data.session) {
        setSession(data.session);
        if (data.session.user) {
          await fetchUserProfile(data.session.user.id, data.session);
        }
      }
      return data.session;
    } catch (error) {
      console.error('[Auth] Session refresh exception:', error);
      return null;
    }
  };

  const value = {
    user,
    session,
    loading,
    authHydrated,
    authState,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    refreshSession,
    supabase
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  }
  return context;
};
