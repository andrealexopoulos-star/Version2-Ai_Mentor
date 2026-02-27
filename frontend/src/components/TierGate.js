/**
 * TierGate — Route guard component.
 * Wraps protected routes. Redirects to /subscribe if tier insufficient.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { checkRouteAccess } from '../lib/tierResolver';

export default function TierGate({ children, requiredTier }) {
  const { user } = useSupabaseAuth();
  const location = useLocation();

  if (!user) return children; // Let ProtectedRoute handle auth

  const result = requiredTier
    ? { allowed: require('../lib/tierResolver').hasAccess(require('../lib/tierResolver').resolveTier(user), requiredTier), redirect: `/subscribe?from=${encodeURIComponent(location.pathname)}` }
    : checkRouteAccess(location.pathname, user);

  if (!result.allowed) {
    return <Navigate to={result.redirect || `/subscribe?from=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
}
