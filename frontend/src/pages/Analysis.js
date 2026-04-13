import { CognitiveMesh } from '../components/LoadingSystems';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Loader2, BarChart3, ArrowRight, Save, FileText } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';



const analysisTypes = [
  { value: 'business_analysis', label: 'Business Model Analysis', desc: 'Analyze strengths, weaknesses, opportunities' },
  { value: 'operations', label: 'Operations Review', desc: 'Workflow and process optimization' },
  { value: 'growth', label: 'Growth Strategy', desc: 'Scaling and expansion opportunities' },
  { value: 'marketing', label: 'Marketing Analysis', desc: 'Marketing channels and strategies' },
  { value: 'financial', label: 'Financial Health', desc: 'Revenue, costs, and profitability' },
  { value: 'customer', label: 'Customer Experience', desc: 'Customer journey optimization' },
];

const Analysis = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    analysis_type: '',
    business_context: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.analysis_type || !formData.business_context) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await apiClient.post(`/analyses`, formData);
      setResult(response.data);
      toast.success('Analysis complete!');
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
        title: formData.title || 'Business Analysis',
        document_type: 'Analysis',
        content: result.analysis,
        tags: [formData.analysis_type]
      });
      toast.success('Saved to documents!');
    } catch (error) {
      toast.error('Failed to save document');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="analysis-page">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-medium mb-2" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.05 }}>Analysis Suite</h1>
            <p className="text-sm" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
              Get AI-powered insights and recommendations for your business
            </p>
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
                      placeholder="e.g., Q4 Growth Strategy Review"
                      className="bg-[#0E1628]"
                      data-testid="analysis-title-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#EDF1F7]">Analysis Type</Label>
                    <Select 
                      value={formData.analysis_type}
                      onValueChange={(value) => setFormData({ ...formData, analysis_type: value })}
                    >
                      <SelectTrigger className="bg-[#0E1628]" data-testid="analysis-type-select">
                        <SelectValue placeholder="Select analysis type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0E1628]">
                        {analysisTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <p className="font-medium">{type.label}</p>
                              <p className="text-xs text-[#8FA0B8]">{type.desc}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#EDF1F7]">Business Context</Label>
                    <Textarea
                      value={formData.business_context}
                      onChange={(e) => setFormData({ ...formData, business_context: e.target.value })}
                      placeholder="Describe your business, current situation, challenges, and what you'd like to analyze..."
                      className="min-h-[200px] bg-[#0E1628]"
                      data-testid="analysis-context-input"
                    />
                    <p className="text-xs text-[#8FA0B8]">
                      Include details like industry, size, current revenue, main challenges, and goals.
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full btn-lime rounded-sm py-6"
                    disabled={loading}
                    data-testid="run-analysis-btn"
                  >
                    {loading ? (
                      <>
                        
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Run Analysis
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-6">
              {loading && (
                <Card className="rounded-lg">
                  <CardContent className="p-8 text-center">
                    <CognitiveMesh compact />
                    <p className="text-[#EDF1F7] font-medium">Analyzing your business...</p>
                    <p className="text-sm text-[#8FA0B8] mt-1">This may take a moment</p>
                  </CardContent>
                </Card>
              )}

              {result && (
                <div className="space-y-6 animate-fade-in">
                  {/* Full Analysis Text */}
                  <Card className="rounded-lg">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-serif" style={{ color: 'var(--text-primary)' }}>{formData.title}</h3>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{formData.analysis_type}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={saveAsDocument}
                          className="btn-secondary"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </div>
                      <div className="markdown-content prose prose-sm max-w-none" style={{ color: 'var(--text-secondary)' }}>
                        <ReactMarkdown>{result.analysis}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Structured Insights with Why? */}
                  {result.insights?.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Key Insights</h3>
                      {result.insights.map((insight, idx) => (
                        <Card key={idx} className="card">
                          <CardContent className="p-5">
                            <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                              {insight.title}
                            </h4>
                            {insight.reason && (
                              <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                                {insight.reason}
                              </p>
                            )}
                            
                            {insight.actions?.length > 0 && (
                              <ul className="space-y-2 mb-3">
                                {insight.actions.map((action, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
                                    <span>{action}</span>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {(insight.why || insight.citations?.length > 0) && (
                              <Accordion type="single" collapsible>
                                <AccordionItem value={`why-${idx}`}>
                                  <AccordionTrigger className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    Why?
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    {insight.why && (
                                      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                                        {insight.why}
                                      </p>
                                    )}
                                    
                                    {insight.confidence && (
                                      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                                        Confidence: <span className="font-medium">{insight.confidence}</span>
                                      </p>
                                    )}
                                    
                                    {insight.citations?.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Sources:</p>
                                        <ul className="space-y-2">
                                          {insight.citations.map((citation, i) => (
                                            <li key={i} className="text-sm">
                                              <span className="text-xs mr-2" style={{ color: 'var(--text-muted)' }}>
                                                [{citation.source_type}]
                                              </span>
                                              {citation.url ? (
                                                <a href={citation.url} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>
                                                  {citation.title || citation.url}
                                                </a>
                                              ) : (
                                                <span style={{ color: 'var(--text-secondary)' }}>{citation.title}</span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!loading && !result && (
                <Card className="rounded-lg">
                  <CardContent className="p-8 text-center">
                    <BarChart3 className="w-12 h-12 text-[#EDF1F7]/20 mx-auto mb-4" />
                    <p className="text-[#8FA0B8]">
                      Fill in the form and run analysis to get AI-powered insights
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

export default Analysis;
