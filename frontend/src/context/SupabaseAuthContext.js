import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getBackendUrl } from '../config/urls';

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

  // Onboarding state — fetched once per session, cached in context
  const [onboardingStatus, setOnboardingStatus] = useState(null); // null = not fetched, object = fetched

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const initializeAuth = async () => {
      try {
        if (retryCount >= MAX_RETRIES) {
          if (isMounted) {
            setLoading(false);
            setInitialized(true);
            setAuthHydrated(true);
          }
          return;
        }
        
        retryCount++;
        
        let retries = 3;
        let sessionData = null;
        
        while (retries > 0 && !sessionData) {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            retries--;
            if (retries > 0) await new Promise(r => setTimeout(r, 500));
          } else {
            sessionData = data;
          }
        }
        
        if (!isMounted) return;
        
        const currentSession = sessionData?.session;
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
        setLoading(false);
        setInitialized(true);
        setAuthHydrated(true);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session);
      } else {
        setUser(null);
        setOnboardingStatus(null); // Clear cached onboarding on logout
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
      // Set initial user from session metadata (instant, avoids blank state)
      if (existingSession?.user) {
        setUser({
          id: existingSession.user.id,
          email: existingSession.user.email,
          full_name: existingSession.user.user_metadata?.full_name || existingSession.user.user_metadata?.name || existingSession.user.email,
          company_name: existingSession.user.user_metadata?.company_name || null,
          industry: existingSession.user.user_metadata?.industry || null,
          role: existingSession.user.user_metadata?.role || 'user',
          subscription_tier: 'free',
          is_master_account: existingSession.user.email === 'andre@thestrategysquad.com.au'
        });
      }
      setLoading(false);

      // Then enrich from users table (authoritative source for role, subscription_tier)
      if (existingSession?.access_token) {
        try {
          const res = await fetch(`${getBackendUrl()}/api/auth/supabase/me`, {
            headers: { 'Authorization': `Bearer ${existingSession.access_token}`, 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
          });
          if (res.ok) {
            const data = await res.json();
            const dbUser = data.user;
            if (dbUser) {
              setUser(prev => ({
                ...prev,
                role: dbUser.role || prev?.role || 'user',
                subscription_tier: dbUser.subscription_tier || prev?.subscription_tier || 'free',
                is_master_account: dbUser.is_master_account || false,
                full_name: dbUser.full_name || prev?.full_name,
                company_name: dbUser.company_name || prev?.company_name,
              }));
            }
          }
        } catch {
          // Non-fatal: session metadata user is sufficient
        }
      }
    } catch (error) {
      setLoading(false);
    }
  };

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: metadata }
    });
    if (error) throw error;
    if (data.user) {
      await supabase.from('users').insert([{
        id: data.user.id, email: data.user.email,
        full_name: metadata.full_name || null,
        company_name: metadata.company_name || null,
        industry: metadata.industry || null,
        role: metadata.role || null,
        subscription_tier: 'free',
        is_master_account: email === 'andre@thestrategysquad.com.au',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);
      await supabase.from('cognitive_profiles').insert([{
        user_id: data.user.id,
        immutable_reality: {}, behavioural_truth: {},
        delivery_preference: {}, consequence_memory: {},
        last_updated: new Date().toISOString()
      }]);
    }
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signInWithOAuth = async (provider) => {
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
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } finally {
      setUser(null);
      setSession(null);
      setOnboardingStatus(null);
    }
  };

  // Mark onboarding as complete in the cached state (called by OnboardingWizard on completion)
  const markOnboardingComplete = useCallback(() => {
    setOnboardingStatus({ completed: true });
  }, []);

  // Defer onboarding — allow dashboard access without completing (called by "save and continue later")
  const deferOnboarding = useCallback(() => {
    setOnboardingStatus(prev => ({ ...prev, completed: true, deferred: true }));
  }, []);

  // CALIBRATION + ONBOARDING CHECK — runs once after auth hydration
  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        setAuthState(AUTH_STATE.LOADING);

        const activeSession = session || (await supabase.auth.getSession()).data.session;
        if (!activeSession?.access_token) {
          if (!cancelled) setAuthState(AUTH_STATE.READY);
          return;
        }

        const accessToken = activeSession.access_token;
        let calibrationComplete = false;

        // SINGLE CHECK: backend /api/calibration/status (service_role key, RLS-safe)
        try {
          const calUrl = `${getBackendUrl()}/api/calibration/status?_t=${Date.now()}`;
          console.log(`[CALIBRATION ROUTING] Fetching: ${calUrl}`);
          const calRes = await fetch(calUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            }
          });
          const contentType = calRes.headers.get('content-type') || '';
          if (calRes.ok && contentType.includes('application/json')) {
            const cal = await calRes.json();
            calibrationComplete = cal.status === 'COMPLETE';
            console.log(`[CALIBRATION ROUTING] Backend status: ${cal.status} → calibrationComplete=${calibrationComplete}`);
          } else if (calRes.ok && !contentType.includes('application/json')) {
            console.warn(`[CALIBRATION ROUTING] Got HTML instead of JSON (content-type: ${contentType}) → fail-open to READY`);
            // LAYER 3: Emergency hard reload if SW poisoning detected
            const reloadFlag = sessionStorage.getItem('biqc_cache_kill_reload');
            if (!reloadFlag) {
              sessionStorage.setItem('biqc_cache_kill_reload', Date.now().toString());
              console.error('%c CALIBRATION: Executing emergency hard reload', 'color:red;font-weight:bold');
              window.location.reload(true);
              return;
            }
            sessionStorage.removeItem('biqc_cache_kill_reload');
            calibrationComplete = true;
          } else {
            console.warn(`[CALIBRATION ROUTING] Backend error ${calRes.status} → fail-open to READY`);
            calibrationComplete = true;
          }
        } catch (e) {
          console.warn(`[CALIBRATION ROUTING] Fetch failed: ${e.message} → fail-open to READY`);
          calibrationComplete = true;
        }

        if (cancelled) return;

        console.log(`[CALIBRATION ROUTING] Decision: ${calibrationComplete ? 'READY (calibrated)' : 'NEEDS_CALIBRATION'}`);

        if (!calibrationComplete) {
          setAuthState(AUTH_STATE.NEEDS_CALIBRATION);
          return;
        }

        // Calibration complete — now fetch onboarding status ONCE
        try {
          const obRes = await fetch(`${getBackendUrl()}/api/onboarding/status`, {
            method: 'GET', headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            }
          });
          if (obRes.ok) {
            const obData = await obRes.json();
            if (!cancelled) {
              setOnboardingStatus({
                completed: obData.completed === true,
                currentStep: obData.current_step || 0,
                businessStage: obData.business_stage || null,
              });
            }
          } else {
            // Fail open: treat as complete to avoid blocking
            if (!cancelled) setOnboardingStatus({ completed: true });
          }
        } catch {
          if (!cancelled) setOnboardingStatus({ completed: true });
        }

        if (!cancelled) setAuthState(AUTH_STATE.READY);

      } catch (err) {
        console.error('[AUTH BOOTSTRAP ERROR]', err.message);
        if (!cancelled) setAuthState(AUTH_STATE.READY);
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
      return null;
    }
  };

  const value = {
    user,
    session,
    loading,
    authHydrated,
    authState,
    onboardingStatus,
    markOnboardingComplete,
    deferOnboarding,
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
