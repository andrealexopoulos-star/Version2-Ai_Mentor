import React, { useState, useRef, useEffect } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useSnapshot } from '../hooks/useSnapshot';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { apiClient } from '../lib/api';
import { Send, RefreshCw } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import InsightExplainabilityStrip from './InsightExplainabilityStrip';

const STATE_CFG = {
  STABLE:      { label: 'Stable', color: '#166534', bg: '#F0FDF4', border: '#BBF7D0', dot: '#10B981' },
  DRIFT:       { label: 'Drift', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  COMPRESSION: { label: 'Compression', color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA', dot: '#FF6A00' },
  CRITICAL:    { label: 'Critical', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' },
};

const summariseWarRoomAnalysis = (analysis) => {
  if (!analysis || typeof analysis !== 'object') return '';

  const title = analysis.analysis_title || '';
  const customerInsight = analysis.customer_insight || '';
  const opportunity = analysis.revenue_opportunity || '';
  const recommendations = Array.isArray(analysis.recommendations)
    ? analysis.recommendations.filter(Boolean).slice(0, 3)
    : [];
  const risks = Array.isArray(analysis.risks_to_watch)
    ? analysis.risks_to_watch.filter(Boolean).slice(0, 2)
    : [];

  const parts = [];
  if (title) parts.push(title);
  if (customerInsight) parts.push(`Situation: ${customerInsight}`);
  if (opportunity) parts.push(`Opportunity: ${opportunity}`);
  if (recommendations.length) {
    parts.push('Recommended actions:');
    recommendations.forEach((item) => parts.push(`- ${item}`));
  }
  if (risks.length) {
    parts.push('Risks to watch:');
    risks.forEach((item) => parts.push(`- ${item}`));
  }

  return parts.join('\n').trim();
};

const getWarRoomReplyText = (data) => {
  if (!data || typeof data !== 'object') return 'Unable to process.';
  return data.answer || data.response || data.error || summariseWarRoomAnalysis(data.analysis) || 'Unable to process.';
};

const WarRoomConsole = ({ embeddedShell = false }) => {
  const { cognitive, sources, owner, timeOfDay, loading, error, cacheAge, refreshing, refresh } = useSnapshot();
  const { status: integrationStatus } = useIntegrationStatus();
  const { user } = useSupabaseAuth();
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [conversation, setConversation] = useState([]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Resolve display name: snapshot owner → user metadata → email prefix → capitalize
  const rawName = owner ||
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';
  const displayName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : 'there';

  const displayTimeOfDay = timeOfDay || (() => {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  })();

  const askQuestion = async () => {
    if (!question.trim() || asking) return;
    var q = question.trim();
    setQuestion('');
    setConversation(function(prev) { return prev.concat([{ role: 'user', text: q }]); });
    setAsking(true);
    try {
      const inferredProductOrService =
        c?.product_or_service ||
        c?.business_model ||
        c?.market_position ||
        'General business advisory';

      var res = await apiClient.post('/war-room/respond', {
        question: q,
        product_or_service: String(inferredProductOrService).slice(0, 200),
      }, {
        timeout: 60000,
      });
      var data = res.data;
      setConversation(function(prev) {
        return prev.concat([{
          role: 'advisor',
          text: getWarRoomReplyText(data),
          sources: data.data_sources,
          degraded: Boolean(data.degraded),
          explainability: {
            whyVisible: data.why_visible,
            whyNow: data.why_now,
            nextAction: data.next_action,
            ifIgnored: data.if_ignored,
          },
          evidenceChain: data.evidence_chain,
        }]);
      });
    } catch (e) {
      var detail = e?.response?.data?.detail || 'Connection issue. Please try again.';
      setConversation(function(prev) { return prev.concat([{ role: 'advisor', text: detail }]); });
    } finally { setAsking(false); setTimeout(function() { if (inputRef.current) inputRef.current.focus(); }, 100); }
  };

  useEffect(function() { if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [conversation, asking]);

  var c = cognitive || {};
  var st = STATE_CFG[c.system_state] || STATE_CFG.STABLE;
  const topAlerts = (c.top_alerts || []).slice(0, 3);
  const connectedSystems = Object.entries(c.integrations || {
    crm: integrationStatus?.canonical_truth?.crm_connected,
    accounting: integrationStatus?.canonical_truth?.accounting_connected,
    email: integrationStatus?.canonical_truth?.email_connected,
  }).filter(([, connected]) => connected).map(([key]) => key);
  const explainability = {
    whyVisible: connectedSystems.length
      ? `War Room is grounded in ${connectedSystems.join(', ')} live systems and your latest strategic snapshot.`
      : 'War Room is ready, but stronger answers require connected CRM/accounting/email evidence.',
    whyNow: topAlerts.length
      ? topAlerts[0].detail
      : 'Strategic state can shift quickly; this console helps interrogate emerging pressure early.',
    nextAction: topAlerts[0]?.action || 'Ask one high-stakes question and commit to a decision owner + deadline.',
    ifIgnored: 'Unchallenged strategic drift can compress decision windows and increase execution cost over time.',
  };
  const warRoomBrief = topAlerts[0]?.detail
    ? `${topAlerts[0].detail}${topAlerts[0]?.action ? ` Next move: ${topAlerts[0].action}` : ''}`
    : connectedSystems.length
      ? `BIQc can see ${connectedSystems.join(', ')} signals, but the live strategic synthesis is still being prepared. Use this console to interrogate the highest-priority issue now.`
      : 'Connect core systems to generate a live strategic brief.';

  return (
    <div className={`flex flex-col h-full ${embeddedShell ? 'min-h-full' : 'min-h-screen'}`} style={{ background: 'var(--biqc-bg, #070E18)', fontFamily: fontFamily.display }}>
      <header className="flex items-center justify-between px-6 md:px-10 py-3.5 shrink-0"
        style={{ background: 'rgba(10,16,24,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--biqc-border, #1E2D3D)' }}>
        <div className="flex items-center gap-5">
          <a href="/advisor" className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/5" style={{ color: '#64748B', textDecoration: 'none' }} data-testid="console-home-btn">← Intelligence Platform</a>
          <div className="h-4 w-px" style={{ background: '#1E2D3D' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>Strategic Console</span>
          {!loading && cognitive && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: st.bg, border: '1px solid ' + st.border }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
              <span className="text-[10px] font-semibold tracking-wide" style={{ color: st.color, fontFamily: fontFamily.mono }}>{st.label}</span>
            </div>
          )}
        </div>
        <button onClick={refresh} disabled={refreshing || loading} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/5" style={{ color: '#64748B' }} data-testid="refresh-btn">
          <RefreshCw className="w-3.5 h-3.5" />
          {cacheAge !== null && cacheAge > 0 ? cacheAge + 'm ago' : 'Refresh'}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-8 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="text-xs" style={{ color: "#FF6A00", fontFamily: "monospace" }}>analyzing...</span>
              <p className="text-sm font-medium mt-2" style={{ color: '#9FB0C3' }}>Loading strategic brief...</p>
            </div>
          )}
          {error && !loading && (
            <div className="p-6 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
              <p className="text-sm" style={{ color: '#F59E0B' }}>{error}</p>
            </div>
          )}
          {!cognitive && !loading && !error && (
            <div className="p-7 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
              <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Executive Brief</span>
              <p className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>
                {connectedSystems.length
                  ? `BIQc can see ${connectedSystems.join(', ')} systems, but the strategic synthesis has not resolved yet. Refresh or ask a direct question to force a live read.`
                  : 'Connect core systems to generate a live strategic brief.'}
              </p>
            </div>
          )}
          {cognitive && !loading && (
            <>
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>Good {displayTimeOfDay}, {displayName}.</h1>
              {c.system_state_interpretation && <p className="text-sm" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>{c.system_state_interpretation}</p>}
              {c.executive_memo && (
                <div className="p-7 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Executive Brief</span>
                  <p className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>{c.executive_memo}</p>
                </div>
              )}
              {!c.executive_memo && (
                <div className="p-7 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Executive Brief</span>
                  <p className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>
                    {warRoomBrief}
                  </p>
                </div>
              )}
              {topAlerts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                    <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Why this matters now</span>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>{topAlerts[0].detail}</p>
                  </div>
                  <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                    <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>What to do next</span>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>{topAlerts[0].action || 'Use this console to test the next action before risk spreads.'}</p>
                  </div>
                  <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                    <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Evidence footprint</span>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>{`${c.live_signal_count || topAlerts.length} live signals across ${connectedSystems.length} connected systems${connectedSystems.length ? ` (${connectedSystems.join(', ')})` : ''}.`}</p>
                  </div>
                </div>
              )}
              {c.market_position && (
                <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Market Context</span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>{c.market_position}</p>
                </div>
              )}

              <InsightExplainabilityStrip
                whyVisible={explainability.whyVisible}
                whyNow={explainability.whyNow}
                nextAction={explainability.nextAction}
                ifIgnored={explainability.ifIgnored}
                testIdPrefix="war-room-explainability"
              />

              {sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Sources:</span>
                  {sources.map(function(s, i) { return <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#9FB0C3', background: 'rgba(255,255,255,0.06)', fontFamily: fontFamily.mono }}>{s}</span>; })}
                </div>
              )}
            </>
          )}
          {conversation.length > 0 && (
            <div className="space-y-4 pt-4" style={{ borderTop: '1px solid var(--biqc-border, #1E2D3D)' }}>
              {conversation.map(function(msg, i) { return (
                <div key={i} className={'flex ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className="max-w-[85%] p-4 rounded-2xl"
                    data-testid={`war-room-message-${msg.role}-${i}`}
                    style={msg.role === 'user'
                      ? { background: 'rgba(255,106,0,0.12)', color: '#F4F7FA', border: '1px solid rgba(255,106,0,0.2)' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--biqc-border,#1E2D3D)', color: 'var(--biqc-text,#F4F7FA)' }}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                    {msg.role === 'advisor' && msg.degraded && (
                      <div className="mt-3 inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)', fontFamily: fontFamily.mono }}
                        data-testid={`war-room-degraded-badge-${i}`}
                      >
                        Resilience mode
                      </div>
                    )}
                    {msg.role === 'advisor' && msg.explainability?.whyVisible && (
                      <InsightExplainabilityStrip
                        whyVisible={msg.explainability.whyVisible}
                        whyNow={msg.explainability.whyNow || 'Signal pressure elevated from monitored telemetry.'}
                        nextAction={msg.explainability.nextAction || 'Assign one owner and execute the next action this cycle.'}
                        ifIgnored={msg.explainability.ifIgnored || 'Delays can compound strategic and execution risk.'}
                        testIdPrefix={`war-room-reply-explainability-${i}`}
                        className="mt-3"
                      />
                    )}
                    {msg.role === 'advisor' && msg.evidenceChain?.length > 0 && (
                      <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border,#1E2D3D)' }} data-testid={`war-room-evidence-chain-${i}`}>
                        <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Evidence chain</span>
                        <div className="space-y-1">
                          {msg.evidenceChain.slice(0, 4).map(function(ev, idx) {
                            return (
                              <div key={idx} className="text-[11px]" style={{ color: 'var(--biqc-text-2,#9FB0C3)' }}>
                                {(ev.domain || 'domain').toUpperCase()} · {(ev.event_type || 'event')} · {(ev.severity || 'info')} · {(ev.source || 'source')}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ); })}
              {asking && (<div className="flex justify-start"><div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--biqc-border,#1E2D3D)' }}><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full animate-pulse" style={{background:'#FF6A00'}} /><div className="w-2 h-2 rounded-full animate-pulse" style={{background:'#FF6A00',animationDelay:'0.2s'}} /><div className="w-2 h-2 rounded-full animate-pulse" style={{background:'#FF6A00',animationDelay:'0.4s'}} /></div></div></div>)}
              <div ref={scrollRef} />
            </div>
          )}
        </div>
      </div>
      {!loading && cognitive && (
        <div className="shrink-0 px-6 md:px-10 py-4" style={{ background: 'rgba(10,16,24,0.85)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--biqc-border, #1E2D3D)' }}>
          <form onSubmit={function(e) { e.preventDefault(); askQuestion(); }} className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--biqc-bg-card, #141C26)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
              <input ref={inputRef} type="text" value={question} onChange={function(e) { setQuestion(e.target.value); }} placeholder="Ask about your business..." disabled={asking} className="flex-1 text-sm outline-none bg-transparent" style={{ color: 'var(--biqc-text, #F4F7FA)', fontFamily: fontFamily.display }} data-testid="ask-input" />
              <button type="submit" disabled={asking || !question.trim()} className="p-2 rounded-lg transition-colors" style={{ color: question.trim() ? '#FF6A00' : '#4A5568' }} data-testid="ask-submit"><Send className="w-4 h-4" /></button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default WarRoomConsole;
