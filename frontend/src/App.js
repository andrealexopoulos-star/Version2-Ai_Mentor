import "@/App.css";
import "@/mobile-fixes.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SupabaseAuthProvider, useSupabaseAuth } from "./context/SupabaseAuthContext";
import { MobileDrawerProvider } from "./context/MobileDrawerContext";
import { Toaster } from "./components/ui/sonner";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useEffect } from 'react';
import InstallPrompt from './components/InstallPrompt';

// Pages
import Landing from "./pages/Landing";
import LandingIntelligent from "./pages/LandingIntelligent";
import LoginSupabase from "./pages/LoginSupabase";
import RegisterSupabase from "./pages/RegisterSupabase";
import AuthCallbackSupabase from "./pages/AuthCallbackSupabase";
import Dashboard from "./pages/Dashboard";
import Advisor from "./pages/Advisor";
import AdvisorWatchtower from "./pages/AdvisorWatchtower";
import Analysis from "./pages/Analysis";
import SOPGenerator from "./pages/SOPGenerator";
import MarketAnalysis from "./pages/MarketAnalysis";
import Documents from "./pages/Documents";
import DocumentView from "./pages/DocumentView";
import AdminDashboard from "./pages/AdminDashboard";
import Settings from "./pages/Settings";
import Diagnosis from "./pages/Diagnosis";
import DataCenter from "./pages/DataCenter";
import BusinessProfile from "./pages/BusinessProfile";
import OpsAdvisoryCentre from "./pages/OpsAdvisoryCentre";
import Pricing from "./pages/Pricing";
import Integrations from "./pages/Integrations";
import ConnectEmail from "./pages/ConnectEmail";
import TermsAndConditions from "./pages/TermsAndConditions";
import OnboardingWizard from "./pages/OnboardingWizard";
import OnboardingDecision from "./pages/OnboardingDecision";
import CalibrationAdvisor from "./pages/CalibrationAdvisor";
import IntelCentre from "./pages/IntelCentre";
import ProfileImport from "./pages/ProfileImport";
import OutlookTest from "./pages/OutlookTest";
import EmailInbox from "./pages/EmailInbox";
import CalendarView from "./pages/CalendarView";
import MySoundBoard from "./pages/MySoundBoard";
import AuthDebug from "./pages/AuthDebug";
import GmailTest from "./pages/GmailTest";

// Protected Route Component - Supabase Auth Only
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, session, loading, authHydrated } = useSupabaseAuth();

  // Debug logging
  useEffect(() => {
    console.log('[ProtectedRoute] Auth state:', { 
      loading, 
      authHydrated,
      hasUser: !!user, 
      hasSession: !!session,
      sessionEmail: session?.user?.email 
    });
  }, [loading, user, session, authHydrated]);

  // TASK 1: Wait for auth hydration before making routing decisions
  if (loading || !authHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  const isAuthenticated = user || session;

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to login');
    return <Navigate to="/login-supabase" replace />;
  }

  // Check admin status if required
  if (adminOnly && user && !user.is_master_account) {
    return <Navigate to="/advisor" replace />;
  }

  return children;
};

// Public Route (redirect to advisor if logged in) - Supabase Auth Only
const PublicRoute = ({ children }) => {
  const { user, session, loading } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  const isAuthenticated = user || session;

  if (isAuthenticated) {
    return <Navigate to="/advisor" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes - Landing page accessible to everyone */}
      <Route path="/" element={<LandingIntelligent />} />
      <Route path="/landing-original" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/terms" element={<TermsAndConditions />} />
      
      {/* Auth Routes - Supabase Only */}
      <Route path="/login-supabase" element={<LoginSupabase />} />
      <Route path="/register-supabase" element={<RegisterSupabase />} />
      <Route path="/auth/callback" element={<AuthCallbackSupabase />} />
      <Route path="/auth-debug" element={<AuthDebug />} />
      
      {/* Legacy routes - redirect to Supabase */}
      <Route path="/login" element={<Navigate to="/login-supabase" replace />} />
      <Route path="/register" element={<Navigate to="/register-supabase" replace />} />

      {/* Onboarding */}
      <Route path="/onboarding-decision" element={<ProtectedRoute><OnboardingDecision /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
      <Route path="/profile-import" element={<ProtectedRoute><ProfileImport /></ProtectedRoute>} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<Navigate to="/advisor" replace />} />
      <Route path="/advisor" element={<ProtectedRoute><AdvisorWatchtower /></ProtectedRoute>} />
      <Route path="/advisor-legacy" element={<ProtectedRoute><Advisor /></ProtectedRoute>} />
      <Route path="/business-profile" element={<ProtectedRoute><BusinessProfile /></ProtectedRoute>} />
      <Route path="/oac" element={<ProtectedRoute><OpsAdvisoryCentre /></ProtectedRoute>} />
      <Route path="/intel-centre" element={<ProtectedRoute><IntelCentre /></ProtectedRoute>} />
      <Route path="/outlook-test" element={<ProtectedRoute><OutlookTest /></ProtectedRoute>} />
      <Route path="/gmail-test" element={<ProtectedRoute><GmailTest /></ProtectedRoute>} />
      <Route path="/diagnosis" element={<ProtectedRoute><Diagnosis /></ProtectedRoute>} />
      <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
      <Route path="/market-analysis" element={<ProtectedRoute><MarketAnalysis /></ProtectedRoute>} />
      <Route path="/sop-generator" element={<ProtectedRoute><SOPGenerator /></ProtectedRoute>} />
      <Route path="/data-center" element={<ProtectedRoute><DataCenter /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/documents/:id" element={<ProtectedRoute><DocumentView /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
      <Route path="/connect-email" element={<ProtectedRoute><ConnectEmail /></ProtectedRoute>} />
      <Route path="/email-inbox" element={<ProtectedRoute><EmailInbox /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
      <Route path="/soundboard" element={<ProtectedRoute><MySoundBoard /></ProtectedRoute>} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />

      {/* Catch all - redirect to dashboard or landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  
  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then((registration) => {
            console.log('✅ Service Worker registered:', registration);
          })
          .catch((error) => {
            console.log('❌ Service Worker registration failed:', error);
          });
      });
    }
  }, []);
  
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <SupabaseAuthProvider>
          <MobileDrawerProvider>
            <InstallPrompt />
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </MobileDrawerProvider>
        </SupabaseAuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
