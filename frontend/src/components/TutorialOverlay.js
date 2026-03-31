import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, HelpCircle, BookOpen } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { hasAccess, resolveTier } from '../lib/tierResolver';

const STORAGE_KEY = 'biqc_tutorials_seen';
const normalizePageKey = (key) => {
  const raw = String(key || '').trim();
  if (!raw) return raw;
  if (!raw.startsWith('/')) return raw;
  const noQuery = raw.split('?')[0].split('#')[0];
  if (noQuery.length > 1 && noQuery.endsWith('/')) return noQuery.slice(0, -1);
  return noQuery;
};

// ─── Local storage helpers (fallback + cache) ───
const getLocal = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};
const setLocal = (key, val) => {
  const seen = getLocal();
  seen[normalizePageKey(key)] = val;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
};

// ─── Session-level server cache (avoids repeat API calls per session) ───
let _serverCache = null; // { completed: {}, tutorials_disabled: bool }
let _cacheLoaded = false;

const loadServerState = async () => {
  if (_cacheLoaded) return _serverCache;
  try {
    const res = await apiClient.get('/tutorials/status');
    const completedRaw = res.data?.completed || {};
    const completed = {};
    Object.entries(completedRaw).forEach(([k, v]) => {
      completed[normalizePageKey(k)] = v;
    });
    _serverCache = { ...res.data, completed };
    _cacheLoaded = true;
  } catch {
    // Do not lock a failed fetch into cache; allow retry.
    _serverCache = null;
    _cacheLoaded = false;
  }
  return _serverCache;
};

export const invalidateTutorialCache = () => {
  _serverCache = null;
  _cacheLoaded = false;
};

// ─── Tutorial content ───
// showIf: { minTier, calibrationRequired }
// minTier: minimum tier required to see this tutorial
// calibrationRequired: only show if calibration is complete
const TUTORIALS = {
  '/advisor': {
    title: 'BIQc Insights',
    steps: [
      { title: 'Your Strategic Advisor', body: 'This is your main command centre. BIQc analyses your business data and presents key insights, risks, and opportunities — all in plain language.' },
      { title: 'Ask Anything', body: 'Use the chat to ask business questions. BIQc draws on your calibration data and connected sources to give you tailored, strategic advice.' },
      { title: 'Stay Informed', body: 'Check back regularly — BIQc continuously monitors signals and updates your intelligence as new information comes in.' },
    ],
  },
  '/war-room': {
    title: 'Strategic Console',
    showIf: { minTier: 'starter' },
    steps: [
      { title: 'Your War Room', body: 'The Strategic Console is where you tackle high-priority decisions. Think of it as your private strategy room for the most critical business issues.' },
      { title: 'Real-Time Intelligence', body: 'Data feeds update in real-time. Use the console to drill into risks, track action items, and make informed decisions under pressure.' },
    ],
  },
  '/board-room': {
    title: 'Boardroom',
    showIf: { minTier: 'starter' },
    steps: [
      { title: 'Executive Overview', body: 'The Boardroom gives you a high-level summary of your business health — the kind of view you\'d present to investors or a board of directors.' },
      { title: 'Key Metrics', body: 'Track the metrics that matter most. Everything here is generated from your real business data, not generic templates.' },
    ],
  },
  '/operator': {
    title: 'Operator View',
    steps: [
      { title: 'Day-to-Day Operations', body: 'The Operator View focuses on your daily business operations. See what needs attention today and what\'s coming up.' },
      { title: 'Task Tracking', body: 'Track operational tasks, follow up on outstanding items, and keep your business running smoothly.' },
    ],
  },
  '/market': {
    title: 'Market Intelligence',
    showIf: { calibrationRequired: true },
    steps: [
      { title: 'Your Market Position', body: 'BIQc analyses your market landscape — competitors, trends, and signals relevant to your industry — based on your calibration data.' },
      { title: '5 Intelligence Domains', body: 'Explore Focus, Saturation, Demand, Friction, and Reports. Each tab surfaces a different lens on your market position.' },
    ],
  },
  '/competitive-benchmark': {
    title: 'Competitive Benchmark',
    showIf: { calibrationRequired: true },
    steps: [
      { title: 'Digital Footprint Score', body: 'Your Digital Footprint Score shows how your online presence compares to industry benchmarks across 5 pillars: Website, Social, Reviews, Content, and SEO.' },
      { title: 'Refresh Weekly', body: 'Click Refresh to re-run the benchmark scan. Your score updates based on your latest online activity.' },
    ],
  },
  '/decisions': {
    title: 'Decision Tracker',
    showIf: { calibrationRequired: true },
    steps: [
      { title: 'Signal-Driven Decisions', body: 'BIQc automatically detects when your business data signals a decision point. You\'ll see prompts here when action is recommended.' },
      { title: '30/60/90 Checkpoints', body: 'Every decision tracks its outcome at 30, 60, and 90 days. Mark each checkpoint to help BIQc learn what works for your business.' },
    ],
  },
  '/integrations': {
    title: 'Connectors',
    steps: [
      { title: 'Connect Your Tools', body: 'Integrations let you connect your CRM, accounting, email, and other business tools to BIQc.' },
      { title: 'Automatic Intelligence', body: 'Once connected, BIQc automatically pulls signals from your tools and surfaces them in your intelligence feed.' },
    ],
  },
  '/connect-email': {
    title: 'Connectors',
    steps: [
      { title: 'Connect Your Email', body: 'Link your Outlook or Gmail so BIQc can detect communication patterns, flag urgent items, and surface email-based business signals.' },
      { title: 'Privacy First', body: 'BIQc only reads metadata and key topics — it never stores full email content. All data is processed within Australian sovereignty.' },
    ],
  },
  '/settings': {
    title: 'Settings',
    steps: [
      { title: 'Customise Your Experience', body: 'Manage your account, AI preferences, notification settings, and tutorial options here.' },
      { title: 'Tutorial Preferences', body: 'Under Preferences, you can reset or disable tutorials across the entire platform at any time.' },
    ],
  },
  // Calibration pages
  'calibration-welcome': {
    title: 'Welcome to Calibration',
    steps: [
      { title: 'Let\'s Get Started', body: 'Calibration teaches BIQc about your business. Enter your website URL and we\'ll scan it to build your initial profile — it only takes a few minutes.' },
      { title: 'Why This Matters', body: 'The more BIQc knows about your business, the more targeted and useful its strategic advice will be. Think of this as the foundation for everything.' },
    ],
  },
  'calibration-chat': {
    title: 'Calibration Questions',
    steps: [
      { title: 'Answer Naturally', body: 'BIQc will ask a series of questions about your business. Answer naturally — there are no wrong answers and your progress is saved automatically.' },
    ],
  },
  'calibration-wow': {
    title: 'Business Summary Review',
    steps: [
      { title: 'Review Your Profile', body: 'BIQc has built a summary of your business from the scan. Review each section and edit anything that isn\'t accurate.' },
      { title: 'Confirm When Ready', body: 'Once confirmed, this becomes the foundation for all of BIQc\'s strategic advice.' },
    ],
  },
};

// ─── Context-aware filter ───
const shouldShowTutorial = (tutorial, user, authState) => {
  if (!tutorial?.showIf) return true;
  const { minTier, calibrationRequired } = tutorial.showIf;

  if (minTier && !hasAccess(resolveTier(user), minTier)) return false;

  if (calibrationRequired) {
    const { AUTH_STATE } = require('../context/SupabaseAuthContext');
    if (authState !== AUTH_STATE?.READY) return false;
  }

  return true;
};

// ─── Modal ───
const TutorialModal = ({ tutorial, onClose, onDismissForNow, pageKey }) => {
  const [step, setStep] = useState(0);
  const total = tutorial.steps.length;
  const current = tutorial.steps[step];

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onDismissForNow();
    if (e.key === 'ArrowRight' && step < total - 1) setStep(s => s + 1);
    if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1);
  }, [step, total, onDismissForNow]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" data-testid="tutorial-overlay">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onDismissForNow} />
      <div className="relative w-[90%] max-w-md rounded-2xl shadow-2xl mx-4"
        style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: '#FF6A00' }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#FF6A00' }}>
              {tutorial.title}
            </span>
          </div>
          <button onClick={onDismissForNow} className="p-1 rounded-lg hover:bg-white/5 transition-colors"
            data-testid="tutorial-close-btn" aria-label="Close tutorial">
            <X className="w-4 h-4" style={{ color: '#64748B' }} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-1">
          <div className="h-0.5 rounded-full overflow-hidden" style={{ background: '#243140' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ background: '#FF6A00', width: `${((step + 1) / total) * 100}%` }} />
          </div>
          <p className="text-[10px] mt-1" style={{ color: '#64748B' }}>Step {step + 1} of {total}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-4" style={{ minHeight: 100 }}>
          <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--biqc-text)' }}>{current.title}</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text-2)' }}>{current.body}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-1">
          <button onClick={onDismissForNow}
            className="text-xs transition-colors hover:text-[#9FB0C3]"
            style={{ color: '#64748B' }} data-testid="tutorial-dismiss-btn">
            Learn later
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--biqc-text-2)' }} data-testid="tutorial-prev-btn">
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            {step < total - 1 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-medium text-white transition-opacity"
                style={{ background: '#243140' }} data-testid="tutorial-next-btn">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white"
                style={{ background: '#FF6A00' }} data-testid="tutorial-done-btn">
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Hook ───
export const useTutorial = (pageKey) => {
  const [showTutorial, setShowTutorial] = useState(false);
  const [ready, setReady] = useState(false);
  const { user, authState } = useSupabaseAuth();
  const normalizedPageKey = normalizePageKey(pageKey);
  const tutorial = TUTORIALS[normalizedPageKey];
  const dismissedLocallyRef = useRef(false);

  // On mount: load server state (cached per session), decide whether to show
  useEffect(() => {
    if (!tutorial || !normalizedPageKey) return;
    if (!shouldShowTutorial(tutorial, user, authState)) return;
    if (!user || authState !== 'READY') return;

    let cancelled = false;
    const check = async () => {
      const state = await loadServerState();
      if (cancelled) return;

      if (!state) return;

      // Disabled globally for this user
      if (state.tutorials_disabled) return;

      // Already completed server-side
      if (state.completed?.[normalizedPageKey]) return;

      // Fallback: check localStorage (backward compat + "dismiss for now")
      const local = getLocal();
      if (local[normalizedPageKey] === 'permanent') return;
      if (local[normalizedPageKey] === 'dismissed') return;

      const timer = setTimeout(() => {
        if (!cancelled) setShowTutorial(true);
      }, 800);
      return () => clearTimeout(timer);
    };

    check();
    return () => { cancelled = true; };
  }, [normalizedPageKey, tutorial, user, authState]);

  // "Got it" — persists to server + localStorage permanently
  const closeTutorial = useCallback(async () => {
    setShowTutorial(false);
    setLocal(normalizedPageKey, 'permanent');
    // Update session cache immediately
    if (_serverCache) {
      _serverCache.completed = { ..._serverCache.completed, [normalizedPageKey]: new Date().toISOString() };
    }
    try {
      await apiClient.post('/tutorials/mark', { page_key: normalizedPageKey });
    } catch {
      // localStorage fallback already written — not fatal
    }
  }, [normalizedPageKey]);

  // Any dismissal is treated as "seen once": do not re-show automatically.
  const dismissForNow = useCallback(() => {
    setShowTutorial(false);
    dismissedLocallyRef.current = true;
    setLocal(normalizedPageKey, 'permanent');
    if (_serverCache) {
      _serverCache.completed = { ..._serverCache.completed, [normalizedPageKey]: new Date().toISOString() };
    }
    apiClient.post('/tutorials/mark', { page_key: normalizedPageKey }).catch(() => {});
  }, [normalizedPageKey]);

  const openTutorial = useCallback(() => {
    setShowTutorial(true);
  }, []);

  return { showTutorial, closeTutorial, dismissForNow, openTutorial, tutorial };
};

// ─── Help button ───
export const HelpButton = ({ onClick }) => (
  <button onClick={onClick}
    className="p-2 rounded-lg transition-colors hover:bg-white/5"
    style={{ color: '#64748B' }}
    title="Show page guide" aria-label="Show page guide"
    data-testid="tutorial-help-btn">
    <HelpCircle className="w-5 h-5" />
  </button>
);

// ─── Wrapper for DashboardLayout usage ───
// DashboardLayout renders this; it passes openTutorial to HelpButton
export const PageTutorial = ({ pageKey }) => {
  const { showTutorial, closeTutorial, dismissForNow, tutorial } = useTutorial(pageKey);
  if (!showTutorial || !tutorial) return null;
  return (
    <TutorialModal
      tutorial={tutorial}
      onClose={closeTutorial}
      onDismissForNow={dismissForNow}
      pageKey={pageKey}
    />
  );
};

// ─── Calibration-specific wrapper ───
export const CalibrationTutorial = ({ pageKey }) => {
  const { showTutorial, closeTutorial, dismissForNow, tutorial } = useTutorial(pageKey);
  if (!showTutorial || !tutorial) return null;
  return (
    <TutorialModal
      tutorial={tutorial}
      onClose={closeTutorial}
      onDismissForNow={dismissForNow}
      pageKey={pageKey}
    />
  );
};

export { TutorialModal, TUTORIALS };
export default TutorialModal;
