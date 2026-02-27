import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { checkRouteAccess } from '../lib/tierResolver';

export default function TierGate({ children }) {
  const { user } = useSupabaseAuth();
  const location = useLocation();

  if (!user) return children;

  const result = checkRouteAccess(location.pathname, user);

  if (!result.allowed) {
    return <Navigate to={result.redirect || `/subscribe?from=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
}
