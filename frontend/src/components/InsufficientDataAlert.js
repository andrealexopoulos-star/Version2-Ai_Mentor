import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, X, ArrowRight, BookOpen } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const DATA_REQUIREMENTS = [
  { id: 'forensic', label: 'Forensic Calibration incomplete', detail: 'Revenue ambition, growth targets, and risk profile needed for drift analysis', action: 'Complete Forensic Calibration', kb: 'forensic-calibration' },
  { id: 'goals', label: 'Business goals & KPIs not defined', detail: 'Acquisition, retention, and growth targets needed for misalignment detection', action: 'Define Goals & KPIs', kb: 'business-goals' },
  { id: 'crm', label: 'No CRM connected', detail: 'Pipeline data required for acquisition scoring and positioning verdict', action: 'Connect CRM', kb: 'connect-crm' },
  { id: 'accounting', label: 'No accounting tool connected', detail: 'Financial data required for trust scoring and cash flow analysis', action: 'Connect Accounting', kb: 'connect-accounting' },
  { id: 'email', label: 'No email connected', detail: 'Communication patterns required for retention signals and engagement scoring', action: 'Connect Email', kb: 'connect-email' },
];

/**
 * InsufficientDataAlert — Shows notification bar when market intelligence has gaps.
 * Links each action to the Knowledge Base page with specific instructions.
 */
const InsufficientDataAlert = ({ missingItems = [] }) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed || missingItems.length === 0) return null;

  const alerts = DATA_REQUIREMENTS.filter(r => missingItems.includes(r.id));
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden mb-6" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }} data-testid="insufficient-data-alert">
      <div onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer">
        <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>
            {alerts.length} data source{alerts.length > 1 ? 's' : ''} needed for full intelligence
          </span>
          <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>
            Click to see what's needed and how to fix it
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ color: '#F59E0B', background: '#F59E0B15', fontFamily: fontFamily.mono }}>
          {alerts.length} action{alerts.length > 1 ? 's' : ''}
        </span>
        <button onClick={(e) => { e.stopPropagation(); setDismissed(true); }} className="p-1 rounded-lg hover:bg-white/5 shrink-0" data-testid="dismiss-data-alert">
          <X className="w-3.5 h-3.5 text-[#64748B]" />
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-4 space-y-2" style={{ borderTop: '1px solid #F59E0B15' }}>
          {alerts.map(a => (
            <button key={a.id} onClick={() => navigate(`/knowledge-base#${a.kb}`)}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:bg-white/[0.03]"
              style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}
              data-testid={`data-alert-${a.id}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#F59E0B15' }}>
                <BookOpen className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <div className="flex-1">
                <span className="text-sm text-[#EDF1F7] block">{a.label}</span>
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{a.detail}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-[#F59E0B]" style={{ fontFamily: fontFamily.mono }}>How to fix</span>
                <ArrowRight className="w-3 h-3 text-[#F59E0B]" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default InsufficientDataAlert;
