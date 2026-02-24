import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  Calendar as CalendarIcon, RefreshCw, Users, Clock, 
  MapPin, Loader2, Video, TrendingUp, AlertCircle
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const CalendarView = () => {
  const [events, setEvents] = useState([]);
  const [calendarIntel, setCalendarIntel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const [eventsRes, intelRes] = await Promise.all([
        apiClient.get('/outlook/calendar/events').catch(() => ({ data: { events: [] } })),
        apiClient.get('/outlook/intelligence').catch(() => ({ data: {} }))
      ]);
      
      setEvents(eventsRes.data?.events || []);
      // Calendar intel might be stored separately or with email intel
    } catch (error) {
      console.error('Failed to fetch calendar data');
    } finally {
      setLoading(false);
    }
  };

  const syncCalendar = async () => {
    try {
      setSyncing(true);
      toast.info('Syncing calendar...');
      const response = await apiClient.post('/outlook/calendar/sync');
      toast.success(`Calendar synced: ${response.data.events_synced} events`);
      await fetchCalendarData();
    } catch (error) {
      if (error.response?.data?.detail?.includes('not connected')) {
        toast.error('Please connect your Outlook account first in Integrations');
      } else {
        toast.error('Failed to sync calendar: ' + (error.response?.data?.detail || error.message));
      }
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
      const date = event.start ? event.start.split('T')[0] : 'unknown';
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });
    return grouped;
  };

  const groupedEvents = groupEventsByDate(events);
  const today = new Date().toISOString().split('T')[0];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CalendarIcon className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
              <span className="badge badge-primary">
                <TrendingUp className="w-3 h-3" />
                Synced
              </span>
            </div>
            <h1 style={{ color: 'var(--text-primary)' }}>Calendar Intelligence</h1>
            <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
              Your schedule synced for AI-powered insights
            </p>
          </div>
          
          <Button
            onClick={syncCalendar}
            disabled={syncing}
            className="btn-primary"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 " />
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
                  {events.length}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Upcoming Events
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
                  {events.filter(e => e.attendees?.length > 0).length}
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
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8  mb-4" style={{ color: 'var(--accent-primary)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading calendar...</p>
          </div>
        ) : events.length === 0 ? (
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
              Sync your Outlook calendar to see your upcoming meetings and let AI understand your schedule.
            </p>
            <Button onClick={syncCalendar} disabled={syncing} className="btn-primary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Calendar
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                <h3 
                  className="text-sm font-semibold mb-3 px-1"
                  style={{ 
                    color: date === today ? 'var(--accent-primary)' : 'var(--text-muted)'
                  }}
                >
                  {date === today ? '📅 Today' : formatDate(dateEvents[0]?.start)}
                </h3>
                <div className="space-y-3">
                  {dateEvents.map((event, idx) => (
                    <div 
                      key={idx}
                      className="p-4 rounded-xl border transition-all hover:shadow-md"
                      style={{ 
                        background: 'var(--bg-card)', 
                        borderColor: 'var(--border-light)',
                        borderLeft: `4px solid ${event.importance === 'high' ? '#EF4444' : 'var(--accent-primary)'}`
                      }}
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
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
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
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CalendarView;
