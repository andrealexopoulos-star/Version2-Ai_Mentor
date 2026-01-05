import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { Sparkles, Lock } from 'lucide-react';

const OpsAdvisoryCentre = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/oac/recommendations');
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <span className="badge badge-primary">Ops Advisory Centre</span>
          </div>
          <h1 style={{ color: 'var(--text-primary)' }}>Today&apos;s Recommendations</h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
            Highly personalised operational suggestions based on your profile, data centre and recent activity.
          </p>
        </div>

        {loading ? (
          <Card className="card">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-80" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[86%]" />
            </CardContent>
          </Card>
        ) : data?.locked ? (
          <Card className="card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Upgrade to unlock more recommendations
              </CardTitle>
              <CardDescription>
                You&apos;ve reached your monthly limit for your current plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Used {data?.usage?.used || 0} of {data?.usage?.limit || 0} this month.
              </div>
              <Button className="btn-primary" onClick={() => (window.location.href = '/pricing')}>
                View Plans
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="card">
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>
                  {data?.meta?.date ? `Generated for ${data.meta.date}` : 'Generated today'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(data?.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
                    >
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      {item.reason && (
                        <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                          {item.reason}
                        </div>
                      )}
                      {item.actions?.length ? (
                        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {item.actions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Used {data?.usage?.used || 0} of {data?.usage?.limit || 0} recommendations this month.
              </div>
              <Button className="btn-secondary" onClick={fetchRecommendations}>
                Refresh
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OpsAdvisoryCentre;
