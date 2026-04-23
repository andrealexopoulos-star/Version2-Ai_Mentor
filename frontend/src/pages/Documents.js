import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
// Design tokens now referenced via CSS custom properties
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
import { apiClient } from '../lib/api';
import { FileText, Search, Trash2, Clock, Tag, Loader2, FolderOpen, Upload, Sparkles, Pencil, Bot, UploadCloud, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';

const documentTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'Analysis', label: 'Analyses' },
  { value: 'SOP', label: 'SOPs' },
  { value: 'Checklist', label: 'Checklists' },
  { value: 'Action Plan', label: 'Action Plans' },
  { value: 'Market Analysis', label: 'Market Analysis' },
];

const sourceTabs = [
  { key: 'all', label: 'All' },
  { key: 'ai', label: 'AI Generated' },
  { key: 'uploaded', label: 'Uploaded' },
  { key: 'template', label: 'Templates' },
];

// Recent activity is derived from the real documents list at render time
// (see `derivedRecentActivity` in the component body). The previous
// implementation hard-coded invented people (Sarah Chen, Marcus Webb,
// Priya Patel) and an invented document title ("Q1 Revenue Report") and
// showed them to every user regardless of their own data \u2014 a Contract v2
// violation. Removed. No fabricated names ever again.

const Documents = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [deleteId, setDeleteId] = useState(null);
  const [sourceTab, setSourceTab] = useState('all');

  const fetchDocuments = async () => {
    try {
      const params = filterType !== 'all' ? { document_type: filterType } : {};
      const response = await apiClient.get(`/documents`, { params });
      setDocuments(response.data);
    } catch (error) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiClient.delete(`/documents/${deleteId}`);
      setDocuments(documents.filter(d => d.id !== deleteId));
      toast.success('Document deleted');
    } catch (error) {
      toast.error('Failed to delete');
    } finally {
      setDeleteId(null);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (sourceTab === 'all') return true;
    // Map source tab to document source_type field (fallback heuristic if field not present)
    const src = (doc.source_type || '').toLowerCase();
    if (sourceTab === 'ai') return src === 'ai' || src === 'ai_generated' || src === 'ai generated';
    if (sourceTab === 'uploaded') return src === 'uploaded' || src === 'upload';
    if (sourceTab === 'template') return src === 'template' || src === 'templates';
    return true;
  });

  // Counts per source tab (based on search-matched docs)
  const searchMatchedDocs = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const sourceTabCounts = {
    all: searchMatchedDocs.length,
    ai: searchMatchedDocs.filter(d => { const s = (d.source_type || '').toLowerCase(); return s === 'ai' || s === 'ai_generated' || s === 'ai generated'; }).length,
    uploaded: searchMatchedDocs.filter(d => { const s = (d.source_type || '').toLowerCase(); return s === 'uploaded' || s === 'upload'; }).length,
    template: searchMatchedDocs.filter(d => { const s = (d.source_type || '').toLowerCase(); return s === 'template' || s === 'templates'; }).length,
  };

  const getTypeColor = (type) => {
    const colors = {
      'Analysis': 'bg-blue-100 text-blue-800',
      'SOP': 'bg-green-100 text-green-800',
      'Checklist': 'bg-purple-100 text-purple-800',
      'Action Plan': 'bg-orange-100 text-orange-800',
      'Market Analysis': 'bg-teal-100 text-teal-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="documents-page">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-medium" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 28, letterSpacing: 'var(--ls-display)', lineHeight: 1.05 }}>Documents</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {/* Upload handler */}}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold"
                style={{ background: 'var(--surface)', border: `1px solid ${'var(--border)'}`, color: 'var(--ink-display)' }}
                data-testid="upload-document-btn"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
              <Button
                onClick={() => navigate('/sop-generator')}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold"
                style={{ background: `linear-gradient(135deg, ${'var(--lava)'}, ${'var(--lava-deep)'})`, color: '#FFFFFF', border: 'none' }}
                data-testid="new-document-btn"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI Generate
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-muted)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="pl-10 bg-[var(--surface)]"
                data-testid="search-documents-input"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48 bg-[var(--surface)]" data-testid="filter-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--surface)]">
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source Type Tabs */}
          <div className="flex items-center gap-1.5 mb-6" data-testid="source-tabs">
            {sourceTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSourceTab(tab.key)}
                className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all"
                style={{
                  background: sourceTab === tab.key ? '#1E293B' : 'transparent',
                  color: sourceTab === tab.key ? '#FFFFFF' : 'var(--ink-muted)',
                  cursor: 'pointer',
                  border: 'none',
                }}
                data-testid={`source-tab-${tab.key}`}
              >
                {tab.label}
                <span
                  className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                  style={{
                    background: sourceTab === tab.key ? 'rgba(255,255,255,0.15)' : 'rgba(140,170,210,0.12)',
                    color: sourceTab === tab.key ? '#FFFFFF' : 'var(--ink-muted)',
                    fontSize: '11px',
                    minWidth: '20px',
                    textAlign: 'center',
                  }}
                >
                  {sourceTabCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Documents Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <CognitiveMesh compact />
            </div>
          ) : filteredDocuments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map((doc) => (
                <Card 
                  key={doc.id} 
                  className="rounded-lg hover-lift cursor-pointer group"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  data-testid={`document-card-${doc.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <span className={`badge text-xs ${getTypeColor(doc.document_type)}`}>
                        {doc.document_type}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(doc.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-sm transition-all"
                        data-testid={`delete-doc-${doc.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                    <h3 className="font-serif text-lg text-[var(--ink-display)] mb-2 line-clamp-2">
                      {doc.title}
                    </h3>
                    <p className="text-sm text-[var(--ink-secondary)] line-clamp-3 mb-4">
                      {doc.content.substring(0, 150)}...
                    </p>
                    <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                      {doc.tags?.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {doc.tags[0]}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-lg">
              <CardContent className="p-12 text-center">
                <FolderOpen className="w-16 h-16 text-[var(--ink-display)]/20 mx-auto mb-4" />
                <h3 className="text-xl font-serif text-[var(--ink-display)] mb-2">No documents yet</h3>
                <p className="text-[var(--ink-secondary)] mb-6">
                  {searchQuery || filterType !== 'all' 
                    ? 'No documents match your search criteria'
                    : 'Start creating SOPs, analyses, and action plans'
                  }
                </p>
                <Button 
                  onClick={() => navigate('/sop-generator')}
                  className="btn-lime rounded-sm"
                  data-testid="empty-state-create-btn"
                >
                  Create Your First Document
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity Feed \u2014 derived from real documents only.
              Previously this block rendered fabricated names (Sarah Chen,
              Marcus Webb, Priya Patel) + an invented "Q1 Revenue Report".
              Now: built from the 4 most-recent documents the user actually
              owns. If there are none, the section hides entirely \u2014 no
              placeholder names. */}
          {documents.length > 0 && (() => {
            const toActivity = (doc) => {
              const isAi = (doc.source_type || '').toLowerCase() === 'ai';
              const isUpload = (doc.source_type || '').toLowerCase() === 'uploaded';
              const iconClass = isAi ? 'generated' : isUpload ? 'created' : 'updated';
              const action = isAi ? 'generated' : isUpload ? 'uploaded' : 'updated';
              const IconComp = isAi ? Bot : isUpload ? UploadCloud : Pencil;
              const ts = doc.updated_at || doc.created_at;
              let timeLabel = '';
              if (ts) {
                const diffMs = Date.now() - new Date(ts).getTime();
                const diffH = Math.floor(diffMs / 3600000);
                if (diffH < 1) timeLabel = 'Just now';
                else if (diffH < 24) timeLabel = `${diffH}h ago`;
                else timeLabel = `${Math.floor(diffH / 24)}d ago`;
              }
              return {
                id: doc.id,
                icon: IconComp,
                iconClass,
                title: doc.title || 'Untitled document',
                action,
                time: timeLabel,
              };
            };
            const activityItems = documents
              .slice()
              .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
              .slice(0, 4)
              .map(toActivity);
            return (
              <div className="mt-10 mb-8" data-testid="recent-activity">
                <h2
                  className="font-semibold mb-4"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--ink-display)', letterSpacing: '-0.01em' }}
                >
                  Recent Activity
                </h2>
                <div className="flex flex-col gap-2">
                  {activityItems.map((item) => {
                    const IconComp = item.icon;
                    const iconBgMap = {
                      updated: { bg: 'var(--info-wash)', color: 'var(--info)' },
                      generated: { bg: 'var(--lava-wash)', color: 'var(--lava)' },
                      created: { bg: 'var(--positive-wash)', color: 'var(--positive)' },
                    };
                    const iconStyle = iconBgMap[item.iconClass] || iconBgMap.updated;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: 'var(--surface)', border: `1px solid ${'var(--border)'}` }}
                        data-testid={`activity-item-${item.id}`}
                      >
                        <div
                          className="flex items-center justify-center flex-shrink-0 rounded-lg"
                          style={{ width: 32, height: 32, background: iconStyle.bg, color: iconStyle.color }}
                        >
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-sm" style={{ color: 'var(--ink-secondary)' }}>
                          <strong style={{ color: 'var(--ink-display)' }}>{item.title}</strong>{' '}
                          {item.action}
                        </div>
                        {item.time && (
                          <div className="text-xs whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>
                            {item.time}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Storage Usage \u2014 removed until backend exposes a real
              /storage/quota endpoint. The previous implementation hard-coded
              "2.4 GB of 10 GB" for every user regardless of actual usage,
              which is a misrepresentation we can't defend. */}

        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[var(--surface)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Documents;
