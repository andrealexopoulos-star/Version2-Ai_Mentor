import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { FileText, Download, Calendar, TrendingUp, DollarSign, Users, BarChart3 } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const ReportsPage = () => (
  <DashboardLayout>
    <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="reports-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Reports</h1>
        <p className="text-sm text-[#9FB0C3]">AI-generated business intelligence reports and analytics.</p>
      </div>

      {/* Quick Reports */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Weekly Executive Summary', period: 'Feb 17-23, 2026', icon: BarChart3, color: '#FF6A00', highlights: ['$4,200 cashflow recovered', '12 hours saved via automation', '3 risks mitigated'] },
          { title: 'Revenue Report', period: 'February 2026', icon: TrendingUp, color: '#3B82F6', highlights: ['Pipeline: $185K', 'Win rate: 34%', '3 deals stalled'] },
          { title: 'Operations Report', period: 'February 2026', icon: Users, color: '#10B981', highlights: ['87% SOP compliance', '2 SLA breaches', '14 active tasks'] },
        ].map((report, i) => (
          <Panel key={i}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: report.color + '15' }}>
                <report.icon className="w-4 h-4" style={{ color: report.color }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>{report.title}</h3>
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{report.period}</span>
              </div>
            </div>
            <div className="space-y-1.5 mb-4">
              {report.highlights.map((h, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: report.color }} />
                  <span className="text-xs text-[#9FB0C3]">{h}</span>
                </div>
              ))}
            </div>
            <button className="flex items-center gap-1.5 text-xs font-medium" style={{ color: report.color }}>
              <Download className="w-3.5 h-3.5" />Download PDF
            </button>
          </Panel>
        ))}
      </div>

      {/* Report History */}
      <Panel>
        <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Report History</h3>
        <div className="space-y-2">
          {[
            { name: 'Weekly Executive Summary', date: 'Feb 16, 2026', type: 'Executive', size: '2.4 MB' },
            { name: 'Monthly Revenue Analysis', date: 'Jan 31, 2026', type: 'Revenue', size: '4.1 MB' },
            { name: 'Q4 2025 Compliance Report', date: 'Dec 31, 2025', type: 'Compliance', size: '3.8 MB' },
            { name: 'Annual Business Review', date: 'Dec 15, 2025', type: 'Executive', size: '8.2 MB' },
            { name: 'Weekly Executive Summary', date: 'Feb 9, 2026', type: 'Executive', size: '2.1 MB' },
            { name: 'Risk Assessment Q1 2026', date: 'Jan 15, 2026', type: 'Risk', size: '3.5 MB' },
          ].map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer" style={{ border: '1px solid transparent' }}>
              <FileText className="w-4 h-4 text-[#64748B] shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[#F4F7FA] block">{r.name}</span>
                <span className="text-[11px] text-[#64748B]" style={{ fontFamily: MONO }}>{r.date}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded hidden sm:block" style={{ color: '#64748B', background: '#243140', fontFamily: MONO }}>{r.type}</span>
              <span className="text-[10px] text-[#64748B] shrink-0" style={{ fontFamily: MONO }}>{r.size}</span>
              <Download className="w-4 h-4 text-[#64748B] shrink-0 hover:text-[#FF6A00] transition-colors" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  </DashboardLayout>
);

export default ReportsPage;
