import { useState, useEffect } from 'react';
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
      <div className="space-y-6 max-w-5xl animate-fade-in">
        {advisorDraft && (
          <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid rgba(232,93,0,0.25)' }} data-testid="calendar-advisor-draft-card">
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
                      style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
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
                      style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
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
            <div className="flex items-center gap-3 mb-2">
              <CalendarIcon className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
              <span className="badge badge-primary" style={{ background: syncBadge.bg, color: syncBadge.color }}>
                <TrendingUp className="w-3 h-3" />
                {syncBadge.label}
              </span>
            </div>
            <h1 style={{ color: 'var(--text-primary)' }}>Calendar Intelligence</h1>
            <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
              {loadError ? 'Calendar data has partial issues. Review status and retry sync if needed.' : `Your ${calendarProvider === 'gmail' ? 'Gmail' : 'Outlook'} schedule synced for AI-powered insights`}
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
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59, 130, 246, 0.1)' }}
              >
                <CalendarIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {upcomingEvents.length}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Upcoming Events (30 days)
                </p>
              </div>
            </div>
          </div>
          
          <div 
            className="p-5 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(34, 197, 94, 0.1)' }}
              >
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {upcomingEvents.filter(e => e.attendees?.length > 0).length}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  With Attendees
                </p>
              </div>
            </div>
          </div>
          
          <div 
            className="p-5 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245, 158, 11, 0.1)' }}
              >
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {groupedEvents[today]?.length || 0}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Today's Meetings
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Events List */}
        {loading ? (
          <PageLoadingState message="Loading calendar..." />
        ) : loadError && upcomingEvents.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
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
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.75fr)]" data-testid="calendar-command-grid">
            <div className="space-y-6">
              {sortedDateKeys.map((date) => {
                const dateEvents = groupedEvents[date] || [];
                return (
                <div key={date}>
                  <h3 
                    className="text-sm font-semibold mb-3 px-1 flex items-center gap-2"
                    style={{ 
                      color: date === today ? 'var(--accent-primary)' : 'var(--text-muted)'
                    }}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {date === today ? 'Today' : formatDate(dateEvents[0]?.start)}
                  </h3>
                  <div className="space-y-3">
                    {dateEvents.map((event, idx) => (
                      <div 
                        key={event.id || `${date}-${idx}`}
                        className="p-4 rounded-xl border transition-all hover:shadow-md"
                        style={{ 
                          background: 'var(--bg-card)', 
                          borderColor: 'var(--border-light)',
                          borderLeft: `4px solid ${event.importance === 'high' ? '#EF4444' : 'var(--accent-primary)'}`
                        }}
                        data-testid={`calendar-event-card-${idx}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span 
                                className="text-sm font-medium"
                                style={{ color: 'var(--accent-primary)' }}
                              >
                                {formatTime(event.start)} - {formatTime(event.end)}
                              </span>
                              {event.importance === 'high' && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.18)', color: '#F87171' }}>
                                  Important
                                </span>
                              )}
                            </div>
                            <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                              {event.subject || 'Untitled Event'}
                            </h4>
                            
                            {event.location && (
                              <div className="flex items-center gap-1.5 text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                                <MapPin className="w-3.5 h-3.5" />
                                {event.location}
                              </div>
                            )}
                            
                            {event.attendees?.length > 0 && (
                              <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                                <Users className="w-3.5 h-3.5" />
                                {event.attendees.slice(0, 3).join(', ')}
                                {event.attendees.length > 3 && ` +${event.attendees.length - 3} more`}
                              </div>
                            )}
                            
                            {event.preview && (
                              <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                                {event.preview}
                              </p>
                            )}
                          </div>
                          
                          {event.is_all_day && (
                            <span 
                              className="text-xs px-2 py-1 rounded-lg"
                              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                            >
                              All Day
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              })}
            </div>
            <div className="space-y-4" data-testid="calendar-side-panel">
              <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Execution cadence</p>
                <p className="mt-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Keep tomorrow’s schedule decision-ready.</p>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Stage follow-ups, identify overloaded days, and make each meeting block more intentional.</p>
              </div>
              <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Today at a glance</p>
                <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <div className="flex items-center justify-between"><span>Meetings today</span><strong style={{ color: 'var(--text-primary)' }}>{groupedEvents[today]?.length || 0}</strong></div>
                  <div className="flex items-center justify-between"><span>Important events</span><strong style={{ color: 'var(--text-primary)' }}>{upcomingEvents.filter((event) => event.importance === 'high').length}</strong></div>
                  <div className="flex items-center justify-between"><span>Events with attendees</span><strong style={{ color: 'var(--text-primary)' }}>{upcomingEvents.filter((event) => event.attendees?.length > 0).length}</strong></div>
                </div>
              </div>
              {calendarMeta && (
                <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                  <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Data freshness</p>
                  <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center justify-between"><span>Events fetched</span><strong style={{ color: 'var(--text-primary)' }}>{calendarMeta.total ?? 0}</strong></div>
                    <div className="flex items-center justify-between"><span>Last sync</span><strong style={{ color: 'var(--text-primary)' }}>{calendarMeta.syncedAt ? new Date(calendarMeta.syncedAt).toLocaleString('en-AU') : (calendarMeta.fetchedAt ? new Date(calendarMeta.fetchedAt).toLocaleString('en-AU') : 'Unknown')}</strong></div>
                    {calendarMeta.dateRange?.start && calendarMeta.dateRange?.end && (
                      <div className="flex items-start justify-between gap-4">
                        <span>Window</span>
                        <strong style={{ color: 'var(--text-primary)', textAlign: 'right' }}>
                          {new Date(calendarMeta.dateRange.start).toLocaleDateString('en-AU')} - {new Date(calendarMeta.dateRange.end).toLocaleDateString('en-AU')}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {intelligenceSummary && (
                <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }} data-testid="calendar-intelligence-summary">
                  <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Calendar intelligence</p>
                  <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                    {intelligenceSummaryText || 'No summary available.'}
                  </p>
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CalendarView;
