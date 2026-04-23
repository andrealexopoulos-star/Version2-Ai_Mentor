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
      let hasConnection = false;
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
          hasConnection = providers.length > 0;
        }
      } catch {}
      // Zero-401 rule: don't fire a sync (which backend returns 400 for) when
      // user has no email connection. Show the empty-state banner immediately
      // and surface "Connect email" instead of silently 400-flooding Sentry.
      if (hasConnection) {
        syncCalendar(true);
      } else {
        setLoading(false);
      }
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
    // Full Mon\u2013Sun week so weekend meetings render (previous length: 5
    // dropped Sat/Sun silently even though the stats cards counted them).
    return Array.from({ length: 7 }, (_, i) => {
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
    ? { label: 'Syncing', color: 'var(--warning)', bg: 'var(--warning-wash)' }
    : loading
      ? { label: 'Loading', color: 'var(--info)', bg: 'var(--info-wash)' }
      : loadError
        ? { label: 'Degraded', color: 'var(--danger)', bg: 'var(--danger-wash)' }
        : upcomingEvents.length > 0
          ? { label: 'Synced', color: 'var(--positive)', bg: 'var(--positive-wash)' }
          : { label: 'No events', color: 'var(--ink-muted, #737373)', bg: 'rgba(148,163,184,0.12)' };

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
          <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--lava-ring, rgba(232,93,0,0.25))', borderRadius: 'var(--r-lg)' }} data-testid="calendar-advisor-draft-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>Advisor follow-up draft</p>
                <input
                  value={advisorDraft.title}
                  onChange={(event) => setAdvisorDraft((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full bg-transparent text-lg font-semibold outline-none"
                  style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}
                  data-testid="calendar-advisor-draft-title"
                />
                <textarea
                  value={advisorDraft.summary}
                  onChange={(event) => setAdvisorDraft((prev) => ({ ...prev, summary: event.target.value }))}
                  className="mt-3 w-full rounded-lg bg-transparent p-0 text-sm outline-none"
                  style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)', minHeight: '110px' }}
                  data-testid="calendar-advisor-draft-summary"
                />
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
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
                      style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)', color: 'var(--ink-display)', fontFamily: 'var(--font-mono)' }}
                      data-testid="calendar-advisor-draft-start"
                    />
                  </label>
                  <label className="text-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
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
                      style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)', color: 'var(--ink-display)', fontFamily: 'var(--font-mono)' }}
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
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>— Calendar · Week of {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}</div>
            <h1 className="font-medium" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Your week, <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>read by BIQc</em>.</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
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
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59, 130, 246, 0.1)' }}
              >
                <CalendarIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>
                  {upcomingEvents.length}
                </p>
                <p className="text-[11px] uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>
                  Upcoming events
                </p>
              </div>
            </div>
          </div>

          <div
            className="p-5 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(34, 197, 94, 0.1)' }}
              >
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>
                  {upcomingEvents.filter(e => e.attendees?.length > 0).length}
                </p>
                <p className="text-[11px] uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>
                  With attendees
                </p>
              </div>
            </div>
          </div>

          <div
            className="p-5 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245, 158, 11, 0.1)' }}
              >
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>
                  {groupedEvents[today]?.length || 0}
                </p>
                <p className="text-[11px] uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>
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
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
              Calendar unavailable right now
            </h3>
            <p className="mb-6 max-w-md mx-auto text-sm" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
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
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--surface-sunken)' }}
            >
              <CalendarIcon className="w-8 h-8" style={{ color: 'var(--ink-muted)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
              {syncing ? 'Syncing your calendar...' : 'No Calendar Events Yet'}
            </h3>
            <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
              {syncing
                ? 'Fetching your meetings from ' + (calendarProvider === 'gmail' ? 'Gmail' : 'Outlook') + '...'
                : 'Connect and sync your ' + (calendarProvider === 'gmail' ? 'Gmail' : 'Outlook') + ' calendar to see meetings, prep briefs, and schedule intelligence.'
              }
            </p>
            <Button onClick={syncCalendar} disabled={syncing} className="btn-primary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Calendar
            </Button>
          </div>
        ) : (
          <>
          {loadError && (
            <div className="rounded-xl border px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', borderRadius: 'var(--r-lg)' }} data-testid="calendar-partial-error">
              <p className="text-sm" style={{ color: 'var(--danger, #DC2626)' }}>
                Calendar intelligence is partially degraded: {loadError}
              </p>
            </div>
          )}

          {/* Week Grid Calendar + Side Rail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--sp-5, 20px)', alignItems: 'flex-start' }} className="calendar-week-layout" data-testid="calendar-command-grid">
            {/* Main Calendar Card */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl, 16px)', overflow: 'hidden' }}>
              {/* Calendar Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-display)' }}>
                  Week of {weekDays[0]?.toLocaleDateString('en-AU', { day: 'numeric' })}
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink-muted)', fontStyle: 'italic', marginLeft: 8 }}>
                    {weekDays[0]?.toLocaleDateString('en-AU', { month: 'long' })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setWeekOffset(prev => prev - 1)} style={{ width: 32, height: 32, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 'var(--r-md, 8px)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-secondary)', transition: 'all 150ms ease' }}>{'\u2039'}</button>
                  <button onClick={() => setWeekOffset(0)} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-md, 8px)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-secondary)', background: 'var(--surface)', cursor: 'pointer', transition: 'all 150ms ease' }}>Today</button>
                  <button onClick={() => setWeekOffset(prev => prev + 1)} style={{ width: 32, height: 32, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 'var(--r-md, 8px)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-secondary)', transition: 'all 150ms ease' }}>{'\u203A'}</button>
                </div>
              </div>

              {/* Week Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)', minHeight: 660, position: 'relative' }}>
                {/* Day Headers Row */}
                <div style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} /> {/* empty top-left corner */}
                {weekDays.map((day, i) => {
                  const isToday = toLocalDateKey(day) === today;
                  return (
                    <div key={i} style={{ borderBottom: '1px solid var(--border)', borderRight: i < 4 ? '1px solid var(--border)' : 'none', padding: '12px 8px', textAlign: 'center', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 5 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)' }}>
                        {day.toLocaleDateString('en-AU', { weekday: 'short' })}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: isToday ? 'var(--lava)' : 'var(--ink-display)', lineHeight: 1, marginTop: 4 }}>
                        {day.getDate()}
                      </div>
                      {isToday && <div style={{ width: 6, height: 6, background: 'var(--lava)', borderRadius: '50%', margin: '4px auto 0', boxShadow: '0 0 8px var(--lava)' }} />}
                    </div>
                  );
                })}

                {/* Hour Rows */}
                {/* 7am\u20139pm (15 rows) so early + late meetings render on the grid. */}
                {Array.from({ length: 15 }, (_, h) => h + 7).map(hour => (
                  <React.Fragment key={hour}>
                    {/* Hour label */}
                    <div style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', height: 60, position: 'relative' }}>
                      <span style={{ position: 'absolute', top: -8, right: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}>
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
                        <div key={di} style={{ borderBottom: '1px solid var(--border)', borderRight: di < 4 ? '1px solid var(--border)' : 'none', height: 60, position: 'relative' }}>
                          {dayEvents.map((ev, ei) => {
                            const startMin = new Date(ev.start).getMinutes();
                            const endTime = new Date(ev.end || ev.start);
                            const durationMin = Math.max(20, (endTime - new Date(ev.start)) / 60000);
                            const heightPx = Math.min(durationMin, 120);
                            const subjectLower = (ev.subject || '').toLowerCase();
                            const type = subjectLower.includes('deal') || ev.importance === 'high' ? 'deal' : subjectLower.includes('internal') || subjectLower.includes('standup') || subjectLower.includes('sync') ? 'internal' : 'customer';
                            const typeColors = { deal: { bg: 'var(--lava-wash, rgba(232,93,0,0.12))', border: 'var(--lava)', color: 'var(--lava)' }, customer: { bg: 'var(--positive-wash)', border: 'var(--positive)', color: 'var(--positive)' }, internal: { bg: 'var(--info-wash)', border: 'var(--info)', color: 'var(--info)' } };
                            const tc = typeColors[type] || typeColors.customer;
                            return (
                              <div key={ei} style={{ position: 'absolute', left: 4, right: 4, top: startMin, borderRadius: 'var(--r-sm, 4px)', padding: '4px 6px', fontSize: 11, overflow: 'hidden', cursor: 'pointer', borderLeft: `3px solid ${tc.border}`, background: tc.bg, color: tc.color, height: heightPx, zIndex: 2, transition: 'all 150ms ease' }}>
                                <div style={{ fontWeight: 600, lineHeight: 1.2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)' }}>{ev.subject || 'Event'}</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.75 }}>{formatTime(ev.start)}</div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-tint, var(--surface-sunken))', flexWrap: 'wrap' }}>
                {[{ label: 'Deal', color: 'var(--lava)' }, { label: 'Customer', color: 'var(--positive)' }, { label: 'Internal', color: 'var(--info)' }, { label: 'Personal', color: 'var(--ink-muted, #737373)' }, { label: 'Critical', color: 'var(--danger)' }].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-secondary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Side Rail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Today count */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl, 16px)', padding: 20 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', marginBottom: 16 }}>Today</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink-display)', lineHeight: 1 }}>{groupedEvents[today]?.length || 0}</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)', marginTop: 4 }}>meetings scheduled</div>

                {/* Agenda list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  {(groupedEvents[today] || []).slice(0, 5).map((ev, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: 12, padding: 12, borderRadius: 'var(--r-md, 8px)', border: '1px solid transparent', cursor: 'pointer', transition: 'all 150ms ease' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)', textAlign: 'right', lineHeight: 1.4 }}>
                        <strong style={{ display: 'block', color: 'var(--ink-display)', fontWeight: 600 }}>{formatTime(ev.start)}</strong>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)', color: 'var(--ink-display)', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.subject || 'Event'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {ev.importance === 'high' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', padding: '1px 6px', borderRadius: 999, fontWeight: 600, background: 'var(--lava-wash, rgba(232,93,0,0.12))', color: 'var(--lava)' }}>Deal</span>}
                          {ev.attendees?.length > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--font-ui)', color: 'var(--ink-muted)' }}>{ev.attendees.length} attendees</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intel card */}
              {calendarIntel && intelligenceSummaryText && (
                <div style={{ background: 'linear-gradient(135deg, var(--lava-wash, rgba(232,93,0,0.08)) 0%, var(--surface) 80%)', border: '1px solid var(--lava-ring, rgba(232,93,0,0.15))', borderRadius: 'var(--r-xl, 16px)', padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--lava)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', fontWeight: 600, marginBottom: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lava)', boxShadow: '0 0 8px var(--lava)' }} />
                    BIQc Calendar Intel
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-display)', lineHeight: 1.2, marginBottom: 8 }}>Schedule Intelligence</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)', lineHeight: 1.55 }}>{intelligenceSummaryText}</div>
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
            @media (max-width: 768px) {
              .calendar-week-layout {
                grid-template-columns: 1fr !important;
              }
            }
            @media (max-width: 640px) {
              .calendar-week-layout {
                grid-template-columns: 1fr !important;
                gap: 12px !important;
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
