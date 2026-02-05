import React from "react";
import { Navigate } from "react-router-dom";
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
  const { authState } = useSupabaseAuth();

  if (authState === AUTH_STATE.LOADING) {
    return <LoadingScreen />;
  }

  // ✅ NEEDS_CALIBRATION IS NOT AN ERROR
  if (authState === AUTH_STATE.NEEDS_CALIBRATION) {
    return <Navigate to="/calibration" replace />;
  }

  // ❌ AuthError ONLY for real auth failures
  if (authState === AUTH_STATE.ERROR) {
    return <AuthError />;
  }

  return children;
}

export { LoadingScreen, AuthError };