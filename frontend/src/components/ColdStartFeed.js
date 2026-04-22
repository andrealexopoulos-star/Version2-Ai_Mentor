/**
 * ColdStartFeed
 * -------------
 * Sprint B #14 (2026-04-22): Renders a list of generic SMB/industry signals
 * when a fresh user has no watchtower events AND no integrations connected.
 *
 * Reuses the same visual pattern as the Advisor signal feed rows
 * (`biqc-diagram-*` tokens, no new surface). The component fetches its
 * own data from `/intelligence/industry-signals` so Advisor.js does not
 * need another useEffect.
 */
import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { Activity, AlertTriangle } from 'lucide-react';

const ColdStartFeed = ({ limit = 5 }) => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchSignals = async () => {
      try {
        const res = await apiClient.get(`/intelligence/industry-signals?limit=${limit}`, {
          signal: controller.signal,
          timeout: 10000,
        });
        if (!controller.signal.aborted) {
          setSignals(res?.data?.signals || []);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('ColdStartFeed fetch failed:', err);
          setError('Unable to load industry signals');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchSignals();
    return () => controller.abort();
  }, [limit]);

  if (loading) {
    return (
      <div className="p-10 text-center" data-testid="cold-start-loading">
        <Activity className="w-6 h-6 mx-auto mb-3 animate-pulse" style={{ color: 'var(--ink-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Loading industry signals…</p>
      </div>
    );
  }

  if (error || signals.length === 0) {
    return (
      <div className="p-10 text-center" data-testid="cold-start-empty">
        <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-muted)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>
          No signals yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
          Connect your inbox and CRM to start surfacing business intelligence.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-testid="cold-start-feed">
      <div className="px-6 pt-4 pb-2 text-[10px] uppercase" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)' }}>
        Industry briefing · while you connect your tools
      </div>
      {signals.map((s, i) => (
        <div
          key={s.id || i}
          className="grid transition-colors"
          style={{
            gridTemplateColumns: '44px 1fr auto',
            gap: 'var(--sp-4)',
            padding: 'var(--sp-5) var(--sp-6)',
            borderBottom: i < signals.length - 1 ? '1px solid var(--border)' : 'none',
            alignItems: 'flex-start',
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--r-md)',
              background: 'var(--info-wash)',
              color: 'var(--info)',
            }}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div
              className="flex items-center gap-2 text-[10px] uppercase mb-1"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)' }}
            >
              INDUSTRY
              <span className="w-[3px] h-[3px] rounded-full" style={{ background: 'var(--ink-muted)' }} />
              {s.source || 'Benchmark'}
            </div>
            <div
              style={{
                fontSize: 'var(--size-body)',
                fontWeight: 'var(--fw-semi)',
                color: 'var(--ink-display)',
                lineHeight: 1.3,
              }}
            >
              {s.title}
            </div>
            {s.description && (
              <div className="mt-1 leading-relaxed" style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
                {s.description}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-muted)' }}>
            {s.published_at ? new Date(s.published_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }) : ''}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ColdStartFeed;
