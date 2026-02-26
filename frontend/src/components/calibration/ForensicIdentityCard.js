import React, { useState, useMemo } from 'react';
import { CheckCircle2, Pencil, RefreshCw, XCircle, Globe, Building2, MapPin, Hash, Mail, Phone, Link2, Shield } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";

function computeIdentityConfidence(signals) {
  const reasons = [];
  let score = 0;

  reasons.push({ label: 'Domain scanned', positive: true });
  score++;

  if (signals.businessName) {
    reasons.push({ label: 'Business name detected', positive: true });
    score++;
  } else {
    reasons.push({ label: 'No business name found', positive: false });
  }

  if (signals.address || signals.geo) {
    reasons.push({ label: 'Address detected', positive: true });
    score++;
  } else {
    reasons.push({ label: 'No address found', positive: false });
  }

  if (signals.abn) {
    reasons.push({ label: 'ABN found', positive: true });
    score++;
  } else {
    reasons.push({ label: 'No ABN found', positive: false });
  }

  if (signals.socials && signals.socials.length > 0) {
    reasons.push({ label: `${signals.socials.length} social profile(s)`, positive: true });
    score++;
  } else {
    reasons.push({ label: 'No social profiles found', positive: false });
  }

  if (signals.emails && signals.emails.length > 0) {
    const domain = (signals.domain || '').replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const match = domain && signals.emails.some(e => e.includes(domain));
    if (match) {
      reasons.push({ label: 'Email matches domain', positive: true });
      score++;
    } else {
      reasons.push({ label: 'Email found (domain mismatch)', positive: true });
      score += 0.5;
    }
  } else {
    reasons.push({ label: 'No contact email found', positive: false });
  }

  const level = score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low';
  return { level, score, reasons };
}

export function parseIdentitySignals(extractedData, websiteUrl) {
  const d = extractedData || {};
  const allText = Object.values(d).filter(v => typeof v === 'string').join(' ');

  const phonePattern = /[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}/g;
  const phones = [...new Set((allText.match(phonePattern) || []))].slice(0, 3);

  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = [...new Set((allText.match(emailPattern) || []))].filter(e => !e.includes('example.com')).slice(0, 3);

  const abnPattern = /\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g;
  const abnMatches = allText.match(abnPattern) || [];
  const abn = abnMatches[0] || d.abn || d.ABN || '';

  const socialPatterns = {
    LinkedIn: /linkedin\.com\/(?:company|in)\/[^\s"')]+/gi,
    Facebook: /facebook\.com\/[^\s"')]+/gi,
    Instagram: /instagram\.com\/[^\s"')]+/gi,
    Twitter: /(?:twitter|x)\.com\/[^\s"')]+/gi,
  };
  const socials = [];
  for (const [platform, pattern] of Object.entries(socialPatterns)) {
    const matches = allText.match(pattern);
    if (matches) socials.push({ platform, url: matches[0] });
  }
  if (d.social_media_links && typeof d.social_media_links === 'object') {
    for (const [platform, url] of Object.entries(d.social_media_links)) {
      if (url && !socials.find(s => s.platform.toLowerCase() === platform.toLowerCase())) {
        socials.push({ platform, url });
      }
    }
  }

  const address = d.address || d.location || d.headquarters || d.office_address || '';
  const geo = d.geographic_focus || d.service_area || '';

  return {
    domain: websiteUrl,
    businessName: d.business_name || d.name || d.company || '',
    tradingName: d.trading_name || d.brand_name || '',
    address: typeof address === 'string' ? address : '',
    city: d.city || '',
    state: d.state || '',
    country: d.country || '',
    geo,
    abn,
    emails,
    phones,
    socials,
    whatYouDo: d.main_products_services || d.business_overview || d.description || d.about || '',
    whoYouServe: d.target_market || d.ideal_customer_profile || d.audience || '',
    aboutPageExists: !!(d.about || d.business_overview),
    contactPageExists: emails.length > 0 || phones.length > 0,
    caseStudiesDetected: !!(d.case_studies || d.testimonials),
  };
}

const SignalBlock = ({ icon: Icon, label, value, sub, warning, hint }) => (
  <div className="rounded-lg p-4" style={{ background: '#141C26', border: `1px solid ${warning ? '#F59E0B20' : '#243140'}` }}>
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className="w-3.5 h-3.5 text-[#3B82F6]" />
      <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: MONO }}>{label}</span>
    </div>
    <span className={`text-sm block ${warning ? 'text-[#4A5568]' : 'text-[#F4F7FA]'}`}>{value}</span>
    {sub && <span className="text-xs text-[#64748B] block mt-0.5">{sub}</span>}
    {hint && <span className="text-[11px] text-[#F59E0B] block mt-1" style={{ fontFamily: MONO }}>{hint}</span>}
  </div>
);

const ForensicIdentityCard = ({ identitySignals, websiteUrl, onConfirm, onRegenerate, onReject, isRegenerating }) => {
  const [mode, setMode] = useState('view');
  const [editFields, setEditFields] = useState({});
  const [rejectFields, setRejectFields] = useState({ legalName: '', suburb: '', abn: '' });

  const signals = useMemo(() => identitySignals || {}, [identitySignals]);
  const confidence = useMemo(() => computeIdentityConfidence(signals), [signals]);
  const confColor = confidence.level === 'High' ? '#10B981' : confidence.level === 'Medium' ? '#F59E0B' : '#EF4444';

  const handleConfirm = () => {
    if (confidence.level === 'Low') {
      if (!window.confirm('Identity confidence is Low. Are you sure this is your business? You may want to edit details or regenerate the scan for better accuracy.')) return;
    }
    onConfirm({ ...signals, ...editFields, confidence: confidence.level });
  };

  const handleRegenerate = () => {
    onRegenerate({ ...signals, ...editFields, ...rejectFields });
  };

  const handleRejectSubmit = () => {
    const { legalName, suburb, abn } = rejectFields;
    if (!legalName && !suburb && !abn) return;
    onReject({ ...rejectFields, editFields });
  };

  if (mode === 'edit') {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: '#0F1720' }} data-testid="identity-edit-mode">
        <div className="max-w-xl mx-auto px-4 sm:px-8 py-8 space-y-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Edit Business Details</h1>
            <p className="text-sm text-[#9FB0C3] mt-1">Correct any details below, then regenerate the scan.</p>
          </div>
          {[
            { key: 'businessName', label: 'Business Legal / Trading Name', val: editFields.businessName ?? signals.businessName },
            { key: 'address', label: 'Address / Suburb, State, Country', val: editFields.address ?? signals.address },
            { key: 'abn', label: 'ABN (optional)', val: editFields.abn ?? signals.abn },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: '#64748B', fontFamily: MONO }}>{f.label}</label>
              <input type="text" value={f.val || ''} onChange={e => setEditFields(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-[#F4F7FA] outline-none focus:ring-1 focus:ring-[#FF6A00]"
                style={{ background: '#141C26', border: '1px solid #243140' }} data-testid={`edit-${f.key}`} />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button onClick={handleRegenerate} disabled={isRegenerating}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: '#FF6A00' }} data-testid="edit-regenerate-btn">
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Scanning...' : 'Regenerate Scan'}
            </button>
            <button onClick={() => setMode('view')} className="px-6 py-3 rounded-xl text-sm transition-colors"
              style={{ color: '#9FB0C3', border: '1px solid #243140' }} data-testid="edit-cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'reject') {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: '#0F1720' }} data-testid="identity-reject-mode">
        <div className="max-w-xl mx-auto px-4 sm:px-8 py-8 space-y-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-semibold text-[#EF4444]" style={{ fontFamily: HEAD }}>Not Your Business</h1>
            <p className="text-sm text-[#9FB0C3] mt-1">Please provide at least one identifier so we can find the correct business.</p>
          </div>
          {[
            { key: 'legalName', label: 'Legal Business Name', ph: 'Your registered business name' },
            { key: 'suburb', label: 'Suburb / State / Country', ph: 'e.g. Sydney, NSW, Australia' },
            { key: 'abn', label: 'ABN (optional)', ph: '12 345 678 901' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: '#64748B', fontFamily: MONO }}>{f.label}</label>
              <input type="text" value={rejectFields[f.key]} onChange={e => setRejectFields(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.ph} className="w-full px-3 py-2.5 rounded-lg text-sm text-[#F4F7FA] placeholder:text-[#4A5568] outline-none focus:ring-1 focus:ring-[#FF6A00]"
                style={{ background: '#141C26', border: '1px solid #243140' }} data-testid={`reject-${f.key}`} />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button onClick={handleRejectSubmit}
              disabled={(!rejectFields.legalName && !rejectFields.suburb && !rejectFields.abn) || isRegenerating}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: '#FF6A00' }} data-testid="reject-regenerate-btn">
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Scanning...' : 'Search Again'}
            </button>
            <button onClick={() => setMode('view')} className="px-6 py-3 rounded-xl text-sm transition-colors"
              style={{ color: '#9FB0C3', border: '1px solid #243140' }} data-testid="reject-cancel-btn">Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#0F1720' }} data-testid="forensic-identity-card">
      <style>{`@keyframes idFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}`}</style>
      <div className="max-w-xl mx-auto px-4 sm:px-8 py-8 space-y-5">
        <div className="text-center" style={{ animation: 'idFade 0.5s ease-out' }}>
          <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#FF6A00', fontFamily: MONO }}>
            Identity Verification
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>
            Is this your business?
          </h1>
          <p className="text-sm text-[#9FB0C3]">
            Verify the details extracted from your domain before BIQc generates your footprint report.
          </p>
        </div>

        <div className="space-y-3" style={{ animation: 'idFade 0.7s ease-out' }}>
          <SignalBlock icon={Globe} label="Domain Provided" value={signals.domain || websiteUrl || 'Not provided'} />
          <SignalBlock icon={Building2} label="Business Name Detected"
            value={signals.businessName || 'Not found'}
            sub={signals.tradingName ? `Also known as: ${signals.tradingName}` : null}
            warning={!signals.businessName} />
          <SignalBlock icon={MapPin} label="Location Detected"
            value={signals.address || signals.geo || 'Not found'}
            sub={signals.city || signals.state ? `${signals.city}${signals.city && signals.state ? ', ' : ''}${signals.state}` : null}
            warning={!signals.address && !signals.geo} />
          <SignalBlock icon={Hash} label="ABN / ACN Detected"
            value={signals.abn || 'Not found'} warning={!signals.abn}
            hint={!signals.abn ? 'You can enter ABN manually to improve accuracy' : null} />

          <div className="rounded-lg p-4" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: MONO }}>Contact Signals</span>
            </div>
            <div className="space-y-1">
              {signals.emails?.length > 0 ? signals.emails.map((e, i) => (
                <span key={i} className="text-sm text-[#9FB0C3] block">{e}</span>
              )) : <span className="text-sm text-[#4A5568]">No email found</span>}
              {signals.phones?.length > 0 && signals.phones.map((p, i) => (
                <span key={i} className="text-sm text-[#9FB0C3] block flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-[#64748B]" />{p}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-4" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: MONO }}>Social Links</span>
            </div>
            {signals.socials?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {signals.socials.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full" style={{ color: '#9FB0C3', background: '#0F172050', border: '1px solid #243140', fontFamily: MONO }}>
                    {s.platform}
                  </span>
                ))}
              </div>
            ) : <span className="text-sm text-[#4A5568]">None found</span>}
          </div>

          <div className="rounded-lg p-4" style={{ background: confColor + '08', border: `1px solid ${confColor}25` }}>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5" style={{ color: confColor }} />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: MONO }}>Identity Confidence</span>
              <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ color: confColor, background: confColor + '15', fontFamily: MONO }}>
                {confidence.level}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {confidence.reasons.map((r, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{
                  color: r.positive ? '#10B981' : '#64748B',
                  background: r.positive ? '#10B98110' : '#24314050',
                  fontFamily: MONO,
                }}>
                  {r.positive ? '\u2713' : '\u2014'} {r.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {confidence.level === 'Low' && (
          <div className="rounded-lg p-4" style={{ background: '#EF444408', border: '1px solid #EF444425', animation: 'idFade 0.9s ease-out' }}>
            <p className="text-xs text-[#EF4444] leading-relaxed" style={{ fontFamily: MONO }}>
              Low confidence — please edit details or provide ABN to improve accuracy before proceeding.
            </p>
          </div>
        )}

        <div className="space-y-3 pt-2" style={{ animation: 'idFade 1s ease-out' }}>
          <button onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2"
            style={{ background: '#FF6A00' }} data-testid="identity-confirm-btn">
            <CheckCircle2 className="w-4 h-4" /> Yes — this is my business
          </button>
          <button onClick={() => setMode('edit')}
            className="w-full py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            style={{ color: '#9FB0C3', border: '1px solid #243140' }} data-testid="identity-edit-btn">
            <Pencil className="w-4 h-4" /> Edit details
          </button>
          <button onClick={handleRegenerate} disabled={isRegenerating}
            className="w-full py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ color: '#3B82F6', border: '1px solid #243140' }} data-testid="identity-regenerate-btn">
            <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Scanning...' : 'Regenerate scan'}
          </button>
          <button onClick={() => setMode('reject')}
            className="w-full py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            style={{ color: '#EF4444', border: '1px solid #EF444430' }} data-testid="identity-reject-btn">
            <XCircle className="w-4 h-4" /> Not my business
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForensicIdentityCard;
