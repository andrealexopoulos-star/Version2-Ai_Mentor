import ROUTE_ACCESS_MAP from './routeAccessConfig';
import { TIER_FEATURES } from './tiers';

const toTitle = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const deriveFeatureLabel = (path, featureKey) => {
  if (featureKey) return toTitle(featureKey);
  const normalizedPath = String(path || '').replace(/^\//, '');
  if (!normalizedPath) return 'Home';
  return toTitle(normalizedPath);
};

/**
 * Route registry mirrored from App routing so super admin can review every page route in one file.
 * Keep this in sync with frontend/src/App.js when routes change.
 */
const APP_ROUTE_PATHS = [
  '/',
  '/platform',
  '/intelligence',
  '/our-integrations',
  '/pricing',
  '/trust',
  '/trust/ai-learning-guarantee',
  '/trust/terms',
  '/trust/privacy',
  '/trust/dpa',
  '/trust/security',
  '/trust/centre',
  '/contact',
  '/knowledge-base',
  '/blog',
  '/blog/:slug',
  '/landing-intelligent',
  '/terms',
  '/enterprise-terms',
  '/cognitive-v2-preview',
  '/loading-preview',
  '/calibration-preview',
  '/platform/login',
  '/platform/overview',
  '/platform/revenue',
  '/platform/alerts',
  '/platform/automations',
  '/platform/integrations-demo',
  '/platform/industry/msp',
  '/platform/industry/construction',
  '/platform/industry/consulting',
  '/platform/industry/agency',
  '/platform/industry/saas',
  '/site/trust/terms',
  '/site/trust/privacy',
  '/site/trust/dpa',
  '/site/trust/security',
  '/site/trust/centre',
  '/site/trust',
  '/site',
  '/site/*',
  '/login-supabase',
  '/register-supabase',
  '/reset-password',
  '/update-password',
  '/auth/callback',
  '/login',
  '/register',
  '/onboarding-decision',
  '/onboarding',
  '/calibration',
  '/profile-import',
  '/subscribe',
  '/upgrade',
  '/upgrade/success',
  '/biqc-foundation',
  '/more-features',
  '/biqc-legal',
  '/advisor',
  '/dashboard',
  '/market',
  '/market/calibration',
  '/business-profile',
  '/integrations',
  '/connect-email',
  '/data-health',
  '/forensic-audit',
  '/exposure-scan',
  '/marketing-intelligence',
  '/settings',
  '/calendar',
  '/competitive-benchmark',
  '/revenue',
  '/billing',
  '/operations',
  '/risk',
  '/compliance',
  '/reports',
  '/audit-log',
  '/alerts',
  '/actions',
  '/settings/alerts',
  '/settings/actions',
  '/automations',
  '/soundboard',
  '/email-inbox',
  '/war-room',
  '/board-room',
  '/warroom',
  '/boardroom',
  '/sop-generator',
  '/decisions',
  '/diagnosis',
  '/analysis',
  '/documents',
  '/documents/:id',
  '/data-center',
  '/intel-centre',
  '/watchtower',
  '/intelligence-baseline',
  '/operator',
  '/market-analysis',
  '/ops-advisory',
  '/oac',
  '/marketing-automation',
  '/ab-testing',
  '/admin',
  '/admin/pricing',
  '/admin/ux-feedback',
  '/admin/scope-checkpoints',
  '/admin/prompt-lab',
  '/support-admin',
  '/observability',
  '*',
];

const PREVIEW_ONLY_PATHS = new Set([
  '/cognitive-v2-preview',
  '/loading-preview',
  '/calibration-preview',
]);

/**
 * Every page route in one list, merged with route access metadata when available.
 */
export const SUPER_ADMIN_ALL_PAGES = [
  ...new Set([...APP_ROUTE_PATHS, ...Object.keys(ROUTE_ACCESS_MAP)]),
]
  .map((path) => {
    const config = ROUTE_ACCESS_MAP[path];
    return {
      id: path === '/' ? 'home' : path.replace(/[^a-zA-Z0-9]+/g, '_'),
      path,
      featureKey: config?.featureKey || null,
      featureLabel: deriveFeatureLabel(path, config?.featureKey),
      minTier: config?.minTier || 'public_or_redirect',
      launchType: config?.launchType || 'public_or_redirect',
      isPreviewRoute: PREVIEW_ONLY_PATHS.has(path),
      isDynamicRoute: path.includes(':') || path.endsWith('*'),
      superAdminAccess: true,
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

/**
 * Single-file super admin catalog for BIQc product/features.
 * Super admin can access every route listed here regardless of minTier.
 */
export const SUPER_ADMIN_PRODUCT_FEATURES = Object.entries(ROUTE_ACCESS_MAP)
  .map(([path, config]) => ({
    id: config.featureKey || path.replace(/[^a-zA-Z0-9]+/g, '_'),
    path,
    featureKey: config.featureKey || null,
    featureLabel: deriveFeatureLabel(path, config.featureKey),
    minTier: config.minTier,
    launchType: config.launchType,
    superAdminAccess: true,
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

export const SUPER_ADMIN_FEATURES_BY_LAUNCH_TYPE = SUPER_ADMIN_PRODUCT_FEATURES.reduce(
  (acc, feature) => {
    const key = feature.launchType || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(feature);
    return acc;
  },
  {}
);

/**
 * Feature bundles shown per tier in product/pricing UI.
 * Included here so super admin can review both route-level and bundle-level features in one file.
 */
export const SUPER_ADMIN_TIER_BUNDLE_FEATURES = Object.entries(TIER_FEATURES).map(
  ([tierId, features]) => ({
    tierId,
    superAdminCanView: true,
    features: Array.isArray(features) ? [...features] : [],
  })
);

export const SUPER_ADMIN_FEATURE_KEYS = [
  ...new Set(
    SUPER_ADMIN_PRODUCT_FEATURES
      .map((item) => item.featureKey)
      .filter(Boolean)
  ),
].sort();

export const SUPER_ADMIN_CATALOG = {
  pages: SUPER_ADMIN_ALL_PAGES,
  productFeatures: SUPER_ADMIN_PRODUCT_FEATURES,
  featureKeys: SUPER_ADMIN_FEATURE_KEYS,
  byLaunchType: SUPER_ADMIN_FEATURES_BY_LAUNCH_TYPE,
  tierBundles: SUPER_ADMIN_TIER_BUNDLE_FEATURES,
};

export default SUPER_ADMIN_PRODUCT_FEATURES;
