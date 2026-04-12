import { PageLoadingState } from '../components/PageStateComponents';
import { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { fontFamily } from '../design-system/tokens';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

import { 
  Upload, FileText, Database, Building2, Trash2, Download,
  Loader2, FolderOpen, Check, AlertCircle, HardDrive,
  FileSpreadsheet, File, FileType, Save
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';

const fileCategories = [
  { value: 'financial', label: 'Financial & Accounting', icon: FileSpreadsheet },
  { value: 'crm', label: 'CRM & Customer Data', icon: FileText },
  { value: 'operations', label: 'Operations & Processes', icon: File },
  { value: 'hr', label: 'HR & Team', icon: FileType },
  { value: 'marketing', label: 'Marketing & Sales', icon: FileText },
  { value: 'legal', label: 'Legal & Compliance', icon: FileText },
  { value: 'product', label: 'Product & Services', icon: File },
  { value: 'other', label: 'Other Documents', icon: FolderOpen },
];

const industries = [
  'Retail & E-commerce', 'Professional Services', 'Food & Hospitality',
  'Healthcare', 'Technology', 'Manufacturing', 'Construction',
  'Real Estate', 'Education', 'Finance', 'Other'
];

const employeeCounts = ['1-5', '6-20', '21-50', '51-200', '200+'];
const revenueRanges = ['< $100K', '$100K - $500K', '$500K - $1M', '$1M - $5M', '$5M - $10M', '$10M+'];

const DataCenter = () => {
  const { user } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState('files');
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deleteFileId, setDeleteFileId] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    category: '',
    description: ''
  });
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [filesRes, statsRes, profileRes] = await Promise.allSettled([
        apiClient.get(`/data-center/files`),
        apiClient.get(`/data-center/stats`),
        apiClient.get(`/business-profile`)
      ]);
      if (filesRes.status === 'fulfilled') setFiles(filesRes.value.data);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
    } catch (error) {
      // Silently fail — page renders with empty/default state
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadForm(prev => ({ ...prev, file: e.dataTransfer.files[0] }));
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadForm(prev => ({ ...prev, file: e.target.files[0] }));
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.category) {
      toast.error('Please select a file and category');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('category', uploadForm.category);
    formData.append('description', uploadForm.description);

    try {
      await apiClient.post(`/data-center/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('File uploaded successfully!');
      setUploadForm({ file: null, category: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!deleteFileId) return;
    try {
      await apiClient.delete(`/data-center/files/${deleteFileId}`);
      setFiles(files.filter(f => f.id !== deleteFileId));
      toast.success('File deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete file');
    } finally {
      setDeleteFileId(null);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const response = await apiClient.put(`/business-profile`, profile);
      setProfile(response.data);
      toast.success('Business profile saved!');
      fetchData();
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getCategoryIcon = (category) => {
    const cat = fileCategories.find(c => c.value === category);
    return cat ? cat.icon : File;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl p-8">
          <PageLoadingState message="Loading data centre…" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="data-center-page">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Knowledge Base</div>
            <h1 className="font-medium mb-2" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Data <em style={{ fontStyle: 'italic', color: '#E85D00' }}>centre</em>.</h1>
            <p className="text-sm" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
              Upload your business documents to make the AI your subject matter expert
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Database className="w-8 h-8 text-[#ccff00]" />
                  <div>
                    <p className="stat-label text-xs">Total Files</p>
                    <p className="text-2xl font-serif font-semibold">{stats?.total_files || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-8 h-8 text-[#ccff00]" />
                  <div>
                    <p className="stat-label text-xs">Storage Used</p>
                    <p className="text-2xl font-serif font-semibold">{stats?.total_size_mb || 0} MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-8 h-8 text-[#ccff00]" />
                  <div>
                    <p className="stat-label text-xs">Categories</p>
                    <p className="text-2xl font-serif font-semibold">{stats?.categories?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-[#ccff00]" />
                  <div>
                    <p className="stat-label text-xs">Profile Complete</p>
                    <p className="text-2xl font-serif font-semibold">{stats?.profile_completeness || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#0F1720] p-1 mb-6">
              <TabsTrigger value="files" className="data-[state=active]:bg-[#0E1628]" data-testid="tab-files">
                <Database className="w-4 h-4 mr-2" /> Files & Documents
              </TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-[#0E1628]" data-testid="tab-profile">
                <Building2 className="w-4 h-4 mr-2" /> Business Profile
              </TabsTrigger>
              <TabsTrigger value="upload" className="data-[state=active]:bg-[#0E1628]" data-testid="tab-upload">
                <Upload className="w-4 h-4 mr-2" /> Upload
              </TabsTrigger>
            </TabsList>

            {/* FILES TAB */}
            <TabsContent value="files">
              {files.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file) => {
                    const Icon = getCategoryIcon(file.category);
                    return (
                      <Card key={file.id} className="rounded-lg hover-lift group">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 bg-[#ccff00]/20 rounded-sm flex items-center justify-center">
                              <Icon className="w-5 h-5 text-[#EDF1F7]" />
                            </div>
                            <button
                              onClick={() => setDeleteFileId(file.id)}
                              className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-sm transition-all"
                              data-testid={`delete-file-${file.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                          <h3 className="font-medium text-[#EDF1F7] truncate mb-1">{file.filename}</h3>
                          <p className="text-xs text-[#8FA0B8] mb-2">
                            {fileCategories.find(c => c.value === file.category)?.label || file.category}
                          </p>
                          {file.description && (
                            <p className="text-sm text-[#8FA0B8] line-clamp-2 mb-2">{file.description}</p>
                          )}
                          <div className="flex items-center justify-between text-xs text-[#64748B]">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>{new Date(file.created_at).toLocaleDateString()}</span>
                          </div>
                          {file.extracted_text && (
                            <div className="mt-3 pt-3 border-t border-[rgba(140,170,210,0.15)]">
                              <div className="flex items-center gap-1 text-xs text-green-600">
                                <Check className="w-3 h-3" />
                                Text extracted for AI
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="rounded-lg">
                  <CardContent className="p-12 text-center">
                    <Database className="w-16 h-16 text-[#EDF1F7]/20 mx-auto mb-4" />
                    <h3 className="text-xl font-serif text-[#EDF1F7] mb-2">No files yet</h3>
                    <p className="text-[#8FA0B8] mb-6">
                      Upload your business documents to help the AI understand your business better
                    </p>
                    <Button onClick={() => setActiveTab('upload')} className="btn-lime">
                      <Upload className="w-4 h-4 mr-2" /> Upload Files
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* BUSINESS PROFILE TAB */}
            <TabsContent value="profile">
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Business Profile
                  </CardTitle>
                  <p className="text-sm text-[#8FA0B8]">
                    Complete your profile to get more personalized AI recommendations
                  </p>
                  {stats?.profile_completeness !== undefined && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Profile Completeness</span>
                        <span>{stats.profile_completeness}%</span>
                      </div>
                      <Progress value={stats.profile_completeness} className="h-2" />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Business Name</Label>
                      <Input
                        value={profile.business_name || ''}
                        onChange={(e) => setProfile({ ...profile, business_name: e.target.value })}
                        placeholder="Your Company LLC"
                        data-testid="profile-business-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Industry</Label>
                      <Select value={profile.industry || ''} onValueChange={(v) => setProfile({ ...profile, industry: v })}>
                        <SelectTrigger data-testid="profile-industry">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0E1628]">
                          {industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Business Type</Label>
                      <Select value={profile.business_type || ''} onValueChange={(v) => setProfile({ ...profile, business_type: v })}>
                        <SelectTrigger data-testid="profile-business-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0E1628]">
                          <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                          <SelectItem value="LLC">LLC</SelectItem>
                          <SelectItem value="Corporation">Corporation</SelectItem>
                          <SelectItem value="Partnership">Partnership</SelectItem>
                          <SelectItem value="Non-profit">Non-profit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Year Founded</Label>
                      <Input
                        type="number"
                        value={profile.year_founded || ''}
                        onChange={(e) => setProfile({ ...profile, year_founded: parseInt(e.target.value) || null })}
                        placeholder="2020"
                        data-testid="profile-year-founded"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Employee Count</Label>
                      <Select value={profile.employee_count || ''} onValueChange={(v) => setProfile({ ...profile, employee_count: v })}>
                        <SelectTrigger data-testid="profile-employees">
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0E1628]">
                          {employeeCounts.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Annual Revenue</Label>
                      <Select value={profile.annual_revenue || ''} onValueChange={(v) => setProfile({ ...profile, annual_revenue: v })}>
                        <SelectTrigger data-testid="profile-revenue">
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0E1628]">
                          {revenueRanges.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Target Market</Label>
                    <Textarea
                      value={profile.target_market || ''}
                      onChange={(e) => setProfile({ ...profile, target_market: e.target.value })}
                      placeholder="Describe your ideal customers (demographics, location, needs)..."
                      className="min-h-[80px]"
                      data-testid="profile-target-market"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Main Products/Services</Label>
                    <Textarea
                      value={profile.main_products_services || ''}
                      onChange={(e) => setProfile({ ...profile, main_products_services: e.target.value })}
                      placeholder="List your main products or services..."
                      className="min-h-[80px]"
                      data-testid="profile-products"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Competitive Advantages</Label>
                    <Textarea
                      value={profile.competitive_advantages || ''}
                      onChange={(e) => setProfile({ ...profile, competitive_advantages: e.target.value })}
                      placeholder="What makes your business unique? What do you do better than competitors?"
                      className="min-h-[80px]"
                      data-testid="profile-advantages"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Main Challenges</Label>
                    <Textarea
                      value={profile.main_challenges || ''}
                      onChange={(e) => setProfile({ ...profile, main_challenges: e.target.value })}
                      placeholder="What are your biggest business challenges right now?"
                      className="min-h-[80px]"
                      data-testid="profile-challenges"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Business Goals</Label>
                    <Textarea
                      value={profile.business_goals || ''}
                      onChange={(e) => setProfile({ ...profile, business_goals: e.target.value })}
                      placeholder="What are your goals for the next 1-3 years?"
                      className="min-h-[80px]"
                      data-testid="profile-goals"
                    />
                  </div>

                  <Button onClick={handleSaveProfile} className="btn-lime" disabled={savingProfile} data-testid="save-profile-btn">
                    {savingProfile ? null : <Save className="w-4 h-4 mr-2" />}
                    Save Profile
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* UPLOAD TAB */}
            <TabsContent value="upload">
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="font-serif">Upload Documents</CardTitle>
                  <p className="text-sm text-[#8FA0B8]">
                    Supported formats: PDF, Word, Excel, CSV, TXT, JSON (Max 10MB)
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Drop Zone */}
                  <div
                    className={`border-2 border-dashed rounded-sm p-8 text-center transition-colors ${
                      dragActive ? 'border-[#ccff00] bg-[#ccff00]/10' : 'border-[rgba(140,170,210,0.15)] hover:border-[rgba(140,170,210,0.15)]'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Upload className="w-12 h-12 text-[#EDF1F7]/30 mx-auto mb-4" />
                    {uploadForm.file ? (
                      <div className="flex items-center justify-center gap-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <span className="font-medium">{uploadForm.file.name}</span>
                        <button 
                          onClick={() => setUploadForm({ ...uploadForm, file: null })}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[#8FA0B8] mb-2">Drag and drop your file here, or</p>
                        <label className="btn-lime px-6 py-2 rounded-sm cursor-pointer inline-block">
                          Browse Files
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json"
                            onChange={handleFileChange}
                            data-testid="file-input"
                          />
                        </label>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Select value={uploadForm.category} onValueChange={(v) => setUploadForm({ ...uploadForm, category: v })}>
                        <SelectTrigger data-testid="upload-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0E1628]">
                          {fileCategories.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              <div className="flex items-center gap-2">
                                <cat.icon className="w-4 h-4" />
                                {cat.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description (Optional)</Label>
                    <Textarea
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                      placeholder="Brief description of what this document contains..."
                      className="min-h-[80px]"
                      data-testid="upload-description"
                    />
                  </div>

                  <Button onClick={handleUpload} className="btn-forest" disabled={uploading || !uploadForm.file} data-testid="upload-btn">
                    {uploading ? null : <Upload className="w-4 h-4 mr-2" />}
                    Upload File
                  </Button>

                  <div className="p-4 bg-[#0F1720] rounded-sm">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[#8FA0B8] flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-[#8FA0B8]">
                        <p className="font-medium mb-1">How your data is used:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• Text is extracted from your documents automatically</li>
                          <li>• The AI reads this data to understand your business</li>
                          <li>• All recommendations become personalized to your context</li>
                          <li>• Your data is stored securely and never shared</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteFileId} onOpenChange={() => setDeleteFileId(null)}>
        <AlertDialogContent className="bg-[#0E1628]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this file? The AI will no longer have access to this information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default DataCenter;
