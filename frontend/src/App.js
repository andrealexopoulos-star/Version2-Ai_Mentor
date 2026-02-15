import "@/App.css";
import "@/mobile-fixes.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SupabaseAuthProvider, useSupabaseAuth, AUTH_STATE } from "./context/SupabaseAuthContext";
import ProtectedRoute, { LoadingScreen } from "./components/ProtectedRoute";
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
import Watchtower from './components/Watchtower';
import WarRoomConsole from './components/WarRoomConsole';
import BoardRoom from './components/BoardRoom';
import IntelligenceBaseline from './pages/IntelligenceBaseline';
import OperatorDashboard from './pages/OperatorDashboard';
import PromptLab from './pages/PromptLab';

// Public Route — redirect authenticated users to BIQC Insights
const PublicRoute = ({ children }) => {
  const { user, session, loading, authState } = useSupabaseAuth();

  if (authState === AUTH_STATE.LOADING || loading) {
    return <LoadingScreen />;
  }

  const isAuthenticated = user || session;

  if (isAuthenticated && authState === AUTH_STATE.NEEDS_CALIBRATION) {
    return <Navigate to="/calibration" replace />;
  }

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
      
      {/* Auth Routes - Supabase Only (redirect to /advisor if already logged in) */}
      <Route path="/login-supabase" element={<PublicRoute><LoginSupabase /></PublicRoute>} />
      <Route path="/register-supabase" element={<PublicRoute><RegisterSupabase /></PublicRoute>} />
      <Route path="/auth/callback" element={<AuthCallbackSupabase />} />
      <Route path="/auth-debug" element={<AuthDebug />} />
      
      {/* Legacy routes - redirect to Supabase */}
      <Route path="/login" element={<Navigate to="/login-supabase" replace />} />
      <Route path="/register" element={<Navigate to="/register-supabase" replace />} />

      {/* Onboarding */}
      <Route path="/onboarding-decision" element={<ProtectedRoute><OnboardingDecision /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
      <Route path="/calibration" element={<ProtectedRoute><CalibrationAdvisor /></ProtectedRoute>} />
      <Route path="/profile-import" element={<ProtectedRoute><ProfileImport /></ProtectedRoute>} />

      {/* Protected Routes */}
      <Route path="/advisor" element={<ProtectedRoute><AdvisorWatchtower /></ProtectedRoute>} />
      <Route path="/dashboard" element={<Navigate to="/advisor" replace />} />
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
      <Route path="/watchtower" element={<ProtectedRoute><Watchtower /></ProtectedRoute>} />
      <Route path="/war-room" element={<ProtectedRoute><div className="h-screen bg-black"><WarRoomConsole /></div></ProtectedRoute>} />
      <Route path="/board-room" element={<ProtectedRoute><div className="h-screen bg-black"><BoardRoom /></div></ProtectedRoute>} />
      <Route path="/intelligence-baseline" element={<ProtectedRoute><IntelligenceBaseline /></ProtectedRoute>} />
      <Route path="/operator" element={<ProtectedRoute><OperatorDashboard /></ProtectedRoute>} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />

      {/* Catch all - redirect to dashboard or landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  
  // NUCLEAR: Remove ALL service workers and caches permanently
  // Service workers have caused persistent HTML-instead-of-JSON bugs on production
  // They provide no real value for this app (only cached / and /manifest.json)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          reg.unregister();
          console.log('[SW] Unregistered service worker:', reg.scope);
        });
      });
    }
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
          console.log('[SW] Deleted cache:', name);
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
