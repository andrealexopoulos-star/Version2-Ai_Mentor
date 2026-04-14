import React from 'react';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const HEADING = fontFamily.display;
const BODY = fontFamily.body;


const TrustPageShell = ({ title, lastUpdated, children }) => (
  <WebsiteLayout>
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-6">
        <Link to="/trust" className="inline-flex items-center gap-2 text-sm text-[#8FA0B8] hover:text-[#E85D00] transition-colors mb-8" style={{ fontFamily: fontFamily.mono }}>
          <ArrowLeft className="w-4 h-4" /> Back to Trust
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>{title}</h1>
        <p className="text-xs text-[#8FA0B8]/50 mb-10" style={{ fontFamily: fontFamily.mono }}>Last updated: {lastUpdated}</p>
        <div className="prose-steel space-y-6">{children}</div>
      </div>
    </section>
    <style>{`
      .prose-steel h2 { font-family: ${HEADING}; font-size: 1.25rem; font-weight: 700; color: #EDF1F7; margin-top: 2.5rem; margin-bottom: 0.75rem; }
      .prose-steel h3 { font-family: ${HEADING}; font-size: 1rem; font-weight: 600; color: #EDF1F7; margin-top: 1.5rem; margin-bottom: 0.5rem; }
      .prose-steel p { font-family: ${BODY}; font-size: 0.875rem; line-height: 1.7; color: #8FA0B8; }
      .prose-steel ul { list-style: none; padding: 0; }
      .prose-steel li { font-family: ${BODY}; font-size: 0.875rem; color: #8FA0B8; padding-left: 1.25rem; position: relative; margin-bottom: 0.5rem; line-height: 1.6; }
      .prose-steel li::before { content: ''; position: absolute; left: 0; top: 0.6rem; width: 4px; height: 4px; border-radius: 50%; background: #E85D00; }
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
    </ul>
    <h2>Contact</h2>
    <p>For security inquiries: support@biqc.ai<br />For privacy inquiries: support@biqc.ai</p>
  </TrustPageShell>
);
