import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Loader2, BarChart3, ArrowRight, Save, FileText } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
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
        title: result.title,
        document_type: 'Analysis',
        content: result.ai_analysis,
        tags: [result.analysis_type]
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
            <p className="overline text-[#0f2f24]/60 mb-2">Business Intelligence</p>
            <h1 className="text-3xl md:text-4xl font-serif text-[#0f2f24]">Business Analysis</h1>
            <p className="text-[#0f2f24]/60 mt-2">
              Get AI-powered insights and recommendations for your business
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
                      placeholder="e.g., Q4 Growth Strategy Review"
                      className="bg-white"
                      data-testid="analysis-title-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#0f2f24]">Analysis Type</Label>
                    <Select 
                      value={formData.analysis_type}
                      onValueChange={(value) => setFormData({ ...formData, analysis_type: value })}
                    >
                      <SelectTrigger className="bg-white" data-testid="analysis-type-select">
                        <SelectValue placeholder="Select analysis type" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {analysisTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <p className="font-medium">{type.label}</p>
                              <p className="text-xs text-[#0f2f24]/60">{type.desc}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#0f2f24]">Business Context</Label>
                    <Textarea
                      value={formData.business_context}
                      onChange={(e) => setFormData({ ...formData, business_context: e.target.value })}
                      placeholder="Describe your business, current situation, challenges, and what you'd like to analyze..."
                      className="min-h-[200px] bg-white"
                      data-testid="analysis-context-input"
                    />
                    <p className="text-xs text-[#0f2f24]/60">
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
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                <Card className="card-clean">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-[#0f2f24] mx-auto mb-4" />
                    <p className="text-[#0f2f24] font-medium">Analyzing your business...</p>
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
                          <h3 className="text-xl font-serif text-[#0f2f24]">{result.title}</h3>
                          <p className="text-sm text-[#0f2f24]/60">{result.analysis_type}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={saveAsDocument}
                          className="border-[#0f2f24] text-[#0f2f24]"
                          data-testid="save-analysis-btn"
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
                        <h4 className="text-lg font-serif text-[#ccff00] mb-4">Key Recommendations</h4>
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

                  {result.action_items?.length > 0 && (
                    <Card className="card-clean">
                      <CardContent className="p-6">
                        <h4 className="text-lg font-serif text-[#0f2f24] mb-4">Action Items</h4>
                        <ul className="space-y-2">
                          {result.action_items.slice(0, 5).map((item, i) => (
                            <li key={i} className="flex items-start gap-3 p-3 bg-[#f5f5f0] rounded-sm">
                              <ArrowRight className="w-4 h-4 text-[#0f2f24]/60 mt-1 flex-shrink-0" />
                              <span className="text-[#0f2f24]">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  <Button 
                    onClick={() => navigate('/documents')}
                    variant="outline"
                    className="w-full border-[#0f2f24] text-[#0f2f24]"
                    data-testid="view-documents-btn"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View All Documents
                  </Button>
                </div>
              )}

              {!loading && !result && (
                <Card className="card-clean">
                  <CardContent className="p-8 text-center">
                    <BarChart3 className="w-12 h-12 text-[#0f2f24]/20 mx-auto mb-4" />
                    <p className="text-[#0f2f24]/60">
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
