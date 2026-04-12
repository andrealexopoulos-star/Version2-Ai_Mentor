import { CognitiveMesh } from '../components/LoadingSystems';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent } from '../components/ui/card';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Loader2, FileText, CheckSquare, Target, Save, Copy, Check, Upload } from 'lucide-react';
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/msword', // doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'application/vnd.google-apps.document', // Google Docs
      'text/plain'
    ];

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'SOP Reference');
      formData.append('description', 'Document for SOP generation');

      const response = await apiClient.post('/data-center/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadedFile(response.data);
      setSopForm({ ...sopForm, document_id: response.data.id });
      toast.success(`${file.name} uploaded successfully!`);
    } catch (error) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const generateSOP = async (e) => {
    e.preventDefault();
    if (!sopForm.topic) {
      toast.error('Please enter a topic');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.post(`/generate/sop`, {
        ...sopForm,
        uploaded_file_id: uploadedFile?.id
      });
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
            <p className="overline text-[#9FB0C3] mb-2">Documentation</p>
            <h1 className="text-3xl md:text-4xl font-serif text-[#EDF1F7]">SOP Generator</h1>
            <p className="text-[#9FB0C3] mt-2">
              Create professional SOPs, checklists, and action plans instantly
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Forms */}
            <Card className="rounded-lg h-fit">
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full bg-[#0F1720] p-1">
                    <TabsTrigger value="sop" className="flex-1 data-[state=active]:bg-[#0E1628]" data-testid="tab-sop">
                      <FileText className="w-4 h-4 mr-2" /> SOP
                    </TabsTrigger>
                    <TabsTrigger value="checklist" className="flex-1 data-[state=active]:bg-[#0E1628]" data-testid="tab-checklist">
                      <CheckSquare className="w-4 h-4 mr-2" /> Checklist
                    </TabsTrigger>
                    <TabsTrigger value="action" className="flex-1 data-[state=active]:bg-[#0E1628]" data-testid="tab-action">
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
                          className="bg-[#0E1628]"
                          data-testid="sop-topic-input"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Upload Reference Document (Optional)</Label>
                        <div className="border-2 border-dashed rounded-lg p-4" style={{ borderColor: 'var(--border-medium)' }}>
                          <input
                            type="file"
                            onChange={handleFileUpload}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                            className="hidden"
                            id="sop-file-upload"
                            disabled={uploading}
                          />
                          <label 
                            htmlFor="sop-file-upload"
                            className="cursor-pointer flex flex-col items-center gap-2"
                          >
                            {uploadedFile ? (
                              <>
                                <Check className="w-8 h-8" style={{ color: 'var(--accent-success)' }} />
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {uploadedFile.filename}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  Click to change file
                                </p>
                              </>
                            ) : (
                              <>
                                {uploading ? (
                                  <CognitiveMesh compact />
                                ) : (
                                  <FileText className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                                )}
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {uploading ? 'Uploading...' : 'Upload document'}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  PDF, Word, Excel, Google Docs
                                </p>
                              </>
                            )}
                          </label>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Upload existing documents or templates to improve generation quality.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Business Context (Optional)</Label>
                        <Textarea
                          value={sopForm.business_context}
                          onChange={(e) => setSopForm({ ...sopForm, business_context: e.target.value })}
                          placeholder="Describe your business and any specific requirements..."
                          className="min-h-[120px] bg-[#0E1628]"
                          data-testid="sop-context-input"
                        />
                      </div>
                      <Button type="submit" className="w-full btn-lime rounded-sm py-6" disabled={loading} data-testid="generate-sop-btn">
                        {loading ? null : <FileText className="w-4 h-4 mr-2" />}
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
                          className="bg-[#0E1628]"
                          data-testid="checklist-topic-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Context (Optional)</Label>
                        <Textarea
                          value={checklistForm.context}
                          onChange={(e) => setChecklistForm({ ...checklistForm, context: e.target.value })}
                          placeholder="Any specific items or areas to cover..."
                          className="min-h-[120px] bg-[#0E1628]"
                          data-testid="checklist-context-input"
                        />
                      </div>
                      <Button type="submit" className="w-full btn-lime rounded-sm py-6" disabled={loading} data-testid="generate-checklist-btn">
                        {loading ? null : <CheckSquare className="w-4 h-4 mr-2" />}
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
                          className="bg-[#0E1628]"
                          data-testid="action-goal-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Timeline</Label>
                        <Input
                          value={actionPlanForm.timeline}
                          onChange={(e) => setActionPlanForm({ ...actionPlanForm, timeline: e.target.value })}
                          placeholder="e.g., 3 months"
                          className="bg-[#0E1628]"
                          data-testid="action-timeline-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Available Resources (Optional)</Label>
                        <Textarea
                          value={actionPlanForm.resources}
                          onChange={(e) => setActionPlanForm({ ...actionPlanForm, resources: e.target.value })}
                          placeholder="Team size, budget, tools available..."
                          className="min-h-[80px] bg-[#0E1628]"
                          data-testid="action-resources-input"
                        />
                      </div>
                      <Button type="submit" className="w-full btn-lime rounded-sm py-6" disabled={loading} data-testid="generate-action-btn">
                        {loading ? null : <Target className="w-4 h-4 mr-2" />}
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
                <Card className="rounded-lg">
                  <CardContent className="p-8 text-center">
                    <CognitiveMesh compact />
                    <p className="text-[#EDF1F7] font-medium">Generating your document...</p>
                  </CardContent>
                </Card>
              )}

              {result && (
                <Card className="rounded-lg animate-fade-in">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="badge badge-lime text-xs">{result.type}</span>
                        <h3 className="text-xl font-serif text-[#EDF1F7] mt-2">{result.title}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={copyToClipboard} data-testid="copy-result-btn">
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={saveDocument} className="border-[rgba(140,170,210,0.15)]" data-testid="save-result-btn">
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
                <Card className="rounded-lg">
                  <CardContent className="p-8 text-center">
                    <FileText className="w-12 h-12 text-[#EDF1F7]/20 mx-auto mb-4" />
                    <p className="text-[#9FB0C3]">
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
