import "@/App.css";
import "@/mobile.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SupabaseAuthProvider, useSupabaseAuth, AUTH_STATE } from "./context/SupabaseAuthContext";
import ProtectedRoute, { LoadingScreen } from "./components/ProtectedRoute";
import TierGate from "./components/TierGate";
import { MobileDrawerProvider } from "./context/MobileDrawerContext";
import { Toaster } from "./components/ui/sonner";
import { GoogleOAuthProvider } from '@react-oauth/google';
import React, { useEffect } from 'react';
import InstallPrompt from './components/InstallPrompt';

// ── Auth pages ────────────────────────────────────────────────────────────────
import LoginSupabase from "./pages/LoginSupabase";
import RegisterSupabase from "./pages/RegisterSupabase";
import AuthCallbackSupabase from "./pages/AuthCallbackSupabase";
import ResetPassword from './pages/ResetPassword';
import UpdatePassword from './pages/UpdatePassword';

// ── Website pages ─────────────────────────────────────────────────────────────
import SiteHomePage from './pages/website/HomePage';
import SitePlatformPage from './pages/website/PlatformPage';
import SiteIntelligencePage from './pages/website/IntelligencePage';
import SiteIntegrationsPage from './pages/website/IntegrationsPage';
import SitePricingPage from './pages/website/PricingPage';
import SiteTrustLandingPage from './pages/website/TrustLandingPage';
import AILearningGuarantee from './pages/AILearningGuarantee';
import BlogPage from './pages/BlogPage';
import BlogArticlePage from './pages/BlogArticlePage';
import ContactPage from './pages/ContactPage';
import TrustPage from './pages/TrustPage';
import Pricing from './pages/Pricing';
import SubscribePage from './pages/SubscribePage';
import TermsAndConditions from './pages/TermsAndConditions';
import EnterpriseTerms from './pages/EnterpriseTerms';
import LandingIntelligent from './pages/LandingIntelligent';
import { TermsPage as SiteTermsPage, PrivacyPage as SitePrivacyPage, DPAPage as SiteDPAPage, SecurityPage as SiteSecurityPage, TrustCentrePage as SiteTrustCentrePage } from './pages/website/TrustSubPages';

// ── Core app pages ────────────────────────────────────────────────────────────
import AdvisorWatchtower from './pages/AdvisorWatchtower';
import Settings from './pages/Settings';
import BusinessProfile from './pages/BusinessProfile';
import Integrations from './pages/Integrations';
import EmailInbox from './pages/EmailInbox';
import CalendarView from './pages/CalendarView';
import CalibrationAdvisor from './pages/CalibrationAdvisor';
import ForensicCalibration from './pages/ForensicCalibration';

// ── Intelligence pages ────────────────────────────────────────────────────────
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
import ForensicAuditPage from './pages/ForensicAuditPage';
import DSEEPage from './pages/DSEEPage';
import MarketingIntelPage from './pages/MarketingIntelPage';
import MarketingAutomationPage from './pages/MarketingAutomationPage';
import ABTestingPage from './pages/ABTestingPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import CompetitiveBenchmarkPage from './pages/CompetitiveBenchmarkPage';
import ObservabilityPage from './pages/ObservabilityPage';

// ── Board/War room ────────────────────────────────────────────────────────────
import WarRoomConsole from './components/WarRoomConsole';
import BoardRoom from './components/BoardRoom';

// ── Other pages ───────────────────────────────────────────────────────────────
import AdminDashboard from './pages/AdminDashboard';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import SOPGenerator from './pages/SOPGenerator';
import MarketAnalysis from './pages/MarketAnalysis';
import Documents from './pages/Documents';
import DocumentView from './pages/DocumentView';
import Diagnosis from './pages/Diagnosis';
import DataCenter from './pages/DataCenter';
import OpsAdvisoryCentre from './pages/OpsAdvisoryCentre';
import ConnectEmail from './pages/ConnectEmail';
import IntelCentre from './pages/IntelCentre';
import MySoundBoard from './pages/MySoundBoard';
import BoardRoomPage from './pages/BoardRoomPage';
import WarRoomPage from './pages/WarRoomPage';
import IntelligenceBaseline from './pages/IntelligenceBaseline';
import OperatorDashboard from './pages/OperatorDashboard';
import PromptLab from './pages/PromptLab';
import SupportConsolePage from './pages/SupportConsolePage';
import Watchtower from './components/Watchtower';
import PlatformLogin from './pages/website/platform/PlatformLogin';
import ExecOverview from './pages/website/platform/ExecOverview';
import RevenueModule from './pages/website/platform/RevenueModule';
import AlertsPage from './pages/website/platform/AlertsPage';
import ConsultingView from './pages/website/platform/industries/ConsultingView';
import AgencyView from './pages/website/platform/industries/AgencyView';
import SaaSView from './pages/website/platform/industries/SaaSView';
import DecisionsPage from './pages/DecisionsPage';
import OnboardingWizard from './pages/OnboardingWizard';
import OnboardingDecision from './pages/OnboardingDecision';
import UpgradePage from './pages/UpgradePage';

// ── Conditional imports (pages that may not exist) ────────────────────────────
let CognitiveV2Mockup, LoadingPreview, CalibrationPreview, AuthDebug, GmailTest, OutlookTest, ProfileImport;
try { CognitiveV2Mockup   = require('./pages/CognitiveV2Mockup').default; } catch { CognitiveV2Mockup = () => null; }
try { LoadingPreview      = require('./pages/LoadingPreview').default; } catch { LoadingPreview = () => null; }
try { CalibrationPreview  = require('./pages/CalibrationPreview').default; } catch { CalibrationPreview = () => null; }
try { AuthDebug           = require('./pages/AuthDebug').default; } catch { AuthDebug = () => null; }
try { GmailTest           = require('./pages/GmailTest').default; } catch { GmailTest = () => null; }
try { OutlookTest         = require('./pages/OutlookTest').default; } catch { OutlookTest = () => null; }
try { ProfileImport       = require('./pages/ProfileImport').default; } catch { ProfileImport = () => null; }


// ── Additional platform pages ────────────────────────────────────────────────
import AutomationsPage from './pages/website/platform/AutomationsPage';
import IntegrationsPlatform from './pages/website/platform/IntegrationsPlatform';
import MSPView from './pages/website/platform/industries/MSPView';
import ConstructionView from './pages/website/platform/industries/ConstructionView';

// ── Error boundary ────────────────────────────────────────────────────────────
class AppErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(err) { return { error: err }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#070E18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
          <div style={{ color: '#FF6A00', fontSize: 32, fontWeight: 'bold' }}>B</div>
          <p style={{ color: '#F4F7FA', fontFamily: 'sans-serif', fontSize: 18, fontWeight: 600 }}>Something went wrong</p>
          <p style={{ color: '#64748B', fontFamily: 'sans-serif', fontSize: 14, textAlign: 'center', maxWidth: 400 }}>
            BIQc encountered an error. Please refresh to continue.
          </p>
          <button onClick={() => window.location.reload()}
            style={{ background: '#FF6A00', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 14 }}>
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Public Route — redirect authenticated users to advisor
const PublicRoute = ({ children }) => {
  const { user, session, loading, authState } = useSupabaseAuth();
  if (authState === AUTH_STATE.LOADING || loading) return <LoadingScreen />;
  const isAuthenticated = user || session;
  if (isAuthenticated && authState === AUTH_STATE.NEEDS_CALIBRATION) return <Navigate to="/calibration" replace />;
  if (isAuthenticated) return <Navigate to="/advisor" replace />;
  return children;
};

function AppRoutes() {
  useEffect(() => {
    const warmup = async () => {
      try {
        const sbUrl = process.env.REACT_APP_SUPABASE_URL;
        const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
        if (sbUrl && key) {
          fetch(`${sbUrl}/functions/v1/warm-cognitive-engine`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': key }, body: '{}' }).catch(() => {});
        }
      } catch {}
    };
    warmup();
    const interval = setInterval(warmup, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppErrorBoundary>
      <Routes>
        {/* Public website */}
        <Route path="/" element={<SiteHomePage />} />
        <Route path="/platform" element={<SitePlatformPage />} />
        <Route path="/intelligence" element={<SiteIntelligencePage />} />
        <Route path="/our-integrations" element={<SiteIntegrationsPage />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/trust" element={<SiteTrustLandingPage />} />
        <Route path="/trust/ai-learning-guarantee" element={<AILearningGuarantee />} />
        <Route path="/trust/terms" element={<SiteTermsPage />} />
        <Route path="/trust/privacy" element={<SitePrivacyPage />} />
        <Route path="/trust/dpa" element={<SiteDPAPage />} />
        <Route path="/trust/security" element={<SiteSecurityPage />} />
        <Route path="/trust/centre" element={<SiteTrustCentrePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogArticlePage />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/enterprise-terms" element={<EnterpriseTerms />} />
        <Route path="/cognitive-v2-preview" element={<CognitiveV2Mockup />} />
        <Route path="/loading-preview" element={<LoadingPreview />} />
        <Route path="/calibration-preview" element={<CalibrationPreview />} />

        {/* Platform demos */}
        <Route path="/platform/login" element={<PlatformLogin />} />
        <Route path="/platform/overview" element={<ExecOverview />} />
        <Route path="/platform/revenue" element={<RevenueModule />} />
        <Route path="/platform/alerts" element={<AlertsPage />} />
        <Route path="/platform/automations" element={<AutomationsPage />} />
        <Route path="/platform/integrations-demo" element={<IntegrationsPlatform />} />
        <Route path="/platform/industry/msp" element={<MSPView />} />
        <Route path="/platform/industry/construction" element={<ConstructionView />} />
        <Route path="/platform/industry/consulting" element={<ConsultingView />} />
        <Route path="/platform/industry/agency" element={<AgencyView />} />
        <Route path="/platform/industry/saas" element={<SaaSView />} />
        <Route path="/site" element={<Navigate to="/" replace />} />
        <Route path="/site/*" element={<Navigate to="/" replace />} />

        {/* Auth */}
        <Route path="/login-supabase" element={<PublicRoute><LoginSupabase /></PublicRoute>} />
        <Route path="/register-supabase" element={<PublicRoute><RegisterSupabase /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/auth/callback" element={<AuthCallbackSupabase />} />
        <Route path="/auth-debug" element={<ProtectedRoute adminOnly><AuthDebug /></ProtectedRoute>} />
        <Route path="/login" element={<Navigate to="/login-supabase" replace />} />
        <Route path="/register" element={<Navigate to="/register-supabase" replace />} />

        {/* Onboarding */}
        <Route path="/onboarding-decision" element={<ProtectedRoute><OnboardingDecision /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
        <Route path="/calibration" element={<ProtectedRoute><CalibrationAdvisor /></ProtectedRoute>} />
        <Route path="/profile-import" element={<ProtectedRoute><ProfileImport /></ProtectedRoute>} />

        {/* Subscription */}
        <Route path="/subscribe" element={<ProtectedRoute><SubscribePage /></ProtectedRoute>} />
        <Route path="/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
        <Route path="/upgrade/success" element={<ProtectedRoute><UpgradePage success /></ProtectedRoute>} />

        {/* Core app — free */}
        <Route path="/advisor" element={<ProtectedRoute><AdvisorWatchtower /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/market" element={<ProtectedRoute><MarketPage /></ProtectedRoute>} />
        <Route path="/market/calibration" element={<ProtectedRoute><ForensicCalibration /></ProtectedRoute>} />
        <Route path="/business-profile" element={<ProtectedRoute><BusinessProfile /></ProtectedRoute>} />
        <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
        <Route path="/connect-email" element={<ProtectedRoute><ConnectEmail /></ProtectedRoute>} />
        <Route path="/data-health" element={<ProtectedRoute><DataHealthPage /></ProtectedRoute>} />
        <Route path="/forensic-audit" element={<ProtectedRoute><ForensicAuditPage /></ProtectedRoute>} />
        <Route path="/exposure-scan" element={<ProtectedRoute><DSEEPage /></ProtectedRoute>} />
        <Route path="/marketing-intelligence" element={<ProtectedRoute><MarketingIntelPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
        <Route path="/competitive-benchmark" element={<ProtectedRoute><CompetitiveBenchmarkPage /></ProtectedRoute>} />

        {/* Paid routes */}
        <Route path="/revenue" element={<ProtectedRoute><RevenuePage /></ProtectedRoute>} />
        <Route path="/operations" element={<ProtectedRoute><OperationsPage /></ProtectedRoute>} />
        <Route path="/risk" element={<ProtectedRoute><TierGate><RiskPage /></TierGate></ProtectedRoute>} />
        <Route path="/compliance" element={<ProtectedRoute><TierGate><CompliancePage /></TierGate></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><TierGate><ReportsPage /></TierGate></ProtectedRoute>} />
        <Route path="/audit-log" element={<ProtectedRoute><TierGate><AuditLogPage /></TierGate></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><TierGate><AlertsPageAuth /></TierGate></ProtectedRoute>} />
        <Route path="/actions" element={<ProtectedRoute><TierGate><ActionsPage /></TierGate></ProtectedRoute>} />
        <Route path="/automations" element={<ProtectedRoute><AutomationsPageAuth /></ProtectedRoute>} />
        <Route path="/soundboard" element={<ProtectedRoute><TierGate><MySoundBoard /></TierGate></ProtectedRoute>} />
        <Route path="/email-inbox" element={<ProtectedRoute><TierGate><EmailInbox /></TierGate></ProtectedRoute>} />
        <Route path="/war-room" element={<ProtectedRoute><TierGate><WarRoomPage /></TierGate></ProtectedRoute>} />
        <Route path="/board-room" element={<ProtectedRoute><TierGate><BoardRoomPage /></TierGate></ProtectedRoute>} />
        <Route path="/warroom" element={<Navigate to="/war-room" replace />} />
        <Route path="/boardroom" element={<Navigate to="/board-room" replace />} />
        <Route path="/sop-generator" element={<ProtectedRoute><TierGate><SOPGenerator /></TierGate></ProtectedRoute>} />
        <Route path="/decisions" element={<ProtectedRoute><DecisionsPage /></ProtectedRoute>} />
        <Route path="/diagnosis" element={<ProtectedRoute><TierGate><Diagnosis /></TierGate></ProtectedRoute>} />
        <Route path="/analysis" element={<ProtectedRoute><TierGate><Analysis /></TierGate></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><TierGate><Documents /></TierGate></ProtectedRoute>} />
        <Route path="/documents/:id" element={<ProtectedRoute><TierGate><DocumentView /></TierGate></ProtectedRoute>} />
        <Route path="/data-center" element={<ProtectedRoute><TierGate><DataCenter /></TierGate></ProtectedRoute>} />
        <Route path="/intel-centre" element={<ProtectedRoute><TierGate><IntelCentre /></TierGate></ProtectedRoute>} />
        <Route path="/watchtower" element={<ProtectedRoute><TierGate><Watchtower /></TierGate></ProtectedRoute>} />
        <Route path="/intelligence-baseline" element={<ProtectedRoute><TierGate><IntelligenceBaseline /></TierGate></ProtectedRoute>} />
        <Route path="/operator" element={<ProtectedRoute><TierGate><OperatorDashboard /></TierGate></ProtectedRoute>} />
        <Route path="/market-analysis" element={<ProtectedRoute><TierGate><MarketAnalysis /></TierGate></ProtectedRoute>} />
        <Route path="/ops-advisory" element={<ProtectedRoute><TierGate><OpsAdvisoryCentre /></TierGate></ProtectedRoute>} />
        <Route path="/oac" element={<Navigate to="/ops-advisory" replace />} />
        <Route path="/marketing-automation" element={<ProtectedRoute><TierGate><MarketingAutomationPage /></TierGate></ProtectedRoute>} />
        <Route path="/ab-testing" element={<ProtectedRoute><TierGate><ABTestingPage /></TierGate></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/prompt-lab" element={<ProtectedRoute adminOnly><PromptLab /></ProtectedRoute>} />
        <Route path="/support-admin" element={<ProtectedRoute adminOnly><SupportConsolePage /></ProtectedRoute>} />
        <Route path="/observability" element={<ProtectedRoute adminOnly><ObservabilityPage /></ProtectedRoute>} />
        <Route path="/outlook-test" element={<ProtectedRoute adminOnly><OutlookTest /></ProtectedRoute>} />
        <Route path="/gmail-test" element={<ProtectedRoute adminOnly><GmailTest /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppErrorBoundary>
  );
}

function App() {
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

  useEffect(() => {
    document.documentElement.style.overflowY = 'scroll';
    document.body.style.overflowY = 'visible';
    document.body.style.height = 'auto';
    const t = setTimeout(() => {
      document.documentElement.style.overflowY = 'scroll';
      document.body.style.overflowY = 'visible';
    }, 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
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
