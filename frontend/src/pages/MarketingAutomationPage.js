import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  Megaphone, FileText, Share2, Globe, Briefcase, 
  Loader2, Copy, Check, ChevronDown, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const CONTENT_TYPES = [
  { id: 'google_ad', label: 'Google Ads', icon: Megaphone, description: 'Generate high-converting ad copy with headlines and descriptions' },
  { id: 'blog', label: 'Blog Post', icon: FileText, description: 'SEO-optimised blog posts with structured sections' },
  { id: 'social_post', label: 'Social Media', icon: Share2, description: 'Platform-specific posts for LinkedIn, Twitter, Instagram' },
  { id: 'landing_page', label: 'Landing Page', icon: Globe, description: 'Conversion-focused landing page copy' },
  { id: 'job_description', label: 'Job Description', icon: Briefcase, description: 'Compelling job listings for your open roles' },
];

const MarketingAutomationPage = () => {
  const [selectedType, setSelectedType] = useState(null);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('professional');
  const [audience, setAudience] = useState('');
  const [context, setContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!selectedType || !topic.trim()) {
      toast.error('Please select a content type and enter a topic');
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await apiClient.post('/automation/generate', {
        content_type: selectedType,
        topic: topic.trim(),
        tone,
        target_audience: audience.trim(),
        additional_context: context.trim(),
      });
      setResult(res.data);
      toast.success('Content generated successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!result?.content) return;
    const text = typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = (content) => {
    if (!content) return null;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch { return <p className="text-sm text-[#8FA0B8] whitespace-pre-wrap">{content}</p>; }
    }
    return (
      <div className="space-y-4">
        {Object.entries(content).map(([key, value]) => (
          <div key={key} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1.5" style={{ fontFamily: fontFamily.mono }}>{key.replace(/_/g, ' ')}</span>
            {Array.isArray(value) ? (
              <div className="space-y-2">
                {value.map((item, i) => (
                  <div key={i} className="text-sm text-[#8FA0B8]">
                    {typeof item === 'object' ? (
                      <div className="pl-3 border-l-2 border-[rgba(140,170,210,0.15)]">
                        {Object.entries(item).map(([k, v]) => (
                          <p key={k}><span className="text-[#64748B]">{k}:</span> {String(v)}</p>
                        ))}
                      </div>
                    ) : String(item)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#EDF1F7]">{String(value)}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="marketing-automation-page">
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Content Engine</div>
          <h1 className="font-medium mb-1" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Marketing <em style={{ fontStyle: 'italic', color: '#E85D00' }}>automation</em>.</h1>
          <p className="text-sm" style={{ color: '#8FA0B8' }}>Generate marketing content grounded in your business data and intelligence.</p>
        </div>

        {/* KPI Strip — matches mockup ma-kpis */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Campaigns', value: '4', delta: '+1 this week', up: true },
            { label: 'Emails Sent (30d)', value: '1,247', delta: '+18% vs prev', up: true },
            { label: 'Avg Open Rate', value: '34.2%', delta: '+2.1pts', up: true },
            { label: 'Conversions', value: '23', delta: '-3 vs prev', up: false },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-2xl p-4" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.12)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: '#708499' }}>{kpi.label}</span>
              <span className="text-[28px] font-bold block" style={{ fontFamily: fontFamily.mono, color: '#EDF1F7', lineHeight: 1 }}>{kpi.value}</span>
              <span className="text-xs font-medium mt-1 block" style={{ color: kpi.up ? '#16A34A' : '#DC2626' }}>{kpi.delta}</span>
            </div>
          ))}
        </div>

        {/* AI Suggestion — matches mockup ai-suggestion */}
        <div className="rounded-2xl p-5" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.12)', borderLeft: '3px solid #E85D00' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full" style={{ background: '#E85D00', boxShadow: '0 0 6px #E85D00' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#E85D00' }}>AI Recommendation</span>
          </div>
          <p className="text-sm font-semibold mb-2" style={{ color: '#EDF1F7' }}>Re-engage stalled Bramwell Holdings with a case-study drip</p>
          <p className="text-sm leading-relaxed mb-4" style={{ color: '#8FA0B8' }}>Bramwell Holdings has been in the Negotiation stage for 28 days with declining engagement. A 3-email case study sequence targeting their specific pain points has a 67% predicted re-engagement rate based on similar deal patterns.</p>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-md text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E85D00, #FF7A1A)' }}>Create sequence</button>
            <button className="px-4 py-2 rounded-md text-xs font-semibold" style={{ border: '1px solid rgba(140,170,210,0.12)', color: '#8FA0B8' }}>View analysis</button>
          </div>
        </div>

        {/* Campaign Tabs — matches mockup ma-tabs */}
        <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'rgba(140,170,210,0.12)' }}>
          {['All Campaigns', 'Active', 'Scheduled', 'Drafts', 'Completed'].map((tab, i) => (
            <button key={tab} className="px-4 py-3 text-sm font-medium whitespace-nowrap" style={{ color: i === 0 ? '#EDF1F7' : '#8FA0B8', borderBottom: i === 0 ? '2px solid #E85D00' : '2px solid transparent' }}>{tab}</button>
          ))}
        </div>

        {/* Campaign Cards — matches mockup campaign-list */}
        <div className="space-y-4">
          {[
            { status: 'Active', statusBg: '#D1FAE5', statusColor: '#065F46', type: 'Email Sequence - 5 steps', title: 'Q2 Pipeline Nurture', desc: 'Automated 5-touch email sequence for Q2 pipeline leads.', metrics: [{ l: 'Sent', v: '486' }, { l: 'Opens', v: '38.2%' }, { l: 'Clicks', v: '12.4%' }, { l: 'Replies', v: '8' }, { l: 'Meetings', v: '3' }], progress: 65, progressLabel: 'Step 4 of 5' },
            { status: 'Active', statusBg: '#D1FAE5', statusColor: '#065F46', type: 'Re-engagement - 3 steps', title: 'Churn Risk Outreach', desc: 'Triggered when customer health score drops below 40.', metrics: [{ l: 'Sent', v: '42' }, { l: 'Opens', v: '52.1%' }, { l: 'Clicks', v: '19.3%' }, { l: 'Replies', v: '5' }, { l: 'Saved', v: '2' }], progress: 33, progressLabel: 'Ongoing - 3 contacts' },
            { status: 'Scheduled', statusBg: '#DBEAFE', statusColor: '#1E40AF', type: 'Event Invite - Single send', title: 'Q2 Webinar — Cash Flow Mastery for SMBs', desc: 'Invitation for the upcoming live webinar on cash flow management.', metrics: [{ l: 'Recipients', v: '84' }, { l: 'Scheduled', v: '14 Apr' }, { l: 'Webinar', v: '21 Apr' }, { l: 'RSVPs', v: '-' }, { l: 'Status', v: 'Ready' }], progress: 0, progressLabel: 'Sends in 4 days' },
          ].map(c => (
            <div key={c.title} className="rounded-2xl p-5 cursor-pointer transition-all hover:border-[rgba(140,170,210,0.25)]" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.12)' }}>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: c.statusBg, color: c.statusColor }}>{c.status}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#708499' }}>{c.type}</span>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', letterSpacing: '-0.01em' }}>{c.title}</h3>
              <p className="text-sm mb-4" style={{ color: '#8FA0B8' }}>{c.desc}</p>
              <div className="grid grid-cols-5 gap-3 p-3 rounded-lg mb-4" style={{ background: 'rgba(140,170,210,0.06)' }}>
                {c.metrics.map(m => (
                  <div key={m.l}><span className="text-[10px] uppercase tracking-wider block" style={{ color: '#708499' }}>{m.l}</span><span className="text-sm font-bold" style={{ fontFamily: fontFamily.mono, color: '#EDF1F7' }}>{m.v}</span></div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(140,170,210,0.12)' }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${c.progress}%`, background: 'linear-gradient(90deg, #E85D00, #FF7A1A)' }} />
                </div>
                <span className="text-xs whitespace-nowrap" style={{ color: '#708499' }}>{c.progressLabel}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
          {/* Left: Config */}
          <div className="space-y-5">
            <Panel>
              <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: fontFamily.display }}>Content Type</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CONTENT_TYPES.map(ct => (
                  <button
                    key={ct.id}
                    onClick={() => setSelectedType(ct.id)}
                    data-testid={`content-type-${ct.id}`}
                    className="p-3 rounded-lg text-left transition-all"
                    style={{
                      background: selectedType === ct.id ? 'rgba(232, 93, 0, 0.1)' : '#0F1720',
                      border: selectedType === ct.id ? '1px solid rgba(232, 93, 0, 0.3)' : '1px solid rgba(140,170,210,0.15)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ct.icon className="w-4 h-4" style={{ color: selectedType === ct.id ? '#E85D00' : '#64748B' }} />
                      <span className="text-sm font-medium" style={{ color: selectedType === ct.id ? '#E85D00' : '#EDF1F7' }}>{ct.label}</span>
                    </div>
                    <p className="text-[11px] text-[#64748B]">{ct.description}</p>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel>
              <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: fontFamily.display }}>Parameters</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#64748B] block mb-1.5" style={{ fontFamily: fontFamily.mono }}>Topic *</label>
                  <input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g., Q1 product launch for SMB market"
                    data-testid="marketing-topic-input"
                    className="w-full px-3 py-2.5 rounded-md text-sm"
                    style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1.5" style={{ fontFamily: fontFamily.mono }}>Tone</label>
                    <div className="relative">
                      <select
                        value={tone}
                        onChange={e => setTone(e.target.value)}
                        data-testid="marketing-tone-select"
                        className="w-full px-3 py-2.5 rounded-md text-sm appearance-none"
                        style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                      >
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="bold">Bold & Direct</option>
                        <option value="empathetic">Empathetic</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1.5" style={{ fontFamily: fontFamily.mono }}>Audience</label>
                    <input
                      value={audience}
                      onChange={e => setAudience(e.target.value)}
                      placeholder="e.g., CFOs at mid-market SaaS"
                      data-testid="marketing-audience-input"
                      className="w-full px-3 py-2.5 rounded-md text-sm"
                      style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#64748B] block mb-1.5" style={{ fontFamily: fontFamily.mono }}>Additional Context</label>
                  <textarea
                    value={context}
                    onChange={e => setContext(e.target.value)}
                    placeholder="Any specific messaging, USPs, or constraints..."
                    rows={3}
                    data-testid="marketing-context-input"
                    className="w-full px-3 py-2.5 rounded-md text-sm resize-none"
                    style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || !selectedType || !topic.trim()}
                data-testid="marketing-generate-btn"
                className="w-full mt-4"
                style={{ background: '#E85D00', color: 'white' }}
              >
                {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Content</>}
              </Button>
            </Panel>
          </div>

          {/* Right: Output */}
          <div>
            <Panel className="min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Generated Content</h3>
                {result?.content && (
                  <button onClick={handleCopy} data-testid="marketing-copy-btn"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors"
                    style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text-2)' }}>
                    {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              {!result && !generating && (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <Sparkles className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                    <p className="text-sm text-[#64748B]">Select a content type and generate to see results.</p>
                  </div>
                </div>
              )}

              {generating && (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-[#E85D00] mx-auto mb-3 animate-spin" />
                    <p className="text-sm text-[#8FA0B8]">Generating content from your business intelligence...</p>
                  </div>
                </div>
              )}

              {result?.content && renderContent(result.content)}
            </Panel>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MarketingAutomationPage;
