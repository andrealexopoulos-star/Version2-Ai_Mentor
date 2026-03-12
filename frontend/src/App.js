import "@/App.css";
import "@/mobile.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SupabaseAuthProvider, useSupabaseAuth, AUTH_STATE } from "./context/SupabaseAuthContext";
import ProtectedRoute, { LoadingScreen } from "./components/ProtectedRoute";
import TierGate from "./components/TierGate";
import { MobileDrawerProvider } from "./context/MobileDrawerContext";
import { Toaster } from "./components/ui/sonner";
import { GoogleOAuthProvider } from '@react-oauth/google';
import React, { useEffect, lazy, Suspense } from 'react';
import InstallPrompt from './components/InstallPrompt';

// ── Critical pages loaded eagerly (always needed on first load) ───────────────
import LoginSupabase from "./pages/LoginSupabase";
import RegisterSupabase from "./pages/RegisterSupabase";
import AuthCallbackSupabase from "./pages/AuthCallbackSupabase";
import ResetPassword from './pages/ResetPassword';
import UpdatePassword from './pages/UpdatePassword';

// ── Public website pages — lazy (most users won't need these from the app) ────
const SiteHomePage              = lazy(() => import('./pages/website/HomePage'));
const SitePlatformPage          = lazy(() => import('./pages/website/PlatformPage'));
const SiteIntelligencePage      = lazy(() => import('./pages/website/IntelligencePage'));
const SiteIntegrationsPage      = lazy(() => import('./pages/website/IntegrationsPage'));
const SitePricingPage           = lazy(() => import('./pages/website/PricingPage'));
const SiteTrustLandingPage      = lazy(() => import('./pages/website/TrustLandingPage'));
const AILearningGuarantee       = lazy(() => import('./pages/AILearningGuarantee'));
const BlogPage                  = lazy(() => import('./pages/BlogPage'));
const BlogArticlePage           = lazy(() => import('./pages/BlogArticlePage'));
const ContactPage               = lazy(() => import('./pages/ContactPage'));
const TrustPage                 = lazy(() => import('./pages/TrustPage'));
const Pricing                   = lazy(() => import('./pages/Pricing'));
const SubscribePage             = lazy(() => import('./pages/SubscribePage'));
const TermsAndConditions        = lazy(() => import('./pages/TermsAndConditions'));
const EnterpriseTerms           = lazy(() => import('./pages/EnterpriseTerms'));
const LandingIntelligent        = lazy(() => import('./pages/LandingIntelligent'));

// ── Trust sub-pages ───────────────────────────────────────────────────────────
const SiteTrustSubPages = lazy(() =>
  import('./pages/website/TrustSubPages').then(m => ({
    default: ({ page }) => {
      const components = { terms: m.TermsPage, privacy: m.PrivacyPage, dpa: m.DPAPage, security: m.SecurityPage, centre: m.TrustCentrePage };
      const Comp = components[page] || m.TermsPage;
      return <Comp />;
    }
  }))
);

// ── Core app pages — lazy (only load when user navigates there) ───────────────
const AdvisorWatchtower         = lazy(() => import('./pages/AdvisorWatchtower'));
const Settings                  = lazy(() => import('./pages/Settings'));
const BusinessProfile           = lazy(() => import('./pages/BusinessProfile'));
const Integrations              = lazy(() => import('./pages/Integrations'));
const EmailInbox                = lazy(() => import('./pages/EmailInbox'));
const CalendarView              = lazy(() => import('./pages/CalendarView'));
const CalibrationAdvisor        = lazy(() => import('./pages/CalibrationAdvisor'));
const ForensicCalibration       = lazy(() => import('./pages/ForensicCalibration'));

// ── Intelligence pages ────────────────────────────────────────────────────────
const RevenuePage               = lazy(() => import('./pages/RevenuePage'));
const OperationsPage            = lazy(() => import('./pages/OperationsPage'));
const RiskPage                  = lazy(() => import('./pages/RiskPage'));
const CompliancePage            = lazy(() => import('./pages/CompliancePage'));
const MarketPage                = lazy(() => import('./pages/MarketPage'));
const AlertsPageAuth            = lazy(() => import('./pages/AlertsPageAuth'));
const ActionsPage               = lazy(() => import('./pages/ActionsPage'));
const AutomationsPageAuth       = lazy(() => import('./pages/AutomationsPageAuth'));
const DataHealthPage            = lazy(() => import('./pages/DataHealthPage'));
const ReportsPage               = lazy(() => import('./pages/ReportsPage'));
const AuditLogPage              = lazy(() => import('./pages/AuditLogPage'));
const ForensicAuditPage         = lazy(() => import('./pages/ForensicAuditPage'));
const DSEEPage                  = lazy(() => import('./pages/DSEEPage'));
const MarketingIntelPage        = lazy(() => import('./pages/MarketingIntelPage'));
const MarketingAutomationPage   = lazy(() => import('./pages/MarketingAutomationPage'));
const ABTestingPage             = lazy(() => import('./pages/ABTestingPage'));
const KnowledgeBasePage         = lazy(() => import('./pages/KnowledgeBasePage'));
const CompetitiveBenchmarkPage  = lazy(() => import('./pages/CompetitiveBenchmarkPage'));
const ObservabilityPage         = lazy(() => import('./pages/ObservabilityPage'));

// ── Board/War room ────────────────────────────────────────────────────────────
const WarRoomConsole            = lazy(() => import('./components/WarRoomConsole'));
const BoardRoom                 = lazy(() => import('./components/BoardRoom'));

// ── Admin / dev pages (rarely visited — big savings lazifying these) ──────────
const AdminDashboard            = lazy(() => import('./pages/AdminDashboard'));
const Dashboard                 = lazy(() => import('./pages/Dashboard'));
const Analysis                  = lazy(() => import('./pages/Analysis'));
const SOPGenerator              = lazy(() => import('./pages/SOPGenerator'));
const MarketAnalysis            = lazy(() => import('./pages/MarketAnalysis'));
const Documents                 = lazy(() => import('./pages/Documents'));
const DocumentView              = lazy(() => import('./pages/DocumentView'));
const Diagnosis                 = lazy(() => import('./pages/Diagnosis'));
const DataCenter                = lazy(() => import('./pages/DataCenter'));
const OpsAdvisoryCentre         = lazy(() => import('./pages/OpsAdvisoryCentre'));
const ConnectEmail              = lazy(() => import('./pages/ConnectEmail'));
const IntelCentre               = lazy(() => import('./pages/IntelCentre'));
const MySoundBoard              = lazy(() => import('./pages/MySoundBoard'));
const IntelligenceBaseline      = lazy(() => import('./pages/IntelligenceBaseline'));
const OperatorDashboard         = lazy(() => import('./pages/OperatorDashboard'));
const PromptLab                 = lazy(() => import('./pages/PromptLab'));
const SupportConsolePage        = lazy(() => import('./pages/SupportConsolePage'));
const Watchtower                = lazy(() => import('./components/Watchtower'));

// ── Platform mockup pages ─────────────────────────────────────────────────────
const PlatformLogin             = lazy(() => import('./pages/website/platform/PlatformLogin'));
const ExecOverview              = lazy(() => import('./pages/website/platform/ExecOverview'));
const RevenueModule             = lazy(() => import('./pages/website/platform/RevenueModule'));
const AlertsPage                = lazy(() => import('./pages/website/platform/AlertsPage'));

const CognitiveV2Mockup         = lazy(() => import('./pages/CognitiveV2Mockup'));
const LoadingPreview            = lazy(() => import('./pages/LoadingPreview'));
const CalibrationPreview        = lazy(() => import('./pages/CalibrationPreview'));
const AuthDebug                 = lazy(() => import('./pages/AuthDebug'));
const GmailTest                 = lazy(() => import('./pages/GmailTest'));
const OutlookTest               = lazy(() => import('./pages/OutlookTest'));
const ProfileImport             = lazy(() => import('./pages/ProfileImport'));

// ── Error boundary — catches lazy load failures, shows message instead of blank screen ──
class AppErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(err) { return { error: err }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#070E18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
          <div style={{ color: '#FF6A00', fontSize: 32 }}>B</div>
          <p style={{ color: '#F4F7FA', fontFamily: 'sans-serif', fontSize: 18, fontWeight: 600 }}>Something went wrong</p>
          <p style={{ color: '#64748B', fontFamily: 'sans-serif', fontSize: 14, textAlign: 'center', maxWidth: 400 }}>
            BIQc encountered an error loading this page. Please refresh to try again.
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
const PageFallback = () => (
  <div style={{ minHeight: '100vh', background: '#070E18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 32, height: 32, border: '2px solid #FF6A0040', borderTopColor: '#FF6A00', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);
import AutomationsPage from './pages/website/platform/AutomationsPage';
import IntegrationsPlatform from './pages/website/platform/IntegrationsPlatform';

// Industry mockup pages
import MSPView from './pages/website/platform/industries/MSPView';
import ConstructionView from './pages/website/platform/industries/ConstructionView';
const ConsultingView            = lazy(() => import('./pages/website/platform/industries/ConsultingView'));
const AgencyView                = lazy(() => import('./pages/website/platform/industries/AgencyView'));
const SaaSView                  = lazy(() => import('./pages/website/platform/industries/SaaSView'));
const DecisionsPage             = lazy(() => import('./pages/DecisionsPage'));
const UpgradePage               = lazy(() => import('./pages/UpgradePage'));
const OnboardingDecision        = lazy(() => import('./pages/OnboardingDecision'));

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
          // Warm the lightweight engine (no auth required, returns 204)
          fetch(`${sbUrl}/functions/v1/warm-cognitive-engine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': key },
            body: '{}',
          }).catch(() => {});
          // Also warm the main cognitive function with warmup flag
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
    <AppErrorBoundary>
    <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* Public Routes — Liquid Steel Theme (PRIMARY) */}
      <Route path="/" element={<SiteHomePage />} />
      <Route path="/platform" element={<SitePlatformPage />} />
      <Route path="/intelligence" element={<SiteIntelligencePage />} />
      <Route path="/our-integrations" element={<SiteIntegrationsPage />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/trust" element={<SiteTrustLandingPage />} />
      <Route path="/trust/ai-learning-guarantee" element={<AILearningGuarantee />} />
      <Route path="/trust/terms" element={<SiteTrustSubPages page="terms" />} />
      <Route path="/trust/privacy" element={<SiteTrustSubPages page="privacy" />} />
      <Route path="/trust/dpa" element={<SiteTrustSubPages page="dpa" />} />
      <Route path="/trust/security" element={<SiteTrustSubPages page="security" />} />
      <Route path="/trust/centre" element={<SiteTrustSubPages page="centre" />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogArticlePage />} />
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

      {/* Onboarding — Free tier */}
      <Route path="/onboarding-decision" element={<ProtectedRoute><OnboardingDecision /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
      <Route path="/calibration" element={<ProtectedRoute><CalibrationAdvisor /></ProtectedRoute>} />
      <Route path="/profile-import" element={<ProtectedRoute><ProfileImport /></ProtectedRoute>} />

      {/* Subscribe */}
      <Route path="/subscribe" element={<ProtectedRoute><SubscribePage /></ProtectedRoute>} />
      <Route path="/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
      <Route path="/upgrade/success" element={<ProtectedRoute><UpgradePage success /></ProtectedRoute>} />

      {/* Free Tier Routes */}
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
      <Route path="/observability" element={<ProtectedRoute><ObservabilityPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      {/* Revenue + Operations — EnterpriseContactGate handles access inside the pages */}
      <Route path="/revenue" element={<ProtectedRoute><RevenuePage /></ProtectedRoute>} />
      <Route path="/operations" element={<ProtectedRoute><OperationsPage /></ProtectedRoute>} />

      {/* Paid Tier Routes (starter+) — TierGate enforced */}
      <Route path="/risk" element={<ProtectedRoute><TierGate><RiskPage /></TierGate></ProtectedRoute>} />
      <Route path="/compliance" element={<ProtectedRoute><TierGate><CompliancePage /></TierGate></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><TierGate><ReportsPage /></TierGate></ProtectedRoute>} />
      <Route path="/audit-log" element={<ProtectedRoute><TierGate><AuditLogPage /></TierGate></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><TierGate><AlertsPageAuth /></TierGate></ProtectedRoute>} />
      <Route path="/actions" element={<ProtectedRoute><TierGate><ActionsPage /></TierGate></ProtectedRoute>} />
      {/* Automations — UpgradeCardsGate handles access inside AutomationsPageAuth */}
      <Route path="/automations" element={<ProtectedRoute><AutomationsPageAuth /></ProtectedRoute>} />
      <Route path="/soundboard" element={<ProtectedRoute><TierGate><MySoundBoard /></TierGate></ProtectedRoute>} />
      <Route path="/war-room" element={<ProtectedRoute><TierGate><div className="h-screen bg-black"><WarRoomConsole /></div></TierGate></ProtectedRoute>} />
      <Route path="/board-room" element={<ProtectedRoute><TierGate><div className="h-screen bg-black"><BoardRoom /></div></TierGate></ProtectedRoute>} />
      <Route path="/sop-generator" element={<ProtectedRoute><TierGate><SOPGenerator /></TierGate></ProtectedRoute>} />
      <Route path="/email-inbox" element={<ProtectedRoute><TierGate><EmailInbox /></TierGate></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
      <Route path="/decisions" element={<ProtectedRoute><DecisionsPage /></ProtectedRoute>} />
      <Route path="/competitive-benchmark" element={<ProtectedRoute><CompetitiveBenchmarkPage /></ProtectedRoute>} />
      <Route path="/diagnosis" element={<ProtectedRoute><TierGate><Diagnosis /></TierGate></ProtectedRoute>} />
      <Route path="/analysis" element={<ProtectedRoute><TierGate><Analysis /></TierGate></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><TierGate><Documents /></TierGate></ProtectedRoute>} />
      <Route path="/documents/:id" element={<ProtectedRoute><TierGate><DocumentView /></TierGate></ProtectedRoute>} />
      <Route path="/data-center" element={<ProtectedRoute><TierGate><DataCenter /></TierGate></ProtectedRoute>} />
      <Route path="/intelligence-baseline" element={<ProtectedRoute><TierGate><IntelligenceBaseline /></TierGate></ProtectedRoute>} />
      <Route path="/intel-centre" element={<ProtectedRoute><TierGate><IntelCentre /></TierGate></ProtectedRoute>} />
      <Route path="/watchtower" element={<ProtectedRoute><TierGate><Watchtower /></TierGate></ProtectedRoute>} />
      <Route path="/operator" element={<ProtectedRoute><TierGate><OperatorDashboard /></TierGate></ProtectedRoute>} />
      <Route path="/market-analysis" element={<ProtectedRoute><TierGate><MarketAnalysis /></TierGate></ProtectedRoute>} />
      <Route path="/oac" element={<ProtectedRoute><TierGate><OpsAdvisoryCentre /></TierGate></ProtectedRoute>} />
      <Route path="/marketing-automation" element={<ProtectedRoute><TierGate><MarketingAutomationPage /></TierGate></ProtectedRoute>} />
      <Route path="/ab-testing" element={<ProtectedRoute><TierGate><ABTestingPage /></TierGate></ProtectedRoute>} />

      {/* Admin/Test Routes */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/prompt-lab" element={<ProtectedRoute adminOnly><PromptLab /></ProtectedRoute>} />
      <Route path="/support-admin" element={<ProtectedRoute adminOnly><SupportConsolePage /></ProtectedRoute>} />
      <Route path="/observability" element={<ProtectedRoute adminOnly><ObservabilityPage /></ProtectedRoute>} />
      <Route path="/outlook-test" element={<ProtectedRoute adminOnly><OutlookTest /></ProtectedRoute>} />
      <Route path="/gmail-test" element={<ProtectedRoute adminOnly><GmailTest /></ProtectedRoute>} />

      {/* Catch all - redirect to dashboard or landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </AppErrorBoundary>
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
          // console.log('[SW] Unregistered service worker:', reg.scope);
        });
      });
    }
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
          // console.log('[SW] Deleted cache:', name);
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
