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
import CalibrationPreview from './pages/CalibrationPreview';

// New Intelligence Pages
import RevenuePage from './pages/RevenuePage';
import OperationsPage from './pages/OperationsPage';
import RiskPage from './pages/RiskPage';
import CompliancePage from './pages/CompliancePage';
import MarketPage from './pages/MarketPage';
import AlertsPageAuth from './pages/AlertsPageAuth';
import ActionsPage from './pages/ActionsPage';
import AutomationsPageAuth from './pages/AutomationsPageAuth';
import DataHealthPage from './pages/DataHealthPage';
import ReportsPage from './pages/ReportsPage';
import AuditLogPage from './pages/AuditLogPage';
import ForensicCalibration from './pages/ForensicCalibration';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import ResetPassword from './pages/ResetPassword';
import UpdatePassword from './pages/UpdatePassword';

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
      {/* Public Routes — Liquid Steel Theme (PRIMARY) */}
      <Route path="/" element={<SiteHomePage />} />
      <Route path="/platform" element={<SitePlatformPage />} />
      <Route path="/intelligence" element={<SiteIntelligencePage />} />
      <Route path="/our-integrations" element={<SiteIntegrationsPage />} />
      <Route path="/pricing" element={<SitePricingPage />} />
      <Route path="/trust" element={<SiteTrustLandingPage />} />
      <Route path="/trust/terms" element={<SiteTermsPage />} />
      <Route path="/trust/privacy" element={<SitePrivacyPage />} />
      <Route path="/trust/dpa" element={<SiteDPAPage />} />
      <Route path="/trust/security" element={<SiteSecurityPage />} />
      <Route path="/trust/centre" element={<SiteTrustCentrePage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/terms" element={<TermsAndConditions />} />
      <Route path="/enterprise-terms" element={<EnterpriseTerms />} />
      <Route path="/cognitive-v2-preview" element={<CognitiveV2Mockup />} />
      <Route path="/loading-preview" element={<LoadingPreview />} />
      <Route path="/calibration-preview" element={<CalibrationPreview />} />

      {/* Platform Demo Pages (Liquid Steel) */}
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform/overview" element={<ExecOverview />} />
      <Route path="/platform/revenue" element={<RevenueModule />} />
      <Route path="/platform/alerts" element={<AlertsPage />} />
      <Route path="/platform/automations" element={<AutomationsPage />} />
      <Route path="/platform/integrations-demo" element={<IntegrationsPlatform />} />

      {/* Industry Demo Pages */}
      <Route path="/platform/industry/msp" element={<MSPView />} />
      <Route path="/platform/industry/construction" element={<ConstructionView />} />
      <Route path="/platform/industry/consulting" element={<ConsultingView />} />
      <Route path="/platform/industry/agency" element={<AgencyView />} />
      <Route path="/platform/industry/saas" element={<SaaSView />} />

      {/* Legacy /site/* redirects */}
      <Route path="/site" element={<Navigate to="/" replace />} />
      <Route path="/site/*" element={<Navigate to="/" replace />} />
      
      {/* Auth Routes - Supabase Only (redirect to /advisor if already logged in) */}
      <Route path="/login-supabase" element={<PublicRoute><LoginSupabase /></PublicRoute>} />
      <Route path="/register-supabase" element={<PublicRoute><RegisterSupabase /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/update-password" element={<UpdatePassword />} />
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

      {/* Protected Routes — Intelligence */}
      <Route path="/advisor" element={<ProtectedRoute><AdvisorWatchtower /></ProtectedRoute>} />
      <Route path="/dashboard" element={<Navigate to="/advisor" replace />} />
      <Route path="/revenue" element={<ProtectedRoute><RevenuePage /></ProtectedRoute>} />
      <Route path="/operations" element={<ProtectedRoute><OperationsPage /></ProtectedRoute>} />
      <Route path="/risk" element={<ProtectedRoute><RiskPage /></ProtectedRoute>} />
      <Route path="/compliance" element={<ProtectedRoute><CompliancePage /></ProtectedRoute>} />
      <Route path="/market" element={<ProtectedRoute><MarketPage /></ProtectedRoute>} />
      <Route path="/market/calibration" element={<ProtectedRoute><ForensicCalibration /></ProtectedRoute>} />
      <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBasePage /></ProtectedRoute>} />

      {/* Protected Routes — Execution */}
      <Route path="/alerts" element={<ProtectedRoute><AlertsPageAuth /></ProtectedRoute>} />
      <Route path="/actions" element={<ProtectedRoute><ActionsPage /></ProtectedRoute>} />
      <Route path="/automations" element={<ProtectedRoute><AutomationsPageAuth /></ProtectedRoute>} />

      {/* Protected Routes — Systems */}
      <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
      <Route path="/data-health" element={<ProtectedRoute><DataHealthPage /></ProtectedRoute>} />

      {/* Protected Routes — Governance */}
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/audit-log" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      {/* Legacy Routes (still accessible) */}
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
