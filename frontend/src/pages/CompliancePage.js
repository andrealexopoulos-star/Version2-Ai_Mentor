import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { CognitiveMesh } from '../components/LoadingSystems';
import { Shield, CheckCircle2, AlertTriangle, Clock, FileText } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const CompliancePage = () => {
  const { cognitive, loading } = useSnapshot();
  const c = cognitive || {};
  const risk = c.risk || {};
  const regulatory = risk.regulatory || [];
  const contracts = risk.contracts;
  const alignment = c.alignment || {};

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="compliance-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Compliance Intelligence</h1>
          <p className="text-sm text-[#9FB0C3]">Regulatory obligations, risk exposure, and compliance posture.</p>
        </div>

        {loading && <CognitiveMesh message="Scanning compliance signals..." />}

        {!loading && (
          <>
            {/* Risk Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'SPOFs', value: (risk.spof || []).length, color: (risk.spof || []).length > 0 ? '#EF4444' : '#10B981', icon: AlertTriangle },
                { label: 'Regulatory Items', value: regulatory.length, color: regulatory.length > 0 ? '#F59E0B' : '#10B981', icon: Shield },
                { label: 'Contracts', value: contracts || 'Clear', color: contracts ? '#F59E0B' : '#10B981', icon: FileText },
              ].map(m => (
                <Panel key={m.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                    <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{m.label}</span>
                  </div>
                  <span className="text-lg font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{m.value}</span>
                </Panel>
              ))}
            </div>

            {/* Single Points of Failure */}
            {(risk.spof || []).length > 0 && (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Single Points of Failure</h3>
                <div className="space-y-2">
                  {risk.spof.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                      <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                      <p className="text-sm text-[#9FB0C3]">{s}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Regulatory Items */}
            {regulatory.length > 0 ? (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Regulatory Obligations</h3>
                <div className="space-y-2">
                  {regulatory.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <Clock className="w-4 h-4 shrink-0" style={{ color: r.sev === 'med' ? '#F59E0B' : '#10B981' }} />
                      <span className="text-sm text-[#F4F7FA] flex-1">{r.item}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: r.sev === 'med' ? '#F59E0B' : '#10B981', background: (r.sev === 'med' ? '#F59E0B' : '#10B981') + '15', fontFamily: fontFamily.mono }}>{r.sev}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : (
              <Panel>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                  <p className="text-sm text-[#9FB0C3]">No regulatory items flagged. Connect accounting and email integrations to activate compliance monitoring.</p>
                </div>
              </Panel>
            )}

            {/* Revenue Concentration */}
            {risk.concentration && (
              <Panel>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Revenue Concentration Risk</h3>
                <p className="text-sm text-[#9FB0C3] leading-relaxed">{risk.concentration}</p>
              </Panel>
            )}

            {/* Alignment */}
            {alignment.narrative && (
              <Panel>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>Strategic Alignment</h3>
                <p className="text-sm text-[#9FB0C3] leading-relaxed">{alignment.narrative}</p>
                {(alignment.contradictions || []).map((ct, i) => (
                  <div key={i} className="mt-2 px-3 py-2 rounded-lg" style={{ background: '#F59E0B10', border: '1px solid #F59E0B25' }}>
                    <p className="text-xs" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>{ct}</p>
                  </div>
                ))}
              </Panel>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CompliancePage;
