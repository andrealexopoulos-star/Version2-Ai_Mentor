import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
import { apiClient } from '../lib/api';
import { FileText, Search, Trash2, Clock, Tag, Loader2, FolderOpen } from 'lucide-react';
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

const Documents = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [deleteId, setDeleteId] = useState(null);

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

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Library</div>
              <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Document <em style={{ fontStyle: 'italic', color: '#E85D00' }}>vault</em>.</h1>
            </div>
            <Button 
              onClick={() => navigate('/sop-generator')}
              className="btn-lime rounded-full px-6"
              data-testid="new-document-btn"
            >
              <FileText className="w-4 h-4 mr-2" />
              New Document
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="pl-10 bg-[#0E1628]"
                data-testid="search-documents-input"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48 bg-[#0E1628]" data-testid="filter-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0E1628]">
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <h3 className="font-serif text-lg text-[#EDF1F7] mb-2 line-clamp-2">
                      {doc.title}
                    </h3>
                    <p className="text-sm text-[#8FA0B8] line-clamp-3 mb-4">
                      {doc.content.substring(0, 150)}...
                    </p>
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
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
                <FolderOpen className="w-16 h-16 text-[#EDF1F7]/20 mx-auto mb-4" />
                <h3 className="text-xl font-serif text-[#EDF1F7] mb-2">No documents yet</h3>
                <p className="text-[#8FA0B8] mb-6">
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
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#0E1628]">
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
