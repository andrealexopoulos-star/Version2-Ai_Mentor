import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import UpgradeCardsGate from '../components/UpgradeCardsGate';
import { useSnapshot } from '../hooks/useSnapshot';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { CognitiveMesh } from '../components/LoadingSystems';
import { Workflow, Zap, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const AutomationsPageAuth = () => {
  const { cognitive, loading } = useSnapshot();
  const { status: integrationStatus } = useIntegrationStatus();
  const c = cognitive || {};
  const exec = c.execution || {};
  const recs = exec.recs || [];

  // Check what is ACTUALLY connected right now
  const connected = (integrationStatus?.integrations || []).filter(i => i.connected).map(i => (i.category || '').toLowerCase());
  const hasEmail = connected.includes('email') || connected.some(cat => cat.includes('outlook') || cat.includes('gmail'));
  const hasCRM = connected.includes('crm');
  const hasAccounting = connected.includes('accounting');

  const rawRq = c.resolution_queue || [];
  // Filter out stale "X Integration Required" items for integrations that ARE connected
  const automatable = rawRq
    .filter(r => (r.actions || []).some(a => a === 'auto-email' || a === 'quick-sms'))
    .filter(item => {
      const title = (item.title || '').toLowerCase();
      if (hasEmail && title.includes('email') && (title.includes('required') || title.includes('not connected') || title.includes('missing'))) return false;
      if (hasCRM && title.includes('crm') && (title.includes('required') || title.includes('not connected') || title.includes('missing'))) return false;
      if (hasAccounting && (title.includes('accounting') || title.includes('financial')) && (title.includes('required') || title.includes('not connected') || title.includes('missing'))) return false;
      return true;
    });

  return (
    <DashboardLayout>
      <UpgradeCardsGate requiredTier="starter" featureName="Automations">
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="automations-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>Automations</h1>
          <p className="text-sm text-[#9FB0C3]">AI-suggested automations based on resolution queue patterns.</p>
        </div>

        {loading && <CognitiveMesh message="Analysing automation opportunities..." />}

        {!loading && (
          <>
            {/* Automation Opportunities */}
            {automatable.length > 0 ? (
              <div>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Automatable Actions ({automatable.length})</h3>
                <div className="space-y-3">
                  {automatable.map((item, i) => (
                    <Panel key={i}>
                      <div className="flex items-start gap-3">
                        <Zap className="w-4 h-4 text-[#E85D00] shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>{item.title}</p>
                          <p className="text-xs text-[#9FB0C3] mt-1">{item.detail}</p>
                          <div className="flex gap-2 mt-2">
                            {(item.actions || []).filter(a => a === 'auto-email' || a === 'quick-sms').map(a => (
                              <span key={a} className="text-[10px] px-2 py-1 rounded" style={{ color: '#E85D00', background: '#E85D0015', fontFamily: fontFamily.mono }}>{a}</span>
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
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Operational Recommendations</h3>
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
      </UpgradeCardsGate>
    </DashboardLayout>
  );
};

export default AutomationsPageAuth;
