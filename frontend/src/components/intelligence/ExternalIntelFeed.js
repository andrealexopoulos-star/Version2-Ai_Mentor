/**
 * ExternalIntelFeed — Displays aggregated external intelligence
 * (industry news, regulatory signals, economic indicators, reputation, job market).
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api';
import { fontFamily } from '../../design-system/tokens';
import {
  Newspaper, Scale, BarChart3, Star, Briefcase,
  ExternalLink, ChevronRight, Filter
} from 'lucide-react';

const FEED_TYPES = [
  { key: 'all',                label: 'All',          icon: Filter,     color: '#E85D00' },
  { key: 'industry_news',     label: 'News',         icon: Newspaper,  color: '#3B82F6' },
  { key: 'regulatory_signals', label: 'Regulatory',   icon: Scale,      color: '#EF4444' },
  { key: 'economic_indicators',label: 'Economy',      icon: BarChart3,  color: '#22C55E' },
  { key: 'reputation_signals', label: 'Reputation',   icon: Star,       color: '#F59E0B' },
  { key: 'job_market_signals', label: 'Job Market',   icon: Briefcase,  color: '#8B5CF6' },
];

const SENTIMENT_COLORS = {
  positive: '#22C55E',
  negative: '#EF4444',
  neutral:  '#708499',
  mixed:    '#F59E0B',
};

const ExternalIntelFeed = () => {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchFeed = useCallback(async () => {
    try {
      const res = await apiClient.get('/intelligence/external-feed');
      setFeed(res.data?.items || []);
    } catch (e) {
      console.error('[ExternalIntelFeed] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const filteredFeed = activeFilter === 'all'
    ? feed
    : feed.filter(item => item.source_type === activeFilter);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {FEED_TYPES.map(type => {
          const Icon = type.icon;
          const isActive = activeFilter === type.key;
          return (
            <button key={type.key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all"
              style={{
                background: isActive ? `${type.color}15` : 'transparent',
                color: isActive ? type.color : '#708499',
                border: isActive ? `1px solid ${type.color}30` : '1px solid transparent',
                fontFamily: fontFamily.mono,
              }}
              onClick={() => setActiveFilter(type.key)}>
              <Icon className="w-3 h-3" />
              {type.label}
              {type.key !== 'all' && (
                <span className="text-[10px] opacity-60">
                  {feed.filter(i => i.source_type === type.key).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filteredFeed.length === 0 ? (
        <div className="text-center py-10">
          <Newspaper className="w-8 h-8 mx-auto mb-2" style={{ color: '#708499' }} />
          <p className="text-sm" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>
            No external intelligence signals yet. Data populates as the system monitors your industry.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFeed.slice(0, 20).map((item, idx) => {
            const typeConfig = FEED_TYPES.find(t => t.key === item.source_type) || FEED_TYPES[0];
            const Icon = typeConfig.icon;
            const sentimentColor = SENTIMENT_COLORS[item.sentiment] || SENTIMENT_COLORS.neutral;

            return (
              <div key={item.id || idx}
                className="p-3 rounded-xl flex items-start gap-3 transition-all hover:translate-x-0.5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${typeConfig.color}12` }}>
                  <Icon className="w-4 h-4" style={{ color: typeConfig.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>
                      {item.title || item.headline || item.indicator_name || 'Signal'}
                    </span>
                    {item.sentiment && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sentimentColor }} />
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>
                    {item.summary || item.description || item.content || item.impact_narrative || ''}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {item.source_name && (
                      <span className="text-[10px]" style={{ color: '#708499', fontFamily: fontFamily.mono }}>
                        {item.source_name}
                      </span>
                    )}
                    {item.severity && (
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded"
                        style={{ background: item.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)', color: item.severity === 'critical' ? '#EF4444' : '#708499', fontFamily: fontFamily.mono }}>
                        {item.severity}
                      </span>
                    )}
                  </div>
                </div>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 hover:bg-white/5"
                    onClick={e => e.stopPropagation()}>
                    <ExternalLink className="w-3 h-3" style={{ color: '#708499' }} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExternalIntelFeed;
