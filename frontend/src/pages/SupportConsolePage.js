import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Shield, CheckCircle2, Users, Key, UserX, Edit, Eye, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const TIER_COLORS = { free: '#64748B', starter: '#FF6A00', professional: '#7C3AED', enterprise: '#10B981', super_admin: '#EF4444' };

const SupportConsolePage = () => {
  const [admin, setAdmin] = useState(null);
  const [users, setUsers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('users');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [verifyRes, usersRes] = await Promise.allSettled([
          apiClient.get('/super-admin/verify'),
          apiClient.get('/support/users'),
        ]);
        if (verifyRes.status === 'fulfilled') setAdmin(verifyRes.value.data);
        if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data?.users || []);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const loadAudit = async () => {
    const res = await apiClient.get('/support/audit-log');
    setAuditLog(res.data?.actions || []);
  };

  const toggleUser = async (userId, disable) => {
    if (!window.confirm(`${disable ? 'Disable' : 'Enable'} this user?`)) return;
    setActionLoading(userId);
    try {
      await apiClient.post('/support/toggle-user', { user_id: userId, disable });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_disabled: disable } : u));
    } catch {} finally { setActionLoading(null); }
  };

  const resetPassword = async (userId, email) => {
    if (!window.confirm(`Send password reset to ${email}?`)) return;
    setActionLoading(userId);
    try {
      await apiClient.post('/support/reset-password', { user_id: userId, email });
      alert(`Password reset sent to ${email}`);
    } catch {} finally { setActionLoading(null); }
  };

  const updateTier = async (userId, newTier) => {
    if (!window.confirm(`Change subscription to ${newTier}?`)) return;
    setActionLoading(userId);
    try {
      await apiClient.post('/support/update-subscription', { user_id: userId, tier: newTier });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: newTier } : u));
    } catch {} finally { setActionLoading(null); }
  };

  const impersonate = async (userId) => {
    if (!window.confirm('Start impersonation? All actions will be logged.')) return;
    setActionLoading(userId);
    try {
      const res = await apiClient.post('/support/impersonate', { user_id: userId });
      alert(`Impersonation active for ${res.data?.target?.email}. Check audit log.`);
    } catch {} finally { setActionLoading(null); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 text-[#FF6A00] animate-spin" /></div></DashboardLayout>;

  if (!admin?.is_super_admin) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-12 h-12 text-[#EF4444] mx-auto mb-3" />
          <h2 className="text-lg text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Access Denied</h2>
          <p className="text-sm text-[#64748B]">Super admin role required.</p>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-[1200px]" style={{ fontFamily: BODY }} data-testid="support-console">
        {/* Admin Verified Banner */}
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#10B98108', border: '1px solid #10B98125' }}>
          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
          <div>
            <span className="text-sm font-semibold text-[#10B981]">Super Admin Verified</span>
            <span className="text-xs text-[#64748B] ml-3" style={{ fontFamily: MONO }}>{admin.email} | {admin.user_id?.substring(0, 8)}</span>
          </div>
        </div>

        {/* Feature Flags */}
        <div className="rounded-xl p-4" style={{ background: '#141C26', border: '1px solid #243140' }}>
          <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: MONO }}>Feature Flags</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(admin.feature_flags || {}).map(([k, v]) => (
              <span key={k} className="text-[10px] px-2 py-0.5 rounded" style={{ color: v ? '#10B981' : '#64748B', background: v ? '#10B98115' : '#24314050', fontFamily: MONO }}>{k}: {v ? 'ON' : 'OFF'}</span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#141C26', border: '1px solid #243140' }}>
          {[{ id: 'users', label: 'Users', icon: Users }, { id: 'audit', label: 'Audit Log', icon: Eye }].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'audit') loadAudit(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium ${tab === t.id ? 'text-[#F4F7FA]' : 'text-[#64748B]'}`}
              style={{ background: tab === t.id ? '#FF6A0015' : 'transparent', fontFamily: MONO }}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid #243140' }}>
                    {['Email', 'Name', 'Business', 'Tier', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[#64748B]" style={{ fontFamily: MONO }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const tc = TIER_COLORS[u.subscription_tier] || '#64748B';
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #1E293B' }} className={u.is_disabled ? 'opacity-50' : ''}>
                        <td className="px-3 py-2 text-[#F4F7FA]">{u.email}</td>
                        <td className="px-3 py-2 text-[#9FB0C3]">{u.full_name || '—'}</td>
                        <td className="px-3 py-2 text-[#9FB0C3]">{u.business_name || '—'}</td>
                        <td className="px-3 py-2">
                          <select value={u.subscription_tier || 'free'} onChange={e => updateTier(u.id, e.target.value)}
                            className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: tc + '15', color: tc, border: 'none', fontFamily: MONO }}>
                            {['free', 'starter', 'professional', 'enterprise', 'super_admin'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[10px]" style={{ color: u.is_disabled ? '#EF4444' : '#10B981', fontFamily: MONO }}>{u.is_disabled ? 'DISABLED' : 'ACTIVE'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => toggleUser(u.id, !u.is_disabled)} disabled={actionLoading === u.id}
                              className="p-1 rounded hover:bg-white/5" title={u.is_disabled ? 'Enable' : 'Disable'}>
                              <UserX className="w-3 h-3" style={{ color: u.is_disabled ? '#10B981' : '#EF4444' }} />
                            </button>
                            <button onClick={() => resetPassword(u.id, u.email)} disabled={actionLoading === u.id}
                              className="p-1 rounded hover:bg-white/5" title="Reset Password">
                              <Key className="w-3 h-3 text-[#F59E0B]" />
                            </button>
                            <button onClick={() => impersonate(u.id)} disabled={actionLoading === u.id}
                              className="p-1 rounded hover:bg-white/5" title="Impersonate">
                              <Eye className="w-3 h-3 text-[#3B82F6]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{users.length} users total</div>
          </div>
        )}

        {/* Audit Tab */}
        {tab === 'audit' && (
          <div className="rounded-xl p-4 space-y-1" style={{ background: '#141C26', border: '1px solid #243140' }}>
            {auditLog.length === 0 && <p className="text-xs text-[#64748B]">No admin actions recorded yet.</p>}
            {auditLog.map(a => (
              <div key={a.id} className="flex items-center gap-2 py-2 text-xs" style={{ borderBottom: '1px solid #1E293B' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.action_type?.includes('disable') ? '#EF4444' : '#10B981' }} />
                <span className="text-[#F4F7FA] flex-1">{a.action_type}</span>
                <span className="text-[#64748B]" style={{ fontFamily: MONO }}>{a.target_user_id?.substring(0, 8)}</span>
                <span className="text-[10px] text-[#64748B]">{a.created_at ? new Date(a.created_at).toLocaleString('en-AU') : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SupportConsolePage;
