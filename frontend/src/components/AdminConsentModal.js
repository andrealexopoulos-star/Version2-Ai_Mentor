/**
 * AdminConsentModal — Full-screen overlay when Microsoft OAuth requires IT admin approval.
 *
 * Renders when ConnectEmail detects `outlook_error=admin_consent_required` in URL params.
 * Provides: request approval link, copy-to-clipboard email template, and skip option.
 *
 * Styling: Liquid Steel dark surface, lava orange CTA, steel-blue info cards.
 */
import React, { useState, useCallback } from 'react';
import { X, Shield, Copy, ExternalLink, ChevronDown, Check } from 'lucide-react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';

export default function AdminConsentModal({ adminConsentUrl, onClose }) {
  const { user } = useSupabaseAuth();
  const [copied, setCopied] = useState(false);
  const [showFaq, setShowFaq] = useState(false);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team Member';

  const emailTemplate = `Subject: Approval Request: BIQc Microsoft Integration

Hi,

I'm requesting approval to connect our Microsoft 365 account to BIQc, our business intelligence platform.

Key facts:
- Read-only access to calendar and email metadata (no write, no delete)
- OAuth 2.0 authentication (no passwords shared)
- Data encrypted in transit (TLS 1.3) and at rest (AES-256)
- No AI training on your organisation's data
- Access is fully revocable at any time from Azure AD

Admin consent URL:
${adminConsentUrl}

This is a one-time approval that allows our team to connect securely.

Thank you,
${userName}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(emailTemplate).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }, [emailTemplate]);

  const handleApproval = useCallback(() => {
    window.open(adminConsentUrl, '_blank', 'noopener,noreferrer');
  }, [adminConsentUrl]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(8, 12, 20, 0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--surface, #0E1628)',
          border: '1px solid var(--border, rgba(140,170,210,0.12))',
          boxShadow: 'var(--elev-4, 0 8px 32px rgba(0,0,0,0.9))',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <X size={18} style={{ color: 'var(--ink-muted, #708499)' }} />
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4"
            style={{ background: 'var(--lava-wash, rgba(232,93,0,0.12))' }}
          >
            <Shield size={28} style={{ color: 'var(--lava, #E85D00)' }} />
          </div>
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--ink-display, #EDF1F7)' }}
          >
            Organisation Approval Required
          </h2>
          <p style={{ color: 'var(--ink-secondary, #8FA0B8)', fontSize: '0.9375rem', lineHeight: '1.6' }}>
            Your IT administrator must approve BIQc before Microsoft 365 data can be connected.
            This is a standard security requirement for enterprise Microsoft tenants.
          </p>
        </div>

        {/* Info cards */}
        <div className="px-6 pb-4 space-y-2">
          {[
            { label: 'Read-only access', detail: 'No write or delete permissions' },
            { label: 'No passwords stored', detail: 'OAuth 2.0 secure authentication' },
            { label: 'No AI training', detail: 'Your data is never used for model training' },
            { label: 'Revocable at any time', detail: 'Remove from Azure AD admin portal' },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 px-4 py-3 rounded-lg"
              style={{ background: 'var(--surface-tint, #0E1628)' }}
            >
              <Check
                size={16}
                className="mt-0.5 shrink-0"
                style={{ color: 'var(--positive, #16A34A)' }}
              />
              <div>
                <div
                  className="text-sm font-medium"
                  style={{ color: 'var(--ink, #C8D4E4)' }}
                >
                  {item.label}
                </div>
                <div
                  className="text-xs"
                  style={{ color: 'var(--ink-muted, #708499)' }}
                >
                  {item.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-4 space-y-3">
          <button
            onClick={handleApproval}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:brightness-110"
            style={{
              background: 'var(--lava, #E85D00)',
              color: '#FFFFFF',
              boxShadow: '0 4px 16px rgba(232,93,0,0.3)',
            }}
          >
            <ExternalLink size={16} />
            Request IT Approval
          </button>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all hover:bg-white/5"
            style={{
              background: 'transparent',
              color: 'var(--ink, #C8D4E4)',
              border: '1px solid var(--border-strong, rgba(140,170,210,0.18))',
            }}
          >
            <Copy size={16} />
            {copied ? 'Copied to clipboard!' : 'Copy Email to IT Admin'}
          </button>

          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm transition-colors hover:underline"
            style={{ color: 'var(--ink-muted, #708499)' }}
          >
            Continue Without Microsoft
          </button>
        </div>

        {/* FAQ accordion */}
        <div className="px-6 pb-6">
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="flex items-center gap-2 text-xs font-medium transition-colors"
            style={{ color: 'var(--ink-muted, #708499)' }}
          >
            <ChevronDown
              size={14}
              className="transition-transform"
              style={{ transform: showFaq ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
            Learn more about permissions
          </button>
          {showFaq && (
            <div
              className="mt-3 p-4 rounded-lg text-xs leading-relaxed space-y-2"
              style={{
                background: 'var(--surface-sunken, #060A12)',
                color: 'var(--ink-secondary, #8FA0B8)',
              }}
            >
              <p><strong style={{ color: 'var(--ink, #C8D4E4)' }}>Why is admin consent required?</strong><br />
                Microsoft requires organisation-level approval for apps that access Microsoft 365 data.
                This is controlled by your Azure AD tenant policies.</p>
              <p><strong style={{ color: 'var(--ink, #C8D4E4)' }}>What permissions does BIQc request?</strong><br />
                Mail.Read, Calendars.Read, User.Read — all read-only. No write, delete, or send permissions.</p>
              <p><strong style={{ color: 'var(--ink, #C8D4E4)' }}>Can this be revoked?</strong><br />
                Yes. Your IT admin can remove BIQc from Azure AD → Enterprise Applications at any time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
