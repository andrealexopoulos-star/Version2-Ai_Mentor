import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import { useMobileDrawer } from '../context/MobileDrawerContext';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import VoiceChat from '../components/VoiceChat';
import { fontFamily } from "../design-system/tokens";
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import {
  MessageSquare, Send, Plus, Trash2, Edit2, Check, X,
  Loader2, ChevronLeft, ChevronRight, MoreVertical, Video, Phone,
  Paperclip, FileText, Download, Zap, Eye, Clock
} from 'lucide-react';

const getSoundboardErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const reply = error?.response?.data?.reply;
  if (typeof reply === 'string' && reply.trim()) return reply;
  return 'Failed to send message';
};


const MySoundBoard = () => {
  const { user } = useSupabaseAuth();
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const { isChatOpen, openChat, closeAll, activeDrawer } = useMobileDrawer();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(() => {
    // Check if user arrived from a proactive insight bubble
    const prefill = sessionStorage.getItem('biqc_soundboard_prefill');
    if (prefill) { sessionStorage.removeItem('biqc_soundboard_prefill'); return prefill; }
    return '';
  });
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [scanUsage, setScanUsage] = useState(null);
  const [recordingScans, setRecordingScans] = useState({});
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [selectedMode, setSelectedMode] = useState('auto');

  // BIQc AI Modes — branded like Gemini's Fast/Thinking/Pro
  const BIQC_MODES = [
    { id: 'auto',     label: 'BIQc Auto',     desc: 'Automatically selects the best AI for your query', icon: '⚡', backend_mode: 'auto',     minTier: 'free' },
    { id: 'fast',     label: 'Fast',           desc: 'Quick answers using Gemini 3 Flash',               icon: '🚀', backend_mode: 'fast',     minTier: 'free' },
    { id: 'thinking', label: 'Pro Thinking',   desc: 'Deep reasoning with gpt-5.4 — solves complex problems', icon: '🧠', backend_mode: 'thinking', minTier: 'foundation' },
    { id: 'pro',      label: 'Pro',            desc: 'Advanced analysis with Gemini 3.1 Pro (1M context)', icon: '✦', backend_mode: 'pro',      minTier: 'foundation' },
    { id: 'trinity',  label: 'Trinity',        desc: 'ChatGPT 5.4 + Claude + Gemini in parallel — most powerful', icon: '◈', backend_mode: 'trinity',  minTier: 'foundation' },
  ];

  // Filter modes by user's subscription tier
  const userTier = (user?.subscription_tier || 'free');
  const tierOrder = ['free', 'foundation', 'growth', 'custom'];
  const userTierIdx = tierOrder.indexOf(userTier);
  const isAndre = user?.email === 'andre@thestrategysquad.com.au';
  const availableModes = BIQC_MODES.filter(m => {
    if (isAndre) return true; // Andre has all modes
    const minIdx = tierOrder.indexOf(m.minTier);
    return userTierIdx >= minIdx;
  });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);

  const fetchScanUsage = useCallback(async (forceRefresh = false) => {
    try {
      const CACHE_KEY = 'biqc_scan_usage_cache';
      const CACHE_TTL = 5 * 60 * 1000;
      if (!forceRefresh) {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) { setScanUsage(data); return; }
        }
      }
      const res = await apiClient.get('/soundboard/scan-usage');
      setScanUsage(res.data);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: res.data, ts: Date.now() }));
    } catch {
      setScanUsage({ calibration_complete: false, is_paid: false, exposure_scan: { can_run: true, days_until_next: 0 }, forensic_calibration: { can_run: true, days_until_next: 0 } });
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchScanUsage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Only scroll if there are messages (not on initial load)
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await apiClient.get('/soundboard/conversations');
      const convs = response.data.conversations || [];
      setConversations(convs);
      // Welcome message: show if user has NO prior conversations (server-side truth)
      if (convs.length === 0 && messages.length === 0) {
        setMessages([{ role: 'assistant', content: `${firstName}, I'm your Strategic Intelligence Advisor. I've already analysed your business profile and live signals.\n\nI'll be direct — when your data shows something, I'll tell you exactly what it means and what to do about it. No generic advice, no hedging.\n\nWhat do you need to know right now?` }]);
      }
    } catch (error) {
      console.error('Failed to fetch conversations');
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/soundboard/conversations/${conversationId}`);
      setActiveConversation(conversationId);
      setMessages(response.data.messages || []);
    } catch (error) {
      toast.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || loading) return;

    const userMessage = input.trim();
    setInput('');

    // Build full message including file content
    let fullMessage = userMessage;
    let displayContent = userMessage;
    if (attachedFile) {
      if (attachedFile.type === 'text' && attachedFile.content) {
        const preview = attachedFile.content.slice(0, 3000);
        const truncated = attachedFile.content.length > 3000;
        fullMessage = `${userMessage ? userMessage + '\n\n' : ''}Attached file: ${attachedFile.name}\n\nContent:\n${preview}${truncated ? '\n\n[...truncated]' : ''}`;
        displayContent = userMessage || `Analysing: ${attachedFile.name}`;
      } else {
        fullMessage = `${userMessage ? userMessage + '\n\n' : ''}File attached: ${attachedFile.name} (${attachedFile.hint || 'describe what you need'})`;
        displayContent = userMessage || `Attached: ${attachedFile.name}`;
      }
      setAttachedFile(null);
    }

    if (!fullMessage.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: displayContent }]);
    setLoading(true);

    try {
      const currentMode = BIQC_MODES.find(m => m.id === selectedMode);

      let reply, conversation_id, conversation_title, generatedFile, suggested_actions, intent, model_used;

      if (selectedMode === 'trinity') {
        // Trinity mode: call Supabase edge function (GPT + Claude + Gemini parallel)
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        const triRes = await fetch(`${supabaseUrl}/functions/v1/biqc-trinity`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session?.access_token}`, 'apikey': anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: fullMessage }),
        });
        const triData = await triRes.json();
        reply = triData.reply || triData.error || 'Trinity mode unavailable';
        model_used = 'trinity';
        suggested_actions = [];
        conversation_id = activeConversation;
        conversation_title = null;
      } else {
        // Standard mode — pass mode to backend for routing
        const response = await apiClient.post('/soundboard/chat', {
          message: fullMessage,
          conversation_id: activeConversation,
          intelligence_context: {},
          mode: currentMode?.backend_mode || 'auto',
        });
        ({ reply, conversation_id, conversation_title, file: generatedFile, suggested_actions, intent, model_used } = response.data);
      }

      const assistantMsg = { role: 'assistant', content: reply, suggested_actions: suggested_actions || [], intent, model_used };
      if (generatedFile) assistantMsg.file = generatedFile;
      setMessages(prev => [...prev, assistantMsg]);
      
      if (!activeConversation && conversation_id) {
        setActiveConversation(conversation_id);
        setConversations(prev => [{
          id: conversation_id,
          title: conversation_title || 'New Conversation',
          updated_at: new Date().toISOString()
        }, ...prev]);
      } else {
        setConversations(prev => prev.map(c => 
          c.id === conversation_id 
            ? { ...c, updated_at: new Date().toISOString() }
            : c
        ));
      }
    } catch (error) {
      toast.error(getSoundboardErrorMessage(error));
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const MAX_SIZE = 500 * 1024;
    const isText = /\.(txt|csv|md|json|log|xml|html|py|js|ts|sql)$/i.test(file.name) || file.type.startsWith('text/');
    if (isText && file.size < MAX_SIZE) {
      const reader = new FileReader();
      reader.onload = ev => setAttachedFile({ name: file.name, content: ev.target.result, size: file.size, type: 'text' });
      reader.readAsText(file);
    } else if (file.size > MAX_SIZE) {
      toast.error('File too large (max 500KB). Paste key sections instead.');
    } else {
      setAttachedFile({ name: file.name, content: null, size: file.size, type: 'binary', hint: 'Describe what you need from this file' });
    }
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;

    try {
      await apiClient.delete(`/soundboard/conversations/${conversationId}`);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (activeConversation === conversationId) {
        startNewConversation();
      }
      toast.success('Conversation deleted');
    } catch (error) {
      toast.error('Failed to delete conversation');
    }
  };

  const renameConversation = async (conversationId) => {
    if (!editingTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      await apiClient.patch(`/soundboard/conversations/${conversationId}`, {
        title: editingTitle.trim()
      });
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, title: editingTitle.trim() } : c
      ));
      setEditingId(null);
      toast.success('Renamed');
    } catch (error) {
      toast.error('Failed to rename');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="flex h-full relative">
        {/* Sidebar - Desktop: static, Mobile: overlay */}
        <div 
          className={`
            ${isChatOpen ? 'translate-x-0' : '-translate-x-full'} 
            ${activeDrawer === 'nav' ? 'lg:translate-x-0 md:hidden' : 'lg:translate-x-0'}
            fixed lg:relative 
            left-0 top-0 
            w-72 h-full 
            transition-transform duration-300 
            flex-shrink-0 border-r overflow-hidden z-50 lg:z-auto
          `}
          style={{ borderColor: 'var(--border-light)', background: 'var(--bg-secondary)' }}
        >
          <div className="w-72 h-full flex flex-col">
            {/* New Chat Button */}
            <div className="p-4">
              <Button
                onClick={startNewConversation}
                className="w-full btn-primary justify-start gap-2"
              >
                <Plus className="w-4 h-4" />
                New Conversation
              </Button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <CognitiveMesh compact />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No conversations yet
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                        activeConversation === conv.id ? 'bg-opacity-100' : 'hover:bg-opacity-50'
                      }`}
                      style={{ 
                        background: activeConversation === conv.id ? 'var(--bg-tertiary)' : 'transparent'
                      }}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      
                      {editingId === conv.id ? (
                        <div className="flex-1 flex items-center gap-1">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameConversation(conv.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 px-2 py-1 text-sm rounded"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button onClick={() => renameConversation(conv.id)} className="p-1">
                            <Check className="w-3 h-3 text-green-500" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1">
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                              {conv.title || 'New Conversation'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {formatTime(conv.updated_at)}
                            </p>
                          </div>
                          
                          <div className="hidden group-hover:flex items-center gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(conv.id);
                                setEditingTitle(conv.title || '');
                              }}
                              className="p-1 rounded hover:bg-black/10"
                            >
                              <Edit2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                            </button>
                            <button 
                              onClick={(e) => deleteConversation(conv.id, e)}
                              className="p-1 rounded hover:bg-red-100"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => isChatOpen ? closeAll() : openChat()}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-r-lg lg:block hidden"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-light)',
            borderLeft: 'none',
            left: isChatOpen ? '288px' : '0'
          }}
        >
          {isChatOpen ? (
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          )}
        </button>
        
        {/* Mobile: Backdrop overlay */}
        {isChatOpen && (
          <div 
            className="fixed inset-0 bg-black/40 lg:hidden z-40"
            onClick={closeAll}
            aria-hidden="true"
          />
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 w-full lg:w-auto overflow-hidden"
>
          {/* Header */}
          <div 
            className="px-4 md:px-6 py-2 md:py-4 border-b flex items-center justify-between gap-2"
            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}
          >
            {/* Mobile: Hamburger to open chat list */}
            <button 
              onClick={openChat}
              className="lg:hidden p-1.5 rounded-lg hover:bg-black/5"
              aria-label="Open conversations"
            >
              <MessageSquare className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                MySoundBoard
              </h1>
              <p className="text-xs md:text-sm truncate hidden md:block" style={{ color: 'var(--text-muted)' }}>
                Your thinking partner for clarity
              </p>
            </div>

            {/* Top Action Buttons — Calibration + Forensic Market Exposure */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {scanUsage && !scanUsage.calibration_complete && (
                <a href="/calibration"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                  style={{ background: '#FF6A0015', border: '1px solid #FF6A0030', color: '#FF6A00', fontFamily: fontFamily.mono }}
                  data-testid="mysb-calibration-btn">
                  <Zap className="w-3.5 h-3.5" /> Complete Calibration
                </a>
              )}
              {(() => {
                const scan = scanUsage?.exposure_scan;
                const canRun = !scanUsage || scan?.can_run;
                const daysLeft = scan?.days_until_next || 0;
                const isPaid = scanUsage?.is_paid;
                return (
                  <button
                    disabled={!canRun && !isPaid}
                    onClick={async () => {
                      if (!canRun && !isPaid) return;
                      if (!isPaid) {
                        setRecordingScans(prev => ({ ...prev, exposure_scan: true }));
                        try {
                          await apiClient.post('/soundboard/record-scan', { feature_name: 'exposure_scan' });
                          sessionStorage.removeItem('biqc_scan_usage_cache'); // Invalidate cache
                          await fetchScanUsage(true); // Force fresh fetch
                        } catch {}
                        setRecordingScans(prev => ({ ...prev, exposure_scan: false }));
                      }
                      window.location.href = '/exposure-scan';
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: canRun || isPaid ? '#3B82F615' : '#243140',
                      border: `1px solid ${canRun || isPaid ? '#3B82F630' : '#243140'}`,
                      color: canRun || isPaid ? '#3B82F6' : '#64748B',
                      fontFamily: fontFamily.mono,
                      cursor: canRun || isPaid ? 'pointer' : 'not-allowed',
                    }}
                    data-testid="mysb-exposure-scan-btn">
                    <Eye className="w-3.5 h-3.5" />
                    {recordingScans.exposure_scan ? 'Recording...' :
                      !canRun && !isPaid ? `Forensic Market Exposure (${daysLeft}d)` :
                      'Forensic Market Exposure'}
                    {!canRun && !isPaid && <Clock className="w-3 h-3 opacity-50" />}
                  </button>
                );
              })()}
            </div>
            
            {/* Voice Call Button - Icon only on mobile */}
            <button 
              onClick={() => setShowVoiceChat(true)}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-2 md:px-4 md:py-2 flex items-center gap-2 flex-shrink-0"
              aria-label="Start voice call"
            >
              <Video className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline text-sm font-medium">Start Voice Call</span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto touch-pan-y" style={{ background: 'var(--bg-primary)', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
            <div className="max-w-3xl mx-auto px-6 py-6">
              {messages.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <MessageSquare className="w-7 h-7" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Ask anything about your business
                  </p>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    or click a prompt to get started
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
                    {['What should I focus on?', 'Summarise my risks', 'Show me my pipeline', 'How can I grow revenue?'].map(q => (
                      <button key={q} onClick={() => setInput(q)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                          message.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                        }`}
                        style={{
                          background: message.role === 'user' 
                            ? 'var(--accent-primary)' 
                            : 'var(--bg-card)',
                          color: message.role === 'user' 
                            ? 'white' 
                            : 'var(--text-primary)',
                          border: message.role === 'user' 
                            ? 'none' 
                            : '1px solid var(--border-light)'
                        }}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </p>
                        {/* Proactive next-action suggestions */}
                        {message.role === 'assistant' && message.suggested_actions?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.suggested_actions.map((action, i) => (
                              <button key={i}
                                onClick={() => setInput(action.label)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 flex items-center gap-1.5"
                                style={{ background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.25)', color: '#FF6A00', fontFamily: fontFamily.mono }}>
                                <span>→</span> {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Intent badge */}
                        {message.role === 'assistant' && message.intent?.domain && message.intent.domain !== 'general' && (
                          <div className="mt-2">
                            <span className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(255,255,255,0.05)', color: '#4A5568', fontFamily: fontFamily.mono }}>
                              {message.intent.domain.toUpperCase()} · {message.model_used || 'AI'}
                            </span>
                          </div>
                        )}
                        {/* File download card when backend generates a file */}
                        {message.file && (
                          <a href={message.file.download_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg hover:brightness-110 transition-all"
                            style={{ background: '#FF6A0015', border: '1px solid #FF6A0030', textDecoration: 'none' }}>
                            <Download className="w-3.5 h-3.5 shrink-0" style={{ color: '#FF6A00' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>{message.file.name}</p>
                              <p className="text-[9px]" style={{ color: 'var(--text-muted)', fontFamily: fontFamily.mono }}>
                                {message.file.type} · {Math.round((message.file.size || 0) / 1024)}KB
                              </p>
                            </div>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {loading && (
                    <div className="flex justify-start">
                      <div 
                        className="px-4 py-3 rounded-2xl rounded-bl-md"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div 
            className="border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}
          >
            <div className="max-w-3xl mx-auto">
              {/* File attachment preview */}
              {attachedFile && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid rgba(255,106,0,0.3)' }}>
                  <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#FF6A00' }} />
                  <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)', fontFamily: fontFamily.mono }}>{attachedFile.name}</span>
                  {attachedFile.type === 'text' && <span className="text-[9px]" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>ready</span>}
                  {attachedFile.hint && <span className="text-[9px] truncate max-w-[100px]" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>{attachedFile.hint}</span>}
                  <button onClick={() => setAttachedFile(null)} className="p-0.5 rounded" style={{ color: 'var(--text-muted)' }}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {/* BIQc Mode Selector — like Gemini's Fast/Thinking/Pro */}
              <div className="flex items-center gap-2 px-1 mb-2 relative">
                <button onClick={() => setShowModeMenu(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.2)', color: '#FF6A00', fontFamily: fontFamily.mono }}
                  data-testid="soundboard-mode-selector">
                  <span>{BIQC_MODES.find(m => m.id === selectedMode)?.icon}</span>
                  <span>{BIQC_MODES.find(m => m.id === selectedMode)?.label}</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showModeMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl overflow-hidden shadow-xl z-50"
                    style={{ background: '#0F1720', border: '1px solid #1E2D3D' }}>
                {availableModes.map(mode => (
                      <button key={mode.id}
                        onClick={() => { setSelectedMode(mode.id); setShowModeMenu(false); }}
                        className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all hover:bg-white/5"
                        style={{ borderBottom: mode.id !== 'trinity' ? '1px solid #1E2D3D' : 'none' }}>
                        <span className="text-lg shrink-0">{mode.icon}</span>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: selectedMode === mode.id ? '#FF6A00' : '#F4F7FA', fontFamily: fontFamily.body }}>
                            {mode.label}
                            {selectedMode === mode.id && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,106,0,0.15)', color: '#FF6A00' }}>Active</span>}
                            {mode.minTier !== 'free' && !isAndre && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>{mode.minTier}</span>}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{mode.desc}</p>
                        </div>
                      </button>
                    ))}
                    {/* Show locked Trinity for free users */}
                    {!isAndre && userTierIdx < 1 && (
                      <a href="/upgrade"
                        className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all hover:bg-white/5 no-underline"
                        style={{ textDecoration: 'none' }}>
                        <span className="text-lg shrink-0 opacity-40">◈</span>
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: '#4A5568', fontFamily: fontFamily.body }}>
                            Trinity
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,106,0,0.1)', color: '#FF6A00' }}>Foundation+</span>
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#4A5568', fontFamily: fontFamily.body }}>Upgrade to unlock ChatGPT 5.4 + Claude + Gemini</p>
                        </div>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div 
                className="flex items-end gap-3 p-3 rounded-xl"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : "Share what's on your mind..."}
                  className="flex-1 resize-none bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text-primary)', minHeight: '24px', maxHeight: '120px' }}
                  rows={1}
                />
                {/* File attachment button */}
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect}
                  accept=".txt,.csv,.md,.json,.log,.xml,.html,.py,.js,.ts,.sql,.pdf,.doc,.docx,.png,.jpg" />
                <button onClick={() => fileRef.current?.click()}
                  className="p-2 rounded-lg transition-all hover:bg-white/5 shrink-0"
                  style={{ color: attachedFile ? '#FF6A00' : 'var(--text-muted)' }}
                  data-testid="soundboard-attach" title="Attach file">
                  <Paperclip className="w-4 h-4" />
                </button>
                <Button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !attachedFile) || loading}
                  className="btn-primary p-2"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-center mt-2 hidden md:block" style={{ color: 'var(--text-muted)' }}>
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Voice Chat Modal */}
      {showVoiceChat && (
        <VoiceChat 
          onClose={() => setShowVoiceChat(false)}
          onSwitchToText={() => setShowVoiceChat(false)}
        />
      )}
    </DashboardLayout>
  );
};

export default MySoundBoard;
