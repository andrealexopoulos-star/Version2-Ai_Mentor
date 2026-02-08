import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSupabaseAuth, AUTH_STATE } from "../context/SupabaseAuthContext";

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center" data-testid="auth-loading-screen">
    <div className="spinner" />
  </div>
);

const AuthError = () => (
  <div className="min-h-screen flex items-center justify-center" data-testid="auth-error-screen">
    <div className="text-center text-gray-700">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-500 mt-2">Please refresh the page to try again.</p>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
      >
        Refresh
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
