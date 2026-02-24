import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';

const OutlookTest = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    try {
      console.log('Fetching auth URL...');
      const response = await apiClient.get('/auth/outlook/login');
      console.log('Response:', response.data);
      
      const url = response.data.auth_url;
      setAuthUrl(url);
      
      console.log('Redirecting to:', url);
      toast.success('Redirecting to Microsoft...');
      
      // Wait a moment then redirect
      setTimeout(() => {
        window.location.href = url;
      }, 500);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Outlook Connection Test</h1>
        
        <Card>
          <CardContent className="p-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Test Microsoft Outlook OAuth</h2>
                <p className="text-sm text-gray-600 mb-4">
                  This page tests the Outlook connection directly with detailed logging.
                </p>
              </div>

              <Button 
                onClick={handleConnect} 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12"
              >
                {loading ? (
                  <>
                    <span className="text-xs" style={{ color: "#FF6A00" }}>loading...</span>
                    Connecting...
                  </>
                ) : (
                  'Connect Microsoft Outlook'
                )}
              </Button>

              {authUrl && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 mb-2">Auth URL generated successfully!</p>
                      <p className="text-xs text-green-700 break-all">{authUrl}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 mb-2">
                  <strong>What to check:</strong>
                </p>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Open browser console (F12)</li>
                  <li>2. Click the button above</li>
                  <li>3. Watch console for messages</li>
                  <li>4. Should redirect to Microsoft</li>
                </ol>
              </div>

              <Button 
                onClick={() => navigate('/integrations')}
                variant="outline"
                className="w-full"
              >
                Back to Integrations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default OutlookTest;
