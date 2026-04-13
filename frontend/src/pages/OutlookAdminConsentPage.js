import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, AlertTriangle, Info, RefreshCw, Mail } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';

const OutlookAdminConsentPage = () => {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [copied, setCopied] = useState(false);

  const emailBody = `Hi [Admin Name],

I'm using BIQc (biqc.ai), a business intelligence platform, to help with decision-making and operational insights. I need to connect my Outlook email to enable email intelligence features.

Our Microsoft 365 tenant requires admin consent for this integration. BIQc only requests read-only access to my mailbox — it does not send emails or modify any data.

Could you please approve the connection by clicking this link:
https://login.microsoftonline.com/common/adminconsent?client_id=${process.env.REACT_APP_AZURE_CLIENT_ID || '[APP_CLIENT_ID]'}&redirect_uri=${process.env.REACT_APP_BACKEND_URL || 'https://biqc.ai'}/auth/callback

What BIQc accesses:
- Read-only access to my email (Mail.Read)
- My user profile (User.Read)
- No write, send, or delete permissions

Security information:
- Australian-hosted platform (Sydney data centres)
- AES-256 encryption at rest and in transit
- Compliant with Australian Privacy Principles
- SOC 2 Type II aligned
- More details: https://biqc.ai/trust

This should only take 30 seconds. Please let me know if you have any questions.

Thanks,
${user?.user_metadata?.full_name || '[Your Name]'}`;

  const copyEmail = () => {
    navigator.clipboard.writeText(`Subject: Admin Consent Request: BIQc Business Intelligence Platform\n\n${emailBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const steps = [
    { num: 1, title: 'Copy the email template below', desc: "We've prepared a ready-to-send email for your IT administrator. It explains what BIQc needs and includes the admin consent link." },
    { num: 2, title: 'Send it to your IT admin or Microsoft 365 administrator', desc: "This is usually someone in your IT department or the person who manages your company's Microsoft 365 tenant." },
    { num: 3, title: 'Your admin clicks the approval link', desc: 'They will review the permissions BIQc requires (read-only email access) and grant consent for your organisation. This takes about 30 seconds.' },
    { num: 4, title: 'Come back and connect', desc: 'Once your admin has approved, return to this page and click "Retry Connection" below. Your Outlook will connect successfully.' },
  ];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 0' }} className="animate-fade-in">
        {/* Page header */}
        <div className="mb-8">
          <div style={{ fontFamily: fontFamily?.mono, fontSize: 11, color: '#E85D00', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>— Email Setup · Admin Consent</div>
          <h1 style={{ fontFamily: fontFamily?.display, fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', color: 'var(--ink-display, #EDF1F7)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Your admin needs to <em style={{ fontStyle: 'italic', color: '#E85D00' }}>approve access</em>.</h1>
          <p style={{ color: 'var(--ink-secondary, #8FA0B8)', marginTop: 8, fontSize: 14 }}>Microsoft 365 enterprise policies require administrator consent before BIQc can read your email.</p>
        </div>

        {/* Warning Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', background: 'linear-gradient(135deg, rgba(217,119,6,0.08) 0%, rgba(217,119,6,0.02) 100%)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 16, marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#D97706', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)', marginBottom: 4 }}>Admin Approval Required</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.5 }}>Your organisation's Microsoft 365 policy requires an administrator to grant BIQc access to read your email. This is a common security setting for enterprise environments.</p>
          </div>
        </div>

        {/* Steps */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: fontFamily?.display, fontSize: 22, color: 'var(--ink-display, #EDF1F7)', letterSpacing: '-0.01em', marginBottom: 24 }}>How to Get Connected</h2>
          {steps.map(step => (
            <div key={step.num} style={{ display: 'flex', gap: 20, padding: '20px 24px', background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 16, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: '#E85D00', color: 'white', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{step.num}</div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)', marginBottom: 4 }}>{step.title}</h4>
                <p style={{ fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Email Template */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontFamily: fontFamily?.display, fontSize: 22, color: 'var(--ink-display, #EDF1F7)', letterSpacing: '-0.01em' }}>Email Template for Your Admin</h2>
            <button onClick={copyEmail} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--surface-sunken, #060A12)', border: '1px solid rgba(140,170,210,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 500, color: copied ? '#16A34A' : 'var(--ink, #CBD5E1)', cursor: 'pointer', borderColor: copied ? '#16A34A' : undefined }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
          <div style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
            {/* Email bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: 'var(--surface-sunken, #060A12)', borderBottom: '1px solid rgba(140,170,210,0.12)', fontSize: 12, color: 'var(--ink-muted, #708499)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#374151' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#374151' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#374151' }} />
              <span style={{ marginLeft: 8 }}>New Email</span>
            </div>
            {/* Fields */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(140,170,210,0.12)' }}>
              <div style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 14 }}>
                <span style={{ color: 'var(--ink-muted, #708499)', fontWeight: 500, minWidth: 56 }}>To:</span>
                <span style={{ color: 'var(--ink-muted, #708499)', fontStyle: 'italic' }}>[Your IT Administrator's email]</span>
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 14 }}>
                <span style={{ color: 'var(--ink-muted, #708499)', fontWeight: 500, minWidth: 56 }}>Subject:</span>
                <span style={{ color: 'var(--ink-display, #EDF1F7)', fontWeight: 600 }}>Admin Consent Request: BIQc Business Intelligence Platform</span>
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: 20, fontSize: 14, color: 'var(--ink, #CBD5E1)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: fontFamily?.body || 'Inter, sans-serif' }}>
              {emailBody}
            </div>
          </div>
        </div>

        {/* Help box */}
        <div style={{ display: 'flex', gap: 16, padding: '20px 24px', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 16, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#2563EB', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Info className="w-5 h-5" />
          </div>
          <div>
            <p style={{ fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ink-display, #EDF1F7)' }}>Not sure who your admin is?</strong> In most organisations, your IT team or the person who set up Microsoft 365 can grant this approval. You can also check by going to <strong>portal.office.com → Settings → Org settings</strong> in your Microsoft 365 account.
            </p>
            <p style={{ fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.6, marginTop: 12 }}>
              Need help? <span onClick={() => navigate('/contact')} style={{ color: '#2563EB', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}>Contact our support team</span> and we'll guide you through the process.
            </p>
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid rgba(140,170,210,0.12)' }}>
          <button onClick={() => navigate('/connect-email')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 20px', background: '#E85D00', color: 'white', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}>
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
          <button onClick={() => navigate('/connect-email')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 20px', background: 'var(--surface, #0E1628)', color: 'var(--ink, #CBD5E1)', borderRadius: 8, fontWeight: 600, fontSize: 14, border: '1px solid rgba(140,170,210,0.12)', cursor: 'pointer' }}>
            <Mail className="w-4 h-4" />
            Connect Gmail Instead
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OutlookAdminConsentPage;
