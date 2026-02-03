import { useState } from 'react';
import { AlertCircle, TrendingDown, AlertTriangle, Info, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from './ui/button';

const WatchtowerEvent = ({ event, onHandle }) => {
  const [showEvidence, setShowEvidence] = useState(false);

  const severityConfig = {
    critical: {
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    high: {
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    medium: {
      icon: TrendingDown,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    low: {
      icon: Info,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    }
  };

  const config = severityConfig[event.severity] || severityConfig.medium;
  const Icon = config.icon;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`rounded-xl border-2 ${config.borderColor} ${config.bgColor} p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0 border ${config.borderColor}`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 text-base leading-tight">
              {event.headline}
            </h3>
            <span className={`text-xs font-medium px-2 py-1 rounded ${config.bgColor} ${config.color} border ${config.borderColor} flex-shrink-0`}>
              {event.severity.toUpperCase()}
            </span>
          </div>
          
          <p className="text-sm text-slate-700 leading-relaxed mt-2">
            {event.statement}
          </p>
          
          {event.consequence_window && (
            <p className="text-xs text-slate-600 mt-2 italic">
              {event.consequence_window}
            </p>
          )}
          
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
            <span>{formatDate(event.created_at)}</span>
            <span>•</span>
            <span className="capitalize">{event.domain}</span>
          </div>
        </div>
      </div>

      {/* Evidence Section */}
      <div className="border-t border-slate-200 pt-3">
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
        >
          {showEvidence ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide evidence
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show evidence
            </>
          )}
        </button>

        {showEvidence && (
          <div className="mt-3 p-4 bg-white rounded-lg border border-slate-200">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
              Evidence
            </h4>
            <div className="space-y-2 text-sm">
              {Object.entries(event.evidence_payload || {}).map(([key, value]) => (
                <div key={key} className="flex">
                  <span className="font-medium text-slate-700 min-w-[180px]">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                  </span>
                  <span className="text-slate-600">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
              Source: {event.source}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {event.status === 'active' && onHandle && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={() => onHandle(event.id)}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Mark as handled
          </Button>
        </div>
      )}
    </div>
  );
};

export default WatchtowerEvent;
