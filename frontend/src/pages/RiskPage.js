import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { CognitiveMesh } from '../components/LoadingSystems';
import DataConfidence from '../components/DataConfidence';
import { AlertTriangle, Shield, DollarSign, TrendingDown, CheckCircle2 } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const RiskPage = () => {
  const { cognitive, loading } = useSnapshot();
  const c = cognitive || {};
  const risk = c.risk || {};
  const cap = c.capital || {};
  const exec = c.execution || {};
  const alignment = c.alignment || {};

  const spofs = risk.spof || [];
  const regulatory = risk.regulatory || [];
  const concentration = risk.concentration || '';
  const runway = cap.runway;
  const slaBreaches = exec.sla_breaches;
  const contradictions = alignment.contradictions || [];

  const hasData = runway != null || slaBreaches != null || spofs.length > 0 || concentration;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: BODY }} data-testid="risk-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Risk & Governance</h1>
            <p className="text-sm text-[#9FB0C3]">{hasData ? 'Risk signals from connected data.' : 'Connect integrations to assess risk.'}</p>
          </div>
          <DataConfidence cognitive={cognitive} />
        </div>

        {loading && <CognitiveMesh message="Scanning risk signals..." />}

        {!loading && !hasData && (
          <Panel className="text-center py-8">
            <Shield className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Insufficient data to assess risk.</p>
            <p className="text-xs text-[#64748B]">Connect CRM, financial, and operational integrations to enable risk detection.</p>
          </Panel>
        )}

        {!loading && hasData && (
          <>
            {/* Financial Risk */}
            {(runway != null || concentration) && (
              <Panel>
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-4 h-4 text-[#FF6A00]" />
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Financial Risk</h3>
                </div>
                <div className="space-y-3">
                  {runway != null && (
                    <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: runway < 6 ? '#EF4444' : '#F59E0B' }} />
                        <div>
                          <p className="text-xs font-semibold text-[#F4F7FA]">Cash Runway: {runway} months</p>
                          <p className="text-[11px] text-[#64748B] mt-0.5">{runway < 3 ? 'Critical — immediate attention required.' : runway < 6 ? 'Below comfort threshold.' : 'Acceptable range.'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {concentration && (
                    <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#F59E0B' }} />
                        <div>
                          <p className="text-xs font-semibold text-[#F4F7FA]">Revenue Concentration</p>
                          <p className="text-[11px] text-[#64748B] mt-0.5">{concentration}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {cap.margin && (
                    <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#F59E0B' }} />
                        <div>
                          <p className="text-xs font-semibold text-[#F4F7FA]">Margin</p>
                          <p className="text-[11px] text-[#64748B] mt-0.5">{cap.margin}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {/* Operational Risk */}
            {slaBreaches != null && (
              <Panel>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4" style={{ color: slaBreaches > 0 ? '#F59E0B' : '#10B981' }} />
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Operational Risk</h3>
                </div>
                <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                  <p className="text-xs font-semibold text-[#F4F7FA]">SLA Breaches: {slaBreaches}</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">{slaBreaches === 0 ? 'No breaches detected.' : `${slaBreaches} breach${slaBreaches > 1 ? 'es' : ''} detected this period.`}</p>
                </div>
                {exec.bottleneck && (
                  <div className="p-3 rounded-lg mt-2" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                    <p className="text-xs font-semibold text-[#F4F7FA]">Bottleneck</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{exec.bottleneck}</p>
                  </div>
                )}
              </Panel>
            )}

            {/* SPOFs */}
            {spofs.length > 0 && (
              <Panel>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Single Points of Failure</h3>
                </div>
                <div className="space-y-2">
                  {spofs.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#EF4444' }} />
                      <p className="text-xs text-[#9FB0C3]">{s}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Contradictions / Alignment Risk */}
            {contradictions.length > 0 && (
              <Panel>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-4 h-4 text-[#F59E0B]" />
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Alignment Issues</h3>
                </div>
                <div className="space-y-2">
                  {contradictions.map((ct, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                      <p className="text-xs" style={{ color: '#F59E0B' }}>{ct}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Missing Data Notice */}
            {!runway && (
              <Panel>
                <p className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>Financial data unavailable. Connect accounting integration to assess cash runway, margin, and cost structure.</p>
              </Panel>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RiskPage;
