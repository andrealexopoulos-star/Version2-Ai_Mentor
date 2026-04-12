import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Shield, CheckCircle2, Users, Key, UserX, Edit, Eye, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const TIER_COLORS = { free: '#64748B', starter: '#E85D00', professional: '#E85D00', growth: '#E85D00', enterprise: '#E85D00', super_admin: '#EF4444' };
const TIER_LABELS = { free: 'Free', starter: 'BIQc Foundation $349', professional: 'BIQc Foundation $349', growth: 'BIQc Foundation $349', enterprise: 'BIQc Foundation $349', super_admin: 'Super Admin' };

const SupportConsolePage = () => {
  const [admin, setAdmin] = useState(null);
  const [users, setUsers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('users');
  const [actionLoading, setActionLoading] = useState(null);
  const [contacts, setContacts] = useState([]);

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

  const loadContacts = async () => {
    try {
      const res = await apiClient.get('/enterprise/contact-requests');
      setContacts(res.data?.requests || []);
    } catch {}
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

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 text-[#E85D00] animate-spin" /></div></DashboardLayout>;

  if (!admin?.is_super_admin) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-12 h-12 text-[#EF4444] mx-auto mb-3" />
          <h2 className="text-lg text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Access Denied</h2>
          <p className="text-sm text-[#64748B]">Super admin role required.</p>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="support-console">
        {/* Admin Verified Banner */}
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#10B98108', border: '1px solid #10B98125' }}>
          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
          <div>
            <span className="text-sm font-semibold text-[#10B981]">Super Admin Verified</span>
            <span className="text-xs text-[#64748B] ml-3" style={{ fontFamily: fontFamily.mono }}>{admin.email} | {admin.user_id?.substring(0, 8)}</span>
          </div>
        </div>

        {/* Feature Flags */}
        <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
          <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: fontFamily.mono }}>Feature Flags</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(admin.feature_flags || {}).map(([k, v]) => (
              <span key={k} className="text-[10px] px-2 py-0.5 rounded" style={{ color: v ? '#10B981' : '#64748B', background: v ? '#10B98115' : 'rgba(140,170,210,0.15)50', fontFamily: fontFamily.mono }}>{k}: {v ? 'ON' : 'OFF'}</span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
        {[{ id: 'users', label: 'Users & Access', icon: Users }, { id: 'contacts', label: 'Enterprise Leads', icon: Eye }, { id: 'audit', label: 'Audit Log', icon: AlertTriangle }].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'audit') loadAudit(); if (t.id === 'contacts') loadContacts(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium ${tab === t.id ? 'text-[#EDF1F7]' : 'text-[#64748B]'}`}
              style={{ background: tab === t.id ? '#E85D0015' : 'transparent', fontFamily: fontFamily.mono }}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                    {['Email', 'Name', 'Business', 'Tier', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const tc = TIER_COLORS[u.subscription_tier] || '#64748B';
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--biqc-border)' }} className={u.is_disabled ? 'opacity-50' : ''}>
                        <td className="px-3 py-2 text-[#EDF1F7]">{u.email}</td>
                        <td className="px-3 py-2 text-[#8FA0B8]">{u.full_name || '—'}</td>
                        <td className="px-3 py-2 text-[#8FA0B8]">{u.business_name || '—'}</td>
                        <td className="px-3 py-2">
                          <select value={u.subscription_tier || 'free'} onChange={e => updateTier(u.id, e.target.value)}
                            className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: (TIER_COLORS[u.subscription_tier] || '#64748B') + '15', color: TIER_COLORS[u.subscription_tier] || '#64748B', border: 'none', fontFamily: fontFamily.mono }}>
                            {[
                              { val: 'free', label: 'Free' },
                              { val: 'starter', label: 'BIQc Foundation ($349)' },
                              { val: 'professional', label: 'BIQc Foundation ($349)' },
                              { val: 'enterprise', label: 'BIQc Foundation ($349)' },
                              { val: 'super_admin', label: 'Super Admin' },
                            ].map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[10px]" style={{ color: u.is_disabled ? '#EF4444' : '#10B981', fontFamily: fontFamily.mono }}>{u.is_disabled ? 'DISABLED' : 'ACTIVE'}</span>
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
            <div className="px-3 py-2 text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{users.length} users total</div>
          </div>
        )}

        {/* Enterprise Leads Tab */}
        {tab === 'contacts' && (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
              <span className="text-xs font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>Enterprise Contact Requests ({contacts.length})</span>
              <p className="text-[10px] text-[#64748B] mt-0.5">Users requesting access to paid or waitlist modules. Route to sales follow-up when configured.</p>
            </div>
            {contacts.length === 0 && <p className="text-xs text-[#64748B] p-4">No contact requests yet.</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                    {['Name', 'Business', 'Email', 'Phone', 'Feature', 'Callback', 'Description', 'Date'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                      <td className="px-3 py-2 text-[#EDF1F7]">{c.name}</td>
                      <td className="px-3 py-2 text-[#8FA0B8]">{c.business_name || '—'}</td>
                      <td className="px-3 py-2 text-[#8FA0B8]">{c.email}</td>
                      <td className="px-3 py-2 text-[#8FA0B8]">{c.phone || '—'}</td>
                      <td className="px-3 py-2"><span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#E85D0015', color: '#E85D00', fontFamily: fontFamily.mono }}>{c.feature_requested || '—'}</span></td>
                      <td className="px-3 py-2 text-[#8FA0B8]" style={{ fontFamily: fontFamily.mono, fontSize: '10px' }}>{c.callback_date} {c.callback_time}</td>
                      <td className="px-3 py-2 text-[#64748B] max-w-[200px]"><span className="line-clamp-2">{c.description}</span></td>
                      <td className="px-3 py-2 text-[#64748B]" style={{ fontFamily: fontFamily.mono, fontSize: '10px' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('en-AU') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {tab === 'audit' && (
          <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            {auditLog.length === 0 && <p className="text-xs text-[#64748B]">No admin actions recorded yet.</p>}
            {auditLog.map(a => (
              <div key={a.id} className="flex items-center gap-2 py-2 text-xs" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.action_type?.includes('disable') ? '#EF4444' : '#10B981' }} />
                <span className="text-[#EDF1F7] flex-1">{a.action_type}</span>
                <span className="text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{a.target_user_id?.substring(0, 8)}</span>
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
