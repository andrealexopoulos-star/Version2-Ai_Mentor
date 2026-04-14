import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, AlertTriangle, Info, RefreshCw, Mail } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--lava)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', marginBottom: 8 }}>— Email Setup · Admin Consent</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-display)', lineHeight: 1.05 }}>Your admin needs to <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>approve access</em>.</h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: 8, fontSize: 14 }}>Microsoft 365 enterprise policies require administrator consent before BIQc can read your email.</p>
        </div>

        {/* Warning Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', background: 'var(--warning-wash)', border: '1px solid var(--warning)', borderRadius: 'var(--r-lg)', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--warning)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-display)', marginBottom: 4 }}>Admin Approval Required</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>Your organisation's Microsoft 365 policy requires an administrator to grant BIQc access to read your email. This is a common security setting for enterprise environments.</p>
          </div>
        </div>

        {/* Steps */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-display)', letterSpacing: 'var(--ls-display)', marginBottom: 24 }}>How to Get Connected</h2>
          {steps.map(step => (
            <div key={step.num} style={{ display: 'flex', gap: 20, padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-pill)', background: 'var(--lava)', color: 'white', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{step.num}</div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-display)', marginBottom: 4 }}>{step.title}</h4>
                <p style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Email Template */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-display)', letterSpacing: 'var(--ls-display)' }}>Email Template for Your Admin</h2>
            <button onClick={copyEmail} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--surface-sunken)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 500, color: copied ? 'var(--positive)' : 'var(--ink)', cursor: 'pointer', borderColor: copied ? 'var(--positive)' : undefined }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--elev-1)' }}>
            {/* Email bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-muted)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-subtle)' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-subtle)' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-subtle)' }} />
              <span style={{ marginLeft: 8 }}>New Email</span>
            </div>
            {/* Fields */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 14 }}>
                <span style={{ color: 'var(--ink-muted)', fontWeight: 500, minWidth: 56 }}>To:</span>
                <span style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>[Your IT Administrator's email]</span>
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 14 }}>
                <span style={{ color: 'var(--ink-muted)', fontWeight: 500, minWidth: 56 }}>Subject:</span>
                <span style={{ color: 'var(--ink-display)', fontWeight: 600 }}>Admin Consent Request: BIQc Business Intelligence Platform</span>
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: 20, fontSize: 14, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-ui)' }}>
              {emailBody}
            </div>
          </div>
        </div>

        {/* Help box */}
        <div style={{ display: 'flex', gap: 16, padding: '20px 24px', background: 'var(--info-wash)', border: '1px solid var(--info)', borderRadius: 'var(--r-lg)', marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--info)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Info className="w-5 h-5" />
          </div>
          <div>
            <p style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ink-display)' }}>Not sure who your admin is?</strong> In most organisations, your IT team or the person who set up Microsoft 365 can grant this approval. You can also check by going to <strong>portal.office.com → Settings → Org settings</strong> in your Microsoft 365 account.
            </p>
            <p style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.6, marginTop: 12 }}>
              Need help? <span onClick={() => navigate('/contact')} style={{ color: 'var(--info)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}>Contact our support team</span> and we'll guide you through the process.
            </p>
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button onClick={() => navigate('/connect-email')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 20px', background: 'var(--lava)', color: 'white', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}>
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
          <button onClick={() => navigate('/connect-email')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 20px', background: 'var(--surface)', color: 'var(--ink)', borderRadius: 8, fontWeight: 600, fontSize: 14, border: '1px solid var(--border)', cursor: 'pointer' }}>
            <Mail className="w-4 h-4" />
            Connect Gmail Instead
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OutlookAdminConsentPage;
