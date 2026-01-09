import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import { GoogleOAuthProvider } from '@react-oauth/google';

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
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

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public Route (redirect to dashboard if logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

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

      {/* Onboarding */}
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
      <Route path="/profile-import" element={<ProtectedRoute><ProfileImport /></ProtectedRoute>} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
