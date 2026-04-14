/**
 * ContactPage — "Get in Touch" marketing page.
 *
 * Sections: Hero, Two-column (Form + Info cards), Map, Footer (via WebsiteLayout).
 * Supports ?source=waitlist&label=X and ?source=custom_connector query params.
 * Posts to /api/enterprise/contact-request.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import WebsiteLayout from '../components/website/WebsiteLayout';
import { Shield, Send, Mail, MapPin, Clock, Calendar, ArrowRight, Lock, Zap } from 'lucide-react';
import { apiClient } from '../lib/api';
import { fontFamily } from '../design-system/tokens';

export default function ContactPage() {
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
    background: 'var(--bg-secondary, #0B1120)',
    border: '1px solid var(--border-card, rgba(140,170,210,0.12))',
    color: 'var(--ink-body, #C8D4E4)',
  };

  return (
    <WebsiteLayout>
      {/* Hero */}
      <section className="py-20 md:py-24 text-center px-6"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(46,74,110,0.08) 0%, transparent 60%), linear-gradient(180deg, #080C14 0%, #0B1120 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-[48px] font-bold leading-[1.15] tracking-tight mb-4"
            style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>
            {heading}
          </h1>
          <p className="text-lg max-w-[500px] mx-auto leading-relaxed"
            style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            {subtitle}
          </p>
        </div>
      </section>

      {/* Contact Grid */}
      <section className="pb-20 px-6" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="grid lg:grid-cols-5 gap-8 items-start">

            {/* Left: Form */}
            <div className="lg:col-span-3 rounded-xl p-9"
              style={{
                background: 'linear-gradient(105deg, rgba(200,220,240,0) 0%, rgba(200,220,240,0.06) 45%, rgba(200,220,240,0) 55%), linear-gradient(180deg, rgba(140,170,210,0.04) 0%, rgba(140,170,210,0.01) 100%)',
                border: '1px solid rgba(140,170,210,0.15)',
              }}>
              {submitted ? (
                <div className="text-center py-8" data-testid="contact-success">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(22,163,74,0.15)' }}>
                    <Shield className="w-6 h-6" style={{ color: '#16A34A' }} />
                  </div>
                  <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
                    {isWaitlist ? "You're on the waitlist" : isCustomConnector ? 'Connector request received' : 'Message sent'}
                  </h2>
                  <p className="text-sm mb-6" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                    {isWaitlist
                      ? "We'll use this to shape launch priorities and reach out when this module opens."
                      : isCustomConnector
                        ? 'Our team has received your connector request and will follow up shortly.'
                        : "We'll get back to you within 24 hours."}
                  </p>
                  <button onClick={() => nav('/')}
                    className="px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
                    style={{ background: 'var(--lava, #E85D00)' }}>
                    Back to home
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" data-testid="contact-form">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Full Name</label>
                    <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)}
                      className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={inputStyle} placeholder="Your full name" data-testid="contact-name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Work Email</label>
                    <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)}
                      className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={inputStyle} placeholder="you@company.com" data-testid="contact-email" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Company Name</label>
                    <input type="text" value={form.company} onChange={(e) => update('company', e.target.value)}
                      className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={inputStyle} placeholder="Your company" data-testid="contact-company" />
                  </div>

                  {/* Waitlist / Custom Connector fields */}
                  {(isWaitlist || isCustomConnector) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Feature Interest *</label>
                        <select value={form.featureLabel} onChange={(e) => update('featureLabel', e.target.value)} required
                          className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none appearance-none"
                          style={inputStyle} data-testid="contact-feature-label">
                          <option value="">Select feature</option>
                          {[waitlistLabel, 'Revenue Engine', 'Operations Intelligence', 'Risk & Workforce', 'Boardroom', 'War Room', 'Intel Centre', 'Analysis & Diagnosis Suite', 'Automations', 'Documents Library', 'Watchtower', 'Market Analysis', 'Ops Advisory Centre', 'Marketing Intelligence', 'Custom Connector']
                            .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
                            .map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Business Size *</label>
                        <select value={form.businessSize} onChange={(e) => update('businessSize', e.target.value)} required
                          className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none appearance-none"
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
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Subject</label>
                      <select value={form.subject} onChange={(e) => update('subject', e.target.value)} required
                        className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none appearance-none"
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
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Message</label>
                    <textarea value={form.message} onChange={(e) => update('message', e.target.value)} rows={5} required
                      className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none resize-y transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
                      style={{ ...inputStyle, minHeight: 120 }}
                      placeholder={isWaitlist ? 'Why do you need this feature and what outcome do you want?' : isCustomConnector ? 'Which platform, what data/actions, and where it should appear in BIQc...' : 'How can we help?'}
                      data-testid="contact-message" />
                  </div>
                  <button type="submit" disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[15px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
                    style={{ background: 'var(--lava, #E85D00)' }} data-testid="contact-submit">
                    <Send className="w-4 h-4" />
                    {submitting ? 'Sending...' : isWaitlist ? 'Join Waitlist' : isCustomConnector ? 'Submit Request' : 'Send Message'}
                  </button>
                  {submitError && <p className="text-xs text-red-400" data-testid="contact-submit-error">{submitError}</p>}
                </form>
              )}
            </div>

            {/* Right: Info Column */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Contact Details Card */}
              <div className="rounded-xl p-7"
                style={{
                  background: 'linear-gradient(105deg, rgba(200,220,240,0) 0%, rgba(200,220,240,0.06) 45%, rgba(200,220,240,0) 55%), linear-gradient(180deg, rgba(140,170,210,0.04) 0%, rgba(140,170,210,0.01) 100%)',
                  border: '1px solid rgba(140,170,210,0.15)',
                }}>
                <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Contact details</h3>
                {[
                  { icon: <Mail className="w-4 h-4" />, label: 'Email', value: 'hello@biqc.com' },
                  { icon: <MapPin className="w-4 h-4" />, label: 'Location', value: 'Sydney, Australia' },
                  { icon: <Clock className="w-4 h-4" />, label: 'Response time', value: 'We typically respond within 24 hours' },
                  { icon: <Calendar className="w-4 h-4" />, label: 'Office hours', value: 'Mon\u2013Fri, 9am\u20135pm AEST' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 mb-4 last:mb-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(232,93,0,0.12)', color: 'var(--lava, #E85D00)' }}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-[13px] mb-0.5" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>{item.label}</div>
                      <div className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)' }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Support Card */}
              <div className="rounded-xl p-7"
                style={{ background: 'rgba(232,93,0,0.06)', border: '1px solid rgba(232,93,0,0.2)' }}>
                <h4 className="text-[15px] font-semibold mb-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Looking for support?</h4>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                  Check our knowledge base for answers to common questions, troubleshooting guides, and getting-started resources.
                </p>
                <Link to="/knowledge-base" className="inline-flex items-center gap-1 text-sm font-semibold transition-colors hover:underline"
                  style={{ color: 'var(--lava, #E85D00)' }}>
                  Visit Knowledge Base <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="pb-24 px-6" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="rounded-xl overflow-hidden grid md:grid-cols-2 min-h-[280px]"
            style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border-card, rgba(140,170,210,0.12))' }}>
            {/* Map Visual */}
            <div className="flex flex-col items-center justify-center py-10 px-10 relative"
              style={{ background: 'linear-gradient(135deg, rgba(232,93,0,0.08) 0%, rgba(232,93,0,0.12) 50%, rgba(232,93,0,0.06) 100%)' }}>
              <div className="w-12 h-12 rounded-full rounded-bl-none rotate-[-45deg] flex items-center justify-center mb-5"
                style={{ background: 'var(--lava, #E85D00)', boxShadow: '0 4px 12px rgba(232,93,0,0.2)' }}>
                <div className="w-[18px] h-[18px] rounded-full rotate-45" style={{ background: 'var(--surface, #0E1628)' }} />
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Sydney, Australia</div>
              <div className="text-sm mt-1" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>Headquarters</div>
            </div>
            {/* Map Info */}
            <div className="flex flex-col justify-center py-10 px-10">
              <h3 className="text-2xl font-semibold mb-4"
                style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>
                Built in Australia, for Australia
              </h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                BIQc is headquartered in Sydney, with all data infrastructure hosted domestically in Sydney and Melbourne data centres.
              </p>
              {[
                { icon: '🇦🇺', text: '100% Australian-hosted data' },
                { icon: <Lock className="w-4 h-4" />, text: 'SOC 2 aligned infrastructure' },
                { icon: <Zap className="w-4 h-4" />, text: 'Low-latency for APAC region' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-2 text-sm" style={{ color: 'var(--ink-body, #C8D4E4)' }}>
                  <span className="text-base">{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 text-center" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
            Ready to See Your Business Clearly?
          </h2>
          <p className="text-lg mb-8" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            Start free. No credit card required. Intelligence in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'var(--lava, #E85D00)', boxShadow: '0 4px 16px rgba(232,93,0,0.3)' }}>
              Start Free Today <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </WebsiteLayout>
  );
}
