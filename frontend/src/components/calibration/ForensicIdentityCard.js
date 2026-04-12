import React, { useState, useMemo } from 'react';
import { CheckCircle2, Pencil, RefreshCw, XCircle, Globe, Building2, MapPin, Hash, Mail, Phone, Shield } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


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

  const level = score >= 3 ? 'High' : score >= 2 ? 'Medium' : 'Low';
  return { level, score, reasons };
}

export function parseIdentitySignals(extractedData, websiteUrl) {
  const d = extractedData || {};
  const scanSummary = (d.website_scan_summary && typeof d.website_scan_summary === 'object') ? d.website_scan_summary : {};
  const allText = Object.values(d).filter(v => typeof v === 'string').join(' ');

  const phonePattern = /[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}/g;
  const phones = [...new Set((allText.match(phonePattern) || []))].slice(0, 3);

  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = [
    ...new Set([
      ...(allText.match(emailPattern) || []),
      ...((Array.isArray(scanSummary.contact_emails_detected) ? scanSummary.contact_emails_detected : [])),
    ]),
  ].filter(e => !String(e).includes('example.com')).slice(0, 8);

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

  const address = d.address || d.location || d.headquarters || d.office_address || ((Array.isArray(scanSummary.locations_detected) && scanSummary.locations_detected[0]) || '');
  const geo = d.geographic_focus || d.service_area || (Array.isArray(scanSummary.locations_detected) ? scanSummary.locations_detected.join(', ') : '');

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
  <div className="rounded-lg p-4" style={{ background: 'var(--biqc-bg-card)', border: `1px solid ${warning ? '#F59E0B20' : 'rgba(140,170,210,0.15)'}` }}>
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className="w-3.5 h-3.5 text-[#3B82F6]" />
      <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{label}</span>
    </div>
    <span className={`text-sm block ${warning ? 'text-[#64748B]' : 'text-[#EDF1F7]'}`}>{value}</span>
    {sub && <span className="text-xs text-[#64748B] block mt-0.5">{sub}</span>}
    {hint && <span className="text-[11px] text-[#F59E0B] block mt-1" style={{ fontFamily: fontFamily.mono }}>{hint}</span>}
  </div>
);

const ForensicIdentityCard = ({ identitySignals, websiteUrl, onConfirm, onRegenerate, onReject, isRegenerating, onAbnLookup }) => {
  const [mode, setMode] = useState('view');
  const [editFields, setEditFields] = useState({});
  const [rejectFields, setRejectFields] = useState({ legalName: '', suburb: '', abn: '' });
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);

  const signals = useMemo(() => identitySignals || {}, [identitySignals]);
  const confidence = useMemo(() => computeIdentityConfidence(signals), [signals]);
  const confColor = confidence.level === 'High' ? '#10B981' : confidence.level === 'Medium' ? '#F59E0B' : '#EF4444';

  const [showLowConfirmWarning, setShowLowConfirmWarning] = useState(false);

  const handleConfirm = () => {
    if (confidence.level === 'Low' && !showLowConfirmWarning) {
      setShowLowConfirmWarning(true);
      return;
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

  const handleAbnLookupClick = async () => {
    if (!onAbnLookup || lookingUp) return;
    setLookingUp(true);
    setLookupResult(null);
    const result = await onAbnLookup({
      business_name_hint: signals.businessName || editFields.businessName || '',
      location_hint: signals.address || signals.geo || editFields.address || '',
      abn: signals.abn || editFields.abn || '',
      domain: signals.domain || websiteUrl || '',
    });
    setLookupResult(result);
    setLookingUp(false);
  };

  if (mode === 'edit') {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--biqc-bg)' }} data-testid="identity-edit-mode">
        <div className="max-w-xl mx-auto px-4 sm:px-8 py-8 space-y-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Edit Business Details</h1>
            <p className="text-sm text-[#9FB0C3] mt-1">Correct any details below, then regenerate the scan.</p>
          </div>
          {[
            { key: 'businessName', label: 'Business Legal / Trading Name', val: editFields.businessName ?? signals.businessName },
            { key: 'address', label: 'Address / Suburb, State, Country', val: editFields.address ?? signals.address },
            { key: 'abn', label: 'ABN (optional)', val: editFields.abn ?? signals.abn },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{f.label}</label>
              <input type="text" value={f.val || ''} onChange={e => setEditFields(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-[#EDF1F7] outline-none focus:ring-1 focus:ring-[#E85D00]"
                style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid={`edit-${f.key}`} />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button onClick={handleRegenerate} disabled={isRegenerating}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: '#E85D00' }} data-testid="edit-regenerate-btn">
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Scanning...' : 'Regenerate Scan'}
            </button>
            <button onClick={() => setMode('view')} className="px-6 py-3 rounded-xl text-sm transition-colors"
              style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)' }} data-testid="edit-cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'reject') {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--biqc-bg)' }} data-testid="identity-reject-mode">
        <div className="max-w-xl mx-auto px-4 sm:px-8 py-8 space-y-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-semibold text-[#EF4444]" style={{ fontFamily: fontFamily.display }}>Not Your Business</h1>
            <p className="text-sm text-[#9FB0C3] mt-1">Please provide at least one identifier so we can find the correct business.</p>
          </div>
          {[
            { key: 'legalName', label: 'Legal Business Name', ph: 'Your registered business name' },
            { key: 'suburb', label: 'Suburb / State / Country', ph: 'e.g. Sydney, NSW, Australia' },
            { key: 'abn', label: 'ABN (optional)', ph: '12 345 678 901' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{f.label}</label>
              <input type="text" value={rejectFields[f.key]} onChange={e => setRejectFields(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.ph} className="w-full px-3 py-2.5 rounded-lg text-sm text-[#EDF1F7] placeholder:text-[#64748B] outline-none focus:ring-1 focus:ring-[#E85D00]"
                style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid={`reject-${f.key}`} />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button onClick={handleRejectSubmit}
              disabled={(!rejectFields.legalName && !rejectFields.suburb && !rejectFields.abn) || isRegenerating}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: '#E85D00' }} data-testid="reject-regenerate-btn">
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Scanning...' : 'Search Again'}
            </button>
            <button onClick={() => setMode('view')} className="px-6 py-3 rounded-xl text-sm transition-colors"
              style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)' }} data-testid="reject-cancel-btn">Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--biqc-bg)' }} data-testid="forensic-identity-card">
      <style>{`@keyframes idFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}`}</style>
      <div className="max-w-xl mx-auto px-4 sm:px-8 py-8 space-y-5">
        <div className="text-center" style={{ animation: 'idFade 0.5s ease-out' }}>
          <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>
            Identity Verification
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>
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

          <div className="rounded-lg p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Contact Signals</span>
            </div>
            <div className="space-y-1">
              {signals.emails?.length > 0 ? signals.emails.map((e, i) => (
                <span key={i} className="text-sm text-[#9FB0C3] block">{e}</span>
              )) : <span className="text-sm text-[#64748B]">No email found</span>}
              {signals.phones?.length > 0 && signals.phones.map((p, i) => (
                <span key={i} className="text-sm text-[#9FB0C3] block flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-[#64748B]" />{p}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-4" style={{ background: confColor + '08', border: `1px solid ${confColor}25` }}>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5" style={{ color: confColor }} />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Identity Confidence</span>
              <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ color: confColor, background: confColor + '15', fontFamily: fontFamily.mono }}>
                {confidence.level}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {confidence.reasons.map((r, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{
                  color: r.positive ? '#10B981' : '#64748B',
                  background: r.positive ? '#10B98110' : 'rgba(140,170,210,0.15)50',
                  fontFamily: fontFamily.mono,
                }}>
                  {r.positive ? '\u2713' : '\u2014'} {r.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {confidence.level === 'Low' && (
          <div className="rounded-lg p-4" style={{ background: '#EF444408', border: '1px solid #EF444425', animation: 'idFade 0.9s ease-out' }}>
            <p className="text-xs text-[#EF4444] leading-relaxed" style={{ fontFamily: fontFamily.mono }}>
              Low confidence — please edit details or provide ABN to improve accuracy before proceeding.
            </p>
          </div>
        )}

        {/* ABN Registry Lookup — available when confidence needs improvement */}
        {onAbnLookup && (confidence.level === 'Low' || confidence.level === 'Medium') && (
          <div className="rounded-lg p-4" style={{ background: '#3B82F608', border: '1px solid #3B82F625', animation: 'idFade 0.95s ease-out' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#3B82F6] font-semibold mb-1" style={{ fontFamily: fontFamily.mono }}>ABN Registry Lookup</p>
                <p className="text-[11px] text-[#64748B]">Search the Australian Business Register to verify identity</p>
              </div>
              <button onClick={handleAbnLookupClick} disabled={lookingUp}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5"
                style={{ color: '#3B82F6', background: '#3B82F615', border: '1px solid #3B82F630' }}
                data-testid="abn-lookup-btn">
                {lookingUp ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Hash className="w-3 h-3" />}
                {lookingUp ? 'Searching...' : 'Search ABR'}
              </button>
            </div>
            {lookupResult && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(140,170,210,0.15)50' }}>
                {lookupResult.status === 'found' && (
                  <div className="space-y-1">
                    <p className="text-xs text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>Match found in Australian Business Register</p>
                    {lookupResult.legal_name && <p className="text-sm text-[#EDF1F7]">Legal name: {lookupResult.legal_name}</p>}
                    {lookupResult.abn && <p className="text-sm text-[#9FB0C3]">ABN: {lookupResult.abn}</p>}
                    {lookupResult.address && <p className="text-sm text-[#9FB0C3]">Location: {lookupResult.address}</p>}
                  </div>
                )}
                {lookupResult.status === 'ambiguous' && lookupResult.suggestions?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-[#F59E0B]" style={{ fontFamily: fontFamily.mono }}>Multiple matches — review below</p>
                    {lookupResult.suggestions.slice(0, 3).map((s, i) => (
                      <p key={i} className="text-[11px] text-[#9FB0C3]">{s.name} (ABN: {s.abn}) — {s.state}</p>
                    ))}
                  </div>
                )}
                {lookupResult.status === 'not_found' && (
                  <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{lookupResult.match_reason || 'No match found'}</p>
                )}
                {lookupResult.status === 'unavailable' && (
                  <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{lookupResult.message}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 pt-2" style={{ animation: 'idFade 1s ease-out' }}>
          {showLowConfirmWarning && (
            <div className="rounded-xl p-3 mb-1" style={{ background: '#EF444415', border: '1px solid #EF444440' }} data-testid="low-confidence-warning">
              <p className="text-xs text-[#EF4444] mb-2">Confidence is Low — are you sure this is your business? You may want to edit details or regenerate for better accuracy.</p>
              <div className="flex gap-2">
                <button onClick={() => onConfirm({ ...signals, ...editFields, confidence: confidence.level })}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: '#EF4444' }} data-testid="low-confirm-yes-btn">
                  Yes, continue anyway
                </button>
                <button onClick={() => setShowLowConfirmWarning(false)}
                  className="flex-1 py-2 rounded-lg text-xs" style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)' }} data-testid="low-confirm-cancel-btn">
                  Cancel
                </button>
              </div>
            </div>
          )}
          <button onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2"
            style={{ background: '#E85D00' }} data-testid="identity-confirm-btn">
            <CheckCircle2 className="w-4 h-4" /> Yes — this is my business
          </button>
          <button onClick={() => setMode('edit')}
            className="w-full py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)' }} data-testid="identity-edit-btn">
            <Pencil className="w-4 h-4" /> Edit details
          </button>
          <button onClick={handleRegenerate} disabled={isRegenerating}
            className="w-full py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ color: '#3B82F6', border: '1px solid var(--biqc-border)' }} data-testid="identity-regenerate-btn">
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
