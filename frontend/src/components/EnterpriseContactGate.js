import React, { useState } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier, hasAccess } from '../lib/tierResolver';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { Lock, ArrowRight, Calendar, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const TIMES = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM',
  '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM'
];

const DAYS_AHEAD = 14;

function getAvailableDates() {
  const dates = [];
  const d = new Date();
  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    const dow = next.getDay();
    if (dow !== 0 && dow !== 6) dates.push(next);
  }
  return dates;
}

export default function EnterpriseContactGate({ children, featureName = 'This feature' }) {
  // All gates removed — full platform access for all users
  return children;
}

  const fullName = user?.user_metadata?.full_name || user?.full_name || '';
  const email = user?.email || '';
  const businessName = user?.company_name || user?.user_metadata?.company_name || '';

  const [form, setForm] = useState({
    name: fullName,
    business: businessName,
    email: email,
    phone: '',
    selectedDate: '',
    selectedTime: '',
    description: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCal, setShowCal] = useState(false);

  // Allow enterprise+ users through (hooks must be called BEFORE any early return)
  if (hasAccess(tier, 'enterprise')) return children;

  const dates = getAvailableDates();

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.description || !form.selectedDate || !form.selectedTime) {
      toast.error('Please complete all required fields');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/enterprise/contact-request', {
        name: form.name,
        business_name: form.business,
        email: form.email,
        phone: form.phone,
        callback_date: form.selectedDate,
        callback_time: form.selectedTime,
        description: form.description,
        feature_requested: featureName,
        user_id: user?.id,
        current_tier: tier,
      });
      setSubmitted(true);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: '#10B98115', border: '1px solid #10B98130' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: '#10B981' }} />
          </div>
          <h2 className="text-3xl font-normal mb-3" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>Request received.</h2>
          <p className="text-sm leading-relaxed mb-2" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
            Your callback has been scheduled for <strong style={{ color: '#F4F7FA' }}>{form.selectedDate} at {form.selectedTime}</strong>.
          </p>
          <p className="text-sm" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
            A member of our team will reach out at <strong style={{ color: '#F4F7FA' }}>{form.email}</strong> to confirm.
          </p>
          <div className="mt-6 p-4 rounded-xl" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <p className="text-[11px] tracking-widest uppercase mb-1" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>What happens next</p>
            <p className="text-xs" style={{ color: '#64748B', fontFamily: fontFamily.body }}>Our strategic intelligence team will review your requirements and prepare a tailored demonstration of {featureName}.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FF6A0015', border: '1px solid #FF6A0030' }}>
          <Lock className="w-5 h-5" style={{ color: '#FF6A00' }} />
        </div>
        <div>
          <h1 className="text-2xl font-normal" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>{featureName}</h1>
          <p className="text-sm" style={{ color: '#64748B', fontFamily: fontFamily.body }}>Available on Growth and Enterprise plans. Request access below.</p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: '#FF6A0015', color: '#FF6A00', fontFamily: fontFamily.mono }}>ENTERPRISE</span>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-2xl p-6 space-y-5" style={{ background: '#141C26', border: '1px solid #243140' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>Request a Callback</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider block mb-1.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Full Name *</label>
            <input value={form.name} onChange={e => update('name', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1720', border: '1px solid #243140', color: '#F4F7FA', fontFamily: fontFamily.body }}
              placeholder="Your full name" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider block mb-1.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Business Name</label>
            <input value={form.business} onChange={e => update('business', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1720', border: '1px solid #243140', color: '#F4F7FA', fontFamily: fontFamily.body }}
              placeholder="Your business name" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider block mb-1.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Email Address *</label>
            <input value={form.email} onChange={e => update('email', e.target.value)} type="email"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1720', border: '1px solid #243140', color: '#F4F7FA', fontFamily: fontFamily.body }}
              placeholder="your@email.com" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider block mb-1.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Mobile / Phone</label>
            <input value={form.phone} onChange={e => update('phone', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1720', border: '1px solid #243140', color: '#F4F7FA', fontFamily: fontFamily.body }}
              placeholder="+61 4XX XXX XXX" />
          </div>
        </div>

        {/* Callback Calendar */}
        <div>
          <label className="text-[11px] uppercase tracking-wider block mb-1.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
            <Calendar className="w-3 h-3 inline mr-1.5 -mt-0.5" />Preferred Callback Time *
          </label>
          <button onClick={() => setShowCal(!showCal)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left"
            style={{ background: '#0F1720', border: `1px solid ${form.selectedDate ? '#FF6A0040' : '#243140'}`, color: form.selectedDate ? '#F4F7FA' : '#64748B', fontFamily: fontFamily.body }}>
            <span>{form.selectedDate && form.selectedTime ? `${form.selectedDate} at ${form.selectedTime}` : 'Select a date and time'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showCal ? 'rotate-180' : ''}`} />
          </button>
          {showCal && (
            <div className="mt-2 rounded-xl p-4" style={{ background: '#0F1720', border: '1px solid #243140' }}>
              {/* Date picker */}
              <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Select Date</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                {dates.map(d => {
                  const dateStr = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
                  const isSelected = form.selectedDate === dateStr;
                  return (
                    <button key={dateStr} onClick={() => update('selectedDate', dateStr)}
                      className="px-2 py-2 rounded-lg text-center transition-all"
                      style={{
                        background: isSelected ? '#FF6A00' : '#141C26',
                        border: `1px solid ${isSelected ? '#FF6A00' : '#243140'}`,
                        color: isSelected ? 'white' : '#9FB0C3',
                        fontFamily: fontFamily.mono, fontSize: '10px'
                      }}>
                      {dateStr}
                    </button>
                  );
                })}
              </div>
              {/* Time picker */}
              <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Select Time (AEST)</p>
              <div className="grid grid-cols-4 gap-2">
                {TIMES.map(t => {
                  const isSelected = form.selectedTime === t;
                  return (
                    <button key={t} onClick={() => { update('selectedTime', t); setShowCal(false); }}
                      className="px-2 py-1.5 rounded-lg text-center transition-all"
                      style={{
                        background: isSelected ? '#FF6A00' : '#141C26',
                        border: `1px solid ${isSelected ? '#FF6A00' : '#243140'}`,
                        color: isSelected ? 'white' : '#9FB0C3',
                        fontFamily: fontFamily.mono, fontSize: '10px'
                      }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Problem Description */}
        <div>
          <label className="text-[11px] uppercase tracking-wider block mb-1.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>What intelligence are you looking for? *</label>
          <p className="text-[11px] mb-2" style={{ color: '#64748B', fontFamily: fontFamily.body }}>Briefly describe what you want to achieve and the problem you're trying to solve.</p>
          <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={4}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
            style={{ background: '#0F1720', border: '1px solid #243140', color: '#F4F7FA', fontFamily: fontFamily.body }}
            placeholder="e.g. I want to understand why our revenue pipeline is stalling and identify the key risk factors before our next board meeting..." />
          <p className="text-[10px] mt-1 text-right" style={{ color: form.description.length > 500 ? '#EF4444' : '#64748B', fontFamily: fontFamily.mono }}>
            {form.description.length}/500
          </p>
        </div>

        <button onClick={handleSubmit} disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: '#FF6A00', color: 'white', fontFamily: fontFamily.body }}
          data-testid="enterprise-contact-submit">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Request Callback</span><ArrowRight className="w-4 h-4" /></>}
        </button>
        <p className="text-[10px] text-center" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
          Response within 1 business day · No commitment required
        </p>
      </div>
    </div>
  );
}
