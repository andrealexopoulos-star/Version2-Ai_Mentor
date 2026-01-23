import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { 
  Loader2, RefreshCw, Target, TrendingUp, AlertCircle,
  ChevronRight, Check, Plus, DollarSign, Users, Briefcase,
  BarChart3, Clock, Shield, Lightbulb, Zap
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';

// Business areas with icons and evidence patterns
const businessAreas = {
  finance: { 
    label: 'Cash Flow & Finance', 
    icon: DollarSign,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200'
  },
  revenue: { 
    label: 'Revenue & Sales', 
    icon: TrendingUp,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  },
  operations: { 
    label: 'Operations & Delivery', 
    icon: Briefcase,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200'
  },
  team: { 
    label: 'Team & Capacity', 
    icon: Users,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200'
  },
  customer: { 
    label: 'Customer Relationships', 
    icon: Target,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200'
  },
  strategy: { 
    label: 'Strategy & Direction', 
    icon: Lightbulb,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200'
  },
  technology: { 
    label: 'Systems & Technology', 
    icon: Zap,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200'
  },
  risk: { 
    label: 'Risk & Compliance', 
    icon: Shield,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200'
  }
};

const Diagnosis = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [focusedAreas, setFocusedAreas] = useState([]);
  const [showAreaPicker, setShowAreaPicker] = useState(false);

  // Auto-load assessment on mount
  useEffect(() => {
    loadAssessment();
  }, []);

  const loadAssessment = async () => {
    try {
      const response = await apiClient.get('/business/assessment');
      setAssessment(response.data);
    } catch (error) {
      // Generate fallback assessment from available data
      console.log('Assessment endpoint not available, using fallback');
      await generateFallbackAssessment();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateFallbackAssessment = async () => {
    try {
      // Try to get email priority data to infer assessment
      const priorityResponse = await apiClient.get('/email/priority-inbox');
      const analysis = priorityResponse.data?.analysis || {};
      
      // Infer focus areas from email patterns
      const inferredAreas = [];
      
      // Check high priority emails for patterns
      const highPriority = analysis.high_priority || [];
      const mediumPriority = analysis.medium_priority || [];
      
      // Simple pattern detection
      const allEmails = [...highPriority, ...mediumPriority];
      const patterns = {
        finance: 0,
        revenue: 0,
        operations: 0,
        team: 0,
        customer: 0
      };
      
      allEmails.forEach(email => {
        const text = `${email.subject || ''} ${email.why || ''} ${email.action || ''}`.toLowerCase();
        if (text.includes('payment') || text.includes('invoice') || text.includes('finance') || text.includes('overdue')) {
          patterns.finance++;
        }
        if (text.includes('sale') || text.includes('deal') || text.includes('proposal') || text.includes('quote')) {
          patterns.revenue++;
        }
        if (text.includes('deadline') || text.includes('delivery') || text.includes('project') || text.includes('timeline')) {
          patterns.operations++;
        }
        if (text.includes('team') || text.includes('staff') || text.includes('meeting') || text.includes('resource')) {
          patterns.team++;
        }
        if (text.includes('client') || text.includes('customer') || text.includes('feedback') || text.includes('support')) {
          patterns.customer++;
        }
      });
      
      // Sort by frequency and take top 3
      const sorted = Object.entries(patterns)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      if (sorted.length > 0) {
        inferredAreas.push({
          id: sorted[0][0],
          urgency: highPriority.length > 3 ? 'high' : 'medium',
          why: `Detected ${sorted[0][1]} related communications requiring attention in recent emails.`,
          evidence: `Based on analysis of ${allEmails.length} prioritized emails.`
        });
      }
      
      if (sorted.length > 1) {
        inferredAreas.push({
          id: sorted[1][0],
          urgency: 'medium',
          why: `Secondary pattern detected with ${sorted[1][1]} related items flagged.`,
          evidence: 'Recurring theme in business communications.'
        });
      }
      
      if (sorted.length > 2) {
        inferredAreas.push({
          id: sorted[2][0],
          urgency: 'low',
          why: `Emerging area with ${sorted[2][1]} signals detected.`,
          evidence: 'Worth monitoring for developing patterns.'
        });
      }
      
      // Fallback if no patterns detected
      if (inferredAreas.length === 0) {
        inferredAreas.push({
          id: 'operations',
          urgency: 'medium',
          why: 'Standard operational focus recommended while gathering more business intelligence.',
          evidence: 'Connect more data sources to enable deeper analysis.'
        });
      }
      
      setAssessment({
        primary: inferredAreas[0] || null,
        secondary: inferredAreas.slice(1),
        generated_at: new Date().toISOString(),
        confidence: inferredAreas.length > 1 ? 'moderate' : 'limited',
        data_sources: ['Email communications', 'Priority analysis']
      });
      
    } catch (error) {
      console.error('Fallback assessment failed:', error);
      // Ultimate fallback
      setAssessment({
        primary: {
          id: 'strategy',
          urgency: 'medium',
          why: 'Initial assessment pending. Connect your business tools to enable BIQC analysis.',
          evidence: 'Awaiting data from connected integrations.'
        },
        secondary: [],
        generated_at: new Date().toISOString(),
        confidence: 'pending',
        data_sources: []
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    toast.info('Reassessing your business...');
    await loadAssessment();
    toast.success('Assessment updated');
  };

  const handleFocusArea = (areaId) => {
    if (focusedAreas.includes(areaId)) {
      setFocusedAreas(focusedAreas.filter(a => a !== areaId));
      toast.info('Focus removed');
    } else {
      setFocusedAreas([...focusedAreas, areaId]);
      toast.success('Added to focus areas');
    }
  };

  const handleAddSecondaryArea = (areaId) => {
    if (!focusedAreas.includes(areaId)) {
      setFocusedAreas([...focusedAreas, areaId]);
      toast.success(`Added ${businessAreas[areaId]?.label || areaId} to focus`);
    }
    setShowAreaPicker(false);
  };

  // Filter areas by urgency
  const getFilteredAreas = () => {
    if (!assessment) return [];
    
    const allAreas = [
      assessment.primary,
      ...(assessment.secondary || [])
    ].filter(Boolean);
    
    if (urgencyFilter === 'all') return allAreas;
    return allAreas.filter(area => area.urgency === urgencyFilter);
  };

  const filteredAreas = getFilteredAreas();

  const AreaCard = ({ area, isPrimary = false }) => {
    const config = businessAreas[area.id] || businessAreas.strategy;
    const Icon = config.icon;
    const isFocused = focusedAreas.includes(area.id);
    
    return (
      <div 
        className={`relative p-5 rounded-xl border-2 transition-all ${
          isPrimary ? 'border-l-4' : ''
        } ${config.border} ${isFocused ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
        style={{ background: 'var(--bg-card)' }}
      >
        {/* Urgency indicator */}
        <div className="absolute top-4 right-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            area.urgency === 'high' ? 'bg-red-100 text-red-800' :
            area.urgency === 'medium' ? 'bg-amber-100 text-amber-800' :
            'bg-green-100 text-green-800'
          }`}>
            {area.urgency === 'high' ? '● High' : area.urgency === 'medium' ? '● Medium' : '● Low'}
          </span>
        </div>
        
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`p-2.5 rounded-lg ${config.bg}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div className="flex-1 pr-20">
            {isPrimary && (
              <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Primary Focus</span>
            )}
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {config.label}
            </h3>
          </div>
        </div>
        
        {/* Why explanation */}
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
          {area.why}
        </p>
        
        {/* Evidence */}
        {area.evidence && (
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            <span className="font-medium">Evidence:</span> {area.evidence}
          </p>
        )}
        
        {/* Action */}
        <Button
          variant={isFocused ? "default" : "outline"}
          size="sm"
          onClick={() => handleFocusArea(area.id)}
          className={isFocused ? 'bg-blue-600 text-white' : ''}
        >
          {isFocused ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Focused
            </>
          ) : (
            <>
              <Target className="w-3.5 h-3.5 mr-1.5" />
              Focus on this
            </>
          )}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Analyzing your business...</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              BIQC is reviewing your communications and data
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in" data-testid="diagnosis-page">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Business Assessment
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {assessment?.generated_at ? (
                `Last updated ${new Date(assessment.generated_at).toLocaleString()}`
              ) : (
                'Real-time analysis of your business priorities'
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Urgency Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>View:</span>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
            {['all', 'high', 'medium', 'low'].map((filter) => (
              <button
                key={filter}
                onClick={() => setUrgencyFilter(filter)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  urgencyFilter === filter
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-white/50'
                }`}
                style={{ 
                  color: urgencyFilter === filter ? 'var(--text-primary)' : 'var(--text-muted)'
                }}
              >
                {filter === 'all' ? 'All' : 
                 filter === 'high' ? '🔴 High' :
                 filter === 'medium' ? '🟡 Medium' : '🟢 Low'}
              </button>
            ))}
          </div>
        </div>

        {/* Assessment Cards */}
        <div className="space-y-4">
          {filteredAreas.length > 0 ? (
            filteredAreas.map((area, idx) => (
              <AreaCard 
                key={area.id} 
                area={area} 
                isPrimary={idx === 0 && urgencyFilter === 'all'} 
              />
            ))
          ) : (
            <div 
              className="text-center py-12 rounded-xl border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}
            >
              <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>
                No {urgencyFilter} urgency items detected
              </p>
              <button 
                onClick={() => setUrgencyFilter('all')}
                className="text-sm text-blue-600 hover:underline mt-2"
              >
                View all areas
              </button>
            </div>
          )}
        </div>

        {/* Something Else Action */}
        <div 
          className="p-5 rounded-xl border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Something else on your mind?
              </h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Add another area to your focus if BIQC hasn't surfaced it yet
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowAreaPicker(!showAreaPicker)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add area
            </Button>
          </div>
          
          {/* Area Picker */}
          {showAreaPicker && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(businessAreas).map(([id, config]) => {
                  const Icon = config.icon;
                  const isAlreadyFocused = focusedAreas.includes(id);
                  const isInAssessment = [assessment?.primary?.id, ...(assessment?.secondary?.map(s => s.id) || [])].includes(id);
                  
                  return (
                    <button
                      key={id}
                      onClick={() => handleAddSecondaryArea(id)}
                      disabled={isAlreadyFocused || isInAssessment}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isAlreadyFocused || isInAssessment
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:border-blue-300 hover:bg-blue-50/50'
                      }`}
                      style={{ borderColor: 'var(--border-light)' }}
                    >
                      <Icon className={`w-4 h-4 mb-1.5 ${config.color}`} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Confidence indicator */}
        {assessment?.confidence && (
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Assessment confidence: {assessment.confidence} · 
            Data sources: {assessment.data_sources?.join(', ') || 'None connected'}
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Diagnosis;
