import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { CognitiveMesh } from '../components/LoadingSystems';
import { Workflow, Zap, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const AutomationsPageAuth = () => {
  const { cognitive, loading } = useSnapshot();
  const c = cognitive || {};
  const exec = c.execution || {};
  const recs = exec.recs || [];
  const rq = c.resolution_queue || [];
  const automatable = rq.filter(r => (r.actions || []).some(a => a === 'auto-email' || a === 'quick-sms'));

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: BODY }} data-testid="automations-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Automations</h1>
          <p className="text-sm text-[#9FB0C3]">AI-suggested automations based on resolution queue patterns.</p>
        </div>

        {loading && <CognitiveMesh message="Analysing automation opportunities..." />}

        {!loading && (
          <>
            {/* Automation Opportunities */}
            {automatable.length > 0 ? (
              <div>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#FF6A00', fontFamily: MONO }}>Automatable Actions ({automatable.length})</h3>
                <div className="space-y-3">
                  {automatable.map((item, i) => (
                    <Panel key={i}>
                      <div className="flex items-start gap-3">
                        <Zap className="w-4 h-4 text-[#FF6A00] shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>{item.title}</p>
                          <p className="text-xs text-[#9FB0C3] mt-1">{item.detail}</p>
                          <div className="flex gap-2 mt-2">
                            {(item.actions || []).filter(a => a === 'auto-email' || a === 'quick-sms').map(a => (
                              <span key={a} className="text-[10px] px-2 py-1 rounded" style={{ color: '#FF6A00', background: '#FF6A0015', fontFamily: MONO }}>{a}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Panel>
                  ))}
                </div>
              </div>
            ) : (
              <Panel className="text-center py-8">
                <Workflow className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#64748B]">No automation opportunities detected yet. As BIQc identifies repeating patterns in your resolution queue, automations will appear here.</p>
              </Panel>
            )}

            {/* Operational Recommendations */}
            {recs.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: MONO }}>Operational Recommendations</h3>
                <div className="space-y-2">
                  {recs.map((r, i) => (
                    <Panel key={i}>
                      <div className="flex items-start gap-3">
                        <ArrowRight className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                        <p className="text-sm text-[#9FB0C3]">{r}</p>
                      </div>
                    </Panel>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <FloatingSoundboard context="Automations - AI-suggested workflows, operational recommendations" />
    </DashboardLayout>
  );
};

export default AutomationsPageAuth;
