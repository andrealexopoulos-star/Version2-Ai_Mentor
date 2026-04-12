import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { isPrivilegedUser } from '../lib/privilegedUser';
import { apiClient } from '../lib/api';
import { ArrowRight, ArrowLeft, CheckCircle2, Eye, Lock, AlertTriangle, TrendingUp, Shield, Target } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const QUESTIONS = [
  { id: 'revenue_ambition', question: 'What is your revenue ambition over the next 12 months?', options: ['Maintain current revenue — focus on stability', 'Grow 10-25% — steady organic growth', 'Grow 25-50% — aggressive but controlled', 'Double+ — hypergrowth mode'], weight: 'revenue' },
  { id: 'growth_timeline', question: 'What is your growth timeline pressure?', options: ['No pressure — long-term play', '6-12 months — need results soon', '3-6 months — urgent growth required', 'Immediate — existential urgency'], weight: 'timeline' },
  { id: 'cohort_intention', question: 'How do you plan to change your customer cohort?', options: ['Keep current cohort — deepen relationships', 'Expand within same industry — adjacent segments', 'Enter new industries — diversification', 'Move upmarket — enterprise shift'], weight: 'cohort' },
  { id: 'risk_appetite', question: 'How much are you willing to risk on growth?', options: ['Very conservative — no risk to current business', 'Moderate — willing to invest with safety net', 'Aggressive — significant investment for returns', 'All-in — bet the company on growth'], weight: 'risk' },
  { id: 'retention_maturity', question: 'How mature is your client retention strategy?', options: ['No formal retention — reactive only', 'Basic — annual reviews, some proactive outreach', 'Structured — NPS, health scores, playbooks', 'Advanced — predictive churn, automated interventions'], weight: 'retention' },
  { id: 'pricing_confidence', question: 'How confident are you in your current pricing?', options: ['Not confident — pricing by gut feel', 'Somewhat — based on competitor comparison', 'Confident — value-based, tested', 'Very confident — data-driven, continuously optimised'], weight: 'pricing' },
  { id: 'channel_dependency', question: 'How dependent are you on a single acquisition channel?', options: ['Fully dependent — one channel drives everything', 'Mostly dependent — 70%+ from one channel', 'Diversified — spread across 3-4 channels', 'Highly diversified — no single channel > 30%'], weight: 'channel' },
];

const SIGNAL_ICONS = { warning: AlertTriangle, critical: AlertTriangle, positive: TrendingUp, info: Shield };
const SIGNAL_COLORS = { warning: '#F59E0B', critical: '#EF4444', positive: '#10B981', info: '#3B82F6' };

const ForensicCalibration = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingResult, setExistingResult] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin' || isPrivilegedUser(user);

  // Check for existing calibration on mount
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await apiClient.get('/forensic/calibration');
        if (res.data?.exists) setExistingResult(res.data);
      } catch {} finally { setLoadingExisting(false); }
    };
    fetchExisting();
  }, []);

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md">
            <Lock className="w-12 h-12 text-[#64748B] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[#EDF1F7] mb-2" style={{ fontFamily: fontFamily.display }}>Coming Soon</h1>
            <p className="text-sm text-[#8FA0B8] mb-6">Forensic Market Calibration will be available in the Pro plan.</p>
            <button onClick={() => navigate('/market')} className="px-6 py-2.5 rounded-xl text-sm" style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)' }} data-testid="forensic-back-btn">Back to Market</button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loadingExisting) return <DashboardLayout><div className="flex items-center justify-center min-h-[60vh]"><div className="w-6 h-6 border-2 border-[#E85D00] border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;

  const handleSelect = (option) => setSelected(option);

  const handleContinue = async () => {
    if (!selected) return;
    const updated = { ...answers, [QUESTIONS[step].id]: { answer: selected, index: QUESTIONS[step].options.indexOf(selected), weight: QUESTIONS[step].weight } };
    setAnswers(updated);
    setSelected(null);

    if (step >= QUESTIONS.length - 1) {
      setSubmitting(true);
      try {
        const res = await apiClient.post('/forensic/calibration', { answers: updated });
        setResult(res.data);
      } catch { setResult({ composite_score: 0, risk_profile: 'Error', risk_color: '#EF4444', dimensions: {}, signals: [{ type: 'critical', text: 'Scoring failed. Please try again.' }] }); }
      finally { setSubmitting(false); }
      return;
    }
    setStep(step + 1);
  };

  // Show existing or new results
  const displayResult = result || (existingResult?.exists && !step ? existingResult : null);

  if (displayResult && displayResult.composite_score != null) {
    const dims = displayResult.dimensions || {};
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto py-10 px-6" data-testid="forensic-results">
          <div className="text-center mb-8">
            <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[#EDF1F7] mb-2" style={{ fontFamily: fontFamily.display }}>Forensic Calibration Complete</h1>
            <p className="text-sm text-[#8FA0B8]">Your strategic profile has been scored and calibrated.</p>
          </div>

          {/* Composite Score */}
          <div className="text-center mb-8 p-6 rounded-xl" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Composite Score</span>
            <span className="text-5xl font-bold block mb-2" style={{ fontFamily: fontFamily.mono, color: displayResult.risk_color }}>{displayResult.composite_score}</span>
            <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ color: displayResult.risk_color, background: displayResult.risk_color + '15', fontFamily: fontFamily.mono }}>{displayResult.risk_profile}</span>
          </div>

          {/* Dimension Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {Object.entries(dims).map(([key, dim]) => (
              <div key={key} className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                <span className="text-[10px] text-[#64748B] block mb-1 capitalize" style={{ fontFamily: fontFamily.mono }}>{key}</span>
                <span className="text-lg font-bold text-[#EDF1F7] block" style={{ fontFamily: fontFamily.mono }}>{dim.label}</span>
                <div className="h-1.5 rounded-full mt-2" style={{ background: 'rgba(140,170,210,0.15)' }}>
                  <div className="h-1.5 rounded-full transition-all" style={{ background: '#E85D00', width: `${dim.score}%` }} />
                </div>
                <span className="text-[10px] text-[#64748B] mt-1 block" style={{ fontFamily: fontFamily.mono }}>{dim.score}/100</span>
              </div>
            ))}
          </div>

          {/* Strategic Signals */}
          {displayResult.signals?.length > 0 && (
            <div className="space-y-2 mb-8">
              <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: fontFamily.mono }}>Strategic Signals</span>
              {displayResult.signals.map((sig, i) => {
                const Icon = SIGNAL_ICONS[sig.type] || Shield;
                const color = SIGNAL_COLORS[sig.type] || '#3B82F6';
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: color + '08', border: `1px solid ${color}25` }}>
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--biqc-text-2)' }}>{sig.text}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button onClick={() => { setResult(null); setExistingResult(null); setStep(0); setAnswers({}); }} className="px-6 py-2.5 rounded-xl text-sm" style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)' }} data-testid="forensic-recalibrate-btn">
              Recalibrate
            </button>
            <button onClick={() => navigate('/market')} className="px-8 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#E85D00' }} data-testid="forensic-return-btn">
              Return to Market Intelligence <ArrowRight className="w-4 h-4 inline ml-1" />
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const q = QUESTIONS[step];
  const progress = Math.round((step / QUESTIONS.length) * 100);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-10 px-6" data-testid="forensic-calibration">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#E85D00]" />
            <h1 className="text-sm font-medium tracking-wide uppercase" style={{ color: '#8FA0B8', fontFamily: fontFamily.mono }}>Market Analysis</h1>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ color: '#E85D00', background: '#E85D0015', fontFamily: fontFamily.mono }}>{step + 1}/{QUESTIONS.length}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mb-8" style={{ background: 'rgba(140,170,210,0.15)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #E85D00, #3B82F6)' }} />
        </div>

        <div className="mb-8">
          <p className="text-xl font-bold text-[#EDF1F7] mb-6" style={{ fontFamily: fontFamily.display }}>{q.question}</p>
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              const isSelected = selected === opt;
              return (
                <button key={i} onClick={() => handleSelect(opt)} className="w-full text-left rounded-xl px-6 py-5 transition-all" style={{ background: isSelected ? '#E85D0010' : '#0E1628', border: `2px solid ${isSelected ? '#E85D00' : 'rgba(140,170,210,0.15)'}` }} data-testid={`forensic-option-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ border: `2px solid ${isSelected ? '#E85D00' : '#64748B'}`, background: isSelected ? '#E85D00' : 'transparent' }}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-[#EDF1F7]">{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between">
          {step > 0 ? (
            <button onClick={() => { setStep(step - 1); setSelected(answers[QUESTIONS[step - 1]?.id]?.answer || null); }} className="px-5 py-2.5 rounded-xl text-sm flex items-center gap-1" style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)' }} data-testid="forensic-back-step">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}
          <button onClick={handleContinue} disabled={!selected || submitting} className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-30 flex items-center gap-1" style={{ background: '#E85D00' }} data-testid="forensic-continue">
            {submitting ? 'Scoring...' : step >= QUESTIONS.length - 1 ? 'Complete' : 'Continue'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ForensicCalibration;
