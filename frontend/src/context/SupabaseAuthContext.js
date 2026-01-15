/**
 * Supabase Auth Context
 * Handles authentication using Supabase Auth with Google and Azure providers
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SupabaseAuthContext = createContext(null);

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      // Fetch user profile from PostgreSQL
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setUser(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user profile:', error);
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
          skipBrowserRedirect: false
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
