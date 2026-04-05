import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { fontFamily } from '../design-system/tokens';

const CARD = {
  background: 'var(--biqc-bg-card)',
  border: '1px solid var(--biqc-border)',
  borderRadius: 12,
};

const inputStyle = {
  width: '100%',
  background: 'var(--biqc-bg)',
  border: '1px solid var(--biqc-border)',
  color: 'var(--biqc-text)',
  borderRadius: 8,
  padding: '8px 10px',
  fontFamily: fontFamily.mono,
  fontSize: 12,
};

const AdminPricingPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState('starter');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [features, setFeatures] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [releases, setReleases] = useState([]);
  const [auditLog, setAuditLog] = useState([]);

  const [planForm, setPlanForm] = useState({
    plan_key: 'starter',
    name: 'BIQc Foundation',
    currency: 'AUD',
    monthly_price_cents: 34900,
    annual_price_cents: 349000,
    metadata_json: '{}',
  });

  const [publishForm, setPublishForm] = useState({
    plan_key: 'starter',
    product_approver_user_id: '',
    finance_approver_user_id: '',
    legal_approver_user_id: '',
    effective_from: '',
  });

  const [rollbackForm, setRollbackForm] = useState({
    plan_key: 'starter',
    target_version: 1,
    product_approver_user_id: '',
    finance_approver_user_id: '',
    legal_approver_user_id: '',
    reason: 'Rollback requested by admin',
  });

  const [overrideForm, setOverrideForm] = useState({
    account_id: '',
    user_id: '',
    feature_key: 'soundboard',
    status: 'active',
    reason: '',
    override_payload_json: '{"monthly_limit": 100, "notes": "custom"}',
  });

  const groupedPlans = useMemo(() => {
    const byKey = {};
    for (const p of plans) {
      if (!byKey[p.plan_key]) byKey[p.plan_key] = [];
      byKey[p.plan_key].push(p);
    }
    Object.values(byKey).forEach((arr) => arr.sort((a, b) => Number(b.version || 0) - Number(a.version || 0)));
    return byKey;
  }, [plans]);

  const selectedPlanVersions = groupedPlans[selectedPlanKey] || [];

  const refreshPlans = async () => {
    const res = await apiClient.get('/admin/pricing/plans');
    const list = res?.data?.plans || [];
    setPlans(list);
    if (!selectedVersion && list.length) {
      const first = list.find((p) => p.plan_key === selectedPlanKey) || list[0];
      if (first?.version) setSelectedVersion(String(first.version));
    }
  };

  const refreshEntitlements = async (planKey = selectedPlanKey, version = selectedVersion) => {
    if (!planKey) return;
    const params = { plan_key: planKey };
    if (version) params.plan_version = Number(version);
    const res = await apiClient.get('/admin/pricing/entitlements', { params });
    setFeatures(res?.data?.features || []);
  };

  const refreshOverrides = async () => {
    const res = await apiClient.get('/admin/pricing/overrides');
    setOverrides(res?.data?.overrides || []);
  };

  const refreshReleases = async () => {
    const res = await apiClient.get('/admin/pricing/releases');
    setReleases(res?.data?.releases || []);
  };

  const refreshAuditLog = async () => {
    const res = await apiClient.get('/admin/pricing/audit-log', { params: { limit: 150 } });
    setAuditLog(res?.data?.audit_log || []);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await refreshPlans();
      await refreshEntitlements();
      await refreshOverrides();
      await refreshReleases();
      await refreshAuditLog();
    } catch (err) {
      toast.error('Failed to refresh pricing control data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshEntitlements(selectedPlanKey, selectedVersion).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanKey, selectedVersion]);

  const createPlanDraft = async () => {
    try {
      const metadata = JSON.parse(planForm.metadata_json || '{}');
      await apiClient.put('/admin/pricing/plans', {
        plan_key: planForm.plan_key,
        name: planForm.name,
        currency: planForm.currency,
        monthly_price_cents: Number(planForm.monthly_price_cents || 0),
        annual_price_cents: planForm.annual_price_cents ? Number(planForm.annual_price_cents) : null,
        metadata,
      });
      toast.success('Draft plan version created');
      await refreshPlans();
      await refreshAuditLog();
    } catch (err) {
      toast.error('Failed to create plan draft');
    }
  };

  const addFeatureRow = () => {
    setFeatures((prev) => [
      ...prev,
      {
        feature_key: '',
        min_tier: 'starter',
        launch_type: 'foundation',
        usage_limit_monthly: null,
        overage_unit: 'request',
        overage_price_cents: null,
        metadata: {},
      },
    ]);
  };

  const saveEntitlements = async () => {
    try {
      const payload = {
        plan_key: selectedPlanKey,
        plan_version: selectedVersion ? Number(selectedVersion) : undefined,
        features: features.map((f) => ({
          feature_key: String(f.feature_key || '').trim(),
          min_tier: f.min_tier || null,
          launch_type: f.launch_type || null,
          usage_limit_monthly: f.usage_limit_monthly === '' || f.usage_limit_monthly === null ? null : Number(f.usage_limit_monthly),
          overage_unit: f.overage_unit || null,
          overage_price_cents: f.overage_price_cents === '' || f.overage_price_cents === null ? null : Number(f.overage_price_cents),
          metadata: f.metadata || {},
        })).filter((f) => f.feature_key),
      };
      await apiClient.put('/admin/pricing/entitlements', payload);
      toast.success('Entitlements saved');
      await refreshEntitlements();
      await refreshAuditLog();
    } catch (err) {
      toast.error('Failed to save entitlements');
    }
  };

  const publishPlan = async () => {
    try {
      await apiClient.post('/admin/pricing/publish', {
        plan_key: publishForm.plan_key,
        product_approver_user_id: publishForm.product_approver_user_id,
        finance_approver_user_id: publishForm.finance_approver_user_id,
        legal_approver_user_id: publishForm.legal_approver_user_id,
        effective_from: publishForm.effective_from || null,
      });
      toast.success('Plan published');
      await refreshPlans();
      await refreshReleases();
      await refreshAuditLog();
    } catch (err) {
      toast.error('Publish failed (check approver and draft availability)');
    }
  };

  const rollbackPlan = async () => {
    try {
      await apiClient.post('/admin/pricing/rollback', {
        plan_key: rollbackForm.plan_key,
        target_version: Number(rollbackForm.target_version || 1),
        product_approver_user_id: rollbackForm.product_approver_user_id,
        finance_approver_user_id: rollbackForm.finance_approver_user_id,
        legal_approver_user_id: rollbackForm.legal_approver_user_id,
        reason: rollbackForm.reason,
      });
      toast.success('Rollback completed');
      await refreshPlans();
      await refreshReleases();
      await refreshAuditLog();
    } catch (err) {
      toast.error('Rollback failed');
    }
  };

  const saveOverride = async () => {
    try {
      const override_payload = JSON.parse(overrideForm.override_payload_json || '{}');
      await apiClient.put('/admin/pricing/overrides', {
        account_id: overrideForm.account_id || null,
        user_id: overrideForm.user_id || null,
        feature_key: overrideForm.feature_key || null,
        status: overrideForm.status,
        reason: overrideForm.reason || null,
        override_payload,
      });
      toast.success('Custom pricing override saved');
      await refreshOverrides();
      await refreshAuditLog();
    } catch (err) {
      toast.error('Failed to save override');
    }
  };

  const setOverrideStatus = async (override, status) => {
    try {
      await apiClient.put('/admin/pricing/overrides', {
        id: override.id,
        account_id: override.account_id || null,
        user_id: override.user_id || null,
        feature_key: override.feature_key || null,
        status,
        reason: override.reason || null,
        override_payload: override.override_payload || {},
        starts_at: override.starts_at || null,
        ends_at: override.ends_at || null,
      });
      toast.success(`Override marked ${status}`);
      await refreshOverrides();
      await refreshAuditLog();
    } catch {
      toast.error(`Failed to mark override ${status}`);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ fontFamily: fontFamily.body, color: 'var(--biqc-text)' }} className="space-y-4 max-w-[1320px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontFamily: fontFamily.display }} className="text-2xl text-[#F4F7FA]">Admin Pricing Control</h1>
            <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
              Draft plans, adjust entitlements, publish/rollback, and set custom pricing overrides.
            </p>
          </div>
          <button onClick={refreshAll} disabled={loading} className="px-3 py-2 rounded-lg text-xs" style={{ ...CARD, fontFamily: fontFamily.mono }}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 space-y-3" style={CARD}>
            <h2 style={{ fontFamily: fontFamily.display }} className="text-lg">Create Plan Draft Version</h2>
            <input style={inputStyle} value={planForm.plan_key} onChange={(e) => setPlanForm((p) => ({ ...p, plan_key: e.target.value }))} placeholder="plan_key (starter)" />
            <input style={inputStyle} value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))} placeholder="display name" />
            <div className="grid grid-cols-3 gap-2">
              <input style={inputStyle} value={planForm.currency} onChange={(e) => setPlanForm((p) => ({ ...p, currency: e.target.value }))} placeholder="AUD" />
              <input style={inputStyle} value={planForm.monthly_price_cents} onChange={(e) => setPlanForm((p) => ({ ...p, monthly_price_cents: e.target.value }))} placeholder="34900" />
              <input style={inputStyle} value={planForm.annual_price_cents} onChange={(e) => setPlanForm((p) => ({ ...p, annual_price_cents: e.target.value }))} placeholder="349000" />
            </div>
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={planForm.metadata_json} onChange={(e) => setPlanForm((p) => ({ ...p, metadata_json: e.target.value }))} placeholder='{"notes":"..."}' />
            <button onClick={createPlanDraft} className="px-3 py-2 rounded-lg text-xs" style={{ ...CARD, borderColor: '#FF6A0030', color: '#FF6A00', fontFamily: fontFamily.mono }}>
              Create Draft Version
            </button>
          </div>

          <div className="p-4 space-y-3" style={CARD}>
            <h2 style={{ fontFamily: fontFamily.display }} className="text-lg">Plans</h2>
            <div className="grid grid-cols-2 gap-2">
              <select style={inputStyle} value={selectedPlanKey} onChange={(e) => setSelectedPlanKey(e.target.value)}>
                {Object.keys(groupedPlans).length === 0 && <option value="starter">starter</option>}
                {Object.keys(groupedPlans).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <select style={inputStyle} value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
                {selectedPlanVersions.map((p) => <option key={`${p.plan_key}-${p.version}`} value={String(p.version)}>v{p.version} {p.is_active ? '(active)' : p.is_draft ? '(draft)' : ''}</option>)}
              </select>
            </div>
            <div className="max-h-[220px] overflow-auto text-xs" style={{ border: '1px solid var(--biqc-border)', borderRadius: 8 }}>
              {(plans || []).map((p) => (
                <div key={`${p.plan_key}-${p.version}`} className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                  <span style={{ fontFamily: fontFamily.mono }}>{p.plan_key} v{p.version}</span>
                  <span style={{ fontFamily: fontFamily.mono, color: p.is_active ? '#10B981' : p.is_draft ? '#F59E0B' : '#64748B' }}>
                    {p.is_active ? 'active' : p.is_draft ? 'draft' : 'inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3" style={CARD}>
          <div className="flex items-center justify-between">
            <h2 style={{ fontFamily: fontFamily.display }} className="text-lg">Entitlements</h2>
            <div className="flex gap-2">
              <button onClick={addFeatureRow} className="px-3 py-2 rounded-lg text-xs" style={{ ...CARD, fontFamily: fontFamily.mono }}>Add Row</button>
              <button onClick={saveEntitlements} className="px-3 py-2 rounded-lg text-xs" style={{ ...CARD, borderColor: '#FF6A0030', color: '#FF6A00', fontFamily: fontFamily.mono }}>Save Entitlements</button>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {['feature_key', 'min_tier', 'launch_type', 'usage_limit_monthly', 'overage_unit', 'overage_price_cents'].map((h) => (
                    <th key={h} className="text-left p-2 text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f, idx) => (
                  <tr key={`${f.feature_key || 'row'}-${idx}`}>
                    <td className="p-1"><input style={inputStyle} value={f.feature_key || ''} onChange={(e) => setFeatures((prev) => prev.map((r, i) => i === idx ? { ...r, feature_key: e.target.value } : r))} /></td>
                    <td className="p-1"><input style={inputStyle} value={f.min_tier || ''} onChange={(e) => setFeatures((prev) => prev.map((r, i) => i === idx ? { ...r, min_tier: e.target.value } : r))} /></td>
                    <td className="p-1"><input style={inputStyle} value={f.launch_type || ''} onChange={(e) => setFeatures((prev) => prev.map((r, i) => i === idx ? { ...r, launch_type: e.target.value } : r))} /></td>
                    <td className="p-1"><input style={inputStyle} value={f.usage_limit_monthly ?? ''} onChange={(e) => setFeatures((prev) => prev.map((r, i) => i === idx ? { ...r, usage_limit_monthly: e.target.value } : r))} /></td>
                    <td className="p-1"><input style={inputStyle} value={f.overage_unit || ''} onChange={(e) => setFeatures((prev) => prev.map((r, i) => i === idx ? { ...r, overage_unit: e.target.value } : r))} /></td>
                    <td className="p-1"><input style={inputStyle} value={f.overage_price_cents ?? ''} onChange={(e) => setFeatures((prev) => prev.map((r, i) => i === idx ? { ...r, overage_price_cents: e.target.value } : r))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 space-y-3" style={CARD}>
            <h2 style={{ fontFamily: fontFamily.display }} className="text-lg">Publish Plan (Product + Finance + Legal)</h2>
            <input style={inputStyle} value={publishForm.plan_key} onChange={(e) => setPublishForm((p) => ({ ...p, plan_key: e.target.value }))} placeholder="plan_key" />
            <input style={inputStyle} value={publishForm.product_approver_user_id} onChange={(e) => setPublishForm((p) => ({ ...p, product_approver_user_id: e.target.value }))} placeholder="product_approver_user_id" />
            <input style={inputStyle} value={publishForm.finance_approver_user_id} onChange={(e) => setPublishForm((p) => ({ ...p, finance_approver_user_id: e.target.value }))} placeholder="finance_approver_user_id" />
            <input style={inputStyle} value={publishForm.legal_approver_user_id} onChange={(e) => setPublishForm((p) => ({ ...p, legal_approver_user_id: e.target.value }))} placeholder="legal_approver_user_id" />
            <input style={inputStyle} value={publishForm.effective_from} onChange={(e) => setPublishForm((p) => ({ ...p, effective_from: e.target.value }))} placeholder="effective_from (optional ISO datetime)" />
            <button onClick={publishPlan} className="px-3 py-2 rounded-lg text-xs" style={{ ...CARD, borderColor: '#10B98135', color: '#10B981', fontFamily: fontFamily.mono }}>
              Publish
            </button>
            <p className="text-[10px] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
              Governance: actor must be distinct from product, finance, and legal approvers.
            </p>
          </div>

          <div className="p-4 space-y-3" style={CARD}>
            <h2 style={{ fontFamily: fontFamily.display }} className="text-lg">Rollback Plan Version</h2>
            <input style={inputStyle} value={rollbackForm.plan_key} onChange={(e) => setRollbackForm((p) => ({ ...p, plan_key: e.target.value }))} placeholder="plan_key" />
            <input style={inputStyle} value={rollbackForm.target_version} onChange={(e) => setRollbackForm((p) => ({ ...p, target_version: e.target.value }))} placeholder="target version" />
            <input style={inputStyle} value={rollbackForm.product_approver_user_id} onChange={(e) => setRollbackForm((p) => ({ ...p, product_approver_user_id: e.target.value }))} placeholder="product_approver_user_id" />
            <input style={inputStyle} value={rollbackForm.finance_approver_user_id} onChange={(e) => setRollbackForm((p) => ({ ...p, finance_approver_user_id: e.target.value }))} placeholder="finance_approver_user_id" />
            <input style={inputStyle} value={rollbackForm.legal_approver_user_id} onChange={(e) => setRollbackForm((p) => ({ ...p, legal_approver_user_id: e.target.value }))} placeholder="legal_approver_user_id" />
            <input style={inputStyle} value={rollbackForm.reason} onChange={(e) => setRollbackForm((p) => ({ ...p, reason: e.target.value }))} placeholder="rollback reason" />
            <button onClick={rollbackPlan} className="px-3 py-2 rounded-lg text-xs" style={{ ...CARD, borderColor: '#F59E0B40', color: '#F59E0B', fontFamily: fontFamily.mono }}>
              Rollback
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3" style={CARD}>
          <h2 style={{ fontFamily: fontFamily.display }} className="text-lg">Custom Pricing Overrides</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <input style={inputStyle} value={overrideForm.account_id} onChange={(e) => setOverrideForm((p) => ({ ...p, account_id: e.target.value }))} placeholder="account_id (optional)" />
            <input style={inputStyle} value={overrideForm.user_id} onChange={(e) => setOverrideForm((p) => ({ ...p, user_id: e.target.value }))} placeholder="user_id (optional)" />
            <input style={inputStyle} value={overrideForm.feature_key} onChange={(e) => setOverrideForm((p) => ({ ...p, feature_key: e.target.value }))} placeholder="feature_key" />
            <input style={inputStyle} value={overrideForm.status} onChange={(e) => setOverrideForm((p) => ({ ...p, status: e.target.value }))} placeholder="status" />
            <input style={inputStyle} value={overrideForm.reason} onChange={(e) => setOverrideForm((p) => ({ ...p, reason: e.target.value }))} placeholder="reason" />
          </div>
          <textarea style={{ ...inputStyle, minHeight: 80 }} value={overrideForm.override_payload_json} onChange={(e) => setOverrideForm((p) => ({ ...p, override_payload_json: e.target.value }))} placeholder='{"monthly_limit":100}' />
          <button onClick={saveOverride} className="px-3 py-2 rounded-lg text-xs" style={{ ...CARD, borderColor: '#3B82F640', color: '#3B82F6', fontFamily: fontFamily.mono }}>
            Save Override
          </button>

          <div className="max-h-[220px] overflow-auto text-xs" style={{ border: '1px solid var(--biqc-border)', borderRadius: 8 }}>
            {overrides.map((o) => (
              <div key={o.id} className="px-3 py-2 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <div className="min-w-0">
                  <span style={{ fontFamily: fontFamily.mono }}>
                    {o.feature_key || 'global'} | user:{o.user_id ? String(o.user_id).slice(0, 8) : '-'} | account:{o.account_id ? String(o.account_id).slice(0, 8) : '-'}
                  </span>
                  <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                    {o.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: fontFamily.mono, color: o.status === 'active' ? '#10B981' : '#64748B' }}>{o.status}</span>
                  {o.status === 'active' ? (
                    <button
                      onClick={() => setOverrideStatus(o, 'inactive')}
                      className="px-2 py-1 rounded text-[10px]"
                      style={{ ...CARD, borderColor: '#F59E0B40', color: '#F59E0B', fontFamily: fontFamily.mono }}
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={() => setOverrideStatus(o, 'active')}
                      className="px-2 py-1 rounded text-[10px]"
                      style={{ ...CARD, borderColor: '#10B98140', color: '#10B981', fontFamily: fontFamily.mono }}
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 space-y-3" style={CARD}>
            <h2 style={{ fontFamily: fontFamily.display }} className="text-lg">Release History</h2>
            <div className="max-h-[260px] overflow-auto text-xs" style={{ border: '1px solid var(--biqc-border)', borderRadius: 8 }}>
              {releases.length === 0 && (
                <div className="px-3 py-3 text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No releases yet</div>
              )}
              {releases.map((r) => (
                <div key={r.id || `${r.plan_key}-${r.to_version}-${r.published_at}`} className="px-3 py-2" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: fontFamily.mono }}>
                      {r.plan_key} {r.from_version ? `v${r.from_version}` : 'n/a'} -> v{r.to_version}
                    </span>
                    <span style={{ fontFamily: fontFamily.mono, color: r.status === 'published' ? '#10B981' : '#F59E0B' }}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                    {r.published_at ? new Date(r.published_at).toLocaleString('en-AU') : 'unknown time'}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-3" style={CARD}>
            <h2 style={{ fontFamily: fontFamily.display }} className="text-lg">Audit Log</h2>
            <div className="max-h-[260px] overflow-auto text-xs" style={{ border: '1px solid var(--biqc-border)', borderRadius: 8 }}>
              {auditLog.length === 0 && (
                <div className="px-3 py-3 text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No audit records</div>
              )}
              {auditLog.map((row) => (
                <div key={row.id || `${row.action}-${row.created_at}`} className="px-3 py-2" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: fontFamily.mono }}>{row.action}</span>
                    <span className="text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                      {row.entity_type}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
                    {row.entity_id || '-'} · {row.created_at ? new Date(row.created_at).toLocaleString('en-AU') : 'unknown'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminPricingPage;
