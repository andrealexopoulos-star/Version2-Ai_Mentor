import React from 'react';
import { Shield } from 'lucide-react';

const MONO = "'JetBrains Mono', monospace";

// Data confidence derived from integration state + signal availability
const DataConfidence = ({ cognitive, channelsData }) => {
  let signals = 0;
  let total = 6; // core signal categories

  if (cognitive?.system_state) signals++;
  if (cognitive?.revenue?.pipeline || cognitive?.pipeline_total) signals++;
  if (cognitive?.capital?.runway) signals++;
  if (cognitive?.execution?.sla_breaches != null) signals++;
  if (cognitive?.founder_vitals?.capacity_index) signals++;
  if (channelsData?.summary?.connected > 0) signals++;

  const level = signals >= 5 ? 'High' : signals >= 3 ? 'Medium' : 'Low';
  const color = level === 'High' ? '#10B981' : level === 'Medium' ? '#F59E0B' : '#64748B';

  return (
    <div className="flex items-center gap-2" data-testid="data-confidence">
      <Shield className="w-3.5 h-3.5" style={{ color }} />
      <span className="text-[11px]" style={{ color, fontFamily: MONO }}>
        Data Confidence: {level}
      </span>
      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>
        ({signals}/{total} signals)
      </span>
    </div>
  );
};

export default DataConfidence;
