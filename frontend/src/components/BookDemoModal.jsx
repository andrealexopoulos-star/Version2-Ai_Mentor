import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import RecaptchaGate from './RecaptchaGate';
import { apiClient } from '../lib/api';

const SUCCESS_MESSAGE = 'Thanks — a BIQc advisor will contact you within 1 business hour.';
const FAILURE_MESSAGE = 'Something went wrong. Please try again.';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  background: 'rgba(10, 15, 25, 0.65)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const cardStyle = {
  width: '100%',
  maxWidth: 560,
  maxHeight: 'min(92vh, 780px)',
  overflowY: 'auto',
  background: '#0F1720',
  color: '#FFFFFF',
  border: '1px solid #334155',
  borderRadius: 12,
  boxShadow: '0 22px 56px rgba(2, 6, 23, 0.52)',
  position: 'relative',
};

const inputStyle = {
  width: '100%',
  background: '#1E293B',
  border: '1px solid #334155',
  color: '#FFFFFF',
  borderRadius: 8,
  height: 42,
  padding: '10px 12px',
  fontSize: 14,
  lineHeight: 1.2,
};

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  color: '#FFFFFF',
  fontWeight: 600,
};

const REQUIRED_FIELDS = ['firstname', 'lastname', 'email', 'message', 'urgency'];

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(String(value || '').trim());

export default function BookDemoModal({ isOpen, onClose, leadSource = 'demo_marketing' }) {
  const [form, setForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    message: '',
    urgency: 'ASAP within 1 business hour',
    preferred_time: '',
  });
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';

  const requiresPreferredTime = form.urgency === 'Schedule a time';

  const canSubmit = useMemo(() => {
    const hasRequired = REQUIRED_FIELDS.every((key) => String(form[key] || '').trim().length > 0);
    if (!hasRequired) return false;
    if (!isValidEmail(form.email)) return false;
    if (requiresPreferredTime && !String(form.preferred_time || '').trim()) return false;
    if (!recaptchaSiteKey || !captchaToken || captchaUnavailable) return false;
    return true;
  }, [captchaToken, captchaUnavailable, form, recaptchaSiteKey, requiresPreferredTime]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onEscape = (event) => {
      if (event.key === 'Escape' && !submitting) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onEscape);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onEscape);
    };
  }, [isOpen, onClose, submitting]);

  useEffect(() => {
    if (!isOpen) {
      setFeedback({ type: '', text: '' });
      setCaptchaToken('');
      setCaptchaUnavailable(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback({ type: '', text: '' });

    if (!canSubmit) {
      setFeedback({ type: 'error', text: FAILURE_MESSAGE });
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post('/hubspot/submit-lead', {
        firstname: String(form.firstname || '').trim(),
        lastname: String(form.lastname || '').trim(),
        email: String(form.email || '').trim(),
        phone: String(form.phone || '').trim(),
        message: String(form.message || '').trim(),
        urgency: String(form.urgency || '').trim(),
        preferred_time: String(form.preferred_time || '').trim(),
        biqc_lead_source: leadSource,
        captcha_token: captchaToken,
      });
      const ok = Boolean(response?.data?.success);
      if (!ok) {
        setFeedback({ type: 'error', text: FAILURE_MESSAGE });
        return;
      }
      setFeedback({ type: 'success', text: SUCCESS_MESSAGE });
      setForm({
        firstname: '',
        lastname: '',
        email: '',
        phone: '',
        message: '',
        urgency: 'ASAP within 1 business hour',
        preferred_time: '',
      });
      setCaptchaToken('');
    } catch (error) {
      console.error('[book-demo-submit-failed]', error);
      setFeedback({ type: 'error', text: FAILURE_MESSAGE });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-demo-title"
      onClick={submitting ? undefined : onClose}
      data-testid="book-demo-modal-overlay"
    >
      <div
        style={cardStyle}
        onClick={(event) => event.stopPropagation()}
        data-testid="book-demo-modal"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close book demo modal"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            border: 'none',
            background: 'transparent',
            color: '#FFFFFF',
            cursor: submitting ? 'not-allowed' : 'pointer',
            padding: 6,
            borderRadius: 8,
          }}
        >
          <X className="w-4 h-4" />
        </button>

        <div style={{ padding: '22px 20px 18px' }}>
          <h2 id="book-demo-title" style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
            Book a Demo
          </h2>
          <p style={{ fontSize: 13, color: '#CBD5E1', marginBottom: 16 }}>
            Book a 15-min call with BIQc.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="book-demo-firstname" style={labelStyle}>First name *</label>
                <input id="book-demo-firstname" type="text" value={form.firstname} onChange={(e) => handleChange('firstname', e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label htmlFor="book-demo-lastname" style={labelStyle}>Last name *</label>
                <input id="book-demo-lastname" type="text" value={form.lastname} onChange={(e) => handleChange('lastname', e.target.value)} required style={inputStyle} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label htmlFor="book-demo-email" style={labelStyle}>Email *</label>
                <input id="book-demo-email" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label htmlFor="book-demo-phone" style={labelStyle}>Phone</label>
                <input id="book-demo-phone" type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="book-demo-urgency" style={labelStyle}>Urgency *</label>
              <select
                id="book-demo-urgency"
                value={form.urgency}
                onChange={(e) => handleChange('urgency', e.target.value)}
                required
                style={inputStyle}
              >
                <option value="ASAP within 1 business hour">ASAP within 1 business hour</option>
                <option value="Schedule a time">Schedule a time</option>
              </select>
            </div>

            {requiresPreferredTime && (
              <div className="mt-3">
                <label htmlFor="book-demo-preferred-time" style={labelStyle}>Preferred time *</label>
                <input
                  id="book-demo-preferred-time"
                  type="datetime-local"
                  value={form.preferred_time}
                  onChange={(e) => handleChange('preferred_time', e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            )}

            <div className="mt-3">
              <label htmlFor="book-demo-message" style={labelStyle}>Message *</label>
              <textarea
                id="book-demo-message"
                rows={4}
                value={form.message}
                onChange={(e) => handleChange('message', e.target.value)}
                required
                style={{ ...inputStyle, minHeight: 104, resize: 'vertical', paddingTop: 10 }}
              />
            </div>

            <div className="mt-4">
              <RecaptchaGate
                onTokenChange={(token) => setCaptchaToken(token || '')}
                onStatusChange={({ status }) => setCaptchaUnavailable(status === 'error')}
                action="book_demo"
                testId="book-demo-recaptcha"
              />
            </div>

            {feedback.text && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: feedback.type === 'success' ? '#86EFAC' : '#FCA5A5',
                }}
                role="status"
              >
                {feedback.text}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              style={{
                marginTop: 14,
                width: '100%',
                height: 42,
                borderRadius: 8,
                border: 'none',
                background: '#3B82F6',
                color: '#FFFFFF',
                fontWeight: 700,
                cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
                opacity: !canSubmit || submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
