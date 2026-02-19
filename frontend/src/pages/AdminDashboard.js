import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { RefreshCw, Users, Activity, Shield, Eye, ChevronRight, Search } from 'lucide-react';

const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('users');

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
      console.error('Admin load failed:', e);
    } finally { setLoading(false); }
  };

  const loadUserDetail = async (userId) => {
    setSelectedUser(userId);
    setLoadingDetail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Authorization': `Bearer ${session.access_token}` };
      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

      const [bp, scs, uop, integrations, snapshots, signals] = await Promise.all([
        supabase.from('business_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('strategic_console_state').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_operator_profile').select('persona_calibration_status, agent_persona, updated_at').eq('user_id', userId).maybeSingle(),
        supabase.from('integration_accounts').select('provider, category, connected_at').eq('user_id', userId),
        supabase.from('intelligence_snapshots').select('snapshot_type, generated_at, resolution_score').eq('user_id', userId).order('generated_at', { ascending: false }).limit(5),
        supabase.from('observation_events').select('id', { count: 'exact' }).eq('user_id', userId),
      ]);

      setUserDetail({
        business_profile: bp.data,
        console_state: scs.data,
        operator_profile: uop.data,
        integrations: integrations.data || [],
        snapshots: snapshots.data || [],
        signal_count: signals.count || 0,
      });
    } catch (e) {
      console.error('Detail load failed:', e);
    } finally { setLoadingDetail(false); }
  };

  const forceCompleteCalibration = async (userId) => {
    try {
      await supabase.from('strategic_console_state').upsert({
        user_id: userId, status: 'COMPLETED', current_step: 17, is_complete: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      await supabase.from('user_operator_profile').upsert({
        user_id: userId, persona_calibration_status: 'complete',
        operator_profile: { onboarding_state: { completed: true, current_step: 14 } },
      }, { onConflict: 'user_id' });
      alert('Calibration force-completed');
      loadUserDetail(userId);
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const updateUserRole = async (userId, role) => {
    try {
      await apiClient.put(`/admin/users/${userId}`, { role });
      loadData();
      alert('Role updated to ' + role);
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const suspendUser = async (userId) => {
    if (!confirm('Suspend this user? They will be locked out.')) return;
    try {
      await apiClient.post(`/admin/users/${userId}/suspend`);
      alert('User suspended');
      loadData();
      loadUserDetail(userId);
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const unsuspendUser = async (userId) => {
    try {
      await apiClient.post(`/admin/users/${userId}/unsuspend`);
      alert('User unsuspended');
      loadData();
      loadUserDetail(userId);
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const [impersonating, setImpersonating] = useState(null);
  const [impersonateData, setImpersonateData] = useState(null);

  const impersonateUser = async (userId) => {
    try {
      const res = await apiClient.post(`/admin/users/${userId}/impersonate`);
      const token = res.data?.token || res.data?.access_token;
      if (!token) { alert('No token returned from server'); return; }

      // Store admin token so we can restore it
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.access_token) {
        localStorage.setItem('biqc_admin_token_backup', currentSession.access_token);
        localStorage.setItem('biqc_admin_refresh_backup', currentSession.refresh_token || '');
      }

      // Switch to impersonated user session
      const { error } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: res.data?.refresh_token || token,
      });

      if (error) { alert('Session switch failed: ' + error.message); return; }

      setImpersonateData(res.data);
      setImpersonating(userId);

      // Redirect to advisor as the impersonated user
      window.location.href = '/advisor';
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const exitImpersonation = async () => {
    try {
      const adminToken = localStorage.getItem('biqc_admin_token_backup');
      const adminRefresh = localStorage.getItem('biqc_admin_refresh_backup');

      if (adminToken) {
        await supabase.auth.setSession({
          access_token: adminToken,
          refresh_token: adminRefresh || adminToken,
        });
        localStorage.removeItem('biqc_admin_token_backup');
        localStorage.removeItem('biqc_admin_refresh_backup');
      }

      setImpersonating(null);
      setImpersonateData(null);
      window.location.href = '/admin';
    } catch (e) {
      localStorage.removeItem('biqc_admin_token_backup');
      localStorage.removeItem('biqc_admin_refresh_backup');
      window.location.href = '/admin';
    }
  };

  const filteredUsers = users.filter(u =>
    !search || (u.email || '').toLowerCase().includes(search.toLowerCase()) || (u.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const now = new Date();

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-56px)] p-6 md:p-10" style={{ background: '#FAFAF8', fontFamily: HEAD }}>
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Admin Console</h1>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>System oversight and user management</p>
            </div>
            <button onClick={loadData} className="flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg" style={{ color: '#6B7280', border: '1px solid #E5E7EB' }}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Users', value: stats.total_users || users.length, icon: Users, color: '#3B82F6' },
                { label: 'Calibrated', value: stats.calibrated_users || 0, icon: Shield, color: '#22C55E' },
                { label: 'Active Today', value: users.filter(u => { try { return u.last_sign_in_at && (now - new Date(u.last_sign_in_at)) / 3600000 < 24; } catch { return false; } }).length, icon: Activity, color: '#F59E0B' },
                { label: 'Integrations', value: stats.total_integrations || 0, icon: Eye, color: '#8B5CF6' },
              ].map((s, i) => (
                <div key={i} className="p-5 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <s.icon className="w-4 h-4" style={{ color: s.color }} />
                    <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>{s.label}</span>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: '#111827' }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-6">
            {['users', 'activity', 'system'].map(t => (
              <button key={t} onClick={() => setTab(t)} className="text-xs font-medium px-4 py-2 rounded-lg" style={{ background: tab === t ? '#111827' : 'transparent', color: tab === t ? '#FFF' : '#6B7280' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Users Tab */}
          {tab === 'users' && (
            <div className="flex gap-6">
              {/* User List */}
              <div className="flex-1">
                <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <Search className="w-4 h-4" style={{ color: '#9CA3AF' }} />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="flex-1 text-sm outline-none bg-transparent" style={{ color: '#1F2937' }} />
                </div>
                <div className="space-y-2">
                  {loading ? (
                    <div className="text-center py-8"><div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto" /></div>
                  ) : filteredUsers.map(u => {
                    const lastSign = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null;
                    const minsAgo = lastSign ? Math.round((now - lastSign) / 60000) : null;
                    const isOnline = minsAgo !== null && minsAgo < 30;
                    return (
                      <button key={u.id} onClick={() => loadUserDetail(u.id)}
                        className="w-full text-left p-4 rounded-xl flex items-center justify-between transition-all hover:shadow-sm"
                        style={{ background: selectedUser === u.id ? '#F0F9FF' : '#FFF', border: selectedUser === u.id ? '1px solid #93C5FD' : '1px solid rgba(0,0,0,0.06)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#F3F4F6', color: '#374151' }}>
                            {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium" style={{ color: '#1F2937' }}>{u.full_name || 'No name'}</span>
                              {isOnline && <span className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />}
                              {u.role === 'superadmin' && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#EEF2FF', color: '#4F46E5', fontFamily: MONO }}>ADMIN</span>}
                            </div>
                            <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{u.email}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] block" style={{ color: isOnline ? '#22C55E' : '#9CA3AF', fontFamily: MONO }}>
                            {isOnline ? 'Online' : minsAgo !== null ? (minsAgo < 60 ? minsAgo + 'm' : minsAgo < 1440 ? Math.round(minsAgo / 60) + 'h' : Math.round(minsAgo / 1440) + 'd') + ' ago' : 'Never'}
                          </span>
                          <ChevronRight className="w-3 h-3 mt-1 ml-auto" style={{ color: '#D1D5DB' }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User Detail Panel */}
              {selectedUser && (
                <div className="w-96 shrink-0">
                  {loadingDetail ? (
                    <div className="text-center py-12"><div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto" /></div>
                  ) : userDetail && (
                    <div className="space-y-4">
                      <div className="p-5 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.06)' }}>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Business Profile</h3>
                        {userDetail.business_profile ? (
                          <div className="space-y-2">
                            {['business_name', 'industry', 'business_stage', 'location', 'team_size'].map(f => (
                              <div key={f}><span className="text-[10px] uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>{f.replace(/_/g, ' ')}</span>
                                <p className="text-xs" style={{ color: '#374151' }}>{userDetail.business_profile[f] || 'Empty'}</p></div>
                            ))}
                          </div>
                        ) : <p className="text-xs" style={{ color: '#9CA3AF' }}>No business profile</p>}
                      </div>

                      <div className="p-5 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.06)' }}>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Status</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between"><span className="text-[10px] uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>Calibrated</span>
                            <span className="text-xs font-medium" style={{ color: userDetail.console_state?.is_complete ? '#22C55E' : '#EF4444' }}>{userDetail.console_state?.is_complete ? 'Yes' : 'No'}</span></div>
                          <div className="flex justify-between"><span className="text-[10px] uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>Persona</span>
                            <span className="text-xs" style={{ color: '#374151' }}>{userDetail.operator_profile?.persona_calibration_status || 'Not set'}</span></div>
                          <div className="flex justify-between"><span className="text-[10px] uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>Signals</span>
                            <span className="text-xs font-medium" style={{ color: '#374151' }}>{userDetail.signal_count}</span></div>
                          <div className="flex justify-between"><span className="text-[10px] uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>Integrations</span>
                            <span className="text-xs" style={{ color: '#374151' }}>{userDetail.integrations.length}</span></div>
                        </div>
                        {userDetail.integrations.length > 0 && (
                          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                            {userDetail.integrations.map((ig, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full mr-1 mb-1 inline-block" style={{ background: '#F3F4F6', color: '#6B7280', fontFamily: MONO }}>{ig.provider}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-5 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.06)' }}>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Snapshots</h3>
                        {userDetail.snapshots.length > 0 ? userDetail.snapshots.map((s, i) => (
                          <div key={i} className="flex justify-between mb-2">
                            <span className="text-[10px]" style={{ color: '#6B7280', fontFamily: MONO }}>{s.snapshot_type}</span>
                            <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: MONO }}>{new Date(s.generated_at).toLocaleString('en-AU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                          </div>
                        )) : <p className="text-[10px]" style={{ color: '#9CA3AF' }}>No snapshots</p>}
                      </div>

                      <div className="p-5 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.06)' }}>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Support Actions</h3>
                        <div className="space-y-2">
                          {!userDetail.console_state?.is_complete && (
                            <button onClick={() => forceCompleteCalibration(selectedUser)} className="w-full text-xs font-medium px-3 py-2 rounded-lg text-left" style={{ color: '#22C55E', border: '1px solid #BBF7D0', background: '#F0FDF4' }}>
                              Force-Complete Calibration
                            </button>
                          )}
                          <button onClick={() => impersonateUser(selectedUser)} className="w-full text-xs font-medium px-3 py-2 rounded-lg text-left" style={{ color: '#3B82F6', border: '1px solid #93C5FD', background: '#EFF6FF' }}>
                            View as This User
                          </button>
                          {users.find(u => u.id === selectedUser)?.role !== 'suspended' ? (
                            <button onClick={() => suspendUser(selectedUser)} className="w-full text-xs font-medium px-3 py-2 rounded-lg text-left" style={{ color: '#EF4444', border: '1px solid #FECACA', background: '#FEF2F2' }}>
                              Suspend Account
                            </button>
                          ) : (
                            <button onClick={() => unsuspendUser(selectedUser)} className="w-full text-xs font-medium px-3 py-2 rounded-lg text-left" style={{ color: '#22C55E', border: '1px solid #BBF7D0', background: '#F0FDF4' }}>
                              Unsuspend Account
                            </button>
                          )}
                          <button onClick={() => updateUserRole(selectedUser, 'superadmin')} className="w-full text-xs font-medium px-3 py-2 rounded-lg text-left" style={{ color: '#4F46E5', border: '1px solid #C7D2FE', background: '#EEF2FF' }}>
                            Promote to Admin
                          </button>
                          <button onClick={() => updateUserRole(selectedUser, 'user')} className="w-full text-xs font-medium px-3 py-2 rounded-lg text-left" style={{ color: '#6B7280', border: '1px solid #E5E7EB' }}>
                            Set as Regular User
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {tab === 'activity' && (
            <div className="p-6 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.06)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Live User Activity</h3>
              <div className="space-y-3">
                {users.sort((a, b) => new Date(b.last_sign_in_at || 0) - new Date(a.last_sign_in_at || 0)).map(u => {
                  const lastSign = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null;
                  const minsAgo = lastSign ? Math.round((now - lastSign) / 60000) : null;
                  const isOnline = minsAgo !== null && minsAgo < 30;
                  return (
                    <div key={u.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full" style={{ background: isOnline ? '#22C55E' : '#E5E7EB' }} />
                        <span className="text-sm" style={{ color: '#1F2937' }}>{u.full_name || u.email}</span>
                        <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{u.email}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: MONO }}>{u.company_name || '—'}</span>
                        <span className="text-[10px] font-medium" style={{ color: isOnline ? '#22C55E' : '#9CA3AF', fontFamily: MONO }}>
                          {isOnline ? 'ONLINE' : lastSign ? (minsAgo < 60 ? minsAgo + 'm ago' : minsAgo < 1440 ? Math.round(minsAgo / 60) + 'h ago' : Math.round(minsAgo / 1440) + 'd ago') : 'Never'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* System Tab */}
          {tab === 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Edge Functions</h3>
                {['intelligence-snapshot', 'biqc-insights-cognitive', 'strategic-console-ai', 'boardroom-diagnosis', 'market-analysis-ai', 'calibration-psych', 'calibration-business-dna'].map(f => (
                  <div key={f} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <span className="text-xs" style={{ color: '#374151', fontFamily: MONO }}>{f}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#F0FDF4', color: '#22C55E', fontFamily: MONO }}>Deployed</span>
                  </div>
                ))}
              </div>
              <div className="p-6 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Data Sources</h3>
                {['Supabase PostgreSQL', 'HubSpot (Merge.dev)', 'Xero (Merge.dev)', 'Outlook Email', 'Firecrawl Market Intel', 'OpenAI GPT-4o'].map(s => (
                  <div key={s} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <span className="text-xs" style={{ color: '#374151' }}>{s}</span>
                    <span className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Impersonation Overlay */}
          {impersonating && impersonateData && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-8 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 mb-8" style={{ fontFamily: HEAD }}>
                <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl" style={{ background: '#EFF6FF', borderBottom: '1px solid #93C5FD' }}>
                  <div className="flex items-center gap-3">
                    <Eye className="w-4 h-4" style={{ color: '#3B82F6' }} />
                    <span className="text-sm font-semibold" style={{ color: '#1E40AF' }}>Viewing as: {impersonateData.user?.full_name || impersonateData.user?.email}</span>
                  </div>
                  <button onClick={exitImpersonation} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ color: '#1E40AF', border: '1px solid #93C5FD' }}>Exit Impersonation</button>
                </div>
                <div className="p-6 space-y-6">
                  {/* User Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-semibold" style={{ color: '#9CA3AF', fontFamily: MONO }}>Email</span>
                      <p className="text-sm" style={{ color: '#1F2937' }}>{impersonateData.user?.email}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold" style={{ color: '#9CA3AF', fontFamily: MONO }}>Role</span>
                      <p className="text-sm" style={{ color: '#1F2937' }}>{impersonateData.user?.role}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold" style={{ color: '#9CA3AF', fontFamily: MONO }}>Company</span>
                      <p className="text-sm" style={{ color: '#1F2937' }}>{impersonateData.user?.company_name || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold" style={{ color: '#9CA3AF', fontFamily: MONO }}>Tier</span>
                      <p className="text-sm" style={{ color: '#1F2937' }}>{impersonateData.user?.subscription_tier}</p>
                    </div>
                  </div>

                  {/* Business Profile */}
                  {impersonateData.business_profile && (
                    <div>
                      <h3 className="text-xs font-semibold mb-3" style={{ color: '#111827' }}>Business DNA</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {['business_name', 'industry', 'business_stage', 'location', 'target_market', 'business_model', 'team_size', 'growth_goals', 'risk_profile', 'main_products_services', 'unique_value_proposition', 'mission_statement'].map(f => {
                          const val = impersonateData.business_profile[f];
                          return val ? (
                            <div key={f}>
                              <span className="text-[9px] uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>{f.replace(/_/g, ' ')}</span>
                              <p className="text-xs" style={{ color: '#374151' }}>{String(val).substring(0, 100)}{String(val).length > 100 ? '...' : ''}</p>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Snapshots */}
                  {impersonateData.snapshots?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold mb-3" style={{ color: '#111827' }}>Latest Intelligence</h3>
                      {impersonateData.snapshots.filter(s => s.snapshot_type === 'cognitive_full').slice(0, 1).map((s, i) => {
                        const memo = s.executive_memo;
                        return (
                          <div key={i} className="p-4 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] font-semibold" style={{ color: memo?.system_state === 'CRITICAL' ? '#EF4444' : memo?.system_state === 'DRIFT' ? '#F59E0B' : '#22C55E', fontFamily: MONO }}>{memo?.system_state || '?'}</span>
                              <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{new Date(s.generated_at).toLocaleString('en-AU')}</span>
                            </div>
                            {memo?.executive_memo && <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>{String(memo.executive_memo).substring(0, 300)}...</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Integrations + Stats */}
                  <div className="flex gap-4">
                    <div className="flex-1 p-3 rounded-lg" style={{ background: '#F9FAFB' }}>
                      <span className="text-[10px] uppercase font-semibold" style={{ color: '#9CA3AF', fontFamily: MONO }}>Integrations</span>
                      <p className="text-lg font-bold" style={{ color: '#111827' }}>{impersonateData.integrations?.length || 0}</p>
                      {impersonateData.integrations?.map((ig, i) => <span key={i} className="text-[10px] mr-1" style={{ color: '#6B7280', fontFamily: MONO }}>{ig.provider}</span>)}
                    </div>
                    <div className="flex-1 p-3 rounded-lg" style={{ background: '#F9FAFB' }}>
                      <span className="text-[10px] uppercase font-semibold" style={{ color: '#9CA3AF', fontFamily: MONO }}>Signals</span>
                      <p className="text-lg font-bold" style={{ color: '#111827' }}>{impersonateData.signal_count || 0}</p>
                    </div>
                    <div className="flex-1 p-3 rounded-lg" style={{ background: '#F9FAFB' }}>
                      <span className="text-[10px] uppercase font-semibold" style={{ color: '#9CA3AF', fontFamily: MONO }}>Calibrated</span>
                      <p className="text-lg font-bold" style={{ color: impersonateData.console_state?.is_complete ? '#22C55E' : '#EF4444' }}>{impersonateData.console_state?.is_complete ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
