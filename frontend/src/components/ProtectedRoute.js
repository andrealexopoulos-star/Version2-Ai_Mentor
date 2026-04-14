import React, { useState, useEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSupabaseAuth, AUTH_STATE } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";
import { isPrivilegedUser } from "../lib/privilegedUser";

const SUPER_ADMIN_ROLES = ['superadmin', 'super_admin'];

const getRecentLoginTimestamp = () => {
  try {
    const raw = sessionStorage.getItem('biqc_auth_recent_login');
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
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
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: '#E85D00', animation: 'biqcPulse 2s ease-in-out infinite' }}>
          <span className="text-white font-bold text-xl" style={{ fontFamily: "var(--font-mono)" }}>B</span>
        </div>
        <div style={{ animation: 'biqcFade 0.8s ease-out' }}>
          <p className="text-lg font-semibold text-[var(--ink-display)]" style={{ fontFamily: "var(--font-display)" }}>
            Good {greeting}.
          </p>
          <p className="text-sm text-[var(--ink-muted)] mt-1" style={{ fontFamily: "var(--font-ui)" }}>
            Establishing secure connection...
          </p>
        </div>
        <div className="w-48 mx-auto">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(140,170,210,0.15)' }}>
            <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #E85D00, #FF8C33)', animation: 'biqcBar 3s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

const AuthError = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--canvas-app)]" data-testid="auth-error-screen">
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
  <div className="min-h-screen flex items-center justify-center bg-[var(--canvas-app)]" data-testid="access-denied-screen">
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
  const recentLoginTs = getRecentLoginTimestamp();

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
        const res = await apiClient.get('/auth/me');
        const role = String(res.data?.user?.role || '').toLowerCase();
        const email = res.data?.user?.email;
        if (!cancelled) {
          setIsAdmin(
            SUPER_ADMIN_ROLES.includes(role) ||
            isPrivilegedUser({ email: email || user?.email || '' })
          );
        }
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
      // During bootstrap, never hard-redirect away from /calibration.
      // Redirecting here can block fresh users from reaching the calibration funnel.
      if (isCalibrationRoute) return children;
      // We have a session — render children while bootstrap completes in background
      // This prevents the loading screen from flashing on every page navigation
    } else {
      return <LoadingScreen />;
    }
  }

  // No session → login
  if (!user && !session) {
    // Grace window to avoid sign-in redirect loops during transient auth hydration.
    if ((hasStoredAuth && Date.now() - authGraceStart < 20000) || (recentLoginTs && Date.now() - recentLoginTs < 20000)) {
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
    // Allow /calibration for READY users so explicit recalibration is always possible.
    // Redirecting calibrated users away from this route prevents recovery when
    // calibration state falls out of sync and blocks the new-user onboarding funnel.
    if (isCalibrationRoute) return children;

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
