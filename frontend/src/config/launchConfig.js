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
  '/biqc-foundation',
  '/biqc-legal',
  '/more-features',
];

export const FOUNDATION_FEATURES = [
  {
    key: 'exposure-scan',
    title: 'Exposure Scan',
    route: '/exposure-scan',
    summary: 'Maps hidden operational, financial, customer, and positioning exposures before they become expensive surprises.',
    whatItDoes: [
      'Surfaces vulnerable points across customer concentration, data lag, and workflow blind spots.',
      'Translates weak signals into practical owner actions instead of abstract risk language.',
      'Creates an executive view of what is most likely to break first if left unattended.',
    ],
    benefits: ['Fewer blind spots', 'Earlier intervention windows', 'Clearer owner accountability'],
  },
  {
    key: 'marketing-auto',
    title: 'Marketing Auto',
    route: '/marketing-automation',
    summary: 'Automates campaign observation, pressure detection, and performance summarisation for owner-level visibility.',
    whatItDoes: [
      'Monitors campaign performance shifts without waiting for manual reporting cycles.',
      'Highlights spend, reach, and conversion pressure before they quietly compound.',
      'Turns noisy activity into a cleaner operating signal for commercial action.',
    ],
    benefits: ['Less reporting drag', 'Faster campaign response', 'Better use of marketing spend'],
  },
  {
    key: 'reports',
    title: 'Reports',
    route: '/reports',
    summary: 'Builds executive-ready BIQc reports that turn live operating context into a decision document.',
    whatItDoes: [
      'Packages cross-domain signals into readable owner and leadership summaries.',
      'Preserves evidence, decision framing, and consequence paths in one place.',
      'Supports a cleaner reporting rhythm across strategic, operational, and client-facing reviews.',
    ],
    benefits: ['Faster reporting cycles', 'Consistent leadership narrative', 'Reusable board-ready output'],
  },
  {
    key: 'decision-tracker',
    title: 'Decision Tracker',
    route: '/decisions',
    summary: 'Records what was decided, why it was decided, and what happened next so the platform learns from execution.',
    whatItDoes: [
      'Captures strategic and operational decisions in context.',
      'Tracks outcomes against the original signal, rationale, and owner.',
      'Helps reduce repeated decision drift and hindsight bias.',
    ],
    benefits: ['Stronger governance', 'Clearer follow-through', 'Better decision memory'],
  },
  {
    key: 'sop-generator',
    title: 'SOP Generator',
    route: '/sop-generator',
    summary: 'Turns observed working patterns, repeat tasks, and operational intent into usable SOP drafts.',
    whatItDoes: [
      'Converts tribal workflow knowledge into practical operating procedures.',
      'Helps standardise repeatable work without starting from a blank page.',
      'Reduces inconsistency across delegation, handover, and execution quality.',
    ],
    benefits: ['Faster standardisation', 'Cleaner delegation', 'Less execution variance'],
  },
  {
    key: 'ingestion-audit',
    title: 'Ingestion Audit',
    route: '/forensic-audit',
    summary: 'Checks whether BIQc is reading the right signals from the right systems and flags ingestion confidence issues early.',
    whatItDoes: [
      'Reviews data intake freshness, object coverage, and source stability.',
      'Helps identify missing fields, stale sync windows, and ingestion drift.',
      'Supports weekly catch-up discipline around what BIQc can and cannot currently trust.',
    ],
    benefits: ['Better truth assurance', 'Fewer stale-data surprises', 'Stronger weekly operating review'],
  },
  {
    key: 'revenue',
    title: 'Revenue',
    route: '/revenue',
    summary: 'Brings pipeline, conversion, and commercial timing into one focused operating surface.',
    whatItDoes: [
      'Highlights stalled pipeline, forecast pressure, and deal ageing patterns.',
      'Surfaces commercial friction before it hits cash timing and growth confidence.',
      'Translates revenue telemetry into next-action sequences, not just charts.',
    ],
    benefits: ['Higher forecast confidence', 'Faster commercial intervention', 'Cleaner pipeline discipline'],
  },
  {
    key: 'operations',
    title: 'Operations',
    route: '/operations',
    summary: 'Shows where delivery, workflow, and operating cadence are starting to break down.',
    whatItDoes: [
      'Tracks operational strain, bottlenecks, and repeat execution friction.',
      'Helps leadership see which systems issues are creating downstream pressure.',
      'Supports intervention before service quality and team throughput degrade.',
    ],
    benefits: ['Earlier ops intervention', 'Less hidden delivery drift', 'Better operating cadence'],
  },
  {
    key: 'marketing-intelligence',
    title: 'Marketing Intelligence',
    route: '/marketing-intelligence',
    summary: 'Adds a deeper marketing signal layer for channel pressure, positioning context, and growth intelligence.',
    whatItDoes: [
      'Connects campaign movement to commercial pressure and market response.',
      'Helps identify what messaging, channel, or position is losing traction.',
      'Reduces the lag between marketing performance drift and executive response.',
    ],
    benefits: ['Sharper positioning awareness', 'Better channel decisions', 'More accountable growth signals'],
  },
  {
    key: 'boardroom',
    title: 'Boardroom',
    route: '/board-room',
    summary: 'Elevates BIQc signals into an executive synthesis layer for strategic framing and owner-level decisions.',
    whatItDoes: [
      'Combines cross-domain pressure into a concise strategic narrative.',
      'Shows why BIQc is escalating a given issue and what happens if it is ignored.',
      'Provides a cleaner executive decision surface when the truth engine is live-verified.',
    ],
    benefits: ['Clearer executive framing', 'Less strategic noise', 'More confident board-level discussion'],
  },
];

export const FOUNDATION_ROUTE_MAP = FOUNDATION_FEATURES.reduce((acc, feature) => {
  acc[feature.route] = feature;
  return acc;
}, {});

export const PAID_LAUNCH_ROUTES = FOUNDATION_FEATURES.map((feature) => feature.route);

export const WAITLIST_FEATURES = [
  {
    key: 'risk-workforce',
    title: 'Risk & Workforce',
    route: '/risk',
    category: 'Risk',
    about: 'Unifies financial, people, and concentration risk into one early-warning operating layer.',
    features: ['Cross-domain risk scoring', 'Workforce strain signals', 'Customer concentration detection', 'Scenario risk interpretation'],
  },
  {
    key: 'compliance',
    title: 'Compliance',
    route: '/compliance',
    category: 'Risk',
    about: 'Tracks operational, legal, and policy-alignment drift before it becomes a governance issue.',
    features: ['Compliance drift signals', 'Control reminders', 'Policy alignment view', 'Executive governance prompts'],
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
    key: 'analysis',
    title: 'Analysis',
    route: '/analysis',
    category: 'Intelligence',
    about: 'Structured analysis workflows that break down root causes, contradictions, and opportunity windows.',
    features: ['Cause isolation', 'Strategic analysis frames', 'Contradiction mapping', 'Opportunity deep-dives'],
  },
  {
    key: 'diagnosis',
    title: 'Diagnosis',
    route: '/diagnosis',
    category: 'Intelligence',
    about: 'Focused diagnosis modules for interrogating one business pressure area at a time.',
    features: ['Domain diagnosis', 'Pressure-specific guidance', 'Next-step framing', 'Issue decomposition'],
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
    features: ['Competitive reconnaissance', 'Market mapping', 'Positioning review', 'Opportunity scan'],
  },
  {
    key: 'ops-advisory',
    title: 'Ops Advisory Centre',
    route: '/ops-advisory',
    category: 'Execution',
    about: 'Expanded operations advisory workspace for teams who need deeper process intervention support.',
    features: ['Ops playbooks', 'Bottleneck coaching', 'Escalation review', 'Advisory workflows'],
  },
];

export const WAITLIST_ROUTE_MAP = WAITLIST_FEATURES.reduce((acc, feature) => {
  acc[feature.route] = feature;
  return acc;
}, {});

export const PAID_LAUNCH_FEATURES = [
  'Everything in Free',
  ...FOUNDATION_FEATURES.map((feature) => feature.title),
  'Up to 5 integrations',
];

export const LEGAL_TABS = [
  {
    id: 'overview',
    label: 'Overview',
    title: 'BIQc Legal Overview',
    summary: 'A single operating view for trust, privacy, security, legal terms, and enterprise commitments.',
    sections: [
      {
        title: 'Australian Jurisdiction',
        body: 'BIQc legal obligations, privacy expectations, and dispute framing are positioned around Australian law and Australian operating context.',
        bullets: ['New South Wales governing law', 'Australian-hosted trust posture', 'No hidden offshore legal framing'],
      },
      {
        title: 'Practical Use',
        body: 'This page consolidates all legal reading into one lower-cognitive-load location for founders, operators, and reviewers.',
        bullets: ['One page, multiple legal tabs', 'Quick topic switching', 'Direct legal contact point'],
      },
    ],
  },
  {
    id: 'ai-learning',
    label: 'AI Learning Guarantee',
    title: 'AI Learning Guarantee',
    summary: 'Your data is not used to train public AI models, and BIQc positions customer context as isolated operating intelligence.',
    sections: [
      {
        title: 'Core Guarantee',
        body: 'Customer prompts, uploads, and outputs are framed as private operating context rather than public training data.',
        bullets: ['No public model training from customer inputs', 'Outputs remain customer intellectual property', 'Account-level isolation'],
      },
      {
        title: 'Processing Position',
        body: 'BIQc is described as a stateless, request-based processing environment with no residual global learning expectation from customer activity.',
        bullets: ['Transient processing intention', 'Private intelligence handling', 'No shared training loop'],
      },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    title: 'Security & Infrastructure',
    summary: 'Security posture across encryption, hosting, access control, network protection, monitoring, and incident response.',
    sections: [
      {
        title: 'Infrastructure',
        body: 'BIQc is framed as enterprise-grade infrastructure hosted within Australian data centres with availability and security in mind.',
        bullets: ['Australian-hosted infrastructure', 'High-availability posture', 'Environment isolation'],
      },
      {
        title: 'Controls',
        body: 'The platform security story covers encryption, role-based access, session management, and network protection.',
        bullets: ['AES-256 at rest', 'TLS in transit', 'Role-based access controls', 'Monitoring and incident response'],
      },
    ],
  },
  {
    id: 'trust-centre',
    label: 'Trust Centre',
    title: 'Trust Centre',
    summary: 'Centralised trust position for data sovereignty, uptime posture, sub-processor context, and security transparency.',
    sections: [
      {
        title: 'Data Sovereignty',
        body: 'The trust centre frames BIQc as Australian-owned, Australian-hosted, and designed to limit unnecessary data movement.',
        bullets: ['Australian data hosting', 'No marketing resale of data', 'Sovereign operating posture'],
      },
      {
        title: 'Reliability',
        body: 'Trust is not just legal language — it also depends on uptime, resilience, and operational clarity.',
        bullets: ['Uptime target framing', 'Backups and recovery expectations', 'Security review posture'],
      },
    ],
  },
  {
    id: 'dpa',
    label: 'DPA',
    title: 'Data Processing Agreement',
    summary: 'Defines controller/processor relationships, categories of data, security posture, and retention boundaries.',
    sections: [
      {
        title: 'Processing Scope',
        body: 'Data is positioned as being processed solely for the purpose of delivering BIQc services and intelligence outputs.',
        bullets: ['Controller / processor clarity', 'Purpose limitation', 'Customer data categories'],
      },
      {
        title: 'Retention & Security',
        body: 'The DPA frames how long data is retained, when it is deleted, and what protection commitments apply during processing.',
        bullets: ['Retention boundary', 'Deletion timing', 'Sub-processor expectations', 'Security measures'],
      },
    ],
  },
  {
    id: 'privacy',
    label: 'Privacy',
    title: 'Privacy Policy',
    summary: 'Explains what BIQc collects, why it is collected, how it is stored, and what rights users retain.',
    sections: [
      {
        title: 'Information Collected',
        body: 'BIQc privacy scope includes account identity, business profile information, and connected business-system data required for the service.',
        bullets: ['Account information', 'Business data via integrations', 'Operational and communication telemetry'],
      },
      {
        title: 'Rights & Contact',
        body: 'Users retain rights to access, correct, delete, and question how their data is handled.',
        bullets: ['Access and correction rights', 'Deletion requests', 'Withdrawal of consent', 'Privacy Officer contact'],
      },
    ],
  },
  {
    id: 'terms',
    label: 'Terms',
    title: 'Terms & Conditions',
    summary: 'Sets the platform use terms, disclaimers, responsibilities, and limitation-of-liability framing for BIQc use.',
    sections: [
      {
        title: 'General Information Only',
        body: 'The platform is framed as providing general information and educational content, not personal legal, tax, or financial advice.',
        bullets: ['No professional advice substitute', 'Independent verification expected', 'AI-generated content may contain errors'],
      },
      {
        title: 'Liability & Responsibility',
        body: 'The terms define customer responsibility for decisions and outline liability boundaries under Australian law.',
        bullets: ['Limitation of liability', 'Customer decision responsibility', 'NSW governing law'],
      },
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise Terms',
    title: 'Enterprise Terms',
    summary: 'Enterprise-grade contractual framing for customer content, fees, confidentiality, ACL, and data use.',
    sections: [
      {
        title: 'Customer Content & Fees',
        body: 'Enterprise terms position customer input/output ownership, usage boundaries, and commercial fee expectations.',
        bullets: ['Customer owns input and output', 'No model training on customer content', 'Fees and GST framing'],
      },
      {
        title: 'Confidentiality & ACL',
        body: 'Enterprise commitments also define confidentiality, privacy handling, Australian Consumer Law alignment, and termination rules.',
        bullets: ['Confidentiality obligations', 'ACL guarantees', 'Termination process', 'NSW jurisdiction'],
      },
    ],
  },
];