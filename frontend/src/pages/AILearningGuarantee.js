import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Server, ArrowLeft } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const AILearningGuarantee = () => (
  <div className="min-h-screen" style={{ background: 'var(--biqc-bg)' }}>
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link to="/trust/centre" className="inline-flex items-center gap-2 mb-10 text-sm transition-colors hover:text-[#E85D00]" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.body }}>
        <ArrowLeft className="w-4 h-4" /> Back to Trust Centre
      </Link>

      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-[#E85D00]" />
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Data Protection</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--ink-display)] mb-4" style={{ fontFamily: fontFamily.display }}>
          BIQc AI Learning Guarantee
        </h1>
        <p className="text-lg text-[var(--ink-secondary)] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
          BIQc is designed to prevent customer data from being used for public model training and applies provider controls to enforce this posture.
        </p>
      </div>

      {/* Core Guarantee */}
      <div className="rounded-xl p-6 mb-8" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
        <h2 className="text-sm font-semibold text-[var(--ink-display)] mb-4" style={{ fontFamily: fontFamily.display }}>Our Guarantee</h2>
        <div className="space-y-4">
          {[
            'Your prompts are processed with training-restriction controls on supported providers.',
            'Your uploaded files are not added to shared training datasets by BIQc.',
            'Your outputs remain your intellectual property.',
            'Your account is logically isolated with tenant access controls.',
            'Processing is designed for transient handling with controlled retention.',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--ink-secondary)] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Processing Explanation */}
      <div className="rounded-xl p-6 mb-8" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-4 h-4 text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.display }}>How BIQc Processes Your Data</h2>
        </div>
        <p className="text-sm text-[var(--ink-secondary)] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
          BIQc uses API-based processing with provider-level training restrictions and platform retention controls. Data handling follows documented privacy and sub-processor terms.
        </p>
      </div>

      {/* Segment Framing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'SMB', items: ['Closed-loop processing', 'Account isolation', 'No public training'] },
          { label: 'Mid-Market', items: ['Role-based access', 'Audit-ready logs', 'Retention controls'] },
          { label: 'Enterprise', items: ['Custom deployment options by agreement', 'Contractual training restrictions', 'Custom data residency options'] },
        ].map(seg => (
          <div key={seg.label} className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>{seg.label}</span>
            <div className="space-y-2">
              {seg.items.map((item, i) => (
                <p key={i} className="text-xs text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.body }}>{item}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legal Alignment */}
      <div className="pt-6" style={{ borderTop: '1px solid var(--biqc-border)' }}>
        <p className="text-sm text-[var(--ink-secondary)] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
          Our <Link to="/trust/terms" className="text-[#E85D00] hover:underline">Terms of Service</Link> explicitly state that you own your inputs and your outputs.
        </p>
      </div>
    </div>
  </div>
);

export default AILearningGuarantee;
