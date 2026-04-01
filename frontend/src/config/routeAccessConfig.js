/**
 * Single source of truth for route access: path → { minTier, featureKey?, launchType }.
 * Used by tierResolver, LaunchRoute, DashboardLayout, and nav. Add new gated routes here only.
 */
const ROUTE_ACCESS_MAP = {
  // Free
  '/advisor': { minTier: 'free', launchType: 'free' },
  '/market': { minTier: 'free', launchType: 'free' },
  '/business-profile': { minTier: 'free', launchType: 'free' },
  '/settings': { minTier: 'free', launchType: 'free' },
  '/integrations': { minTier: 'free', launchType: 'free' },
  '/connect-email': { minTier: 'free', launchType: 'free' },
  '/data-health': { minTier: 'free', launchType: 'free' },
  '/competitive-benchmark': { minTier: 'free', launchType: 'free' },
  '/ask-biqc': { minTier: 'free', launchType: 'free' },
  '/soundboard': { minTier: 'free', launchType: 'free' },
  '/email-inbox': { minTier: 'free', launchType: 'free' },
  '/calendar': { minTier: 'free', launchType: 'free' },
  '/actions': { minTier: 'free', launchType: 'free' },
  '/alerts': { minTier: 'free', launchType: 'free' },
  '/calibration': { minTier: 'free', launchType: 'free' },
  '/onboarding': { minTier: 'free', launchType: 'free' },
  '/onboarding-decision': { minTier: 'free', launchType: 'free' },
  '/profile-import': { minTier: 'free', launchType: 'free' },
  '/biqc-legal': { minTier: 'free', launchType: 'free' },
  '/more-features': { minTier: 'free', launchType: 'free' },
  // Foundation (paid / starter)
  '/exposure-scan': { minTier: 'starter', featureKey: 'exposure-scan', launchType: 'foundation' },
  '/marketing-automation': { minTier: 'starter', featureKey: 'marketing-auto', launchType: 'foundation' },
  '/reports': { minTier: 'starter', featureKey: 'reports', launchType: 'foundation' },
  '/sop-generator': { minTier: 'starter', featureKey: 'sop-generator', launchType: 'foundation' },
  '/decisions': { minTier: 'starter', featureKey: 'decision-tracker', launchType: 'foundation' },
  '/forensic-audit': { minTier: 'starter', featureKey: 'ingestion-audit', launchType: 'foundation' },
  '/revenue': { minTier: 'starter', featureKey: 'revenue', launchType: 'foundation' },
  '/operations': { minTier: 'starter', featureKey: 'operations', launchType: 'foundation' },
  '/marketing-intelligence': { minTier: 'starter', featureKey: 'marketing-intelligence', launchType: 'foundation' },
  '/board-room': { minTier: 'starter', featureKey: 'boardroom', launchType: 'foundation' },
  // Waitlist
  '/risk': { minTier: 'starter', featureKey: 'risk-workforce', launchType: 'waitlist' },
  '/compliance': { minTier: 'starter', featureKey: 'compliance', launchType: 'waitlist' },
  '/war-room': { minTier: 'starter', featureKey: 'war-room', launchType: 'waitlist' },
  '/intel-centre': { minTier: 'starter', featureKey: 'intel-centre', launchType: 'waitlist' },
  '/analysis': { minTier: 'starter', featureKey: 'analysis', launchType: 'waitlist' },
  '/diagnosis': { minTier: 'starter', featureKey: 'diagnosis', launchType: 'waitlist' },
  '/automations': { minTier: 'starter', featureKey: 'automations', launchType: 'waitlist' },
  '/documents': { minTier: 'starter', featureKey: 'documents-library', launchType: 'waitlist' },
  '/watchtower': { minTier: 'starter', featureKey: 'watchtower', launchType: 'waitlist' },
  '/market-analysis': { minTier: 'starter', featureKey: 'market-analysis', launchType: 'waitlist' },
  '/ops-advisory': { minTier: 'starter', featureKey: 'ops-advisory', launchType: 'waitlist' },
  '/operator': { minTier: 'starter', featureKey: 'operations-intelligence', launchType: 'waitlist' },
  '/audit-log': { minTier: 'starter', featureKey: 'risk-workforce', launchType: 'waitlist' },
  '/data-center': { minTier: 'starter', featureKey: 'watchtower', launchType: 'waitlist' },
  '/intelligence-baseline': { minTier: 'starter', featureKey: 'watchtower', launchType: 'waitlist' },
  '/ab-testing': { minTier: 'starter', featureKey: 'watchtower', launchType: 'waitlist' },
  // Admin
  '/admin': { minTier: 'super_admin', launchType: 'free' },
  '/auth-debug': { minTier: 'super_admin', launchType: 'free' },
};

/**
 * @param {string} path - Route path (e.g. /advisor, /revenue)
 * @returns {{ minTier: string, featureKey?: string, launchType: 'free'|'foundation'|'waitlist' } | null}
 */
export function getRouteAccess(path) {
  if (!path) return null;
  const normalized = path.replace(/\/$/, '') || '/';
  // Exact match
  if (ROUTE_ACCESS_MAP[normalized]) return ROUTE_ACCESS_MAP[normalized];
  // Prefix match (e.g. /documents/123 → /documents)
  for (const [route, config] of Object.entries(ROUTE_ACCESS_MAP)) {
    if (normalized === route || normalized.startsWith(route + '/')) return config;
  }
  return null;
}

/**
 * All routes that require at least starter (for nav/lists).
 */
export function getRoutesByMinTier(minTier) {
  return Object.entries(ROUTE_ACCESS_MAP)
    .filter(([, config]) => config.minTier === minTier)
    .map(([path]) => path);
}

export default ROUTE_ACCESS_MAP;
