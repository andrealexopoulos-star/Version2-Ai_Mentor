import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';

const cardStyle = {
  background: 'var(--biqc-bg-card)',
  border: '1px solid var(--biqc-border)',
  borderRadius: 12,
};

export default function AdminScopeCheckpointsPage() {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/scope-checkpoints');
      setPayload(res.data || null);
    } catch {
      toast.error('Failed to load scope checkpoints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-[1280px]" style={{ fontFamily: fontFamily.body, color: 'var(--biqc-text)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Scope Checkpoints</h1>
            <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
              Persistent checkpoint placeholder for current scope blocks and gate outcomes.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-2 rounded-lg text-xs"
            style={{ ...cardStyle, fontFamily: fontFamily.mono }}
            data-testid="scope-checkpoints-refresh"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3" style={cardStyle}>
            <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Source</div>
            <div className="text-xs text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{payload?.source || '—'}</div>
          </div>
          <div className="p-3" style={cardStyle}>
            <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Total Entries</div>
            <div className="text-xl text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{payload?.entry_count ?? 0}</div>
          </div>
          <div className="p-3" style={cardStyle}>
            <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Unique Gates</div>
            <div className="text-xl text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{payload?.unique_gate_count ?? 0}</div>
          </div>
          <div className="p-3" style={cardStyle}>
            <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Open Failures</div>
            <div className="text-xl" style={{ color: (payload?.open_failure_count || 0) > 0 ? '#EF4444' : '#10B981', fontFamily: fontFamily.mono }}>
              {payload?.open_failure_count ?? 0}
            </div>
          </div>
        </div>

        <div className="p-4" style={cardStyle}>
          <h2 className="text-lg mb-2" style={{ fontFamily: fontFamily.display }}>Open Failures</h2>
          <div className="max-h-[260px] overflow-auto">
            {(payload?.open_failures || []).map((entry) => (
              <div key={entry.gate_id} className="px-3 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#EF444415', color: '#EF4444', fontFamily: fontFamily.mono }}>
                  FAIL
                </span>
                <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{entry.gate_id}</span>
                <span className="text-[10px] text-[#9FB0C3]" style={{ fontFamily: fontFamily.mono }}>{entry.failure_code || '-'}</span>
                <span className="ml-auto text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{entry.artifact}</span>
              </div>
            ))}
            {(payload?.open_failures || []).length === 0 && (
              <div className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No open failures in latest gate state.</div>
            )}
          </div>
        </div>

        <div className="p-4" style={cardStyle}>
          <h2 className="text-lg mb-2" style={{ fontFamily: fontFamily.display }}>Latest Status By Gate</h2>
          <div className="max-h-[420px] overflow-auto">
            {(payload?.latest_by_gate || []).map((entry) => (
              <div key={entry.gate_id} className="px-3 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <span
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{
                    background: entry.status === 'PASS' ? '#10B98115' : '#EF444415',
                    color: entry.status === 'PASS' ? '#10B981' : '#EF4444',
                    fontFamily: fontFamily.mono,
                  }}
                >
                  {entry.status}
                </span>
                <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{entry.gate_id}</span>
                <span className="text-[10px] text-[#9FB0C3]" style={{ fontFamily: fontFamily.mono }}>{entry.failure_code || '-'}</span>
                <span className="ml-auto text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{entry.artifact}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
