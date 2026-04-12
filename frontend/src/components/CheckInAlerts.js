import { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Video, RefreshCw } from 'lucide-react';
import { supabase } from '../context/SupabaseAuthContext';
import { callEdgeFunction } from '../lib/api';
import { fontFamily } from '../design-system/tokens';

const callCheckin = async (action, extra = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return await callEdgeFunction('checkin-manager', { action, ...extra });
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

    // Supabase Realtime — listen for calibration schedule changes
    let channel;
    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      channel = supabase
        .channel('checkin-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'calibration_schedules',
          filter: `user_id=eq.${session.user.id}`,
        }, () => {
          fetchAlerts();
        })
        .subscribe();
    };
    setup();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  const handleSchedule = async () => {
    if (!selectedDate || !showScheduler) return;
    setSubmitting(true);
    try {
      const scheduledFor = `${selectedDate}T${selectedTime}:00+11:00`;
      await callCheckin('schedule', { type: showScheduler, scheduled_for: scheduledFor });
      setShowScheduler(null);
      setSelectedDate('');
      fetchAlerts();
    } catch {} finally { setSubmitting(false); }
  };

  const handleDismiss = async (type) => {
    try {
      await callCheckin('dismiss');
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
          background: alert.severity === 'high' ? '#EF444410' : alert.severity === 'medium' ? '#F59E0B10' : '#3B82F610',
          border: `1px solid ${alert.severity === 'high' ? '#EF444425' : alert.severity === 'medium' ? '#F59E0B25' : '#3B82F625'}`,
        }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
            background: alert.type === 'recalibration' ? '#E85D0015' : '#7C3AED15',
          }}>
            {alert.type === 'recalibration' ? <RefreshCw className="w-4 h-4" style={{ color: '#E85D00' }} /> : <Video className="w-4 h-4" style={{ color: '#7C3AED' }} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{alert.title}</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>{alert.message}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => {
                if (alert.type === 'recalibration') {
                  window.location.href = '/calibration';
                } else {
                  setShowScheduler(alert.type);
                }
              }} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5" style={{
                background: alert.type === 'recalibration' ? '#E85D00' : '#7C3AED',
                color: 'white',
                fontFamily: fontFamily.mono,
              }} data-testid={`checkin-action-${alert.type}`}>
                {alert.type === 'recalibration' ? 'Recalibrate Now' : 'Schedule Check-In'}
              </button>
              <button onClick={() => setShowScheduler(alert.type)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all hover:-translate-y-0.5" style={{
                color: 'var(--biqc-text-2)',
                borderColor: 'var(--biqc-border)',
                fontFamily: fontFamily.mono,
              }} data-testid={`checkin-schedule-${alert.type}`}>
                <Calendar className="w-3 h-3 inline mr-1" />
                Pick a Date
              </button>
              <button onClick={() => handleDismiss(alert.type)} className="text-[11px] px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#64748B' }} data-testid={`checkin-dismiss-${alert.type}`}>
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
          <div className="relative w-[90%] max-w-md rounded-2xl shadow-2xl p-6" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text)' }}>
                {showScheduler === 'recalibration' ? 'Schedule Recalibration' : 'Schedule Video Check-In'}
              </h3>
              <button onClick={() => setShowScheduler(null)} className="p-1 rounded-lg hover:bg-white/5">
                <X className="w-4 h-4" style={{ color: '#64748B' }} />
              </button>
            </div>

            <p className="text-sm mb-4" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
              {showScheduler === 'recalibration'
                ? 'Choose a date and time to update your business profile and recalibrate BIQc.'
                : 'Choose a date and time for a video check-in with your BIQc advisor.'}
            </p>

            {/* Date Selection */}
            <div className="mb-4">
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Select Date</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {dateOptions.map((d) => (
                  <button key={d.value} onClick={() => setSelectedDate(d.value)}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: selectedDate === d.value ? '#E85D00' : '#0F1720',
                      color: selectedDate === d.value ? 'white' : '#9FB0C3',
                      border: `1px solid ${selectedDate === d.value ? '#E85D00' : 'rgba(140,170,210,0.15)'}`,
                      fontFamily: fontFamily.mono,
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selection */}
            <div className="mb-6">
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Select Time (AEST)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                {timeSlots.map((t) => (
                  <button key={t} onClick={() => setSelectedTime(t)}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: selectedTime === t ? '#E85D00' : '#0F1720',
                      color: selectedTime === t ? 'white' : '#9FB0C3',
                      border: `1px solid ${selectedTime === t ? '#E85D00' : 'rgba(140,170,210,0.15)'}`,
                      fontFamily: fontFamily.mono,
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleSchedule} disabled={!selectedDate || submitting}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: '#E85D00', fontFamily: fontFamily.display }}
              data-testid="schedule-confirm">
              {submitting ? 'Scheduling...' : `Schedule for ${selectedDate ? new Date(selectedDate).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : '...'} at ${selectedTime}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
