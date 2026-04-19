import { useState } from 'react';
import { ArrowRight, Zap, Brain, Target, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

/**
 * InteractiveDemoExpanded Component
 * Signature interaction showing BIQC's 3-step intelligence process
 * Executive, calm, deliberate
 */
const InteractiveDemoExpanded = ({ onClose }) => {
  const [activeStep, setActiveStep] = useState(1);

  const steps = [
    {
      number: 1,
      title: "Signals",
      subtitle: "What BIQC observes",
      icon: Zap,
      color: "#3b82f6",
      signals: [
        "Email response times increasing across key accounts",
        "Calendar density approaching maximum capacity",
        "CRM pipeline momentum accelerating",
        "Invoice-to-payment cycle extending beyond target"
      ]
    },
    {
      number: 2,
      title: "Interpretation",
      subtitle: "What it means",
      icon: Brain,
      color: "#8b5cf6",
      insights: [
        "Demand growth confirmed (pipeline +22%)",
        "Delivery capacity maxed (team utilization 94%)",
        "Client experience degrading (response time +350%)",
        "Cash conversion slowing (payment cycle +62%)"
      ],
      conclusion: "Therefore: Growth is creating execution strain and cash timing pressure."
    },
    {
      number: 3,
      title: "Recommendation",
      subtitle: "Decision clarity",
      icon: Target,
      color: "#10b981",
      recommendations: [
        {
          priority: "Immediate",
          action: "Throttle new sales pipeline intake by 30-40%",
          why: "Prevent quality collapse and client churn"
        },
        {
          priority: "30-day",
          action: "Expand delivery capacity or automate workflows",
          why: "Restore sustainable growth velocity"
        },
        {
          priority: "Strategic",
          action: "Restructure payment terms to 14-21 day cycle",
          why: "Align cash timing with operational needs"
        }
      ]
    }
  ];

  const currentStepData = steps[activeStep - 1];
  const Icon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-6 sm:px-8 py-6">
          <h3 className="text-2xl font-semibold text-slate-900 mb-2">How BIQC Thinks</h3>
          <p className="text-slate-600">Intelligence process: Signals → Interpretation → Recommendation</p>
        </div>

        {/* Step Navigation */}
        <div className="flex border-b border-slate-200">
          {steps.map((step) => (
            <button
              key={step.number}
              onClick={() => setActiveStep(step.number)}
              className={`flex-1 px-4 sm:px-6 py-4 text-left transition-all ${
                activeStep === step.number
                  ? 'bg-slate-50 border-b-2'
                  : 'hover:bg-slate-50/50'
              }`}
              style={{
                borderBottomColor: activeStep === step.number ? step.color : 'transparent'
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ 
                    background: activeStep === step.number ? step.color : '#f1f5f9',
                    color: activeStep === step.number ? 'white' : '#64748b'
                  }}
                >
                  <span className="text-sm font-bold">{step.number}</span>
                </div>
                <div className="hidden sm:block">
                  <p className="font-semibold text-sm text-slate-900">{step.title}</p>
                  <p className="text-xs text-slate-500">{step.subtitle}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="px-6 sm:px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `${currentStepData.color}15` }}
            >
              <Icon className="w-6 h-6" style={{ color: currentStepData.color }} />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-slate-900">{currentStepData.title}</h4>
              <p className="text-sm text-slate-600">{currentStepData.subtitle}</p>
            </div>
          </div>

          {/* Step 1: Signals */}
          {activeStep === 1 && (
            <div className="space-y-3">
              {currentStepData.signals.map((signal, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-slate-700 leading-relaxed font-mono">{signal}</p>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Interpretation */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                {currentStepData.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 p-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-xl bg-purple-50 border border-purple-200">
                <p className="font-semibold text-purple-900 mb-1">Synthesis:</p>
                <p className="text-sm text-purple-800 leading-relaxed">{currentStepData.conclusion}</p>
              </div>
            </div>
          )}

          {/* Step 3: Recommendation */}
          {activeStep === 3 && (
            <div className="space-y-4">
              {currentStepData.recommendations.map((rec, i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className="text-xs font-bold px-2 py-1 rounded uppercase"
                      style={{
                        background: rec.priority === 'Immediate' ? '#fee2e2' : rec.priority === '30-day' ? '#fef3c7' : '#dbeafe',
                        color: rec.priority === 'Immediate' ? '#991b1b' : rec.priority === '30-day' ? '#92400e' : '#1e40af'
                      }}
                    >
                      {rec.priority}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900 mb-1">{rec.action}</p>
                  <p className="text-sm text-slate-600">Why: {rec.why}</p>
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
            <button
              onClick={onClose}
              className="text-sm text-slate-600 hover:text-slate-900 font-medium"
            >
              Close
            </button>
            <div className="flex items-center gap-2">
              {activeStep < 3 && (
                <Button
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next Step
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {activeStep === 3 && (
                <Button
                  onClick={onClose}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Start Your Trial
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveDemoExpanded;
