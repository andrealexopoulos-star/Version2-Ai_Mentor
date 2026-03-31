import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Lightbulb, Database, CheckCircle2, XCircle, Paperclip, Download, FileText } from 'lucide-react';
import { apiClient, callEdgeFunction } from '../lib/api';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { fontFamily } from '../design-system/tokens';

// Detect if a message is a data query (needs integration data)
const DATA_QUERY_PATTERNS = [
  /^show me (my )?(pipeline|deals|invoices|revenue|leads|contacts|spend)/i,
  /^what (is|was|are) (my |our )?(total |current )?(pipeline|revenue|spend|overdue|outstanding)/i,
  /^how much (did|have|has|do)/i,
  /^how many (deals|leads|contacts|invoices|clients)/i,
  /^(list|give me|pull up) (my |our )?(deals|invoices|pipeline|leads|contacts)/i,
];

const getSoundboardErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const reply = error?.response?.data?.reply;
  if (typeof reply === 'string' && reply.trim()) return reply;
  return "I'm having trouble connecting. Try again in a moment.";
};
function isDataQuery(msg) {
  const lower = msg.trim().toLowerCase();
  return DATA_QUERY_PATTERNS.some(pattern => pattern.test(lower));
}

// Detect if a message is a BNA update request
const BNA_PATTERNS = [
  /(?:update|change|set|modify)\s+(?:my|our|the)\s+(.+?)\s+(?:to|as|=)\s+(.+)/i,
  /(?:my|our)\s+(.+?)\s+(?:is|should be|has changed to)\s+(.+)/i,
];
function detectBnaUpdate(msg) {
  for (const pattern of BNA_PATTERNS) {
    const match = msg.match(pattern);
    if (match) return { field: match[1].trim(), value: match[2].trim() };
  }
  return null;
}

// Map natural language field names to business_profiles columns
const FIELD_MAP = {
  'business name': 'business_name', 'company name': 'business_name', 'name': 'business_name',
  'industry': 'industry', 'sector': 'industry',
  'target market': 'target_market', 'target audience': 'target_market', 'customers': 'target_market',
  'location': 'location', 'address': 'location', 'city': 'location',
  'team size': 'team_size', 'employees': 'team_size',
  'growth strategy': 'growth_strategy', 'strategy': 'growth_strategy',
  'challenges': 'main_challenges', 'main challenges': 'main_challenges', 'problems': 'main_challenges',
  'goals': 'short_term_goals', 'short term goals': 'short_term_goals',
  'long term goals': 'long_term_goals', 'vision': 'vision_statement',
  'mission': 'mission_statement', 'mission statement': 'mission_statement',
  'products': 'main_products_services', 'services': 'main_products_services',
  'value proposition': 'unique_value_proposition', 'uvp': 'unique_value_proposition',
  'pricing': 'pricing_model', 'pricing model': 'pricing_model',
  'business model': 'business_model', 'model': 'business_model',
};

function resolveField(naturalName) {
  const lower = naturalName.toLowerCase().trim();
  return FIELD_MAP[lower] || null;
}

const FloatingSoundboard = ({ context = '', subscriptionTier = 'free', integrationState = {} }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [pendingBnaUpdate, setPendingBnaUpdate] = useState(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const onboardingSent = useRef(false);

  const { session } = useSupabaseAuth();

  const fileRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null); // { name, content, size }

  // Read file as text
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset for re-select

    const MAX_SIZE = 500 * 1024; // 500KB text limit
    const textTypes = ['text/plain', 'text/csv', 'text/markdown', 'application/json', 'text/html'];
    const isText = textTypes.includes(file.type) || file.name.match(/\.(txt|csv|md|json|log|xml|html|py|js|ts|sql)$/i);

    if (isText && file.size < MAX_SIZE) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedFile({ name: file.name, content: ev.target.result, size: file.size, type: 'text' });
      };
      reader.readAsText(file);
    } else if (file.type.startsWith('image/') && file.size < 5 * 1024 * 1024) {
      // Image files — attach as a note for now (full vision support requires API)
      setAttachedFile({ name: file.name, content: null, size: file.size, type: 'image', hint: 'Image attached — describe what you want analysed.' });
    } else if (file.size > MAX_SIZE) {
      setMessages(prev => [...prev, { role: 'assistant', text: `File too large (max 500KB for text). Try pasting the content directly instead.` }]);
    } else {
      // PDF/docx etc — instruct user
      setAttachedFile({ name: file.name, content: null, size: file.size, type: 'binary', hint: 'Binary file attached — paste key sections as text for best analysis.' });
    }
  };

  const removeAttachment = () => setAttachedFile(null);

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setViewportHeight(`${vv.height}px`);
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    apiClient.get('/integrations/channels/status').then(res => {
      if (res.data?.channels) setIntegrationStatus(res.data.channels);
    }).catch(() => {});
  }, []);

  // Integration onboarding message on first Market page open
  useEffect(() => {
    if (!open || onboardingSent.current || messages.length > 0) return;
    if (!context.toLowerCase().includes('market')) return;
    onboardingSent.current = true;

    const channels = integrationStatus || [];
    const crmCh = channels.find(c => c.key === 'crm');
    const emailCh = channels.find(c => c.key === 'email' || c.key === 'email_platform');
    const crmStatus = crmCh?.status === 'connected' ? 'Connected' : 'Not connected';
    const emailStatus = emailCh?.status === 'connected' ? 'Connected' : 'Not connected';

    setMessages([
      { role: 'assistant', text: "I'm currently using public digital signals only." },
      { role: 'assistant', text: "To answer questions like 'Google spend last year' or 'leads this quarter', connect your systems:\n\n" +
        `CRM (HubSpot) \u2014 ${crmStatus}\n` +
        `Email \u2014 ${emailStatus}\n` +
        `Google Ads \u2014 Not connected\n` +
        `Meta Ads \u2014 Not connected\n` +
        `Analytics (GA4) \u2014 Not connected\n` +
        `Calendar \u2014 Not connected\n\n` +
        "Connect integrations from the Systems menu to unlock deeper insights." },
    ]);
  }, [open, integrationStatus, context, messages.length]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Route data queries to Edge Function
  const queryIntegrationData = async (query) => {
    try {
      if (!session?.access_token) return null;
      return await callEdgeFunction('query-integrations-data', { query }, 30000);
    } catch (e) {
      console.warn('[soundboard] Integration query failed:', e);
    }
    return null;
  };

  // Handle BNA update confirmation
  const confirmBnaUpdate = async () => {
    if (!pendingBnaUpdate) return;
    setLoading(true);
    try {
      await apiClient.put('/business-profile', { [pendingBnaUpdate.dbField]: pendingBnaUpdate.value });
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Updated ${pendingBnaUpdate.field} to "${pendingBnaUpdate.value}". Your cognitive snapshot will refresh with this change.`,
      }]);
      // Trigger snapshot refresh
      if (session?.access_token) {
        callEdgeFunction('biqc-insights-cognitive', { refresh: true }, 45000).catch(() => {});
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Failed to update. Please try again.' }]);
    }
    setPendingBnaUpdate(null);
    setLoading(false);
  };

  const cancelBnaUpdate = () => {
    setMessages(prev => [...prev, { role: 'assistant', text: 'Update cancelled.' }]);
    setPendingBnaUpdate(null);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || loading) return;
    const userMsg = input.trim();
    setInput('');

    // Build message with optional file context
    let fullMessage = userMsg;
    let displayText = userMsg;
    if (attachedFile) {
      if (attachedFile.type === 'text' && attachedFile.content) {
        const preview = attachedFile.content.slice(0, 3000);
        const truncated = attachedFile.content.length > 3000;
        fullMessage = `${userMsg ? userMsg + '\n\n' : ''}Attached file: ${attachedFile.name}\n\nContent:\n${preview}${truncated ? '\n\n[...truncated to 3000 chars]' : ''}`;
        displayText = userMsg || `Analysing: ${attachedFile.name}`;
      } else {
        fullMessage = `${userMsg ? userMsg + '\n\n' : ''}File attached: ${attachedFile.name} (${attachedFile.hint || 'describe what you need'})`;
        displayText = userMsg || `Attached: ${attachedFile.name}`;
      }
      setAttachedFile(null);
    }

    if (!fullMessage.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: displayText }]);
    setLoading(true);

    try {
      // Check for BNA update intent
      const bnaUpdate = detectBnaUpdate(fullMessage);
      if (bnaUpdate) {
        const dbField = resolveField(bnaUpdate.field);
        if (dbField) {
          setPendingBnaUpdate({ field: bnaUpdate.field, value: bnaUpdate.value, dbField });
          setMessages(prev => [...prev, {
            role: 'assistant',
            text: `Update your ${bnaUpdate.field} to "${bnaUpdate.value}"?`,
            type: 'bna_confirm',
          }]);
          setLoading(false);
          return;
        }
      }

      // Check if it's a data query — route to Edge Function
      if (isDataQuery(fullMessage)) {
        const result = await queryIntegrationData(fullMessage);
        if (result) {
          if (result.status === 'not_connected') {
            setMessages(prev => [...prev, { role: 'assistant', text: result.message, type: 'integration_prompt' }]);
          } else if (result.status === 'answered') {
            setMessages(prev => [...prev, {
              role: 'assistant',
              text: result.answer,
              sources: result.data_sources,
            }]);
          } else {
            // Fallback to regular chat
            await sendToChat(fullMessage);
          }
          setLoading(false);
          return;
        }
      }

      // Regular chat
      await sendToChat(fullMessage);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', text: getSoundboardErrorMessage(error) }]);
    } finally {
      setLoading(false);
    }
  };

  const sendToChat = async (userMsg) => {
    const res = await apiClient.post('/soundboard/chat', {
      message: userMsg,
      intelligence_context: { context },
    });
    if (res.data?.reply) {
      const msg = { role: 'assistant', text: res.data.reply };
      // If backend generated a file, attach download info
      if (res.data?.file) {
        msg.file = res.data.file;
      }
      setMessages(prev => [...prev, msg]);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #FF6A00, #FF6A00)', boxShadow: '0 8px 32px rgba(255,106,0,0.4)' }}
        data-testid="soundboard-fab"
      >
        <Lightbulb className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[1200] lg:hidden" onClick={() => setOpen(false)} />
      <div
        className="fixed z-[1201] lg:bottom-6 lg:right-6 lg:w-[380px] lg:rounded-2xl inset-0 lg:inset-auto flex flex-col shadow-2xl overflow-hidden"
        style={{ background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', height: window.innerWidth < 1024 ? viewportHeight : 'auto' }}
        data-testid="soundboard-panel"
      >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FF6A0020' }}>
            <Lightbulb className="w-4 h-4 text-[#FF6A00]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>SoundBoard</h3>
            <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Brainstorm on your data</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-[#64748B]" data-testid="soundboard-close">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Lightbulb className="w-8 h-8 mx-auto mb-3 text-[#FF6A00]/30" />
            <p className="text-sm text-[#64748B]" style={{ fontFamily: fontFamily.body }}>Ask a question about your data or brainstorm ideas.</p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {['What should I focus on?', 'Show me my pipeline', 'How can I grow revenue?'].map(q => (
                <button key={q} onClick={() => { setInput(q); }} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ background: 'var(--biqc-bg-card)', color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)', fontFamily: fontFamily.mono }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed`}
              style={{
                background: msg.role === 'user' ? '#FF6A00' : msg.type === 'integration_prompt' ? '#F59E0B10' : '#141C26',
                color: msg.role === 'user' ? 'white' : '#9FB0C3',
                border: msg.role === 'user' ? 'none' : msg.type === 'integration_prompt' ? '1px solid #F59E0B25' : '1px solid #243140',
                fontFamily: fontFamily.body,
                whiteSpace: 'pre-line',
              }}>
              {msg.type === 'integration_prompt' && <Database className="w-3.5 h-3.5 text-[#F59E0B] inline mr-1.5 -mt-0.5" />}
              {msg.text}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {msg.sources.map((s, j) => (
                    <span key={j} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#10B98110', color: '#10B981', fontFamily: fontFamily.mono }}>{s}</span>
                  ))}
                </div>
              )}
              {/* File download card — when backend generates a file */}
              {msg.file && (
                <a href={msg.file.download_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg hover:brightness-110 transition-all"
                  style={{ background: '#FF6A0015', border: '1px solid #FF6A0030', textDecoration: 'none' }}>
                  <Download className="w-3.5 h-3.5 text-[#FF6A00] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>{msg.file.name}</p>
                    <p className="text-[9px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{msg.file.type} · {Math.round((msg.file.size || 0) / 1024)}KB</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        ))}

        {/* BNA Update Confirmation */}
        {pendingBnaUpdate && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl" style={{ background: '#3B82F610', border: '1px solid #3B82F625' }}>
              <p className="text-sm text-[#9FB0C3] mb-2" style={{ fontFamily: fontFamily.body }}>
                Update <strong className="text-[#F4F7FA]">{pendingBnaUpdate.field}</strong> to <strong className="text-[#F4F7FA]">"{pendingBnaUpdate.value}"</strong>?
              </p>
              <div className="flex gap-2">
                <button onClick={confirmBnaUpdate} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                  style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130' }} data-testid="bna-confirm">
                  <CheckCircle2 className="w-3 h-3" /> Confirm
                </button>
                <button onClick={cancelBnaUpdate} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                  style={{ background: '#EF444415', color: '#EF4444', border: '1px solid #EF444430' }} data-testid="bna-cancel">
                  <XCircle className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-xl text-sm" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: '#FF6A00', fontFamily: fontFamily.mono }}>
              thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid var(--biqc-border)' }}>
        {/* File attachment preview */}
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #FF6A0030' }}>
            <FileText className="w-3.5 h-3.5 text-[#FF6A00] shrink-0" />
            <span className="flex-1 text-[11px] truncate" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}>{attachedFile.name}</span>
            {attachedFile.type === 'text' && <span className="text-[9px]" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>ready</span>}
            {attachedFile.hint && <span className="text-[9px] max-w-[100px] truncate" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>{attachedFile.hint}</span>}
            <button onClick={removeAttachment} className="p-0.5 rounded hover:bg-white/10" style={{ color: '#64748B' }}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          {/* Hidden file input */}
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect}
            accept=".txt,.csv,.md,.json,.log,.xml,.html,.py,.js,.ts,.sql,.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif" />
          {/* Paperclip button */}
          <button onClick={() => fileRef.current?.click()}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all hover:brightness-110"
            style={{ background: attachedFile ? '#FF6A0020' : '#141C26', border: `1px solid ${attachedFile ? '#FF6A0040' : '#243140'}` }}
            data-testid="soundboard-attach" title="Attach file">
            <Paperclip className="w-4 h-4" style={{ color: attachedFile ? '#FF6A00' : '#64748B' }} />
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : "Ask anything about your business..."}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.body }}
            data-testid="soundboard-input"
          />
          <button onClick={sendMessage} disabled={(!input.trim() && !attachedFile) || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
            style={{ background: '#FF6A00' }}
            data-testid="soundboard-send">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      </div>
    </>
  );
};

export default FloatingSoundboard;
