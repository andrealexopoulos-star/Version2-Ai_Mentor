import { Link } from 'react-router-dom';
import { Mail, Clock, Calendar, ArrowRight } from 'lucide-react';

import WebsiteLayout from '../components/website/WebsiteLayout';
import HubspotEmbeddedForm from '../components/HubspotEmbeddedForm';
import usePageMeta from '../hooks/usePageMeta';

const DISPLAY = 'var(--font-marketing-display, "Geist", sans-serif)';
const UI = 'var(--font-marketing-ui, "Geist", sans-serif)';

export default function SpeakWithLocalSpecialist() {
  usePageMeta({
    title: 'Speak with a Local Specialist | BIQc',
    description: 'Tell us about your business and a BIQc specialist will contact you within 1 business hour.',
  });

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
              <HubspotEmbeddedForm testId="specialist-contact-form" />
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
