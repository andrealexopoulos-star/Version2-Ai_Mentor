/**
 * IntelligenceCoverageBar — compact header indicator.
 * Shows data coverage % based on connected integrations.
 * Click → navigates to /integrations.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const IntelligenceCoverageBar = ({ integrationStatus, loading = false }) => {
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);

  if (loading || !integrationStatus) return null;

  const { canonical_truth = {}, integrations = [] } = integrationStatus;
  const connected = integrations.filter(i => i.connected);
  const totalCategories = 5; // email, crm, accounting, hris, ats
  const connectedCount = connected.length;
  const pct = Math.min(100, Math.round((connectedCount / totalCategories) * 100));

  // Category status for tooltip
  const cats = [
    { key: 'crm',        label: 'CRM',        connected: canonical_truth.crm_connected, state: canonical_truth.crm_state || (canonical_truth.crm_connected ? 'live' : 'unverified') },
    { key: 'accounting', label: 'Accounting', connected: canonical_truth.accounting_connected, state: canonical_truth.accounting_state || (canonical_truth.accounting_connected ? 'live' : 'unverified') },
    { key: 'email',      label: 'Email',      connected: canonical_truth.email_connected, state: canonical_truth.email_state || (canonical_truth.email_connected ? 'live' : 'unverified') },
    { key: 'hris',       label: 'HR System',  connected: canonical_truth.hris_connected, state: canonical_truth.hris_connected ? 'live' : 'unverified' },
  ];

  const hasDegradedTruth = cats.some((cat) => cat.state && cat.state !== 'live' && cat.connected);

  const barColor = hasDegradedTruth ? '#F59E0B' : pct >= 80 ? '#10B981' : pct >= 40 ? '#FF6A00' : '#F59E0B';

  return (
    <div className="relative">
      <button
        onClick={() => navigate('/integrations')}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-white/5"
        style={{ border: '1px solid #243140' }}
        data-testid="intelligence-coverage-bar"
        aria-label={`Intelligence coverage ${pct}% — click to inspect live vs stale systems`}
      >
        <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: barColor }} />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold whitespace-nowrap"
            style={{ color: '#9FB0C3', fontFamily: fontFamily.mono }}>
            {pct}%
          </span>
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#243140' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: barColor }} />
          </div>
        </div>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 z-50 w-52 rounded-xl p-3"
          style={{ background: '#141C26', border: '1px solid #243140', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontFamily: fontFamily.body }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
            Intelligence Coverage
          </p>
          <div className="space-y-1.5">
            {cats.map(cat => (
              <div key={cat.key} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#9FB0C3' }}>{cat.label}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    background: cat.state === 'live' ? 'rgba(16,185,129,0.1)' : cat.connected ? 'rgba(245,158,11,0.12)' : 'rgba(255,106,0,0.08)',
                    color: cat.state === 'live' ? '#10B981' : cat.connected ? '#F59E0B' : '#FF6A00',
                    fontFamily: fontFamily.mono,
                  }}>
                  {cat.connected ? cat.state : 'Connect'}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/integrations')}
            className="w-full mt-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:brightness-110"
            style={{ background: '#FF6A00', color: '#fff', fontFamily: fontFamily.mono }}>
            + Add Integrations
          </button>
        </div>
      )}
    </div>
  );
};

export default IntelligenceCoverageBar;
