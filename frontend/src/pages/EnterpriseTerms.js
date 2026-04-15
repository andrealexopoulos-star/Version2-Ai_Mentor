import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Scale, Shield, Lock, FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const SECTIONS = [
  {
    num: '1',
    title: 'Use of Platform',
    icon: '⚡',
    color: '#3B82F6',
    bg: '#EFF6FF',
    subsections: [
      {
        id: '1.1',
        title: 'Right to Use',
        content: 'Subject to the terms and conditions of this Agreement and Customer\'s compliance herewith, Customer may, on a non-exclusive, non-sublicensable and non-transferable basis during the term, use the Services for Customer\'s business purposes.',
      },
      {
        id: '1.2',
        title: 'Authorised Users',
        content: 'The Company shall enable Customer to create accounts for its personnel ("Authorised Users") equal to the number of seats set forth in the relevant ordering documentation. Customer shall ensure its Authorised Users comply with all obligations and restrictions set forth in this Agreement. All access via an Authorised User\'s account shall be treated as access by such Authorised User.',
      },
      {
        id: '1.3',
        title: 'Customer Content',
        subsubs: [
          { id: '1.3.1', title: 'Ownership', content: 'As between the Company and Customer, and to the extent permitted by applicable law, Customer (i) retains all ownership rights in Input and (ii) owns all Output. The Company asserts no ownership rights in any Output.' },
          { id: '1.3.2', title: 'Similarity of Output', content: 'Customer acknowledges that due to the nature of generative artificial intelligence, Output may not be unique. Other users may receive Output that is similar to, or the same as, Customer\'s Output.' },
          { id: '1.3.3', title: 'Model Training', content: 'The Company shall not use (or authorise third parties to use) Customer Content to train, retrain, fine-tune or otherwise improve any generative artificial intelligence models.' },
        ],
      },
      {
        id: '1.4',
        title: 'Acceptable Use Policy',
        content: 'Customer shall not use the Services in a manner that violates the Company\'s Acceptable Use Policy ("AUP").',
      },
    ],
  },
  {
    num: '2',
    title: 'Intellectual Property',
    icon: '🧠',
    color: '#7C3AED',
    bg: '#F5F3FF',
    subsections: [
      {
        id: '2.1',
        title: 'Company IP',
        content: 'As between the parties, the Company or its licensors retain all right title and interest in and to the Services, including all related software, algorithms, models, and improvements (the "Company IP").',
      },
      {
        id: '2.2',
        title: 'Usage Data',
        content: 'The Company may collect and utilise "Usage Data" (metadata and performance metrics) that is anonymised and/or aggregated so that it does not identify Customer or any individual user. The Company retains all rights to such Usage Data.',
      },
    ],
  },
  {
    num: '3',
    title: 'Fees and GST',
    icon: '💳',
    color: '#10B981',
    bg: '#F0FDF4',
    subsections: [
      {
        id: '3.1',
        title: 'Fees',
        content: 'Customer shall pay the Company fees ("Fees") in Australian Dollars (unless otherwise specified). Any payments not received by the due date shall be subject to a late fee of 1.5% per month, or the maximum charge permitted by law, whichever is less.',
      },
      {
        id: '3.2',
        title: 'GST',
        content: 'All Fees are exclusive of Goods and Services Tax (GST) unless otherwise stated. If GST is payable on any supply made under this Agreement, Customer must pay an additional amount equal to the GST payable on that supply, subject to receiving a valid Tax Invoice in accordance with Australian tax law.',
      },
    ],
  },
  {
    num: '4',
    title: 'Confidentiality',
    icon: '🔒',
    color: '#E85D00',
    bg: '#FFF7ED',
    content: 'Each party (the "Receiving Party") shall keep confidential and not disclose to any third party all Confidential Information of the other party (the "Disclosing Party"). Customer Content constitutes Confidential Information of Customer. The terms of this Agreement and the technical inner workings of the Services constitute Confidential Information of the Company.',
  },
  {
    num: '5',
    title: 'Privacy and Security',
    icon: '🛡️',
    color: '#0EA5E9',
    bg: '#F0F9FF',
    subsections: [
      {
        id: '5.1',
        title: 'Personal Data',
        content: 'To the extent that Input contains "Personal Information" as defined in the Privacy Act 1988 (Cth), the Company agrees to handle such information in accordance with the Australian Privacy Principles (APPs) and its Data Processing Addendum.',
      },
      {
        id: '5.2',
        title: 'Security',
        content: 'The Company has implemented industry-standard safeguards to maintain the security of the Services, including AES-256 encryption, Australian data residency (Sydney/Melbourne nodes), and zero cross-tenant data leakage.',
      },
    ],
  },
  {
    num: '6',
    title: 'Australian Consumer Law (ACL) & Warranties',
    icon: '⚖️',
    color: '#DC2626',
    bg: '#FEF2F2',
    subsections: [
      {
        id: '6.1',
        title: 'Statutory Guarantees',
        content: 'Our Services come with guarantees that cannot be excluded under the Australian Consumer Law. For major failures with the service, you are entitled to cancel your service contract and receive a refund for the unused portion, or to receive compensation for any other reasonably foreseeable loss or damage.',
      },
      {
        id: '6.2',
        title: 'Disclaimers',
        content: 'Subject to Section 6.1, the Services are provided "as is." Due to the inherent limitations of generative AI, the Services may generate Output containing incorrect, biased or otherwise problematic information. Customer is responsible for verifying the accuracy of Outputs. Any Output is not a substitute for advice from a qualified professional.',
      },
    ],
  },
  {
    num: '7',
    title: 'Limitation of Liability',
    icon: '📊',
    color: '#64748B',
    bg: '#F9FAFB',
    bullets: [
      'Neither party shall be liable for special, incidental, or consequential damages (including lost profits).',
      'The total aggregate liability of the Company shall not exceed the amounts paid by Customer to the Company in the 12 months prior to the event giving rise to the liability.',
    ],
    prefix: 'To the maximum extent permitted by law (including the ACL):',
  },
  {
    num: '8',
    title: 'Indemnification',
    icon: '🤝',
    color: '#3B82F6',
    bg: '#EFF6FF',
    subsections: [
      {
        id: '8.1',
        title: 'By Customer',
        content: 'Customer agrees to indemnify the Company from third-party claims related to Customer\'s use of the Services in violation of this Agreement or regarding Customer Content.',
      },
      {
        id: '8.2',
        title: 'By Company',
        content: 'The Company agrees to indemnify Customer against third-party claims alleging that the Services or Outputs infringe any third-party intellectual property right, subject to certain exclusions.',
      },
    ],
  },
  {
    num: '9',
    title: 'Termination',
    icon: '🔚',
    color: '#DC2626',
    bg: '#FEF2F2',
    subsections: [
      { id: '9.1', title: 'Term', content: 'This Agreement continues until terminated by either party in accordance with this Section.' },
      { id: '9.2', title: 'Suspension', content: 'The Company may suspend accounts if necessary to comply with law, mitigate a security attack, or for non-payment of Fees for 15 or more days.' },
      { id: '9.3', title: 'Termination', content: 'Either party may terminate if the other party materially breaches the Agreement and fails to cure such breach within 30 days of receiving written notice.' },
    ],
  },
  {
    num: '10',
    title: 'Miscellaneous',
    icon: '📋',
    color: 'rgba(140,170,210,0.15)',
    bg: '#F9FAFB',
    subsections: [
      { id: '10.1', title: 'Governing Law', content: 'This Agreement shall be governed by the laws of New South Wales, Australia. The parties submit to the exclusive jurisdiction of the courts of New South Wales and the Commonwealth of Australia.' },
      { id: '10.2', title: 'Export Laws', content: 'Customer agrees to comply with all applicable export laws and regulations in connection with its use of the Services.' },
      { id: '10.3', title: 'Entire Agreement', content: 'This Agreement constitutes the entire agreement between the parties with regard to the subject matter hereof and supersedes all prior and contemporaneous agreements, representations and understandings.' },
    ],
  },
];

const SectionCard = ({ section }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-4 rounded-2xl border overflow-hidden transition-all" style={{ borderColor: 'rgba(180,195,215,0.35)', boxShadow: '0 2px 8px rgba(100,120,160,0.06)' }}>
      {/* Section Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-slate-50 transition-colors"
        style={{ background: 'white' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl text-lg" style={{ background: section.bg }}>
            {section.icon}
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 block mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
              Section {section.num}
            </span>
            <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
              {section.title}
            </h3>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        }
      </button>

      {/* Section Content */}
      {expanded && (
        <div className="px-6 pb-6 border-t" style={{ borderColor: 'rgba(180,195,215,0.25)', background: 'white' }}>

          {/* Simple content */}
          {section.content && (
            <p className="text-sm text-slate-600 leading-relaxed mt-5">{section.content}</p>
          )}

          {/* Prefix + bullets */}
          {section.prefix && (
            <p className="text-sm text-slate-600 leading-relaxed mt-5 mb-3">{section.prefix}</p>
          )}
          {section.bullets && (
            <ul className="space-y-2">
              {section.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: section.color }} />
                  {b}
                </li>
              ))}
            </ul>
          )}

          {/* Subsections */}
          {section.subsections && (
            <div className="space-y-4 mt-5">
              {section.subsections.map(sub => (
                <div key={sub.id}>
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0 mt-0.5" style={{ background: section.bg, color: section.color, fontFamily: 'var(--font-mono)' }}>
                      {sub.id}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-800" style={{ fontFamily: 'var(--font-display)' }}>{sub.title}</h4>
                  </div>
                  {sub.content && (
                    <p className="text-sm text-slate-600 leading-relaxed ml-11">{sub.content}</p>
                  )}
                  {/* Sub-subsections (1.3.x) */}
                  {sub.subsubs && (
                    <div className="ml-11 mt-3 space-y-3">
                      {sub.subsubs.map(ss => (
                        <div key={ss.id} className="pl-4 border-l-2" style={{ borderColor: section.color + '30' }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: section.bg, color: section.color, fontFamily: 'var(--font-mono)' }}>{ss.id}</span>
                            <span className="text-xs font-semibold text-slate-700" style={{ fontFamily: 'var(--font-display)' }}>{ss.title}</span>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{ss.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const EnterpriseTerms = () => {
  const navigate = useNavigate();
  const [allExpanded, setAllExpanded] = useState(true);

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA', fontFamily: 'var(--font-ui)' }}>

      {/* Sticky Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5 sm:px-10" style={{ height: 60, background: 'rgba(245,247,250,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(180,195,215,0.35)' }}>
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors" style={{ fontFamily: 'var(--font-ui)' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-xl text-white font-black text-xs" style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#E85D00,#C2410C)', fontFamily: 'var(--font-display)', boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}>B</div>
          <span className="font-bold text-sm text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>BIQc</span>
        </div>
        <button onClick={() => navigate('/register-supabase')} className="text-sm font-semibold text-white px-4 py-2 rounded-full" style={{ fontFamily: 'var(--font-display)', background: 'var(--biqc-bg)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          Get started →
        </button>
      </nav>

      {/* Hero */}
      <div className="pt-24 pb-10 px-5 sm:px-10 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(180,195,215,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(180,195,215,0.1) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(249,115,22,0.04),transparent 70%)', filter: 'blur(40px)' }} />

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Enterprise badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.2)' }}>
            <Scale className="w-3.5 h-3.5" style={{ color: '#E85D00' }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)', color: '#EA6C0A' }}>Enterprise Agreement</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>
            BIQc Enterprise
            <span className="block" style={{ color: '#E85D00' }}>Terms & Conditions</span>
          </h1>

          <p className="text-sm text-slate-500 mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
            Last updated: February 6, 2026
          </p>

          {/* Intro card */}
          <div className="bg-white rounded-2xl border p-6 mb-6" style={{ borderColor: 'rgba(180,195,215,0.35)', boxShadow: '0 2px 12px rgba(100,120,160,0.08)' }}>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Thank you for choosing to use <strong className="text-slate-900">BIQc ENTERPRISE</strong> (the "Services"). Please carefully read these Terms and Conditions ("Agreement"), which form a binding contract between the organisation on whose behalf you are accessing or using the Services ("Customer") and BIQc ("Company"), before using the Services.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              By accessing or using the Services you agree, on behalf of Customer, that Customer is bound by this Agreement. This Agreement is applicable to the Company's enterprise customers only. For free users or other tiers, separate terms apply.
            </p>
          </div>

          {/* Key highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {[
              { icon: Lock, label: 'Your data stays yours', sub: 'Zero model training on Customer Content', color: '#E85D00' },
              { icon: Shield, label: 'Australian data sovereignty', sub: 'Governed by NSW law, Privacy Act 1988', color: '#10B981' },
              { icon: Scale, label: 'ACL protected', sub: 'Full Australian Consumer Law guarantees', color: '#3B82F6' },
            ].map(({ icon: Icon, label, sub, color }, i) => (
              <div key={i} className="bg-white rounded-xl border p-4 flex items-start gap-3" style={{ borderColor: 'rgba(180,195,215,0.35)', boxShadow: '0 1px 6px rgba(100,120,160,0.06)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}12` }}>
                  <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs text-slate-400" style={{ fontFamily: 'var(--font-mono)' }}>10 sections · Scroll or click to expand</p>
            <button onClick={() => setAllExpanded(!allExpanded)} className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5" style={{ fontFamily: 'var(--font-ui)' }}>
              {allExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        </div>
      </div>

      {/* Terms Sections */}
      <div className="max-w-4xl mx-auto px-5 sm:px-10 pb-16">
        {SECTIONS.map(section => (
          <SectionCard key={section.num} section={section} />
        ))}

        {/* Definitions box */}
        <div className="mt-6 bg-white rounded-2xl border p-6" style={{ borderColor: 'rgba(180,195,215,0.35)', boxShadow: '0 2px 8px rgba(100,120,160,0.06)' }}>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Key Definitions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['Customer', 'The organisation accessing the Services on whose behalf this Agreement is entered.'],
              ['Input', 'Data, text or content submitted by Customer to the Services.'],
              ['Output', 'Responses, analyses, recommendations or content generated by the Services.'],
              ['Customer Content', 'Collectively, Input and Output.'],
              ['Authorised Users', 'Personnel of Customer permitted to access the Services under this Agreement.'],
              ['Company IP', 'All software, algorithms, models and improvements underlying the Services.'],
            ].map(([term, def], i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid rgba(180,195,215,0.25)' }}>
                <span className="text-xs font-bold text-orange-500 shrink-0 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{term}</span>
                <span className="text-xs text-slate-500 leading-relaxed">{def}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 rounded-2xl" style={{ background: 'var(--biqc-bg)' }}>
          <div>
            <p className="text-xs font-semibold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>Questions about this Agreement?</p>
            <p className="text-xs text-slate-400">Contact Business Intelligence Quotient Centre at <span className="text-orange-400">support@biqc.ai</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/trust')} className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors" style={{ fontFamily: 'var(--font-ui)' }}>
              <Shield className="w-3.5 h-3.5" /> Trust & Security
            </button>
            <button onClick={() => navigate('/terms')} className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors" style={{ fontFamily: 'var(--font-ui)' }}>
              <FileText className="w-3.5 h-3.5" /> Standard Terms
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed" style={{ fontFamily: 'var(--font-ui)' }}>
          © 2026 BIQc — Business IQ Centre. Powered by Business Intelligence Quotient Centre Pty Ltd. ABN: [Pending]. <br />
          Governed by the laws of New South Wales, Australia.
        </p>
      </div>
    </div>
  );
};

export default EnterpriseTerms;
