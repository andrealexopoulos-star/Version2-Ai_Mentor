import React from 'react';
import { Shield } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


// Data confidence derived from integration state + signal availability
const DataConfidence = ({ cognitive, channelsData, loading = false }) => {
  const hasAnyCognitiveSignal = Boolean(
    cognitive?.live_signal_count ||
    cognitive?.system_state ||
    cognitive?.system_state_interpretation ||
    cognitive?.revenue ||
    cognitive?.capital ||
    cognitive?.execution ||
    cognitive?.founder_vitals
  );

  if (loading || (!channelsData && !hasAnyCognitiveSignal)) {
    return (
      <div className="flex flex-col items-start gap-1.5" data-testid="data-confidence">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" style={{ color: '#64748B' }} />
          <span className="text-[11px]" style={{ color: '#9FB0C3', fontFamily: fontFamily.mono }}>
            Data Confidence: Verifying
          </span>
        </div>
        <div className="text-[10px] leading-relaxed" style={{ color: '#8B9DB5', fontFamily: fontFamily.mono }} data-testid="data-confidence-explainer">
          Checking connected systems and live business signals before scoring confidence.
        </div>
      </div>
    );
  }

  const canonicalTruth = channelsData?.canonical_truth || {};
  const connectedSystems = canonicalTruth.total_connected || channelsData?.total_connected || 0;
  const liveSignals = cognitive?.live_signal_count || (Array.isArray(cognitive?.top_alerts) ? cognitive.top_alerts.length : 0) || 0;
  const degradedTruth = [canonicalTruth.crm_state, canonicalTruth.accounting_state, canonicalTruth.email_state].filter((state) => state && state !== 'live').length;
  const signalChecks = [
    { key: 'system', label: 'business state', active: Boolean(cognitive?.system_state || cognitive?.system_state_interpretation) },
    { key: 'pipeline', label: 'revenue/pipeline', active: Boolean(cognitive?.revenue?.pipeline || cognitive?.pipeline_total || canonicalTruth.crm_connected) },
    { key: 'cash', label: 'cash/accounting', active: Boolean(cognitive?.capital?.runway || canonicalTruth.accounting_connected) },
    { key: 'execution', label: 'operations delivery', active: Boolean(cognitive?.execution?.sla_breaches != null || cognitive?.execution?.delivery_pressure || liveSignals > 0) },
    { key: 'people', label: 'people/customer pressure', active: Boolean(cognitive?.founder_vitals?.capacity_index || liveSignals > 0 || canonicalTruth.email_connected) },
    { key: 'systems', label: 'connected systems', active: connectedSystems > 0 },
  ];

  const signals = signalChecks.filter((item) => item.active).length;
  const total = signalChecks.length;
  const level = signals >= 5 ? 'High' : signals >= 3 ? 'Medium' : 'Low';
  const color = degradedTruth > 0 ? '#F59E0B' : level === 'High' ? '#10B981' : level === 'Medium' ? '#F59E0B' : '#64748B';
  const activeLabels = signalChecks.filter((item) => item.active).map((item) => item.label);
  const missingLabels = signalChecks.filter((item) => !item.active).map((item) => item.label);
  const explainer = activeLabels.length
    ? `Reading ${activeLabels.slice(0, 3).join(', ')}${activeLabels.length > 3 ? ' +' : ''}`
    : 'Waiting for connected business signals';
  const guidance = degradedTruth > 0
    ? `Truth gate active on ${degradedTruth} source ${degradedTruth === 1 ? 'domain' : 'domains'}`
    : missingLabels.length
    ? `Missing: ${missingLabels.slice(0, 2).join(', ')}`
    : `Live signals detected from ${connectedSystems} connected systems`;

  return (
    <div className="flex flex-col items-start gap-1.5" data-testid="data-confidence">
      <div className="flex items-center gap-2">
        <Shield className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[11px]" style={{ color, fontFamily: fontFamily.mono }}>
          Data Confidence: {level}
        </span>
        <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
          ({signals}/{total} signals)
        </span>
      </div>
      <div className="text-[10px] leading-relaxed" style={{ color: '#8B9DB5', fontFamily: fontFamily.mono }} data-testid="data-confidence-explainer">
        {explainer}. {guidance}.
      </div>
    </div>
  );
};

export default DataConfidence;
