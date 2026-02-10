import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSupabaseAuth, AUTH_STATE } from "../context/SupabaseAuthContext";

const LoadingScreen = () => {
  // Determine greeting based on time of day
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

/**
 * ProtectedRoute — Deterministic, loop-proof route guard
 * 
 * RULES:
 * 1. LOADING → spinner
 * 2. No session → login
 * 3. ERROR → error screen (NEVER redirect to calibration)
 * 4. READY → render children (calibration complete or legacy complete)
 * 5. NEEDS_CALIBRATION → redirect to /calibration (ONLY for uncalibrated users)
 *    Exception: /calibration itself is always allowed
 */
export default function ProtectedRoute({ children }) {
  const { authState, user, session } = useSupabaseAuth();
  const location = useLocation();

  // Still loading
  if (authState === AUTH_STATE.LOADING) {
    return <LoadingScreen />;
  }

  // No session → login
  if (!user && !session) {
    return <Navigate to="/login-supabase" replace />;
  }

  // Error → show error screen, NEVER redirect
  if (authState === AUTH_STATE.ERROR) {
    return <AuthError />;
  }

  // READY → render (calibration is complete)
  if (authState === AUTH_STATE.READY) {
    return children;
  }

  // NEEDS_CALIBRATION → redirect to /calibration
  // Exception: allow /calibration and /settings to render
  if (authState === AUTH_STATE.NEEDS_CALIBRATION) {
    if (location.pathname === '/calibration' || location.pathname === '/settings') {
      return children;
    }
    return <Navigate to="/calibration" replace />;
  }

  // Fallback: render children (defensive — should never reach here)
  return children;
}

export { LoadingScreen, AuthError };
