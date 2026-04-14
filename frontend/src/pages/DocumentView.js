import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Loader2, Download, Trash2, Clock, Tag, Copy, Check } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
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



const DocumentView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDocument = async () => {
    try {
      const response = await apiClient.get(`/documents/${id}`);
      setDocument(response.data);
    } catch (error) {
      toast.error('Document not found');
      navigate('/documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/documents/${id}`);
      toast.success('Document deleted');
      navigate('/documents');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(document?.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const downloadAsMarkdown = () => {
    const blob = new Blob([document?.content || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document?.title || 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <CognitiveMesh compact />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="document-view-page">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/documents')}
              className="inline-flex items-center gap-2 text-[#8FA0B8] hover:text-[#EDF1F7] mb-6 transition-colors"
              data-testid="back-to-documents-btn"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Documents
            </button>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <span className="badge badge-lime text-xs mb-2">{document?.document_type}</span>
                <h1 className="text-3xl md:text-4xl font-serif text-[#EDF1F7]">{document?.title}</h1>
                <div className="flex items-center gap-4 mt-3 text-sm text-[#8FA0B8]">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {new Date(document?.created_at).toLocaleDateString()}
                  </div>
                  {document?.tags?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Tag className="w-4 h-4" />
                      {document?.tags.join(', ')}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={copyToClipboard}
                  data-testid="copy-document-btn"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadAsMarkdown}
                  className="border-[rgba(140,170,210,0.15)] text-[#EDF1F7]"
                  data-testid="download-document-btn"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowDelete(true)}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  data-testid="delete-document-btn"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <Card className="rounded-lg">
            <CardContent className="p-8">
              <div className="markdown-content prose prose-lg max-w-none">
                <ReactMarkdown>{document?.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-[#0E1628]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{document?.title}&quot;? This action cannot be undone.
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

export default DocumentView;
