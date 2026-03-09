import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { checkRouteAccess } from '../lib/tierResolver';

export default function TierGate({ children }) {
  // All gates removed — full platform access for all users
  return children;
}
