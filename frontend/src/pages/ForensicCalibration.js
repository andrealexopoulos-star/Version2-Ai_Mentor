import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { ArrowRight, ArrowLeft, CheckCircle2, Eye, Lock } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const QUESTIONS = [
  { id: 'revenue_ambition', question: 'What is your revenue ambition over the next 12 months?', options: ['Maintain current revenue — focus on stability', 'Grow 10-25% — steady organic growth', 'Grow 25-50% — aggressive but controlled', 'Double+ — hypergrowth mode'], weight: 'revenue' },
  { id: 'growth_timeline', question: 'What is your growth timeline pressure?', options: ['No pressure — long-term play', '6-12 months — need results soon', '3-6 months — urgent growth required', 'Immediate — existential urgency'], weight: 'timeline' },
  { id: 'cohort_intention', question: 'How do you plan to change your customer cohort?', options: ['Keep current cohort — deepen relationships', 'Expand within same industry — adjacent segments', 'Enter new industries — diversification', 'Move upmarket — enterprise shift'], weight: 'cohort' },
  { id: 'risk_appetite', question: 'How much are you willing to risk on growth?', options: ['Very conservative — no risk to current business', 'Moderate — willing to invest with safety net', 'Aggressive — significant investment for returns', 'All-in — bet the company on growth'], weight: 'risk' },
  { id: 'retention_maturity', question: 'How mature is your client retention strategy?', options: ['No formal retention — reactive only', 'Basic — annual reviews, some proactive outreach', 'Structured — NPS, health scores, playbooks', 'Advanced — predictive churn, automated interventions'], weight: 'retention' },
  { id: 'pricing_confidence', question: 'How confident are you in your current pricing?', options: ['Not confident — pricing by gut feel', 'Somewhat — based on competitor comparison', 'Confident — value-based, tested', 'Very confident — data-driven, continuously optimised'], weight: 'pricing' },
  { id: 'channel_dependency', question: 'How dependent are you on a single acquisition channel?', options: ['Fully dependent — one channel drives everything', 'Mostly dependent — 70%+ from one channel', 'Diversified — spread across 3-4 channels', 'Highly diversified — no single channel > 30%'], weight: 'channel' },
];

const ForensicCalibration = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [complete, setComplete] = useState(false);

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin' || user?.email === 'andre@thestrategysquad.com.au';

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md">
            <Lock className="w-12 h-12 text-[#64748B] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>Coming Soon</h1>
            <p className="text-sm text-[#9FB0C3] mb-6">Forensic Market Calibration will be available in the Pro plan.</p>
            <button onClick={() => navigate('/market')} className="px-6 py-2.5 rounded-xl text-sm" style={{ color: '#9FB0C3', border: '1px solid #243140' }}>Back to Market</button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const q = QUESTIONS[step];
  const progress = Math.round((step / QUESTIONS.length) * 100);

  const handleSelect = (option) => {
    setSelected(option);
  };

  const handleContinue = async () => {
    if (!selected) return;
    const updated = { ...answers, [q.id]: { answer: selected, index: q.options.indexOf(selected), weight: q.weight } };
    setAnswers(updated);
    setSelected(null);

    if (step >= QUESTIONS.length - 1) {
      // Save results
      try {
        await apiClient.put('/business-profile', { forensic_calibration: updated });
      } catch {}
      setComplete(true);
      return;
    }
    setStep(step + 1);
  };

  if (complete) {
    // Calculate scores
    const scores = {};
    Object.values(answers).forEach(a => { scores[a.weight] = a.index; });
    const avgScore = Object.values(scores).reduce((s, v) => s + v, 0) / Object.values(scores).length;
    const riskLevel = avgScore > 2.5 ? 'Aggressive' : avgScore > 1.5 ? 'Moderate' : 'Conservative';

    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto py-10 px-6" data-testid="forensic-results">
          <div className="text-center mb-8">
            <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>Forensic Calibration Complete</h1>
            <p className="text-sm text-[#9FB0C3]">Your strategic profile has been calibrated.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Risk Profile', value: riskLevel, color: avgScore > 2.5 ? '#EF4444' : avgScore > 1.5 ? '#F59E0B' : '#10B981' },
              { label: 'Revenue Ambition', value: ['Maintain', 'Steady', 'Aggressive', 'Hyper'][scores.revenue || 0], color: '#3B82F6' },
              { label: 'Retention Maturity', value: ['Reactive', 'Basic', 'Structured', 'Advanced'][scores.retention || 0], color: '#10B981' },
              { label: 'Pricing Confidence', value: ['Low', 'Some', 'Confident', 'Very High'][scores.pricing || 0], color: '#FF6A00' },
            ].map(m => (
              <div key={m.label} className="p-4 rounded-lg" style={{ background: '#141C26', border: '1px solid #243140' }}>
                <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>{m.label}</span>
                <span className="text-lg font-bold" style={{ fontFamily: MONO, color: m.color }}>{m.value}</span>
              </div>
            ))}
          </div>

          <button onClick={() => navigate('/market')} className="px-8 py-3 rounded-xl text-sm font-semibold text-white mx-auto block" style={{ background: '#FF6A00' }}>
            Return to Market Intelligence <ArrowRight className="w-4 h-4 inline ml-1" />
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-10 px-6" data-testid="forensic-calibration">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#FF6A00]" />
            <h1 className="text-sm font-medium tracking-wide uppercase" style={{ color: '#9FB0C3', fontFamily: MONO }}>Forensic Calibration</h1>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ color: '#FF6A00', background: '#FF6A0015', fontFamily: MONO }}>{step + 1}/{QUESTIONS.length}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mb-8" style={{ background: '#243140' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #FF6A00, #3B82F6)' }} />
        </div>

        {/* Question */}
        <div className="mb-8">
          <p className="text-xl font-bold text-[#F4F7FA] mb-6" style={{ fontFamily: HEAD }}>{q.question}</p>
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              const isSelected = selected === opt;
              return (
                <button key={i} onClick={() => handleSelect(opt)} className="w-full text-left rounded-xl px-6 py-5 transition-all" style={{ background: isSelected ? '#FF6A0010' : '#141C26', border: `2px solid ${isSelected ? '#FF6A00' : '#243140'}` }} data-testid={`forensic-option-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ border: `2px solid ${isSelected ? '#FF6A00' : '#64748B'}`, background: isSelected ? '#FF6A00' : 'transparent' }}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-[#F4F7FA]">{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nav */}
        <div className="flex justify-between">
          {step > 0 ? (
            <button onClick={() => { setStep(step - 1); setSelected(answers[QUESTIONS[step - 1]?.id]?.answer || null); }} className="px-5 py-2.5 rounded-xl text-sm flex items-center gap-1" style={{ color: '#9FB0C3', border: '1px solid #243140' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}
          <button onClick={handleContinue} disabled={!selected} className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-30 flex items-center gap-1" style={{ background: '#FF6A00' }} data-testid="forensic-continue">
            {step >= QUESTIONS.length - 1 ? 'Complete' : 'Continue'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ForensicCalibration;
