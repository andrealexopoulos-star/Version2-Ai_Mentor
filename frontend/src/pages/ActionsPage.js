import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { CognitiveMesh } from '../components/LoadingSystems';
import { Zap, Mail, MessageSquare, Users, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const SEV = { high: { bg: '#EF444410', b: '#EF444425', d: '#EF4444' }, medium: { bg: '#F59E0B10', b: '#F59E0B25', d: '#F59E0B' }, low: { bg: '#10B98110', b: '#10B98125', d: '#10B981' } };

const ActionsPage = () => {
  const { cognitive, loading } = useSnapshot();
  const c = cognitive || {};
  const rq = c.resolution_queue || [];
  const reallocation = c.reallocation || [];
  const priority = c.priority || {};

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="actions-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Resolution Centre</h1>
          <p className="text-sm text-[#9FB0C3]">AI-detected issues requiring action. Each item maps to a one-click resolution.</p>
        </div>

        {loading && <CognitiveMesh message="Scanning resolution queue..." />}

        {!loading && (
          <>
            {/* Priority Focus */}
            {(priority.primary || priority.secondary) && (
              <div className="rounded-xl p-5" style={{ background: '#FF6A0008', border: '1px solid #FF6A0025' }}>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Priority Focus</h3>
                {priority.primary && (
                  <div className="mb-3">
                    <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>{priority.primary}</span>
                    {priority.primary_hrs && <span className="text-xs text-[#64748B] ml-2" style={{ fontFamily: fontFamily.mono }}>{priority.primary_hrs}</span>}
                  </div>
                )}
                {priority.secondary && (
                  <div className="mb-2">
                    <span className="text-sm text-[#9FB0C3]">{priority.secondary}</span>
                    {priority.delegate && <span className="text-xs text-[#64748B] ml-2" style={{ fontFamily: fontFamily.mono }}>Delegate: {priority.delegate}</span>}
                  </div>
                )}
                {priority.noise && <p className="text-xs text-[#64748B] mt-2" style={{ fontFamily: fontFamily.mono }}>Ignore: {priority.noise}</p>}
              </div>
            )}

            {/* Resolution Queue */}
            {rq.length > 0 ? (
              <div>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Resolution Queue ({rq.length})</h3>
                <div className="space-y-3">
                  {rq.map((item, i) => {
                    const sv = SEV[item.severity] || SEV.medium;
                    return (
                      <div key={i} className="rounded-xl p-5" style={{ background: sv.bg, border: `1px solid ${sv.b}` }}>
                        <div className="flex items-start gap-3">
                          <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: sv.d }} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>{item.title}</p>
                            {item.detail && <p className="text-xs mt-1 text-[#9FB0C3] leading-relaxed">{item.detail}</p>}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {(item.actions || []).includes('auto-email') && <button className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg text-[11px] font-semibold" style={{ background: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F630', fontFamily: fontFamily.mono }}><Mail className="w-3.5 h-3.5" />Auto-Email</button>}
                              {(item.actions || []).includes('quick-sms') && <button className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg text-[11px] font-semibold" style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130', fontFamily: fontFamily.mono }}><MessageSquare className="w-3.5 h-3.5" />Quick-SMS</button>}
                              {(item.actions || []).includes('hand-off') && <button className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg text-[11px] font-semibold" style={{ background: '#FF6A0015', color: '#FF6A00', border: '1px solid #FF6A0030', fontFamily: fontFamily.mono }}><Users className="w-3.5 h-3.5" />Hand Off</button>}
                              <button className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg text-[11px] font-semibold" style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130', fontFamily: fontFamily.mono }}><CheckCircle2 className="w-3.5 h-3.5" />Complete</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Panel className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-3" />
                <p className="text-sm text-[#64748B]">No items in the resolution queue. Connect integrations to activate AI monitoring.</p>
              </Panel>
            )}

            {/* Reallocation Recommendations */}
            {reallocation.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Resource Reallocation</h3>
                <div className="space-y-2">
                  {reallocation.map((r, i) => (
                    <Panel key={i}>
                      <div className="flex items-start gap-3">
                        <ArrowRight className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>{r.action}</p>
                          <p className="text-xs text-[#9FB0C3] mt-1">{r.impact}</p>
                        </div>
                      </div>
                    </Panel>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ActionsPage;
