import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { checkRouteAccess } from '../lib/tierResolver';

export default function TierGate({ children }) {
  const { user } = useSupabaseAuth();
  const location = useLocation();
  const access = checkRouteAccess(location.pathname, user);
  if (!access.allowed) {
    return <Navigate to={access.redirect || '/upgrade'} replace />;
  }
  return children;
}
