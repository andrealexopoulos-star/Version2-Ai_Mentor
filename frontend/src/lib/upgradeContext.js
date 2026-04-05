const DEFAULT_FOUNDATION = {
  title: 'BIQc Foundation',
  benefit: 'add deeper operating modules and up to 5 integrations',
  cta: 'Unlock BIQc Foundation',
  href: '/subscribe?section=foundation',
};

const CONTEXT_BY_FEATURE = {
  trinity: {
    title: 'BIQc Trinity',
    benefit: 'get consensus intelligence across BIQc model pathways',
    cta: 'Unlock BIQc Trinity',
    href: '/subscribe?section=foundation',
  },
  reports: {
    title: 'Reports',
    benefit: 'generate board-ready intelligence from verified data',
    cta: 'Unlock Reports',
    href: '/subscribe?section=foundation&feature=reports',
  },
  revenue: {
    title: 'Revenue',
    benefit: 'surface pipeline pressure before it impacts cash timing',
    cta: 'Unlock Revenue',
    href: '/subscribe?section=foundation&feature=revenue',
  },
  operations: {
    title: 'Operations',
    benefit: 'catch delivery bottlenecks before they compound',
    cta: 'Unlock Operations',
    href: '/subscribe?section=foundation&feature=operations',
  },
  'marketing-intelligence': {
    title: 'Marketing Intelligence',
    benefit: 'connect channel performance to commercial decisions',
    cta: 'Unlock Marketing Intelligence',
    href: '/subscribe?section=foundation&feature=marketing-intelligence',
  },
};

export function getUpgradeContext(featureKey = '') {
  if (!featureKey) return DEFAULT_FOUNDATION;
  return CONTEXT_BY_FEATURE[featureKey] || {
    ...DEFAULT_FOUNDATION,
    title: featureKey,
    cta: `Unlock ${featureKey}`,
  };
}
