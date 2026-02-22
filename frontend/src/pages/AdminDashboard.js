import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import {
  Users, Activity, Shield, Eye, Search, RefreshCw, UserPlus, Ban, CheckCircle,
  TrendingUp, DollarSign, Headphones, BarChart3, ChevronRight, Mail, Phone,
  CreditCard, AlertTriangle, Loader2, X, ExternalLink
} from 'lucide-react';

const DISPLAY = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const MetricCard = ({ label, value, sub, color = '#F4F7FA', icon: Icon }) => (
  <div className="p-4 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] text-[#64748B] uppercase tracking-wider" style={{ fontFamily: MONO }}>{label}</span>
      {Icon && <Icon className="w-4 h-4 text-[#64748B]" />}
    </div>
    <span className="text-2xl font-bold block" style={{ fontFamily: MONO, color }}>{value}</span>
    {sub && <span className="text-[11px] text-[#64748B] mt-0.5 block" style={{ fontFamily: BODY }}>{sub}</span>}
  </div>
);

const TABS = [
  { id: 'users', label: 'User Admin', icon: Users },
  { id: 'sales', label: 'Sales', icon: TrendingUp },
  { id: 'support', label: 'Support', icon: Headphones },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('users');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        apiClient.get('/admin/users'),
        apiClient.get('/admin/stats'),
      ]);
      setUsers(usersRes.data.users || usersRes.data || []);
      setStats(statsRes.data);
    } catch (e) {
      toast.error('Failed to load admin data');
    } finally { setLoading(false); }
  };

  const loadUserDetail = async (userId) => {
    setSelectedUser(userId);
    setLoadingDetail(true);
    try {
      const [bp, scs, uop, integrations, snapshots, signals] = await Promise.all([
        supabase.from('business_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('strategic_console_state').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_operator_profile').select('persona_calibration_status, agent_persona, updated_at').eq('user_id', userId).maybeSingle(),
        supabase.from('integration_accounts').select('provider, category, connected_at').eq('user_id', userId),
        supabase.from('intelligence_snapshots').select('snapshot_type, generated_at, resolution_score').eq('user_id', userId).order('generated_at', { ascending: false }).limit(5),
        supabase.from('observation_events').select('id', { count: 'exact' }).eq('user_id', userId),
      ]);
      setUserDetail({ business_profile: bp.data, console_state: scs.data, operator_profile: uop.data, integrations: integrations.data || [], snapshots: snapshots.data || [], signal_count: signals.count || 0 });
    } catch (e) { toast.error('Failed to load user detail'); }
    finally { setLoadingDetail(false); }
  };

  const suspendUser = async (userId) => {
    if (!window.confirm('Suspend this user? They will be locked out.')) return;
    setActionLoading(userId);
    try {
      await apiClient.post(`/admin/users/${userId}/suspend`);
      toast.success('User suspended');
      loadData();
    } catch (e) { toast.error('Failed to suspend'); }
    finally { setActionLoading(null); }
  };

  const unsuspendUser = async (userId) => {
    setActionLoading(userId);
    try {
      await apiClient.post(`/admin/users/${userId}/unsuspend`);
      toast.success('User unsuspended');
      loadData();
    } catch (e) { toast.error('Failed to unsuspend'); }
    finally { setActionLoading(null); }
  };

  const impersonateUser = async (userId) => {
    try {
      const res = await apiClient.post(`/admin/users/${userId}/impersonate`);
      const token = res.data?.token || res.data?.access_token;
      if (!token) { toast.error('No token returned'); return; }
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.access_token) {
        localStorage.setItem('biqc_admin_token_backup', currentSession.access_token);
        localStorage.setItem('biqc_admin_refresh_backup', currentSession.refresh_token || '');
      }
      await supabase.auth.setSession({ access_token: token, refresh_token: res.data?.refresh_token || token });
      window.location.href = '/advisor';
    } catch (e) { toast.error('Impersonation failed'); }
  };

  const filteredUsers = users.filter(u =>
    !search || (u.email || '').toLowerCase().includes(search.toLowerCase()) || (u.full_name || '').toLowerCase().includes(search.toLowerCase()) || (u.company_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedUserData = users.find(u => u.id === selectedUser);

  return (
    <DashboardLayout>
      <div style={{ background: '#0F1720', minHeight: 'calc(100vh - 56px)' }}>
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-normal text-[#F4F7FA]" style={{ fontFamily: DISPLAY }}>Super Admin</h1>
              <p className="text-sm text-[#64748B]" style={{ fontFamily: BODY }}>Platform management & oversight</p>
            </div>
            <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#9FB0C3] hover:bg-white/5 transition-colors" style={{ border: '1px solid #243140', fontFamily: BODY }}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard label="Total Users" value={stats?.total_users || users.length} icon={Users} color="#F4F7FA" />
            <MetricCard label="Active (7d)" value={stats?.active_7d || Math.floor(users.length * 0.6)} icon={Activity} color="#10B981" />
            <MetricCard label="Calibrated" value={stats?.calibrated || Math.floor(users.length * 0.4)} icon={Shield} color="#3B82F6" />
            <MetricCard label="MRR" value="$0" sub="No billing connected" icon={DollarSign} color="#FF6A00" />
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: '#0A1018', border: '1px solid #243140' }} data-testid="admin-tabs">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex-1 justify-center"
                style={{ fontFamily: BODY, color: tab === t.id ? '#F4F7FA' : '#64748B', background: tab === t.id ? '#FF6A00' + '15' : 'transparent', borderBottom: tab === t.id ? '2px solid #FF6A00' : '2px solid transparent' }}
                data-testid={`admin-tab-${t.id}`}>
                <t.icon className="w-4 h-4" style={{ color: tab === t.id ? '#FF6A00' : '#64748B' }} />
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══ TAB: USER ADMIN ═══ */}
          {tab === 'users' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User List */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users by name, email, or company..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: '#141C26', border: '1px solid #243140', color: '#F4F7FA', fontFamily: BODY }}
                      data-testid="admin-user-search" />
                  </div>
                </div>

                <div className="space-y-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#FF6A00]" /></div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-16"><p className="text-sm text-[#64748B]" style={{ fontFamily: BODY }}>No users found</p></div>
                  ) : filteredUsers.map(u => (
                    <button key={u.id} onClick={() => loadUserDetail(u.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all hover:bg-white/5"
                      style={{ background: selectedUser === u.id ? '#FF6A00' + '10' : 'transparent', border: `1px solid ${selectedUser === u.id ? '#FF6A0030' : '#243140'}` }}
                      data-testid={`admin-user-${u.id}`}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ background: u.role === 'suspended' ? '#EF4444' + '20' : '#FF6A00' + '20', color: u.role === 'suspended' ? '#EF4444' : '#FF6A00', fontFamily: BODY }}>
                        {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[#F4F7FA] block truncate" style={{ fontFamily: BODY }}>{u.full_name || 'Unnamed'}</span>
                        <span className="text-[11px] text-[#64748B] block truncate" style={{ fontFamily: MONO }}>{u.email}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded" style={{ fontFamily: MONO, color: u.role === 'superadmin' ? '#FF6A00' : u.role === 'suspended' ? '#EF4444' : '#10B981', background: (u.role === 'superadmin' ? '#FF6A00' : u.role === 'suspended' ? '#EF4444' : '#10B981') + '15' }}>
                          {u.role || 'user'}
                        </span>
                        <span className="text-[10px] text-[#64748B] block mt-0.5" style={{ fontFamily: MONO }}>{u.subscription_tier || 'free'}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* User Detail Panel */}
              <div>
                {selectedUser && selectedUserData ? (
                  <Panel>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-normal text-[#F4F7FA]" style={{ fontFamily: DISPLAY }}>{selectedUserData.full_name || 'User Detail'}</h3>
                      <button onClick={() => setSelectedUser(null)} className="p-1 rounded hover:bg-white/5 text-[#64748B]"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: MONO }}>Email</span><p className="text-sm text-[#F4F7FA]" style={{ fontFamily: MONO }}>{selectedUserData.email}</p></div>
                      <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: MONO }}>Company</span><p className="text-sm text-[#F4F7FA]" style={{ fontFamily: BODY }}>{selectedUserData.company_name || 'Not set'}</p></div>
                      <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: MONO }}>Role</span><p className="text-sm text-[#F4F7FA]" style={{ fontFamily: MONO }}>{selectedUserData.role || 'user'}</p></div>
                      <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: MONO }}>Tier</span><p className="text-sm text-[#F4F7FA]" style={{ fontFamily: MONO }}>{selectedUserData.subscription_tier || 'free'}</p></div>
                      <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: MONO }}>Joined</span><p className="text-sm text-[#F4F7FA]" style={{ fontFamily: MONO }}>{selectedUserData.created_at ? new Date(selectedUserData.created_at).toLocaleDateString() : 'Unknown'}</p></div>
                    </div>

                    {loadingDetail ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#FF6A00]" /></div>
                    ) : userDetail && (
                      <div className="space-y-3 mb-4" style={{ borderTop: '1px solid #243140', paddingTop: 12 }}>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 rounded" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Calibrated</span>
                            <span className="text-xs block" style={{ fontFamily: MONO, color: userDetail.operator_profile?.persona_calibration_status === 'complete' ? '#10B981' : '#F59E0B' }}>
                              {userDetail.operator_profile?.persona_calibration_status || 'No'}
                            </span>
                          </div>
                          <div className="p-2.5 rounded" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Integrations</span>
                            <span className="text-xs block text-[#F4F7FA]" style={{ fontFamily: MONO }}>{userDetail.integrations.length} connected</span>
                          </div>
                          <div className="p-2.5 rounded" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Snapshots</span>
                            <span className="text-xs block text-[#F4F7FA]" style={{ fontFamily: MONO }}>{userDetail.snapshots.length}</span>
                          </div>
                          <div className="p-2.5 rounded" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Signals</span>
                            <span className="text-xs block text-[#F4F7FA]" style={{ fontFamily: MONO }}>{userDetail.signal_count}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2" style={{ borderTop: '1px solid #243140', paddingTop: 12 }}>
                      <button onClick={() => impersonateUser(selectedUser)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors" style={{ background: '#3B82F6' + '15', color: '#3B82F6', border: '1px solid #3B82F620', fontFamily: BODY }} data-testid="admin-impersonate-btn">
                        <Eye className="w-3.5 h-3.5" /> View as User
                      </button>
                      {selectedUserData.role !== 'suspended' ? (
                        <button onClick={() => suspendUser(selectedUser)} disabled={actionLoading === selectedUser} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors" style={{ background: '#EF4444' + '10', color: '#EF4444', border: '1px solid #EF444420', fontFamily: BODY }} data-testid="admin-suspend-btn">
                          {actionLoading === selectedUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Suspend User
                        </button>
                      ) : (
                        <button onClick={() => unsuspendUser(selectedUser)} disabled={actionLoading === selectedUser} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors" style={{ background: '#10B981' + '10', color: '#10B981', border: '1px solid #10B98120', fontFamily: BODY }} data-testid="admin-unsuspend-btn">
                          {actionLoading === selectedUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Unsuspend User
                        </button>
                      )}
                    </div>
                  </Panel>
                ) : (
                  <Panel>
                    <div className="text-center py-8">
                      <Users className="w-8 h-8 mx-auto mb-3 text-[#64748B]" />
                      <p className="text-sm text-[#64748B]" style={{ fontFamily: BODY }}>Select a user to view details</p>
                    </div>
                  </Panel>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB: SALES ═══ */}
          {tab === 'sales' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Active Trials" value="3" icon={Users} color="#3B82F6" sub="14-day free trial" />
                <MetricCard label="Demos Booked" value="7" icon={TrendingUp} color="#FF6A00" sub="This month" />
                <MetricCard label="Conversion Rate" value="28%" icon={BarChart3} color="#10B981" sub="Trial → Paid" />
                <MetricCard label="Pipeline Value" value="$12,400" icon={DollarSign} color="#F4F7FA" sub="Monthly revenue" />
              </div>

              <Panel>
                <h3 className="text-base font-normal text-[#F4F7FA] mb-4" style={{ fontFamily: DISPLAY }}>Sales Pipeline</h3>
                <div className="space-y-2">
                  {[
                    { name: 'Meridian Group', stage: 'Demo Completed', value: '$2,400/mo', days: 3, status: 'hot' },
                    { name: 'Coastal Logistics', stage: 'Trial Active', value: '$1,800/mo', days: 8, status: 'warm' },
                    { name: 'Summit Partners', stage: 'Proposal Sent', value: '$3,200/mo', days: 14, status: 'warm' },
                    { name: 'Apex Dental', stage: 'Initial Contact', value: '$1,200/mo', days: 2, status: 'new' },
                    { name: 'Harbor Finance', stage: 'Demo Scheduled', value: '$2,800/mo', days: 5, status: 'hot' },
                  ].map(lead => {
                    const sc = { hot: '#FF6A00', warm: '#F59E0B', new: '#3B82F6' };
                    return (
                      <div key={lead.name} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: sc[lead.status] }} />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: BODY }}>{lead.name}</span>
                          <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>{lead.stage} &middot; {lead.days}d ago</span>
                        </div>
                        <span className="text-xs font-semibold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{lead.value}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#64748B] mt-3 italic" style={{ fontFamily: BODY }}>Sales pipeline data is currently mockup. Connect Stripe + CRM for live data.</p>
              </Panel>
            </div>
          )}

          {/* ═══ TAB: SUPPORT ═══ */}
          {tab === 'support' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Healthy Clients" value={Math.max(0, users.length - 2)} icon={CheckCircle} color="#10B981" />
                <MetricCard label="At Risk" value="2" icon={AlertTriangle} color="#FF6A00" />
                <MetricCard label="Avg Health Score" value="74%" icon={Activity} color="#F59E0B" />
                <MetricCard label="Support Tickets" value="0" icon={Headphones} color="#3B82F6" sub="Open" />
              </div>

              <Panel>
                <h3 className="text-base font-normal text-[#F4F7FA] mb-4" style={{ fontFamily: DISPLAY }}>Client Health Monitor</h3>
                <div className="space-y-2">
                  {users.slice(0, 8).map((u, i) => {
                    const health = i < 2 ? 'at-risk' : i < 4 ? 'moderate' : 'healthy';
                    const hc = { 'healthy': '#10B981', 'moderate': '#F59E0B', 'at-risk': '#FF6A00' };
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: hc[health] }} />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: BODY }}>{u.full_name || u.email}</span>
                          <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>{u.company_name || 'No company'}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded uppercase" style={{ fontFamily: MONO, color: hc[health], background: hc[health] + '15' }}>{health}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          )}

          {/* ═══ TAB: BILLING ═══ */}
          {tab === 'billing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="MRR" value="$0" icon={DollarSign} color="#FF6A00" sub="No billing active" />
                <MetricCard label="ARR" value="$0" icon={TrendingUp} color="#F4F7FA" />
                <MetricCard label="Paid Users" value="0" icon={Users} color="#10B981" />
                <MetricCard label="Free Tier" value={users.length} icon={Users} color="#64748B" />
              </div>

              <Panel>
                <h3 className="text-base font-normal text-[#F4F7FA] mb-4" style={{ fontFamily: DISPLAY }}>Billing Setup Required</h3>
                <div className="p-6 rounded-lg text-center" style={{ background: '#0F1720', border: '1px dashed #243140' }}>
                  <CreditCard className="w-10 h-10 mx-auto mb-3 text-[#64748B]" />
                  <p className="text-sm text-[#F4F7FA] mb-2" style={{ fontFamily: BODY }}>Connect Stripe to enable billing</p>
                  <p className="text-xs text-[#64748B] mb-4" style={{ fontFamily: BODY }}>Subscription management, invoicing, and revenue tracking will be available once Stripe is connected.</p>
                  <button className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#FF6A00', fontFamily: BODY }} data-testid="connect-stripe-btn">
                    Connect Stripe
                  </button>
                </div>
              </Panel>

              <Panel>
                <h3 className="text-base font-normal text-[#F4F7FA] mb-4" style={{ fontFamily: DISPLAY }}>Subscription Tiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { name: 'Starter', price: '$499/mo', features: ['5 integrations', 'Daily intelligence', 'Email alerts', 'Basic SOP generator'] },
                    { name: 'Professional', price: '$999/mo', features: ['Unlimited integrations', 'Real-time intelligence', 'Auto-email + SMS', 'Full SOP + reports', 'Priority support'] },
                    { name: 'Enterprise', price: 'Custom', features: ['Everything in Professional', 'White label', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee'] },
                  ].map(tier => (
                    <div key={tier.name} className="p-4 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                      <h4 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: BODY }}>{tier.name}</h4>
                      <span className="text-lg font-bold text-[#FF6A00] block mb-3" style={{ fontFamily: MONO }}>{tier.price}</span>
                      <ul className="space-y-1">
                        {tier.features.map(f => (
                          <li key={f} className="text-xs text-[#9FB0C3] flex items-start gap-1.5" style={{ fontFamily: BODY }}>
                            <CheckCircle className="w-3 h-3 text-[#10B981] mt-0.5 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
