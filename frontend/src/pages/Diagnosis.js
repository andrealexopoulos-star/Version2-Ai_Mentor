import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { 
  Loader2, RefreshCw, TrendingUp, AlertCircle,
  Check, DollarSign, Users, Briefcase,
  Clock, Shield, Lightbulb, Zap, Target,
  UserMinus, LineChart, Cog, Scale, MessageSquare
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';

// Expanded business categories with BIQC-style explanations
const businessCategories = {
  strategy: { 
    label: 'Strategy Effectiveness', 
    icon: Target,
    color: 'text-indigo-600',
    bgActive: 'bg-indigo-600',
    bgAvailable: 'bg-indigo-50',
    border: 'border-indigo-200',
    why: 'Whether your current direction is producing expected outcomes or drifting from core objectives.',
    signalClass: 'strategic communications'
  },
  revenue: { 
    label: 'Revenue Momentum', 
    icon: TrendingUp,
    color: 'text-emerald-600',
    bgActive: 'bg-emerald-600',
    bgAvailable: 'bg-emerald-50',
    border: 'border-emerald-200',
    why: 'Sales velocity, pipeline health, and whether revenue growth matches effort invested.',
    signalClass: 'sales and pipeline activity'
  },
  finance: { 
    label: 'Cash Flow & Financial Risk', 
    icon: DollarSign,
    color: 'text-green-600',
    bgActive: 'bg-green-600',
    bgAvailable: 'bg-green-50',
    border: 'border-green-200',
    why: 'Liquidity position, payment obligations, and financial commitments that affect runway.',
    signalClass: 'financial correspondence'
  },
  operations: { 
    label: 'Operations & Delivery', 
    icon: Briefcase,
    color: 'text-blue-600',
    bgActive: 'bg-blue-600',
    bgAvailable: 'bg-blue-50',
    border: 'border-blue-200',
    why: 'Execution quality, delivery timelines, and operational bottlenecks affecting output.',
    signalClass: 'deadline and delivery patterns'
  },
  retention: { 
    label: 'People Retention & Capacity', 
    icon: Users,
    color: 'text-purple-600',
    bgActive: 'bg-purple-600',
    bgAvailable: 'bg-purple-50',
    border: 'border-purple-200',
    why: 'Team stability, workload distribution, and capacity to deliver current commitments.',
    signalClass: 'team and resource discussions'
  },
  peoplerisk: { 
    label: 'People Risk', 
    icon: UserMinus,
    color: 'text-rose-600',
    bgActive: 'bg-rose-600',
    bgAvailable: 'bg-rose-50',
    border: 'border-rose-200',
    why: 'Key person dependencies, succession gaps, and team vulnerabilities that create exposure.',
    signalClass: 'personnel change indicators'
  },
  customer: { 
    label: 'Customer Relationships', 
    icon: LineChart,
    color: 'text-pink-600',
    bgActive: 'bg-pink-600',
    bgAvailable: 'bg-pink-50',
    border: 'border-pink-200',
    why: 'Client satisfaction signals, relationship health, and retention indicators.',
    signalClass: 'client interaction patterns'
  },
  technology: { 
    label: 'Systems & Technology Risk', 
    icon: Cog,
    color: 'text-cyan-600',
    bgActive: 'bg-cyan-600',
    bgAvailable: 'bg-cyan-50',
    border: 'border-cyan-200',
    why: 'Technical debt, system reliability, and infrastructure that could limit growth.',
    signalClass: 'system and technical communications'
  },
  compliance: { 
    label: 'Risk & Compliance', 
    icon: Scale,
    color: 'text-amber-600',
    bgActive: 'bg-amber-600',
    bgAvailable: 'bg-amber-50',
    border: 'border-amber-200',
    why: 'Regulatory obligations, contractual risks, and compliance gaps requiring attention.',
    signalClass: 'regulatory and legal correspondence'
  }
};

// Diagnosis contract: every area must have these fields
const createDiagnosis = (id, count, totalSignals, config) => {
  // Determine urgency based on signal density
  let urgency = 'Low';
  if (count >= 5) urgency = 'High';
  else if (count >= 2) urgency = 'Medium';
  
  // Determine confidence based on total data available
  let confidence_level = 'Limited';
  if (totalSignals >= 10 && count >= 3) confidence_level = 'High';
  else if (totalSignals >= 5 && count >= 1) confidence_level = 'Medium';
  
  // Build evidence summary - MUST reference signal class, NOT generic
  let evidence_summary = '';
  if (count > 0) {
    evidence_summary = `Detected in ${config.signalClass} across recent communications.`;
  } else {
    evidence_summary = `No clear signals detected in ${config.signalClass}.`;
  }
  
  return {
    focus_area: config.label,
    id,
    urgency,
    evidence_summary,
    confidence_level,
    signal_count: count
  };
};

// Validate diagnosis meets contract
const isDiagnosisValid = (diagnosis) => {
  if (!diagnosis.focus_area) return false;
  if (!['High', 'Medium', 'Low'].includes(diagnosis.urgency)) return false;
  if (!diagnosis.evidence_summary || diagnosis.evidence_summary.length < 10) return false;
  if (!['High', 'Medium', 'Limited'].includes(diagnosis.confidence_level)) return false;
  // Check for banned generic phrases
  const banned = ['based on AI', 'advanced analysis', 'machine learning', 'our algorithms'];
  if (banned.some(phrase => diagnosis.evidence_summary.toLowerCase().includes(phrase))) return false;
  return true;
};

// ── Ring Gauge Component (mockup spec) ──
const RingGauge = ({ value, label, size = 100 }) => {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (value || 0) / 100);
  const color = value >= 80 ? '#10B981' : value >= 60 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ textAlign: 'center', minWidth: 100 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-sunken, #060A12)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ marginTop: -60, position: 'relative' }}>
        <div style={{ fontFamily: fontFamily.display, fontSize: 28, color: '#EDF1F7', lineHeight: 1 }}>{value != null ? value : '\u2014'}</div>
        <div style={{ fontFamily: fontFamily.mono, fontSize: 10, color: '#708499', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
};

// Diagnosis dimension definitions for the ring gauge strip
const diagnosisDimensions = [
  { key: 'revenue',   label: 'Revenue Health',      categoryId: 'revenue' },
  { key: 'ops',       label: 'Ops Efficiency',       categoryId: 'operations' },
  { key: 'market',    label: 'Market Position',      categoryId: 'strategy' },
  { key: 'team',      label: 'Team Velocity',        categoryId: 'retention' },
  { key: 'customer',  label: 'Customer Retention',   categoryId: 'customer' },
];

const Diagnosis = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [activeAreas, setActiveAreas] = useState([]);

  useEffect(() => {
    loadAssessment();
  }, []);

  // Navigate to Advisor with proactive trigger
  const goToAdvisorWithTrigger = (areaId) => {
    const diagnosis = assessment?.diagnoses?.find(d => d.id === areaId);
    if (!diagnosis) return;
    
    const config = businessCategories[areaId];
    const params = new URLSearchParams({
      trigger_source: 'Diagnosis',
      focus_area: config?.label || diagnosis.focus_area,
      confidence: diagnosis.confidence_level
    });
    
    navigate(`/advisor?${params.toString()}`);
  };

  const loadAssessment = async () => {
    try {
      // Try to get email-based assessment
      const priorityResponse = await apiClient.get('/email/priority-inbox');
      const analysis = priorityResponse.data?.analysis || {};
      
      // Infer focus areas from patterns
      const highPriority = analysis.high_priority || [];
      const mediumPriority = analysis.medium_priority || [];
      const allEmails = [...highPriority, ...mediumPriority];
      
      const patterns = {};
      Object.keys(businessCategories).forEach(key => patterns[key] = 0);
      
      allEmails.forEach(email => {
        const text = `${email.subject || ''} ${email.why || ''} ${email.action || ''}`.toLowerCase();
        
        if (text.includes('payment') || text.includes('invoice') || text.includes('finance') || text.includes('overdue') || text.includes('budget')) {
          patterns.finance++;
        }
        if (text.includes('sale') || text.includes('deal') || text.includes('proposal') || text.includes('revenue') || text.includes('pipeline')) {
          patterns.revenue++;
        }
        if (text.includes('deadline') || text.includes('delivery') || text.includes('project') || text.includes('timeline') || text.includes('delay')) {
          patterns.operations++;
        }
        if (text.includes('team') || text.includes('staff') || text.includes('hire') || text.includes('capacity') || text.includes('resource')) {
          patterns.retention++;
        }
        if (text.includes('resign') || text.includes('leave') || text.includes('notice') || text.includes('replacement')) {
          patterns.peoplerisk++;
        }
        if (text.includes('client') || text.includes('customer') || text.includes('feedback') || text.includes('complaint') || text.includes('renewal')) {
          patterns.customer++;
        }
        if (text.includes('system') || text.includes('software') || text.includes('outage') || text.includes('bug') || text.includes('tech')) {
          patterns.technology++;
        }
        if (text.includes('compliance') || text.includes('legal') || text.includes('audit') || text.includes('regulation') || text.includes('contract')) {
          patterns.compliance++;
        }
        if (text.includes('strategy') || text.includes('direction') || text.includes('goal') || text.includes('plan') || text.includes('objective')) {
          patterns.strategy++;
        }
      });
      
      // Create diagnoses using contract
      const diagnoses = Object.entries(patterns)
        .map(([id, count]) => createDiagnosis(id, count, allEmails.length, businessCategories[id]))
        .filter(isDiagnosisValid); // Only include valid diagnoses
      
      // Sort by signal count, then urgency
      const urgencyOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
      diagnoses.sort((a, b) => {
        if (b.signal_count !== a.signal_count) return b.signal_count - a.signal_count;
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });
      
      // Set initial active areas from top diagnoses with signals
      const topWithSignals = diagnoses.filter(d => d.signal_count > 0).slice(0, 3);
      if (topWithSignals.length > 0 && activeAreas.length === 0) {
        setActiveAreas(topWithSignals.map(d => d.id));
      }
      
      // Calculate overall confidence
      let overallConfidence = 'Limited';
      if (allEmails.length >= 10 && topWithSignals.length >= 2) {
        overallConfidence = 'High';
      } else if (allEmails.length >= 5 || topWithSignals.length >= 1) {
        overallConfidence = 'Medium';
      }
      
      setAssessment({
        diagnoses,
        totalSignals: allEmails.length,
        generated_at: new Date().toISOString(),
        confidence: overallConfidence,
        uncertaintyNote: overallConfidence === 'Limited' 
          ? 'BIQC has limited visibility into your business. Connect more data sources for clearer diagnosis.'
          : null
      });
      
    } catch (error) {
      // console.log('Assessment from emails not available');
      // When no data, explicitly state uncertainty
      setAssessment({
        diagnoses: Object.entries(businessCategories).map(([id, config]) => ({
          focus_area: config.label,
          id,
          urgency: 'Low',
          evidence_summary: `Awaiting data to assess ${config.signalClass}.`,
          confidence_level: 'Limited',
          signal_count: 0
        })),
        totalSignals: 0,
        generated_at: new Date().toISOString(),
        confidence: 'Limited',
        uncertaintyNote: 'BIQC cannot identify clear signals without connected data sources. These areas are proposed for consideration, not diagnosed.'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    toast.info('Refreshing assessment...');
    await loadAssessment();
    toast.success('Assessment updated');
  };

  const toggleArea = (areaId) => {
    if (activeAreas.includes(areaId)) {
      setActiveAreas(activeAreas.filter(a => a !== areaId));
    } else {
      setActiveAreas([...activeAreas, areaId]);
    }
  };

  // Separate active and available areas based on diagnoses
  const getDiagnosisForId = (id) => assessment?.diagnoses?.find(d => d.id === id);
  const activeCategoryList = Object.entries(businessCategories).filter(([id]) => activeAreas.includes(id));
  const availableCategoryList = Object.entries(businessCategories).filter(([id]) => !activeAreas.includes(id));

  const CategoryCard = ({ id, config, isActive }) => {
    const Icon = config.icon;
    const diagnosis = getDiagnosisForId(id);
    
    // Contract: must have evidence_summary to display
    const hasEvidence = diagnosis && diagnosis.evidence_summary;
    const isLimitedConfidence = diagnosis?.confidence_level === 'Limited';
    
    return (
      <button
        onClick={() => toggleArea(id)}
        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
          isActive 
            ? `${config.bgActive} border-transparent text-white shadow-lg` 
            : `bg-white ${config.border} hover:border-opacity-60`
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : config.bgAvailable}`}>
            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-gray-900'}`}>
                {config.label}
              </span>
              {/* Urgency badge - only show if we have diagnosis */}
              {diagnosis && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-white/20 text-white' : 
                  diagnosis.urgency === 'High' ? 'bg-red-100 text-red-700' :
                  diagnosis.urgency === 'Medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {diagnosis.urgency}
                </span>
              )}
              {/* Confidence badge */}
              {diagnosis && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-white/10 text-white/80' :
                  diagnosis.confidence_level === 'High' ? 'bg-green-50 text-green-600' :
                  diagnosis.confidence_level === 'Medium' ? 'bg-blue-50 text-blue-600' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  {diagnosis.confidence_level} confidence
                </span>
              )}
            </div>
            
            {/* Evidence summary - REQUIRED by contract */}
            {hasEvidence && (
              <p className={`text-xs mt-1.5 leading-relaxed ${
                isActive ? 'text-white/80' : 'text-gray-600'
              } ${isLimitedConfidence ? 'italic' : ''}`}>
                {diagnosis.evidence_summary}
              </p>
            )}
            
            {/* Why this matters - secondary info */}
            <p className={`text-xs mt-1 ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
              {config.why}
            </p>
            
            {/* Discuss with Advisor button - only for active areas with signals */}
            {isActive && diagnosis?.signal_count > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToAdvisorWithTrigger(id);
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Discuss with Advisor
              </button>
            )}
          </div>
          <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            isActive ? 'bg-white border-white' : 'border-gray-300'
          }`}>
            {isActive && <Check className="w-3 h-3 text-gray-800" />}
          </div>
        </div>
      </button>
    );
  };

  if (loading) {
    const loadingView = (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <CognitiveMesh compact />
          <p className="font-medium text-gray-900">Analyzing your business signals...</p>
          <p className="text-sm mt-1 text-gray-500">BIQC is reviewing patterns in your data</p>
        </div>
      </div>
    );
    
    return embedded ? loadingView : <DashboardLayout>{loadingView}</DashboardLayout>;
  }

  // Main diagnostic content
  const diagnosticContent = (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" data-testid="diagnosis-page">
      
      {/* Header - only show in standalone mode */}
      {!embedded && (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Diagnosis</h1>
            <p className="text-sm mt-1" style={{ color: '#8FA0B8' }}>
              Select areas to focus your advisory intelligence on
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      )}

      {/* ── Ring Gauge Strip (5 dimensions) ── */}
      {assessment && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          padding: '24px 16px',
          background: 'rgba(14,22,40,0.6)',
          borderRadius: 16,
          border: '1px solid rgba(140,170,210,0.12)',
          overflowX: 'auto',
        }}>
          {diagnosisDimensions.map(dim => {
            const diag = assessment.diagnoses?.find(d => d.id === dim.categoryId);
            // Derive a 0-100 score from signal data — scale signal_count relative to total
            let score = null;
            if (diag && assessment.totalSignals > 0 && diag.signal_count > 0) {
              // Score: inverse-urgency weighted — High urgency = lower health score
              const urgencyWeight = diag.urgency === 'High' ? 35 : diag.urgency === 'Medium' ? 60 : 85;
              const signalRatio = Math.min(diag.signal_count / Math.max(assessment.totalSignals, 1), 1);
              score = Math.round(urgencyWeight + (1 - signalRatio) * 15);
              score = Math.max(0, Math.min(100, score));
            } else if (diag && diag.signal_count === 0) {
              score = null; // No data — show dash
            }
            return <RingGauge key={dim.key} value={score} label={dim.label} />;
          })}
        </div>
      )}

      {/* ── AI Findings Panel ── */}
      {assessment && assessment.diagnoses?.some(d => d.signal_count > 0) && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(232,93,0,0.12) 0%, rgba(14,22,40,0.9) 60%)',
          borderRadius: 16,
          border: '1px solid rgba(232,93,0,0.25)',
          padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: '#E85D00',
              boxShadow: '0 0 8px rgba(232,93,0,0.6)',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontFamily: fontFamily.display, fontSize: 18, color: '#EDF1F7', fontWeight: 600 }}>
              BIQc Diagnosis
            </span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0' }}>
            {assessment.diagnoses
              .filter(d => d.signal_count > 0)
              .slice(0, 4)
              .map((d, i) => (
                <li key={d.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 0',
                  borderBottom: i < 3 ? '1px solid rgba(140,170,210,0.08)' : 'none',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                    background: d.urgency === 'High' ? '#EF4444' : d.urgency === 'Medium' ? '#F59E0B' : '#10B981',
                  }} />
                  <div>
                    <span style={{ fontFamily: fontFamily.body, fontSize: 14, color: '#EDF1F7', fontWeight: 500 }}>
                      {d.focus_area}
                    </span>
                    <span style={{ fontFamily: fontFamily.body, fontSize: 13, color: '#8FA0B8', marginLeft: 8 }}>
                      {d.evidence_summary}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
          <button
            onClick={() => {
              const topArea = assessment.diagnoses.find(d => d.signal_count > 0);
              if (topArea) goToAdvisorWithTrigger(topArea.id);
            }}
            style={{
              fontFamily: fontFamily.body,
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: '#E85D00',
              border: 'none',
              borderRadius: 12,
              padding: '10px 24px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#C24D00'}
            onMouseLeave={e => e.currentTarget.style.background = '#E85D00'}
          >
            Discuss with BIQc
          </button>
        </div>
      )}

      {/* Confidence indicator + Uncertainty note */}
      {assessment && (
        <div className="space-y-2">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            assessment.confidence === 'High' ? 'bg-green-50 text-green-700' :
            assessment.confidence === 'Medium' ? 'bg-blue-50 text-blue-700' :
            'bg-amber-50 text-amber-700'
          }`}>
            <AlertCircle className="w-4 h-4" />
            <span>
              {assessment.confidence === 'High' && `High confidence — Clear patterns detected across ${assessment.totalSignals} communications`}
              {assessment.confidence === 'Medium' && `Medium confidence — Some patterns visible, analysis strengthening`}
              {assessment.confidence === 'Limited' && `Limited confidence — Insufficient data for definitive diagnosis`}
            </span>
          </div>
          
          {/* Explicit uncertainty statement when confidence is limited */}
          {assessment.uncertaintyNote && (
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-xs text-gray-600 italic">
                {assessment.uncertaintyNote}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active Focus Areas */}
      {activeCategoryList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Active Focus Areas
            </h2>
            <span className="text-xs text-gray-400">Click to remove</span>
          </div>
          <div className="space-y-2">
            {activeCategoryList.map(([id, config]) => (
              <CategoryCard key={id} id={id} config={config} isActive={true} />
            ))}
          </div>
        </div>
      )}

      {/* Available Areas */}
      {availableCategoryList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-300"></div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Available Areas
            </h2>
            <span className="text-xs text-gray-400">Click to add</span>
          </div>
          <div className="space-y-2">
            {availableCategoryList.map(([id, config]) => (
              <CategoryCard key={id} id={id} config={config} isActive={false} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs text-center text-gray-400">
          Last updated: {assessment?.generated_at ? new Date(assessment.generated_at).toLocaleString() : 'Just now'}
        </p>
      </div>
    </div>
  );
  
  // If embedded, return just the content
  if (embedded) {
    return diagnosticContent;
  }
  
  // If standalone, wrap in DashboardLayout
  return (
    <DashboardLayout>
      {diagnosticContent}
    </DashboardLayout>
  );
};

export default Diagnosis;
