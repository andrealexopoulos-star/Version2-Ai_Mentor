export const FREE_LAUNCH_ROUTES = [
  '/advisor',
  '/soundboard',
  '/email-inbox',
  '/calendar',
  '/market',
  '/business-profile',
  '/actions',
  '/alerts',
  '/data-health',
  '/settings',
  '/competitive-benchmark',
  '/integrations',
  '/connect-email',
];

export const PAID_LAUNCH_ROUTES = [
  '/exposure-scan',
  '/marketing-automation',
  '/reports',
  '/sop-generator',
  '/decisions',
  '/forensic-audit',
];

export const WAITLIST_FEATURES = [
  {
    key: 'revenue-engine',
    title: 'Revenue Engine',
    route: '/revenue',
    category: 'Growth',
    about: 'Converts pipeline, pricing, and conversion telemetry into a focused commercial control surface.',
    features: ['Pipeline pressure mapping', 'Deal ageing analysis', 'Conversion bottleneck detection', 'Forecast-quality guidance'],
  },
  {
    key: 'operations-intelligence',
    title: 'Operations Intelligence',
    route: '/operations',
    category: 'Execution',
    about: 'Surfaces bottlenecks, workflow drift, and delivery friction before they hit service quality.',
    features: ['Workflow bottleneck alerts', 'Delivery pressure signals', 'SLA drift monitoring', 'Execution cadence health'],
  },
  {
    key: 'risk-workforce',
    title: 'Risk & Workforce',
    route: '/risk',
    category: 'Risk',
    about: 'Unifies financial, people, and concentration risk into one early-warning operating layer.',
    features: ['Cross-domain risk scoring', 'Workforce strain signals', 'Customer concentration detection', 'Scenario risk interpretation'],
  },
  {
    key: 'board-room',
    title: 'Board Room',
    route: '/board-room',
    category: 'Strategy',
    about: 'Executive synthesis surface for strategic pressure, contradictions, and decision framing.',
    features: ['Board-level synthesis', 'Decision framing', 'Explainability strips', 'Forensic truth gating'],
  },
  {
    key: 'war-room',
    title: 'War Room',
    route: '/war-room',
    category: 'Strategy',
    about: 'High-intensity interrogation console for decisive strategic questions across business domains.',
    features: ['Live strategic Q&A', 'High-stakes interrogation', 'Cross-domain reasoning', 'Truth-constrained answers'],
  },
  {
    key: 'intel-centre',
    title: 'Intel Centre',
    route: '/intel-centre',
    category: 'Intelligence',
    about: 'Central operating feed for deeper intelligence traces, source context, and emerging signals.',
    features: ['Signal feed view', 'Context drill-down', 'Business telemetry trace', 'Forensic review workflows'],
  },
  {
    key: 'analysis-diagnosis-suite',
    title: 'Analysis & Diagnosis Suite',
    route: '/analysis',
    category: 'Intelligence',
    about: 'Structured analysis modules that break down root causes, contradictions, and opportunity windows.',
    features: ['Diagnostic workflows', 'Cause isolation', 'Strategic analysis frames', 'Opportunity deep-dives'],
  },
  {
    key: 'automations',
    title: 'Automations',
    route: '/automations',
    category: 'Execution',
    about: 'Turns trusted BIQc signals into actions, escalations, and team follow-through patterns.',
    features: ['Action automations', 'Escalation triggers', 'Workflow orchestration', 'Response timing controls'],
  },
  {
    key: 'documents-library',
    title: 'Documents Library',
    route: '/documents',
    category: 'Knowledge',
    about: 'Working document environment for generated material, strategic notes, and reference assets.',
    features: ['Document generation', 'Knowledge reference', 'Strategic notes', 'Executive outputs'],
  },
  {
    key: 'watchtower',
    title: 'Watchtower',
    route: '/watchtower',
    category: 'Monitoring',
    about: 'Always-on signal observation layer for emerging drift, anomalies, and silent pressure.',
    features: ['Continuous monitoring', 'Anomaly detection', 'Pressure alerts', 'Signal evidence chain'],
  },
  {
    key: 'market-analysis',
    title: 'Market Analysis',
    route: '/market-analysis',
    category: 'Market',
    about: 'Deeper market reconnaissance and competitive context beyond the launch free surfaces.',
    features: ['Competitive reconnaissance', 'Market mapping', 'Positioning review', 'Growth opportunity scan'],
  },
  {
    key: 'ops-advisory',
    title: 'Ops Advisory Centre',
    route: '/ops-advisory',
    category: 'Execution',
    about: 'Expanded operations advisory workspace for teams who need deeper process intervention support.',
    features: ['Ops playbooks', 'Bottleneck coaching', 'Escalation review', 'Advisory workflows'],
  },
  {
    key: 'marketing-intelligence',
    title: 'Marketing Intelligence',
    route: '/marketing-intelligence',
    category: 'Growth',
    about: 'Marketing insight workspace for channel pressure, campaign context, and positioning analysis.',
    features: ['Channel insight', 'Campaign pressure signals', 'Positioning context', 'Growth intelligence review'],
  },
];

export const WAITLIST_ROUTE_MAP = WAITLIST_FEATURES.reduce((acc, feature) => {
  acc[feature.route] = feature;
  return acc;
}, {});

export const PAID_LAUNCH_FEATURES = [
  'Everything in Free',
  'Exposure Scan',
  'Marketing Auto',
  'Reports',
  'SOP Generator',
  'Decision Tracker',
  'Ingestion Audit',
  'Weekly Check-Ups',
  'Up to 5 integrations',
];

export const LEGAL_TABS = [
  {
    id: 'overview',
    label: 'Overview',
    title: 'BIQc Legal Overview',
    body: 'A single operating view for BIQc legal, trust, privacy, and platform terms. This page reduces cognitive load by keeping all legal reading in one structured place.',
    bullets: ['Australian jurisdiction', 'General information only — not legal or financial advice', 'Sovereign-hosted trust model', 'Single contact point for legal and privacy questions'],
  },
  {
    id: 'security',
    label: 'Security',
    title: 'Security & Infrastructure',
    body: 'BIQc is positioned as a sovereign intelligence platform with Australian-hosted infrastructure, encryption at rest and in transit, and isolated customer intelligence handling.',
    bullets: ['AES-256 encryption', 'Australian hosting posture', 'Minimal collection and compartmentalisation', 'Operational trust controls and revocation pathways'],
  },
  {
    id: 'privacy',
    label: 'Privacy',
    title: 'Privacy & Data Handling',
    body: 'Your business data is handled under Australian privacy expectations. BIQc is designed to reduce leakage, keep customer context siloed, and avoid using customer data for general model training.',
    bullets: ['Australian Privacy Principles alignment', 'Customer data portability', 'No model training on customer content', 'Deletion and revocation expectations'],
  },
  {
    id: 'dpa',
    label: 'DPA',
    title: 'Data Processing Addendum',
    body: 'The DPA position defines how BIQc handles customer content, processors, security responsibilities, and data handling boundaries when operating as a business intelligence platform.',
    bullets: ['Processor / controller clarity', 'Security commitments', 'Confidentiality expectations', 'Incident and deletion handling'],
  },
  {
    id: 'terms',
    label: 'Terms',
    title: 'Terms & Conditions',
    body: 'Platform use is governed by terms covering service use, liability boundaries, AI-generated content disclaimers, governing law, and customer responsibilities.',
    bullets: ['General information only', 'No substitute for professional advice', 'Limitation of liability', 'Customer verification responsibility'],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    title: 'Enterprise Terms',
    body: 'Enterprise terms cover customer content ownership, no-training commitments, Australian law, confidentiality, commercial fees, and enterprise-grade operating expectations.',
    bullets: ['Customer owns input/output', 'No model training on customer content', 'Australian law / NSW jurisdiction', 'Enterprise confidentiality and security posture'],
  },
];