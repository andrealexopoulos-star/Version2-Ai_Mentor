import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SupabaseAuthProvider, useSupabaseAuth } from "./context/SupabaseAuthContext";
import { Toaster } from "./components/ui/sonner";
import { GoogleOAuthProvider } from '@react-oauth/google';

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LoginSupabase from "./pages/LoginSupabase";
import RegisterSupabase from "./pages/RegisterSupabase";
import AuthCallback from "./pages/AuthCallback";
import AuthCallbackSupabase from "./pages/AuthCallbackSupabase";
import Dashboard from "./pages/Dashboard";
import Advisor from "./pages/Advisor";
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
import TermsAndConditions from "./pages/TermsAndConditions";
import OnboardingWizard from "./pages/OnboardingWizard";
import IntelCentre from "./pages/IntelCentre";
import ProfileImport from "./pages/ProfileImport";
import OutlookTest from "./pages/OutlookTest";
import EmailInbox from "./pages/EmailInbox";
import CalendarView from "./pages/CalendarView";
import MySoundBoard from "./pages/MySoundBoard";

// Protected Route Component - Updated to support both MongoDB and Supabase auth
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user: mongoUser, loading: mongoLoading, isAdmin } = useAuth();
  const { user: supabaseUser, loading: supabaseLoading } = useSupabaseAuth();

  const loading = mongoLoading || supabaseLoading;
  const user = supabaseUser || mongoUser; // Prefer Supabase user

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login-supabase" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public Route (redirect to dashboard if logged in) - Updated for Supabase
const PublicRoute = ({ children }) => {
  const { user: mongoUser, loading: mongoLoading } = useAuth();
  const { user: supabaseUser, loading: supabaseLoading } = useSupabaseAuth();

  const loading = mongoLoading || supabaseLoading;
  const user = supabaseUser || mongoUser;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/terms" element={<TermsAndConditions />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      
      {/* New Supabase Auth Routes */}
      <Route path="/login-supabase" element={<LoginSupabase />} />
      <Route path="/register-supabase" element={<RegisterSupabase />} />
      <Route path="/auth/callback" element={<AuthCallbackSupabase />} />

      {/* Onboarding */}
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
      <Route path="/profile-import" element={<ProtectedRoute><ProfileImport /></ProtectedRoute>} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<Navigate to="/advisor" replace />} />
      <Route path="/advisor" element={<ProtectedRoute><Advisor /></ProtectedRoute>} />
      <Route path="/business-profile" element={<ProtectedRoute><BusinessProfile /></ProtectedRoute>} />
      <Route path="/oac" element={<ProtectedRoute><OpsAdvisoryCentre /></ProtectedRoute>} />
      <Route path="/intel-centre" element={<ProtectedRoute><IntelCentre /></ProtectedRoute>} />
      <Route path="/outlook-test" element={<ProtectedRoute><OutlookTest /></ProtectedRoute>} />
      <Route path="/diagnosis" element={<ProtectedRoute><Diagnosis /></ProtectedRoute>} />
      <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
      <Route path="/market-analysis" element={<ProtectedRoute><MarketAnalysis /></ProtectedRoute>} />
      <Route path="/sop-generator" element={<ProtectedRoute><SOPGenerator /></ProtectedRoute>} />
      <Route path="/data-center" element={<ProtectedRoute><DataCenter /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/documents/:id" element={<ProtectedRoute><DocumentView /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
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
  
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <SupabaseAuthProvider>
          <AuthProvider>
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </SupabaseAuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
