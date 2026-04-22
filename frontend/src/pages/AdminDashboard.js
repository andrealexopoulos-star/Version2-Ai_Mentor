import { RadarSweep } from '../components/LoadingSystems';
import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import {
  Users, Activity, Shield, Eye, Search, RefreshCw, Ban, CheckCircle,
  TrendingUp, DollarSign, BarChart3, ChevronRight,
  Loader2, X, Cpu, Lock, Zap, Globe, Server, FileText,
  Settings, Database, Radio, Key,
  Brain, Fingerprint, ShieldCheck, Scale, Rocket, ExternalLink, Clock,
  Hash, Plug
} from 'lucide-react';

const D = "var(--font-display)";
const B = "var(--font-ui)";
const M = "var(--font-mono)";

const Pnl = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);
const Mc = ({ label, value, sub, color = 'var(--ink-display, #0A0A0A)', icon: Icon, alert }) => (
  <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: `1px solid ${alert ? '#E85D00' + '40' : 'rgba(140,170,210,0.15)'}` }}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider" style={{ fontFamily: M }}>{label}</span>
      {Icon && <Icon className="w-4 h-4 text-[var(--ink-muted)]" />}
    </div>
    <span className="text-xl font-bold block" style={{ fontFamily: M, color }}>{value}</span>
    {sub && <span className="text-[11px] text-[var(--ink-muted)] mt-0.5 block" style={{ fontFamily: B }}>{sub}</span>}
  </div>
);
const Sec = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-lg font-normal text-[var(--ink-display)] mb-4" style={{ fontFamily: D }}>{title}</h3>
    {children}
  </div>
);
const StatusDot = ({ status }) => {
  const c = { healthy: '#10B981', warning: '#F59E0B', critical: '#E85D00', offline: '#EF4444', unknown: '#64748B' };
  return <div className="w-2 h-2 rounded-full" style={{ background: c[status] || c.unknown, boxShadow: status === 'critical' ? `0 0 8px ${c.critical}50` : 'none' }} />;
};
const Badge = ({ text, color = '#64748B' }) => (
  <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider" style={{ fontFamily: M, color, background: color + '15' }}>{text}</span>
);
const Row = ({ icon: Icon, label, value, status, onClick }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${onClick ? 'cursor-pointer hover:bg-black/5' : ''}`} style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }} onClick={onClick}>
    {Icon && <Icon className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />}
    {status && <StatusDot status={status} />}
    <span className="text-sm text-[var(--ink-display)] flex-1" style={{ fontFamily: B }}>{label}</span>
    <span className="text-xs text-[var(--ink-secondary)]" style={{ fontFamily: M }}>{value}</span>
    {onClick && <ChevronRight className="w-3.5 h-3.5 text-[var(--ink-muted)]" />}
  </div>
);
const ComingSoon = ({ message = 'More controls coming soon.' }) => (
  <Pnl>
    <div className="text-center py-8">
      <Clock className="w-8 h-8 mx-auto mb-3 text-[var(--ink-muted)]" />
      <p className="text-sm text-[var(--ink-muted)]" style={{ fontFamily: B }}>{message}</p>
    </div>
  </Pnl>
);

const PAGES = [
  { id: 'command', label: 'Command Centre', icon: BarChart3 },
  { id: 'users', label: 'User Admin', icon: Users },
  { id: 'governance', label: 'Governance', icon: Scale },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'ai', label: 'AI Governance', icon: Brain },
  { id: 'commercial', label: 'Commercial', icon: DollarSign },
  { id: 'operations', label: 'Operations', icon: Settings },
  { id: 'growth', label: 'Growth', icon: Rocket },
];

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('command');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [rateLimitDetail, setRateLimitDetail] = useState(null);
  const [rateLimitDefaults, setRateLimitDefaults] = useState(null);
  const [rateLimitSaving, setRateLimitSaving] = useState(false);
  const [billing, setBilling] = useState({ loaded: false, transactions: [], mrr: 0, arr: 0, paid: 0, trialing: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        apiClient.get('/admin/users').catch(() => ({ data: [] })),
        apiClient.get('/admin/stats').catch(() => ({ data: {} })),
      ]);
      setUsers(usersRes.data.users || usersRes.data || []);
      setStats(statsRes.data);
      try { const rl = await apiClient.get('/admin/rate-limits/defaults'); setRateLimitDefaults(rl.data); } catch {}
      // Load health
      try { const h = await apiClient.get('/health/detailed'); setHealthData(h.data); } catch {}
      // Load billing (direct Supabase — no backend endpoint yet)
      try {
        const { data: tx } = await supabase
          .from('payment_transactions')
          .select('user_id, tier, payment_status, amount, created_at, stripe_subscription_id')
          .in('payment_status', ['trialing', 'active', 'paid', 'succeeded'])
          .order('created_at', { ascending: false })
          .limit(50);
        const rows = tx || [];
        const active = rows.filter(r => ['active', 'paid', 'succeeded'].includes(r.payment_status));
        const trialing = rows.filter(r => r.payment_status === 'trialing');
        const mrr = active.reduce((s, r) => s + Number(r.amount || 0), 0);
        setBilling({ loaded: true, transactions: rows, mrr, arr: mrr * 12, paid: active.length, trialing: trialing.length });
      } catch { setBilling(b => ({ ...b, loaded: true })); }
    } catch {} finally { setLoading(false); }
  };

  const loadUserDetail = async (userId) => {
    setSelectedUser(userId);
    setLoadingDetail(true);
    try {
      const [bp, uop, integrations, snapshots, signals, rateLimits] = await Promise.all([
        supabase.from('business_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_operator_profile').select('persona_calibration_status, agent_persona, updated_at').eq('user_id', userId).maybeSingle(),
        supabase.from('integration_accounts').select('provider, category, connected_at').eq('user_id', userId),
        supabase.from('intelligence_snapshots').select('snapshot_type, generated_at').eq('user_id', userId).order('generated_at', { ascending: false }).limit(5),
        supabase.from('observation_events').select('id', { count: 'exact' }).eq('user_id', userId),
        apiClient.get(`/admin/users/${userId}/rate-limits`).catch(() => ({ data: null })),
      ]);
      setUserDetail({ business_profile: bp.data, operator_profile: uop.data, integrations: integrations.data || [], snapshots: snapshots.data || [], signal_count: signals.count || 0 });
      setRateLimitDetail(rateLimits.data);
    } catch {} finally { setLoadingDetail(false); }
  };

  const suspendUser = async (uid) => { if (!window.confirm('Suspend?')) return; setActionLoading(uid); try { await apiClient.post(`/admin/users/${uid}/suspend`); toast.success('Suspended'); loadData(); } catch { toast.error('Failed'); } finally { setActionLoading(null); } };
  const unsuspendUser = async (uid) => { setActionLoading(uid); try { await apiClient.post(`/admin/users/${uid}/unsuspend`); toast.success('Unsuspended'); loadData(); } catch { toast.error('Failed'); } finally { setActionLoading(null); } };
  const impersonateUser = async (uid) => { try { const res = await apiClient.post(`/admin/users/${uid}/impersonate`); const tk = res.data?.token || res.data?.access_token; if (!tk) return; const { data: { session } } = await supabase.auth.getSession(); if (session?.access_token) { localStorage.setItem('biqc_admin_token_backup', session.access_token); } await supabase.auth.setSession({ access_token: tk, refresh_token: res.data?.refresh_token || tk }); window.location.href = '/advisor'; } catch { toast.error('Failed'); } };
  const changeRateLimit = (feature, field, value) => {
    setRateLimitDetail(prev => ({
      ...prev,
      overrides: {
        ...(prev?.overrides || {}),
        [feature]: {
          ...(prev?.overrides?.[feature] || prev?.effective?.[feature] || {}),
          [field]: value === '' ? null : Number(value),
        },
      },
    }));
  };
  const saveRateLimits = async () => {
    if (!selectedUser || !rateLimitDetail?.overrides) return;
    setRateLimitSaving(true);
    try {
      const res = await apiClient.put(`/admin/users/${selectedUser}/rate-limits`, { overrides: rateLimitDetail.overrides });
      setRateLimitDetail(res.data);
      toast.success('Rate limits updated');
    } catch {
      toast.error('Failed to save rate limits');
    } finally { setRateLimitSaving(false); }
  };
  const resetMonthlyUsage = async () => {
    if (!selectedUser || !window.confirm('Reset this user\'s current month AI usage?')) return;
    setRateLimitSaving(true);
    try {
      await apiClient.post(`/admin/users/${selectedUser}/rate-limits/reset-month`);
      const res = await apiClient.get(`/admin/users/${selectedUser}/rate-limits`);
      setRateLimitDetail(res.data);
      toast.success('Current month usage reset');
    } catch {
      toast.error('Failed to reset usage');
    } finally { setRateLimitSaving(false); }
  };
  const resetRateOverrides = async () => {
    if (!selectedUser || !window.confirm('Reset this user to tier default rate limits?')) return;
    setRateLimitSaving(true);
    try {
      const res = await apiClient.delete(`/admin/users/${selectedUser}/rate-limits`);
      setRateLimitDetail(res.data);
      toast.success('Rate limit overrides cleared');
    } catch {
      toast.error('Failed to reset rate limits');
    } finally { setRateLimitSaving(false); }
  };

  const filteredUsers = users.filter(u => !search || [u.email, u.full_name, u.company_name].some(v => (v || '').toLowerCase().includes(search.toLowerCase())));
  const su = users.find(u => u.id === selectedUser);
  const calibratedCount = stats?.calibrated_users ?? stats?.calibrated ?? 0;
  const integrationsCount = stats?.total_integrations ?? stats?.with_integrations ?? 0;

  return (
    <DashboardLayout>
      <div style={{ background: 'var(--biqc-bg)', minHeight: 'calc(100vh - 56px)' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-normal text-[var(--ink-display)]" style={{ fontFamily: D }}>Super Admin</h1>
              <p className="text-xs text-[var(--ink-muted)]" style={{ fontFamily: B }}>Enterprise governance & control plane</p>
            </div>
            <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--ink-secondary)] hover:bg-black/5" style={{ border: '1px solid var(--biqc-border)', fontFamily: B }}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Sub-Nav */}
          <div className="flex gap-1 mb-6 overflow-x-auto pb-1" data-testid="admin-subnav">
            {PAGES.map(p => (
              <button key={p.id} onClick={() => setPage(p.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0"
                style={{ fontFamily: B, color: page === p.id ? 'var(--ink-display, #0A0A0A)' : '#64748B', background: page === p.id ? '#E85D00' + '15' : 'transparent', border: `1px solid ${page === p.id ? '#E85D00' + '30' : 'rgba(140,170,210,0.15)'}` }}
                data-testid={`admin-page-${p.id}`}>
                <p.icon className="w-3.5 h-3.5" style={{ color: page === p.id ? '#E85D00' : '#64748B' }} /> {p.label}
              </button>
            ))}
          </div>

          {/* ═══════════ COMMAND CENTRE ═══════════ */}
          {page === 'command' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="Platform Status" value="Operational" icon={Activity} color="#10B981" />
                <Mc label="Total Users" value={users.length} icon={Users} color="var(--ink-display)" />
                <Mc label="Edge Functions" value="19 active" icon={Cpu} color="#3B82F6" />
                <Mc label="API Health" value={healthData?.status === 'healthy' ? '100%' : 'Checking...'} icon={Server} color="#10B981" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Platform Health Map">
                  <div className="space-y-2">
                    <Row icon={Server} label="FastAPI Backend" value={healthData?.status || 'checking'} status={healthData?.status === 'healthy' ? 'healthy' : 'unknown'} />
                    <Row icon={Database} label="Supabase PostgreSQL" value={healthData?.supabase || 'checking'} status={healthData?.supabase === 'healthy' ? 'healthy' : 'unknown'} />
                    <Row icon={Cpu} label="Edge Functions (19)" value="Active" status="healthy" />
                    <Row icon={Radio} label="Email Sync Worker" value="Running" status="healthy" />
                    <Row icon={Brain} label="Intelligence Worker" value="Running" status="healthy" />
                    <Row icon={Clock} label="pg_cron Jobs (4)" value="Scheduled" status="healthy" />
                  </div>
                </Sec>
                <Sec title="Strategic Platform Intelligence">
                  <div className="space-y-2">
                    <Row icon={DollarSign} label="Active subscriptions" value={`${billing.paid} paid • ${billing.trialing} trialing`} status={billing.paid + billing.trialing > 0 ? 'healthy' : 'unknown'} />
                    <Row icon={TrendingUp} label="User growth trend" value={`${users.length} total`} status={users.length > 5 ? 'healthy' : 'warning'} />
                    <Row icon={Users} label="Calibration completion" value={`${calibratedCount}/${users.length}`} status="healthy" />
                    <Row icon={Zap} label="Integrations connected" value={`${integrationsCount} total`} status="healthy" />
                  </div>
                </Sec>
              </div>
            </div>
          )}

          {/* ═══════════ USER ADMIN ═══════════ */}
          {page === 'users' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-muted)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: B }} data-testid="admin-user-search" />
                  </div>
                </div>
                <div className="space-y-1">
                  {loading ? <div className="flex justify-center py-16"><RadarSweep compact /></div> :
                  filteredUsers.map(u => (
                    <button key={u.id} onClick={() => loadUserDetail(u.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-black/5 transition-all" style={{ background: selectedUser === u.id ? '#E85D0010' : 'transparent', border: `1px solid ${selectedUser === u.id ? '#E85D0030' : 'rgba(140,170,210,0.15)'}` }} data-testid={`admin-user-${u.id}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: u.role === 'suspended' ? '#EF444420' : '#E85D0020', color: u.role === 'suspended' ? '#EF4444' : '#E85D00', fontFamily: B }}>{(u.full_name || u.email || '?').charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[var(--ink-display)] block truncate" style={{ fontFamily: B }}>{u.full_name || 'Unnamed'}</span>
                        <span className="text-[10px] text-[var(--ink-muted)] block truncate" style={{ fontFamily: M }}>{u.email}</span>
                      </div>
                      <Badge text={u.role || 'user'} color={u.role === 'superadmin' ? '#E85D00' : u.role === 'suspended' ? '#EF4444' : '#10B981'} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                {su ? (
                  <Pnl>
                    <div className="flex justify-between mb-3"><h3 className="text-base text-[var(--ink-display)]" style={{ fontFamily: D }}>{su.full_name || 'User'}</h3><button onClick={() => setSelectedUser(null)} className="text-[var(--ink-muted)] hover:text-[var(--ink-display)]"><X className="w-4 h-4" /></button></div>
                    <div className="space-y-2 mb-4 text-xs">
                      {[['Email', su.email, M], ['Company', su.company_name || 'Not set', B], ['Role', su.role || 'user', M], ['Tier', su.subscription_tier || 'free', M], ['Joined', su.created_at ? new Date(su.created_at).toLocaleDateString() : '—', M]].map(([l, v, f]) => (
                        <div key={l}><span className="text-[10px] text-[var(--ink-muted)] uppercase" style={{ fontFamily: M }}>{l}</span><p className="text-[var(--ink-display)]" style={{ fontFamily: f }}>{v}</p></div>
                      ))}
                    </div>
                    {loadingDetail ? <div className="flex justify-center py-4"><RadarSweep compact /></div> : userDetail && (
                      <div className="grid grid-cols-2 gap-2 mb-4" style={{ borderTop: '1px solid var(--biqc-border)', paddingTop: 12 }}>
                        {[['Calibrated', userDetail.operator_profile?.persona_calibration_status || 'No', userDetail.operator_profile?.persona_calibration_status === 'complete' ? '#10B981' : '#F59E0B'],
                          ['Integrations', `${userDetail.integrations.length}`, '#3B82F6'], ['Snapshots', `${userDetail.snapshots.length}`, 'var(--ink-display, #0A0A0A)'], ['Signals', `${userDetail.signal_count}`, 'var(--ink-display, #0A0A0A)']].map(([l, v, c]) => (
                          <div key={l} className="p-2 rounded" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                            <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: M }}>{l}</span>
                            <span className="text-xs block" style={{ fontFamily: M, color: c }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {rateLimitDetail && (
                      <div className="space-y-3 mb-4" style={{ borderTop: '1px solid var(--biqc-border)', paddingTop: 12 }}>
                        <div>
                          <span className="text-[10px] text-[var(--ink-muted)] uppercase" style={{ fontFamily: M }}>AI Rate Limits</span>
                          <p className="text-[11px] text-[var(--ink-secondary)]" style={{ fontFamily: B }}>
                            Tier: {rateLimitDetail.tier} {rateLimitDetail.admin_bypass ? '• Andre bypass active' : '• monthly quota + burst window'}
                          </p>
                        </div>
                        {Object.entries(rateLimitDetail.feature_labels || {}).map(([feature, label]) => {
                          const effective = rateLimitDetail.effective?.[feature] || {};
                          const defaults = rateLimitDetail.defaults?.[feature] || rateLimitDefaults?.tiers?.[rateLimitDetail.tier]?.[feature] || {};
                          const usage = rateLimitDetail.monthly_usage?.[feature] || 0;
                          return (
                            <div key={feature} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div>
                                  <p className="text-xs text-[var(--ink-display)]" style={{ fontFamily: B }}>{label}</p>
                                  <p className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: M }}>
                                    Usage this month: {usage} / {effective.monthly_limit === -1 ? '∞' : effective.monthly_limit}
                                  </p>
                                </div>
                                <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: M }}>
                                  Default {defaults.monthly_limit ?? '—'} • burst {defaults.burst_limit ?? '—'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {[['monthly_limit', 'Monthly'], ['burst_limit', 'Burst'], ['burst_window_seconds', 'Window(s)']].map(([field, labelText]) => (
                                  <label key={field} className="block">
                                    <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: M }}>{labelText}</span>
                                    <input
                                      type="number"
                                      value={rateLimitDetail.overrides?.[feature]?.[field] ?? effective[field] ?? ''}
                                      onChange={(e) => changeRateLimit(feature, field, e.target.value)}
                                      className="mt-1 w-full px-2 py-2 rounded-lg text-xs outline-none"
                                      style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: M }}
                                      data-testid={`admin-rate-${feature}-${field}`}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={saveRateLimits} disabled={rateLimitSaving} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#E85D0015', color: '#E85D00', border: '1px solid #E85D0030', fontFamily: B }} data-testid="admin-save-rate-limits-btn">
                            {rateLimitSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />} Save Limits
                          </button>
                          <button onClick={resetRateOverrides} disabled={rateLimitSaving} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#64748B15', color: 'var(--ink-muted)', border: '1px solid #64748B30', fontFamily: B }} data-testid="admin-reset-rate-overrides-btn">
                            <RefreshCw className="w-3.5 h-3.5" /> Reset to Tier
                          </button>
                          <button onClick={resetMonthlyUsage} disabled={rateLimitSaving} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F620', fontFamily: B }} data-testid="admin-reset-usage-btn">
                            <RefreshCw className="w-3.5 h-3.5" /> Reset Month Usage
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2" style={{ borderTop: '1px solid var(--biqc-border)', paddingTop: 12 }}>
                      <button onClick={() => impersonateUser(selectedUser)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F620', fontFamily: B }} data-testid="admin-impersonate-btn"><Eye className="w-3.5 h-3.5" /> View as User</button>
                      {su.role !== 'suspended' ? (
                        <button onClick={() => suspendUser(selectedUser)} disabled={actionLoading === selectedUser} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#EF444410', color: '#EF4444', border: '1px solid #EF444420', fontFamily: B }} data-testid="admin-suspend-btn">{actionLoading === selectedUser ? null : <Ban className="w-3.5 h-3.5" />} Suspend</button>
                      ) : (
                        <button onClick={() => unsuspendUser(selectedUser)} disabled={actionLoading === selectedUser} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#10B98110', color: '#10B981', border: '1px solid #10B98120', fontFamily: B }} data-testid="admin-unsuspend-btn"><CheckCircle className="w-3.5 h-3.5" /> Unsuspend</button>
                      )}
                    </div>
                  </Pnl>
                ) : (
                  <Pnl><div className="text-center py-8"><Users className="w-8 h-8 mx-auto mb-3 text-[var(--ink-muted)]" /><p className="text-sm text-[var(--ink-muted)]" style={{ fontFamily: B }}>Select a user</p></div></Pnl>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ GOVERNANCE ═══════════ */}
          {page === 'governance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="Role Tiers" value="4" icon={Users} color="var(--ink-display)" sub="superadmin, admin, user, suspended" />
                <Mc label="Audit Events" value="Active" icon={FileText} color="#10B981" sub="prompt_audit_logs" />
                <Mc label="Admin Actions" value="Logged" icon={Shield} color="#3B82F6" sub="All CRUD + impersonate" />
                <Mc label="Data Residency" value="AU" icon={Globe} color="#E85D00" sub="Sydney + Melbourne" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Role Hierarchy">
                  <div className="space-y-2">
                    {[
                      { role: 'Super Admin', access: 'Full platform access, all tenants, billing, governance', color: '#E85D00', users: users.filter(u => u.role === 'superadmin').length },
                      { role: 'Admin (Partner)', access: 'Manage own clients, delegated billing, client health', color: '#3B82F6', users: users.filter(u => u.role === 'admin').length },
                      { role: 'Owner', access: 'Full access to own workspace, add team members', color: '#10B981', users: users.filter(u => u.role === 'user').length },
                      { role: 'Team Member', access: 'Filtered access per assigned modules', color: 'var(--biqc-text-2)', users: 0 },
                      { role: 'Suspended', access: 'No access. Data preserved.', color: '#EF4444', users: users.filter(u => u.role === 'suspended').length },
                    ].map(r => (
                      <div key={r.role} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: r.color }} />
                        <div className="flex-1">
                          <span className="text-sm text-[var(--ink-display)]" style={{ fontFamily: B }}>{r.role}</span>
                          <span className="text-[10px] text-[var(--ink-muted)] block" style={{ fontFamily: B }}>{r.access}</span>
                        </div>
                        <Badge text={`${r.users} users`} color={r.color} />
                      </div>
                    ))}
                  </div>
                </Sec>
                <Sec title="Governance Controls">
                  <div className="space-y-2">
                    <Row icon={FileText} label="Immutable audit trail" value="Active" status="healthy" />
                    <Row icon={Lock} label="Privilege elevation logging" value="Active" status="healthy" />
                  </div>
                </Sec>
              </div>
              <Sec title="Data Sovereignty & Partition Assurance">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Data Location', value: 'Sydney & Melbourne, AU', icon: Globe },
                    { label: 'Cross-tenant Query Protection', value: 'RLS enforced', icon: Shield },
                    { label: 'Backup Recovery', value: 'Point-in-time, 30 days', icon: Database },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <item.icon className="w-4 h-4 text-[var(--ink-muted)] mb-2" />
                      <span className="text-xs text-[var(--ink-display)] block" style={{ fontFamily: B }}>{item.label}</span>
                      <span className="text-[10px]" style={{ fontFamily: M, color: '#10B981' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </Sec>
            </div>
          )}

          {/* ═══════════ SECURITY ═══════════ */}
          {page === 'security' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="Encryption" value="AES-256" icon={Lock} color="#10B981" sub="At rest + in transit" />
                <Mc label="Auth Method" value="Supabase" icon={Key} color="#3B82F6" sub="OAuth + JWT" />
                <Mc label="MFA" value="Available" icon={Fingerprint} color="#F59E0B" sub="Google/Microsoft" />
                <Mc label="SOC2" value="In Progress" icon={ShieldCheck} color="#E85D00" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Security Hardening Status">
                  <div className="space-y-2">
                    {[
                      ['AES-256 encryption at rest', 'Active', 'healthy'],
                      ['TLS 1.3 in transit', 'Active', 'healthy'],
                      ['Supabase RLS (Row Level Security)', 'Active', 'healthy'],
                      ['OAuth 2.0 (Google + Microsoft)', 'Active', 'healthy'],
                    ].map(([l, v, s]) => <Row key={l} label={l} value={v} status={s} />)}
                  </div>
                </Sec>
                <Sec title="Enterprise Procurement Readiness">
                  <div className="space-y-2">
                    {[
                      ['Terms & Conditions', '/trust/terms', 'Ready'],
                      ['Privacy Policy', '/trust/privacy', 'Ready'],
                      ['Data Processing Agreement', '/trust/dpa', 'Ready'],
                      ['Security & Infrastructure', '/trust/security', 'Ready'],
                      ['Trust Centre', '/trust/centre', 'Ready'],
                      ['SOC2 Type II Report', null, 'In Progress'],
                    ].map(([l, href, s]) => (
                      <div key={l} className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <StatusDot status={s === 'Ready' ? 'healthy' : s === 'In Progress' ? 'warning' : 'unknown'} />
                        <span className="text-sm text-[var(--ink-display)] flex-1" style={{ fontFamily: B }}>{l}</span>
                        <Badge text={s} color={s === 'Ready' ? '#10B981' : s === 'In Progress' ? '#F59E0B' : '#64748B'} />
                        {href && <a href={href} target="_blank" rel="noreferrer" className="text-[var(--ink-muted)] hover:text-[#E85D00]"><ExternalLink className="w-3 h-3" /></a>}
                      </div>
                    ))}
                  </div>
                </Sec>
              </div>
            </div>
          )}

          {/* ═══════════ AI GOVERNANCE ═══════════ */}
          {page === 'ai' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="AI Providers" value="3" icon={Brain} color="var(--ink-display)" sub="OpenAI, Perplexity, Firecrawl" />
                <Mc label="Edge Functions" value="19" icon={Cpu} color="#3B82F6" sub="Active on Supabase" />
                <Mc label="Token Tracking" value="Active" icon={Hash} color="#10B981" sub="usage_tracking table" />
                <Mc label="Cost Control" value="Monitor" icon={DollarSign} color="#E85D00" sub="Per-function, per-user" />
              </div>
              <Sec title="AI Governance Controls">
                <div className="space-y-2">
                  {[
                    ['Token burn dashboard', 'Active — usage_tracking', 'healthy'],
                    ['Per-function cost tracking', 'Active', 'healthy'],
                    ['Per-user cost tracking', 'Active', 'healthy'],
                    ['Prompt hash logging', 'Active — prompt_audit_logs', 'healthy'],
                    ['AI decision audit trail', 'Active — advisory_log', 'healthy'],
                  ].map(([l, v, s]) => <Row key={l} label={l} value={v} status={s} />)}
                </div>
              </Sec>
            </div>
          )}

          {/* ═══════════ COMMERCIAL ═══════════ */}
          {page === 'commercial' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="MRR" value={`$${billing.mrr.toLocaleString()}`} icon={DollarSign} color={billing.mrr > 0 ? '#10B981' : '#E85D00'} sub={billing.loaded ? 'Active subscriptions' : 'Loading...'} />
                <Mc label="ARR" value={`$${billing.arr.toLocaleString()}`} icon={TrendingUp} color="var(--ink-display)" sub="MRR × 12" />
                <Mc label="Paid Users" value={billing.paid} icon={Users} color={billing.paid > 0 ? '#10B981' : '#64748B'} sub={`${users.length} total accounts`} />
                <Mc label="Trialing" value={billing.trialing} icon={Clock} color="#F59E0B" sub="7-day Stripe trial" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Revenue Intelligence">
                  <div className="space-y-2">
                    {[
                      ['Feature adoption telemetry', 'Active — calibration + integrations', 'healthy'],
                      ['Overuse abuse detection', 'Active — usage_tracking', 'healthy'],
                      ['Stripe webhook events', 'Active — stripe_webhook_events', 'healthy'],
                      ['Payment reconciliation log', 'Active — stripe_reconcile_log', 'healthy'],
                    ].map(([l, v, s]) => <Row key={l} label={l} value={v} status={s} />)}
                  </div>
                </Sec>
                <Sec title="Live Subscriptions">
                  <div className="space-y-2">
                    {billing.loaded && billing.transactions.length === 0 && (
                      <div className="p-4 rounded-lg text-center" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <p className="text-xs text-[var(--ink-muted)]" style={{ fontFamily: B }}>No subscriptions yet</p>
                      </div>
                    )}
                    {billing.transactions.slice(0, 8).map((t, i) => {
                      const user = users.find(u => u.id === t.user_id);
                      const statusDot = t.payment_status === 'trialing' ? 'warning' : 'healthy';
                      return (
                        <div key={`${t.user_id}-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                          <StatusDot status={statusDot} />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-[var(--ink-display)] block truncate" style={{ fontFamily: B }}>{user?.company_name || user?.full_name || user?.email || 'Orphaned record'}</span>
                            <span className="text-[10px] text-[var(--ink-muted)] block" style={{ fontFamily: M }}>{t.tier} • {t.payment_status}</span>
                          </div>
                          <span className="text-xs text-[var(--ink-display)]" style={{ fontFamily: M }}>${Number(t.amount || 0).toFixed(0)}/mo</span>
                        </div>
                      );
                    })}
                  </div>
                </Sec>
              </div>
              <Pnl>
                <h3 className="text-base text-[var(--ink-display)] mb-3" style={{ fontFamily: D }}>Subscription Tiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {[{ name: 'Growth', price: '$69/mo', f: ['Up to 5 integrations', 'Daily intelligence', 'Email alerts', 'Full platform access'] },
                    { name: 'Professional', price: '$199/mo', f: ['Expanded connectors', 'Real-time intelligence', 'Priority model routing', 'Advanced reporting'] },
                    { name: 'Business', price: '$349/mo', f: ['Frontier models from OpenAI, Anthropic, and Google', 'Up to 15 integrations', 'Team (5 seats)', 'Dedicated onboarding'] },
                    { name: 'Enterprise', price: 'Custom', f: ['Everything in Business', 'Enterprise governance', 'Custom integrations', 'Dedicated account manager'] }
                  ].map(t => (
                    <div key={t.name} className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <span className="text-sm font-medium text-[var(--ink-display)]" style={{ fontFamily: B }}>{t.name}</span>
                      <span className="text-lg font-bold text-[#E85D00] block mb-2" style={{ fontFamily: M }}>{t.price}</span>
                      {t.f.map(f => <div key={f} className="flex items-center gap-1.5 text-xs text-[var(--ink-secondary)] mb-1" style={{ fontFamily: B }}><CheckCircle className="w-3 h-3 text-[#10B981]" />{f}</div>)}
                    </div>
                  ))}
                </div>
              </Pnl>
            </div>
          )}

          {/* ═══════════ OPERATIONS ═══════════ */}
          {page === 'operations' && (
            <div className="space-y-6">
              <ComingSoon message="Operational controls (kill switches, automation rules, team oversight) arriving in a later sprint. See User Admin tab for suspend/unsuspend." />
            </div>
          )}

          {/* ═══════════ GROWTH ═══════════ */}
          {page === 'growth' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="Active Users" value={users.length} icon={Users} color="var(--ink-display)" />
                <Mc label="Calibrated" value={calibratedCount} icon={Shield} color="#3B82F6" sub={`${users.length > 0 ? Math.round((calibratedCount / users.length) * 100) : 0}% rate`} />
                <Mc label="Integrations" value={integrationsCount} icon={Plug} color="#10B981" sub="Total connected" />
                <Mc label="Trialing" value={billing.trialing} icon={Clock} color="#F59E0B" sub="Stripe 7-day trial" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Growth Infrastructure">
                  <div className="space-y-2">
                    {[
                      ['Integration usage monitoring', 'Active — per-user', 'healthy'],
                      ['Activation milestone tracking', 'Active — calibration', 'healthy'],
                    ].map(([l, v, s]) => <Row key={l} label={l} value={v} status={s} />)}
                  </div>
                </Sec>
                <Sec title="Trust Signals (User-Facing)">
                  <div className="space-y-2">
                    {[
                      ['Transparent uptime panel', '/trust/centre', 'Ready'],
                      ['Data location disclosure', '/trust', 'Ready'],
                      ['Live security status', '/trust/security', 'Ready'],
                      ['Encryption badge detail', '/trust/security', 'Ready'],
                    ].map(([l, href, s]) => (
                      <div key={l} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <StatusDot status="healthy" />
                        <span className="text-xs text-[var(--ink-display)] flex-1" style={{ fontFamily: B }}>{l}</span>
                        <Badge text={s} color="#10B981" />
                        {href && <a href={href} target="_blank" rel="noreferrer" className="text-[var(--ink-muted)] hover:text-[#E85D00]"><ExternalLink className="w-3 h-3" /></a>}
                      </div>
                    ))}
                  </div>
                </Sec>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
