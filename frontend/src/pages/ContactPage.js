/**
 * ContactPage — "Get in Touch" marketing page.
 *
 * Sections: Hero, Two-column (Form + Info cards), Bottom CTA, Footer (via WebsiteLayout).
 * Supports ?source=waitlist&label=X and ?source=custom_connector query params.
 * Posts to /api/enterprise/contact-request.
 *
 * Map section removed per Andreas 2026-04-18 feedback.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import WebsiteLayout from '../components/website/WebsiteLayout';
import usePageMeta from '../hooks/usePageMeta';
import { Shield, Send, Mail, Clock, Calendar, ArrowRight } from 'lucide-react';
import { apiClient } from '../lib/api';
/* design tokens consumed via CSS custom properties — see liquid-steel-tokens.css */

const DISPLAY = 'var(--font-marketing-display, "Geist", sans-serif)';
const UI      = 'var(--font-marketing-ui, "Geist", sans-serif)';

export default function ContactPage() {
  usePageMeta({ title: 'Contact BIQc', description: 'Get in touch with the BIQc team. Enterprise enquiries, support, and partnership opportunities.' });
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const waitlistLabel = searchParams.get('label') || '';
  const isWaitlist = searchParams.get('source') === 'waitlist';
  const isCustomConnector = searchParams.get('source') === 'custom_connector';

  const [form, setForm] = useState({
    name: '', email: '', company: '', subject: '',
    featureLabel: waitlistLabel, businessSize: '', message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const heading = useMemo(() => {
    if (isCustomConnector) return 'Add a Custom Connector';
    if (isWaitlist && waitlistLabel) return `Join the Waitlist for ${waitlistLabel}`;
    return 'Get in Touch';
  }, [isCustomConnector, isWaitlist, waitlistLabel]);

  const subtitle = useMemo(() => {
    if (isWaitlist) return 'Tell us why this feature matters and how large your business is.';
    if (isCustomConnector) return 'Tell us which platform you need and what data BIQc should support.';
    return "We'd love to hear from you.";
  }, [isWaitlist, isCustomConnector]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const now = new Date();
      await apiClient.post('/enterprise/contact-request', {
        name: form.name,
        business_name: form.company,
        email: form.email,
        phone: '',
        callback_date: now.toISOString().slice(0, 10),
        callback_time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        description: `${form.subject ? `Subject: ${form.subject}. ` : ''}${isWaitlist && form.businessSize ? `Business size: ${form.businessSize}. ` : ''}${isCustomConnector ? 'Custom connector request. ' : ''}${form.message}`,
        feature_requested: form.featureLabel || waitlistLabel || (isCustomConnector ? 'Custom Connector' : form.subject || ''),
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

  const inputStyle = {
    background: '#FFFFFF',
    border: '1px solid rgba(10,10,10,0.1)',
    color: 'var(--ink-display, #0A0A0A)',
    borderRadius: '8px',
    fontFamily: UI,
    letterSpacing: '-0.005em',
  };

  const labelStyle = { color: 'var(--ink-display, #0A0A0A)', fontFamily: UI, fontWeight: 600, letterSpacing: '-0.005em' };

  return (
    <WebsiteLayout>
      {/* ── Hero — sage canvas, Merge pattern ── */}
      <section className="py-20 md:py-24 text-center px-6" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-semibold uppercase mb-6"
            style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(10,10,10,0.08)', color: 'var(--ink-secondary, #525252)', fontFamily: UI, letterSpacing: '0.08em' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lava, #E85D00)', display: 'inline-block' }} />
            Contact
          </div>
          <h1 className="text-4xl md:text-[48px] leading-[1.05] tracking-tight mb-4"
            style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '-0.035em' }}>
            {heading}
          </h1>
          <p className="text-lg max-w-[520px] mx-auto leading-relaxed"
            style={{ color: 'var(--ink-secondary, #525252)', fontFamily: UI, letterSpacing: '-0.005em' }}>
            {subtitle}
          </p>
        </div>
      </section>

      {/* ── Form + Info ── */}
      <section className="pb-20 px-6" style={{ background: '#FFFFFF' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="grid lg:grid-cols-5 gap-8 items-start">

            {/* Left: Form card — liquid-steel silver */}
            <div className="lg:col-span-3 p-9"
              style={{
                background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)',
                border: '1px solid rgba(10,10,10,0.06)',
                borderRadius: '18px',
                boxShadow: '0 8px 24px rgba(10,10,10,0.04), inset 0 1px 0 rgba(255,255,255,0.5)',
              }}>
              {submitted ? (
                <div className="text-center py-8" data-testid="contact-success">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#FFFFFF', border: '1px solid rgba(22,163,74,0.25)' }}>
                    <Shield className="w-6 h-6" style={{ color: '#16A34A' }} />
                  </div>
                  <h2 className="text-xl mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '-0.02em' }}>
                    {isWaitlist ? "You're on the waitlist" : isCustomConnector ? 'Connector request received' : 'Message sent'}
                  </h2>
                  <p className="text-sm mb-6" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: UI }}>
                    {isWaitlist
                      ? "We'll use this to shape launch priorities and reach out when this module opens."
                      : isCustomConnector
                        ? 'Our team has received your connector request and will follow up shortly.'
                        : "We'll get back to you within 24 hours."}
                  </p>
                  <button onClick={() => nav('/')}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all"
                    style={{ background: '#0A0A0A', color: '#FFFFFF', border: '1px solid #0A0A0A', borderRadius: '999px', fontFamily: UI, letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.08)' }}>
                    Back to home
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" data-testid="contact-form">
                  <div>
                    <label className="block text-sm mb-1.5" style={labelStyle}>Full Name</label>
                    <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={inputStyle} placeholder="Your full name" data-testid="contact-name" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={labelStyle}>Work Email</label>
                    <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={inputStyle} placeholder="you@company.com" data-testid="contact-email" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={labelStyle}>Company Name</label>
                    <input type="text" value={form.company} onChange={(e) => update('company', e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={inputStyle} placeholder="Your company" data-testid="contact-company" />
                  </div>

                  {/* Waitlist / Custom Connector fields */}
                  {(isWaitlist || isCustomConnector) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1.5" style={labelStyle}>Feature Interest *</label>
                        <select value={form.featureLabel} onChange={(e) => update('featureLabel', e.target.value)} required
                          className="w-full px-3.5 py-2.5 text-sm outline-none appearance-none"
                          style={inputStyle} data-testid="contact-feature-label">
                          <option value="">Select feature</option>
                          {[waitlistLabel, 'Revenue Engine', 'Operations Intelligence', 'Risk & Workforce', 'Boardroom', 'War Room', 'Intel Centre', 'Analysis & Diagnosis Suite', 'Automations', 'Documents Library', 'Watchtower', 'Market Analysis', 'Ops Advisory Centre', 'Marketing Intelligence', 'Custom Connector']
                            .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
                            .map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm mb-1.5" style={labelStyle}>Business Size *</label>
                        <select value={form.businessSize} onChange={(e) => update('businessSize', e.target.value)} required
                          className="w-full px-3.5 py-2.5 text-sm outline-none appearance-none"
                          style={inputStyle} data-testid="contact-business-size">
                          <option value="">Select size</option>
                          {['Solo', '2-10 staff', '11-25 staff', '26-50 staff', '51-100 staff', '100+ staff'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Standard Subject (only for non-waitlist/connector) */}
                  {!isWaitlist && !isCustomConnector && (
                    <div>
                      <label className="block text-sm mb-1.5" style={labelStyle}>Subject</label>
                      <select value={form.subject} onChange={(e) => update('subject', e.target.value)} required
                        className="w-full px-3.5 py-2.5 text-sm outline-none appearance-none"
                        style={inputStyle} data-testid="contact-subject">
                        <option value="" disabled>Select a topic</option>
                        <option value="general">General Inquiry</option>
                        <option value="demo">Product Demo</option>
                        <option value="enterprise">Enterprise Sales</option>
                        <option value="support">Support</option>
                        <option value="partnership">Partnership</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm mb-1.5" style={labelStyle}>Message</label>
                    <textarea value={form.message} onChange={(e) => update('message', e.target.value)} rows={5} required
                      className="w-full px-3.5 py-2.5 text-sm outline-none resize-y transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={{ ...inputStyle, minHeight: 120 }}
                      placeholder={isWaitlist ? 'Why do you need this feature and what outcome do you want?' : isCustomConnector ? 'Which platform, what data/actions, and where it should appear in BIQc...' : 'How can we help?'}
                      data-testid="contact-message" />
                  </div>
                  <button type="submit" disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 text-[15px] font-medium transition-all disabled:opacity-60"
                    style={{ background: '#0A0A0A', color: '#FFFFFF', border: '1px solid #0A0A0A', borderRadius: '999px', fontFamily: UI, letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.08)' }}
                    data-testid="contact-submit">
                    <Send className="w-4 h-4" />
                    {submitting ? 'Sending...' : isWaitlist ? 'Join Waitlist' : isCustomConnector ? 'Submit Request' : 'Send Message'}
                  </button>
                  {submitError && <p className="text-xs mt-2" style={{ color: '#DC2626', fontFamily: UI }} data-testid="contact-submit-error">{submitError}</p>}
                </form>
              )}
            </div>

            {/* Right: Info Column */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Contact Details Card — white with subtle steel accent */}
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
                  { icon: <Clock className="w-4 h-4" />, label: 'Response time', value: 'We typically respond within 24 hours' },
                  { icon: <Calendar className="w-4 h-4" />, label: 'Office hours', value: 'Mon\u2013Fri, 9am\u20135pm AEST' },
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

              {/* Support Card — sage-deep with subtle orange link */}
              <div className="p-7"
                style={{ background: 'var(--canvas-sage-deep, #EEF1E6)', border: '1px solid rgba(10,10,10,0.06)', borderRadius: '16px' }}>
                <h4 className="text-[15px] mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '-0.015em' }}>Looking for support?</h4>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: UI }}>
                  Check our knowledge base for answers to common questions, troubleshooting guides, and getting-started resources.
                </p>
                <Link to="/knowledge-base" className="inline-flex items-center gap-1 text-sm font-medium transition-colors"
                  style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: UI, letterSpacing: '-0.005em' }}>
                  Visit Knowledge Base <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--lava, #E85D00)' }} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-24 px-6 text-center" style={{ background: 'var(--canvas-sage, #F2F4EC)' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl mb-4" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.1 }}>
            Ready to See Your Business Clearly?
          </h2>
          <p className="text-lg mb-8" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: UI, letterSpacing: '-0.005em' }}>
            14-day trial. Cancel anytime. Intelligence in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register-supabase"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-[15px] font-medium transition-all"
              style={{ background: '#0A0A0A', color: '#FFFFFF', border: '1px solid #0A0A0A', borderRadius: '999px', fontFamily: UI, letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.08)' }}>
              Start Your Trial Today <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </WebsiteLayout>
  );
}
