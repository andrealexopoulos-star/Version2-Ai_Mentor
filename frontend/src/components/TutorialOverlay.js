import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';

const STORAGE_KEY = 'biqc_tutorials_seen';

const getSeen = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};

const markSeen = (pageKey) => {
  const seen = getSeen();
  seen[pageKey] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
};

// Tutorial content for each page — written for non-AI-savvy users
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
    steps: [
      { title: 'Your War Room', body: 'The Strategic Console is where you tackle high-priority decisions. Think of it as your private strategy room for the most critical business issues.' },
      { title: 'Real-Time Intelligence', body: 'Data feeds update in real-time. Use the console to drill into risks, track action items, and make informed decisions under pressure.' },
    ],
  },
  '/board-room': {
    title: 'Board Room',
    steps: [
      { title: 'Executive Overview', body: 'The Board Room gives you a high-level summary of your business health — the kind of view you\'d present to investors or a board of directors.' },
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
  '/soundboard': {
    title: 'SoundBoard',
    steps: [
      { title: 'Think Out Loud', body: 'SoundBoard is your space to bounce ideas off BIQc. Type in a business idea, challenge, or scenario and get instant strategic feedback.' },
      { title: 'No Wrong Answers', body: 'This is a safe space to explore "what if" scenarios. BIQc won\'t judge — it will help you think through the implications.' },
    ],
  },
  '/diagnosis': {
    title: 'Business Diagnosis',
    steps: [
      { title: 'Health Check', body: 'Diagnosis runs a comprehensive check on your business, identifying strengths, weaknesses, and areas that need immediate attention.' },
      { title: 'Actionable Insights', body: 'Each finding comes with a recommended action. Focus on the high-priority items first for maximum impact.' },
    ],
  },
  '/analysis': {
    title: 'Analysis',
    steps: [
      { title: 'Deep Dive', body: 'Use Analysis to explore specific aspects of your business in detail — revenue trends, customer patterns, competitive positioning, and more.' },
      { title: 'Data-Driven Decisions', body: 'All analysis is based on your actual business data. The insights adapt as your business evolves.' },
    ],
  },
  '/market-analysis': {
    title: 'Market Analysis',
    steps: [
      { title: 'Know Your Market', body: 'Market Analysis scans your industry landscape — competitors, trends, and opportunities you might be missing.' },
      { title: 'Stay Ahead', body: 'Use these insights to position your business strategically. Knowledge of your market is your competitive edge.' },
    ],
  },
  '/intel-centre': {
    title: 'Intel Centre',
    steps: [
      { title: 'Intelligence Hub', body: 'The Intel Centre aggregates all intelligence signals — market movements, competitor activity, and internal data — into one place.' },
      { title: 'Signal vs Noise', body: 'BIQc filters out the noise and highlights what actually matters to your business. Focus on the signals that drive action.' },
    ],
  },
  '/sop-generator': {
    title: 'SOP Generator',
    steps: [
      { title: 'Standard Operating Procedures', body: 'Automatically generate professional SOPs (Standard Operating Procedures) for any process in your business.' },
      { title: 'How to Use', body: 'Describe the process you want documented, and BIQc will create a clear, step-by-step procedure your team can follow.' },
    ],
  },
  '/data-center': {
    title: 'Data Center',
    steps: [
      { title: 'Your Data Hub', body: 'The Data Center is where all your business data lives. Upload documents, connect data sources, and manage the information BIQc uses to advise you.' },
      { title: 'Better Data, Better Advice', body: 'The more data you provide, the more accurate and personalised BIQc\'s insights become.' },
    ],
  },
  '/documents': {
    title: 'Documents',
    steps: [
      { title: 'Document Library', body: 'Store and organise important business documents. BIQc can reference these when providing strategic advice.' },
      { title: 'Easy Access', body: 'Upload, view, and manage your files. Everything is securely stored with Australian data sovereignty.' },
    ],
  },
  '/intelligence-baseline': {
    title: 'Intelligence Baseline',
    steps: [
      { title: 'Your Starting Point', body: 'The Intelligence Baseline captures where your business stands today. It\'s the foundation BIQc uses to measure progress and identify changes.' },
      { title: 'Regular Updates', body: 'Review and update your baseline periodically to ensure BIQc\'s advice stays relevant and accurate.' },
    ],
  },
  '/business-profile': {
    title: 'Business DNA',
    steps: [
      { title: 'Your Business Identity', body: 'Business DNA captures the core details of your business — who you are, what you do, and how you operate.' },
      { title: 'Keep It Updated', body: 'The more accurate your profile, the better BIQc can tailor its advice. Update it whenever your business changes significantly.' },
    ],
  },
  '/integrations': {
    title: 'Integrations',
    steps: [
      { title: 'Connect Your Tools', body: 'Integrations let you connect external tools and services to BIQc — email, calendar, CRM, and more.' },
      { title: 'Automatic Intelligence', body: 'Once connected, BIQc automatically pulls relevant data from your tools to enhance its analysis and recommendations.' },
    ],
  },
  '/connect-email': {
    title: 'Email Connection',
    steps: [
      { title: 'Connect Your Email', body: 'Link your business email (Outlook or Gmail) so BIQc can analyse communication patterns and extract business intelligence.' },
      { title: 'Privacy First', body: 'BIQc only reads metadata and key topics — it doesn\'t store your full emails. All data stays within Australian sovereignty.' },
    ],
  },
  '/email-inbox': {
    title: 'Email Inbox',
    steps: [
      { title: 'Smart Email View', body: 'Your Email Inbox shows connected emails with AI-enhanced context — BIQc highlights what\'s important and flags items that need attention.' },
    ],
  },
  '/calendar': {
    title: 'Calendar',
    steps: [
      { title: 'Your Schedule', body: 'View your connected calendar events. BIQc can use your schedule to provide context-aware advice and identify time management insights.' },
    ],
  },
  '/settings': {
    title: 'Settings',
    steps: [
      { title: 'Customise Your Experience', body: 'Manage your account settings, notification preferences, and personalisation options here.' },
      { title: 'Security', body: 'Update your password, manage connected accounts, and review your security settings to keep your data safe.' },
    ],
  },
  '/admin': {
    title: 'Admin Dashboard',
    steps: [
      { title: 'System Administration', body: 'Manage users, monitor system health, and configure platform-wide settings from the Admin Dashboard.' },
    ],
  },
  // Calibration pages (not in DashboardLayout)
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
      { title: 'Answer Naturally', body: 'BIQc will ask you a series of questions about your business. Just answer naturally — there are no wrong answers.' },
      { title: 'Your Progress is Saved', body: 'Don\'t worry about losing your progress. Your answers are automatically saved after each step, so you can pick up right where you left off.' },
    ],
  },
  'calibration-wow': {
    title: 'Business Summary Review',
    steps: [
      { title: 'Review Your Profile', body: 'BIQc has created a summary of your business based on what it found. Review each section and click to edit anything that\'s not quite right.' },
      { title: 'Confirm When Ready', body: 'Once you\'re happy with the summary, confirm it. This becomes the foundation for all of BIQc\'s strategic advice.' },
    ],
  },
};

// The overlay component
const TutorialModal = ({ tutorial, onClose }) => {
  const [step, setStep] = useState(0);
  const total = tutorial.steps.length;
  const current = tutorial.steps[step];

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && step < total - 1) setStep(s => s + 1);
    if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1);
  }, [step, total, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" data-testid="tutorial-overlay">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative w-[90%] max-w-md rounded-2xl shadow-2xl mx-4"
        style={{ background: '#141C26', border: '1px solid #243140' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#FF6A00' }}>
            {tutorial.title}
          </span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors"
            data-testid="tutorial-close-btn" aria-label="Close tutorial">
            <X className="w-4 h-4" style={{ color: '#64748B' }} />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-4" style={{ minHeight: 120 }}>
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#F4F7FA' }}>{current.title}</h3>
          <p className="text-sm leading-relaxed" style={{ color: '#9FB0C3' }}>{current.body}</p>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-2">
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full transition-colors"
                style={{ background: i === step ? '#B8860B' : '#E8E6E1' }} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                style={{ color: '#9FB0C3' }} data-testid="tutorial-prev-btn">
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
                className="px-4 py-2 rounded-lg text-xs font-medium text-white transition-opacity"
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

// Hook for pages to use tutorials
export const useTutorial = (pageKey) => {
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorial = TUTORIALS[pageKey];

  useEffect(() => {
    if (!tutorial) return;
    const seen = getSeen();
    if (!seen[pageKey]) {
      const timer = setTimeout(() => setShowTutorial(true), 600);
      return () => clearTimeout(timer);
    }
  }, [pageKey, tutorial]);

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    markSeen(pageKey);
  }, [pageKey]);

  const openTutorial = useCallback(() => {
    setShowTutorial(true);
  }, []);

  return { showTutorial, closeTutorial, openTutorial, tutorial };
};

// Help button component
export const HelpButton = ({ onClick }) => (
  <button onClick={onClick}
    className="p-2 rounded-lg transition-colors hover:bg-gray-100"
    style={{ color: 'var(--text-secondary, #64748B)' }}
    title="Show page guide" aria-label="Show page guide"
    data-testid="tutorial-help-btn">
    <HelpCircle className="w-5 h-5" />
  </button>
);

// Standalone tutorial wrapper for non-DashboardLayout pages (calibration)
export const CalibrationTutorial = ({ pageKey }) => {
  const { showTutorial, closeTutorial, tutorial } = useTutorial(pageKey);
  if (!showTutorial || !tutorial) return null;
  return <TutorialModal tutorial={tutorial} onClose={closeTutorial} />;
};

export { TutorialModal, TUTORIALS };
export default TutorialModal;
