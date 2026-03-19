import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2, Lock } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { apiClient } from '../lib/api';
import { TIER_FEATURES } from '../config/tiers';
import { toast } from 'sonner';

export default function UpgradePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/stripe/create-checkout-session', {
        tier: 'starter',
        success_url: `${window.location.origin}/upgrade/success`,
        cancel_url: `${window.location.origin}/upgrade`,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast.error('Failed to start checkout. Please try again.');
    } catch {
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-16" style={{ background: '#070E18', fontFamily: fontFamily.body }} data-testid="upgrade-page">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.24)' }}>
            <Lock className="h-4 w-4" style={{ color: '#FF6A00' }} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Upgrade required</span>
          </div>
          <h1 className="mt-6 text-4xl sm:text-5xl" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>Unlock SMB Protect</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base" style={{ color: '#9FB0C3' }}>
            One paid tier. One clear commercial offer. Everything in Free, plus the launch modules reserved for deeper operating control.
          </p>
        </div>

        <div className="mx-auto max-w-2xl rounded-[28px] border p-8" style={{ background: 'rgba(20,28,38,0.95)', borderColor: 'rgba(255,106,0,0.24)' }}>
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>SMB Protect</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>$349</span>
            <span className="pb-2 text-sm" style={{ color: '#64748B' }}>/month</span>
          </div>
          <p className="mt-3 text-sm" style={{ color: '#9FB0C3' }}>For teams ready to move beyond email-only free access into deeper strategic and operating control.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {TIER_FEATURES.starter.map((feature) => (
              <div key={feature} className="flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: '#243140', color: '#C9D5E2' }}>
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#FF6A00' }} />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white"
            style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
            data-testid="upgrade-starter"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upgrade to SMB Protect'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>

        <div className="text-center">
          <button onClick={() => navigate(-1)} className="text-sm" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
            ← Back to platform
          </button>
        </div>
      </div>
    </div>
  );
}