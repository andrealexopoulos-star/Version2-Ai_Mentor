import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getBackendUrl } from '../config/urls';
import { trackEvent, identifyUser, EVENTS } from '../lib/analytics';
import { isPrivilegedUser } from '../lib/privilegedUser';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
/** True when real Supabase project URL + anon key are set (required for OAuth and session). */
export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Dev only: bypass login and act as a fake user when REACT_APP_DEV_BYPASS_AUTH=1 and NODE_ENV=development */
const devBypassAuth =
  typeof process !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  (process.env.REACT_APP_DEV_BYPASS_AUTH === '1' || process.env.REACT_APP_DEV_BYPASS_AUTH === 'true');
export const DEV_BYPASS_SECRET =
  (typeof process !== 'undefined' && process.env.REACT_APP_DEV_BYPASS_SECRET) || 'dev-bypass-local';
export const isDevBypassAuth = () => devBypassAuth;

export const SUPABASE_SETUP_MESSAGE =
  'Supabase is not configured. In the frontend folder, copy .env.example to .env and set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY from your Supabase project (Settings → API). Restart npm start, then sign in again.';

export const AUTH_STATE = {
  LOADING: 'LOADING',
  NEEDS_CALIBRATION: 'NEEDS_CALIBRATION',
  READY: 'READY',
  ERROR: 'ERROR',
};

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'biqc-auth'
      }
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      auth: { persistSession: false, storageKey: 'biqc-auth-placeholder' }
    });

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const clearClientAuthCachesForFreshLogin = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('biqc-auth');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    }
  } catch {}
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('biqc_auth_bootstrap_')) sessionStorage.removeItem(key);
    }
    sessionStorage.removeItem('biqc_auth_recent_login');
    sessionStorage.removeItem('biqc_soundboard_handoff');
    sessionStorage.removeItem('biqc_soundboard_prefill');
    sessionStorage.removeItem('biqc_scan_usage_cache');
  } catch {}
};

const clearSessionCachesForOtherUsers = (activeUserId) => {
  if (typeof window === 'undefined') return;
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('biqc_auth_bootstrap_') && key !== `biqc_auth_bootstrap_${activeUserId}`) {
        sessionStorage.removeItem(key);
      }
    }
    sessionStorage.removeItem('biqc_soundboard_handoff');
    sessionStorage.removeItem('biqc_soundboard_prefill');
    sessionStorage.removeItem('biqc_scan_usage_cache');
  } catch {}
};

const getStoredSessionCandidate = (expectedUserId = null) => {
  if (typeof window === 'undefined') return null;
  const extractSession = (parsed) => {
    if (!parsed) return null;
    const session = parsed?.currentSession || parsed?.session || parsed;
    if (session?.access_token && session?.refresh_token) return session;
    return null;
  };

  try {
    const primary = extractSession(JSON.parse(localStorage.getItem('biqc-auth') || 'null'));
    if (primary) {
      if (!expectedUserId || primary?.user?.id === expectedUserId) return primary;
    }
  } catch {}

  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('sb-')) continue;
      const parsed = extractSession(JSON.parse(localStorage.getItem(key) || 'null'));
      if (!parsed) continue;
      if (!expectedUserId || parsed?.user?.id === expectedUserId) return parsed;
    }
  } catch {}

  return null;
};

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
        if (!hasSupabaseConfig) {
          if (isMounted) {
            setLoading(false);
            setInitialized(true);
            setAuthHydrated(true);
            if (devBypassAuth) {
              setUser({
                id: 'dev-bypass-user',
                email: 'dev@local',
                full_name: 'Dev User',
                subscription_tier: 'starter',
                role: 'user',
              });
              setSession({ user: { id: 'dev-bypass-user', email: 'dev@local' } });
              setOnboardingStatus({ completed: true });
            }
            setAuthState(AUTH_STATE.READY);
          }
          return;
        }
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
        
        let currentSession = sessionData?.session;
        if (!currentSession) {
          const storedSession = getStoredSessionCandidate();
          if (storedSession?.access_token && storedSession?.refresh_token) {
            try {
              const { data } = await supabase.auth.setSession({
                access_token: storedSession.access_token,
                refresh_token: storedSession.refresh_token,
              });
              currentSession = data?.session || storedSession;
            } catch {}
          }
        }
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) {
        // Reset authState to LOADING on new login so ProtectedRoute/PublicRoute
        // wait for the calibration check before routing the user
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const isNewLogin = lastBootstrapUserId.current !== session.user.id;
          if (isNewLogin) {
            setAuthState(AUTH_STATE.LOADING);
            clearSessionCachesForOtherUsers(session.user.id);
            trackEvent(EVENTS.USER_LOGIN, { method: 'supabase' });
            identifyUser(session.user.id, { email: session.user.email });
          }
        }
        fetchUserProfile(session.user.id, session);
      } else {
        // Guard against transient null sessions during refresh/navigation races.
        if (event !== 'SIGNED_OUT' && event !== 'USER_DELETED') {
          try {
            const { data } = await supabase.auth.getSession();
            if (data?.session?.user) {
              setSession(data.session);
              fetchUserProfile(data.session.user.id, data.session);
              return;
            }
            const storedSession = getStoredSessionCandidate();
            if (storedSession?.access_token && storedSession?.refresh_token) {
              const restored = await supabase.auth.setSession({
                access_token: storedSession.access_token,
                refresh_token: storedSession.refresh_token,
              });
              if (restored?.data?.session?.user) {
                setSession(restored.data.session);
                fetchUserProfile(restored.data.session.user.id, restored.data.session);
                return;
              }
            }
          } catch {}
        }

        setUser(null);
        setOnboardingStatus(null);
        lastBootstrapUserId.current = null;
        setAuthState(AUTH_STATE.LOADING);
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
          is_master_account: isPrivilegedUser({ email: existingSession.user.email })
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
    if (!hasSupabaseConfig) {
      throw new Error(SUPABASE_SETUP_MESSAGE);
    }
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: metadata }
    });
    if (error) throw error;
    // IMPORTANT: Do not write to protected profile tables from client-side signup.
    // Server-side auth verification/bootstrap handles users + cognitive profile creation.
    return data;
  };

  const signIn = async (email, password) => {
    if (!hasSupabaseConfig) {
      throw new Error(SUPABASE_SETUP_MESSAGE);
    }
    clearClientAuthCachesForFreshLogin();
    const response = await fetch(`${getBackendUrl()}/api/auth/supabase/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.detail || payload?.message || 'Login failed';
      throw new Error(message);
    }

    const accessToken = payload?.session?.access_token;
    const refreshToken = payload?.session?.refresh_token;
    if (!accessToken || !refreshToken) {
      throw new Error('Authentication session could not be established');
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data;
  };

  const signInWithOAuth = async (provider) => {
    if (!hasSupabaseConfig) {
      throw new Error(SUPABASE_SETUP_MESSAGE);
    }
    clearClientAuthCachesForFreshLogin();
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
      // Clear bootstrap cache on sign-out
      const userId = session?.user?.id;
      if (userId) { try { sessionStorage.removeItem(`biqc_auth_bootstrap_${userId}`); } catch {} }
      try { sessionStorage.removeItem('biqc_auth_recent_login'); } catch {}
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

  // Clear the auth bootstrap cache — called by calibration on completion so the next
  // full-page navigation re-fetches calibration status instead of reading stale cache.
  const clearBootstrapCache = useCallback(() => {
    const userId = session?.user?.id;
    if (userId) {
      try { sessionStorage.removeItem(`biqc_auth_bootstrap_${userId}`); } catch {}
    }
    lastBootstrapUserId.current = null;
  }, [session]);

  // Track which user ID we've already bootstrapped for.
  // Prevents re-running calibration check on token refresh (same user, new token).
  const lastBootstrapUserId = useRef(null);

  // CALIBRATION + ONBOARDING CHECK — runs once after auth hydration
  useEffect(() => {
    if (!authHydrated) return;

    const currentUserId = session?.user?.id || null;

    // Skip re-bootstrap if we've already resolved this exact user session.
    // Token refreshes change the session object but keep the same user ID.
    if (lastBootstrapUserId.current === currentUserId && currentUserId !== null) {
      return;
    }

    // ── FAST PATH: sessionStorage cache (avoids 3 API calls on full page reload) ──
    const CACHE_KEY = `biqc_auth_bootstrap_${currentUserId}`;
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    if (currentUserId) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { state, onboarding, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            lastBootstrapUserId.current = currentUserId;
            if (onboarding) setOnboardingStatus(onboarding);
            setAuthState(state || AUTH_STATE.READY);
            return; // Instant — no API calls needed
          }
        }
      } catch {}
    }

    let cancelled = false;

    const bootstrap = async () => {
      let bootstrapHardTimeout = null;
      try {
        setAuthState(AUTH_STATE.LOADING);

        // Fail-open guard: never allow LOADING to hang forever.
        bootstrapHardTimeout = setTimeout(() => {
          if (!cancelled) {
            console.warn('[AUTH BOOTSTRAP] Timeout reached; fail-open to READY');
            lastBootstrapUserId.current = currentUserId;
            setAuthState(AUTH_STATE.READY);
          }
        }, 12000);

        const activeSession = session || (await supabase.auth.getSession()).data.session;
        if (!activeSession?.access_token) {
          if (!cancelled) {
            lastBootstrapUserId.current = null;
            setAuthState(AUTH_STATE.READY);
          }
          return;
        }

        const accessToken = activeSession.access_token;
        let calibrationComplete = false;

        // SINGLE CHECK: backend /api/calibration/status (service_role key, RLS-safe)
        try {
          const calUrl = `${getBackendUrl()}/api/calibration/status?_t=${Date.now()}`;
          const calRes = await fetchWithTimeout(calUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            }
          }, 7000);
          const contentType = calRes.headers.get('content-type') || '';
          if (calRes.ok && contentType.includes('application/json')) {
            const cal = await calRes.json();
            calibrationComplete = cal.status === 'COMPLETE';
          } else if (calRes.ok && !contentType.includes('application/json')) {
            console.warn(`[CALIBRATION ROUTING] Got HTML instead of JSON (content-type: ${contentType})`);
            // HTML response = likely nginx/proxy error, not a calibration state. Fail-closed.
            calibrationComplete = false;
          } else if (calRes.status === 401 || calRes.status === 403) {
            // Auth error — session may not have propagated yet. Retry once.
            console.warn(`[CALIBRATION ROUTING] Auth error ${calRes.status} — retrying once`);
            await new Promise(r => setTimeout(r, 1500));
            const retryRes = await fetchWithTimeout(calUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
              }
            }, 7000);
            if (retryRes.ok) {
              const retryCal = await retryRes.json();
              calibrationComplete = retryCal.status === 'COMPLETE';
            } else {
              // Still failing — new user, let calibration flow handle it
              calibrationComplete = false;
            }
          } else {
            console.warn(`[CALIBRATION ROUTING] Backend error ${calRes.status}`);
            // Safer default for onboarding: if status cannot be verified, force calibration path.
            calibrationComplete = false;
          }
        } catch (e) {
          console.warn(`[CALIBRATION ROUTING] Fetch failed: ${e.message} → force NEEDS_CALIBRATION`);
          calibrationComplete = false;
        }

        if (cancelled) return;

        // console.log(`[CALIBRATION ROUTING] Decision: ${calibrationComplete ? 'READY (calibrated)' : 'NEEDS_CALIBRATION'}`);

        // Mark this user as bootstrapped so token refreshes don't re-trigger
        lastBootstrapUserId.current = activeSession.user.id;

        if (!calibrationComplete) {
          setAuthState(AUTH_STATE.NEEDS_CALIBRATION);
          return;
        }

        // Calibration complete — now fetch onboarding status ONCE
        let obStatus = { completed: true }; // default fail-open
        try {
          const obRes = await fetchWithTimeout(`${getBackendUrl()}/api/onboarding/status`, {
            method: 'GET', headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            }
          }, 7000);
          if (obRes.ok) {
            const obData = await obRes.json();
            obStatus = {
              completed: obData.completed === true,
              currentStep: obData.current_step || 0,
              businessStage: obData.business_stage || null,
            };
            if (!cancelled) setOnboardingStatus(obStatus);
          } else {
            if (!cancelled) setOnboardingStatus(obStatus);
          }
        } catch {
          if (!cancelled) setOnboardingStatus(obStatus);
        }

        if (!cancelled) {
          // Cache bootstrap result with actual onboarding status
          if (currentUserId) {
            try {
              sessionStorage.setItem(`biqc_auth_bootstrap_${currentUserId}`, JSON.stringify({
                state: AUTH_STATE.READY,
                onboarding: obStatus, // actual status, not hardcoded
                ts: Date.now(),
              }));
            } catch {}
          }
          setAuthState(AUTH_STATE.READY);
        }

      } catch (err) {
        console.error('[AUTH BOOTSTRAP ERROR]', err.message);
        if (!cancelled) setAuthState(AUTH_STATE.READY);
      } finally {
        if (bootstrapHardTimeout) clearTimeout(bootstrapHardTimeout);
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
    hasSupabaseConfig,
    markOnboardingComplete,
    deferOnboarding,
    clearBootstrapCache,
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
