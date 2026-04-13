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
          <h1 className="font-medium mb-1" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Marketing Automation.</h1>
          <p className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>Generate marketing content grounded in your business data and intelligence.</p>
        </div>

        {/* KPI Strip — matches mockup ma-kpis */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Active Automations', value: '\u2014' },
            { label: 'Emails Sent', value: '\u2014' },
            { label: 'Open Rate', value: '\u2014' },
            { label: 'Click Rate', value: '\u2014' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: fontFamily?.mono || 'monospace', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-muted, #708499)', marginBottom: 12 }}>{kpi.label}</div>
              <div style={{ fontFamily: fontFamily?.display || 'serif', fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1, color: 'var(--ink-display, #EDF1F7)', letterSpacing: '-0.02em' }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* AI Recommendation -- empty state until email campaigns are connected */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderLeft: '3px solid #E85D00' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full" style={{ background: '#E85D00', boxShadow: '0 0 6px #E85D00' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#E85D00' }}>AI Recommendation</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted, #708499)' }}>Automation recommendations will appear once email campaigns are connected.</p>
        </div>

        {/* Campaign Cards -- empty state until campaigns exist */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)' }}>Campaigns</h2>
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)' }}>
            <Megaphone className="w-8 h-8 mx-auto mb-3" style={{ color: '#64748B' }} />
            <p className="text-sm" style={{ color: 'var(--ink-muted, #708499)' }}>No active campaigns. Create email sequences using the content generator below.</p>
          </div>
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
                      <span className="text-sm font-medium" style={{ color: selectedType === ct.id ? '#E85D00' : 'var(--ink-display, #EDF1F7)' }}>{ct.label}</span>
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
