import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FloatingSoundboard from '../components/FloatingSoundboard';
import { useSnapshot } from '../hooks/useSnapshot';
import { CognitiveMesh } from '../components/LoadingSystems';
import { FileText, TrendingUp, DollarSign, Users, BarChart3, Download } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const ReportsPage = () => {
  const { cognitive, loading, sources } = useSnapshot();
  const c = cognitive || {};
  const wb = c.weekly_brief || {};
  const cap = c.capital || {};
  const rev = c.revenue || {};
  const exec = c.execution || {};

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: BODY }} data-testid="reports-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Intelligence Reports</h1>
          <p className="text-sm text-[#9FB0C3]">Consolidated intelligence summaries from all connected data sources.</p>
        </div>

        {loading && <CognitiveMesh message="Compiling reports..." />}

        {!loading && (
          <>
            {/* Weekly Brief Summary */}
            {(wb.actions_taken || wb.cashflow_recovered) ? (
              <div className="rounded-xl p-5" style={{ background: '#FF6A0008', border: '1px solid #FF6A0025' }}>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#FF6A00', fontFamily: MONO }}>This Week's Intelligence Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    wb.cashflow_recovered && { label: 'Cash Recovered', value: `$${(wb.cashflow_recovered || 0).toLocaleString()}`, icon: DollarSign, color: '#FF6A00' },
                    wb.hours_saved && { label: 'Hours Saved', value: `${wb.hours_saved}h`, icon: TrendingUp, color: '#10B981' },
                    wb.actions_taken && { label: 'Actions Taken', value: String(wb.actions_taken), icon: BarChart3, color: '#3B82F6' },
                    wb.sop_compliance && { label: 'SOP Compliance', value: `${wb.sop_compliance}%`, icon: FileText, color: '#7C3AED' },
                  ].filter(Boolean).map(m => (
                    <Panel key={m.label}>
                      <m.icon className="w-4 h-4 mb-2" style={{ color: m.color }} />
                      <span className="text-lg font-bold text-[#F4F7FA] block" style={{ fontFamily: MONO }}>{m.value}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
                    </Panel>
                  ))}
                </div>
              </div>
            ) : (
              <Panel className="text-center py-6">
                <FileText className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#64748B]">Weekly intelligence reports generate automatically as BIQc processes your data.</p>
              </Panel>
            )}

            {/* Financial Snapshot */}
            {(cap.runway || cap.margin) && (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>Financial Snapshot</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {cap.runway != null && <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}><span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Runway</span><span className="text-xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{cap.runway}mo</span></div>}
                  {cap.margin && <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}><span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Margin</span><span className="text-sm text-[#F4F7FA]">{cap.margin}</span></div>}
                  {cap.spend && <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}><span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Spend</span><span className="text-sm text-[#F4F7FA]">{cap.spend}</span></div>}
                </div>
              </Panel>
            )}

            {/* Executive Memo */}
            {(c.memo || c.executive_memo) && (
              <Panel>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: MONO }}>Executive Memo</h3>
                <p className="text-sm text-[#9FB0C3] leading-relaxed whitespace-pre-line">{c.memo || c.executive_memo}</p>
              </Panel>
            )}

            {/* Data Sources */}
            {sources?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4" style={{ borderTop: '1px solid #243140' }}>
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Sources:</span>
                {sources.map((s, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#9FB0C3', background: '#141C26', fontFamily: MONO }}>{s}</span>)}
              </div>
            )}
          </>
        )}
      </div>
      <FloatingSoundboard context="Intelligence reports - weekly brief, financial snapshot, executive memo" />
    </DashboardLayout>
  );
};

export default ReportsPage;
