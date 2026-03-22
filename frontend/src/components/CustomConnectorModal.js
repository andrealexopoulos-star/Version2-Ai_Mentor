import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { apiClient } from '../lib/api';
import { fontFamily } from '../design-system/tokens';

/**
 * Modal for Custom Connector contact support form.
 * Shown when user clicks "+ Custom connector" on Integrations/Connectors page.
 */
export default function CustomConnectorModal({ open, onClose }) {
  const [formData, setFormData] = useState({ name: '', email: '', details: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.name?.trim() || !formData.email?.trim() || !formData.details?.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/integrations/custom-connector-request', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        connector_details: formData.details.trim(),
      });
      setSubmitted(true);
      setFormData({ name: '', email: '', details: '' });
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to submit. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Request failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setFormData({ name: '', email: '', details: '' });
      setError('');
      setSubmitted(false);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" data-testid="custom-connector-modal-overlay">
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border p-6 shadow-2xl"
        style={{
          background: '#1A1A1A',
          borderColor: '#2D3E50',
        }}
        role="dialog"
        aria-labelledby="custom-connector-title"
        aria-describedby="custom-connector-desc"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="custom-connector-title" className="text-xl font-semibold" style={{ color: '#FFFFFF', fontFamily: fontFamily.display }}>
            Custom connector
          </h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: '#9E9E9E' }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p id="custom-connector-desc" className="text-sm mb-5" style={{ color: '#9E9E9E', fontFamily: fontFamily.body }}>
          Tell us about the platform or integration you need. Our team will review and contact you to discuss options.
        </p>

        {submitted ? (
          <div className="py-6 text-center" style={{ color: '#10B981', fontFamily: fontFamily.body }}>
            <p className="font-medium">Request received. We'll be in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="custom-connector-name" className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#9E9E9E', fontFamily: fontFamily.body }}>
                Your name
              </label>
              <input
                id="custom-connector-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#0F0F0F', border: '1px solid #2D3E50', color: '#FFFFFF', fontFamily: fontFamily.body }}
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="custom-connector-email" className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#9E9E9E', fontFamily: fontFamily.body }}>
                Email
              </label>
              <input
                id="custom-connector-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#0F0F0F', border: '1px solid #2D3E50', color: '#FFFFFF', fontFamily: fontFamily.body }}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="custom-connector-details" className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#9E9E9E', fontFamily: fontFamily.body }}>
                What connector or features do you need?
              </label>
              <textarea
                id="custom-connector-details"
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="Describe the platform, API type (REST/GraphQL), and what data or actions you want to integrate."
                required
                rows={4}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: '#0F0F0F', border: '1px solid #2D3E50', color: '#FFFFFF', fontFamily: fontFamily.body }}
              />
            </div>
            {error && (
              <p className="text-sm" style={{ color: '#F87171', fontFamily: fontFamily.body }} role="alert">{error}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'transparent', border: '1px solid #2D3E50', color: '#9E9E9E', fontFamily: fontFamily.body }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                style={{ background: '#10B981', color: '#FFFFFF', fontFamily: fontFamily.body }}
                data-testid="custom-connector-submit"
              >
                {submitting ? 'Submitting...' : <>Submit <Send className="w-4 h-4" /></>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
