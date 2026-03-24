import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier } from '../lib/tierResolver';
import { apiClient } from '../lib/api';
import { Lock, ArrowRight, Check, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { PRICING_TIERS } from '../config/pricingTiers';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';


const FEATURE_LABELS = {
  '/exposure-scan': 'Exposure Scan',
  '/marketing-automation': 'Marketing Auto',
  '/reports': 'Reports',
  '/sop-generator': 'SOP Generator',
  '/decisions': 'Decision Tracker',
  '/forensic-audit': 'Ingestion Audit',
};

// Use canonical pricing — excludes 'free' and 'super_admin' from payment plans
const PLANS = PRICING_TIERS.filter(t => t.id === 'starter');

const SubscribePage = () => {
  const { user } = useSupabaseAuth();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || '';
  const sessionId = searchParams.get('session_id');
  const status = searchParams.get('status');
  const featureLabel = FEATURE_LABELS[from] || (from ? from.replace(/\//g, '').replace(/-/g, ' ') : '');
  const currentTier = resolveTier(user);

  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [loading, setLoading] = useState(null);

  // Poll payment status if returning from Stripe
  const pollPaymentStatus = useCallback(async (sid, attempt) => {
    if (attempt >= 5) {
      setPaymentResult({ status: 'timeout', message: 'Payment verification timed out. Please refresh.' });
      return;
    }
    setCheckingPayment(true);
    try {
      const res = await apiClient.get(`/payments/status/${sid}`);
      if (res.data?.payment_status === 'paid') {
        setPaymentResult({ status: 'success', message: 'Payment successful! Your account has been upgraded.', tier: res.data.metadata?.tier });
        setCheckingPayment(false);
        return;
      }
      if (res.data?.status === 'expired') {
        setPaymentResult({ status: 'expired', message: 'Payment session expired.' });
        setCheckingPayment(false);
        return;
      }
      setTimeout(() => pollPaymentStatus(sid, attempt + 1), 2000);
    } catch {
      setPaymentResult({ status: 'error', message: 'Error checking payment. Please refresh.' });
      setCheckingPayment(false);
    }
  }, []);

  useEffect(() => {
    if (sessionId && status === 'success') {
      pollPaymentStatus(sessionId, 0);
    }
  }, [sessionId, status, pollPaymentStatus]);

  const handleUpgrade = async (packageId) => {
    setLoading(packageId);
    try {
      const origin = window.location.origin;
      const res = await apiClient.post('/payments/checkout', { package_id: packageId, origin_url: origin });
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast.error('Checkout is unavailable right now. Please try again.');
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Checkout failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: 'var(--biqc-bg)' }} data-testid="subscribe-page">
      {/* Payment Result Banner */}
      {paymentResult && (
        <div className="w-full max-w-xl mb-6 p-4 rounded-xl flex items-center gap-3" style={{
          background: paymentResult.status === 'success' ? '#10B98110' : '#EF444410',
          border: `1px solid ${paymentResult.status === 'success' ? '#10B98130' : '#EF444430'}`,
        }}>
          {paymentResult.status === 'success' ? <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> : <XCircle className="w-5 h-5 text-[#EF4444]" />}
          <p className="text-sm" style={{ color: paymentResult.status === 'success' ? '#10B981' : '#EF4444' }}>{paymentResult.message}</p>
        </div>
      )}

      {checkingPayment && (
        <div className="w-full max-w-xl mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: '#FF6A0010', border: '1px solid #FF6A0030' }}>
          <Loader2 className="w-5 h-5 text-[#FF6A00] animate-spin" />
          <p className="text-sm text-[#FF6A00]">Verifying payment...</p>
        </div>
      )}

      <div className="text-center mb-10 max-w-xl">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: '#FF6A0015' }}>
          <Lock className="w-6 h-6 text-[#FF6A00]" />
        </div>
        {featureLabel && <p className="text-xs text-[#FF6A00] mb-2" style={{ fontFamily: fontFamily.mono }}>{featureLabel} requires a paid plan</p>}
        <h1 className="text-3xl font-bold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Upgrade to BIQc Foundation</h1>
        <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>Current plan: <strong className="text-[#F4F7FA] capitalize">{currentTier}</strong></p>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-3xl w-full mb-8">
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentTier;
          return (
            <div key={plan.id} className="rounded-xl p-6 relative" style={{
              background: 'var(--biqc-bg-card)',
              border: `2px solid ${plan.recommended ? plan.color : '#243140'}`,
              boxShadow: plan.recommended ? `0 8px 32px ${plan.color}20` : 'none',
            }} data-testid={`plan-${plan.id}`}>
              {plan.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1 rounded-full text-white" style={{ background: plan.color, fontFamily: fontFamily.mono }}>RECOMMENDED</span>
              )}
              <h3 className="text-lg font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold" style={{ color: plan.color, fontFamily: fontFamily.mono }}>{plan.price}</span>
                <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{plan.period}</span>
              </div>
              <div className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: plan.color }} />
                    <span className="text-xs text-[#9FB0C3]">{f}</span>
                  </div>
                ))}
              </div>
              {isCurrent ? (
                <span className="block text-center text-xs text-[#64748B] py-2.5" style={{ fontFamily: fontFamily.mono }}>Current Plan</span>
              ) : (
                <button onClick={() => handleUpgrade(plan.id)} disabled={loading === plan.id}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: plan.color }} data-testid={`upgrade-${plan.id}`}>
                  {loading === plan.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>Upgrade <ArrowRight className="w-4 h-4" /></>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Link to="/advisor" className="text-xs text-[#64748B] hover:text-[#9FB0C3]" style={{ fontFamily: fontFamily.mono }}>Back to Intelligence Platform</Link>
    </div>
  );
};

export default SubscribePage;
