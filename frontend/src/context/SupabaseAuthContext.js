/**
 * Supabase Auth Context
 * Handles authentication using Supabase Auth with Google and Azure providers
 * MOBILE-OPTIMIZED: Includes storage fallback for mobile browsers
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const AUTH_STATE = {
  LOADING: 'LOADING',
  NEEDS_CALIBRATION: 'NEEDS_CALIBRATION',
  CALIBRATION_DEFERRED: 'CALIBRATION_DEFERRED',
  READY: 'READY',
  ERROR: 'ERROR',
};

// Initialize Supabase client with stable configuration
// Removed MemoryStorage fallback that was causing abort errors
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
  const [authHydrated, setAuthHydrated] = useState(false); // TASK 1: Explicit hydration flag
  const [onboardingState, setOnboardingState] = useState(null); // TASK 2: Cached onboarding state
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
            setAuthHydrated(true); // Mark as hydrated even on failure
          }
          return;
        }
        
        retryCount++;
        console.log(`[Auth] Initializing auth state... (attempt ${retryCount}/${MAX_RETRIES})`);
        
        // Get initial session with retry
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
        setAuthHydrated(true); // TASK 1: Mark auth as fully hydrated
      } catch (error) {
        if (!isMounted) return;
        console.error('[Auth] Initialization error:', error);
        setLoading(false);
        setInitialized(true);
        setAuthHydrated(true); // TASK 1: Mark as hydrated even on error
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      console.log('[Auth] Auth state changed:', event, session ? `User: ${session.user?.email}` : 'No session');
      
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session);
      } else {
        setUser(null);
        setOnboardingState(null); // Clear onboarding state on logout
        setLoading(false);
      }
    });

    return () => {
      isMounted = false; // Mark component as unmounted
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId, existingSession) => {
    try {
      // Use passed session instead of fetching again
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
        console.log('[Auth] Using user data from session:', fallbackUser);
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
        options: {
          data: metadata
        }
      });

      if (error) throw error;

      // Create user profile in PostgreSQL
      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
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
            }
          ]);

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }

        // Initialize Cognitive Core
        const { error: cognitiveError } = await supabase
          .from('cognitive_profiles')
          .insert([
            {
              user_id: data.user.id,
              immutable_reality: {},
              behavioural_truth: {},
              delivery_preference: {},
              consequence_memory: {},
              last_updated: new Date().toISOString()
            }
          ]);

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signInWithOAuth = async (provider) => {
    try {
      const redirectUrl = `${process.env.REACT_APP_BACKEND_URL}/auth/callback`;
      console.log('OAuth redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider, // 'google' or 'azure'
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
          queryParams: {
            // Force account picker for Google
            ...(provider === 'google' && { 
              prompt: 'select_account', // Google supports select_account (consent is implicit)
              access_type: 'offline'
            }),
            // Force account picker for Azure/Microsoft
            ...(provider === 'azure' && { 
              prompt: 'select_account' // Azure ONLY supports select_account (NOT "select_account consent")
            })
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
      console.log('Supabase signOut called');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error);
        throw error;
      }
      console.log('Supabase signOut successful');
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear state even if API call fails
      setUser(null);
      setSession(null);
      throw error;
    }
  };

  // Force refresh the session from Supabase
  // BUSINESS CONTEXT REHYDRATION (HARD GATE)
  const [businessContext, setBusinessContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState(null);
  const [contextSource, setContextSource] = useState(null); // 'cache' | 'api'

  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        setAuthState(AUTH_STATE.LOADING);

        const activeSession = session || (await supabase.auth.getSession()).data.session;

        if (!activeSession) {
          // No session = not authenticated. This is NOT an error state.
          // We need a state that allows ProtectedRoute to redirect to login.
          // Using NEEDS_CALIBRATION won't work (redirects to /calibration).
          // We need to NOT block on authState when user/session are null.
          // The safest approach: don't change authState, let loading finish naturally.
          // ProtectedRoute checks !user && !session AFTER loading check, so we need
          // to ensure authState is not LOADING when no session exists.
          // Solution: Use a neutral state that doesn't block - READY allows children to render
          // but ProtectedRoute will see !user && !session and redirect to login.
          if (!cancelled) setAuthState(AUTH_STATE.READY);
          return;
        }

        let accessToken = activeSession.access_token;
        if (!accessToken) {
          const refreshed = await supabase.auth.refreshSession();
          accessToken = refreshed?.data?.session?.access_token;
        }

        if (!accessToken) {
          throw new Error('Session refresh failed');
        }

        // 2. Check calibration status FIRST
        const calRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calibration/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!calRes.ok) {
          throw new Error('Calibration status check failed');
        }

        const cal = await calRes.json();

        // ⛔ HARD STOP — do NOT rehydrate before calibration
        if (cal.status === 'NEEDS_CALIBRATION') {
          if (!cancelled) setAuthState(AUTH_STATE.NEEDS_CALIBRATION);
          return;
        }

        // 3. Only now is rehydration allowed
        const profileRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/check-profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!profileRes.ok) {
          throw new Error('Profile rehydration failed');
        }

        const profile = await profileRes.json();

        if (!cancelled) {
          setBusinessContext(profile);
          setAuthState(AUTH_STATE.READY);
        }

      } catch (err) {
        console.error('[AUTH BOOTSTRAP ERROR]', err.message, err);
        if (!cancelled) {
          // If we have a session, default to NEEDS_CALIBRATION rather than ERROR
          // This prevents showing AuthError for transient fetch failures
          const activeSession = session || (await supabase.auth.getSession().catch(() => null))?.data?.session;
          if (activeSession) {
            console.warn('[AUTH BOOTSTRAP] Fetch failed but session exists — defaulting to NEEDS_CALIBRATION');
            setAuthState(AUTH_STATE.NEEDS_CALIBRATION);
          } else {
            setAuthState(AUTH_STATE.ERROR);
          }
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [authHydrated, session]);

  const refreshSession = async () => {
    try {
      console.log('[Auth] Forcing session refresh...');
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[Auth] Session refresh error:', error);
        return null;
      }
      if (data.session) {
        console.log('[Auth] Session refreshed:', data.session.user?.email);
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
    authHydrated, // TASK 1: Expose hydration flag
    onboardingState, // TASK 2: Expose cached onboarding state
    authState,
    businessContext,
    contextLoading,
    contextError,
    contextSource,
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
