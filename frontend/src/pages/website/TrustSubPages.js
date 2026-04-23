import React from 'react';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const HEADING = 'var(--font-display)';
const BODY = 'var(--font-ui)';


// Trust-page typography colors.
// The page previously used dark-mode colors (#FFFFFF title, #EDF1F7 headings,
// #8FA0B8 body) on a light canvas \u2014 making legal pages (Terms, Privacy, DPA,
// Security, Refund) effectively unreadable. Switched to the light-mode
// accessible palette. H1/H2/H3 at ink-display, body at ink-secondary, all
// passing WCAG AA against the light canvas.
const TEXT_DISPLAY = '#0A0A0A';     // primary heading (high-contrast)
const TEXT_HEADING = '#171717';     // section headings
const TEXT_BODY = '#374151';        // body prose (min 7:1 against white)
const TEXT_META = '#6B7280';        // timestamp / meta (4.6:1)
const LINK_MUTED = '#374151';

const TrustPageShell = ({ title, lastUpdated, children }) => (
  <WebsiteLayout>
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-6">
        <Link to="/trust" className="inline-flex items-center gap-2 text-sm hover:text-[#E85D00] transition-colors mb-8" style={{ fontFamily: fontFamily.mono, color: LINK_MUTED }}>
          <ArrowLeft className="w-4 h-4" /> Back to Trust
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ fontFamily: fontFamily.display, color: TEXT_DISPLAY }}>{title}</h1>
        <p className="text-xs mb-10" style={{ fontFamily: fontFamily.mono, color: TEXT_META }}>Last updated: {lastUpdated}</p>
        <div className="prose-steel space-y-6">{children}</div>
      </div>
    </section>
    <style>{`
      .prose-steel h2 { font-family: ${HEADING}; font-size: 1.25rem; font-weight: 700; color: ${TEXT_HEADING}; margin-top: 2.5rem; margin-bottom: 0.75rem; }
      .prose-steel h3 { font-family: ${HEADING}; font-size: 1rem; font-weight: 600; color: ${TEXT_HEADING}; margin-top: 1.5rem; margin-bottom: 0.5rem; }
      .prose-steel p { font-family: ${BODY}; font-size: 0.9375rem; line-height: 1.7; color: ${TEXT_BODY}; }
      .prose-steel ul { list-style: none; padding: 0; }
      .prose-steel li { font-family: ${BODY}; font-size: 0.9375rem; color: ${TEXT_BODY}; padding-left: 1.25rem; position: relative; margin-bottom: 0.5rem; line-height: 1.6; }
      .prose-steel li::before { content: ''; position: absolute; left: 0; top: 0.6rem; width: 4px; height: 4px; border-radius: 50%; background: #E85D00; }
      .prose-steel a { color: #E85D00; text-decoration: underline; }
      .prose-steel strong { color: ${TEXT_HEADING}; }
    `}</style>
  </WebsiteLayout>
);

export const TermsPage = () => (
  <TrustPageShell title="Terms & Conditions" lastUpdated="February 2026">
    <h2>1. Agreement to Terms</h2>
    <p>By accessing or using BIQc (&ldquo;the Platform&rdquo;), provided by Business Intelligence Quotient Centre Pty Ltd (ABN available on request), you agree to be bound by these Terms & Conditions. If you do not agree, you must not use the Platform.</p>
    <h2>2. Platform Description</h2>
    <p>BIQc is an autonomous business intelligence platform that connects to your business systems, analyses operational data, and provides actionable intelligence. The Platform is provided as a subscription service (SaaS).</p>
    <h2>3. Eligibility</h2>
    <p>You must be at least 18 years of age and have the legal capacity to enter into binding agreements. You represent that you have authority to bind your organisation to these terms.</p>
    <h2>4. Subscription & Payment</h2>
    <ul>
      <li>Subscriptions are billed monthly or annually as selected at sign-up</li>
      <li>All prices are in Australian Dollars (AUD) unless otherwise stated</li>
      <li>You may cancel at any time; access continues until the end of the current billing period</li>
      <li>No refunds for partial billing periods</li>
    </ul>
    <h2>5. Data Ownership</h2>
    <p>All business data you connect to BIQc remains your intellectual property. We do not claim ownership of any data you process through the Platform. You grant us a limited licence to process your data solely for the purpose of providing the Platform services.</p>
    <h2>6. Acceptable Use</h2>
    <p>You agree not to use the Platform for any unlawful purpose, to transmit malicious code, to attempt to gain unauthorised access, or to interfere with the Platform's operations.</p>
    <h2>7. Limitation of Liability</h2>
    <p>To the maximum extent permitted by Australian law, BIQc's liability is limited to the amount paid by you in the 12 months preceding the claim. We are not liable for indirect, consequential, or incidental damages.</p>
    <h2>8. Governing Law</h2>
    <p>These terms are governed by the laws of New South Wales, Australia. Any disputes will be resolved in the courts of New South Wales.</p>
  </TrustPageShell>
);

export const PrivacyPage = () => (
  <TrustPageShell title="Privacy Policy" lastUpdated="February 2026">
    <h2>1. Introduction</h2>
    <p>Business Intelligence Quotient Centre Pty Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is committed to protecting your privacy. This policy describes how we collect, use, and safeguard personal and business information in compliance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).</p>
    <h2>2. Information We Collect</h2>
    <h3>Personal Information</h3>
    <ul>
      <li>Name, email address, phone number</li>
      <li>Company name, role, and business details</li>
      <li>Authentication credentials (encrypted)</li>
    </ul>
    <h3>Business Data (via integrations)</h3>
    <ul>
      <li>Financial records (invoices, transactions, cash flow)</li>
      <li>CRM data (pipeline, contacts, deals)</li>
      <li>Operational metrics (tasks, utilisation, delivery)</li>
      <li>Communication metadata (email patterns, response times)</li>
    </ul>
    <h2>3. How We Use Your Data</h2>
    <ul>
      <li>To provide and improve BIQc services</li>
      <li>To generate business intelligence and recommendations</li>
      <li>To communicate service updates and alerts</li>
      <li>To maintain security and prevent fraud</li>
    </ul>
    <h2>4. Data Storage & Security</h2>
    <p>All data is stored in Australian data centres. We use encryption at rest and in transit, and enforce role-based access controls with account security controls.</p>
    <h2>5. Data Sharing</h2>
    <p>We do not sell, rent, or share your data with third parties for marketing purposes. Data may be shared with sub-processors solely for the purpose of delivering BIQc services, subject to equivalent privacy protections.</p>
    <h2>6. Your Rights</h2>
    <ul>
      <li>Access your personal data at any time</li>
      <li>Request correction of inaccurate data</li>
      <li>Request deletion of your data</li>
      <li>Withdraw consent for data processing</li>
      <li>Lodge a complaint with the OAIC</li>
    </ul>
    <h2>7. Contact</h2>
    <p>Privacy Officer: support@biqc.ai</p>
  </TrustPageShell>
);

export const DPAPage = () => (
  <TrustPageShell title="Data Processing Agreement" lastUpdated="February 2026">
    <h2>1. Scope</h2>
    <p>This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of the Terms & Conditions between Business Intelligence Quotient Centre Pty Ltd (&ldquo;Processor&rdquo;) and the customer (&ldquo;Controller&rdquo;) and governs the processing of business data through the BIQc platform.</p>
    <h2>2. Roles</h2>
    <ul>
      <li><strong>Data Controller:</strong> The customer who determines the purpose and means of processing</li>
      <li><strong>Data Processor:</strong> Business Intelligence Quotient Centre Pty Ltd, processing data on the Controller's behalf</li>
    </ul>
    <h2>3. Processing Purpose</h2>
    <p>Data is processed solely for the purpose of providing autonomous business intelligence services as described in the BIQc service agreement. Processing includes data ingestion, analysis, anomaly detection, and report generation.</p>
    <h2>4. Data Categories</h2>
    <ul>
      <li>Financial data (invoices, transactions, cash flow, expenses)</li>
      <li>CRM data (contacts, pipeline, deals)</li>
      <li>Operational data (tasks, utilisation, compliance)</li>
      <li>Communication metadata (email patterns, response timing)</li>
    </ul>
    <h2>5. Sub-Processors</h2>
    <p>We maintain a current list of sub-processors used in data processing. All sub-processors are subject to equivalent data protection obligations. The current list is available upon request.</p>
    <h2>6. Data Retention</h2>
    <p>Data is retained for the duration of the service agreement plus 30 days. Upon termination, all data is permanently deleted within 30 days unless a legal retention obligation applies.</p>
    <h2>7. Security Measures</h2>
    <ul>
      <li>AES-256 encryption at rest</li>
      <li>TLS 1.3 encryption in transit</li>
      <li>Role-based access controls</li>
      <li>Regular security audits</li>
      <li>Incident response within 72 hours</li>
    </ul>
  </TrustPageShell>
);

export const SecurityPage = () => (
  <TrustPageShell title="Security & Infrastructure" lastUpdated="February 2026">
    <h2>1. Infrastructure Overview</h2>
    <p>BIQc operates with all data hosted in Australian infrastructure and managed provider services. Our architecture is designed for high availability, security, and data governance transparency.</p>
    <h2>2. Encryption</h2>
    <h3>At Rest</h3>
    <p>All stored data is encrypted using AES-256 with automatically rotated encryption keys. Database-level encryption ensures data protection even at the storage layer.</p>
    <h3>In Transit</h3>
    <p>All data transmitted between systems uses TLS 1.3. API communications are secured with mutual TLS where applicable. No plain-text data transmission at any point.</p>
    <h2>3. Access Controls</h2>
    <ul>
      <li>Role-based access controls with account-level security controls</li>
      <li>Role-based access control (RBAC) with least-privilege principle</li>
      <li>Session management with automatic timeout</li>
      <li>Administrative access restrictions for privileged operations</li>
      <li>All access logged and auditable</li>
    </ul>
    <h2>4. Network Security</h2>
    <ul>
      <li>WAF (Web Application Firewall) protection</li>
      <li>DDoS mitigation</li>
      <li>Network segmentation and isolation</li>
      <li>Intrusion detection and prevention systems</li>
    </ul>
    <h2>5. Monitoring & Incident Response</h2>
    <ul>
      <li>Continuous infrastructure monitoring</li>
      <li>Automated anomaly detection</li>
      <li>Incident response within 72 hours of detection</li>
      <li>Post-incident review and remediation</li>
    </ul>
    <h2>6. Compliance</h2>
    <ul>
      <li>Privacy Act 1988 (Cth) compliance</li>
      <li>Australian Privacy Principles (APPs) adherence</li>
      <li>Regular third-party security assessments</li>
    </ul>
  </TrustPageShell>
);

export const TrustCentrePage = () => (
  <TrustPageShell title="Trust Centre" lastUpdated="February 2026">
    <h2>Overview</h2>
    <p>The BIQc Trust Centre provides centralised access to all security, compliance, and data governance documentation. We believe in full transparency with our customers.</p>
    <h2>Data Sovereignty</h2>
    <ul>
      <li>All data hosted in Australian data centres</li>
      <li>Provider processing disclosures available in legal documentation</li>
      <li>Data governance controls documented for enabled services</li>
      <li>Full compliance with Australian data protection legislation</li>
    </ul>
    <h2>Security Certifications</h2>
    <ul>
      <li>SOC 2 Type II (in progress)</li>
      <li>ISO 27001 alignment</li>
      <li>Regular penetration testing</li>
      <li>Continuous vulnerability scanning</li>
    </ul>
    <h2>Uptime & Reliability</h2>
    <ul>
      <li>Target high-availability architecture</li>
      <li>Resilience controls appropriate to deployed environment</li>
      <li>Automated backups with point-in-time recovery</li>
      <li>Disaster recovery procedures maintained and reviewed</li>
    </ul>
    <h2>Documentation</h2>
    <p>For detailed information on specific topics, please refer to:</p>
    <ul>
      <li><a href="/trust/terms" style={{ color: '#E85D00' }}>Terms & Conditions</a></li>
      <li><a href="/trust/privacy" style={{ color: '#E85D00' }}>Privacy Policy</a></li>
      <li><a href="/trust/dpa" style={{ color: '#E85D00' }}>Data Processing Agreement</a></li>
      <li><a href="/trust/security" style={{ color: '#E85D00' }}>Security & Infrastructure</a></li>
      <li><a href="/trust/refund-policy" style={{ color: '#E85D00' }}>Refund Policy</a></li>
    </ul>
    <h2>Contact</h2>
    <p>For security inquiries: support@biqc.ai<br />For privacy inquiries: support@biqc.ai</p>
  </TrustPageShell>
);

// Step 14 / P1-9 — Refund Policy page. Matches the TrustPageShell layout so
// it reads as an extension of the trust suite rather than a standalone
// legal page. Content is deliberately specific on the 7-day window,
// pro-rata credit mechanic, and what's excluded (add-on bundles, custom
// build work, overages already billed) so support isn't re-writing the
// policy on every ticket. The ops runbook at
// docs/operations/REFUND_POLICY_RUNBOOK.md is the procedural companion —
// this page is the customer-facing contract.
export const RefundPolicyPage = () => (
  <TrustPageShell title="Refund Policy" lastUpdated="April 2026">
    <h2>1. Overview</h2>
    <p>BIQc offers a transparent refund policy designed for fairness and predictability. This policy describes when you&rsquo;re eligible for a refund, how pro-rata credits work on plan changes, and what&rsquo;s excluded. It applies to all customers on monthly and annual subscriptions.</p>

    <h2>2. 7-Day Satisfaction Window</h2>
    <p>New subscribers may request a full refund within <strong>7 days</strong> of their first paid charge if BIQc did not meet the described service. Contact support@biqc.ai within the window with your account email and the reason. Approved refunds are returned to the original payment method within 5&ndash;10 business days.</p>
    <ul>
      <li>Applies to the first paid billing cycle only</li>
      <li>Does not apply to renewals after the first period</li>
      <li>Requires the account to be in good standing (no policy violations)</li>
    </ul>

    <h2>3. Plan Changes &amp; Pro-Rata Credits</h2>
    <p>When you upgrade mid-cycle we bill the difference pro-rata to the end of the current period. When you downgrade, the unused portion of the higher plan becomes an account credit applied to your next invoice; downgrades do not issue a cash refund.</p>
    <ul>
      <li>Upgrades: pro-rata charge, effective immediately</li>
      <li>Downgrades: pro-rata credit on the next invoice, effective at period end</li>
      <li>Credits expire 12 months after issue if unused</li>
    </ul>

    <h2>4. Annual Plan Refunds</h2>
    <p>Annual plans may be cancelled at any time. Refunds for annual plans outside the 7-day window are issued as a pro-rata credit for the unused months (not cash) and applied to future BIQc usage. Annual discounts already applied are deducted from the credit calculation.</p>

    <h2>5. Cancellations</h2>
    <p>You may cancel at any time from your billing dashboard. Cancellation takes effect at the end of the current billing period, and you retain full access until then. Cancelling does not automatically trigger a refund; use the procedures above if a refund is appropriate.</p>

    <h2>6. Exclusions</h2>
    <p>The following are <strong>not</strong> eligible for refund or credit:</p>
    <ul>
      <li>Usage overages that have already been billed (Stripe metered line items)</li>
      <li>Custom build / Enterprise engagements where work has commenced (subject to the individual statement of work)</li>
      <li>Add-on bundles already consumed (snapshots, deep-analysis runs)</li>
      <li>Accounts terminated for breach of the Acceptable Use terms</li>
      <li>Partial months of use for customers beyond the 7-day window</li>
    </ul>

    <h2>7. Disputed Charges</h2>
    <p>If you believe a charge is incorrect, contact support@biqc.ai before raising a dispute with your card issuer. We resolve the majority of billing questions within one business day, and chargebacks may delay any legitimate refund significantly.</p>

    <h2>8. How to Request a Refund</h2>
    <p>Email <strong>support@biqc.ai</strong> with:</p>
    <ul>
      <li>The account email address</li>
      <li>The Stripe charge ID or receipt number (from your email receipt)</li>
      <li>A short description of why you&rsquo;re requesting the refund</li>
    </ul>
    <p>We respond within one business day and issue approved refunds within 5&ndash;10 business days of approval.</p>

    <h2>9. Changes to This Policy</h2>
    <p>We may update this policy to reflect operational changes or new product offerings. Material changes take effect 30 days after they are posted; continued use after that date constitutes acceptance.</p>

    <h2>10. Contact</h2>
    <p>Questions about this policy or a specific refund request: support@biqc.ai</p>
  </TrustPageShell>
);
