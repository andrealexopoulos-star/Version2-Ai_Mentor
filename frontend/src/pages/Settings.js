import { InlineLoading } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { User, Bell, Activity, Loader2, Save, CreditCard, RefreshCw, AlertTriangle, Trash2, Download, Unplug, Plus } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
// Design tokens: typography now uses CSS variables (--font-display, --font-ui, --font-mono) from tokens.css
import { PageSkeleton } from '../components/ui/skeleton-loader';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import CancelReasonModal from '../components/CancelReasonModal';
const settingsCardStyle = {
  background: 'var(--surface, #fff)',
  border: '1px solid var(--border, rgba(10,10,10,0.08))',
  borderRadius: 'var(--r-lg, 12px)',
  boxShadow: 'var(--elev-1, 0 1px 3px rgba(0,0,0,0.04))',
  overflow: 'hidden',
};
const TIER_DISPLAY = {
  free: 'Free',
  trial: 'Free Trial',
  starter: 'Growth',
  foundation: 'Growth',
  growth: 'Growth',
  pro: 'Professional',
  professional: 'Professional',
  enterprise: 'Enterprise',
  custom_build: 'Custom',
  beta: 'Beta',
  super_admin: 'Admin',
};

const STATUS_BADGE_STYLES = {
  active: { background: 'rgba(22,163,106,0.12)', color: 'var(--positive, #16A34A)' },
  trialing: { background: 'rgba(232,93,0,0.12)', color: 'var(--lava, #E85D00)' },
  past_due: { background: 'rgba(220,38,38,0.12)', color: 'var(--danger, #DC2626)' },
};

const SettingsBillingContent = ({ navigate, user }) => {
  const [overview, setOverview] = useState(null);
  const [loading, setBillingLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [topupSaving, setTopupSaving] = useState(false);
  // Sprint B #18 (2026-04-22): cancel-reason modal before Stripe portal.
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const load = () => {
    setBillingLoading(true);
    apiClient.get('/billing/overview')
      .then(res => setOverview(res.data))
      .catch(() => setOverview(null))
      .finally(() => setBillingLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Formatters
  const fmtTokens = (n) => {
    if (n === null || n === undefined) return '—';
    if (n < 0) return '\u221E';
    return new Intl.NumberFormat('en-AU').format(Math.round(n));
  };
  const fmtAud = (cents, currency = 'AUD') => {
    if (cents === null || cents === undefined) return '—';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(cents) / 100);
  };
  const fmtDate = (isoLike) => {
    if (!isoLike) return null;
    try {
      return new Date(isoLike).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return null; }
  };

  // Derive from new /billing/overview shape (Track B4 2026-04-21)
  const plan = overview?.plan || {};
  const rawTier = String(plan.tier || user?.subscription_tier || 'trial').toLowerCase();
  const displayName = TIER_DISPLAY[rawTier] || 'Free';
  const unmetered = !!plan.unmetered;
  const subStatus = overview?.subscription_status
    || (overview?.trial_ends_at && new Date(overview.trial_ends_at) > new Date() ? 'trialing' : null);
  const isPaid = ['starter', 'foundation', 'growth', 'pro', 'professional', 'business', 'enterprise', 'custom_build'].includes(rawTier);
  const onTrial = subStatus === 'trialing'
    || (overview?.trial_ends_at ? new Date(overview.trial_ends_at) > new Date() : false);
  const paymentRequired = !!overview?.payment_required;

  const allowance = plan.monthly_allowance;
  const consumed = overview?.consumed_this_period ?? 0;
  const toppedUp = overview?.topped_up_this_period ?? 0;
  const netRemaining = overview?.net_remaining ?? 0;
  const pct = unmetered ? 0 : Math.round((overview?.percent_consumed || 0) * 100);
  const usageBarColor = pct >= 85
    ? 'var(--danger, #DC2626)'
    : pct >= 60 ? 'var(--warning, #E85D00)' : 'var(--positive, #16A34A)';

  // Daily meter (Andreas scope 2026-04-22) — resets at UTC 00:00
  const tokensToday = overview?.tokens_today ?? 0;
  const dailyAverage = overview?.daily_average ?? 0;
  const pctOfNormal = overview?.percent_of_daily_normal; // null when no baseline
  const dailyBarPct = (pctOfNormal === null || pctOfNormal === undefined)
    ? null
    : Math.min(200, Math.round(pctOfNormal * 100));
  const dailyBarColor = dailyBarPct === null
    ? 'var(--ink-muted, #737373)'
    : dailyBarPct >= 150 ? 'var(--danger, #DC2626)'
    : dailyBarPct >= 110 ? 'var(--warning, #E85D00)'
    : 'var(--positive, #16A34A)';

  const nextCharge = overview?.next_charge;
  const nextChargeDate = fmtDate(nextCharge?.date);
  const trialEndDate = fmtDate(overview?.trial_ends_at);

  const recentTopups = overview?.recent_topups || [];
  const recentInvoices = overview?.recent_invoices || [];

  // Sprint B #18 (2026-04-22): intercept portal click with cancel-reason modal.
  // openStripePortal is the entry point for all 3 buttons. It no longer fires
  // the redirect itself — it opens the modal, which then calls _proceedToPortal.
  const openStripePortal = () => {
    setCancelModalOpen(true);
  };

  const _proceedToPortal = async (reason) => {
    setPortalLoading(true);
    try {
      // Fire-and-forget cancel-reason capture. Never blocks the redirect:
      // if persist fails the backend returns ok:false, not 500. Even if the
      // POST itself throws (network), we continue to Stripe.
      if (reason && reason.reason_key) {
        try {
          await apiClient.post('/billing/cancel-reason', reason);
        } catch (e) {
          // Swallow — retention capture must not gate access to cancel.
          // eslint-disable-next-line no-console
          console.warn('[cancel-reason] submit failed, continuing to portal:', e);
        }
      }
      const res = await apiClient.post('/stripe/portal-session');
      if (res.data?.url) {
        setCancelModalOpen(false);
        window.location.href = res.data.url;
        return;
      }
      toast.error('Unable to open billing portal');
    } catch {
      toast.error('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
      setCancelModalOpen(false);
    }
  };

  const toggleAutoTopup = async (enabled) => {
    setTopupSaving(true);
    try {
      const res = await apiClient.patch('/billing/auto-topup', { enabled });
      setOverview(prev => prev ? { ...prev, auto_topup_enabled: !!res.data?.auto_topup_enabled } : prev);
      toast.success(enabled ? 'Auto top-up on' : 'Auto top-up off');
    } catch {
      toast.error('Could not update auto top-up');
    } finally {
      setTopupSaving(false);
    }
  };

  if (loading) {
    return <InlineLoading text="loading billing" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5, 20px)' }}>

      {/* Payment-required banner (B7 cron flipped it on) */}
      {paymentRequired && (
        <div style={{
          background: 'var(--danger-wash, #FEE2E2)',
          border: '1px solid var(--danger, #DC2626)',
          borderRadius: 'var(--r-md, 8px)',
          padding: 'var(--sp-4, 16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--danger, #DC2626)' }} />
            <div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--danger, #DC2626)' }}>
                Payment required
              </p>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-secondary, #525252)' }}>
                Your last top-up attempt failed. Update your card to keep AI access active.
              </p>
            </div>
          </div>
          <Button onClick={openStripePortal} disabled={portalLoading}
            style={{ fontFamily: 'var(--font-ui)', fontSize: 13, background: 'var(--danger, #DC2626)', color: 'var(--ink-inverse, #fff)', borderRadius: 'var(--r-md, 8px)', border: 'none' }}>
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update card'}
          </Button>
        </div>
      )}

      {/* Current Plan card */}
      <div style={{ background: 'linear-gradient(135deg, var(--lava-wash, #FFF1E6) 0%, var(--surface, #fff) 100%)', border: '1px solid var(--lava, #E85D00)', borderRadius: 'var(--r-lg, 12px)', padding: 'var(--sp-6, 24px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-5, 20px)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-display, #0A0A0A)' }}>
              {displayName}
              {onTrial && <em style={{ color: 'var(--lava, #E85D00)', fontStyle: 'italic' }}> (trial)</em>}
            </div>
            {subStatus && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                letterSpacing: 'var(--ls-caps, 0.08em)', padding: '3px 10px',
                borderRadius: 'var(--r-full, 999px)', fontWeight: 600,
                ...(STATUS_BADGE_STYLES[subStatus] || STATUS_BADGE_STYLES.active),
              }}>
                {subStatus.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-secondary, #525252)', marginTop: 'var(--sp-2, 8px)', lineHeight: 1.5 }}>
            {onTrial && trialEndDate ? (
              <>Trial ends {trialEndDate}. {nextChargeDate && <>First charge {nextChargeDate}.</>}</>
            ) : isPaid && nextChargeDate ? (
              <>Next charge {nextChargeDate}{nextCharge?.amount_aud_cents ? <> · {fmtAud(nextCharge.amount_aud_cents)}</> : null}.</>
            ) : (
              <>Active plan.</>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3, 12px)', alignItems: 'center' }}>
          {isPaid ? (
            <Button onClick={openStripePortal} disabled={portalLoading}
              style={{ fontFamily: 'var(--font-ui)', fontSize: 13, background: 'var(--lava, #E85D00)', color: 'var(--ink-inverse, #fff)', borderRadius: 'var(--r-md, 8px)', border: 'none' }}>
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Manage Subscription
            </Button>
          ) : (
            <Button onClick={() => navigate('/subscribe')}
              style={{ fontFamily: 'var(--font-ui)', fontSize: 13, background: 'var(--lava, #E85D00)', color: 'var(--ink-inverse, #fff)', borderRadius: 'var(--r-md, 8px)', border: 'none' }}>
              {onTrial ? 'Upgrade Before Trial Ends' : 'View Plans & Upgrade'}
            </Button>
          )}
        </div>
      </div>

      {/* Daily memory counter (Andreas scope 2026-04-22 — resets UTC 00:00) */}
      <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-lg, 12px)', padding: 'var(--sp-5, 20px)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted, #737373)' }}>
            Tokens used today
          </p>
          {unmetered && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
              letterSpacing: 'var(--ls-caps, 0.08em)', padding: '2px 8px',
              borderRadius: 'var(--r-full, 999px)', fontWeight: 600,
              background: 'rgba(10,10,10,0.06)', color: 'var(--ink-secondary, #525252)',
            }}>
              Unmetered
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: 'var(--ink-display, #0A0A0A)', lineHeight: 1 }}>
            {fmtTokens(tokensToday)}
          </div>
          {!unmetered && dailyBarPct !== null && (
            <span
              title={`Your rolling daily average this period is ${fmtTokens(Math.round(dailyAverage))} tokens.`}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary, #525252)' }}
            >
              {dailyBarPct}% of daily normal
            </span>
          )}
          {!unmetered && dailyBarPct === null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted, #737373)' }}>
              — no baseline yet
            </span>
          )}
        </div>
        {!unmetered && dailyBarPct !== null && (
          <div style={{ height: 6, borderRadius: 'var(--r-full, 999px)', background: 'var(--surface-sunken, rgba(10,10,10,0.04))', overflow: 'hidden', marginTop: 12 }}>
            <div style={{
              width: `${Math.min(100, dailyBarPct / 2)}%`,
              height: '100%',
              background: dailyBarColor,
              transition: 'width 0.6s ease',
            }} />
          </div>
        )}
        {!unmetered && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted, #737373)', marginTop: 10 }}>
            This period: {fmtTokens(consumed)} / {fmtTokens((allowance || 0) + toppedUp)}
          </p>
        )}
        {unmetered && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted, #737373)', marginTop: 10 }}>
            No cap on your plan. Daily counter resets at UTC 00:00.
          </p>
        )}
      </div>

      {/* Token allowance bar */}
      <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-lg, 12px)', padding: 'var(--sp-5, 20px)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted, #737373)' }}>
            AI allowance this period
          </p>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary, #525252)' }}>
            {unmetered
              ? 'Unlimited'
              : <>{fmtTokens(consumed)} / {fmtTokens((allowance || 0) + toppedUp)} tokens</>
            }
          </span>
        </div>
        {!unmetered && (
          <div style={{ height: 10, borderRadius: 'var(--r-full, 999px)', background: 'var(--surface-sunken, rgba(10,10,10,0.04))', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, pct)}%`, height: '100%',
              background: usageBarColor, transition: 'width 0.6s ease',
            }} />
          </div>
        )}
        <div className="flex justify-between" style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted, #737373)' }}>
          <span>{unmetered ? 'No cap on your plan' : <>{fmtTokens(netRemaining)} remaining</>}</span>
          <span>{toppedUp > 0 ? <>Includes {fmtTokens(toppedUp)} top-up</> : ''}</span>
        </div>
      </div>

      {/* Auto top-up toggle */}
      {!unmetered && (
        <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-lg, 12px)', padding: 'var(--sp-5, 20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-display, #0A0A0A)' }}>
              Auto top-up
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)', marginTop: 2 }}>
              {overview?.topup_pack
                ? <>When your allowance runs out we'll auto-charge {fmtAud(overview.topup_pack.price_aud_cents)} for {fmtTokens(overview.topup_pack.tokens)} more tokens so BIQc keeps working.</>
                : 'When your allowance runs out we automatically top you up.'}
            </p>
          </div>
          <Switch
            checked={!!overview?.auto_topup_enabled}
            disabled={topupSaving}
            onCheckedChange={(v) => toggleAutoTopup(!!v)}
          />
        </div>
      )}

      {/* Recent top-ups */}
      {recentTopups.length > 0 && (
        <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-lg, 12px)', padding: 'var(--sp-5, 20px)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted, #737373)', marginBottom: 12 }}>
            Recent top-ups
          </p>
          <div>
            {recentTopups.map((t, idx) => (
              <div key={t.stripe_ref || idx} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: idx < recentTopups.length - 1 ? '1px solid var(--border, rgba(10,10,10,0.08))' : 'none' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-display, #0A0A0A)' }}>
                    {fmtTokens(t.tokens)} tokens
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted, #737373)' }}>
                    {fmtDate(t.date) || '—'}
                  </p>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-display, #0A0A0A)' }}>
                  {fmtAud(t.price_aud_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent invoices */}
      {recentInvoices.length > 0 && (
        <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-lg, 12px)', padding: 'var(--sp-5, 20px)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted, #737373)', marginBottom: 12 }}>
            Recent invoices
          </p>
          <div>
            {recentInvoices.map((inv, idx) => (
              <div key={idx} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: idx < recentInvoices.length - 1 ? '1px solid var(--border, rgba(10,10,10,0.08))' : 'none' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-display, #0A0A0A)' }}>
                    {fmtAud(inv.amount_aud_cents)}
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted, #737373)' }}>
                    {fmtDate(inv.date) || '—'}
                  </p>
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-caps, 0.08em)', padding: '2px 8px',
                  borderRadius: 'var(--r-full, 999px)', fontWeight: 600,
                  background: inv.status === 'paid' ? 'rgba(22,163,106,0.12)' : inv.status === 'failed' ? 'rgba(220,38,38,0.12)' : 'rgba(115,115,115,0.12)',
                  color: inv.status === 'paid' ? 'var(--positive, #16A34A)' : inv.status === 'failed' ? 'var(--danger, #DC2626)' : 'var(--ink-muted, #737373)',
                }}>
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Method */}
      <div style={{ borderTop: '1px solid var(--border, rgba(10,10,10,0.08))', paddingTop: 'var(--sp-5, 20px)', marginTop: 'var(--sp-1, 4px)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted, #737373)', marginBottom: 12 }}>Payment Method</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5" style={{ color: 'var(--lava, #E85D00)' }} />
            <div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink-display, #0A0A0A)' }}>Managed through Stripe</p>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)' }}>Update card, invoice email, or tax ID via the portal.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={openStripePortal} disabled={portalLoading}
            style={{ fontFamily: 'var(--font-ui)', fontSize: 13, borderColor: 'var(--lava, #E85D00)', color: 'var(--lava, #E85D00)', borderRadius: 'var(--r-md, 8px)' }}>
            {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Open portal'}
          </Button>
        </div>
      </div>

      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-muted, #737373)' }}>
        Billing questions? <a href="mailto:support@biqc.ai" style={{ color: 'var(--lava, #E85D00)' }}>support@biqc.ai</a>
      </p>

      {/* Sprint B #18 (2026-04-22): cancel-reason capture before Stripe portal. */}
      <CancelReasonModal
        isOpen={cancelModalOpen}
        onClose={() => { if (!portalLoading) setCancelModalOpen(false); }}
        onProceed={_proceedToPortal}
        submitting={portalLoading}
      />
    </div>
  );
};

const Settings = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [profile, setProfile] = useState({});
  const [calibrationStatus, setCalibrationStatus] = useState(null);
  const [resettingCalibration, setResettingCalibration] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [accountData, setAccountData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company: user?.company || '',
  });
  const [timezone, setTimezone] = useState('Australia/Sydney');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [memberSince, setMemberSince] = useState(null);

  // Notifications state (6 toggles from mockup)
  const [notifications, setNotifications] = useState({
    notify_morning_brief: true,
    notify_critical_alerts: true,
    notify_high_alerts: true,
    notify_weekly_report: true,
    notify_nudges: true,
    notify_marketing: false,
  });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);

  // Signal thresholds state (5 selects from mockup)
  const [thresholds, setThresholds] = useState({
    threshold_deal_stall_days: 14,
    threshold_cash_runway_months: 6,
    threshold_meeting_overload_pct: 60,
    threshold_churn_silence_days: 21,
    threshold_invoice_aging_pct: 15,
  });
  const [threshLoading, setThreshLoading] = useState(true);
  const [threshSaving, setThreshSaving] = useState(false);

  // Danger zone state
  const [disconnecting, setDisconnecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const syncFromCalibration = async () => {
    setSyncing(true);
    try {
      // Pull enriched profile from backend (business_profiles + operator_profile + integrations)
      const res = await apiClient.get('/business-profile/context');
      const ctx = res.data || {};
      const profile = ctx.profile || {};
      const resolved = ctx.resolved_fields || {};

      // Build enriched profile from all available sources
      const enriched = { ...profile };
      for (const [field, factData] of Object.entries(resolved)) {
        if (factData?.value && !enriched[field]) {
          enriched[field] = factData.value;
        }
      }

      // Also pull from operator profile (agent persona = communication preferences)
      if (ctx.calibration_status === 'complete') {
        enriched._calibration_complete = true;
      }

      const fieldsUpdated = Object.values(enriched).filter(v => v).length;

      if (fieldsUpdated > 0) {
        // Save enriched profile back
        await apiClient.put('/business-profile', enriched);
        setProfile(prev => ({ ...prev, ...enriched }));
        toast.success(`Profile synced — ${fieldsUpdated} fields updated from calibration`);
        fetchProfile();
      } else {
        toast.info('Complete calibration first to populate your profile automatically.');
      }
    } catch (e) {
      toast.error('Sync failed — please try again');
    } finally { setSyncing(false); }
  };

  useEffect(() => {
    fetchProfile();
    fetchCalibrationStatus();
    fetchNotifications();
    fetchThresholds();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.created_at) {
        setMemberSince(new Date(data.user.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }));
      }
    }).catch(() => {});
    // Safety timeout: don't show loading forever
    const timeout = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timeout);
  }, []);

  const fetchCalibrationStatus = async () => {
    try {
      const res = await apiClient.get('/calibration/status');
      setCalibrationStatus(res.data?.status === 'COMPLETE' ? 'complete' : 'incomplete');
      // console.log('[Settings] Calibration status from DB:', res.data?.status);
    } catch (e) {
      console.error('[Settings] Failed to fetch calibration status:', e);
      setCalibrationStatus('error');
    }
  };

  // Fetch notification preferences from API
  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await apiClient.get('/settings/notifications');
      const data = res.data || {};
      setNotifications(prev => ({ ...prev, ...data }));
    } catch { /* use defaults */ }
    finally { setNotifLoading(false); }
  };

  const saveNotifications = async (updated) => {
    setNotifSaving(true);
    try {
      await apiClient.put('/settings/notifications', updated);
      setNotifications(updated);
      toast.success('Notification preferences saved');
    } catch { toast.error('Failed to save notifications'); }
    finally { setNotifSaving(false); }
  };

  const toggleNotification = (key) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    saveNotifications(updated);
  };

  // Fetch signal thresholds from API
  const fetchThresholds = async () => {
    setThreshLoading(true);
    try {
      const res = await apiClient.get('/settings/thresholds');
      const data = res.data || {};
      setThresholds(prev => ({ ...prev, ...data }));
    } catch { /* use defaults */ }
    finally { setThreshLoading(false); }
  };

  const saveThresholds = async () => {
    setThreshSaving(true);
    try {
      await apiClient.put('/settings/thresholds', thresholds);
      toast.success('Signal thresholds saved');
    } catch { toast.error('Failed to save thresholds'); }
    finally { setThreshSaving(false); }
  };

  const resetThresholdDefaults = () => {
    const defaults = {
      threshold_deal_stall_days: 14,
      threshold_cash_runway_months: 6,
      threshold_meeting_overload_pct: 60,
      threshold_churn_silence_days: 21,
      threshold_invoice_aging_pct: 15,
    };
    setThresholds(defaults);
    saveThresholds();
  };

  // Danger zone handlers
  const handleDisconnectAll = async () => {
    setDisconnecting(true);
    try {
      await apiClient.post('/user/disconnect-all');
      toast.success('All integrations disconnected');
    } catch { toast.error('Failed to disconnect integrations'); }
    finally { setDisconnecting(false); }
  };

  const handleExportData = async () => {
    // Sprint C #21 — sync download. Previously queued a background job whose
    // storage-upload step was broken, so users got a "download link shortly"
    // toast that never materialised. This now returns the JSON directly so
    // the user gets their data in the same click.
    setExporting(true);
    try {
      const res = await apiClient.get('/user/export/download-now', { responseType: 'blob' });
      // Derive filename from Content-Disposition if present
      const cd = res.headers?.['content-disposition'] || res.headers?.get?.('content-disposition') || '';
      const m = /filename="?([^";]+)"?/.exec(cd);
      const filename = m ? m[1] : `biqc_export_${new Date().toISOString().slice(0, 10)}.json`;

      // Trigger browser download
      const blob = res.data instanceof Blob ? res.data : new Blob([JSON.stringify(res.data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Your data has been downloaded');
    } catch (err) {
      console.error('[export] failed:', err);
      toast.error('Failed to export your data — try again in a moment');
    }
    finally { setExporting(false); }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await apiClient.delete('/user/account');
      toast.success('Account scheduled for deletion');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch { toast.error('Failed to delete account'); setDeleting(false); }
  };

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/business-profile/context');
      const ctx = response.data || {};
      const resolvedFields = ctx.resolved_fields || {};
      const rawProfile = ctx.profile || {};
      const merged = { ...rawProfile };
      for (const [field, factData] of Object.entries(resolvedFields)) {
        if (factData.value && !merged[field]) {
          merged[field] = factData.value;
        }
      }
      setProfile(merged);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await apiClient.put('/business-profile', profile);
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ padding: 'var(--sp-6, 24px) var(--sp-8, 32px)', maxWidth: '56rem', margin: '0 auto' }}>
          <PageSkeleton cards={2} lines={5} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ padding: 'var(--sp-6, 24px) var(--sp-8, 32px)' }}>
        <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: 'var(--sp-6, 24px)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--lava, #E85D00)', marginBottom: 4 }}>
              — Settings
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink-display, #0A0A0A)', marginBottom: 6 }}>
              Your <em style={{ fontStyle: 'italic', color: 'var(--lava, #E85D00)' }}>account</em>.
            </h1>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-secondary, #525252)' }}>
              Manage your account, preferences, and billing
            </p>
          </div>

          {/* Agent Calibration Status — reads from persona_calibration_status ONLY */}
          <Card style={{ ...settingsCardStyle, marginBottom: 'var(--sp-6, 24px)', padding: 'var(--sp-5, 20px) var(--sp-6, 24px)' }}>
            <CardContent style={{ padding: 0 }}>
              <div className="flex items-center justify-between" style={{ gap: 'var(--sp-4, 16px)' }}>
                <div className="flex items-center" style={{ gap: 'var(--sp-3, 12px)' }}>
                  <div className="shrink-0" style={{ width: 10, height: 10, borderRadius: '50%', background: calibrationStatus === 'complete' ? 'var(--positive, #16A34A)' : 'var(--danger, #DC2626)', animation: calibrationStatus !== 'complete' ? 'pulse 2s ease-in-out infinite' : 'none' }} />
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-display, #0A0A0A)' }}>Agent Calibration</h3>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)', marginTop: 2 }}>
                      {calibrationStatus === 'complete' ? 'Calibration complete — BIQC is personalised to your operating style' : 'Incomplete — BIQC needs calibration to advise effectively'}
                    </p>
                  </div>
                </div>
                {calibrationStatus === 'complete' ? (
                  <div className="flex" style={{ gap: 'var(--sp-2, 8px)' }}>
                    <Button size="sm" variant="outline" disabled={syncing} onClick={syncFromCalibration}
                      style={{ fontFamily: 'var(--font-ui)', fontSize: 13, borderColor: 'var(--border-strong, rgba(10,10,10,0.14))', borderRadius: 'var(--r-md, 8px)' }}>
                      {syncing ? <InlineLoading text="syncing" /> : <><RefreshCw className="w-3.5 h-3.5 mr-1" />Sync Profile</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resettingCalibration}
                      style={{ fontFamily: 'var(--font-ui)', fontSize: 13, borderColor: 'var(--border-strong, rgba(10,10,10,0.14))', borderRadius: 'var(--r-md, 8px)' }}
                      onClick={async () => {
                      setResettingCalibration(true);
                      try {
                        await apiClient.post('/calibration/reset');
                        toast.success('Calibration reset. Redirecting...');
                        setTimeout(() => { window.location.href = '/calibration'; }, 1000);
                      } catch (e) {
                        toast.error('Failed to reset calibration');
                        setResettingCalibration(false);
                      }
                    }}
                  >
                    {resettingCalibration ? <InlineLoading text="recalibrating" /> : 'Recalibrate'}
                  </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => navigate('/calibration')}
                    style={{ fontFamily: 'var(--font-ui)', fontSize: 13, background: 'var(--lava, #E85D00)', color: 'var(--ink-inverse, #fff)', borderRadius: 'var(--r-md, 8px)', border: 'none' }}>
                    Complete Calibration
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Settings Navigation — 200px left sidebar + 1fr content */}
          <style>{`
            .settings-layout { display: grid; grid-template-columns: 200px 1fr; gap: var(--sp-6, 24px); }
            @media (max-width: 900px) { .settings-layout { grid-template-columns: 1fr; } .settings-layout .settings-nav { flex-direction: row; flex-wrap: wrap; position: static; } }
          `}</style>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="settings-layout">
            {/* Settings Sidebar Nav */}
            <nav className="settings-nav" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1, 4px)', position: 'sticky', top: 'calc(60px + 16px)', alignSelf: 'start' }}>
              {[
                { value: 'account', label: 'Account', icon: <User size={14} /> },
                { value: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
                { value: 'signals', label: 'Signals', icon: <Activity size={14} /> },
                { value: 'billing', label: 'Plan & billing', icon: <CreditCard size={14} /> },
                { value: 'danger-zone', label: 'Danger zone', icon: <AlertTriangle size={14} /> },
              ].map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2, 8px)',
                    padding: '10px 14px',
                    borderRadius: 'var(--r-md, 8px)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'var(--font-ui)',
                    fontWeight: activeTab === value ? 500 : 400,
                    background: activeTab === value ? 'var(--lava-wash, #FFF1E6)' : 'transparent',
                    color: activeTab === value ? 'var(--lava, #E85D00)' : 'var(--ink-secondary, #525252)',
                    border: 'none',
                    textAlign: 'left',
                    transition: 'all 200ms ease',
                    textDecoration: 'none',
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </nav>
            {/* Settings Content */}
            <div className="min-w-0">
            <TabsList className="sr-only">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="signals">Signals</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="danger-zone">Danger</TabsTrigger>
            </TabsList>

            {/* ACCOUNT TAB */}
            <TabsContent value="account">
              <Card style={settingsCardStyle}>
                <CardHeader style={{ padding: 'var(--sp-6, 24px)', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--lava, #E85D00)', marginBottom: 4 }}>— Account</p>
                      <CardTitle style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-display, #0A0A0A)' }}>Profile</CardTitle>
                    </div>
                    <Button onClick={handleSaveProfile} size="sm" disabled={saving} className="flex items-center gap-2"
                      style={{ fontFamily: 'var(--font-ui)', fontSize: 13, background: 'var(--lava, #E85D00)', color: 'var(--ink-inverse, #fff)', borderRadius: 'var(--r-md, 8px)', border: 'none' }}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save changes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent style={{ padding: 'var(--sp-6, 24px)' }}>
                  <div>
                    {/* Full name */}
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--sp-4, 16px)', padding: 'var(--sp-4, 16px) 0', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))', alignItems: 'start' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink-display, #0A0A0A)', paddingTop: 10 }}>Full name</p>
                      </div>
                      <Input
                        value={accountData.name}
                        onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                        style={{ fontFamily: 'var(--font-ui)', fontSize: 14, background: 'var(--surface, #fff)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink, #171717)' }}
                      />
                    </div>

                    {/* Email */}
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--sp-4, 16px)', padding: 'var(--sp-4, 16px) 0', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))', alignItems: 'start' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink-display, #0A0A0A)', paddingTop: 10 }}>Email</p>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)', fontWeight: 400, marginTop: 2 }}>Used for login + alerts</p>
                      </div>
                      <Input
                        value={accountData.email}
                        disabled
                        style={{ fontFamily: 'var(--font-ui)', fontSize: 14, background: 'var(--surface-sunken, #F5F5F5)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink-muted, #737373)', cursor: 'not-allowed' }}
                      />
                    </div>

                    {/* Company */}
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--sp-4, 16px)', padding: 'var(--sp-4, 16px) 0', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))', alignItems: 'start' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink-display, #0A0A0A)', paddingTop: 10 }}>Company</p>
                      </div>
                      <Input
                        value={accountData.company}
                        onChange={(e) => setAccountData({ ...accountData, company: e.target.value })}
                        placeholder="Your company name"
                        style={{ fontFamily: 'var(--font-ui)', fontSize: 14, background: 'var(--surface, #fff)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink, #171717)' }}
                      />
                    </div>

                    {/* Timezone */}
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--sp-4, 16px)', padding: 'var(--sp-4, 16px) 0', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))', alignItems: 'start' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink-display, #0A0A0A)', paddingTop: 10 }}>Timezone</p>
                      </div>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger data-testid="settings-select-timezone" style={{ fontFamily: 'var(--font-ui)', fontSize: 14, background: 'var(--surface, #fff)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink, #171717)' }}>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Australia/Sydney">Australia/Sydney (AEST UTC+10)</SelectItem>
                          <SelectItem value="Australia/Melbourne">Australia/Melbourne</SelectItem>
                          <SelectItem value="Australia/Brisbane">Australia/Brisbane</SelectItem>
                          <SelectItem value="Australia/Perth">Australia/Perth</SelectItem>
                          <SelectItem value="Australia/Adelaide">Australia/Adelaide</SelectItem>
                          <SelectItem value="Australia/Hobart">Australia/Hobart</SelectItem>
                          <SelectItem value="Australia/Darwin">Australia/Darwin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Password */}
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--sp-4, 16px)', padding: 'var(--sp-4, 16px) 0', alignItems: 'start' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink-display, #0A0A0A)', paddingTop: 10 }}>Password</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <Input
                            type="password"
                            value="••••••••••"
                            disabled
                            className="flex-1"
                            style={{ fontFamily: 'var(--font-ui)', fontSize: 14, background: 'var(--surface-sunken, #F5F5F5)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink-muted, #737373)', cursor: 'not-allowed' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowPasswordChange(true);
                              supabase.auth.resetPasswordForEmail(user?.email, {
                                redirectTo: `${window.location.origin}/settings`,
                              }).then(() => {
                                toast.success('Password reset email sent. Check your inbox.');
                              }).catch(() => {
                                toast.error('Failed to send password reset email');
                              });
                            }}
                            style={{ fontFamily: 'var(--font-ui)', fontSize: 13, borderColor: 'var(--lava, #E85D00)', color: 'var(--lava, #E85D00)', whiteSpace: 'nowrap', borderRadius: 'var(--r-md, 8px)' }}
                          >
                            Change
                          </Button>
                        </div>
                        {showPasswordChange && (
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)', marginTop: 6 }}>
                            A password reset link has been sent to your email address.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* NOTIFICATIONS TAB — 6 toggles matching mockup */}
            <TabsContent value="notifications">
              <Card style={settingsCardStyle}>
                <CardHeader style={{ padding: 'var(--sp-6, 24px)', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--lava, #E85D00)', marginBottom: 4 }}>— Notifications</p>
                      <CardTitle style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-display, #0A0A0A)' }}>When should BIQc nudge you?</CardTitle>
                    </div>
                    {notifSaving && <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--lava, #E85D00)' }} />}
                  </div>
                </CardHeader>
                <CardContent style={{ padding: 'var(--sp-6, 24px)' }}>
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--ink-muted, #737373)' }} /></div>
                  ) : (
                    <div>
                      {[
                        { key: 'notify_morning_brief', label: 'Morning brief email', hint: 'Daily digest at 7:30am AEST with the top 3 things to know' },
                        { key: 'notify_critical_alerts', label: 'Critical alerts (push)', hint: 'Immediate notification for critical-severity signals' },
                        { key: 'notify_high_alerts', label: 'High alerts (push)', hint: 'Same-day notification for high-severity signals' },
                        { key: 'notify_weekly_report', label: 'Weekly report email', hint: 'Summary of all signals, actions, and pipeline changes — sent Mondays' },
                        { key: 'notify_nudges', label: 'BIQc nudges (in-app)', hint: 'Proactive suggestions like "decline 3 meetings" or "follow up on Bramwell"' },
                        { key: 'notify_marketing', label: 'Marketing emails', hint: 'Product updates, tips, and feature announcements' },
                      ].map(({ key, label, hint }, i, arr) => (
                        <div key={key} className="flex items-center justify-between" style={{ padding: 'var(--sp-3, 12px) 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border, rgba(10,10,10,0.08))' : 'none' }}>
                          <div style={{ paddingRight: 'var(--sp-4, 16px)' }}>
                            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink, #171717)' }}>{label}</p>
                            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)', marginTop: 2 }}>{hint}</p>
                          </div>
                          <Switch
                            checked={!!notifications[key]}
                            onCheckedChange={() => toggleNotification(key)}
                            disabled={notifSaving}
                            className="data-[state=checked]:bg-[var(--lava)]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SIGNALS TAB — 5 threshold selects matching mockup */}
            <TabsContent value="signals">
              <Card style={settingsCardStyle}>
                <CardHeader style={{ padding: 'var(--sp-6, 24px)', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--lava, #E85D00)', marginBottom: 4 }}>— Signals</p>
                      <CardTitle style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-display, #0A0A0A)' }}>Alert thresholds</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetThresholdDefaults} disabled={threshSaving}
                      style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-secondary, #525252)', borderRadius: 'var(--r-md, 8px)' }}>
                      Reset defaults
                    </Button>
                  </div>
                </CardHeader>
                <CardContent style={{ padding: 'var(--sp-6, 24px)' }}>
                  {threshLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--ink-muted, #737373)' }} /></div>
                  ) : (
                    <div>
                      {[
                        { label: 'Deal stall threshold', hint: 'Days of silence before alert', key: 'threshold_deal_stall_days', options: [{ v: '7', l: '7 days' }, { v: '10', l: '10 days' }, { v: '14', l: '14 days' }, { v: '21', l: '21 days' }, { v: '30', l: '30 days' }] },
                        { label: 'Cash runway alert', hint: 'Months remaining', key: 'threshold_cash_runway_months', options: [{ v: '3', l: '3 months' }, { v: '6', l: '6 months' }, { v: '9', l: '9 months' }, { v: '12', l: '12 months' }] },
                        { label: 'Meeting overload', hint: '% above baseline', key: 'threshold_meeting_overload_pct', options: [{ v: '40', l: '40% above avg' }, { v: '60', l: '60% above avg' }, { v: '80', l: '80% above avg' }, { v: '100', l: '100% above avg' }] },
                        { label: 'Churn risk silence', hint: 'Days before flagging', key: 'threshold_churn_silence_days', options: [{ v: '14', l: '14 days' }, { v: '21', l: '21 days' }, { v: '30', l: '30 days' }, { v: '45', l: '45 days' }] },
                        { label: 'Invoice aging spike', hint: '% of AR over 60 days', key: 'threshold_invoice_aging_pct', options: [{ v: '10', l: '10% of AR' }, { v: '15', l: '15% of AR' }, { v: '20', l: '20% of AR' }, { v: '25', l: '25% of AR' }] },
                      ].map(({ label, hint, key, options }, i, arr) => (
                        <div key={key} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--sp-4, 16px)', padding: 'var(--sp-4, 16px) 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border, rgba(10,10,10,0.08))' : 'none', alignItems: 'start' }}>
                          <div>
                            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink-display, #0A0A0A)' }}>{label}</p>
                            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)', marginTop: 2 }}>{hint}</p>
                          </div>
                          <Select value={String(thresholds[key])} onValueChange={(v) => setThresholds(p => ({ ...p, [key]: Number(v) }))}>
                            <SelectTrigger style={{ fontFamily: 'var(--font-ui)', fontSize: 14, background: 'var(--surface, #fff)', border: '1px solid var(--border, rgba(10,10,10,0.08))', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink, #171717)' }}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end" style={{ paddingTop: 'var(--sp-4, 16px)' }}>
                    <Button onClick={saveThresholds} disabled={threshSaving}
                      style={{ fontFamily: 'var(--font-ui)', fontSize: 13, background: 'var(--lava, #E85D00)', color: 'var(--ink-inverse, #fff)', borderRadius: 'var(--r-md, 8px)', border: 'none' }}>
                      {threshSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save thresholds
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* BILLING TAB — Plan & billing (mockup position: 4th) */}
            <TabsContent value="billing">
              <Card style={settingsCardStyle}>
                <CardHeader style={{ padding: 'var(--sp-6, 24px)', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--lava, #E85D00)', marginBottom: 4 }}>— Plan & billing</p>
                    <CardTitle style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-display, #0A0A0A)' }}>Your subscription</CardTitle>
                  </div>
                </CardHeader>
                <CardContent style={{ padding: 'var(--sp-6, 24px)' }}>
                  <SettingsBillingContent navigate={navigate} user={user} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* DANGER ZONE TAB — 3 irreversible actions (mockup position: 5th) */}
            <TabsContent value="danger-zone">
              <Card style={{ ...settingsCardStyle, borderColor: 'rgba(220,38,38,0.3)' }}>
                <CardHeader style={{ padding: 'var(--sp-6, 24px)', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--danger, #DC2626)', marginBottom: 4 }}>— Danger zone</p>
                    <CardTitle style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--danger, #DC2626)' }}>Irreversible actions</CardTitle>
                  </div>
                </CardHeader>
                <CardContent style={{ padding: 'var(--sp-6, 24px)' }}>
                  <div>
                    {/* Disconnect all integrations */}
                    <div className="flex items-center justify-between" style={{ padding: 'var(--sp-4, 16px) 0', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))', gap: 'var(--sp-4, 16px)' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink, #171717)' }}>Disconnect all integrations</p>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)', marginTop: 2 }}>
                          Removes all OAuth tokens and Merge.dev connections. You'll need to re-authorize each tool.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disconnecting}
                        onClick={handleDisconnectAll}
                        style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--danger, #DC2626)', borderColor: 'rgba(220,38,38,0.3)', borderRadius: 'var(--r-md, 8px)', whiteSpace: 'nowrap' }}
                      >
                        {disconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Unplug className="w-4 h-4 mr-1" />}
                        Disconnect all
                      </Button>
                    </div>

                    {/* Export all data */}
                    <div className="flex items-center justify-between" style={{ padding: 'var(--sp-4, 16px) 0', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))', gap: 'var(--sp-4, 16px)' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink, #171717)' }}>Export all data</p>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)', marginTop: 2 }}>
                          Download a ZIP of your signals, alerts, actions, and profile as JSON. Takes ~30 seconds.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={exporting}
                        onClick={handleExportData}
                        style={{ fontFamily: 'var(--font-ui)', fontSize: 13, borderColor: 'var(--border-strong, rgba(10,10,10,0.14))', borderRadius: 'var(--r-md, 8px)', whiteSpace: 'nowrap' }}
                      >
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
                        Export
                      </Button>
                    </div>

                    {/* Delete account */}
                    <div className="flex items-center justify-between" style={{ padding: 'var(--sp-4, 16px) 0', gap: 'var(--sp-4, 16px)' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink, #171717)' }}>Delete account</p>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-muted, #737373)', marginTop: 2 }}>
                          Permanently deletes your account, all data, all integrations, and all history. This cannot be undone.
                        </p>
                      </div>
                      {deleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--danger, #DC2626)' }}>Are you sure?</span>
                          <Button size="sm" disabled={deleting} onClick={handleDeleteAccount}
                            style={{ fontFamily: 'var(--font-ui)', fontSize: 13, background: 'var(--danger, #DC2626)', color: 'var(--ink-inverse, #fff)', borderRadius: 'var(--r-md, 8px)', border: 'none' }}>
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, delete'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(false)}
                            style={{ fontFamily: 'var(--font-ui)', fontSize: 13, borderRadius: 'var(--r-md, 8px)' }}>Cancel</Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm(true)}
                          style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--danger, #DC2626)', borderColor: 'rgba(220,38,38,0.3)', borderRadius: 'var(--r-md, 8px)', whiteSpace: 'nowrap' }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete account
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>{/* end settings content */}
          </div>{/* end settings grid */}
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
