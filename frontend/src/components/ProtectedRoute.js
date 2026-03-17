import React, { useState, useEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSupabaseAuth, AUTH_STATE } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";

const ADMIN_ROLES = ['admin', 'superadmin'];

/**
 * Synchronously check sessionStorage for cached auth state.
 * This prevents the calibration loop for completed users on page refresh.
 */
const getCachedAuthState = (userId) => {
  if (!userId) return null;
  try {
    const cached = sessionStorage.getItem(`biqc_auth_bootstrap_${userId}`);
    if (cached) {
      const { state, ts } = JSON.parse(cached);
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - ts < CACHE_TTL) {
        return state;
      }
    }
  } catch {}
  return null;
};

const LoadingScreen = () => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--biqc-bg)' }} data-testid="auth-loading-screen">
      <style>{`
        @keyframes biqcPulse{0%,100%{opacity:0.4;transform:scale(0.95)}50%{opacity:1;transform:scale(1.05)}}
        @keyframes biqcFade{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes biqcBar{0%{width:0}100%{width:100%}}
      `}</style>
      <div className="text-center space-y-6">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: '#FF6A00', animation: 'biqcPulse 2s ease-in-out infinite' }}>
          <span className="text-white font-bold text-xl" style={{ fontFamily: "'JetBrains Mono', monospace" }}>B</span>
        </div>
        <div style={{ animation: 'biqcFade 0.8s ease-out' }}>
          <p className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Good {greeting}.
          </p>
          <p className="text-sm text-[#64748B] mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
            Establishing secure connection...
          </p>
        </div>
        <div className="w-48 mx-auto">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: '#243140' }}>
            <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #FF6A00, #FF8C33)', animation: 'biqcBar 3s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

const AuthError = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#050505]" data-testid="auth-error-screen">
    <div className="text-center space-y-3">
      <p className="text-xs tracking-widest text-red-400/60 uppercase">Connection interrupted</p>
      <p className="text-sm text-white/50">Unable to establish session. Please try again.</p>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-2 px-5 py-2 border border-white/15 text-white/60 text-xs tracking-wider hover:bg-white/5 transition-colors"
      >
        Reconnect
      </button>
    </div>
  </div>
);

const AccessDenied = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#050505]" data-testid="access-denied-screen">
    <div className="text-center space-y-3">
      <p className="text-xs tracking-widest text-amber-400/60 uppercase">Access restricted</p>
      <p className="text-sm text-white/50">You do not have permission to view this page.</p>
      <a 
        href="/advisor"
        className="inline-block mt-2 px-5 py-2 border border-white/15 text-white/60 text-xs tracking-wider hover:bg-white/5 transition-colors"
      >
        Return to Intelligence Platform
      </a>
    </div>
  </div>
);

// Paths exempt from the onboarding gate
const ONBOARDING_EXEMPT_PATHS = [
  '/onboarding', '/onboarding-decision', '/profile-import',
  '/calibration', '/settings', '/business-profile'
];

/**
 * ProtectedRoute — Deterministic, loop-proof route guard
 * 
 * Onboarding state is read from SupabaseAuthContext (fetched once per session).
 * No API call is made by ProtectedRoute — it consumes cached state only.
 */
export default function ProtectedRoute({ children, adminOnly }) {
  const { authState, user, session, onboardingStatus } = useSupabaseAuth();
  const location = useLocation();
  const [adminChecked, setAdminChecked] = useState(!adminOnly);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authGraceStart] = useState(() => Date.now());
  const isCalibrationRoute = location.pathname === '/calibration';

  const hasStoredAuth = useMemo(() => {
    try {
      if (localStorage.getItem('biqc-auth')) return true;
      return Object.keys(localStorage).some((key) => key.startsWith('sb-') && Boolean(localStorage.getItem(key)));
    } catch {
      return false;
    }
  }, []);

  // Check admin role from backend when adminOnly is true
  useEffect(() => {
    if (!adminOnly || authState !== AUTH_STATE.READY || !user) return;
    
    let cancelled = false;
    const checkAdmin = async () => {
      try {
        const res = await apiClient.get('/auth/supabase/me');
        const role = res.data?.user?.role;
        const email = res.data?.user?.email;
        if (!cancelled) setIsAdmin(ADMIN_ROLES.includes(role) || email === 'andre@thestrategysquad.com.au');
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setAdminChecked(true);
      }
    };
    
    checkAdmin();
    return () => { cancelled = true; };
  }, [adminOnly, authState, user]);

  // Still loading — but if we have a user/session, show content (don't block navigation)
  if (authState === AUTH_STATE.LOADING) {
    if (user || session) {
      // CALIBRATION LOOP FIX: Check sessionStorage cache synchronously to determine
      // if user is READY before bootstrap completes. This prevents completed users
      // from getting stuck on /calibration loading screen.
      const userId = user?.id || session?.user?.id;
      const cachedState = getCachedAuthState(userId);
      
      if (isCalibrationRoute) {
        // If cached state shows READY, redirect immediately
        // If cached state shows NEEDS_CALIBRATION, allow calibration page
        // If no cache (new user or expired), redirect to /advisor as safe default
        // (NEEDS_CALIBRATION users will be redirected back after bootstrap)
        if (cachedState === AUTH_STATE.NEEDS_CALIBRATION) {
          return children; // Allow calibration page
        }
        // For READY or no cache, redirect to /advisor
        return <Navigate to="/advisor" replace />;
      }
      // We have a session — render children while bootstrap completes in background
      // This prevents the loading screen from flashing on every page navigation
    } else {
      return <LoadingScreen />;
    }
  }

  // No session → login
  if (!user && !session) {
    // Grace window to avoid sign-in redirect loops during transient auth hydration.
    if (hasStoredAuth && Date.now() - authGraceStart < 8000) {
      return <LoadingScreen />;
    }
    return <Navigate to="/login-supabase" replace />;
  }

  // Error → show error screen
  if (authState === AUTH_STATE.ERROR) {
    return <AuthError />;
  }

  // NEEDS_CALIBRATION → redirect to /calibration FIRST (before READY check)
  if (authState === AUTH_STATE.NEEDS_CALIBRATION) {
    const allowedPaths = ['/calibration', '/settings', '/onboarding', '/onboarding-decision', '/profile-import', '/admin', '/support-admin', '/observability', '/admin/prompt-lab'];
    if (allowedPaths.some(p => location.pathname.startsWith(p))) {
      return children;
    }
    return <Navigate to="/calibration" replace />;
  }

  // READY or has session → enforce gates
  if (authState === AUTH_STATE.READY || user || session) {
    if (isCalibrationRoute) {
      return <Navigate to="/advisor" replace />;
    }

    // Admin pages bypass onboarding/calibration checks entirely
    const ADMIN_PATHS = ['/admin', '/support-admin', '/observability', '/admin/prompt-lab'];
    const isAdminPath = ADMIN_PATHS.some(p => location.pathname.startsWith(p));

    // Admin check
    if (adminOnly) {
      if (!adminChecked) return <LoadingScreen />;
      if (!isAdmin) return <AccessDenied />;
      return children;
    }

    // Admin paths always pass through
    if (isAdminPath) return children;

    // Onboarding check — if null, default to showing content (don't block with loading screen)
    if (onboardingStatus === null) {
      return children;
    }
    
    if (!onboardingStatus.completed && !ONBOARDING_EXEMPT_PATHS.includes(location.pathname)) {
      return <Navigate to="/onboarding" replace />;
    }
    
    return children;
  }

  return children;
}

export { LoadingScreen, AuthError };
