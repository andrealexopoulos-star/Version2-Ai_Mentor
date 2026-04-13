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
import { fontFamily } from '../design-system/tokens';
import { PageSkeleton } from '../components/ui/skeleton-loader';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
const sectionResizeStyle = { resize: 'horizontal', overflow: 'auto', minWidth: '320px', maxWidth: '100%' };
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

const SettingsBillingContent = ({ navigate, user }) => {
  const [overview, setOverview] = useState(null);
  const [loading, setBillingLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/billing/overview')
      .then(res => setOverview(res.data))
      .catch(() => setOverview(null))
      .finally(() => setBillingLoading(false));
  }, []);

  const rawTier = String(user?.subscription_tier || 'free').toLowerCase();
  const onTrial = (() => {
    if (!user?.trial_expires_at) return false;
    return new Date(user.trial_expires_at) > new Date();
  })();
  const displayName = onTrial ? 'Free Trial (Professional)' : (TIER_DISPLAY[rawTier] || 'Free');
  const isPaid = !['free', 'trial', ''].includes(rawTier) && !onTrial;

  const money = (v, cur = 'AUD') =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur.toUpperCase() }).format(Number(v || 0));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-5" style={{ borderColor: 'rgba(232,93,0,0.3)', background: 'rgba(232,93,0,0.05)' }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#E85D00' }}>Current Plan</p>
            <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
          </div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} /> Active
          </div>
        </div>
        {isPaid ? (
          <Button onClick={() => navigate('/billing')} className="btn-primary" style={{ background: '#E85D00', color: 'white' }}>
            Open Billing Centre
          </Button>
        ) : (
          <div className="space-y-3">
            {onTrial && (
              <p className="text-sm" style={{ color: '#F59E0B' }}>
                Your trial expires {new Date(user.trial_expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}. Upgrade to keep access.
              </p>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => navigate('/subscribe')} className="btn-primary" style={{ background: '#E85D00', color: 'white' }}>
                {onTrial ? 'Upgrade Before Trial Ends' : 'View Plans & Upgrade'}
              </Button>
              <Button variant="outline" onClick={() => { window.location.href = 'mailto:billing@biqc.com.au'; }}>Contact Billing</Button>
            </div>
          </div>
        )}
      </div>

      {isPaid && !loading && overview && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Charges paid</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {money(overview.charges_summary?.total_paid, overview.charges_summary?.currency)}
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Supplier outstanding</p>
            <p className="text-xl font-semibold" style={{ color: overview.supplier_summary?.total_overdue_supplier > 0 ? '#EF4444' : 'var(--text-primary)' }}>
              {money(overview.supplier_summary?.total_outstanding_supplier, overview.charges_summary?.currency)}
            </p>
          </div>
        </div>
      )}

      {/* Payment Method */}
      <div className="rounded-xl border p-5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
        <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: '#94A3B8', fontFamily: 'var(--font-mono, monospace)' }}>Payment Method</p>
        {overview?.billing_connectors?.stripe_connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5" style={{ color: '#E85D00' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Card on file</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Managed through Stripe</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/billing')} style={{ borderColor: '#E85D00', color: '#E85D00' }}>
              Manage
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No card on file</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/billing')}
              className="flex items-center gap-2"
              style={{ borderColor: '#E85D00', color: '#E85D00' }}
            >
              <Plus className="w-4 h-4" />
              Add card
            </Button>
          </div>
        )}
      </div>

      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Billing questions? <a href="mailto:billing@biqc.com.au" style={{ color: '#E85D00' }}>billing@biqc.com.au</a>
      </p>
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
    setExporting(true);
    try {
      await apiClient.post('/user/export');
      toast.success('Data export started — you\'ll receive a download link shortly');
    } catch { toast.error('Failed to start data export'); }
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
        <div className="p-8 max-w-4xl mx-auto">
          <PageSkeleton cards={2} lines={5} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
              — Settings
            </div>
            <h1 className="font-medium mb-2" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              Your <em style={{ fontStyle: 'italic', color: '#E85D00' }}>account</em>.
            </h1>
            <p className="text-sm" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
              Manage your account, preferences, and billing
            </p>
          </div>

          {/* Agent Calibration Status — reads from persona_calibration_status ONLY */}
          <Card className="mb-6" style={sectionResizeStyle}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${calibrationStatus === 'complete' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Agent Calibration</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {calibrationStatus === 'complete' ? 'Calibration complete — BIQC is personalised to your operating style' : 'Incomplete — BIQC needs calibration to advise effectively'}
                    </p>
                  </div>
                </div>
                {calibrationStatus === 'complete' ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={syncing} onClick={syncFromCalibration}>
                      {syncing ? <InlineLoading text="syncing" /> : <><RefreshCw className="w-3.5 h-3.5 mr-1" />Sync Profile</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resettingCalibration}
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
                  <Button size="sm" className="btn-primary" onClick={() => navigate('/calibration')}>
                    Complete Calibration
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Settings Navigation — 200px left sidebar + 1fr content */}
          <style>{`.settings-layout { display: grid; grid-template-columns: 200px 1fr; gap: 32px; } @media (max-width: 900px) { .settings-layout { grid-template-columns: 1fr; } .settings-layout .settings-nav { flex-direction: row; flex-wrap: wrap; position: static; } }`}</style>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="settings-layout">
            {/* Settings Sidebar Nav */}
            <nav className="settings-nav flex flex-col gap-1 sticky" style={{ top: 'calc(60px + 16px)', alignSelf: 'start' }}>
              {[
                { value: 'account', label: 'Account' },
                { value: 'notifications', label: 'Notifications' },
                { value: 'signals', label: 'Signals' },
                { value: 'billing', label: 'Plan & billing' },
                { value: 'danger-zone', label: 'Danger zone' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className="text-left transition-all"
                  style={{
                    padding: '10px 16px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontFamily: fontFamily.body,
                    fontWeight: activeTab === value ? 500 : 400,
                    background: activeTab === value ? 'var(--surface-sunken, #060A12)' : 'transparent',
                    color: activeTab === value ? '#EDF1F7' : '#8FA0B8',
                    borderLeft: activeTab === value ? '2px solid #E85D00' : '2px solid transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
            {/* Settings Content */}
            <div className="min-w-0">
            <TabsList className="hidden">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="signals">Signals</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="danger-zone">Danger</TabsTrigger>
            </TabsList>

            {/* ACCOUNT TAB */}
            <TabsContent value="account">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--lava, #E85D00)', fontFamily: 'var(--font-mono, monospace)' }}>— Account</p>
                      <CardTitle>Profile</CardTitle>
                    </div>
                    <Button onClick={handleSaveProfile} size="sm" disabled={saving} className="flex items-center gap-2" style={{ background: 'var(--lava, #E85D00)', color: '#fff' }}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save changes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y" style={{ borderColor: 'var(--border, rgba(140,170,210,0.12))' }}>
                    {/* Full name */}
                    <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start">
                      <div>
                        <p className="text-sm font-medium pt-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Full name</p>
                      </div>
                      <Input
                        value={accountData.name}
                        onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                      />
                    </div>

                    {/* Email */}
                    <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start">
                      <div>
                        <p className="text-sm font-medium pt-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Email</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>Used for login + alerts</p>
                      </div>
                      <Input
                        value={accountData.email}
                        disabled
                        style={{ background: 'var(--biqc-bg-card)' }}
                      />
                    </div>

                    {/* Company */}
                    <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start">
                      <div>
                        <p className="text-sm font-medium pt-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Company</p>
                      </div>
                      <Input
                        value={accountData.company}
                        onChange={(e) => setAccountData({ ...accountData, company: e.target.value })}
                        placeholder="Your company name"
                      />
                    </div>

                    {/* Timezone */}
                    <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start">
                      <div>
                        <p className="text-sm font-medium pt-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Timezone</p>
                      </div>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger data-testid="settings-select-timezone">
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
                    <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start" style={{ borderBottom: 0 }}>
                      <div>
                        <p className="text-sm font-medium pt-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Password</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <Input
                            type="password"
                            value="••••••••••"
                            disabled
                            className="flex-1"
                            style={{ background: 'var(--biqc-bg-card)' }}
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
                            style={{ borderColor: '#E85D00', color: '#E85D00', whiteSpace: 'nowrap' }}
                          >
                            Change
                          </Button>
                        </div>
                        {showPasswordChange && (
                          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
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
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--lava, #E85D00)', fontFamily: 'var(--font-mono, monospace)' }}>— Notifications</p>
                      <CardTitle>When should BIQc nudge you?</CardTitle>
                    </div>
                    {notifSaving && <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--lava, #E85D00)' }} />}
                  </div>
                </CardHeader>
                <CardContent>
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--ink-muted)' }} /></div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--border, rgba(140,170,210,0.12))' }}>
                      {[
                        { key: 'notify_morning_brief', label: 'Morning brief email', hint: 'Daily digest at 7:30am AEST with the top 3 things to know' },
                        { key: 'notify_critical_alerts', label: 'Critical alerts (push)', hint: 'Immediate notification for critical-severity signals' },
                        { key: 'notify_high_alerts', label: 'High alerts (push)', hint: 'Same-day notification for high-severity signals' },
                        { key: 'notify_weekly_report', label: 'Weekly report email', hint: 'Summary of all signals, actions, and pipeline changes — sent Mondays' },
                        { key: 'notify_nudges', label: 'BIQc nudges (in-app)', hint: 'Proactive suggestions like "decline 3 meetings" or "follow up on Bramwell"' },
                        { key: 'notify_marketing', label: 'Marketing emails', hint: 'Product updates, tips, and feature announcements' },
                      ].map(({ key, label, hint }) => (
                        <div key={key} className="flex items-center justify-between py-4">
                          <div className="pr-4">
                            <p className="text-sm font-medium" style={{ color: 'var(--ink, #C8D4E4)' }}>{label}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>{hint}</p>
                          </div>
                          <Switch
                            checked={!!notifications[key]}
                            onCheckedChange={() => toggleNotification(key)}
                            disabled={notifSaving}
                            className="data-[state=checked]:bg-[#E85D00]"
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
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--lava, #E85D00)', fontFamily: 'var(--font-mono, monospace)' }}>— Signals</p>
                      <CardTitle>Alert thresholds</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetThresholdDefaults} disabled={threshSaving}>
                      Reset defaults
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {threshLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--ink-muted)' }} /></div>
                  ) : (
                    <div className="space-y-0 divide-y" style={{ borderColor: 'var(--border, rgba(140,170,210,0.12))' }}>
                      <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Deal stall threshold</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>Days of silence before alert</p>
                        </div>
                        <Select value={String(thresholds.threshold_deal_stall_days)} onValueChange={(v) => setThresholds(p => ({ ...p, threshold_deal_stall_days: Number(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="10">10 days</SelectItem>
                            <SelectItem value="14">14 days</SelectItem>
                            <SelectItem value="21">21 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Cash runway alert</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>Months remaining</p>
                        </div>
                        <Select value={String(thresholds.threshold_cash_runway_months)} onValueChange={(v) => setThresholds(p => ({ ...p, threshold_cash_runway_months: Number(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 months</SelectItem>
                            <SelectItem value="6">6 months</SelectItem>
                            <SelectItem value="9">9 months</SelectItem>
                            <SelectItem value="12">12 months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Meeting overload</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>% above baseline</p>
                        </div>
                        <Select value={String(thresholds.threshold_meeting_overload_pct)} onValueChange={(v) => setThresholds(p => ({ ...p, threshold_meeting_overload_pct: Number(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="40">40% above avg</SelectItem>
                            <SelectItem value="60">60% above avg</SelectItem>
                            <SelectItem value="80">80% above avg</SelectItem>
                            <SelectItem value="100">100% above avg</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Churn risk silence</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>Days before flagging</p>
                        </div>
                        <Select value={String(thresholds.threshold_churn_silence_days)} onValueChange={(v) => setThresholds(p => ({ ...p, threshold_churn_silence_days: Number(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="14">14 days</SelectItem>
                            <SelectItem value="21">21 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="45">45 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[200px_1fr] gap-4 py-4 items-start">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Invoice aging spike</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>% of AR over 60 days</p>
                        </div>
                        <Select value={String(thresholds.threshold_invoice_aging_pct)} onValueChange={(v) => setThresholds(p => ({ ...p, threshold_invoice_aging_pct: Number(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10% of AR</SelectItem>
                            <SelectItem value="15">15% of AR</SelectItem>
                            <SelectItem value="20">20% of AR</SelectItem>
                            <SelectItem value="25">25% of AR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end pt-4">
                    <Button onClick={saveThresholds} disabled={threshSaving} style={{ background: 'var(--lava, #E85D00)', color: '#fff' }}>
                      {threshSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save thresholds
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* BILLING TAB — Plan & billing (mockup position: 4th) */}
            <TabsContent value="billing">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--lava, #E85D00)', fontFamily: 'var(--font-mono, monospace)' }}>— Plan & billing</p>
                    <CardTitle>Your subscription</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <SettingsBillingContent navigate={navigate} user={user} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* DANGER ZONE TAB — 3 irreversible actions (mockup position: 5th) */}
            <TabsContent value="danger-zone">
              <Card style={{ ...sectionResizeStyle, borderColor: 'rgba(220,38,38,0.3)' }}>
                <CardHeader>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#DC2626', fontFamily: 'var(--font-mono, monospace)' }}>— Danger zone</p>
                    <CardTitle style={{ color: '#DC2626' }}>Irreversible actions</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y" style={{ borderColor: 'var(--border, rgba(140,170,210,0.12))' }}>
                    {/* Disconnect all integrations */}
                    <div className="flex items-center justify-between py-4 gap-4">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ink, #C8D4E4)' }}>Disconnect all integrations</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>
                          Removes all OAuth tokens and Merge.dev connections. You'll need to re-authorize each tool.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disconnecting}
                        onClick={handleDisconnectAll}
                        style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.3)' }}
                      >
                        {disconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Unplug className="w-4 h-4 mr-1" />}
                        Disconnect all
                      </Button>
                    </div>

                    {/* Export all data */}
                    <div className="flex items-center justify-between py-4 gap-4">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ink, #C8D4E4)' }}>Export all data</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>
                          Download a ZIP of your signals, alerts, actions, and profile as JSON. Takes ~30 seconds.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={exporting}
                        onClick={handleExportData}
                      >
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
                        Export
                      </Button>
                    </div>

                    {/* Delete account */}
                    <div className="flex items-center justify-between py-4 gap-4">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ink, #C8D4E4)' }}>Delete account</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>
                          Permanently deletes your account, all data, all integrations, and all history. This cannot be undone.
                        </p>
                      </div>
                      {deleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: '#DC2626' }}>Are you sure?</span>
                          <Button size="sm" disabled={deleting} onClick={handleDeleteAccount}
                            style={{ background: '#DC2626', color: '#fff' }}>
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, delete'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm(true)}
                          style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.3)' }}
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
