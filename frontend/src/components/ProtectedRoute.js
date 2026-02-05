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
      <h2 className="text-lg font-semibold">Authentication error</h2>
      <p className="text-sm text-gray-500">Please refresh and try again.</p>
    </div>
  </div>
);

export default function ProtectedRoute({ children }) {
  const { authState, user, session } = useSupabaseAuth();
  const location = useLocation();

  if (authState === AUTH_STATE.LOADING) {
    return <LoadingScreen />;
  }

  // No session at all → redirect to login (not an error, just unauthenticated)
  if (!user && !session) {
    return <Navigate to="/login-supabase" replace />;
  }

  // NEEDS_CALIBRATION: allow /calibration page to render, redirect all others
  if (authState === AUTH_STATE.NEEDS_CALIBRATION) {
    if (location.pathname === '/calibration') {
      return children;
    }
    return <Navigate to="/calibration" replace />;
  }

  // Real auth error (has session but bootstrap failed)
  if (authState === AUTH_STATE.ERROR) {
    return <AuthError />;
  }

  return children;
}

export { LoadingScreen, AuthError };