import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Loader2, Target, TrendingUp, Save } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
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
            <p className="overline text-[#0f2f24]/60 mb-2">Market Intelligence</p>
            <h1 className="text-3xl md:text-4xl font-serif text-[#0f2f24]">Market Analysis</h1>
            <p className="text-[#0f2f24]/60 mt-2">
              Understand your market, competitors, and growth opportunities
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <Card className="card-clean h-fit">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[#0f2f24]">Analysis Title</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., E-commerce Market Analysis 2024"
                      className="bg-white"
                      data-testid="market-title-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#0f2f24]">Business & Market Context</Label>
                    <Textarea
                      value={formData.business_context}
                      onChange={(e) => setFormData({ ...formData, business_context: e.target.value })}
                      placeholder="Describe your business, industry, target market, main competitors, and what specific market insights you need..."
                      className="min-h-[250px] bg-white"
                      data-testid="market-context-input"
                    />
                    <p className="text-xs text-[#0f2f24]/60">
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
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                <div className="mt-6 p-4 bg-[#f5f5f0] rounded-sm">
                  <h4 className="font-medium text-[#0f2f24] mb-2 text-sm">Tips for Better Analysis</h4>
                  <ul className="text-xs text-[#0f2f24]/70 space-y-1">
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
                <Card className="card-clean">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-[#0f2f24] mx-auto mb-4" />
                    <p className="text-[#0f2f24] font-medium">Analyzing market data...</p>
                    <p className="text-sm text-[#0f2f24]/60 mt-1">This may take a moment</p>
                  </CardContent>
                </Card>
              )}

              {result && (
                <div className="space-y-6 animate-fade-in">
                  <Card className="card-clean">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="badge badge-forest text-xs">Market Analysis</span>
                          <h3 className="text-xl font-serif text-[#0f2f24] mt-2">{result.title}</h3>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={saveAsDocument}
                          className="border-[#0f2f24] text-[#0f2f24]"
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
                    <Card className="card-clean bg-[#0f2f24] text-white">
                      <CardContent className="p-6">
                        <h4 className="text-lg font-serif text-[#ccff00] mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          Strategic Opportunities
                        </h4>
                        <ul className="space-y-3">
                          {result.recommendations.slice(0, 5).map((rec, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <span className="w-6 h-6 bg-[#ccff00] text-[#0f2f24] rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
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
                <Card className="card-clean">
                  <CardContent className="p-8 text-center">
                    <Target className="w-12 h-12 text-[#0f2f24]/20 mx-auto mb-4" />
                    <p className="text-[#0f2f24]/60">
                      Describe your market and business to get comprehensive analysis
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MarketAnalysis;
