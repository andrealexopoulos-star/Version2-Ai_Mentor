import "@/App.css";
import "@/mobile.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SupabaseAuthProvider, useSupabaseAuth, AUTH_STATE } from "./context/SupabaseAuthContext";
import ProtectedRoute, { LoadingScreen } from "./components/ProtectedRoute";
import BiqcLogoCard from "./components/BiqcLogoCard";
import { MobileDrawerProvider } from "./context/MobileDrawerContext";
import { Toaster } from "./components/ui/sonner";
import { GoogleOAuthProvider } from '@react-oauth/google';
import React, { Suspense, useEffect } from 'react';
import InstallPrompt from './components/InstallPrompt';
import CookieConsent from './components/CookieConsent';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { apiClient } from './lib/api';
import { resolveTier, getRouteAccess } from './lib/tierResolver';
import { isPrivilegedUser } from './lib/privilegedUser';

// ── Page loading fallback ─────────────────────────────────────────────────────
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--canvas-app, #0B1120)' }}>
    <div style={{ width: 40, height: 40, border: '3px solid var(--border, rgba(140,170,210,0.12))', borderTopColor: 'var(--lava, #E85D00)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── Auth pages (static — needed before lazy routes mount) ─────────────────────
import LoginSupabase from "./pages/LoginSupabase";
import RegisterSupabase from "./pages/RegisterSupabase";
import AuthCallbackSupabase from "./pages/AuthCallbackSupabase";
import ResetPassword from './pages/ResetPassword';
import UpdatePassword from './pages/UpdatePassword';
import VerifyEmail from './pages/VerifyEmail';
import VerifyEmailSent from './pages/VerifyEmailSent';
import CompleteSignup from './pages/CompleteSignup';

// ── ALL other pages — lazy-loaded with tier-based chunks ──────────────────────

// Website / marketing
const SiteHomePage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/website/HomePage'));
const SitePlatformPage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/website/PlatformPage'));
const SiteIntelligencePage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/website/IntelligencePage'));
const SiteIntegrationsPage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/website/IntegrationsPage'));
const SiteTrustLandingPage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/website/TrustLandingPage'));
const AboutPage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/website/AboutPage'));
const AILearningGuarantee = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/AILearningGuarantee'));
const BlogPage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/BlogPage'));
const BlogArticlePage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/BlogArticlePage'));
const ContactPage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/ContactPage'));
const SpeakWithLocalSpecialist = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/SpeakWithLocalSpecialist'));
const Pricing = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/Pricing'));
const StillNotSurePage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/StillNotSurePage'));
const SubscribePage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/SubscribePage'));
const EnterpriseTerms = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/EnterpriseTerms'));
const LandingIntelligent = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/LandingIntelligent'));
const BIQcLegalPage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/BIQcLegalPage'));
const RetentionPolicyPage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/legal/RetentionPolicy'));
const NotFoundPage = React.lazy(() => import(/* webpackChunkName: "marketing" */ './pages/NotFoundPage'));

// Trust sub-pages (named exports need wrapper)
const SiteTermsPage = React.lazy(() => import('./pages/website/TrustSubPages').then(m => ({ default: m.TermsPage })));
const SitePrivacyPage = React.lazy(() => import('./pages/website/TrustSubPages').then(m => ({ default: m.PrivacyPage })));
const SiteDPAPage = React.lazy(() => import('./pages/website/TrustSubPages').then(m => ({ default: m.DPAPage })));
const SiteSecurityPage = React.lazy(() => import('./pages/website/TrustSubPages').then(m => ({ default: m.SecurityPage })));
const SiteTrustCentrePage = React.lazy(() => import('./pages/website/TrustSubPages').then(m => ({ default: m.TrustCentrePage })));
const SiteRefundPolicyPage = React.lazy(() => import('./pages/website/TrustSubPages').then(m => ({ default: m.RefundPolicyPage })));

// Free tier
const Advisor = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/Advisor'));
const Settings = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/Settings'));
const BusinessProfile = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/BusinessProfile'));
const Integrations = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/Integrations'));
const EmailInbox = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/EmailInbox'));
const CalendarView = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/CalendarView'));
const AlertsPageAuth = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/AlertsPageAuth'));
const ActionsPage = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/ActionsPage'));
const MarketPage = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/MarketPage'));
const DataHealthPage = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/DataHealthPage'));
const ConnectEmail = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/ConnectEmail'));
const OutlookAdminConsentPage = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/OutlookAdminConsentPage'));
const CompetitiveBenchmarkPage = React.lazy(() => import(/* webpackChunkName: "free" */ './pages/CompetitiveBenchmarkPage'));
const SoundboardPanel = React.lazy(() => import(/* webpackChunkName: "free" */ './components/SoundboardPanel'));

// Onboarding
const OnboardingWizard = React.lazy(() => import(/* webpackChunkName: "onboarding" */ './pages/OnboardingWizard'));
const OnboardingDecision = React.lazy(() => import(/* webpackChunkName: "onboarding" */ './pages/OnboardingDecision'));
// CalibrationAdvisor (legacy) deleted 2026-04-23. /calibration route still
// redirects to /market/calibration (see Routes below) as a defensive measure.
const ForensicCalibration = React.lazy(() => import(/* webpackChunkName: "onboarding" */ './pages/ForensicCalibration'));

// Growth tier
const RevenuePage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/RevenuePage'));
const OperationsPage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/OperationsPage'));
const BoardRoomPage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/BoardRoomPage'));
const DecisionsPage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/DecisionsPage'));
const ReportsPage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/ReportsPage'));
const ExposureScanPage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/ExposureScanPage'));
const SOPGenerator = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/SOPGenerator'));
const BillingPage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/BillingPage'));
const MarketingIntelPage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/MarketingIntelPage'));
const MarketingAutomationPage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/MarketingAutomationPage'));
const UpgradePage = React.lazy(() => import(/* webpackChunkName: "growth" */ './pages/UpgradePage'));

// Pro tier
const WarRoomPage = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/WarRoomPage'));
const IntelCentre = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/IntelCentre'));
const RiskPage = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/RiskPage'));
const CompliancePage = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/CompliancePage'));
const AuditLogPage = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/AuditLogPage'));
const Documents = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/Documents'));
const DocumentView = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/DocumentView'));
const Analysis = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/Analysis'));
const DataCenter = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/DataCenter'));
const Diagnosis = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/Diagnosis'));
const CMOReportPage = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/CMOReportPage'));
const IntelligenceBaseline = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/IntelligenceBaseline'));
const MarketAnalysis = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/MarketAnalysis'));
const OperatorDashboard = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/OperatorDashboard'));
const OpsAdvisoryCentre = React.lazy(() => import(/* webpackChunkName: "pro" */ './pages/OpsAdvisoryCentre'));
const Watchtower = React.lazy(() => import(/* webpackChunkName: "pro" */ './components/Watchtower'));
const WarRoomConsole = React.lazy(() => import(/* webpackChunkName: "pro" */ './components/WarRoomConsole'));
const BoardRoom = React.lazy(() => import(/* webpackChunkName: "pro" */ './components/BoardRoom'));

// Admin
const AdminDashboard = React.lazy(() => import(/* webpackChunkName: "admin" */ './pages/AdminDashboard'));
const AdminPricingPage = React.lazy(() => import(/* webpackChunkName: "admin" */ './pages/AdminPricingPage'));
const AdminUxFeedbackPage = React.lazy(() => import(/* webpackChunkName: "admin" */ './pages/AdminUxFeedbackPage'));
const AdminScopeCheckpointsPage = React.lazy(() => import(/* webpackChunkName: "admin" */ './pages/AdminScopeCheckpointsPage'));
const SupportConsolePage = React.lazy(() => import(/* webpackChunkName: "admin" */ './pages/SupportConsolePage'));
const SuperAdminProviders = React.lazy(() => import(/* webpackChunkName: "admin" */ './pages/SuperAdminProviders'));
const ObservabilityPage = React.lazy(() => import(/* webpackChunkName: "admin" */ './pages/ObservabilityPage'));
const PromptLab = React.lazy(() => import(/* webpackChunkName: "admin" */ './pages/PromptLab'));

// Misc
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AutomationsPageAuth = React.lazy(() => import('./pages/AutomationsPageAuth'));
const ForensicAuditPage = React.lazy(() => import('./pages/ForensicAuditPage'));
const DSEEPage = React.lazy(() => import('./pages/DSEEPage'));
const ABTestingPage = React.lazy(() => import('./pages/ABTestingPage'));
const KnowledgeBasePage = React.lazy(() => import('./pages/KnowledgeBasePage'));

// Platform demo pages
const PlatformLogin = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/PlatformLogin'));
const ExecOverview = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/ExecOverview'));
const RevenueModule = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/RevenueModule'));
const AlertsPage = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/AlertsPage'));
const AutomationsPage = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/AutomationsPage'));
const IntegrationsPlatform = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/IntegrationsPlatform'));
const ConsultingView = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/industries/ConsultingView'));
const AgencyView = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/industries/AgencyView'));
const SaaSView = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/industries/SaaSView'));
const MSPView = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/industries/MSPView'));
const ConstructionView = React.lazy(() => import(/* webpackChunkName: "platform" */ './pages/website/platform/industries/ConstructionView'));

// Conditional pages (may not exist)
const CognitiveV2Mockup = React.lazy(() => import('./pages/CognitiveV2Mockup').catch(() => ({ default: () => null })));
const LoadingPreview = React.lazy(() => import('./pages/LoadingPreview').catch(() => ({ default: () => null })));
const CalibrationPreview = React.lazy(() => import('./pages/CalibrationPreview').catch(() => ({ default: () => null })));
const ProfileImport = React.lazy(() => import('./pages/ProfileImport').catch(() => ({ default: () => null })));

// ── Error boundary ────────────────────────────────────────────────────────────
function _appErrorRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FATAL-${ts}-${rand}`;
}

class AppErrorBoundary extends React.Component {
  state = { error: null, errorRef: null, copied: false };
  static getDerivedStateFromError(err) { return { error: err, errorRef: _appErrorRef() }; }
  componentDidCatch(error, errorInfo) {
    // Ship to Sentry so we see every FATAL on the dashboard within
    // ~minutes (not hours as in the 2026-04-19 incident). Wrapped
    // behind window.Sentry probe so it's a no-op if the loader
    // hasn't finished or the DSN is missing.
    try {
      if (window.Sentry && typeof window.Sentry.captureException === 'function') {
        window.Sentry.captureException(error, {
          tags: { fatal_ref: this.state.errorRef, boundary: 'AppErrorBoundary' },
          extra: { componentStack: errorInfo && errorInfo.componentStack },
        });
      }
    } catch (_) { /* never let reporting crash the crash page */ }
    console.error(`[AppErrorBoundary] ref=${this.state.errorRef}`, error, errorInfo);
  }
  _copyRef = () => {
    if (this.state.errorRef) {
      navigator.clipboard?.writeText(this.state.errorRef).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#070E18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
          <BiqcLogoCard size="sm" to={null} static />
          <p style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: 'var(--font-ui, Inter, sans-serif)', fontSize: 18, fontWeight: 600 }}>Something went wrong</p>
          <p style={{ color: '#64748B', fontFamily: 'var(--font-ui, Inter, sans-serif)', fontSize: 14, textAlign: 'center', maxWidth: 400 }}>
            BIQc encountered an error. Please refresh to continue.
          </p>
          {this.state.errorRef && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#111827', border: '1px solid #1F2937', borderRadius: 8, padding: '6px 14px' }}>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: '#6B7280', letterSpacing: '0.04em' }}>
                Ref: {this.state.errorRef}
              </span>
              <button onClick={this._copyRef}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: this.state.copied ? '#10B981' : '#6B7280', fontSize: 11 }}>
                {this.state.copied ? '\u2713' : '\u2398'}
              </button>
            </div>
          )}
          <button onClick={() => window.location.reload()}
            style={{ background: '#E85D00', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-ui, Inter, sans-serif)', fontSize: 14 }}>
            Refresh Page
          </button>
          <p style={{ color: '#4B5563', fontFamily: 'var(--font-ui, Inter, sans-serif)', fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
            If this keeps happening, email{' '}
            <a href={`mailto:support@biqc.ai?subject=Critical Error ${this.state.errorRef || ''}`} style={{ color: '#E85D00', textDecoration: 'none' }}>support@biqc.ai</a>
            {' '}with the reference code above.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Public Route — redirect authenticated users to advisor
const PublicRoute = ({ children }) => {
  const { user, session, loading, authState } = useSupabaseAuth();
  const location = useLocation();
  const recentLoginTs = (() => {
    try {
      const raw = sessionStorage.getItem('biqc_auth_recent_login');
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  })();
  // 2026-04-20 P0 UX fix: when a user is on /register-supabase and the
  // trial signup flow is still running, the Supabase auth session lands
  // (backend admin.create_user + sign_in) BEFORE the Stripe SetupIntent +
  // subscription calls complete. Without this guard, PublicRoute would
  // navigate away to /calibration the moment the session appeared —
  // unmounting the Register page mid-flow and hiding any Stripe error
  // behind a brief toast on /calibration. Result: users thought they
  // paid when they hadn't (Andreas 2026-04-19 incident). The guard is
  // set by RegisterSupabase.handleSubmit right before the Supabase
  // signup call and cleared on every terminal path (success, Stripe
  // failure, cancel). TTL-bounded so a crashed signup flow can't strand
  // the user forever.
  const inTrialSignup = (() => {
    try {
      const raw = sessionStorage.getItem('biqc_trial_signup_in_progress');
      if (!raw) return false;
      const ts = parseInt(raw, 10);
      if (!Number.isFinite(ts)) return false;
      // Stale after 5 minutes — crash recovery
      if (Date.now() - ts > 5 * 60 * 1000) {
        try { sessionStorage.removeItem('biqc_trial_signup_in_progress'); } catch {}
        return false;
      }
      return true;
    } catch {
      return false;
    }
  })();
  if (authState === AUTH_STATE.LOADING || loading) return <LoadingScreen />;
  if (!user && !session && recentLoginTs && Date.now() - recentLoginTs < 20000) return <LoadingScreen />;
  const isAuthenticated = user || session;
  if (inTrialSignup && location.pathname === '/register-supabase') return children;
  // 2026-04-23: route NEEDS_CALIBRATION users through /onboarding-decision first
  // so new signups see the welcome cards + 3 onboarding-path picker before
  // landing on calibration. Returning users mid-calibration see the same page
  // and can click "Start calibration" to resume (one extra click, vs the welcome
  // flow being skipped entirely for brand-new users).
  if (isAuthenticated && authState === AUTH_STATE.NEEDS_CALIBRATION) return <Navigate to="/onboarding-decision" replace />;
  if (isAuthenticated) return <Navigate to="/advisor" replace />;
  return children;
};

const LegacyIntegrationsQueryRedirect = () => {
  const location = useLocation();
  const legacyPart = location.pathname.startsWith('/integrations/')
    ? location.pathname.slice('/integrations/'.length)
    : '';

  if (legacyPart && legacyPart.includes('=')) {
    return <Navigate to={`/integrations?${legacyPart}`} replace />;
  }

  return <Navigate to="/integrations" replace />;
};

const LegacyUpgradeSuccessRedirect = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (!params.get('status')) params.set('status', 'success');
  if (!params.get('from')) params.set('from', '/upgrade/success');
  return <Navigate to={`/subscribe?${params.toString()}`} replace />;
};

const LaunchRoute = ({ children, access, featureKey = null }) => {
  const location = useLocation();
  const { user, session, authState, loading } = useSupabaseAuth();
  const tier = resolveTier(user);
  const privileged = isPrivilegedUser(user);
  const hasPaidAccess = privileged || (user && !['free', 'trial'].includes(tier));
  const hasProAccess = privileged || (user && ['pro', 'professional', 'enterprise', 'custom_build', 'super_admin'].includes(tier));
  const routeConfig = getRouteAccess(location.pathname);
  const effectiveAccess = access || routeConfig?.launchType || 'free';
  const key = featureKey || routeConfig?.featureKey || '';
  const gateParams = new URLSearchParams({
    from: location.pathname,
    required: routeConfig?.minTier || 'starter',
    launch: effectiveAccess,
  });
  if (key) gateParams.set('feature', key);

  if (authState === AUTH_STATE.LOADING || loading) return <LoadingScreen />;
  if (!user && !session) return <Navigate to="/login-supabase" replace />;
  if (effectiveAccess === 'foundation' && !hasPaidAccess) {
    return <Navigate to={`/subscribe?${gateParams.toString()}`} replace />;
  }
  if (effectiveAccess === 'paid' && !hasProAccess) {
    return <Navigate to={`/subscribe?${gateParams.toString()}`} replace />;
  }
  if (effectiveAccess === 'waitlist' && !hasPaidAccess) {
    return <Navigate to={`/subscribe?${gateParams.toString()}`} replace />;
  }
  return children;
};

function AppRoutes() {
  const previewRoutesEnabled = (
    (process.env.REACT_APP_ENABLE_PREVIEW_ROUTES || '').toLowerCase() === 'true'
    || process.env.NODE_ENV !== 'production'
  );

  useEffect(() => {
    const warmupEnabled =
      (process.env.NODE_ENV !== 'production')
      || ((process.env.REACT_APP_ENABLE_WARMUP || '').toLowerCase() === 'true');
    if (!warmupEnabled) return undefined;

    const warmup = async () => {
      try {
        await apiClient.get('/health/warmup');
      } catch {}
    };
    warmup();
    const interval = setInterval(warmup, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppErrorBoundary>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public website */}
        <Route path="/" element={<SiteHomePage />} />
        <Route path="/platform" element={<SitePlatformPage />} />
        <Route path="/intelligence" element={<SiteIntelligencePage />} />
        <Route path="/our-integrations" element={<SiteIntegrationsPage />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/still-not-sure" element={<StillNotSurePage />} />
        <Route path="/trust" element={<SiteTrustLandingPage />} />
        <Route path="/trust/ai-learning-guarantee" element={<AILearningGuarantee />} />
        <Route path="/trust/terms" element={<SiteTermsPage />} />
        <Route path="/trust/privacy" element={<SitePrivacyPage />} />
        <Route path="/trust/dpa" element={<SiteDPAPage />} />
        <Route path="/trust/security" element={<SiteSecurityPage />} />
        <Route path="/trust/centre" element={<SiteTrustCentrePage />} />
        <Route path="/trust/refund-policy" element={<SiteRefundPolicyPage />} />
        {/* Sprint C #22 Phase 2 — plain-English retention policy, public, no auth. */}
        <Route path="/legal/retention" element={<RetentionPolicyPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/speak-with-local-specialist" element={<SpeakWithLocalSpecialist />} />
        <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogArticlePage />} />
        <Route path="/landing-intelligent" element={<LandingIntelligent />} />
        <Route path="/terms" element={<Navigate to="/trust/terms" replace />} />
        <Route path="/enterprise-terms" element={<EnterpriseTerms />} />
        {previewRoutesEnabled && <Route path="/cognitive-v2-preview" element={<CognitiveV2Mockup />} />}
        {previewRoutesEnabled && <Route path="/loading-preview" element={<LoadingPreview />} />}
        {previewRoutesEnabled && <Route path="/calibration-preview" element={<CalibrationPreview />} />}

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
        <Route path="/site/trust/terms" element={<Navigate to="/trust/terms" replace />} />
        <Route path="/site/trust/privacy" element={<Navigate to="/trust/privacy" replace />} />
        <Route path="/site/trust/dpa" element={<Navigate to="/trust/dpa" replace />} />
        <Route path="/site/trust/security" element={<Navigate to="/trust/security" replace />} />
        <Route path="/site/trust/centre" element={<Navigate to="/trust/centre" replace />} />
        <Route path="/site/trust" element={<Navigate to="/trust" replace />} />
        <Route path="/site" element={<Navigate to="/" replace />} />
        <Route path="/site/*" element={<Navigate to="/" replace />} />

        {/* Auth */}
        <Route path="/login-supabase" element={<PublicRoute><LoginSupabase /></PublicRoute>} />
        <Route path="/register-supabase" element={<PublicRoute><RegisterSupabase /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-email-sent" element={<VerifyEmailSent />} />
        <Route path="/complete-signup" element={<CompleteSignup />} />
        <Route path="/auth/callback" element={<AuthCallbackSupabase />} />
        <Route path="/login" element={<Navigate to="/login-supabase" replace />} />
        <Route path="/register" element={<Navigate to="/register-supabase" replace />} />

        {/* Onboarding */}
        <Route path="/onboarding-decision" element={<ProtectedRoute><RouteErrorBoundary><OnboardingDecision /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><RouteErrorBoundary><OnboardingWizard /></RouteErrorBoundary></ProtectedRoute>} />
        {/* Legacy /calibration (CalibrationAdvisor) deprecated 2026-04-22
            — new signups route to /market/calibration (ForensicCalibration)
            via PR #251, and CalibrationAdvisor hangs on 403s from edge
            functions for fresh-signup users. Redirect to the live path. */}
        <Route path="/calibration" element={<Navigate to="/market/calibration" replace />} />
        {/* /calibration-qa removed — calibration is triggered after first signup only */}
        <Route path="/profile-import" element={<ProtectedRoute><RouteErrorBoundary><ProfileImport /></RouteErrorBoundary></ProtectedRoute>} />

        {/* Subscription (canonical entrypoint for all paid/waitlist upsell routing) */}
        <Route path="/subscribe" element={<ProtectedRoute><RouteErrorBoundary><SubscribePage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/upgrade" element={<ProtectedRoute><Navigate to="/subscribe?from=/upgrade" replace /></ProtectedRoute>} />
        <Route path="/upgrade/success" element={<ProtectedRoute><LegacyUpgradeSuccessRedirect /></ProtectedRoute>} />
        <Route path="/biqc-foundation" element={<ProtectedRoute><Navigate to="/subscribe?section=foundation" replace /></ProtectedRoute>} />
        <Route path="/more-features" element={<ProtectedRoute><Navigate to="/subscribe?section=advanced" replace /></ProtectedRoute>} />
        <Route path="/biqc-legal" element={<ProtectedRoute><RouteErrorBoundary><BIQcLegalPage /></RouteErrorBoundary></ProtectedRoute>} />

        {/* Core app — free */}
        <Route path="/advisor" element={<ProtectedRoute><RouteErrorBoundary><Advisor /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/dashboard" element={<Navigate to="/soundboard" replace />} />
        <Route path="/market" element={<ProtectedRoute><RouteErrorBoundary><MarketPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/market/calibration" element={<ProtectedRoute><RouteErrorBoundary><ForensicCalibration /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/business-profile" element={<ProtectedRoute><RouteErrorBoundary><BusinessProfile /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/integrations" element={<ProtectedRoute><RouteErrorBoundary><Integrations /></RouteErrorBoundary></ProtectedRoute>} />
        <Route
          path="/integrations/:legacyQuery"
          element={<ProtectedRoute><RouteErrorBoundary><LegacyIntegrationsQueryRedirect /></RouteErrorBoundary></ProtectedRoute>}
        />
        <Route path="/connect-email" element={<ProtectedRoute><RouteErrorBoundary><ConnectEmail /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/outlook-admin-consent" element={<ProtectedRoute><RouteErrorBoundary><OutlookAdminConsentPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/data-health" element={<ProtectedRoute><RouteErrorBoundary><DataHealthPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/forensic-audit" element={<ProtectedRoute><LaunchRoute access="foundation"><RouteErrorBoundary><ForensicAuditPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/exposure-scan" element={<ProtectedRoute><LaunchRoute access="foundation" featureKey="exposure-scan"><RouteErrorBoundary><ExposureScanPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/marketing-intelligence" element={<ProtectedRoute><LaunchRoute access="foundation" featureKey="marketing-intelligence"><RouteErrorBoundary><MarketingIntelPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><RouteErrorBoundary><Settings /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><RouteErrorBoundary><CalendarView /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/competitive-benchmark" element={<ProtectedRoute><RouteErrorBoundary><CompetitiveBenchmarkPage /></RouteErrorBoundary></ProtectedRoute>} />

        {/* Paid routes */}
        <Route path="/revenue" element={<ProtectedRoute><LaunchRoute access="foundation" featureKey="revenue"><RouteErrorBoundary><RevenuePage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/billing" element={<ProtectedRoute><RouteErrorBoundary><BillingPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/manage-users" element={<ProtectedRoute><Navigate to="/billing?view=users" replace /></ProtectedRoute>} />
        <Route path="/admin-billing" element={<ProtectedRoute adminOnly><Navigate to="/admin" replace /></ProtectedRoute>} />
        <Route path="/operations" element={<ProtectedRoute><LaunchRoute access="foundation" featureKey="operations"><RouteErrorBoundary><OperationsPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/risk" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="risk-workforce"><RouteErrorBoundary><RiskPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/compliance" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="compliance"><RouteErrorBoundary><CompliancePage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><LaunchRoute access="foundation"><RouteErrorBoundary><ReportsPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/audit-log" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="risk-workforce"><RouteErrorBoundary><AuditLogPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/settings/alerts" element={<ProtectedRoute><RouteErrorBoundary><AlertsPageAuth /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/settings/actions" element={<ProtectedRoute><RouteErrorBoundary><ActionsPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/alerts" element={<Navigate to="/settings/alerts" replace />} />
        <Route path="/actions" element={<Navigate to="/settings/actions" replace />} />
        <Route path="/automations" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="automations"><RouteErrorBoundary><AutomationsPageAuth /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/soundboard" element={<ProtectedRoute><RouteErrorBoundary><SoundboardPanel /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/email-inbox" element={<ProtectedRoute><RouteErrorBoundary><EmailInbox /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/war-room" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="war-room"><RouteErrorBoundary><WarRoomPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/board-room" element={<ProtectedRoute><LaunchRoute access="foundation" featureKey="boardroom"><RouteErrorBoundary><BoardRoomPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/warroom" element={<Navigate to="/war-room" replace />} />
        <Route path="/boardroom" element={<Navigate to="/board-room" replace />} />
        <Route path="/email" element={<Navigate to="/email-inbox" replace />} />
        <Route path="/ask-biqc" element={<Navigate to="/soundboard" replace />} />
        <Route path="/sop-generator" element={<ProtectedRoute><LaunchRoute access="foundation"><RouteErrorBoundary><SOPGenerator /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/decisions" element={<ProtectedRoute><LaunchRoute access="foundation"><RouteErrorBoundary><DecisionsPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/diagnosis" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="diagnosis"><RouteErrorBoundary><Diagnosis /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/analysis" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="analysis"><RouteErrorBoundary><Analysis /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="documents-library"><RouteErrorBoundary><Documents /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/documents/:id" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="documents-library"><RouteErrorBoundary><DocumentView /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/data-center" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="watchtower"><RouteErrorBoundary><DataCenter /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/intel-centre" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="intel-centre"><RouteErrorBoundary><IntelCentre /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/watchtower" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="watchtower"><RouteErrorBoundary><Watchtower /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/intelligence-baseline" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="watchtower"><RouteErrorBoundary><IntelligenceBaseline /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/operator" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="operations-intelligence"><RouteErrorBoundary><OperatorDashboard /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/market-analysis" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="market-analysis"><RouteErrorBoundary><MarketAnalysis /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/cmo-report" element={<ProtectedRoute><RouteErrorBoundary><CMOReportPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/ops-advisory" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="ops-advisory"><RouteErrorBoundary><OpsAdvisoryCentre /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/oac" element={<Navigate to="/ops-advisory" replace />} />
        <Route path="/marketing-automation" element={<ProtectedRoute><LaunchRoute access="foundation"><RouteErrorBoundary><MarketingAutomationPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />
        <Route path="/ab-testing" element={<ProtectedRoute><LaunchRoute access="paid" featureKey="ab-testing"><RouteErrorBoundary><ABTestingPage /></RouteErrorBoundary></LaunchRoute></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute adminOnly><RouteErrorBoundary><AdminDashboard /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/admin/pricing" element={<ProtectedRoute adminOnly><RouteErrorBoundary><AdminPricingPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/admin/ux-feedback" element={<ProtectedRoute adminOnly><RouteErrorBoundary><AdminUxFeedbackPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/admin/scope-checkpoints" element={<ProtectedRoute adminOnly><RouteErrorBoundary><AdminScopeCheckpointsPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/admin/prompt-lab" element={<ProtectedRoute adminOnly><RouteErrorBoundary><PromptLab /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/support-admin" element={<ProtectedRoute adminOnly><RouteErrorBoundary><SupportConsolePage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/super-admin/providers" element={<ProtectedRoute adminOnly><RouteErrorBoundary><SuperAdminProviders /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/observability" element={<ProtectedRoute adminOnly><RouteErrorBoundary><ObservabilityPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}

function App() {
  const googleClientId = (process.env.REACT_APP_GOOGLE_CLIENT_ID || '').trim();

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

  const appTree = (
    <BrowserRouter>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <SupabaseAuthProvider>
        <MobileDrawerProvider>
          <InstallPrompt />
          <CookieConsent />
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </MobileDrawerProvider>
      </SupabaseAuthProvider>
    </BrowserRouter>
  );

  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      {appTree}
    </GoogleOAuthProvider>
  ) : (
    appTree
  );
}

export default App;


