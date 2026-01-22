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

  useEffect(() => {
    let isMounted = true; // Track mount state to prevent state updates after unmount

    const initializeAuth = async () => {
      try {
        console.log('[Auth] Initializing auth state...');
        
        // Get initial session with retry for mobile browsers
        let retries = 3;
        let sessionData = null;
        
        while (retries > 0 && !sessionData) {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('[Auth] Error getting session:', error);
            retries--;
            if (retries > 0) {
              await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
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
          fetchUserProfile(currentSession.user.id, currentSession);
        } else {
          setLoading(false);
        }
        setInitialized(true);
      } catch (error) {
        if (!isMounted) return;
        console.error('[Auth] Initialization error:', error);
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return; // Don't update if component unmounted
      
      console.log('[Auth] Auth state changed:', event, session ? `User: ${session.user?.email}` : 'No session');
      
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session); // Pass session to avoid duplicate call
      } else {
        setUser(null);
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
      // Use passed session instead of fetching again (fixes AbortError race condition)
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
        console.log('Using user data from session:', fallbackUser);
        setUser(fallbackUser);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
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
              prompt: 'select_account',
              access_type: 'offline'
            }),
            // Force account picker for Azure/Microsoft
            ...(provider === 'azure' && { 
              prompt: 'select_account'
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

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
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
