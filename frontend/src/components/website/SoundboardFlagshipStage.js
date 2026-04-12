import React from 'react';
import { Activity, ArrowRight, BarChart3, Briefcase, MessageSquare, Radio } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const checks = [
  { id: 'ceo', label: 'CEO', detail: 'Checking strategic priorities', icon: Briefcase },
  { id: 'finance', label: 'Finance Manager', detail: 'Scanning margin and cash pressure', icon: BarChart3 },
  { id: 'marketing', label: 'Marketing Manager', detail: 'Scanning competitor threats', icon: Activity },
];

const SoundboardFlagshipStage = () => (
  <div
    className="relative mx-auto w-full max-w-4xl rounded-2xl border p-3.5 sm:p-4"
    style={{
      background: 'linear-gradient(160deg, rgba(18,26,36,0.9), rgba(15,23,32,0.88))',
      borderColor: 'rgba(198,95,46,0.22)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
      overflow: 'hidden',
    }}
    data-testid="soundboard-flagship-stage"
  >
    <style>{`
      @keyframes sbSweep {
        0% { transform: translateX(-100%); opacity: 0; }
        20% { opacity: 0.3; }
        80% { opacity: 0.2; }
        100% { transform: translateX(220%); opacity: 0; }
      }
      @keyframes sbPulse {
        0%,100% { opacity: 0.45; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.04); }
      }
      @keyframes sbTyping {
        0%, 20% { opacity: 0.2; }
        50% { opacity: 1; }
        100% { opacity: 0.2; }
      }
      .sb-role:nth-child(1) { animation: sbPulse 4.8s ease-in-out infinite; animation-delay: 0s; }
      .sb-role:nth-child(2) { animation: sbPulse 4.8s ease-in-out infinite; animation-delay: 0.8s; }
      .sb-role:nth-child(3) { animation: sbPulse 4.8s ease-in-out infinite; animation-delay: 1.6s; }
      @media (prefers-reduced-motion: reduce) {
        .sb-role { animation: none !important; }
      }
    `}</style>

    <div
      className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/2"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(198,95,46,0.08), transparent)',
        animation: 'sbSweep 13s linear infinite',
      }}
    />

    <div className="mb-3 flex items-center gap-2.5">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md border"
        style={{ borderColor: 'rgba(198,95,46,0.32)', background: 'rgba(198,95,46,0.1)' }}
      >
        <Radio className="h-3.5 w-3.5" style={{ color: '#C65F2E' }} />
      </div>
      <p className="text-sm sm:text-[15px] font-semibold" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>
        Your Leadership Team is reviewing your request
      </p>
    </div>

    <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        {checks.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="sb-role rounded-lg border px-2.5 py-2"
              style={{ borderColor: 'rgba(91,143,168,0.24)', background: 'rgba(20,28,38,0.82)' }}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border" style={{ borderColor: 'rgba(91,143,168,0.32)', background: 'rgba(91,143,168,0.1)' }}>
                  <Icon className="h-3 w-3" style={{ color: '#5B8FA8' }} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold" style={{ color: '#E7EEF7', fontFamily: fontFamily.body }}>{item.label}</p>
                  <p className="truncate text-[10px]" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{item.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(91,143,168,0.25)', background: 'rgba(15,23,32,0.82)' }}>
        <div className="space-y-2">
          <div className="ml-auto max-w-[92%] rounded-xl border px-3 py-2" style={{ borderColor: 'rgba(91,143,168,0.25)', background: 'rgba(20,28,38,0.9)' }}>
            <p className="text-xs sm:text-sm" style={{ color: '#E7EEF7', fontFamily: fontFamily.body }}>
              &ldquo;Our competitor just cut pricing by 12%. Should we respond this week?&rdquo;
            </p>
          </div>

          <div className="flex justify-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px]"
              style={{ color: '#EDF1F7', background: 'rgba(198,95,46,0.14)', border: '1px solid rgba(198,95,46,0.3)', fontFamily: fontFamily.mono }}
            >
              Boardroom Mode
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>

          <div className="mr-auto max-w-[96%] rounded-xl border px-3 py-2.5" style={{ borderColor: 'rgba(198,95,46,0.28)', background: 'rgba(198,95,46,0.08)' }}>
            <div className="flex items-start gap-2">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5" style={{ color: '#C65F2E' }} />
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs mb-1" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>
                  Hold headline price, launch a targeted retention offer, and defend margin while monitoring competitor churn.
                </p>
                <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: '#9FB0C3', fontFamily: fontFamily.mono }}>
                  drafting
                  <span style={{ animation: 'sbTyping 1.2s linear infinite' }}>.</span>
                  <span style={{ animation: 'sbTyping 1.2s linear infinite 0.2s' }}>.</span>
                  <span style={{ animation: 'sbTyping 1.2s linear infinite 0.4s' }}>.</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default SoundboardFlagshipStage;
