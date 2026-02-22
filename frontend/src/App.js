import "@/App.css";
import "@/mobile-fixes.css";
import "@/scroll-fix-critical.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SupabaseAuthProvider, useSupabaseAuth, AUTH_STATE } from "./context/SupabaseAuthContext";
import ProtectedRoute, { LoadingScreen } from "./components/ProtectedRoute";
import { MobileDrawerProvider } from "./context/MobileDrawerContext";
import { Toaster } from "./components/ui/sonner";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useEffect } from 'react';
import InstallPrompt from './components/InstallPrompt';

// Pages - removed legacy Landing and Advisor imports
import LandingIntelligent from "./pages/LandingIntelligent";
import TrustPage from "./pages/TrustPage";
import LoginSupabase from "./pages/LoginSupabase";
import RegisterSupabase from "./pages/RegisterSupabase";
import AuthCallbackSupabase from "./pages/AuthCallbackSupabase";
import Dashboard from "./pages/Dashboard";
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
import EnterpriseTerms from "./pages/EnterpriseTerms";
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
import ContactPage from './pages/ContactPage';
import CognitiveV2Mockup from './pages/CognitiveV2Mockup';
import LoadingPreview from './pages/LoadingPreview';

// Website (Liquid Steel) pages
import SiteHomePage from './pages/website/HomePage';
import SitePlatformPage from './pages/website/PlatformPage';
import SiteIntelligencePage from './pages/website/IntelligencePage';
import SiteIntegrationsPage from './pages/website/IntegrationsPage';
import SitePricingPage from './pages/website/PricingPage';
import SiteTrustLandingPage from './pages/website/TrustLandingPage';
import { TermsPage as SiteTermsPage, PrivacyPage as SitePrivacyPage, DPAPage as SiteDPAPage, SecurityPage as SiteSecurityPage, TrustCentrePage as SiteTrustCentrePage } from './pages/website/TrustSubPages';

// Platform mockup pages
import PlatformLogin from './pages/website/platform/PlatformLogin';
import ExecOverview from './pages/website/platform/ExecOverview';
import RevenueModule from './pages/website/platform/RevenueModule';
import AlertsPage from './pages/website/platform/AlertsPage';
import AutomationsPage from './pages/website/platform/AutomationsPage';
import IntegrationsPlatform from './pages/website/platform/IntegrationsPlatform';

// Industry mockup pages
import MSPView from './pages/website/platform/industries/MSPView';
import ConstructionView from './pages/website/platform/industries/ConstructionView';
import ConsultingView from './pages/website/platform/industries/ConsultingView';
import AgencyView from './pages/website/platform/industries/AgencyView';
import SaaSView from './pages/website/platform/industries/SaaSView';

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
  // Warmup Edge Functions on app load to prevent cold starts
  useEffect(() => {
    const warmup = async () => {
      try {
        const sbUrl = process.env.REACT_APP_SUPABASE_URL;
        const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
        if (sbUrl && key) {
          // Ping the main Edge Function with warmup flag
          fetch(`${sbUrl}/functions/v1/biqc-insights-cognitive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': key },
            body: '{"warmup": true}',
          }).catch(() => {});
        }
      } catch {}
    };
    warmup();
    const interval = setInterval(warmup, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Routes>
      {/* Public Routes - Landing page accessible to everyone */}
      <Route path="/" element={<LandingIntelligent />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/trust" element={<TrustPage />} />
      <Route path="/terms" element={<TermsAndConditions />} />
      <Route path="/enterprise-terms" element={<EnterpriseTerms />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/cognitive-v2-preview" element={<CognitiveV2Mockup />} />
      <Route path="/loading-preview" element={<LoadingPreview />} />

      {/* Website (Liquid Steel) — Test Mockup */}
      <Route path="/site" element={<SiteHomePage />} />
      <Route path="/site/platform" element={<SitePlatformPage />} />
      <Route path="/site/intelligence" element={<SiteIntelligencePage />} />
      <Route path="/site/integrations" element={<SiteIntegrationsPage />} />
      <Route path="/site/pricing" element={<SitePricingPage />} />
      <Route path="/site/trust" element={<SiteTrustLandingPage />} />
      <Route path="/site/trust/terms" element={<SiteTermsPage />} />
      <Route path="/site/trust/privacy" element={<SitePrivacyPage />} />
      <Route path="/site/trust/dpa" element={<SiteDPAPage />} />
      <Route path="/site/trust/security" element={<SiteSecurityPage />} />
      <Route path="/site/trust/centre" element={<SiteTrustCentrePage />} />

      {/* Platform Mockup (Liquid Steel) */}
      <Route path="/site/platform/login" element={<PlatformLogin />} />
      <Route path="/site/platform/overview" element={<ExecOverview />} />
      <Route path="/site/platform/revenue" element={<RevenueModule />} />
      <Route path="/site/platform/alerts" element={<AlertsPage />} />
      <Route path="/site/platform/automations" element={<AutomationsPage />} />
      <Route path="/site/platform/integrations" element={<IntegrationsPlatform />} />
      
      {/* Auth Routes - Supabase Only (redirect to /advisor if already logged in) */}
      <Route path="/login-supabase" element={<PublicRoute><LoginSupabase /></PublicRoute>} />
      <Route path="/register-supabase" element={<PublicRoute><RegisterSupabase /></PublicRoute>} />
      <Route path="/auth/callback" element={<AuthCallbackSupabase />} />
      <Route path="/auth-debug" element={<ProtectedRoute adminOnly><AuthDebug /></ProtectedRoute>} />
      
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
      <Route path="/business-profile" element={<ProtectedRoute><BusinessProfile /></ProtectedRoute>} />
      <Route path="/oac" element={<ProtectedRoute><OpsAdvisoryCentre /></ProtectedRoute>} />
      <Route path="/intel-centre" element={<ProtectedRoute><IntelCentre /></ProtectedRoute>} />
      <Route path="/outlook-test" element={<ProtectedRoute adminOnly><OutlookTest /></ProtectedRoute>} />
      <Route path="/gmail-test" element={<ProtectedRoute adminOnly><GmailTest /></ProtectedRoute>} />
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
      <Route path="/admin/prompt-lab" element={<ProtectedRoute adminOnly><PromptLab /></ProtectedRoute>} />

      {/* Catch all - redirect to dashboard or landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  
  // ── SCROLL UNLOCK (runs before paint, cannot be overridden by CSS) ──
  // Inline styles on DOM elements take priority over ALL stylesheets.
  // This is the nuclear option — guaranteed to enable scrolling on every page.
  useEffect(() => {
    const unlock = () => {
      // HTML is the ONLY scroll container
      document.documentElement.style.overflowY = 'scroll';
      document.documentElement.style.overflowX = 'hidden';
      document.documentElement.style.height = 'auto';
      document.documentElement.style.position = 'static';
      document.documentElement.style.overscrollBehavior = 'auto';
      // Body must NOT be a scroll container
      document.body.style.overflowY = 'visible';
      document.body.style.overflowX = 'hidden';
      document.body.style.height = 'auto';
      document.body.style.position = 'static';
      document.body.style.overscrollBehavior = 'auto';
      const root = document.getElementById('root');
      if (root) {
        root.style.overflowY = 'visible';
        root.style.height = 'auto';
        root.style.minHeight = '100vh';
      }
    };
    unlock();
    // Re-apply after any dynamic content loads
    const t = setTimeout(unlock, 500);
    return () => clearTimeout(t);
  }, []);

  // NUCLEAR: Remove ALL service workers and caches permanently
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
