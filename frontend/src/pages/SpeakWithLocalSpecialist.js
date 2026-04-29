import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Send, Mail, Clock, Calendar, ArrowRight } from 'lucide-react';

import WebsiteLayout from '../components/website/WebsiteLayout';
import RecaptchaGate from '../components/RecaptchaGate';
import usePageMeta from '../hooks/usePageMeta';
import { apiClient } from '../lib/api';

const DISPLAY = 'var(--font-marketing-display, "Geist", sans-serif)';
const UI = 'var(--font-marketing-ui, "Geist", sans-serif)';
const SUCCESS_MESSAGE = 'Thanks — a BIQc advisor will contact you within 1 business hour.';
const FAILURE_MESSAGE = 'Something went wrong. Please try again.';

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(String(value || '').trim());

export default function SpeakWithLocalSpecialist() {
  usePageMeta({
    title: 'Speak with a Local Specialist | BIQc',
    description: 'Tell us about your business and a BIQc specialist will contact you within 1 business hour.',
  });

  const [form, setForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    company: '',
    urgency: 'ASAP within 1 business hour',
    preferred_time: '',
    message: '',
  });
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState('');

  const requiresPreferredTime = form.urgency === 'Schedule a time';

  const canSubmit = useMemo(() => {
    if (!String(form.firstname || '').trim()) return false;
    if (!String(form.lastname || '').trim()) return false;
    if (!String(form.email || '').trim() || !isValidEmail(form.email)) return false;
    if (!String(form.message || '').trim()) return false;
    if (!String(form.urgency || '').trim()) return false;
    if (requiresPreferredTime && !String(form.preferred_time || '').trim()) return false;
    if (!captchaToken || captchaUnavailable) return false;
    return true;
  }, [captchaToken, captchaUnavailable, form, requiresPreferredTime]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const inputStyle = {
    background: '#FFFFFF',
    border: '1px solid rgba(10,10,10,0.1)',
    color: 'var(--ink-display, #0A0A0A)',
    borderRadius: '8px',
    fontFamily: UI,
    letterSpacing: '-0.005em',
  };

  const labelStyle = { color: 'var(--ink-display, #0A0A0A)', fontFamily: UI, fontWeight: 600, letterSpacing: '-0.005em' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback('');
    if (!canSubmit) {
      setFeedback(FAILURE_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post('/hubspot/submit-lead', {
        firstname: String(form.firstname || '').trim(),
        lastname: String(form.lastname || '').trim(),
        email: String(form.email || '').trim(),
        phone: String(form.phone || '').trim(),
        company: String(form.company || '').trim(),
        urgency: String(form.urgency || '').trim(),
        preferred_time: String(form.preferred_time || '').trim(),
        message: String(form.message || '').trim(),
        biqc_lead_source: 'specialist_contact',
        captcha_token: captchaToken,
      });
      if (!response?.data?.success) {
        setFeedback(FAILURE_MESSAGE);
        return;
      }

      setSubmitted(true);
      setFeedback(SUCCESS_MESSAGE);
      setForm({
        firstname: '',
        lastname: '',
        email: '',
        phone: '',
        company: '',
        urgency: 'ASAP within 1 business hour',
        preferred_time: '',
        message: '',
      });
      setCaptchaToken('');
    } catch {
      setFeedback(FAILURE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WebsiteLayout>
      <section className="py-20 md:py-24 text-center px-6" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-semibold uppercase mb-6"
            style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(10,10,10,0.08)', color: 'var(--ink-secondary, #525252)', fontFamily: UI, letterSpacing: '0.08em' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lava, #E85D00)', display: 'inline-block' }} />
            Contact
          </div>
          <h1 className="text-4xl md:text-[48px] leading-[1.05] tracking-tight mb-4"
            style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '-0.035em' }}>
            Speak with a Local Specialist
          </h1>
          <p className="text-lg max-w-[620px] mx-auto leading-relaxed"
            style={{ color: 'var(--ink-secondary, #525252)', fontFamily: UI, letterSpacing: '-0.005em' }}>
            Tell us a little about your business and a BIQc specialist will contact you within 1 business hour.
          </p>
        </div>
      </section>

      <section className="pb-20 px-6" style={{ background: '#FFFFFF' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="grid lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3 p-9"
              style={{
                background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)',
                border: '1px solid rgba(10,10,10,0.06)',
                borderRadius: '18px',
                boxShadow: '0 8px 24px rgba(10,10,10,0.04), inset 0 1px 0 rgba(255,255,255,0.5)',
              }}>
              {submitted ? (
                <div className="text-center py-8" data-testid="specialist-contact-success">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#FFFFFF', border: '1px solid rgba(22,163,74,0.25)' }}>
                    <Shield className="w-6 h-6" style={{ color: '#16A34A' }} />
                  </div>
                  <h2 className="text-xl mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '-0.02em' }}>
                    Request received
                  </h2>
                  <p className="text-sm mb-6" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: UI }}>
                    {feedback || SUCCESS_MESSAGE}
                  </p>
                  <Link to="/register-supabase"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all"
                    style={{ background: '#0A0A0A', color: '#FFFFFF', border: '1px solid #0A0A0A', borderRadius: '999px', fontFamily: UI, letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.08)' }}>
                    Start Your 14-Day Trial <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" data-testid="specialist-contact-form">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1.5" style={labelStyle}>First name *</label>
                      <input type="text" required value={form.firstname} onChange={(e) => update('firstname', e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                        style={inputStyle} data-testid="specialist-firstname" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1.5" style={labelStyle}>Last name *</label>
                      <input type="text" required value={form.lastname} onChange={(e) => update('lastname', e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                        style={inputStyle} data-testid="specialist-lastname" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1.5" style={labelStyle}>Email *</label>
                      <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                        style={inputStyle} data-testid="specialist-email" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1.5" style={labelStyle}>Phone</label>
                      <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                        style={inputStyle} data-testid="specialist-phone" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-1.5" style={labelStyle}>Company</label>
                    <input type="text" value={form.company} onChange={(e) => update('company', e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={inputStyle} data-testid="specialist-company" />
                  </div>

                  <div>
                    <label className="block text-sm mb-1.5" style={labelStyle}>Urgency *</label>
                    <select value={form.urgency} onChange={(e) => update('urgency', e.target.value)} required
                      className="w-full px-3.5 py-2.5 text-sm outline-none appearance-none"
                      style={inputStyle} data-testid="specialist-urgency">
                      <option value="ASAP within 1 business hour">ASAP within 1 business hour</option>
                      <option value="Schedule a time">Schedule a time</option>
                    </select>
                  </div>

                  {requiresPreferredTime && (
                    <div>
                      <label className="block text-sm mb-1.5" style={labelStyle}>Preferred time *</label>
                      <input type="datetime-local" value={form.preferred_time} onChange={(e) => update('preferred_time', e.target.value)} required
                        className="w-full px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                        style={inputStyle} data-testid="specialist-preferred-time" />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm mb-1.5" style={labelStyle}>Message *</label>
                    <textarea value={form.message} onChange={(e) => update('message', e.target.value)} rows={5} required
                      className="w-full px-3.5 py-2.5 text-sm outline-none resize-y transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={{ ...inputStyle, minHeight: 120 }} data-testid="specialist-message" />
                  </div>

                  <div>
                    <RecaptchaGate
                      onTokenChange={(token) => setCaptchaToken(token || '')}
                      onStatusChange={({ status }) => setCaptchaUnavailable(status === 'error')}
                      action="book_demo"
                      testId="specialist-recaptcha"
                    />
                  </div>

                  <button type="submit" disabled={!canSubmit || submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 text-[15px] font-medium transition-all disabled:opacity-60"
                    style={{ background: '#0A0A0A', color: '#FFFFFF', border: '1px solid #0A0A0A', borderRadius: '999px', fontFamily: UI, letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.08)' }}
                    data-testid="specialist-submit">
                    <Send className="w-4 h-4" />
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  {feedback && <p className="text-xs mt-2" style={{ color: '#DC2626', fontFamily: UI }} data-testid="specialist-submit-error">{feedback}</p>}
                </form>
              )}
            </div>

            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="p-7"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(10,10,10,0.06)',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(10,10,10,0.03)',
                }}>
                <h3 className="text-base mb-5" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '-0.015em' }}>Contact details</h3>
                {[
                  { icon: <Mail className="w-4 h-4" />, label: 'Email', value: 'support@biqc.ai' },
                  { icon: <Clock className="w-4 h-4" />, label: 'Response time', value: 'Within 1 business hour' },
                  { icon: <Calendar className="w-4 h-4" />, label: 'Office hours', value: 'Mon–Fri, 9am–5pm AEST' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 mb-4 last:mb-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'var(--canvas-sage-soft, #F7F8F2)', border: '1px solid rgba(10,10,10,0.06)', color: 'var(--ink, #171717)' }}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-[12px] mb-0.5" style={{ color: 'var(--ink-muted, #737373)', fontFamily: UI }}>{item.label}</div>
                      <div className="text-sm font-medium" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: UI, letterSpacing: '-0.005em' }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-7"
                style={{ background: 'var(--canvas-sage-deep, #EEF1E6)', border: '1px solid rgba(10,10,10,0.06)', borderRadius: '16px' }}>
                <h4 className="text-[15px] mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '-0.015em' }}>
                  Ready to start now?
                </h4>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: UI }}>
                  You can start your BIQc 14-day trial immediately while we prepare your specialist callback.
                </p>
                <Link to="/register-supabase" className="inline-flex items-center gap-1 text-sm font-medium transition-colors"
                  style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: UI, letterSpacing: '-0.005em' }}>
                  Start Your 14-Day Trial <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--lava, #E85D00)' }} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </WebsiteLayout>
  );
}
