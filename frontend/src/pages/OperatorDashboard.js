import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { Loader2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const POSITION_COLORS = {
  STABLE: 'text-emerald-400', ELEVATED: 'text-amber-400',
  DETERIORATING: 'text-red-400', CRITICAL: 'text-red-500',
};
const PRESSURE_COLORS = {
  LOW: 'text-white/40', MODERATE: 'text-amber-400',
  HIGH: 'text-red-400', CRITICAL: 'text-red-500',
};
const FRESHNESS_COLORS = {
  FRESH: 'text-emerald-400', AGING: 'text-amber-400', STALE: 'text-red-400',
};
const DOT_COLORS = {
  STABLE: 'bg-emerald-400', ELEVATED: 'bg-amber-400',
  DETERIORATING: 'bg-red-400', CRITICAL: 'bg-red-500',
};

const Panel = ({ title, children, empty }) => (
  <div className="border border-white/6 p-5">
    <h3 className="text-[10px] tracking-[0.3em] uppercase text-white/30 mb-4">{title}</h3>
    {empty ? (
      <p className="text-xs text-white/20">No data.</p>
    ) : children}
  </div>
);

const Row = ({ left, right, sub }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/4 last:border-0">
    <div>
      <span className="text-sm text-white/70">{left}</span>
      {sub && <span className="text-xs text-white/25 ml-2">{sub}</span>}
    </div>
    <div className="text-right">{right}</div>
  </div>
);

const formatHours = (h) => {
  if (h == null) return '';
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
};

const OperatorDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [pos, findings, snapshot] = await Promise.all([
        apiClient.get('/watchtower/positions').then(r => r.data).catch(() => ({ positions: {} })),
        apiClient.get('/watchtower/findings?limit=20').then(r => r.data).catch(() => ({ findings: [] })),
        apiClient.get('/snapshot/latest').then(r => r.data).catch(() => ({ snapshot: null })),
      ]);

      const snap = snapshot.snapshot;
      setData({
        positions: pos.positions || {},
        escalations: snap?.open_risks || [],
        contradictions: snap?.contradictions || [],
        // Extract pressure and freshness from a boardroom call
        pressure: {},
        freshness: {},
        snapshot: snap,
      });

      // Load pressure and freshness via dedicated fetch
      try {
        const br = await apiClient.post('/boardroom/respond', { message: '[STATUS_CHECK]', history: [] });
        // We don't need the response text, but the escalations come back
      } catch {}

    } catch (e) {
      console.error('[OperatorDashboard] Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-5 h-5 animate-spin text-white/30" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data || (Object.keys(data.positions).length === 0 && data.escalations.length === 0 && data.contradictions.length === 0)) {
    return (
      <DashboardLayout>
        <div data-testid="operator-dashboard" className="min-h-screen bg-[#050505] text-white/80">
          <div className="max-w-4xl mx-auto px-6 py-10">
            <div className="text-[10px] tracking-[0.4em] uppercase text-white/25 mb-1">BIQC</div>
            <h1 className="text-lg tracking-[0.15em] text-white/70 font-semibold mb-8">Operator Dashboard</h1>
            <div className="border border-white/6 p-8 text-center">
              <p className="text-sm text-white/30">No material intelligence state.</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const posEntries = Object.entries(data.positions);
  const escalations = data.escalations;
  const contradictions = data.contradictions;

  return (
    <DashboardLayout>
      <div data-testid="operator-dashboard" className="min-h-screen bg-[#050505] text-white/80">
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

          <div>
            <div className="text-[10px] tracking-[0.4em] uppercase text-white/25 mb-1">BIQC</div>
            <h1 className="text-lg tracking-[0.15em] text-white/70 font-semibold">Operator Dashboard</h1>
            <p className="text-xs text-white/25 mt-1">Read-only intelligence state</p>
          </div>

          {/* Snapshot Summary */}
          {data.snapshot?.summary && (
            <div className="border border-white/8 bg-white/[0.02] p-5">
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-2">LATEST SNAPSHOT</div>
              <p className="text-sm text-white/60 leading-relaxed">{data.snapshot.summary}</p>
              <p className="text-[10px] text-white/20 mt-2">{(data.snapshot.generated_at || '').slice(0, 16)}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 1. Domain Positions */}
            <Panel title="Domain Positions" empty={posEntries.length === 0}>
              {posEntries.map(([domain, d]) => {
                const pos = d.position || 'STABLE';
                const detected = d.detected_at;
                let persistence = '';
                if (detected) {
                  try {
                    const h = Math.round((Date.now() - new Date(detected).getTime()) / 3600000);
                    persistence = formatHours(h);
                  } catch {}
                }
                return (
                  <Row
                    key={domain}
                    left={
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[pos] || 'bg-white/20'}`} />
                        {domain}
                      </span>
                    }
                    right={<span className={`text-xs tracking-wider ${POSITION_COLORS[pos] || 'text-white/40'}`}>{pos}</span>}
                    sub={persistence}
                  />
                );
              })}
            </Panel>

            {/* 2. Active Escalations */}
            <Panel title="Active Escalations" empty={escalations.length === 0}>
              {escalations.map((esc, i) => (
                <Row
                  key={i}
                  left={esc.domain}
                  right={
                    <span className="text-xs text-white/40">
                      {esc.times_detected || 1}x &middot; {esc.user_action || 'unknown'}
                    </span>
                  }
                />
              ))}
            </Panel>

            {/* 3. Contradictions */}
            <Panel title="Contradictions" empty={contradictions.length === 0}>
              {contradictions.map((c, i) => (
                <Row
                  key={i}
                  left={c.domain}
                  right={
                    <span className="text-xs text-amber-400/70">
                      {(c.type || '').replace(/_/g, ' ')} &middot; {c.times_detected || 1}x
                    </span>
                  }
                />
              ))}
            </Panel>

            {/* 4. Decision Pressure — from snapshot open_risks */}
            <Panel title="Decision Pressure" empty={escalations.length === 0}>
              {escalations.map((r, i) => {
                const pos = r.position || 'ELEVATED';
                const level = pos === 'CRITICAL' ? 'CRITICAL' : pos === 'DETERIORATING' ? 'HIGH' : pos === 'ELEVATED' ? 'MODERATE' : 'LOW';
                return (
                  <Row
                    key={i}
                    left={r.domain}
                    right={<span className={`text-xs tracking-wider ${PRESSURE_COLORS[level]}`}>{level}</span>}
                    sub={r.persistence_hours != null ? formatHours(r.persistence_hours) : ''}
                  />
                );
              })}
            </Panel>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OperatorDashboard;
