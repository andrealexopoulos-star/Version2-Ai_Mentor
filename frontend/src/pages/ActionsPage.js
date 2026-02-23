import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Zap, Mail, MessageSquare, Users, Check, Clock, ArrowRight, Send } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const ActionsPage = () => (
  <DashboardLayout>
    <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="actions-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Action Centre</h1>
        <p className="text-sm text-[#9FB0C3]">AI-recommended actions ready for execution. Review, approve, and deploy.</p>
      </div>

      {/* Action Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Actions', value: '5', color: '#FF6A00', icon: Clock },
          { label: 'Executed Today', value: '3', color: '#10B981', icon: Check },
          { label: 'Emails Sent', value: '12', color: '#3B82F6', icon: Mail },
          { label: 'Handoffs Made', value: '2', color: '#F59E0B', icon: Users },
        ].map(m => (
          <Panel key={m.label}>
            <div className="flex items-center gap-2 mb-2">
              <m.icon className="w-4 h-4" style={{ color: m.color }} />
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
            </div>
            <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{m.value}</span>
          </Panel>
        ))}
      </div>

      {/* Ready Actions */}
      <div>
        <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: SORA }}>Ready to Execute</h3>
        <div className="space-y-3">
          {[
            { type: 'email', title: 'Payment reminder — Invoice #1847 ($3,200)', recipient: 'client47@example.com', preview: 'Dear [Client], This is a friendly reminder that Invoice #1847 for $3,200 is now 12 days overdue...', confidence: '94%', color: '#3B82F6' },
            { type: 'email', title: 'Re-engagement email — Client B', recipient: 'clientb@example.com', preview: 'Hi [Client], We noticed it has been a while since our last conversation. We wanted to check in...', confidence: '87%', color: '#3B82F6' },
            { type: 'email', title: 'Lead follow-up — 3 new contacts', recipient: '3 recipients', preview: 'Hello [Name], Thank you for your interest in our services. I would love to schedule a brief call...', confidence: '91%', color: '#3B82F6' },
            { type: 'handoff', title: 'Escalate subcontractor costs to Operations', recipient: 'Operations Manager', preview: 'Subcontractor costs have increased 12% in 45 days. Recommend renegotiation or sourcing alternatives.', confidence: '88%', color: '#FF6A00' },
            { type: 'sms', title: 'Overtime alert — Team leads notification', recipient: '3 team leads', preview: 'Hi [Name], BIQc detected overtime exceeding 15% target this week. Please review workload distribution.', confidence: '82%', color: '#10B981' },
          ].map((action, i) => (
            <Panel key={i}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: action.color + '15' }}>
                  {action.type === 'email' ? <Mail className="w-5 h-5" style={{ color: action.color }} /> :
                   action.type === 'sms' ? <MessageSquare className="w-5 h-5" style={{ color: action.color }} /> :
                   <Users className="w-5 h-5" style={{ color: action.color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>{action.title}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded shrink-0" style={{ color: '#10B981', background: '#10B98115', fontFamily: MONO }}>AI: {action.confidence}</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mb-2" style={{ fontFamily: MONO }}>To: {action.recipient}</p>
                  <div className="p-3 rounded-lg mb-3" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                    <p className="text-xs text-[#9FB0C3] line-clamp-2">{action.preview}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#FF6A00' }}>
                      <Send className="w-3 h-3" />Execute
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: '#9FB0C3', border: '1px solid #243140' }}>Edit</button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: '#64748B' }}>Dismiss</button>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  </DashboardLayout>
);

export default ActionsPage;
