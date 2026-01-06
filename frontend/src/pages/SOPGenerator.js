import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent } from '../components/ui/card';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Loader2, FileText, CheckSquare, Target, Save, Copy, Check } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';



const SOPGenerator = () => {
  const [activeTab, setActiveTab] = useState('sop');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  
  const [sopForm, setSopForm] = useState({ topic: '', business_context: '', document_id: null });
  const [checklistForm, setChecklistForm] = useState({ topic: '', context: '' });
  const [actionPlanForm, setActionPlanForm] = useState({ goal: '', timeline: '3 months', resources: '' });

  const generateSOP = async (e) => {
    e.preventDefault();
    if (!sopForm.topic) {
      toast.error('Please enter a topic');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.post(`/generate/sop`, sopForm);
      setResult({ type: 'SOP', content: response.data.sop_content, title: sopForm.topic });
      toast.success('SOP generated!');
    } catch (error) {
      toast.error('Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const generateChecklist = async (e) => {
    e.preventDefault();
    if (!checklistForm.topic) {
      toast.error('Please enter a topic');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.post(`/generate/checklist`, checklistForm);
      setResult({ type: 'Checklist', content: response.data.checklist_content, title: checklistForm.topic });
      toast.success('Checklist generated!');
    } catch (error) {
      toast.error('Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const generateActionPlan = async (e) => {
    e.preventDefault();
    if (!actionPlanForm.goal) {
      toast.error('Please enter a goal');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.post(`/generate/action-plan`, actionPlanForm);
      setResult({ type: 'Action Plan', content: response.data.action_plan, title: actionPlanForm.goal });
      toast.success('Action plan generated!');
    } catch (error) {
      toast.error('Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const saveDocument = async () => {
    if (!result) return;
    try {
      await apiClient.post(`/documents`, {
        title: result.title,
        document_type: result.type,
        content: result.content,
        tags: [result.type.toLowerCase()]
      });
      toast.success('Saved to documents!');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result?.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="sop-generator-page">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <p className="overline text-[#0f2f24]/60 mb-2">Documentation</p>
            <h1 className="text-3xl md:text-4xl font-serif text-[#0f2f24]">SOP Generator</h1>
            <p className="text-[#0f2f24]/60 mt-2">
              Create professional SOPs, checklists, and action plans instantly
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Forms */}
            <Card className="card-clean h-fit">
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full bg-[#f5f5f0] p-1">
                    <TabsTrigger value="sop" className="flex-1 data-[state=active]:bg-white" data-testid="tab-sop">
                      <FileText className="w-4 h-4 mr-2" /> SOP
                    </TabsTrigger>
                    <TabsTrigger value="checklist" className="flex-1 data-[state=active]:bg-white" data-testid="tab-checklist">
                      <CheckSquare className="w-4 h-4 mr-2" /> Checklist
                    </TabsTrigger>
                    <TabsTrigger value="action" className="flex-1 data-[state=active]:bg-white" data-testid="tab-action">
                      <Target className="w-4 h-4 mr-2" /> Action Plan
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="sop" className="mt-6">
                    <form onSubmit={generateSOP} className="space-y-6">
                      <div className="space-y-2">
                        <Label>SOP Topic</Label>
                        <Input
                          value={sopForm.topic}
                          onChange={(e) => setSopForm({ ...sopForm, topic: e.target.value })}
                          placeholder="e.g., Customer Onboarding Process"
                          className="bg-white"
                          data-testid="sop-topic-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Business Context (Optional)</Label>
                        <Textarea
                          value={sopForm.business_context}
                          onChange={(e) => setSopForm({ ...sopForm, business_context: e.target.value })}
                          placeholder="Describe your business and any specific requirements..."
                          className="min-h-[120px] bg-white"
                          data-testid="sop-context-input"
                        />
                      </div>
                      <Button type="submit" className="w-full btn-lime rounded-sm py-6" disabled={loading} data-testid="generate-sop-btn">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                        Generate SOP
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="checklist" className="mt-6">
                    <form onSubmit={generateChecklist} className="space-y-6">
                      <div className="space-y-2">
                        <Label>Checklist Topic</Label>
                        <Input
                          value={checklistForm.topic}
                          onChange={(e) => setChecklistForm({ ...checklistForm, topic: e.target.value })}
                          placeholder="e.g., Product Launch Checklist"
                          className="bg-white"
                          data-testid="checklist-topic-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Context (Optional)</Label>
                        <Textarea
                          value={checklistForm.context}
                          onChange={(e) => setChecklistForm({ ...checklistForm, context: e.target.value })}
                          placeholder="Any specific items or areas to cover..."
                          className="min-h-[120px] bg-white"
                          data-testid="checklist-context-input"
                        />
                      </div>
                      <Button type="submit" className="w-full btn-lime rounded-sm py-6" disabled={loading} data-testid="generate-checklist-btn">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckSquare className="w-4 h-4 mr-2" />}
                        Generate Checklist
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="action" className="mt-6">
                    <form onSubmit={generateActionPlan} className="space-y-6">
                      <div className="space-y-2">
                        <Label>Goal</Label>
                        <Input
                          value={actionPlanForm.goal}
                          onChange={(e) => setActionPlanForm({ ...actionPlanForm, goal: e.target.value })}
                          placeholder="e.g., Launch new product line"
                          className="bg-white"
                          data-testid="action-goal-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Timeline</Label>
                        <Input
                          value={actionPlanForm.timeline}
                          onChange={(e) => setActionPlanForm({ ...actionPlanForm, timeline: e.target.value })}
                          placeholder="e.g., 3 months"
                          className="bg-white"
                          data-testid="action-timeline-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Available Resources (Optional)</Label>
                        <Textarea
                          value={actionPlanForm.resources}
                          onChange={(e) => setActionPlanForm({ ...actionPlanForm, resources: e.target.value })}
                          placeholder="Team size, budget, tools available..."
                          className="min-h-[80px] bg-white"
                          data-testid="action-resources-input"
                        />
                      </div>
                      <Button type="submit" className="w-full btn-lime rounded-sm py-6" disabled={loading} data-testid="generate-action-btn">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
                        Generate Action Plan
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-6">
              {loading && (
                <Card className="card-clean">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-[#0f2f24] mx-auto mb-4" />
                    <p className="text-[#0f2f24] font-medium">Generating your document...</p>
                  </CardContent>
                </Card>
              )}

              {result && (
                <Card className="card-clean animate-fade-in">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="badge badge-lime text-xs">{result.type}</span>
                        <h3 className="text-xl font-serif text-[#0f2f24] mt-2">{result.title}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={copyToClipboard} data-testid="copy-result-btn">
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={saveDocument} className="border-[#0f2f24]" data-testid="save-result-btn">
                          <Save className="w-4 h-4 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                    <div className="markdown-content prose prose-sm max-w-none max-h-[500px] overflow-y-auto">
                      <ReactMarkdown>{result.content}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!loading && !result && (
                <Card className="card-clean">
                  <CardContent className="p-8 text-center">
                    <FileText className="w-12 h-12 text-[#0f2f24]/20 mx-auto mb-4" />
                    <p className="text-[#0f2f24]/60">
                      Select a document type and fill in the details to generate
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

export default SOPGenerator;
