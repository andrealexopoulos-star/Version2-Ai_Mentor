import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import {
  LayoutDashboard, TrendingUp, Bell, Zap, Mail, Calendar,
  BarChart2, ShieldCheck, Database, ArrowRight, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, Clock, DollarSign, Users, Activity,
  Wifi, FileText, ToggleRight,
} from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

// ─── Shared mock styles ───────────────────────────────────────────────────────
const MOCK_BG   = 'rgba(10,16,24,0.98)';
const MOCK_CARD = 'rgba(255,255,255,0.04)';
const MOCK_BORD = 'rgba(255,255,255,0.07)';
const O = '#E85D00';   // orange
const G = '#10B981';   // green
const R = '#EF4444';   // red
const B = '#3B82F6';   // blue
const Y = '#F59E0B';   // amber

const Tag = ({ color = O, children }) => (
  <span style={{ background: `${color}18`, color, border: `1px solid ${color}30`, fontFamily: fontFamily.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', padding: '2px 8px', borderRadius: 4 }}>
    {children}
  </span>
);

const MockRow = ({ label, value, color = '#9FB0C3', dot }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${MOCK_BORD}` }}>
    <span style={{ fontFamily: fontFamily.body, color: '#9FB0C3', fontSize: 11 }}>{label}</span>
    <span style={{ fontFamily: fontFamily.mono, color, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
      {value}
    </span>
  </div>
);

const MockCard = ({ children, style = {} }) => (
  <div style={{ background: MOCK_CARD, border: `1px solid ${MOCK_BORD}`, borderRadius: 10, padding: '12px 14px', ...style }}>
    {children}
  </div>
);

const MockBadge = ({ color, label }) => (
  <span style={{ background: `${color}18`, color, border: `1px solid ${color}30`, fontFamily: fontFamily.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', padding: '2px 7px', borderRadius: 4 }}>
    {label}
  </span>
);

// ─── SLIDE MOCKUPS ───────────────────────────────────────────────────────────

const DashboardMock = () => (
  <div style={{ background: MOCK_BG, borderRadius: 12, overflow: 'hidden', fontSize: 11, fontFamily: fontFamily.body }}>
    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      <div style={{ color: '#EDF1F7', fontWeight: 700, fontSize: 14, fontFamily: fontFamily.display }}>Good afternoon, Andre.</div>
      <div style={{ color: '#64748B', fontSize: 10, marginTop: 2 }}>Last intelligence update: 12 minutes ago</div>
    </div>
    <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      {[['Business Health', '74%', G], ['Cash Risk', 'Moderate', Y], ['Revenue', 'Stable', G], ['SLA Breaches', '2', R], ['Compliance', '96%', G]].map(([l, v, c]) => (
        <div key={l} style={{ background: MOCK_CARD, border: `1px solid ${MOCK_BORD}`, borderRadius: 8, padding: '6px 10px', flex: 1, minWidth: 0 }}>
          <div style={{ color: '#64748B', fontSize: 8, marginBottom: 2 }}>{l}</div>
          <div style={{ color: c, fontWeight: 700, fontSize: 12 }}>{v}</div>
        </div>
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 10, padding: '10px 16px' }}>
      <div>
        <div style={{ color: '#EDF1F7', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>What Needs Attention <span style={{ background: `${O}20`, color: O, borderRadius: 10, padding: '1px 7px', fontSize: 9 }}>5 items</span></div>
        {[
          ['Invoice #1847 — $3,200 overdue 12 days', 'CRITICAL', R],
          ['3 enterprise deals stalled at proposal', 'CRITICAL', R],
          ['Subcontractor costs up 12% in 45 days', 'MODERATE', Y],
          ['3 new leads not contacted in 24 hours', 'MODERATE', Y],
          ['BAS Q3 due in 18 days', 'INFO', B],
        ].map(([title, severity, color]) => (
          <div key={title} style={{ background: MOCK_CARD, border: `1px solid ${MOCK_BORD}`, borderRadius: 7, padding: '7px 10px', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: '#CBD5E1', fontSize: 10 }}>{title}</span>
            </div>
            <MockBadge color={color} label={severity} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MockCard>
          <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 6 }}>Financial Snapshot</div>
          <MockRow label="Cash Trend (30d)" value="+4.2%" color={G} />
          <MockRow label="Receivables Ageing" value="$12,400" color={O} />
          <MockRow label="Margin Variance" value="-3.1%" color={R} />
        </MockCard>
        <MockCard>
          <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 6 }}>Intelligence Pulse</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[['6', G, 'Systems'], ['1,247', B, 'Signals'], ['23', O, 'Alerts (30d)'], ['8', G, 'Prevented']].map(([n, c, l]) => (
              <div key={l} style={{ background: `${c}10`, borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ color: c, fontWeight: 700, fontSize: 14 }}>{n}</div>
                <div style={{ color: '#64748B', fontSize: 9 }}>{l}</div>
              </div>
            ))}
          </div>
        </MockCard>
      </div>
    </div>
  </div>
);

const RevenueMock = () => (
  <div style={{ background: MOCK_BG, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      <div>
        <div style={{ color: '#EDF1F7', fontWeight: 700, fontSize: 14, fontFamily: fontFamily.display }}>Revenue Health</div>
        <div style={{ color: '#64748B', fontSize: 10, marginTop: 2 }}>Overall position based on pipeline, concentration & churn</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: O, fontWeight: 800, fontSize: 28 }}>67%</div>
        <div style={{ color: '#64748B', fontSize: 9, letterSpacing: '0.1em' }}>MODERATE RISK</div>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '12px 16px' }}>
      <MockCard>
        <div style={{ color: B, fontWeight: 700, fontSize: 11, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={11} /> Pipeline Stability</div>
        <MockRow label="Total Pipeline" value="$185K" />
        <MockRow label="Weighted Value" value="$74K" />
        <MockRow label="Active Deals" value="8" />
        <MockRow label="Stalled (>7d)" value="3" color={R} />
        <div style={{ marginTop: 8, padding: '6px 8px', background: `${B}10`, borderRadius: 6, borderLeft: `2px solid ${B}` }}>
          <div style={{ color: '#CBD5E1', fontSize: 9 }}><strong>Insight:</strong> 3 deals stalled at proposal. Close rate declining.</div>
        </div>
      </MockCard>
      <MockCard>
        <div style={{ color: O, fontWeight: 700, fontSize: 11, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> Revenue Concentration</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#9FB0C3', fontSize: 10 }}>Entropy Level</span>
          <Tag color={R}>HIGH</Tag>
        </div>
        <div style={{ color: '#9FB0C3', fontSize: 10, marginBottom: 6 }}>Top 2 Deals: <strong style={{ color: '#EDF1F7' }}>60%</strong></div>
        {[['Deal Alpha', '$45K · 65%', G], ['Deal Beta', '$28K · 40%', O], ['Deal Gamma', '$15K · 80%', B]].map(([n, v, c]) => (
          <div key={n} style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: '#CBD5E1' }}>{n}</span>
              <span style={{ color: c }}>{v}</span>
            </div>
            <div style={{ height: 4, background: MOCK_BORD, borderRadius: 2 }}>
              <div style={{ height: '100%', background: c, borderRadius: 2, width: n === 'Deal Alpha' ? '65%' : n === 'Deal Beta' ? '40%' : '80%' }} />
            </div>
          </div>
        ))}
      </MockCard>
      <MockCard>
        <div style={{ color: R, fontWeight: 700, fontSize: 11, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} /> Churn Probability</div>
        <MockRow label="At-Risk Clients" value="2" color={R} />
        <MockRow label="Revenue at Risk" value="$18,400" color={R} />
        <div style={{ marginTop: 8, borderRadius: 7, padding: '7px 9px', background: MOCK_CARD, border: `1px solid ${R}25`, marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ color: '#CBD5E1', fontSize: 10, fontWeight: 600 }}>Key Account #1</span>
            <Tag color={R}>HIGH</Tag>
          </div>
          <div style={{ color: '#9FB0C3', fontSize: 9 }}>Response time elevated. Engagement declining 30d.</div>
        </div>
        <div style={{ borderRadius: 7, padding: '7px 9px', background: MOCK_CARD, border: `1px solid ${Y}25` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ color: '#CBD5E1', fontSize: 10, fontWeight: 600 }}>Client F</span>
            <Tag color={Y}>MODERATE</Tag>
          </div>
          <div style={{ color: '#9FB0C3', fontSize: 9 }}>Contract renewal in 45 days. No renewal discussion.</div>
        </div>
      </MockCard>
    </div>
  </div>
);

const AlertsMock = () => (
  <div style={{ background: MOCK_BG, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      <div style={{ color: '#EDF1F7', fontWeight: 700, fontSize: 14, fontFamily: fontFamily.display }}>Alerts &amp; Actions</div>
    </div>
    <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      {[[R, 'Critical', '2'], [Y, 'Moderate', '3'], [B, 'Info', '2']].map(([c, l, n]) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${c}12`, border: `1px solid ${c}30`, borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
          <span style={{ color: c, fontSize: 11, fontFamily: fontFamily.mono, fontWeight: 600 }}>{l} {n}</span>
        </div>
      ))}
    </div>
    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ color: '#64748B', fontSize: 9, fontFamily: fontFamily.mono, letterSpacing: '0.14em', marginBottom: 2 }}>CRITICAL</div>
      {[['Invoice #1847 overdue 12 days — $3,200', '2h ago', R], ['3 deals stalled at proposal stage', '4h ago', R]].map(([t, time, c]) => (
        <div key={t} style={{ background: MOCK_CARD, border: `1px solid ${c}20`, borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
            <span style={{ color: '#CBD5E1', fontSize: 11 }}>{t}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ color: '#64748B', fontSize: 10 }}>{time}</span>
            <Tag color={c}>CRITICAL</Tag>
          </div>
        </div>
      ))}
      <div style={{ color: '#64748B', fontSize: 9, fontFamily: fontFamily.mono, letterSpacing: '0.14em', marginTop: 4, marginBottom: 2 }}>MODERATE</div>
      {[['Subcontractor costs increasing 12%', '1d ago'], ['Staff overtime 15% above target', '1d ago'], ['Key account engagement declining', '2d ago']].map(([t, time]) => (
        <div key={t} style={{ background: MOCK_CARD, border: `1px solid ${Y}20`, borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: Y, flexShrink: 0 }} />
            <span style={{ color: '#CBD5E1', fontSize: 11 }}>{t}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ color: '#64748B', fontSize: 10 }}>{time}</span>
            <Tag color={Y}>MODERATE</Tag>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AutomationsMock = () => (
  <div style={{ background: MOCK_BG, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      <div style={{ color: '#EDF1F7', fontWeight: 700, fontSize: 14, fontFamily: fontFamily.display }}>Automations</div>
      <div style={{ background: O, color: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600 }}>+ New Automation</div>
    </div>
    <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      {[['Active', '3', G], ['Paused', '1', '#64748B'], ['Total Runs', '59', B]].map(([l, n, c]) => (
        <div key={l} style={{ background: MOCK_CARD, border: `1px solid ${MOCK_BORD}`, borderRadius: 7, padding: '5px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#9FB0C3', fontSize: 10 }}>{l}</span>
          <span style={{ color: c, fontWeight: 700, fontSize: 11 }}>{n}</span>
        </div>
      ))}
    </div>
    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { icon: DollarSign, color: O, name: 'Overdue Invoice Follow-up', runs: '12 runs · Last: 2h ago', cond: 'Invoice is overdue > 7 days AND client has not responded', action: 'Send automated payment reminder via email. Escalate to phone after 48 hours.', on: true },
        { icon: Mail, color: B, name: 'New Lead Auto-Response', runs: '34 runs · Last: 6h ago', cond: 'New lead received AND not contacted within 4 hours', action: 'Send personalised intro email from CRM template. Log to HubSpot.', on: true },
        { icon: AlertTriangle, color: Y, name: 'Churn Risk Alert', runs: '5 runs · Last: 3d ago', cond: 'Client engagement score drops below 40% AND response time > 2×', action: 'Flag client as at-risk. Notify account manager. Draft re-engagement email.', on: true },
      ].map(({ icon: Icon, color, name, runs, cond, action, on }) => (
        <div key={name} style={{ background: MOCK_CARD, border: `1px solid ${MOCK_BORD}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderBottom: `1px solid ${MOCK_BORD}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: `${color}18`, borderRadius: 7, padding: 5 }}><Icon size={12} style={{ color }} /></div>
              <div>
                <div style={{ color: '#EDF1F7', fontSize: 11, fontWeight: 600 }}>{name}</div>
                <div style={{ color: '#64748B', fontSize: 9 }}>{runs}</div>
              </div>
            </div>
            <div style={{ width: 32, height: 18, borderRadius: 9, background: on ? O : '#334155', position: 'relative', cursor: 'pointer' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: on ? 16 : 2, transition: 'left 0.2s' }} />
            </div>
          </div>
          <div style={{ padding: '7px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ background: `${B}10`, borderRadius: 5, padding: '4px 8px', fontSize: 10, color: '#9FB0C3', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: B, fontWeight: 700, fontFamily: fontFamily.mono, fontSize: 9 }}>IF</span> {cond}
            </div>
            <div style={{ background: `${G}10`, borderRadius: 5, padding: '4px 8px', fontSize: 10, color: '#9FB0C3', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: G, fontWeight: 700, fontFamily: fontFamily.mono, fontSize: 9 }}>THEN</span> {action}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const InboxMock = () => (
  <div style={{ background: MOCK_BG, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${MOCK_BORD}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ color: '#EDF1F7', fontWeight: 700, fontSize: 14, fontFamily: fontFamily.display }}>Priority Inbox</div>
        <div style={{ color: '#64748B', fontSize: 10, marginTop: 2 }}>AI-triaged — highest-impact messages first</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Tag color={R}>Urgent 3</Tag><Tag color={Y}>Follow-up 5</Tag>
      </div>
    </div>
    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[
        { from: 'Sarah Chen — Key Account #1', subject: 'Re: Q4 renewal — decision this week', preview: 'We need to finalise terms before the board meeting on Friday. The competing offer is...', tag: 'URGENT', tagC: R, time: '9:42 AM', action: 'Draft reply', read: false },
        { from: 'Marcus Webb — Accounts Payable', subject: 'Invoice #1847 — Final notice', preview: 'This is the third reminder. If payment is not received by EOD Friday, we will escalate to...', tag: 'URGENT', tagC: R, time: '8:15 AM', action: 'Escalate', read: false },
        { from: 'Tom Harrington — Prospect', subject: 'Interested in your Enterprise tier', preview: 'Saw your product demo last week — we have about 45 staff and looking at a Q1 start. Can we...', tag: 'OPPORTUNITY', tagC: G, time: 'Yesterday', action: 'Book call', read: false },
        { from: 'Internal — BIQc Alert', subject: 'Staff overtime threshold exceeded', preview: 'Jordan P has logged 52 hours this week (target: 45h). SOP requires manager review within 24h.', tag: 'ACTION', tagC: Y, time: 'Yesterday', action: 'Review', read: true },
        { from: 'Alex Morgan — Client', subject: 'Project delivery check-in', preview: 'Just wanted to confirm the milestone delivery is still on track for the 28th? We have a client...', tag: 'FOLLOW-UP', tagC: B, time: '2d ago', action: 'Reply', read: true },
      ].map(({ from, subject, preview, tag, tagC, time, action, read }) => (
        <div key={subject} style={{ background: read ? 'transparent' : MOCK_CARD, border: `1px solid ${read ? MOCK_BORD : tagC + '25'}`, borderRadius: 9, padding: '9px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: read ? 'transparent' : tagC, flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: read ? '#9FB0C3' : '#EDF1F7', fontSize: 11, fontWeight: read ? 400 : 600 }}>{from}</span>
              <span style={{ color: '#64748B', fontSize: 9, flexShrink: 0, marginLeft: 8 }}>{time}</span>
            </div>
            <div style={{ color: read ? '#64748B' : '#CBD5E1', fontSize: 10, fontWeight: read ? 400 : 500, marginBottom: 2 }}>{subject}</div>
            <div style={{ color: '#64748B', fontSize: 9, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{preview}</div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
            <Tag color={tagC}>{tag}</Tag>
            <div style={{ background: `${tagC}15`, color: tagC, border: `1px solid ${tagC}30`, borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{action}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CalendarMock = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const hours = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm'];
  const events = [
    { day: 0, start: 0, span: 1, title: 'Board Stand-up', color: B, tag: 'SCHEDULED' },
    { day: 1, start: 1, span: 2, title: 'Q3 Revenue Review', color: O, tag: 'AI BOOKED' },
    { day: 2, start: 0, span: 1, title: 'Sarah Chen — Renewal Call', color: G, tag: 'AI BOOKED' },
    { day: 3, start: 3, span: 1, title: 'Cash Flow Check', color: Y, tag: 'AI ALERT' },
    { day: 4, start: 2, span: 2, title: 'Deal Beta Follow-up', color: R, tag: 'URGENT' },
    { day: 1, start: 4, span: 1, title: 'Deal Alpha — Close Push', color: G, tag: 'AI BOOKED' },
    { day: 3, start: 1, span: 1, title: 'Compliance Deadline', color: R, tag: 'DEADLINE' },
  ];
  return (
    <div style={{ background: MOCK_BG, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${MOCK_BORD}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#EDF1F7', fontWeight: 700, fontSize: 14, fontFamily: fontFamily.display }}>Calendar</div>
        <div style={{ display: 'flex', gap: 6 }}><Tag color={G}>3 AI Booked</Tag><Tag color={R}>2 Deadlines</Tag></div>
      </div>
      <div style={{ padding: '10px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(5, 1fr)', gap: 4 }}>
          <div />
          {days.map(d => (
            <div key={d} style={{ textAlign: 'center', color: '#9FB0C3', fontSize: 9, fontFamily: fontFamily.mono, paddingBottom: 6 }}>{d}</div>
          ))}
          {hours.map((hr, hi) => (
            <React.Fragment key={hr}>
              <div style={{ color: '#64748B', fontSize: 8, textAlign: 'right', paddingRight: 6, paddingTop: 4 }}>{hr}</div>
              {days.map((_, di) => {
                const ev = events.find(e => e.day === di && e.start === hi);
                const isContinued = events.find(e => e.day === di && e.start < hi && e.start + e.span > hi);
                if (isContinued) return <div key={di} style={{ background: `${isContinued.color}18`, borderLeft: `2px solid ${isContinued.color}`, borderRadius: 0, height: 26 }} />;
                if (ev) return (
                  <div key={di} style={{ background: `${ev.color}18`, border: `1px solid ${ev.color}40`, borderRadius: 6, padding: '3px 5px', height: ev.span * 30 - 4 }}>
                    <div style={{ color: ev.color, fontSize: 8, fontWeight: 700, lineHeight: 1.2 }}>{ev.title}</div>
                    <div style={{ color: ev.color, fontSize: 7, opacity: 0.7, marginTop: 1 }}>{ev.tag}</div>
                  </div>
                );
                return <div key={di} style={{ height: 26, border: `1px dashed ${MOCK_BORD}`, borderRadius: 4 }} />;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

const MarketMock = () => (
  <div style={{ background: MOCK_BG, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      <div style={{ color: '#EDF1F7', fontWeight: 700, fontSize: 14, fontFamily: fontFamily.display }}>Market &amp; Insights</div>
      <div style={{ color: '#64748B', fontSize: 10, marginTop: 2 }}>Competitive position and demand intelligence</div>
    </div>
    <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <MockCard>
        <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 8 }}>Market Position Score</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
          <div style={{ color: G, fontWeight: 800, fontSize: 32, lineHeight: 1 }}>71</div>
          <div style={{ color: '#64748B', fontSize: 10, paddingBottom: 4 }}>/ 100 · STABLE</div>
        </div>
        {[['Website SEO', 68, G], ['Review Presence', 45, Y], ['Pricing Position', 82, G], ['Competitor Density', 55, Y], ['Brand Clarity', 74, G]].map(([l, v, c]) => (
          <div key={l} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
              <span style={{ color: '#9FB0C3' }}>{l}</span><span style={{ color: c }}>{v}</span>
            </div>
            <div style={{ height: 3, background: MOCK_BORD, borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${v}%`, background: c, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </MockCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MockCard>
          <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 6 }}>Competitor Signals (7d)</div>
          {[
            { name: 'Competitor A', signal: 'Pricing drop 8%', severity: R },
            { name: 'Competitor B', signal: 'New feature launch', severity: Y },
            { name: 'Competitor C', signal: 'Hiring 3 AEs', severity: B },
          ].map(({ name, signal, severity }) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${MOCK_BORD}` }}>
              <span style={{ color: '#CBD5E1', fontSize: 10 }}>{name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: '#9FB0C3', fontSize: 9 }}>{signal}</span>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: severity }} />
              </div>
            </div>
          ))}
        </MockCard>
        <MockCard>
          <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 6 }}>Demand Capture</div>
          <div style={{ color: G, fontWeight: 700, fontSize: 20 }}>38%</div>
          <div style={{ color: '#64748B', fontSize: 9, marginBottom: 6 }}>of available demand captured</div>
          <div style={{ background: `${O}10`, borderRadius: 5, padding: '5px 7px', borderLeft: `2px solid ${O}` }}>
            <div style={{ color: O, fontSize: 9 }}>Growth lever: Local SEO could add +12% demand</div>
          </div>
        </MockCard>
        <MockCard>
          <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 4 }}>90-Day Trajectory</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['Best', '+22%', G], ['Base', '+8%', B], ['Worst', '-4%', R]].map(([l, v, c]) => (
              <div key={l} style={{ flex: 1, background: `${c}10`, borderRadius: 5, padding: '5px 0', textAlign: 'center' }}>
                <div style={{ color: '#9FB0C3', fontSize: 8 }}>{l}</div>
                <div style={{ color: c, fontWeight: 700, fontSize: 12 }}>{v}</div>
              </div>
            ))}
          </div>
        </MockCard>
      </div>
    </div>
  </div>
);

const ComplianceMock = () => (
  <div style={{ background: MOCK_BG, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      <div style={{ color: '#EDF1F7', fontWeight: 700, fontSize: 14, fontFamily: fontFamily.display }}>Compliance</div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: G, fontWeight: 800, fontSize: 24 }}>96%</div>
        <div style={{ color: '#64748B', fontSize: 9 }}>OVERALL SCORE</div>
      </div>
    </div>
    <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div>
        <div style={{ color: '#9FB0C3', fontSize: 9, fontFamily: fontFamily.mono, letterSpacing: '0.12em', marginBottom: 6 }}>UPCOMING DEADLINES</div>
        {[
          { name: 'BAS Q3 Lodgement', days: '18 days', color: Y },
          { name: 'Workers Comp Renewal', days: '32 days', color: Y },
          { name: 'PAYG Withholding', days: '45 days', color: G },
          { name: 'Annual Return', days: '67 days', color: G },
          { name: 'Privacy Policy Review', days: '82 days', color: G },
        ].map(({ name, days, color }) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${MOCK_BORD}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={9} style={{ color }} />
              <span style={{ color: '#CBD5E1', fontSize: 10 }}>{name}</span>
            </div>
            <span style={{ color, fontSize: 10, fontFamily: fontFamily.mono }}>{days}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MockCard>
          <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 6 }}>Compliance Areas</div>
          {[['Tax & Payroll', 100, G], ['Employment Law', 94, G], ['Data Privacy', 88, Y], ['WHS Requirements', 96, G], ['Licensing', 100, G]].map(([l, v, c]) => (
            <div key={l} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
                <span style={{ color: '#9FB0C3' }}>{l}</span><span style={{ color: c }}>{v}%</span>
              </div>
              <div style={{ height: 4, background: MOCK_BORD, borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${v}%`, background: c, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </MockCard>
        <MockCard>
          <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 6 }}>Open Actions</div>
          {[['Update staff privacy notice', R], ['Review subcontractor ABN', Y], ['Lodge BAS Q3', Y]].map(([t, c]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: `1px solid ${MOCK_BORD}` }}>
              <AlertTriangle size={9} style={{ color: c }} />
              <span style={{ color: '#9FB0C3', fontSize: 9 }}>{t}</span>
            </div>
          ))}
        </MockCard>
      </div>
    </div>
  </div>
);

const DataHealthMock = () => (
  <div style={{ background: MOCK_BG, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${MOCK_BORD}` }}>
      <div style={{ color: '#EDF1F7', fontWeight: 700, fontSize: 14, fontFamily: fontFamily.display }}>Data Health</div>
      <div style={{ color: '#64748B', fontSize: 10, marginTop: 2 }}>Live connection status and data freshness</div>
    </div>
    <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div>
        <div style={{ color: '#9FB0C3', fontSize: 9, fontFamily: fontFamily.mono, letterSpacing: '0.12em', marginBottom: 6 }}>CONNECTED SYSTEMS</div>
        {[
          { name: 'Xero', type: 'Accounting', status: 'Live', fresh: '2 min ago', c: G },
          { name: 'HubSpot', type: 'CRM', status: 'Live', fresh: '4 min ago', c: G },
          { name: 'Outlook', type: 'Email', status: 'Live', fresh: '1 min ago', c: G },
          { name: 'BambooHR', type: 'HR', status: 'Syncing', fresh: '12 min ago', c: Y },
          { name: 'Stripe', type: 'Payments', status: 'Live', fresh: '3 min ago', c: G },
          { name: 'Google Drive', type: 'Docs', status: 'Error', fresh: '3h ago', c: R },
        ].map(({ name, type, status, fresh, c }) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${MOCK_BORD}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
              <div>
                <div style={{ color: '#CBD5E1', fontSize: 10, fontWeight: 600 }}>{name}</div>
                <div style={{ color: '#64748B', fontSize: 8 }}>{type}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: c, fontSize: 9, fontWeight: 600 }}>{status}</div>
              <div style={{ color: '#64748B', fontSize: 8 }}>{fresh}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MockCard>
          <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 6 }}>Overall Data Health</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[['Live', '5', G], ['Syncing', '1', Y], ['Error', '1', R]].map(([l, n, c]) => (
              <div key={l} style={{ flex: 1, background: `${c}10`, borderRadius: 6, padding: '6px 0', textAlign: 'center' }}>
                <div style={{ color: c, fontWeight: 700, fontSize: 16 }}>{n}</div>
                <div style={{ color: '#64748B', fontSize: 8 }}>{l}</div>
              </div>
            ))}
          </div>
          <MockRow label="Signals processed (24h)" value="1,247" color={B} />
          <MockRow label="Data gaps flagged" value="3" color={Y} />
          <MockRow label="Confidence score" value="91%" color={G} />
        </MockCard>
        <MockCard>
          <div style={{ color: '#9FB0C3', fontSize: 9, marginBottom: 6 }}>Data Gaps Affecting Intelligence</div>
          {['Google Drive disconnected — Doc signals missing', 'BambooHR delay — Staff signals 12min stale', 'No Payroll data — Cash projections estimated'].map(g => (
            <div key={g} style={{ display: 'flex', gap: 5, padding: '4px 0', borderBottom: `1px solid ${MOCK_BORD}`, alignItems: 'flex-start' }}>
              <AlertTriangle size={9} style={{ color: Y, marginTop: 1, flexShrink: 0 }} />
              <span style={{ color: '#9FB0C3', fontSize: 9 }}>{g}</span>
            </div>
          ))}
        </MockCard>
      </div>
    </div>
  </div>
);

// ─── Slide definitions ────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard',
    tagline: 'Your AI morning briefing — every day, before your first coffee.',
    description: 'BIQc monitors every business signal overnight and surfaces a prioritised briefing with live KPIs, critical alerts, and financial snapshots.',
    highlights: ['74% Business Health score', '5 live KPI signals', 'Prioritised alert queue'],
    mockup: <DashboardMock />,
  },
  {
    id: 'revenue', icon: TrendingUp, label: 'Revenue',
    tagline: 'Know your revenue health before your pipeline stalls.',
    description: 'Deep analysis of pipeline stability, revenue concentration risk, and churn probability — updated continuously from your CRM.',
    highlights: ['Pipeline velocity tracking', 'Concentration risk scoring', 'Churn early warning'],
    mockup: <RevenueMock />,
  },
  {
    id: 'alerts', icon: Bell, label: 'Alerts & Actions',
    tagline: 'Problems flagged before they become crises.',
    description: 'Every anomaly across finance, sales, operations, and compliance is triaged, severity-ranked, and surfaced with a clear action.',
    highlights: ['Critical / Moderate / Info tiers', 'Time-stamped signals', 'One-click action'],
    mockup: <AlertsMock />,
  },
  {
    id: 'automations', icon: Zap, label: 'Automations',
    tagline: 'Turn BIQc signals into automated business workflows.',
    description: 'Build IF/THEN automations triggered by live business signals — from invoice follow-ups to lead responses and churn alerts.',
    highlights: ['No-code workflow builder', 'CRM and email actions', 'Toggle on/off instantly'],
    mockup: <AutomationsMock />,
  },
  {
    id: 'inbox', icon: Mail, label: 'Priority Inbox',
    tagline: 'Never miss the email that matters.',
    description: 'BIQc reads and triages your email by business impact — surfacing renewals, urgent client requests, and revenue signals first.',
    highlights: ['AI urgency scoring', 'Opportunity tagging', 'Draft reply suggestions'],
    mockup: <InboxMock />,
  },
  {
    id: 'calendar', icon: Calendar, label: 'Calendar',
    tagline: 'Your calendar, organised by business priority.',
    description: 'BIQc books follow-up calls, compliance deadlines, and deal reviews directly into your calendar — based on detected signals.',
    highlights: ['AI-booked follow-ups', 'Deadline auto-scheduling', 'Deal close push events'],
    mockup: <CalendarMock />,
  },
  {
    id: 'market', icon: BarChart2, label: 'Market & Insights',
    tagline: 'Know your market position and competitor moves in real time.',
    description: 'Live market position scoring, demand capture rates, competitor signal detection, and 90-day growth trajectory modelling.',
    highlights: ['Market position score', 'Weekly competitor surveillance', '90-day projections'],
    mockup: <MarketMock />,
  },
  {
    id: 'compliance', icon: ShieldCheck, label: 'Compliance',
    tagline: 'Never miss a compliance deadline again.',
    description: 'BIQc tracks every regulatory obligation, licence renewal, and policy requirement — and flags them before they become penalties.',
    highlights: ['96% compliance score', 'Deadline countdown', 'Area-by-area scoring'],
    mockup: <ComplianceMock />,
  },
  {
    id: 'data-health', icon: Database, label: 'Data Health',
    tagline: 'Full visibility over the quality of your business intelligence.',
    description: 'See every connected system, data freshness score, and confidence level. Know exactly where gaps are affecting your intelligence.',
    highlights: ['Live connection status', '1,247 signals / 24h', 'Gap impact alerts'],
    mockup: <DataHealthMock />,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformPage() {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback((idx) => {
    if (animating || idx === active) return;
    setAnimating(true);
    setTimeout(() => {
      setActive(idx);
      setAnimating(false);
    }, 280);
  }, [animating, active]);

  const prev = () => goTo((active - 1 + SLIDES.length) % SLIDES.length);
  const next = () => goTo((active + 1) % SLIDES.length);

  useEffect(() => {
    const timer = setInterval(() => goTo((active + 1) % SLIDES.length), 6000);
    return () => clearInterval(timer);
  }, [active, goTo]);

  const slide = SLIDES[active];

  return (
    <WebsiteLayout>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .slide-enter { animation: slideIn 0.35s ease both; }
      `}</style>

      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(180deg, #080C14 0%, #0B1120 100%)', paddingTop: 80, paddingBottom: 48 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <span style={{ fontFamily: fontFamily.mono, color: O, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            The Platform
          </span>
          <h1 style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.08, fontWeight: 700, margin: '12px 0 16px' }}>
            Every flagship page.<br />
            <span style={{ background: 'linear-gradient(135deg, #E85D00, #C44F00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Built for business owners.
            </span>
          </h1>
          <p style={{ fontFamily: fontFamily.body, color: '#9FB0C3', fontSize: 16, lineHeight: 1.6, maxWidth: 540, margin: '0 auto 28px' }}>
            From your morning briefing to compliance deadlines, revenue health to competitor moves —
            BIQc covers every dimension of your business in one platform.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register-supabase" style={{ background: 'var(--lava, #E85D00)', color: '#fff', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 600, fontFamily: fontFamily.body, textDecoration: 'none', boxShadow: '0 6px 24px rgba(232,93,0,0.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Start Free Trial <ArrowRight size={15} />
            </Link>
            <Link to="/meet/soundboard" style={{ background: 'rgba(255,255,255,0.04)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 600, fontFamily: fontFamily.body, textDecoration: 'none' }}>
              Try Soundboard Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ── Tab bar ── */}
      <div style={{ background: '#0B1120', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 64, zIndex: 30 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                borderBottom: `2px solid ${i === active ? O : 'transparent'}`,
                color: i === active ? O : '#64748B',
                fontFamily: fontFamily.mono, fontSize: 12, fontWeight: i === active ? 700 : 500,
                transition: 'color 0.2s',
              }}
            >
              <s.icon size={13} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main showcase ── */}
      <section style={{ background: '#0B1120', padding: '48px 16px 64px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 40, alignItems: 'start' }}>

            {/* Left: description panel */}
            <div className={animating ? '' : 'slide-enter'} style={{ paddingTop: 8 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${O}12`, border: `1px solid ${O}30`, borderRadius: 8, padding: '6px 12px', marginBottom: 16 }}>
                <slide.icon size={14} style={{ color: O }} />
                <span style={{ fontFamily: fontFamily.mono, color: O, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{slide.label}</span>
              </div>
              <h2 style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 22, lineHeight: 1.3, fontWeight: 700, marginBottom: 12 }}>
                {slide.tagline}
              </h2>
              <p style={{ fontFamily: fontFamily.body, color: '#9FB0C3', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
                {slide.description}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                {slide.highlights.map(h => (
                  <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={13} style={{ color: G, flexShrink: 0 }} />
                    <span style={{ fontFamily: fontFamily.body, color: '#CBD5E1', fontSize: 13 }}>{h}</span>
                  </div>
                ))}
              </div>

              {/* Slide progress */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {SLIDES.map((_, i) => (
                  <button key={i} onClick={() => goTo(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ width: i === active ? 20 : 6, height: 6, borderRadius: 3, background: i === active ? O : 'rgba(255,255,255,0.15)', transition: 'all 0.3s' }} />
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={prev} style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#9FB0C3', display: 'flex', alignItems: 'center' }}>
                  <ChevronLeft size={16} />
                </button>
                <button onClick={next} style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#9FB0C3', display: 'flex', alignItems: 'center' }}>
                  <ChevronRight size={16} />
                </button>
                <span style={{ fontFamily: fontFamily.mono, color: '#64748B', fontSize: 11, display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                  {active + 1} / {SLIDES.length}
                </span>
              </div>
            </div>

            {/* Right: mockup */}
            <div key={slide.id} className="slide-enter" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(232,93,0,0.12)', boxShadow: '0 0 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)', opacity: animating ? 0 : 1, transition: 'opacity 0.28s ease' }}>
              {slide.mockup}
            </div>

          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ background: '#080C14', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
          Ready to run your business on intelligence?
        </h2>
        <p style={{ fontFamily: fontFamily.body, color: '#9FB0C3', fontSize: 15, marginBottom: 28, maxWidth: 480, margin: '0 auto 28px' }}>
          Connect your first platform in 2 minutes. No credit card required.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register-supabase" style={{ background: 'var(--lava, #E85D00)', color: '#fff', borderRadius: 12, padding: '14px 32px', fontSize: 15, fontWeight: 600, fontFamily: fontFamily.body, textDecoration: 'none', boxShadow: '0 8px 32px rgba(232,93,0,0.25)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Try It Free <ArrowRight size={16} />
          </Link>
          <Link to="/pricing" style={{ background: 'rgba(255,255,255,0.04)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '14px 32px', fontSize: 15, fontWeight: 600, fontFamily: fontFamily.body, textDecoration: 'none' }}>
            View Pricing
          </Link>
        </div>
        <p style={{ fontFamily: fontFamily.mono, color: '#4A5568', fontSize: 11, marginTop: 16 }}>
          14-day trial · Australian hosted · Cancel anytime
        </p>
      </section>
    </WebsiteLayout>
  );
}
