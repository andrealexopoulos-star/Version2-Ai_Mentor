import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Server, ArrowLeft } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const AILearningGuarantee = () => (
  <div className="min-h-screen" style={{ background: 'var(--biqc-bg)' }}>
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link to="/trust" className="inline-flex items-center gap-2 mb-10 text-sm transition-colors hover:text-[#FF6A00]" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
        <ArrowLeft className="w-4 h-4" /> Back to Trust Centre
      </Link>

      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-[#FF6A00]" />
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Data Protection</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: fontFamily.display }}>
          BIQc AI Learning Guarantee
        </h1>
        <p className="text-lg text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
          Your data is never used to train public AI models. Ever.
        </p>
      </div>

      {/* Core Guarantee */}
      <div className="rounded-xl p-6 mb-8" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
        <h2 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: fontFamily.display }}>Our Guarantee</h2>
        <div className="space-y-4">
          {[
            'Your prompts are not used to train global AI models.',
            'Your uploaded files are never added to shared datasets.',
            'Your outputs remain your intellectual property.',
            'Your account operates in isolation.',
            'Processing is stateless and transient.',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Processing Explanation */}
      <div className="rounded-xl p-6 mb-8" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-4 h-4 text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>How BIQc Processes Your Data</h2>
        </div>
        <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
          BIQc uses stateless API processing. Once a request is fulfilled, the data is purged from the processing layer. No residual learning occurs. No parameter weights are adjusted based on your inputs.
        </p>
      </div>

      {/* Segment Framing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'SMB', items: ['Closed-loop processing', 'Account isolation', 'No public training'] },
          { label: 'Mid-Market', items: ['Role-based access', 'Audit-ready logs', 'Zero-retention architecture'] },
          { label: 'Enterprise', items: ['Optional VPC deployment', 'Contractual zero-training assurance', 'Custom data residency'] },
        ].map(seg => (
          <div key={seg.label} className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>{seg.label}</span>
            <div className="space-y-2">
              {seg.items.map((item, i) => (
                <p key={i} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{item}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legal Alignment */}
      <div className="pt-6" style={{ borderTop: '1px solid var(--biqc-border)' }}>
        <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
          Our <Link to="/terms" className="text-[#FF6A00] hover:underline">Terms of Service</Link> explicitly state that you own your inputs and your outputs.
        </p>
      </div>
    </div>
  </div>
);

export default AILearningGuarantee;
