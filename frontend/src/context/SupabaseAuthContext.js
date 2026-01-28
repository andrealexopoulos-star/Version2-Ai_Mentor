/**
 * Supabase Auth Context
 * Handles authentication using Supabase Auth with Google and Azure providers
 * MOBILE-OPTIMIZED: Includes storage fallback for mobile browsers
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

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
        
        // TASK 2: Temporarily disable automatic onboarding fetch to prevent logout loop
        // await fetchOnboardingState(userId, existingSession);
        
        // Set default onboarding state to avoid blocking UX
        setOnboardingState({ status: 'unknown', completed: true });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('[Auth] Error in fetchUserProfile:', error);
      setLoading(false);
    }
  };

  // TASK 2: Fetch onboarding state once and cache
  const fetchOnboardingState = async (userId, currentSession) => {
    try {
      // Use passed session token to avoid closure issues
      const token = currentSession?.access_token;
      
      if (!token) {
        console.warn('[Auth] No access token available for onboarding fetch - skipping');
        setOnboardingState({ status: 'unknown', completed: true });
        return;
      }
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/onboarding/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const state = {
          completed: data.completed || false,
          current_step: data.current_step || 0,
          business_stage: data.business_stage || null,
          status: data.completed ? 'completed' : data.current_step > 0 ? 'partial' : 'new'
        };
        console.log('[Auth] Onboarding state cached:', state);
        setOnboardingState(state);
      } else if (response.status === 401 || response.status === 403) {
        // IMPORTANT: Don't let 401 from onboarding check log user out
        // This is a non-critical endpoint - fail open silently
        console.warn('[Auth] Onboarding check returned', response.status, '- failing open (treating as completed)');
        setOnboardingState({ status: 'unknown', completed: true });
      } else {
        // TASK 4: Fail open on other errors
        console.warn('[Auth] Failed to fetch onboarding state - failing open');
        setOnboardingState({ status: 'unknown', completed: true });
      }
    } catch (error) {
      // TASK 4: Fail open on cold start or network error
      // IMPORTANT: Don't propagate error - this is non-critical
      console.warn('[Auth] Onboarding fetch error - failing open (non-critical):', error.message);
      setOnboardingState({ status: 'unknown', completed: true });
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
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('OAuth redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider, // 'google' or 'azure'
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
          queryParams: {
            // Force account picker for Google
            ...(provider === 'google' && { 
              prompt: 'consent', // Changed from 'select_account' to allow new signups
              access_type: 'offline'
            }),
            // Force account picker and consent for Azure/Microsoft
            ...(provider === 'azure' && { 
              prompt: 'consent' // Changed to allow new signups, not just sign-in
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
