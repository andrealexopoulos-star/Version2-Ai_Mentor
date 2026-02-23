import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FloatingSoundboard from '../components/FloatingSoundboard';
import { Shield, CheckCircle2, AlertTriangle, Clock, FileText, ArrowRight } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const CompliancePage = () => (
  <DashboardLayout>
    <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="compliance-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Compliance Intelligence</h1>
        <p className="text-sm text-[#9FB0C3]">Regulatory obligations, document status, and compliance health.</p>
      </div>

      {/* Compliance Score */}
      <Panel>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Compliance Score</h2>
            <p className="text-sm text-[#9FB0C3]">Based on regulatory obligations, document currency, and audit readiness.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold" style={{ fontFamily: MONO, color: '#10B981' }}>96%</span>
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: '3px solid #10B981', background: '#10B98110' }}>
              <Shield className="w-5 h-5 text-[#10B981]" />
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Obligations */}
        <Panel>
          <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Regulatory Obligations</h3>
          <div className="space-y-3">
            {[
              { name: 'BAS Q3 Submission', status: 'ready', deadline: '18 days', color: '#10B981' },
              { name: 'Workers Compensation Renewal', status: 'pending', deadline: '45 days', color: '#F59E0B' },
              { name: 'Annual Tax Return', status: 'complete', deadline: 'Filed', color: '#10B981' },
              { name: 'Data Protection Audit', status: 'ready', deadline: '90 days', color: '#10B981' },
              { name: 'Insurance Review', status: 'due', deadline: '30 days', color: '#FF6A00' },
            ].map(ob => (
              <div key={ob.name} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                {ob.status === 'complete' ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#10B981' }} />
                  : ob.status === 'due' ? <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#FF6A00' }} />
                  : <Clock className="w-4 h-4 shrink-0" style={{ color: ob.color }} />}
                <div className="flex-1">
                  <span className="text-sm text-[#F4F7FA]">{ob.name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: ob.color, background: ob.color + '15', fontFamily: MONO }}>{ob.deadline}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Document Status */}
        <Panel>
          <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Document Currency</h3>
          <div className="space-y-3">
            {[
              { name: 'Employee Contracts', count: 5, current: 5, status: 'current' },
              { name: 'Subcontractor Agreements', count: 3, current: 2, status: 'expiring' },
              { name: 'Client MSAs', count: 14, current: 13, status: 'review' },
              { name: 'Insurance Certificates', count: 4, current: 4, status: 'current' },
              { name: 'SOPs', count: 12, current: 11, status: 'review' },
            ].map(doc => {
              const pct = Math.round((doc.current / doc.count) * 100);
              const color = pct === 100 ? '#10B981' : pct >= 80 ? '#F59E0B' : '#FF6A00';
              return (
                <div key={doc.name}>
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-[#64748B]" />
                      <span className="text-xs text-[#9FB0C3]">{doc.name}</span>
                    </div>
                    <span className="text-xs" style={{ fontFamily: MONO, color }}>{doc.current}/{doc.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: color + '20' }}>
                    <div className="h-1.5 rounded-full" style={{ background: color, width: pct + '%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* AI Insight */}
      <Panel>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FF6A0015' }}>
            <Shield className="w-4 h-4 text-[#FF6A00]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>AI Compliance Advisory</h3>
            <p className="text-sm text-[#9FB0C3] leading-relaxed">Your compliance posture is strong at 96%. Two items require attention: (1) Insurance review is due in 30 days — schedule with your broker. (2) One subcontractor agreement expires in 22 days — renewal in progress. All BAS obligations are met and Q3 documents are prepared for submission.</p>
          </div>
        </div>
      </Panel>
    </div>
  </DashboardLayout>
);

export default CompliancePage;
