import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Check, Loader2, ShieldCheck } from 'lucide-react';

import { supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { fontFamily } from '../design-system/tokens';
import BiqcLogoCard from '../components/BiqcLogoCard';
import PlanPicker, { PLAN_OPTIONS } from '../components/PlanPicker';
import useForceLightTheme from '../hooks/useForceLightTheme';

const DISPLAY = 'var(--font-marketing-display, "Geist", sans-serif)';
const UI      = 'var(--font-marketing-ui, "Geist", sans-serif)';
const MONO    = 'var(--font-mono, ' + fontFamily.mono + ')';

const CompleteSignup = () => {
  useForceLightTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [session, setSession] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [loadingSession, setLoadingSession] = useState(true);
  const [checkoutError, setCheckoutError] = useState('');
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const rawPlan = String(searchParams.get('plan') || '').toLowerCase();
  const normalizedInitialPlan =
    rawPlan === 'growth' || rawPlan === 'foundation' ? 'starter'
      : rawPlan === 'professional' ? 'pro'
        : ['starter', 'pro', 'business'].includes(rawPlan) ? rawPlan : 'starter';
  const [selectedPlan, setSelectedPlan] = useState(normalizedInitialPlan);

  // ── Pull the OAuth-signed-in user from the Supabase session ──
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session?.access_token) {
          const next = encodeURIComponent(`/complete-signup?plan=${normalizedInitialPlan}`);
          navigate(`/login-supabase?next=${next}`, { replace: true });
          return;
        }
        setSession(data.session);
        const u = data.session.user;
        setUserEmail(u?.email || '');
        setUserName(u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || '');
      } catch (_e) {
        const next = encodeURIComponent(`/complete-signup?plan=${normalizedInitialPlan}`);
        navigate(`/login-supabase?next=${next}`, { replace: true });
      } finally {
        setLoadingSession(false);
      }
    })();
  }, [navigate, normalizedInitialPlan]);

  useEffect(() => {
    setSelectedPlan(normalizedInitialPlan);
  }, [normalizedInitialPlan]);

  const selectedPlanDetails = useMemo(
    () => PLAN_OPTIONS.find(p => p.id === selectedPlan) || PLAN_OPTIONS[0],
    [selectedPlan]
  );

  const checkoutPlanId = selectedPlan === 'growth' || selectedPlan === 'foundation'
    ? 'starter'
    : selectedPlan === 'professional' ? 'pro' : selectedPlan;

  const handleCheckout = async (e) => {
    e?.preventDefault?.();
    if (!session) return;
    setCheckoutError('');
    setLoadingCheckout(true);
    try {
      const origin = window.location.origin;
      const res = await apiClient.post('/payments/checkout', {
        package_id: checkoutPlanId,
        origin_url: origin,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setCheckoutError('Checkout did not return a secure payment link. Please try again or speak with a BIQc Specialist.');
      toast.error('Checkout is unavailable right now. Please try again.');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setCheckoutError(detail || 'Checkout failed before redirect. Please try again or speak with a BIQc Specialist.');
      toast.error(detail || 'Checkout failed. Please try again.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
        <BiqcLogoCard size="md" to={null} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
      <nav className="px-6 sm:px-10 py-6">
        <BiqcLogoCard size="sm" to="/" />
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-[540px]">
          <span className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.08em]"
            style={{ background: 'rgba(232,93,0,0.12)', color: '#E85D00', border: '1px solid rgba(232,93,0,0.08)', fontFamily: MONO }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#E85D00', boxShadow: '0 0 8px #E85D00' }} />
            Complete your secure setup
          </span>
          <h1 className="mb-2" style={{ fontFamily: DISPLAY, color: '#0A0A0A', fontSize: '42px', letterSpacing: '-0.035em', lineHeight: 1.05, fontWeight: 600 }}>
            Choose your plan capacity, <em style={{ fontStyle: 'italic', color: '#E85D00' }}>{userName.split(' ')[0] || 'there'}</em>.
          </h1>
          <p className="text-base mb-6" style={{ fontFamily: UI, color: '#525252' }}>
            Your account <strong style={{ color: '#0A0A0A' }}>{userEmail}</strong> is signed in. Continue to secure checkout to complete subscription setup with transparent pricing before confirmation.
          </p>
          <p className="text-sm mb-6" style={{ fontFamily: UI, color: '#525252' }}>
            Every paid plan includes the same BIQc core intelligence system. You are selecting the capacity that fits your business.
          </p>

          <form onSubmit={handleCheckout} data-testid="complete-signup-form" style={{
            background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)',
            border: '1px solid rgba(10,10,10,0.06)',
            borderRadius: 20,
            padding: 28,
            boxShadow: '0 14px 40px rgba(10,10,10,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}>
            <div style={{ marginBottom: 18 }}>
              <PlanPicker value={selectedPlan} onChange={setSelectedPlan} disabled={loadingCheckout} />
            </div>

            <div style={{ marginBottom: 16, padding: '14px', borderRadius: 12, background: 'rgba(10,10,10,0.03)', border: '1px solid rgba(10,10,10,0.06)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <ShieldCheck size={16} style={{ color: '#0A0A0A', marginTop: 2, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontFamily: UI, color: '#0A0A0A', fontSize: 13.5, fontWeight: 600 }}>
                    Secure checkout reassurance
                  </p>
                  <p style={{ fontFamily: UI, color: '#525252', fontSize: 13 }}>
                    Eligible accounts may see $0 today with a 14-day trial in Stripe checkout. Cancel anytime. Secure billing via Stripe, your data stays yours, and you have Australian/local specialist support with no lock-in.
                  </p>
                </div>
              </div>
            </div>

            {checkoutError && (
              <div style={{
                marginTop: 4, marginBottom: 14, padding: '14px 16px', borderRadius: 12,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.24)',
                color: '#B91C1C', fontFamily: UI, fontSize: 13.5, lineHeight: 1.5,
              }} data-testid="complete-signup-checkout-error" role="alert">
                <strong style={{ display: 'block', marginBottom: 4 }}>Checkout could not start</strong>
                <span style={{ color: '#525252' }}>{checkoutError}</span>
              </div>
            )}

            <div style={{ marginTop: 8, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                `${selectedPlanDetails?.name || 'Growth'} capacity selected`,
                'Same core intelligence system across all paid plans',
                'No embedded card form here - secure checkout handoff only',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Check className="w-4 h-4 text-[#16A34A] shrink-0" />
                  <span style={{ fontFamily: UI, color: '#525252', fontSize: 13 }}>{item}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, marginBottom: 14, padding: '14px', borderRadius: 12, background: 'rgba(232,93,0,0.06)', border: '1px solid rgba(232,93,0,0.2)' }}>
              <p style={{ fontFamily: UI, color: '#0A0A0A', fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
                Need rollout guidance before checkout?
              </p>
              <p style={{ fontFamily: UI, color: '#525252', fontSize: 13, marginBottom: 10 }}>
                Book a call with a BIQc Specialist for local support on plan fit, setup timing, and handover.
              </p>
              <button
                type="button"
                onClick={() => navigate('/speak-with-local-specialist')}
                style={{
                  background: '#E85D00',
                  border: '1px solid #E85D00',
                  color: '#FFFFFF',
                  fontFamily: UI,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  borderRadius: 999,
                  padding: '9px 14px',
                }}
                data-testid="complete-signup-book-demo"
              >
                Book a call with a BIQc Specialist
              </button>
            </div>

            <button
              type="submit"
              disabled={loadingCheckout}
              className="w-full flex items-center justify-center gap-2 mt-5 text-[15px] font-medium transition-all disabled:opacity-50"
              style={{
                background: '#0A0A0A', color: '#FFFFFF', height: 48, fontFamily: UI,
                boxShadow: '0 4px 12px rgba(10,10,10,0.12)', border: '1px solid #0A0A0A',
                borderRadius: '999px', cursor: 'pointer', padding: '16px', letterSpacing: '-0.005em',
              }}
              data-testid="complete-signup-submit"
            >
              {loadingCheckout ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting secure checkout...
                </>
              ) : (
                <>
                  Continue to secure checkout <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-xs mt-3 text-center" style={{ fontFamily: MONO, color: '#737373' }}>
              Safe stopping point for validation is Stripe checkout load. Do not enter card details in test runs.
            </p>
          </form>

          <p className="text-[13px] mt-6 text-center" style={{ fontFamily: UI, color: '#737373' }}>
            Want to continue with a different account?{' '}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                const next = encodeURIComponent(`/complete-signup?plan=${selectedPlan}`);
                navigate(`/login-supabase?next=${next}`, { replace: true });
              }}
              style={{ color: '#E85D00', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
              data-testid="complete-signup-signout"
            >
              Sign out
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompleteSignup;
