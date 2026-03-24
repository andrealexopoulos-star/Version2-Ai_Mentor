import { RadarSweep } from '../components/LoadingSystems';
import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import {
  Users, Activity, Shield, Eye, Search, RefreshCw, Ban, CheckCircle, UserPlus,
  TrendingUp, DollarSign, Headphones, BarChart3, ChevronRight, CreditCard,
  AlertTriangle, Loader2, X, Cpu, Lock, Zap, Globe, Server, Bell, FileText,
  Settings, Workflow, Database, Radio, Heart, Key, AlertOctagon, Gauge,
  Brain, Bot, Fingerprint, ShieldCheck, Scale, Rocket, ExternalLink, Clock,
  ToggleLeft, Power, Pause, Play, Hash, Terminal, MonitorSmartphone, Plug
} from 'lucide-react';

const D = "'Cormorant Garamond', Georgia, serif";
const B = "'Inter', sans-serif";
const M = "'JetBrains Mono', monospace";

const Pnl = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);
const Mc = ({ label, value, sub, color = '#F4F7FA', icon: Icon, alert }) => (
  <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: `1px solid ${alert ? '#FF6A00' + '40' : '#243140'}` }}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] text-[#64748B] uppercase tracking-wider" style={{ fontFamily: M }}>{label}</span>
      {Icon && <Icon className="w-4 h-4 text-[#64748B]" />}
    </div>
    <span className="text-xl font-bold block" style={{ fontFamily: M, color }}>{value}</span>
    {sub && <span className="text-[11px] text-[#64748B] mt-0.5 block" style={{ fontFamily: B }}>{sub}</span>}
  </div>
);
const Sec = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-lg font-normal text-[#F4F7FA] mb-4" style={{ fontFamily: D }}>{title}</h3>
    {children}
  </div>
);
const StatusDot = ({ status }) => {
  const c = { healthy: '#10B981', warning: '#F59E0B', critical: '#FF6A00', offline: '#EF4444', unknown: '#64748B' };
  return <div className="w-2 h-2 rounded-full" style={{ background: c[status] || c.unknown, boxShadow: status === 'critical' ? `0 0 8px ${c.critical}50` : 'none' }} />;
};
const Badge = ({ text, color = '#64748B' }) => (
  <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider" style={{ fontFamily: M, color, background: color + '15' }}>{text}</span>
);
const Row = ({ icon: Icon, label, value, status, onClick }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${onClick ? 'cursor-pointer hover:bg-white/5' : ''}`} style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }} onClick={onClick}>
    {Icon && <Icon className="w-4 h-4 text-[#64748B] shrink-0" />}
    {status && <StatusDot status={status} />}
    <span className="text-sm text-[#F4F7FA] flex-1" style={{ fontFamily: B }}>{label}</span>
    <span className="text-xs text-[#9FB0C3]" style={{ fontFamily: M }}>{value}</span>
    {onClick && <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />}
  </div>
);

const PAGES = [
  { id: 'command', label: 'Command Centre', icon: Gauge },
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

  return (
    <DashboardLayout>
      <div style={{ background: 'var(--biqc-bg)', minHeight: 'calc(100vh - 56px)' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-normal text-[#F4F7FA]" style={{ fontFamily: D }}>Super Admin</h1>
              <p className="text-xs text-[#64748B]" style={{ fontFamily: B }}>Enterprise governance & control plane</p>
            </div>
            <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#9FB0C3] hover:bg-white/5" style={{ border: '1px solid var(--biqc-border)', fontFamily: B }}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Sub-Nav */}
          <div className="flex gap-1 mb-6 overflow-x-auto pb-1" data-testid="admin-subnav">
            {PAGES.map(p => (
              <button key={p.id} onClick={() => setPage(p.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0"
                style={{ fontFamily: B, color: page === p.id ? '#F4F7FA' : '#64748B', background: page === p.id ? '#FF6A00' + '15' : 'transparent', border: `1px solid ${page === p.id ? '#FF6A00' + '30' : '#243140'}` }}
                data-testid={`admin-page-${p.id}`}>
                <p.icon className="w-3.5 h-3.5" style={{ color: page === p.id ? '#FF6A00' : '#64748B' }} /> {p.label}
              </button>
            ))}
          </div>

          {/* ═══════════ COMMAND CENTRE ═══════════ */}
          {page === 'command' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="Platform Status" value="Operational" icon={Activity} color="#10B981" />
                <Mc label="Total Users" value={users.length} icon={Users} color="#F4F7FA" />
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
                    <Row icon={AlertTriangle} label="Revenue concentration risk" value="No billing data" status="unknown" />
                    <Row icon={TrendingUp} label="User growth trend" value={`${users.length} total`} status={users.length > 5 ? 'healthy' : 'warning'} />
                    <Row icon={Cpu} label="AI cost trajectory" value="Check usage_tracking" status="warning" />
                    <Row icon={Users} label="Calibration completion rate" value={`${stats?.calibrated || 0}/${users.length}`} status="healthy" />
                    <Row icon={Zap} label="Integration adoption" value="Check per-user" status="healthy" />
                  </div>
                </Sec>
              </div>
              <Sec title="Active Inevitabilities (Platform Level)">
                <div className="space-y-2">
                  <div className="p-4 rounded-lg" style={{ background: '#FF6A00' + '08', border: '1px solid #FF6A0020' }}>
                    <div className="flex items-center gap-2 mb-1"><StatusDot status="critical" /><span className="text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: B }}>No billing connected — $0 MRR</span></div>
                    <p className="text-xs text-[#9FB0C3] ml-4" style={{ fontFamily: B }}>Revenue: $0. All users on free tier. Connect Stripe to enable subscriptions.</p>
                  </div>
                  <div className="p-4 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B20' }}>
                    <div className="flex items-center gap-2 mb-1"><StatusDot status="warning" /><span className="text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: B }}>2 Edge Functions without source control</span></div>
                    <p className="text-xs text-[#9FB0C3] ml-4" style={{ fontFamily: B }}>intelligence-snapshot and signal-evaluator deployed but not in git. Recovery needed.</p>
                  </div>
                </div>
              </Sec>
            </div>
          )}

          {/* ═══════════ USER ADMIN ═══════════ */}
          {page === 'users' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: B }} data-testid="admin-user-search" />
                  </div>
                </div>
                <div className="space-y-1">
                  {loading ? <div className="flex justify-center py-16"><RadarSweep compact /></div> :
                  filteredUsers.map(u => (
                    <button key={u.id} onClick={() => loadUserDetail(u.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-white/5 transition-all" style={{ background: selectedUser === u.id ? '#FF6A0010' : 'transparent', border: `1px solid ${selectedUser === u.id ? '#FF6A0030' : '#243140'}` }} data-testid={`admin-user-${u.id}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: u.role === 'suspended' ? '#EF444420' : '#FF6A0020', color: u.role === 'suspended' ? '#EF4444' : '#FF6A00', fontFamily: B }}>{(u.full_name || u.email || '?').charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[#F4F7FA] block truncate" style={{ fontFamily: B }}>{u.full_name || 'Unnamed'}</span>
                        <span className="text-[10px] text-[#64748B] block truncate" style={{ fontFamily: M }}>{u.email}</span>
                      </div>
                      <Badge text={u.role || 'user'} color={u.role === 'superadmin' ? '#FF6A00' : u.role === 'suspended' ? '#EF4444' : '#10B981'} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                {su ? (
                  <Pnl>
                    <div className="flex justify-between mb-3"><h3 className="text-base text-[#F4F7FA]" style={{ fontFamily: D }}>{su.full_name || 'User'}</h3><button onClick={() => setSelectedUser(null)} className="text-[#64748B] hover:text-white"><X className="w-4 h-4" /></button></div>
                    <div className="space-y-2 mb-4 text-xs">
                      {[['Email', su.email, M], ['Company', su.company_name || 'Not set', B], ['Role', su.role || 'user', M], ['Tier', su.subscription_tier || 'free', M], ['Joined', su.created_at ? new Date(su.created_at).toLocaleDateString() : '—', M]].map(([l, v, f]) => (
                        <div key={l}><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: M }}>{l}</span><p className="text-[#F4F7FA]" style={{ fontFamily: f }}>{v}</p></div>
                      ))}
                    </div>
                    {loadingDetail ? <div className="flex justify-center py-4"><RadarSweep compact /></div> : userDetail && (
                      <div className="grid grid-cols-2 gap-2 mb-4" style={{ borderTop: '1px solid var(--biqc-border)', paddingTop: 12 }}>
                        {[['Calibrated', userDetail.operator_profile?.persona_calibration_status || 'No', userDetail.operator_profile?.persona_calibration_status === 'complete' ? '#10B981' : '#F59E0B'],
                          ['Integrations', `${userDetail.integrations.length}`, '#3B82F6'], ['Snapshots', `${userDetail.snapshots.length}`, '#F4F7FA'], ['Signals', `${userDetail.signal_count}`, '#F4F7FA']].map(([l, v, c]) => (
                          <div key={l} className="p-2 rounded" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: M }}>{l}</span>
                            <span className="text-xs block" style={{ fontFamily: M, color: c }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {rateLimitDetail && (
                      <div className="space-y-3 mb-4" style={{ borderTop: '1px solid var(--biqc-border)', paddingTop: 12 }}>
                        <div>
                          <span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: M }}>AI Rate Limits</span>
                          <p className="text-[11px] text-[#9FB0C3]" style={{ fontFamily: B }}>
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
                                  <p className="text-xs text-[#F4F7FA]" style={{ fontFamily: B }}>{label}</p>
                                  <p className="text-[10px] text-[#64748B]" style={{ fontFamily: M }}>
                                    Usage this month: {usage} / {effective.monthly_limit === -1 ? '∞' : effective.monthly_limit}
                                  </p>
                                </div>
                                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: M }}>
                                  Default {defaults.monthly_limit ?? '—'} • burst {defaults.burst_limit ?? '—'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {[['monthly_limit', 'Monthly'], ['burst_limit', 'Burst'], ['burst_window_seconds', 'Window(s)']].map(([field, labelText]) => (
                                  <label key={field} className="block">
                                    <span className="text-[10px] text-[#64748B]" style={{ fontFamily: M }}>{labelText}</span>
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
                          <button onClick={saveRateLimits} disabled={rateLimitSaving} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FF6A0015', color: '#FF6A00', border: '1px solid #FF6A0030', fontFamily: B }} data-testid="admin-save-rate-limits-btn">
                            {rateLimitSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />} Save Limits
                          </button>
                          <button onClick={resetRateOverrides} disabled={rateLimitSaving} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#64748B15', color: '#64748B', border: '1px solid #64748B30', fontFamily: B }} data-testid="admin-reset-rate-overrides-btn">
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
                  <Pnl><div className="text-center py-8"><Users className="w-8 h-8 mx-auto mb-3 text-[#64748B]" /><p className="text-sm text-[#64748B]" style={{ fontFamily: B }}>Select a user</p></div></Pnl>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ GOVERNANCE ═══════════ */}
          {page === 'governance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="Role Tiers" value="4" icon={Users} color="#F4F7FA" sub="superadmin, admin, user, suspended" />
                <Mc label="Audit Events" value="Active" icon={FileText} color="#10B981" sub="prompt_audit_logs" />
                <Mc label="Admin Actions" value="Logged" icon={Shield} color="#3B82F6" sub="All CRUD + impersonate" />
                <Mc label="Data Residency" value="AU" icon={Globe} color="#FF6A00" sub="Sydney + Melbourne" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Role Hierarchy">
                  <div className="space-y-2">
                    {[
                      { role: 'Super Admin', access: 'Full platform access, all tenants, billing, governance', color: '#FF6A00', users: users.filter(u => u.role === 'superadmin').length },
                      { role: 'Admin (Partner)', access: 'Manage own clients, delegated billing, client health', color: '#3B82F6', users: users.filter(u => u.role === 'admin').length },
                      { role: 'Owner', access: 'Full access to own workspace, add team members', color: '#10B981', users: users.filter(u => u.role === 'user').length },
                      { role: 'Team Member', access: 'Filtered access per assigned modules', color: 'var(--biqc-text-2)', users: 0 },
                      { role: 'Suspended', access: 'No access. Data preserved.', color: '#EF4444', users: users.filter(u => u.role === 'suspended').length },
                    ].map(r => (
                      <div key={r.role} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: r.color }} />
                        <div className="flex-1">
                          <span className="text-sm text-[#F4F7FA]" style={{ fontFamily: B }}>{r.role}</span>
                          <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: B }}>{r.access}</span>
                        </div>
                        <Badge text={`${r.users} users`} color={r.color} />
                      </div>
                    ))}
                  </div>
                </Sec>
                <Sec title="Governance Controls">
                  <div className="space-y-2">
                    <Row icon={FileText} label="Immutable audit trail" value="Active" status="healthy" />
                    <Row icon={Key} label="Delegated authority with expiry" value="Planned" status="unknown" />
                    <Row icon={Scale} label="Approval chains (financial threshold)" value="Planned" status="unknown" />
                    <Row icon={Eye} label="Session replay for privileged users" value="Planned" status="unknown" />
                    <Row icon={AlertOctagon} label="Break-glass access protocol" value="Planned" status="unknown" />
                    <Row icon={Lock} label="Privilege elevation logging" value="Active" status="healthy" />
                  </div>
                </Sec>
              </div>
              <Sec title="Data Sovereignty & Partition Assurance">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Data Location', value: 'Sydney & Melbourne, AU', icon: Globe, status: 'Active' },
                    { label: 'Cross-tenant Query Protection', value: 'RLS enforced', icon: Shield, status: 'Active' },
                    { label: 'Backup Recovery', value: 'Point-in-time, 30 days', icon: Database, status: 'Active' },
                    { label: 'Data Lineage Tracing', value: 'Planned', icon: Search, status: 'Planned' },
                    { label: 'Retention Policy Dashboard', value: 'Planned', icon: Clock, status: 'Planned' },
                    { label: 'Forensic Recovery Mode', value: 'Planned', icon: Terminal, status: 'Planned' },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <item.icon className="w-4 h-4 text-[#64748B] mb-2" />
                      <span className="text-xs text-[#F4F7FA] block" style={{ fontFamily: B }}>{item.label}</span>
                      <span className="text-[10px]" style={{ fontFamily: M, color: item.status === 'Active' ? '#10B981' : '#64748B' }}>{item.value}</span>
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
                <Mc label="SOC2" value="In Progress" icon={ShieldCheck} color="#FF6A00" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Security Hardening Status">
                  <div className="space-y-2">
                    {[
                      ['AES-256 encryption at rest', 'Active', 'healthy'],
                      ['TLS 1.3 in transit', 'Active', 'healthy'],
                      ['Supabase RLS (Row Level Security)', 'Active', 'healthy'],
                      ['OAuth 2.0 (Google + Microsoft)', 'Active', 'healthy'],
                      ['IP Allowlisting', 'Planned', 'unknown'],
                      ['Device Fingerprinting', 'Planned', 'unknown'],
                      ['Geo-fencing Rules', 'Planned', 'unknown'],
                      ['MFA per Role Tier', 'Planned', 'unknown'],
                      ['Anomaly Login Detection', 'Planned', 'unknown'],
                      ['Real-time Privilege Abuse Detection', 'Planned', 'unknown'],
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
                      ['Penetration Test Report', null, 'Planned'],
                      ['Sub-processor List', null, 'Planned'],
                      ['Breach Response Workflow', null, 'Planned'],
                      ['Data Deletion Certification', null, 'Planned'],
                    ].map(([l, href, s]) => (
                      <div key={l} className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <StatusDot status={s === 'Ready' ? 'healthy' : s === 'In Progress' ? 'warning' : 'unknown'} />
                        <span className="text-sm text-[#F4F7FA] flex-1" style={{ fontFamily: B }}>{l}</span>
                        <Badge text={s} color={s === 'Ready' ? '#10B981' : s === 'In Progress' ? '#F59E0B' : '#64748B'} />
                        {href && <a href={href} target="_blank" rel="noreferrer" className="text-[#64748B] hover:text-[#FF6A00]"><ExternalLink className="w-3 h-3" /></a>}
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
                <Mc label="AI Providers" value="3" icon={Brain} color="#F4F7FA" sub="OpenAI, Perplexity, Firecrawl" />
                <Mc label="Edge Functions" value="19" icon={Cpu} color="#3B82F6" sub="Active on Supabase" />
                <Mc label="Token Tracking" value="Active" icon={Hash} color="#10B981" sub="usage_tracking table" />
                <Mc label="Cost Control" value="Monitor" icon={DollarSign} color="#FF6A00" sub="Per-function, per-user" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="AI Agent Registry">
                  <div className="space-y-2">
                    {[
                      ['biqc-insights-cognitive', 'OpenAI + Perplexity', '4 deploys', 'Core brain'],
                      ['intelligence-snapshot', 'OpenAI', '43 deploys', 'Fallback cognitive'],
                      ['strategic-console-ai', 'OpenAI', '4 deploys', 'BRIEF + ASK modes'],
                      ['boardroom-diagnosis', 'OpenAI', '5 deploys', 'Deep-dive diagnosis'],
                      ['cfo-cash-analysis', 'OpenAI + Merge.dev', '1 deploy', 'Financial analysis'],
                      ['market-analysis-ai', 'OpenAI + Firecrawl', '2 deploys', 'SWOT analysis'],
                      ['competitor-monitor', 'Perplexity + OpenAI', '1 deploy', 'Weekly scan'],
                      ['deep-web-recon', 'OpenAI + Firecrawl', '4 deploys', 'Competitive intel'],
                      ['sop-generator', 'OpenAI', '1 deploy', 'SOP/checklist gen'],
                      ['calibration-psych', 'OpenAI', '4 deploys', '9-step profiling'],
                      ['calibration-business-dna', 'OpenAI + Firecrawl', '2 deploys', 'Website extraction'],
                      ['email_priority', 'OpenAI', '41 deploys', 'Email triage'],
                    ].map(([name, provider, deploys, desc]) => (
                      <div key={name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <Bot className="w-4 h-4 text-[#3B82F6] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[#F4F7FA] block truncate" style={{ fontFamily: M }}>{name}</span>
                          <span className="text-[10px] text-[#64748B]" style={{ fontFamily: B }}>{desc}</span>
                        </div>
                        <span className="text-[10px] text-[#64748B] shrink-0" style={{ fontFamily: M }}>{deploys}</span>
                      </div>
                    ))}
                  </div>
                </Sec>
                <Sec title="AI Governance Controls">
                  <div className="space-y-2">
                    {[
                      ['Token burn dashboard', 'Active — usage_tracking', 'healthy'],
                      ['Per-function cost tracking', 'Active', 'healthy'],
                      ['Per-user cost tracking', 'Active', 'healthy'],
                      ['Prompt hash logging', 'Active — prompt_audit_logs', 'healthy'],
                      ['AI decision audit trail', 'Active — advisory_log', 'healthy'],
                      ['Prompt injection detection', 'Planned', 'unknown'],
                      ['Agent action approval thresholds', 'Planned', 'unknown'],
                      ['AI confidence scoring visibility', 'Planned', 'unknown'],
                      ['Red team simulation environment', 'Planned', 'unknown'],
                      ['Model usage budget alerts', 'Planned', 'unknown'],
                    ].map(([l, v, s]) => <Row key={l} label={l} value={v} status={s} />)}
                  </div>
                </Sec>
              </div>
            </div>
          )}

          {/* ═══════════ COMMERCIAL ═══════════ */}
          {page === 'commercial' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="MRR" value="$0" icon={DollarSign} color="#FF6A00" sub="Connect Stripe" alert />
                <Mc label="ARR" value="$0" icon={TrendingUp} color="#F4F7FA" />
                <Mc label="Paid Users" value="0" icon={Users} color="#64748B" sub={`${users.length} free`} />
                <Mc label="Churn Rate" value="N/A" icon={AlertTriangle} color="#64748B" sub="No billing data" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Revenue Intelligence">
                  <div className="space-y-2">
                    {[
                      ['MRR by tenant', 'Needs Stripe', 'unknown'],
                      ['Usage-to-revenue ratio', 'Needs Stripe', 'unknown'],
                      ['Feature adoption telemetry', 'Partial — calibration + integrations', 'warning'],
                      ['Churn risk signals', 'Planned', 'unknown'],
                      ['Plan downgrade detection', 'Needs Stripe', 'unknown'],
                      ['CAC vs LTV dashboard', 'Needs Stripe + Analytics', 'unknown'],
                      ['Billing anomaly detection', 'Needs Stripe', 'unknown'],
                      ['Overuse abuse detection', 'Active — usage_tracking', 'healthy'],
                    ].map(([l, v, s]) => <Row key={l} label={l} value={v} status={s} />)}
                  </div>
                </Sec>
                <Sec title="Sales Pipeline">
                  <div className="space-y-2">
                    {[
                      { name: 'Meridian Group', stage: 'Demo Done', value: '$2,400/mo', status: 'hot' },
                      { name: 'Coastal Logistics', stage: 'Trial', value: '$1,800/mo', status: 'warm' },
                      { name: 'Summit Partners', stage: 'Proposal', value: '$3,200/mo', status: 'warm' },
                      { name: 'Apex Dental', stage: 'Contact', value: '$1,200/mo', status: 'new' },
                      { name: 'Harbor Finance', stage: 'Demo Booked', value: '$2,800/mo', status: 'hot' },
                    ].map(l => (
                      <div key={l.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <StatusDot status={l.status === 'hot' ? 'critical' : l.status === 'warm' ? 'warning' : 'healthy'} />
                        <div className="flex-1">
                          <span className="text-xs text-[#F4F7FA]" style={{ fontFamily: B }}>{l.name}</span>
                          <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: M }}>{l.stage}</span>
                        </div>
                        <span className="text-xs text-[#F4F7FA]" style={{ fontFamily: M }}>{l.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-2 italic" style={{ fontFamily: B }}>Mock data. Connect CRM for live pipeline.</p>
                </Sec>
              </div>
              <Pnl>
                <h3 className="text-base text-[#F4F7FA] mb-3" style={{ fontFamily: D }}>Subscription Tiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[{ name: 'Starter', price: '$499/mo', f: ['5 integrations', 'Daily intelligence', 'Email alerts'] },
                    { name: 'Professional', price: '$999/mo', f: ['Unlimited integrations', 'Real-time intelligence', 'Auto-email + SMS', 'Full reports'] },
                    { name: 'Enterprise', price: 'Custom', f: ['Everything', 'White label', 'Custom integrations', 'Dedicated AM'] }
                  ].map(t => (
                    <div key={t.name} className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <span className="text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: B }}>{t.name}</span>
                      <span className="text-lg font-bold text-[#FF6A00] block mb-2" style={{ fontFamily: M }}>{t.price}</span>
                      {t.f.map(f => <div key={f} className="flex items-center gap-1.5 text-xs text-[#9FB0C3] mb-1" style={{ fontFamily: B }}><CheckCircle className="w-3 h-3 text-[#10B981]" />{f}</div>)}
                    </div>
                  ))}
                </div>
              </Pnl>
            </div>
          )}

          {/* ═══════════ OPERATIONS ═══════════ */}
          {page === 'operations' && (
            <div className="space-y-6">
              <Sec title="Emergency Kill Switches">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { label: 'Tenant Suspension', desc: 'Suspend with data preserved', icon: Pause, active: true },
                    { label: 'Platform Read-Only Mode', desc: 'Disable all writes', icon: Lock, active: false },
                    { label: 'Feature Emergency Disable', desc: 'Kill specific features', icon: Power, active: false },
                    { label: 'API Freeze', desc: 'Block all API access', icon: AlertOctagon, active: false },
                    { label: 'AI Execution Halt', desc: 'Stop all Edge Functions', icon: Brain, active: false },
                    { label: 'Emergency Broadcast', desc: 'Notify all users', icon: Radio, active: false },
                  ].map(ks => (
                    <div key={ks.label} className="flex items-center gap-3 p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <ks.icon className="w-5 h-5 text-[#64748B] shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm text-[#F4F7FA]" style={{ fontFamily: B }}>{ks.label}</span>
                        <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: B }}>{ks.desc}</span>
                      </div>
                      <div className={`w-9 h-5 rounded-full cursor-pointer flex items-center px-0.5`} style={{ background: ks.active ? '#FF6A00' : '#243140' }}>
                        <div className={`w-4 h-4 rounded-full ${ks.active ? 'ml-auto bg-white' : 'bg-[#64748B]'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </Sec>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Automation Rules">
                  <div className="space-y-2">
                    {[
                      ['Auto-lockout after 5 failed logins', 'Planned', 'unknown'],
                      ['API key rotation (90 days)', 'Planned', 'unknown'],
                      ['Usage caps with throttling', 'Planned', 'unknown'],
                      ['Billing enforcement automation', 'Needs Stripe', 'unknown'],
                      ['Scheduled governance scans', 'Planned', 'unknown'],
                      ['Auto risk-pattern lockout', 'Planned', 'unknown'],
                    ].map(([l, v, s]) => <Row key={l} label={l} value={v} status={s} />)}
                  </div>
                </Sec>
                <Sec title="Internal Team Oversight">
                  <div className="space-y-2">
                    {[
                      ['Admin action leaderboard', 'Planned', 'unknown'],
                      ['SLA adherence monitoring', 'Planned', 'unknown'],
                      ['Ticket resolution heatmaps', 'Planned', 'unknown'],
                      ['Developer deployment frequency', 'Planned', 'unknown'],
                      ['Change failure rate', 'Planned', 'unknown'],
                    ].map(([l, v, s]) => <Row key={l} label={l} value={v} status={s} />)}
                  </div>
                </Sec>
              </div>
            </div>
          )}

          {/* ═══════════ GROWTH ═══════════ */}
          {page === 'growth' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mc label="Active Users" value={users.length} icon={Users} color="#F4F7FA" />
                <Mc label="Calibrated" value={stats?.calibrated || 0} icon={Shield} color="#3B82F6" sub={`${users.length > 0 ? Math.round(((stats?.calibrated || 0) / users.length) * 100) : 0}% rate`} />
                <Mc label="With Integrations" value={stats?.with_integrations || '—'} icon={Plug} color="#10B981" />
                <Mc label="Activation Rate" value="—" icon={Rocket} color="#FF6A00" sub="Needs telemetry" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Sec title="Growth Infrastructure">
                  <div className="space-y-2">
                    {[
                      ['White-label provisioning', 'Planned', 'unknown'],
                      ['Automated tenant cloning', 'Planned', 'unknown'],
                      ['Bulk tenant migration', 'Planned', 'unknown'],
                      ['Sandbox workspace generator', 'Planned', 'unknown'],
                      ['Referral tracking', 'Planned', 'unknown'],
                      ['Integration usage monitoring', 'Active — per-user', 'healthy'],
                      ['Activation milestone tracking', 'Partial — calibration', 'warning'],
                    ].map(([l, v, s]) => <Row key={l} label={l} value={v} status={s} />)}
                  </div>
                </Sec>
                <Sec title="Trust Signals (User-Facing)">
                  <div className="space-y-2">
                    {[
                      ['Transparent uptime panel', '/trust/centre', 'Ready'],
                      ['Data location disclosure', '/trust', 'Ready'],
                      ['Live security status', '/trust/security', 'Ready'],
                      ['Last backup indicator', null, 'Planned'],
                      ['Encryption badge detail', '/trust/security', 'Ready'],
                      ['Audit export button', null, 'Planned'],
                      ['Admin access transparency log', null, 'Planned'],
                    ].map(([l, href, s]) => (
                      <div key={l} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <StatusDot status={s === 'Ready' ? 'healthy' : 'unknown'} />
                        <span className="text-xs text-[#F4F7FA] flex-1" style={{ fontFamily: B }}>{l}</span>
                        <Badge text={s} color={s === 'Ready' ? '#10B981' : '#64748B'} />
                      </div>
                    ))}
                  </div>
                </Sec>
              </div>
              <Sec title="Configuration Intelligence">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Impact Preview', desc: 'Simulate config changes before apply', status: 'Planned' },
                    { label: 'Dependency Graph', desc: 'Visualise Edge Function dependencies', status: 'Planned' },
                    { label: 'Rollback Control', desc: 'Version control for config changes', status: 'Planned' },
                    { label: 'Config Drift Detection', desc: 'Alert when config deviates from baseline', status: 'Planned' },
                    { label: 'Feature Flags', desc: 'Environment-specific feature management', status: 'Planned' },
                    { label: 'Canary Releases', desc: 'Gradual rollout to subset of users', status: 'Planned' },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <span className="text-xs text-[#F4F7FA] block mb-1" style={{ fontFamily: B }}>{item.label}</span>
                      <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: B }}>{item.desc}</span>
                      <Badge text={item.status} color="#64748B" />
                    </div>
                  ))}
                </div>
              </Sec>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
