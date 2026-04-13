import { CognitiveMesh } from '../components/LoadingSystems';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Loader2, Target, TrendingUp, Save, ArrowUpRight } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';



const MarketAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    analysis_type: 'market_analysis',
    business_context: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.business_context) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await apiClient.post(`/analyses`, {
        ...formData,
        business_context: `Market Analysis Request:\n${formData.business_context}\n\nPlease analyze: market trends, competitive landscape, target audience, positioning opportunities, and growth potential.`
      });
      setResult(response.data);
      toast.success('Market analysis complete!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const saveAsDocument = async () => {
    if (!result) return;
    try {
      await apiClient.post(`/documents`, {
        title: result.title,
        document_type: 'Market Analysis',
        content: result.ai_analysis,
        tags: ['market', 'competitive-analysis']
      });
      toast.success('Saved to documents!');
    } catch (error) {
      toast.error('Failed to save document');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="market-analysis-page">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Market Analysis</h1>
            <p className="text-[#8FA0B8] mt-2">
              Understand your market, competitors, and growth opportunities
            </p>
          </div>

          {/* KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
            {[
              { label: 'Market Size', value: result?.market_size ? `$${(result.market_size / 1e9).toFixed(1)}B` : '\u2014' },
              { label: 'Market Share', value: result?.market_share ? `${result.market_share}%` : '\u2014' },
              { label: 'Growth Rate', value: result?.growth_rate ? `${result.growth_rate}%` : '\u2014' },
              { label: 'Competitors', value: result?.competitor_count || '\u2014' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontFamily: fontFamily.mono, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-muted, #708499)', marginBottom: 12 }}>{kpi.label}</div>
                <div style={{ fontFamily: fontFamily.display, fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1, color: 'var(--ink-display, #EDF1F7)', letterSpacing: '-0.02em' }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <Card className="rounded-lg h-fit">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[#EDF1F7]">Analysis Title</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., E-commerce Market Analysis 2024"
                      className="bg-[#0E1628]"
                      data-testid="market-title-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#EDF1F7]">Business & Market Context</Label>
                    <Textarea
                      value={formData.business_context}
                      onChange={(e) => setFormData({ ...formData, business_context: e.target.value })}
                      placeholder="Describe your business, industry, target market, main competitors, and what specific market insights you need..."
                      className="min-h-[250px] bg-[#0E1628]"
                      data-testid="market-context-input"
                    />
                    <p className="text-xs text-[#8FA0B8]">
                      Include: your industry, products/services, geographic focus, known competitors, and specific questions.
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full btn-lime rounded-sm py-6"
                    disabled={loading}
                    data-testid="run-market-analysis-btn"
                  >
                    {loading ? (
                      <>
                        
                        Analyzing Market...
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4 mr-2" />
                        Run Market Analysis
                      </>
                    )}
                  </Button>
                </form>

                {/* Quick Tips */}
                <div className="mt-6 p-4 bg-[#0F1720] rounded-sm">
                  <h4 className="font-medium text-[#EDF1F7] mb-2 text-sm">Tips for Better Analysis</h4>
                  <ul className="text-xs text-[#8FA0B8] space-y-1">
                    <li>• Be specific about your target market segment</li>
                    <li>• Name your main competitors if known</li>
                    <li>• Include your current market position</li>
                    <li>• Mention any recent market trends you&apos;ve observed</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-6">
              {loading && (
                <Card className="rounded-lg">
                  <CardContent className="p-8 text-center">
                    <CognitiveMesh compact />
                    <p className="text-[#EDF1F7] font-medium">Analyzing market data...</p>
                    <p className="text-sm text-[#8FA0B8] mt-1">This may take a moment</p>
                  </CardContent>
                </Card>
              )}

              {result && (
                <div className="space-y-6 animate-fade-in">
                  <Card className="rounded-lg">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="badge badge-forest text-xs">Market Analysis</span>
                          <h3 className="text-xl mt-2" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)' }}>{result.title}</h3>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={saveAsDocument}
                          className="border-[rgba(140,170,210,0.12)] text-[#EDF1F7]"
                          data-testid="save-market-analysis-btn"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </div>
                      <div className="markdown-content prose prose-sm max-w-none">
                        <ReactMarkdown>{result.ai_analysis}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>

                  {result.recommendations?.length > 0 && (
                    <Card className="rounded-lg bg-[#0E1628] text-white">
                      <CardContent className="p-6">
                        <h4 className="text-lg font-serif text-[#ccff00] mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          Strategic Opportunities
                        </h4>
                        <ul className="space-y-3">
                          {result.recommendations.slice(0, 5).map((rec, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <span className="w-6 h-6 bg-[#ccff00] text-[#EDF1F7] rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                                {i + 1}
                              </span>
                              <span className="text-white/90">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {!loading && !result && (
                <Card className="rounded-lg">
                  <CardContent className="p-8 text-center">
                    <Target className="w-12 h-12 text-[#EDF1F7]/20 mx-auto mb-4" />
                    <p className="text-[#8FA0B8]">
                      Describe your market and business to get comprehensive analysis
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Competitor Map */}
          <div style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, color: 'var(--ink-display, #EDF1F7)', marginBottom: 20 }}>Competitive Landscape</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {result?.competitors?.length > 0 ? result.competitors.map(comp => (
                <div key={comp.name} style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #1a2a44, #2a3a5c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)' }}>
                    {comp.name.charAt(0)}
                  </div>
                  <div style={{ fontFamily: fontFamily.body, fontSize: 14, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)', textAlign: 'center' }}>{comp.name}</div>
                  <div style={{ fontFamily: fontFamily.mono, fontSize: 20, fontWeight: 700, color: 'var(--ink-display, #EDF1F7)' }}>{comp.share}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    padding: '3px 10px', borderRadius: 999,
                    background: comp.threat === 'high' ? 'rgba(232,93,0,0.15)' : comp.threat === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                    color: comp.threat === 'high' ? '#E85D00' : comp.threat === 'medium' ? '#F59E0B' : '#22C55E',
                  }}>
                    {comp.threat} threat
                  </span>
                </div>
              )) : (
                <div style={{ gridColumn: '1 / -1', background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                  <Target style={{ width: 32, height: 32, color: 'rgba(237,241,247,0.15)', margin: '0 auto 12px' }} />
                  <p style={{ fontFamily: fontFamily.body, fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.6 }}>
                    Run a market analysis to discover competitor intelligence. Competitor insights will populate here automatically.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Opportunity Cards */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, color: 'var(--ink-display, #EDF1F7)', marginBottom: 20 }}>Market Opportunities</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {result?.opportunities?.length > 0 ? result.opportunities.map(opp => (
                <div key={opp.title} style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{
                    alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    padding: '3px 10px', borderRadius: 999,
                    background: opp.impact === 'High' ? 'rgba(232,93,0,0.15)' : opp.impact === 'Medium' ? 'rgba(59,130,246,0.15)' : 'rgba(140,170,210,0.1)',
                    color: opp.impact === 'High' ? '#E85D00' : opp.impact === 'Medium' ? '#3B82F6' : 'var(--ink-muted, #708499)',
                  }}>
                    {opp.impact} Impact
                  </span>
                  <div style={{ fontFamily: fontFamily.body, fontSize: 14, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)' }}>{opp.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.5, flex: 1 }}>{opp.desc}</div>
                  <button style={{
                    marginTop: 4, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 600, color: '#ccff00', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                    Explore <ArrowUpRight size={14} />
                  </button>
                </div>
              )) : (
                <div style={{ gridColumn: '1 / -1', background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                  <TrendingUp style={{ width: 32, height: 32, color: 'rgba(237,241,247,0.15)', margin: '0 auto 12px' }} />
                  <p style={{ fontFamily: fontFamily.body, fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.6 }}>
                    Market opportunities will appear after analysis.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default MarketAnalysis;
