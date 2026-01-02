import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Loader2, Stethoscope, AlertTriangle, Save, ArrowRight } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';



const problemAreas = [
  { id: 'revenue', label: 'Revenue & Sales' },
  { id: 'operations', label: 'Operations & Efficiency' },
  { id: 'marketing', label: 'Marketing & Customer Acquisition' },
  { id: 'team', label: 'Team & HR' },
  { id: 'finance', label: 'Cash Flow & Finance' },
  { id: 'customer', label: 'Customer Retention' },
  { id: 'product', label: 'Product/Service Quality' },
  { id: 'technology', label: 'Technology & Systems' },
  { id: 'competition', label: 'Competition & Market' },
  { id: 'leadership', label: 'Leadership & Strategy' },
];

const Diagnosis = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [formData, setFormData] = useState({
    symptoms: '',
    areas: [],
    urgency: 'medium'
  });

  const toggleArea = (areaId) => {
    setFormData(prev => ({
      ...prev,
      areas: prev.areas.includes(areaId)
        ? prev.areas.filter(a => a !== areaId)
        : [...prev.areas, areaId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.symptoms.trim()) {
      toast.error('Please describe your business issues');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await apiClient.post(`/diagnose`, formData);
      setResult(response.data);
      toast.success('Diagnosis complete!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Diagnosis failed');
    } finally {
      setLoading(false);
    }
  };

  const saveAsDocument = async () => {
    if (!result) return;
    try {
      await axios.post(`${API}/documents`, {
        title: `Business Diagnosis - ${new Date().toLocaleDateString()}`,
        document_type: 'Diagnosis',
        content: result.diagnosis,
        tags: ['diagnosis', ...result.areas]
      });
      toast.success('Saved to documents!');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="diagnosis-page">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <p className="overline text-[#0f2f24]/60 mb-2">Business Health</p>
            <h1 className="text-3xl md:text-4xl font-serif text-[#0f2f24]">Business Diagnosis</h1>
            <p className="text-[#0f2f24]/60 mt-2">
              Identify root causes and get actionable solutions for your business challenges
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <Card className="card-clean h-fit">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Urgency Level */}
                  <div className="space-y-2">
                    <Label className="text-[#0f2f24] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Urgency Level
                    </Label>
                    <Select 
                      value={formData.urgency}
                      onValueChange={(value) => setFormData({ ...formData, urgency: value })}
                    >
                      <SelectTrigger className="bg-white" data-testid="urgency-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="low">🟢 Low - Planning ahead</SelectItem>
                        <SelectItem value="medium">🟡 Medium - Affecting performance</SelectItem>
                        <SelectItem value="high">🔴 High - Critical issue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Problem Areas */}
                  <div className="space-y-3">
                    <Label className="text-[#0f2f24]">Affected Areas (select all that apply)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {problemAreas.map((area) => (
                        <label
                          key={area.id}
                          className={`flex items-center gap-2 p-3 rounded-sm border cursor-pointer transition-colors ${
                            formData.areas.includes(area.id)
                              ? 'bg-[#ccff00]/20 border-[#0f2f24]'
                              : 'bg-white border-[#e5e5e5] hover:border-[#0f2f24]/50'
                          }`}
                        >
                          <Checkbox
                            checked={formData.areas.includes(area.id)}
                            onCheckedChange={() => toggleArea(area.id)}
                            data-testid={`area-${area.id}`}
                          />
                          <span className="text-sm text-[#0f2f24]">{area.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Symptoms Description */}
                  <div className="space-y-2">
                    <Label className="text-[#0f2f24]">Describe Your Business Issues</Label>
                    <Textarea
                      value={formData.symptoms}
                      onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                      placeholder="Be as detailed as possible. What symptoms are you seeing? When did they start? What have you tried? What's the impact on your business?

Example: Our sales have dropped 30% over the last 3 months. We've tried running more ads but customer acquisition cost keeps increasing. Our existing customers seem happy but we're not getting referrals like we used to..."
                      className="min-h-[200px] bg-white"
                      data-testid="symptoms-input"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full btn-lime rounded-sm py-6"
                    disabled={loading}
                    data-testid="run-diagnosis-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Stethoscope className="w-4 h-4 mr-2" />
                        Run Diagnosis
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
                    <p className="text-sm text-[#0f2f24]/60 mt-1">Running comprehensive diagnosis</p>
                  </CardContent>
                </Card>
              )}

              {result && (
                <div className="space-y-6 animate-fade-in">
                  {/* Urgency Banner */}
                  {result.urgency === 'high' && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-sm flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">High Priority Issue</p>
                        <p className="text-sm text-red-700">Review the Emergency Actions section immediately</p>
                      </div>
                    </div>
                  )}

                  <Card className="card-clean">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="badge badge-forest text-xs">Diagnosis Report</span>
                          <h3 className="text-xl font-serif text-[#0f2f24] mt-2">Analysis Results</h3>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={saveAsDocument}
                          className="border-[#0f2f24] text-[#0f2f24]"
                          data-testid="save-diagnosis-btn"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </div>
                      <div className="markdown-content prose prose-sm max-w-none">
                        <ReactMarkdown>{result.diagnosis}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card className="card-clean bg-[#0f2f24] text-white">
                    <CardContent className="p-6">
                      <h4 className="text-lg font-serif text-[#ccff00] mb-4">Next Steps</h4>
                      <div className="space-y-3">
                        <button 
                          onClick={() => window.location.href = '/sop-generator'}
                          className="w-full flex items-center justify-between p-3 bg-white/10 rounded-sm hover:bg-white/20 transition-colors"
                        >
                          <span>Create SOPs for identified issues</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => window.location.href = '/advisor'}
                          className="w-full flex items-center justify-between p-3 bg-white/10 rounded-sm hover:bg-white/20 transition-colors"
                        >
                          <span>Discuss solutions with AI Advisor</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {!loading && !result && (
                <Card className="card-clean">
                  <CardContent className="p-8 text-center">
                    <Stethoscope className="w-12 h-12 text-[#0f2f24]/20 mx-auto mb-4" />
                    <p className="text-[#0f2f24]/60">
                      Describe your business challenges to get a comprehensive diagnosis with root cause analysis and solutions
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

export default Diagnosis;
