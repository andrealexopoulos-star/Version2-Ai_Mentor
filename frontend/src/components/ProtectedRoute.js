import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSupabaseAuth, AUTH_STATE } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";

const ADMIN_ROLES = ['admin', 'superadmin'];

const LoadingScreen = () => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]" data-testid="auth-loading-screen">
      <div className="text-center space-y-4">
        <div className="w-6 h-6 border border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-white/40 tracking-wide">
          Good {greeting}. Connecting to BIQc...
        </p>
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
        Return to Dashboard
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

  // Check admin role from backend when adminOnly is true
  useEffect(() => {
    if (!adminOnly || authState !== AUTH_STATE.READY || !user) return;
    
    let cancelled = false;
    const checkAdmin = async () => {
      try {
        const res = await apiClient.get('/auth/supabase/me');
        const role = res.data?.user?.role;
        if (!cancelled) setIsAdmin(ADMIN_ROLES.includes(role));
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setAdminChecked(true);
      }
    };
    
    checkAdmin();
    return () => { cancelled = true; };
  }, [adminOnly, authState, user]);

  // Still loading
  if (authState === AUTH_STATE.LOADING) {
    return <LoadingScreen />;
  }

  // No session → login
  if (!user && !session) {
    return <Navigate to="/login-supabase" replace />;
  }

  // Error → show error screen
  if (authState === AUTH_STATE.ERROR) {
    return <AuthError />;
  }

  // READY → enforce gates
  if (authState === AUTH_STATE.READY) {
    // Admin check
    if (adminOnly) {
      if (!adminChecked) return <LoadingScreen />;
      if (!isAdmin) return <AccessDenied />;
    }

    // Onboarding check — uses cached state from context (no API call here)
    if (onboardingStatus === null) {
      // Bootstrap hasn't completed the onboarding fetch yet
      return <LoadingScreen />;
    }
    
    if (!onboardingStatus.completed && !ONBOARDING_EXEMPT_PATHS.includes(location.pathname)) {
      return <Navigate to="/onboarding" replace />;
    }
    
    return children;
  }

  // NEEDS_CALIBRATION → redirect to /calibration
  if (authState === AUTH_STATE.NEEDS_CALIBRATION) {
    const allowedPaths = ['/calibration', '/settings', '/onboarding', '/onboarding-decision', '/profile-import'];
    if (allowedPaths.includes(location.pathname)) {
      return children;
    }
    return <Navigate to="/calibration" replace />;
  }

  return children;
}

export { LoadingScreen, AuthError };
