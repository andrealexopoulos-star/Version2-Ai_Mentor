/**
 * Single source of truth for route access: path → { minTier, featureKey?, launchType }.
 * Used by tierResolver, LaunchRoute, DashboardLayout, and nav. Add new gated routes here only.
 */
const ROUTE_ACCESS_MAP = {
  // ── Free tier ────────────────────────────────────────────────
  // Phase 6.11 — CC-mandatory signup. Free tier no longer exists as a
  // destination: users either have a trialing/active subscription (>=
  // starter) or they're sent to /subscribe. Routes below stay on 'free'
  // ONLY because they must remain accessible during/after signup:
  //   • Identity + signup flow (calibration, onboarding, profile-import)
  //   • Account self-service (settings — to cancel/reactivate)
  //   • Purchase path (subscribe, upgrade)
  //   • Legal + catalog (biqc-legal, more-features)
  // Everything else lifts to 'starter' — the subscription gate. A user
  // whose tier resolves to 'free' hitting a starter route is redirected
  // to /subscribe.
  '/settings':              { minTier: 'free', launchType: 'free' },
  '/calibration':           { minTier: 'free', launchType: 'free' },
  '/onboarding':            { minTier: 'free', launchType: 'free' },
  '/onboarding-decision':   { minTier: 'free', launchType: 'free' },
  '/profile-import':        { minTier: 'free', launchType: 'free' },
  '/biqc-legal':            { minTier: 'free', launchType: 'free' },
  '/subscribe':             { minTier: 'free', launchType: 'free' },
  '/upgrade':               { minTier: 'free', launchType: 'free' },
  '/more-features':         { minTier: 'free', launchType: 'free' },

  // ── Starter tier (trialing counts) — full platform access ────
  '/advisor':               { minTier: 'starter', launchType: 'free' },
  '/market':                { minTier: 'starter', launchType: 'free' },
  '/business-profile':      { minTier: 'starter', launchType: 'free' },
  '/integrations':          { minTier: 'free', launchType: 'free' },
  '/connect-email':         { minTier: 'starter', launchType: 'free' },
  '/data-health':           { minTier: 'starter', launchType: 'free' },
  '/competitive-benchmark': { minTier: 'starter', launchType: 'free' },
  '/soundboard':            { minTier: 'starter', launchType: 'free' },
  '/email-inbox':           { minTier: 'starter', launchType: 'free' },
  '/calendar':              { minTier: 'starter', launchType: 'free' },
  '/actions':               { minTier: 'starter', launchType: 'free' },
  '/alerts':                { minTier: 'starter', launchType: 'free' },
  '/settings/actions':      { minTier: 'starter', launchType: 'free' },
  '/settings/alerts':       { minTier: 'starter', launchType: 'free' },
  '/cmo-report':            { minTier: 'starter', launchType: 'free' },

  // ── Growth tier ($69 AUD/mo) — foundation access ─────────────
  '/revenue':               { minTier: 'starter', featureKey: 'revenue',                launchType: 'foundation' },
  '/operations':            { minTier: 'starter', featureKey: 'operations',             launchType: 'foundation' },
  '/billing':               { minTier: 'starter', featureKey: 'billing',                launchType: 'foundation' },
  '/reports':               { minTier: 'starter', featureKey: 'reports',                launchType: 'foundation' },
  '/sop-generator':         { minTier: 'starter', featureKey: 'sop-generator',          launchType: 'foundation' },
  '/decisions':             { minTier: 'starter', featureKey: 'decision-tracker',       launchType: 'foundation' },
  '/forensic-audit':        { minTier: 'starter', featureKey: 'ingestion-audit',        launchType: 'foundation' },
  '/exposure-scan':         { minTier: 'starter', featureKey: 'exposure-scan',          launchType: 'foundation' },
  '/marketing-intelligence':{ minTier: 'starter', featureKey: 'marketing-intelligence', launchType: 'foundation' },
  '/marketing-automation':  { minTier: 'starter', featureKey: 'marketing-auto',         launchType: 'foundation' },
  '/board-room':            { minTier: 'starter', featureKey: 'boardroom',              launchType: 'foundation' },

  // ── Professional tier ($199 AUD/mo) — paid access ────────────
  '/risk':                  { minTier: 'pro', featureKey: 'risk-workforce',             launchType: 'paid' },
  '/compliance':            { minTier: 'pro', featureKey: 'compliance',                 launchType: 'paid' },
  '/war-room':              { minTier: 'pro', featureKey: 'war-room',                   launchType: 'paid' },
  '/analysis':              { minTier: 'pro', featureKey: 'analysis',                   launchType: 'paid' },
  '/diagnosis':             { minTier: 'pro', featureKey: 'diagnosis',                  launchType: 'paid' },
  '/automations':           { minTier: 'pro', featureKey: 'automations',                launchType: 'paid' },
  '/documents':             { minTier: 'pro', featureKey: 'documents-library',          launchType: 'paid' },
  '/intel-centre':          { minTier: 'pro', featureKey: 'intel-centre',               launchType: 'paid' },
  '/watchtower':            { minTier: 'pro', featureKey: 'watchtower',                 launchType: 'paid' },
  '/market-analysis':       { minTier: 'pro', featureKey: 'market-analysis',            launchType: 'paid' },
  '/ops-advisory':          { minTier: 'pro', featureKey: 'ops-advisory',               launchType: 'paid' },
  '/operator':              { minTier: 'pro', featureKey: 'operations-intelligence',    launchType: 'paid' },
  '/audit-log':             { minTier: 'pro', featureKey: 'risk-workforce',             launchType: 'paid' },
  '/data-center':           { minTier: 'pro', featureKey: 'watchtower',                 launchType: 'paid' },
  '/intelligence-baseline': { minTier: 'pro', featureKey: 'watchtower',                 launchType: 'paid' },
  '/ab-testing':            { minTier: 'pro', featureKey: 'ab-testing',                 launchType: 'paid' },

  // ── Admin ────────────────────────────────────────────────────
  '/admin':                     { minTier: 'super_admin', launchType: 'free' },
  '/admin/scope-checkpoints':   { minTier: 'super_admin', launchType: 'free' },
  '/admin/pricing':             { minTier: 'super_admin', launchType: 'free' },
  '/admin/ux-feedback':         { minTier: 'super_admin', launchType: 'free' },
  '/admin/prompt-lab':          { minTier: 'super_admin', launchType: 'free' },
  '/support-admin':             { minTier: 'super_admin', launchType: 'free' },
  '/observability':             { minTier: 'super_admin', launchType: 'free' },
  '/auth-debug':                { minTier: 'super_admin', launchType: 'free' },
};

/**
 * @param {string} path - Route path (e.g. /advisor, /revenue)
 * @returns {{ minTier: string, featureKey?: string, launchType: 'free'|'foundation'|'paid'|'waitlist' } | null}
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
