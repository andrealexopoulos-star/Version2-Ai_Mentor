import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';
import { 
  Calendar as CalendarIcon, RefreshCw, Users, Clock, 
  MapPin, TrendingUp
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { PageLoadingState } from '../components/PageStateComponents';
import SemanticContractBanner from '../components/SemanticContractBanner';
import MeetingPrepCard from '../components/intelligence/MeetingPrepCard';
import { fontFamily } from '../design-system/tokens';

const CalendarView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [calendarIntel, setCalendarIntel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [calendarMeta, setCalendarMeta] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [calendarProvider, setCalendarProvider] = useState('outlook');
  const [calendarContract, setCalendarContract] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [advisorDraft, setAdvisorDraft] = useState(() => {
    let initial = location.state?.advisorFollowUp || null;
    if (!initial) {
      try {
        const stored = sessionStorage.getItem('biqc_calendar_draft');
        initial = stored ? JSON.parse(stored) : null;
      } catch {
        initial = null;
      }
    }
    if (!initial) return null;
    return {
      title: initial.title || 'BIQc follow-up',
      summary: `${initial.summary || ''}${initial.whyNow ? `\n\nWhy now: ${initial.whyNow}` : ''}${initial.ifIgnored ? `\n\nIf ignored: ${initial.ifIgnored}` : ''}${initial.sourceSummary ? `\n\n${initial.sourceSummary}` : ''}`.trim(),
      startAt: initial.startAt || new Date().toISOString(),
      endAt: initial.endAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  });

  const toLocalDateTimeValue = (isoString) => {
    if (!isoString) return '';
    const dt = new Date(isoString);
    if (Number.isNaN(dt.getTime())) return '';
    const pad = (value) => String(value).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const fromLocalDateTimeValue = (value) => {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const toLocalDateKey = (dateInput) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) return 'unknown';
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: connections } = await supabase
            .from('email_connections')
            .select('provider,connected')
            .eq('user_id', session.user.id)
            .eq('connected', true);
          const providers = (connections || []).map((row) => row.provider);
          if (providers.includes('outlook')) setCalendarProvider('outlook');
          else if (providers.includes('gmail')) setCalendarProvider('gmail');
        }
      } catch {}
      syncCalendar(true);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [eventsRes, intelRes] = await Promise.all([
        apiClient.get('/email/calendar/events?days_back=0&days_ahead=30'),
        calendarProvider === 'outlook'
          ? apiClient.get('/outlook/intelligence').catch(() => ({ data: {} }))
          : Promise.resolve({ data: { message: 'Gmail intelligence calibration in progress.' } }),
      ]);
      setEvents(eventsRes.data?.events || []);
      setCalendarContract(eventsRes.data || null);
      setCalendarMeta({
        total: eventsRes.data?.total ?? 0,
        dateRange: eventsRes.data?.date_range || null,
        fetchedAt: new Date().toISOString(),
      });
      setCalendarIntel(intelRes.data || null);
    } catch (error) {
      setLoadError(error?.response?.data?.detail || error?.message || 'Failed to fetch calendar data');
    } finally {
      setLoading(false);
    }
  };

  const syncCalendar = async (silent = false) => {
    try {
      setSyncing(true);
      if (!silent) toast.info('Syncing calendar...');
      const response = await apiClient.post(`/email/calendar/sync?provider=${encodeURIComponent(calendarProvider || 'outlook')}`);
      if (!silent) toast.success(`Calendar synced: ${response.data.events_synced} events`);
      if (response?.data?.synced_at || response?.data?.date_range) {
        setCalendarMeta((prev) => ({
          ...(prev || {}),
          total: response.data.events_synced ?? prev?.total ?? 0,
          dateRange: response.data.date_range || prev?.dateRange || null,
          syncedAt: response.data.synced_at || prev?.syncedAt || null,
        }));
      }
      await fetchCalendarData();
    } catch (error) {
      if (!silent) {
        if (error.response?.data?.detail?.includes('not connected')) {
          toast.error(`Please connect your ${calendarProvider === 'gmail' ? 'Gmail' : 'Outlook'} account first in Integrations`);
        } else {
          toast.error('Failed to sync calendar: ' + (error.response?.data?.detail || error.message));
        }
      }
      await fetchCalendarData();
    } finally {
      setSyncing(false);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const groupEventsByDate = (events) => {
    const grouped = {};
    events.forEach(event => {
      const date = toLocalDateKey(event.start);
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });
    return grouped;
  };

  const now = new Date();
  const upcomingEvents = events.filter((event) => {
    const end = new Date(event.end || event.start);
    return !Number.isNaN(end.getTime()) && end >= now;
  });

  const groupedEvents = groupEventsByDate(upcomingEvents);
  const sortedDateKeys = Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b));
  const today = toLocalDateKey(new Date());

  const getWeekDays = (offset = 0) => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1 + (offset * 7));
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };
  const weekDays = getWeekDays(weekOffset);

  const getEventsForDay = (dayDate) => {
    const dayKey = toLocalDateKey(dayDate);
    return (groupedEvents[dayKey] || []);
  };

  const intelligenceSummary = calendarIntel?.summary
    || calendarIntel?.insight
    || calendarIntel?.insights
    || calendarIntel?.brief
    || null;
  const formatIntelligenceSummary = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
        .filter(Boolean)
        .join(' • ');
    }
    if (typeof value === 'object') {
      if (typeof value.summary === 'string') return value.summary;
      return Object.entries(value)
        .slice(0, 4)
        .map(([key, item]) => `${key}: ${typeof item === 'string' ? item : JSON.stringify(item)}`)
        .join(' • ');
    }
    return String(value);
  };
  const intelligenceSummaryText = formatIntelligenceSummary(intelligenceSummary);
  const syncBadge = syncing
    ? { label: 'Syncing', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' }
    : loading
      ? { label: 'Loading', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' }
      : loadError
        ? { label: 'Degraded', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' }
        : upcomingEvents.length > 0
          ? { label: 'Synced', color: '#10B981', bg: 'rgba(16,185,129,0.12)' }
          : { label: 'No events', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };

  const createDraftEvent = async () => {
    if (!advisorDraft) return;
    setDraftSaving(true);
    try {
      const response = await apiClient.post('/outlook/calendar/create', {
        title: advisorDraft.title,
        summary: advisorDraft.summary,
        start_at: advisorDraft.startAt,
        end_at: advisorDraft.endAt,
      }, { timeout: 20000 });
      toast.success(`Follow-up created${response?.data?.subject ? `: ${response.data.subject}` : ''}`);
      try { sessionStorage.removeItem('biqc_calendar_draft'); } catch {}
      setAdvisorDraft(null);
      navigate(location.pathname, { replace: true, state: {} });
      await fetchCalendarData();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to create follow-up event.');
    } finally {
      setDraftSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in" style={{ maxWidth: 1280 }}>
        {advisorDraft && (
          <div className="p-5 rounded-xl" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(232,93,0,0.25)' }} data-testid="calendar-advisor-draft-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.14em] mb-2" style={{ color: '#E85D00' }}>Advisor follow-up draft</p>
                <input
                  value={advisorDraft.title}
                  onChange={(event) => setAdvisorDraft((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full bg-transparent text-lg font-semibold outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  data-testid="calendar-advisor-draft-title"
                />
                <textarea
                  value={advisorDraft.summary}
                  onChange={(event) => setAdvisorDraft((prev) => ({ ...prev, summary: event.target.value }))}
                  className="mt-3 w-full rounded-lg bg-transparent p-0 text-sm outline-none"
                  style={{ color: 'var(--text-secondary)', minHeight: '110px' }}
                  data-testid="calendar-advisor-draft-summary"
                />
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Start
                    <input
                      type="datetime-local"
                      value={toLocalDateTimeValue(advisorDraft.startAt)}
                      onChange={(event) => {
                        const next = fromLocalDateTimeValue(event.target.value);
                        if (!next) return;
                        setAdvisorDraft((prev) => ({ ...prev, startAt: next }));
                      }}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ background: 'var(--bg-tertiary)', borderColor: 'rgba(140,170,210,0.12)', color: 'var(--text-primary)' }}
                      data-testid="calendar-advisor-draft-start"
                    />
                  </label>
                  <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    End
                    <input
                      type="datetime-local"
                      value={toLocalDateTimeValue(advisorDraft.endAt)}
                      onChange={(event) => {
                        const next = fromLocalDateTimeValue(event.target.value);
                        if (!next) return;
                        setAdvisorDraft((prev) => ({ ...prev, endAt: next }));
                      }}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ background: 'var(--bg-tertiary)', borderColor: 'rgba(140,170,210,0.12)', color: 'var(--text-primary)' }}
                      data-testid="calendar-advisor-draft-end"
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={createDraftEvent} disabled={draftSaving} className="btn-primary" data-testid="calendar-advisor-draft-create">
                  {draftSaving ? 'Creating…' : 'Create follow-up event'}
                </Button>
                <Button variant="outline" onClick={() => { try { sessionStorage.removeItem('biqc_calendar_draft'); } catch {} setAdvisorDraft(null); navigate(location.pathname, { replace: true, state: {} }); }} data-testid="calendar-advisor-draft-dismiss">
                  Dismiss draft
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily?.mono || 'monospace', color: '#E85D00' }}>— Calendar · Week of {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}</div>
            <h1 className="font-medium" style={{ fontFamily: fontFamily?.display || 'Inter', color: 'var(--ink-display, #EDF1F7)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Your week, <em style={{ fontStyle: 'italic', color: '#E85D00' }}>read by BIQc</em>.</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
              {loadError ? 'Calendar data has partial issues. Review status and retry sync if needed.' : 'Every meeting linked to a deal, customer or alert. BIQc surfaces what to prep, what to decline, and what to hand off.'}
            </p>
          </div>
          
          <Button
            onClick={syncCalendar}
            disabled={syncing}
            className="btn-primary"
          >
            {syncing ? (
              <>
                
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Calendar
              </>
            )}
          </Button>
        </div>

        {/* Stats Cards */}
        {calendarContract && (
          <SemanticContractBanner
            payload={calendarContract}
            title="Calendar semantic state"
          />
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className="p-5 rounded-xl"
            style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59, 130, 246, 0.1)' }}
              >
                <CalendarIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: fontFamily?.display, color: 'var(--ink-display, #EDF1F7)' }}>
                  {upcomingEvents.length}
                </p>
                <p className="text-[11px] uppercase tracking-wider mt-1" style={{ fontFamily: fontFamily?.mono, color: 'var(--ink-muted, #708499)' }}>
                  Upcoming events
                </p>
              </div>
            </div>
          </div>

          <div
            className="p-5 rounded-xl"
            style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(34, 197, 94, 0.1)' }}
              >
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: fontFamily?.display, color: 'var(--ink-display, #EDF1F7)' }}>
                  {upcomingEvents.filter(e => e.attendees?.length > 0).length}
                </p>
                <p className="text-[11px] uppercase tracking-wider mt-1" style={{ fontFamily: fontFamily?.mono, color: 'var(--ink-muted, #708499)' }}>
                  With attendees
                </p>
              </div>
            </div>
          </div>

          <div
            className="p-5 rounded-xl"
            style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245, 158, 11, 0.1)' }}
              >
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: fontFamily?.display, color: 'var(--ink-display, #EDF1F7)' }}>
                  {groupedEvents[today]?.length || 0}
                </p>
                <p className="text-[11px] uppercase tracking-wider mt-1" style={{ fontFamily: fontFamily?.mono, color: 'var(--ink-muted, #708499)' }}>
                  Today's meetings
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Week Grid Calendar */}
        {loading ? (
          <PageLoadingState message="Loading calendar..." />
        ) : loadError && upcomingEvents.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)' }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Calendar unavailable right now
            </h3>
            <p className="mb-6 max-w-md mx-auto text-sm" style={{ color: 'var(--text-muted)' }}>
              {loadError}
            </p>
            <Button onClick={() => fetchCalendarData()} disabled={syncing} className="btn-primary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <CalendarIcon className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              No Calendar Events
            </h3>
            <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
              Sync your {calendarProvider === 'gmail' ? 'Gmail' : 'Outlook'} calendar to see upcoming meetings and let BIQc reason over your schedule.
            </p>
            <Button onClick={syncCalendar} disabled={syncing} className="btn-primary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Calendar
            </Button>
          </div>
        ) : (
          <>
          {loadError && (
            <div className="rounded-xl border px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }} data-testid="calendar-partial-error">
              <p className="text-sm" style={{ color: '#FCA5A5' }}>
                Calendar intelligence is partially degraded: {loadError}
              </p>
            </div>
          )}

          {/* Week Grid Calendar + Side Rail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'flex-start' }} className="calendar-week-layout" data-testid="calendar-command-grid">
            {/* Main Calendar Card */}
            <div style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 16, overflow: 'hidden' }}>
              {/* Calendar Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(140,170,210,0.12)', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontFamily: fontFamily?.display || 'serif', fontSize: 22, color: 'var(--ink-display, #EDF1F7)' }}>
                  Week of {weekDays[0]?.toLocaleDateString('en-AU', { day: 'numeric' })}
                  <span style={{ fontFamily: fontFamily?.display || 'serif', fontSize: 14, color: 'var(--ink-muted, #708499)', fontStyle: 'italic', marginLeft: 8 }}>
                    {weekDays[0]?.toLocaleDateString('en-AU', { month: 'long' })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setWeekOffset(prev => prev - 1)} style={{ width: 32, height: 32, border: '1px solid rgba(140,170,210,0.12)', background: 'var(--surface, #0E1628)', borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-secondary, #8FA0B8)' }}>{'\u2039'}</button>
                  <button onClick={() => setWeekOffset(0)} style={{ padding: '6px 14px', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 8, fontFamily: fontFamily?.mono || 'monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-secondary, #8FA0B8)', background: 'var(--surface, #0E1628)', cursor: 'pointer' }}>Today</button>
                  <button onClick={() => setWeekOffset(prev => prev + 1)} style={{ width: 32, height: 32, border: '1px solid rgba(140,170,210,0.12)', background: 'var(--surface, #0E1628)', borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-secondary, #8FA0B8)' }}>{'\u203A'}</button>
                </div>
              </div>

              {/* Week Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)', minHeight: 660, position: 'relative' }}>
                {/* Day Headers Row */}
                <div style={{ borderBottom: '1px solid rgba(140,170,210,0.12)', borderRight: '1px solid rgba(140,170,210,0.12)' }} /> {/* empty top-left corner */}
                {weekDays.map((day, i) => {
                  const isToday = toLocalDateKey(day) === today;
                  return (
                    <div key={i} style={{ borderBottom: '1px solid rgba(140,170,210,0.12)', borderRight: i < 4 ? '1px solid rgba(140,170,210,0.12)' : 'none', padding: '12px 8px', textAlign: 'center', background: 'var(--surface, #0E1628)', position: 'sticky', top: 0, zIndex: 5 }}>
                      <div style={{ fontFamily: fontFamily?.mono || 'monospace', fontSize: 10, color: 'var(--ink-muted, #708499)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {day.toLocaleDateString('en-AU', { weekday: 'short' })}
                      </div>
                      <div style={{ fontFamily: fontFamily?.display || 'serif', fontSize: 22, color: isToday ? '#E85D00' : 'var(--ink-display, #EDF1F7)', lineHeight: 1, marginTop: 4 }}>
                        {day.getDate()}
                      </div>
                      {isToday && <div style={{ width: 6, height: 6, background: '#E85D00', borderRadius: '50%', margin: '4px auto 0', boxShadow: '0 0 8px #E85D00' }} />}
                    </div>
                  );
                })}

                {/* Hour Rows */}
                {Array.from({ length: 11 }, (_, h) => h + 8).map(hour => (
                  <React.Fragment key={hour}>
                    {/* Hour label */}
                    <div style={{ borderBottom: '1px solid rgba(140,170,210,0.12)', borderRight: '1px solid rgba(140,170,210,0.12)', height: 60, position: 'relative' }}>
                      <span style={{ position: 'absolute', top: -8, right: 8, fontFamily: fontFamily?.mono || 'monospace', fontSize: 10, color: 'var(--ink-muted, #708499)' }}>
                        {hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
                      </span>
                    </div>
                    {/* Day cells */}
                    {weekDays.map((day, di) => {
                      const dayEvents = getEventsForDay(day).filter(ev => {
                        const startH = new Date(ev.start).getHours();
                        return startH === hour;
                      });
                      return (
                        <div key={di} style={{ borderBottom: '1px solid rgba(140,170,210,0.12)', borderRight: di < 4 ? '1px solid rgba(140,170,210,0.12)' : 'none', height: 60, position: 'relative' }}>
                          {dayEvents.map((ev, ei) => {
                            const startMin = new Date(ev.start).getMinutes();
                            const endTime = new Date(ev.end || ev.start);
                            const durationMin = Math.max(20, (endTime - new Date(ev.start)) / 60000);
                            const heightPx = Math.min(durationMin, 120);
                            const subjectLower = (ev.subject || '').toLowerCase();
                            const type = subjectLower.includes('deal') || ev.importance === 'high' ? 'deal' : subjectLower.includes('internal') || subjectLower.includes('standup') || subjectLower.includes('sync') ? 'internal' : 'customer';
                            const typeColors = { deal: { bg: 'rgba(232,93,0,0.12)', border: '#E85D00', color: '#E85D00' }, customer: { bg: 'rgba(22,163,74,0.1)', border: '#16A34A', color: '#16A34A' }, internal: { bg: 'rgba(37,99,235,0.08)', border: '#2563EB', color: '#93B4F8' } };
                            const tc = typeColors[type] || typeColors.customer;
                            return (
                              <div key={ei} style={{ position: 'absolute', left: 4, right: 4, top: startMin, borderRadius: 4, padding: '4px 6px', fontSize: 11, overflow: 'hidden', cursor: 'pointer', borderLeft: `3px solid ${tc.border}`, background: tc.bg, color: tc.color, height: heightPx, zIndex: 2 }}>
                                <div style={{ fontWeight: 600, lineHeight: 1.2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.subject || 'Event'}</div>
                                <div style={{ fontFamily: fontFamily?.mono || 'monospace', fontSize: 9, opacity: 0.75 }}>{formatTime(ev.start)}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderTop: '1px solid rgba(140,170,210,0.12)', background: 'var(--surface-tint, rgba(14,22,40,0.5))', flexWrap: 'wrap' }}>
                {[{ label: 'Deal', color: '#E85D00' }, { label: 'Customer', color: '#16A34A' }, { label: 'Internal', color: '#2563EB' }, { label: 'Personal', color: '#94A3B8' }, { label: 'Critical', color: '#DC2626' }].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: fontFamily?.mono || 'monospace', fontSize: 10, color: 'var(--ink-secondary, #8FA0B8)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Side Rail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Today count */}
              <div style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 16, padding: 20 }}>
                <div style={{ fontFamily: fontFamily?.mono || 'monospace', fontSize: 11, color: 'var(--ink-muted, #708499)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Today</div>
                <div style={{ fontFamily: fontFamily?.display || 'serif', fontSize: 32, color: 'var(--ink-display, #EDF1F7)', lineHeight: 1 }}>{groupedEvents[today]?.length || 0}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-secondary, #8FA0B8)', marginTop: 4 }}>meetings scheduled</div>

                {/* Agenda list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  {(groupedEvents[today] || []).slice(0, 5).map((ev, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: 12, padding: 12, borderRadius: 8, border: '1px solid transparent', cursor: 'pointer' }}>
                      <div style={{ fontFamily: fontFamily?.mono || 'monospace', fontSize: 11, color: 'var(--ink-muted, #708499)', textAlign: 'right', lineHeight: 1.4 }}>
                        <strong style={{ display: 'block', color: 'var(--ink-display, #EDF1F7)', fontWeight: 600 }}>{formatTime(ev.start)}</strong>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.subject || 'Event'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {ev.importance === 'high' && <span style={{ fontFamily: fontFamily?.mono || 'monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '1px 6px', borderRadius: 999, fontWeight: 600, background: 'rgba(232,93,0,0.12)', color: '#E85D00' }}>Deal</span>}
                          {ev.attendees?.length > 0 && <span style={{ fontSize: 11, color: 'var(--ink-muted, #708499)' }}>{ev.attendees.length} attendees</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intel card */}
              {calendarIntel && intelligenceSummaryText && (
                <div style={{ background: 'linear-gradient(135deg, rgba(232,93,0,0.08) 0%, var(--surface, #0E1628) 80%)', border: '1px solid rgba(232,93,0,0.15)', borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: fontFamily?.mono || 'monospace', fontSize: 10, color: '#E85D00', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E85D00', boxShadow: '0 0 8px #E85D00' }} />
                    BIQc Calendar Intel
                  </div>
                  <div style={{ fontFamily: fontFamily?.display || 'serif', fontSize: 20, color: 'var(--ink-display, #EDF1F7)', lineHeight: 1.2, marginBottom: 8 }}>Schedule Intelligence</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.55 }}>{intelligenceSummaryText}</div>
                </div>
              )}

              {/* MeetingPrep card */}
              <MeetingPrepCard />
            </div>
          </div>

          {/* Responsive style for stacking below 1100px */}
          <style>{`
            @media (max-width: 1100px) {
              .calendar-week-layout {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CalendarView;
