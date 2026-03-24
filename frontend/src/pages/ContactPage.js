import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Shield, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { apiClient } from '../lib/api';

const CHARCOAL = '#0F1720';
const MUTED = '#64748B';
const ORANGE = '#FF6A00';
const BORDER = 'rgba(180,195,215,0.35)';

const ContactPage = () => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const waitlistLabel = searchParams.get('label') || '';
  const isWaitlist = searchParams.get('source') === 'waitlist';
  const isCustomConnector = searchParams.get('source') === 'custom_connector';
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', businessSize: '', featureLabel: waitlistLabel, message: '' });
  const [infoOpen, setInfoOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const heading = useMemo(() => {
    if (isCustomConnector) return 'Add a custom connector';
    if (isWaitlist && waitlistLabel) return `Join the waitlist for ${waitlistLabel}`;
    return 'Get in touch';
  }, [isCustomConnector, isWaitlist, waitlistLabel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const now = new Date();
      const callbackDate = now.toISOString().slice(0, 10);
      const callbackTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      await apiClient.post('/enterprise/contact-request', {
        name: form.name,
        business_name: form.company,
        email: form.email,
        phone: form.phone,
        callback_date: callbackDate,
        callback_time: callbackTime,
        description: `${isWaitlist && form.businessSize ? `Business size: ${form.businessSize}. ` : ''}${isCustomConnector ? 'Custom connector request. ' : ''}${form.message}`,
        feature_requested: form.featureLabel || waitlistLabel || (isCustomConnector ? 'Custom Connector' : ''),
        current_tier: isWaitlist ? 'waitlist' : (isCustomConnector ? 'custom_connector' : 'contact'),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err?.response?.data?.detail || 'Unable to submit request right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF8' }}>
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ background: 'white', borderColor: BORDER }}>
        <button onClick={() => nav('/')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors" data-testid="back-to-home">
          <ArrowLeft className="w-4 h-4" /> Back to BIQc
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs" style={{ background: ORANGE }}>B</div>
          <span className="font-semibold text-sm" style={{ color: CHARCOAL }}>BIQc</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

          {/* LEFT — Contact Form */}
          <div className="lg:col-span-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ fontFamily: 'var(--font-heading)', color: CHARCOAL, letterSpacing: '-0.03em' }}>
              {heading}
            </h1>
            <p className="text-base text-slate-500 mb-8" style={{ fontFamily: 'var(--font-body)' }}>
              {isWaitlist
                ? 'Tell us why this feature matters, how large your business is, and what outcome you need. We’ll use that to prioritise launch demand.'
                : isCustomConnector
                  ? 'Tell us which platform you need, what data/actions BIQc should support, and where it should appear in your workflows.'
                : 'Have questions? We\'ll show you exactly how BIQc works for your business.'}
            </p>

            {submitted ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: 'white', border: `1px solid ${BORDER}` }} data-testid="contact-success">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#ECFDF5' }}>
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: CHARCOAL, fontFamily: 'var(--font-heading)' }}>{isWaitlist ? 'You’re on the waitlist' : (isCustomConnector ? 'Connector request received' : 'We\'ve received your request')}</h2>
                <p className="text-sm text-slate-500 mb-6">
                  {isWaitlist
                    ? 'Thanks for sharing your use case. We’ll use this to shape launch priorities and reach out when this module opens.'
                    : isCustomConnector
                      ? 'Our support team has received your connector request and will follow up shortly.'
                      : 'A BIQc specialist will be in touch within 24 hours to schedule your demo.'}
                </p>
                <button onClick={() => nav('/')} className="px-6 py-3 rounded-full text-sm font-semibold text-white" style={{ background: CHARCOAL }}>
                  Back to home
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" data-testid="contact-form">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Full Name *</label>
                    <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                      style={{ background: 'white', border: `1px solid ${BORDER}`, color: CHARCOAL }}
                      placeholder="Your name" data-testid="contact-name" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Work Email *</label>
                    <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                      style={{ background: 'white', border: `1px solid ${BORDER}`, color: CHARCOAL }}
                      placeholder="you@company.com" data-testid="contact-email" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Company</label>
                    <input type="text" value={form.company} onChange={(e) => update('company', e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                      style={{ background: 'white', border: `1px solid ${BORDER}`, color: CHARCOAL }}
                      placeholder="Your company" data-testid="contact-company" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Phone</label>
                    <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                      style={{ background: 'white', border: `1px solid ${BORDER}`, color: CHARCOAL }}
                      placeholder="+61 400 000 000" data-testid="contact-phone" />
                  </div>
                </div>
                {(isWaitlist || isCustomConnector) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Feature Interest *</label>
                      <select value={form.featureLabel} onChange={(e) => update('featureLabel', e.target.value)} required
                        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                        style={{ background: 'white', border: `1px solid ${BORDER}`, color: CHARCOAL }}
                        data-testid="contact-feature-label">
                        <option value="">Select feature</option>
                        {[
                          waitlistLabel,
                          'Revenue Engine',
                          'Operations Intelligence',
                          'Risk & Workforce',
                          'Boardroom',
                          'War Room',
                          'Intel Centre',
                          'Analysis & Diagnosis Suite',
                          'Automations',
                          'Documents Library',
                          'Watchtower',
                          'Market Analysis',
                          'Ops Advisory Centre',
                          'Marketing Intelligence',
                          'Custom Connector',
                        ].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Business Size *</label>
                      <select value={form.businessSize} onChange={(e) => update('businessSize', e.target.value)} required
                        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                        style={{ background: 'white', border: `1px solid ${BORDER}`, color: CHARCOAL }}
                        data-testid="contact-business-size">
                        <option value="">Select size</option>
                        <option value="Solo">Solo</option>
                        <option value="2-10">2-10 staff</option>
                        <option value="11-25">11-25 staff</option>
                        <option value="26-50">26-50 staff</option>
                        <option value="51-100">51-100 staff</option>
                        <option value="100+">100+ staff</option>
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>What are you looking to solve?</label>
                  <textarea value={form.message} onChange={(e) => update('message', e.target.value)} rows={4}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none transition-colors"
                    style={{ background: 'white', border: `1px solid ${BORDER}`, color: CHARCOAL }}
                    placeholder={isWaitlist
                      ? 'Why do you need this feature, what outcome do you want, and what has blocked you so far?'
                      : isCustomConnector
                        ? 'Example: Connect ServiceM8. Need jobs, invoices, and technician schedules to drive BIQc operations alerts.'
                        : 'Tell us about your business challenges...'}
                    data-testid="contact-message" />
                </div>
                <button type="submit" className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-white font-semibold w-full sm:w-auto hover:-translate-y-0.5 transition-all"
                  style={{ fontFamily: 'var(--font-heading)', background: CHARCOAL, fontSize: 15, boxShadow: '0 3px 14px rgba(0,0,0,0.2)' }} data-testid="contact-submit" disabled={submitting}>
                  <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : (isWaitlist ? 'Join Waitlist' : (isCustomConnector ? 'Submit connector request' : 'Request Demo'))}
                </button>
                {submitError && (
                  <p className="text-xs text-red-400" data-testid="contact-submit-error">{submitError}</p>
                )}
                <p className="text-xs text-slate-400" style={{ fontFamily: 'var(--font-mono)' }}>We'll respond within 24 hours. No spam, ever.</p>
              </form>
            )}
          </div>

          {/* RIGHT — Collapsible Info Panel */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl overflow-hidden" style={{ background: CHARCOAL }}>
              <button onClick={() => setInfoOpen(!infoOpen)}
                className="w-full flex items-center justify-between px-6 py-5 text-left lg:cursor-default"
                data-testid="info-panel-toggle">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)', color: ORANGE }}>Why BIQc?</span>
                <span className="lg:hidden text-white">
                  {infoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              <div className={`px-6 pb-6 space-y-5 transition-all duration-300 ${infoOpen ? 'block' : 'hidden lg:block'}`}>
                {[
                  { label: 'Your Digital Leadership Team', desc: 'CTO, CFO, CMO, COO, CCO — deployed as AI agents working 24/7 across your business.' },
                  { label: 'Australian Sovereign', desc: 'Your data stays on Australian soil. Protected by local privacy laws. Zero foreign access.' },
                  { label: 'Not a Dashboard', desc: 'BIQc doesn\'t wait for you to ask. It monitors, detects, alerts, and acts — before problems become crises.' },
                  { label: 'Live in Minutes', desc: 'Connect one tool and BIQc begins monitoring immediately. No implementation project. No consultants.' },
                ].map((item, i) => (
                  <div key={i} className="border-l-2 pl-4" style={{ borderColor: `${ORANGE}60` }}>
                    <p className="text-sm font-semibold text-white mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{item.label}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
                <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" strokeWidth={2} />
                    <p className="text-[10px] text-slate-500" style={{ fontFamily: 'var(--font-mono)' }}>No credit card required · Australian owned & operated</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
