import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import EnterpriseContactGate from '../components/EnterpriseContactGate';
import { Settings, Clock, Users, AlertTriangle, CheckCircle2, Workflow, Loader2, Plug, Zap } from 'lucide-react';
import DataConfidence from '../components/DataConfidence';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const OperationsPage = () => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState(null);
  const [unifiedOps, setUnifiedOps] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [snapRes, intRes, unifiedRes, cognitionRes] = await Promise.allSettled([
          apiClient.get('/snapshot/latest'),
          apiClient.get('/integrations/merge/connected'),
          apiClient.get('/unified/operations'),
          apiClient.get('/cognition/operations'),
        ]);
        if (snapRes.status === 'fulfilled' && snapRes.value.data?.cognitive) {
          setSnapshot(snapRes.value.data.cognitive);
        }
        if (intRes.status === 'fulfilled' && intRes.value.data) {
          setIntegrations(intRes.value.data);
        }
        if (unifiedRes.status === 'fulfilled' && unifiedRes.value.data) {
          setUnifiedOps(unifiedRes.value.data);
        }
        // Cognition core data (Phase B)
        if (cognitionRes.status === 'fulfilled' && cognitionRes.value.data && cognitionRes.value.data.status !== 'MIGRATION_REQUIRED') {
          setUnifiedOps(prev => ({ ...prev, ...cognitionRes.value.data }));
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const hasIntegrations = integrations?.integrations && Object.values(integrations.integrations).some(Boolean);
  const exec = snapshot?.execution || {};
  const hasRealOpsData = hasIntegrations && (exec.sla_breaches != null || exec.bottleneck);

  return (
    <DashboardLayout>
      <EnterpriseContactGate featureName="Delivery & Operations">
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="operations-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Delivery & Operations</h1>
            <p className="text-sm text-[#9FB0C3]">
              {hasRealOpsData ? 'Operational signals from connected data.' : 'Connect integrations to assess operations.'}
              {loading && <span className="text-[10px] ml-2 text-[#FF6A00]" style={{ fontFamily: fontFamily.mono }}>syncing...</span>}
            </p>
          </div>
          <DataConfidence cognitive={snapshot ? { execution: { sla_breaches: exec.sla_breaches } } : null} />
        </div>

        {loading && (
          <Panel className="text-center py-12">
            <Loader2 className="w-6 h-6 text-[#FF6A00] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-[#9FB0C3]">Loading operational data...</p>
          </Panel>
        )}

        {!loading && !hasRealOpsData && (
          <Panel className="text-center py-12">
            <Plug className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Connect integrations to view verified data.</p>
            <p className="text-xs text-[#64748B] mb-4 max-w-md mx-auto">
              Operations intelligence requires connected project management, CRM, or accounting tools.
              Connect your systems to enable SOP compliance tracking, bottleneck detection, and workload analysis.
            </p>
            <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="ops-connect-cta">
              <Plug className="w-4 h-4" /> Connect Integrations
            </a>
          </Panel>
        )}

        {!loading && hasRealOpsData && (
          <>
            {/* KPI Strip — real data only */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                exec.sla_breaches != null && { label: 'SLA Breaches', value: String(exec.sla_breaches), color: exec.sla_breaches > 0 ? '#FF6A00' : '#10B981', icon: AlertTriangle },
                exec.task_aging != null && { label: 'Task Aging', value: exec.task_aging + '%', color: exec.task_aging > 30 ? '#F59E0B' : '#10B981', icon: Clock },
                exec.active_tasks != null && { label: 'Tasks Active', value: String(exec.active_tasks), color: '#3B82F6', icon: Workflow },
                exec.sop_compliance != null && { label: 'SOP Compliance', value: exec.sop_compliance + '%', color: exec.sop_compliance > 85 ? '#10B981' : '#F59E0B', icon: CheckCircle2 },
              ].filter(Boolean).map(m => (
                <Panel key={m.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: m.color + '15' }}>
                      <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                    </div>
                    <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{m.label}</span>
                  </div>
                  <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{m.value}</span>
                </Panel>
              ))}
            </div>

            {/* Bottleneck */}
            {exec.bottleneck && (
              <Panel>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#F59E0B15' }}>
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Active Bottleneck</h3>
                    <p className="text-sm text-[#9FB0C3] leading-relaxed">{exec.bottleneck}</p>
                  </div>
                </div>
              </Panel>
            )}

            {/* Recommendations from snapshot */}
            {exec.recs?.length > 0 && (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Recommendations</h3>
                <div className="space-y-2">
                  {exec.recs.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                      <p className="text-sm text-[#9FB0C3] leading-relaxed">{r}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* ═══ CROSS-DOMAIN OPERATIONS INTELLIGENCE ═══ */}
            {/* Cognition operations data — shows when SQL migrations deployed */}
            {unifiedOps?.instability_indices && (
              <Panel>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#10B981]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Operations Intelligence</h3>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#10B98115', color: '#10B981', fontFamily: fontFamily.mono }}>COGNITION CORE</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'anomaly_density_score', label: 'ADS', title: 'Anomaly Density' },
                    { key: 'execution_gap_index', label: 'EGI', title: 'Execution Gap' },
                    { key: 'sop_deviation_score', label: 'SDS', title: 'SOP Deviation' },
                    { key: 'bottleneck_severity', label: 'BNS', title: 'Bottleneck Severity' },
                  ].map(({ key, label, title }) => {
                    const val = unifiedOps.instability_indices[key];
                    if (val == null) return null;
                    const pct = Math.round(val * 100);
                    const ic = pct > 60 ? '#EF4444' : pct > 30 ? '#F59E0B' : '#10B981';
                    return (
                      <div key={key} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: ic, fontFamily: fontFamily.mono }}>{label}</span>
                        <div className="text-2xl font-bold" style={{ color: ic, fontFamily: fontFamily.mono }}>{pct}%</div>
                        <span className="text-[9px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{title}</span>
                        <div className="h-1 rounded-full mt-2" style={{ background: ic + '20' }}>
                          <div className="h-1 rounded-full" style={{ background: ic, width: pct + '%' }} />
                        </div>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              </Panel>
            )}

            {unifiedOps?.signals && (
              <>
                {unifiedOps.signals.bottlenecks?.length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 text-[#FF6A00]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Cross-Domain Bottlenecks</h3>
                    </div>
                    <div className="space-y-2">
                      {unifiedOps.signals.bottlenecks.map((b, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#FF6A0008', border: '1px solid #FF6A0025' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#FF6A00' }} />
                          <div>
                            <p className="text-xs text-[#9FB0C3]">{b.detail}</p>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Source: {b.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {unifiedOps.signals.capacity_alerts?.length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-[#F59E0B]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Capacity Alerts</h3>
                    </div>
                    <div className="space-y-2">
                      {unifiedOps.signals.capacity_alerts.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#F59E0B' }} />
                          <div>
                            <p className="text-xs text-[#9FB0C3]">{a.detail}</p>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Source: {a.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </>
            )}
          </>
        )}
      </div>
      </EnterpriseContactGate>
    </DashboardLayout>
  );
};

export default OperationsPage;
