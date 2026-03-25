import { useState } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { callEdgeFunction } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Mail, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';

const GmailTest = () => {
  const { user } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);

  const testGmailConnection = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setLoading(true);
    setResult(null);
    setRawResponse(null);

    try {
      // console.log('=== TESTING GMAIL CONNECTION ===');
      
      const data = await callEdgeFunction('gmail_prod', {});
      
      setRawResponse({
        status: data?.ok ? 200 : 400,
        data: data,
      });

      if (data.ok) {
        setResult({
          success: true,
          ...data,
        });
        toast.success(`Gmail connected! Found ${data.labels_count} labels`);
      } else {
        setResult({
          success: false,
          ...data,
        });
        toast.error(`Gmail connection failed: ${data.error_message}`);
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
      setResult({
        success: false,
        error_stage: 'network',
        error_message: error.message,
        remediation: 'Check network connection and Edge Function deployment',
      });
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-serif mb-2" style={{ color: 'var(--text-primary)' }}>
            Gmail Connection Test
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Test the Gmail connector service that verifies mailbox access
          </p>
        </div>

        {/* Test Button */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Test Gmail Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This will call the <code className="px-2 py-1 bg-gray-100 rounded">gmail_prod</code> connector endpoint
                which will:
              </p>
              <ul className="text-sm space-y-2 ml-6 list-disc" style={{ color: 'var(--text-secondary)' }}>
                <li>Verify your authenticated session</li>
                <li>Extract Google OAuth tokens from your identity</li>
                <li>Call Gmail API to fetch your labels</li>
                <li>Store tokens in the database</li>
                <li>Return real label count (no mock data)</li>
              </ul>

              <Button
                onClick={testGmailConnection}
                disabled={loading || !user}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Test Gmail Connection
                  </>
                )}
              </Button>

              {!user && (
                <p className="text-sm text-amber-600">
                  ⚠️ You must be logged in to test Gmail connection
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Display */}
        {result && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Connection Successful
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    Connection Failed
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-sm text-green-700 mb-1">Gmail Connected</div>
                      <div className="text-2xl font-bold text-green-900">
                        {result.gmail_connected ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-700 mb-1">Total Labels</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {result.labels_count}
                      </div>
                    </div>
                  </div>

                  {result.sample_labels && result.sample_labels.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                        Sample Labels:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.sample_labels.map((label, index) => (
                          <Badge key={index} variant="secondary">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-red-900 mb-1">
                          Error Stage: {result.error_stage}
                        </div>
                        <div className="text-sm text-red-700">
                          {result.error_message}
                        </div>
                      </div>
                    </div>
                  </div>

                  {result.remediation && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="font-medium text-amber-900 mb-1">
                        How to Fix:
                      </div>
                      <div className="text-sm text-amber-700">
                        {result.remediation}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Raw Response */}
        {rawResponse && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-mono">
                Raw API Response
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                <pre className="text-xs">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GmailTest;
