import { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Video, RefreshCw } from 'lucide-react';
import { supabase } from '../context/SupabaseAuthContext';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const MONO = "var(--font-mono)";
const HEAD = "var(--font-heading)";
const BODY = "var(--font-body)";

const callCheckin = async (action, extra = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/checkin-manager`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ action, ...extra }),
  });
  if (!res.ok) return null;
  return res.json();
};

export const CheckInAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [showScheduler, setShowScheduler] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await callCheckin('pending');
      if (data) setAlerts(data.alerts || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10 * 60 * 1000); // check every 10 min
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleSchedule = async () => {
    if (!selectedDate || !showScheduler) return;
    setSubmitting(true);
    try {
      const scheduledFor = `${selectedDate}T${selectedTime}:00+11:00`; // AEST
      await apiClient.post('/checkins/schedule', {
        type: showScheduler,
        scheduled_for: scheduledFor,
      });
      setShowScheduler(null);
      setSelectedDate('');
      fetchAlerts();
    } catch {
      // handle error
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async (type) => {
    try {
      await apiClient.post('/checkins/dismiss');
      setAlerts(prev => prev.filter(a => a.type !== type));
    } catch {
      setAlerts(prev => prev.filter(a => a.type !== type));
    }
  };

  if (alerts.length === 0) return null;

  // Generate date options (next 14 days)
  const dateOptions = [];
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dayName = d.toLocaleDateString('en-AU', { weekday: 'short' });
    const dateStr = d.toISOString().split('T')[0];
    const display = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
    dateOptions.push({ value: dateStr, label: display, day: dayName });
  }

  const timeSlots = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

  return (
    <div className="space-y-3 mb-6" data-testid="checkin-alerts">
      {alerts.map((alert, i) => (
        <div key={i} className="rounded-2xl p-4 flex items-start gap-3" style={{
          background: alert.severity === 'high' ? '#FEF2F2' : alert.severity === 'medium' ? '#FFFBEB' : '#F0F9FF',
          border: `1px solid ${alert.severity === 'high' ? '#FECACA' : alert.severity === 'medium' ? '#FDE68A' : '#BAE6FD'}`,
        }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
            background: alert.type === 'recalibration' ? '#F9731615' : '#7C3AED15',
          }}>
            {alert.type === 'recalibration' ? <RefreshCw className="w-4 h-4" style={{ color: '#F97316' }} /> : <Video className="w-4 h-4" style={{ color: '#7C3AED' }} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: '#1F2937', fontFamily: HEAD }}>{alert.title}</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#6B7280', fontFamily: BODY }}>{alert.message}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => {
                if (alert.type === 'recalibration') {
                  window.location.href = '/calibration';
                } else {
                  setShowScheduler(alert.type);
                }
              }} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5" style={{
                background: alert.type === 'recalibration' ? '#F97316' : '#7C3AED',
                color: 'white',
                fontFamily: MONO,
              }} data-testid={`checkin-action-${alert.type}`}>
                {alert.type === 'recalibration' ? 'Recalibrate Now' : 'Schedule Check-In'}
              </button>
              <button onClick={() => setShowScheduler(alert.type)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all hover:-translate-y-0.5" style={{
                color: '#6B7280',
                borderColor: 'rgba(0,0,0,0.1)',
                fontFamily: MONO,
              }} data-testid={`checkin-schedule-${alert.type}`}>
                <Calendar className="w-3 h-3 inline mr-1" />
                Pick a Date
              </button>
              <button onClick={() => handleDismiss(alert.type)} className="text-[11px] px-2 py-1.5 rounded-lg transition-colors hover:bg-gray-100" style={{ color: '#9CA3AF' }} data-testid={`checkin-dismiss-${alert.type}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Scheduler Modal */}
      {showScheduler && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" data-testid="scheduler-modal">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowScheduler(null)} />
          <div className="relative w-[90%] max-w-md rounded-2xl shadow-2xl p-6" style={{ background: 'white' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ fontFamily: HEAD, color: '#1F2937' }}>
                {showScheduler === 'recalibration' ? 'Schedule Recalibration' : 'Schedule Video Check-In'}
              </h3>
              <button onClick={() => setShowScheduler(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" style={{ color: '#9CA3AF' }} />
              </button>
            </div>

            <p className="text-sm mb-4" style={{ color: '#6B7280', fontFamily: BODY }}>
              {showScheduler === 'recalibration'
                ? 'Choose a date and time to update your business profile and recalibrate BIQc.'
                : 'Choose a date and time for a video check-in with your BIQc advisor.'}
            </p>

            {/* Date Selection */}
            <div className="mb-4">
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>Select Date</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {dateOptions.map((d) => (
                  <button key={d.value} onClick={() => setSelectedDate(d.value)}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: selectedDate === d.value ? '#0F172A' : 'white',
                      color: selectedDate === d.value ? 'white' : '#374151',
                      border: `1px solid ${selectedDate === d.value ? '#0F172A' : 'rgba(0,0,0,0.1)'}`,
                      fontFamily: MONO,
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selection */}
            <div className="mb-6">
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>Select Time (AEST)</label>
              <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                {timeSlots.map((t) => (
                  <button key={t} onClick={() => setSelectedTime(t)}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: selectedTime === t ? '#F97316' : 'white',
                      color: selectedTime === t ? 'white' : '#374151',
                      border: `1px solid ${selectedTime === t ? '#F97316' : 'rgba(0,0,0,0.1)'}`,
                      fontFamily: MONO,
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleSchedule} disabled={!selectedDate || submitting}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: '#0F172A', fontFamily: HEAD }}
              data-testid="schedule-confirm">
              {submitting ? 'Scheduling...' : `Schedule for ${selectedDate ? new Date(selectedDate).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : '...'} at ${selectedTime}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
