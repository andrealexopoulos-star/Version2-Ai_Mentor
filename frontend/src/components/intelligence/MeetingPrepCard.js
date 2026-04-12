/**
 * MeetingPrepCard — Shows AI-enriched meeting preparation intelligence.
 * Displays today's meetings with attendee context, email history, and CRM signals.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api';
import { fontFamily } from '../../design-system/tokens';
import {
  Calendar, Users, Mail, TrendingUp,
  Clock, ChevronDown, Zap, AlertTriangle
} from 'lucide-react';

const MeetingPrepCard = () => {
  const [prepData, setPrepData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedMeeting, setExpandedMeeting] = useState(null);

  const fetchPrep = useCallback(async () => {
    try {
      const res = await apiClient.get('/calendar/prep-brief');
      setPrepData(res.data?.brief || res.data || null);
    } catch (e) {
      console.error('[MeetingPrepCard] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrep(); }, [fetchPrep]);

  if (loading) {
    return (
      <div className="p-4 rounded-xl animate-pulse" style={{ background: 'var(--bg-card)', height: 120 }} />
    );
  }

  const meetings = prepData?.meetings || prepData?.today_meetings || [];
  if (!meetings.length) {
    return (
      <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4" style={{ color: '#E85D00' }} />
          <span className="text-xs uppercase tracking-wider" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
            Meeting Prep
          </span>
        </div>
        <p className="text-sm" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>
          No meetings today. Your calendar is clear.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: '#E85D00' }} />
          <span className="text-xs uppercase tracking-wider" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
            Meeting Prep — Today
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(232, 93, 0, 0.12)', color: '#E85D00' }}>
            {meetings.length}
          </span>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
        {meetings.map((meeting, idx) => {
          const isExpanded = expandedMeeting === idx;
          const attendees = meeting.attendees || meeting.enriched_attendees || [];
          const startTime = meeting.start_time
            ? new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <div key={idx} className="px-5 py-3 cursor-pointer transition-all hover:bg-white/[0.02]"
              onClick={() => setExpandedMeeting(isExpanded ? null : idx)}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
                  <Clock className="w-4 h-4" style={{ color: '#3B82F6' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>
                      {meeting.subject || meeting.title || 'Meeting'}
                    </span>
                    {startTime && (
                      <span className="text-[10px] flex-shrink-0" style={{ color: '#708499', fontFamily: fontFamily.mono }}>
                        {startTime}
                      </span>
                    )}
                  </div>
                  {attendees.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Users className="w-3 h-3" style={{ color: '#708499' }} />
                      <span className="text-xs truncate" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>
                        {attendees.slice(0, 3).map(a => a.name || a.email || a).join(', ')}
                        {attendees.length > 3 && ` +${attendees.length - 3}`}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} style={{ color: '#708499' }} />
              </div>

              {isExpanded && (
                <div className="mt-3 ml-11 space-y-3">
                  {/* Attendee Intel */}
                  {attendees.filter(a => a.email_context || a.recent_emails).map((att, ai) => (
                    <div key={ai} className="p-3 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Mail className="w-3 h-3" style={{ color: '#3B82F6' }} />
                        <span className="text-xs font-medium" style={{ color: '#93C5FD', fontFamily: fontFamily.body }}>
                          {att.name || att.email}
                        </span>
                        {att.recent_email_count != null && (
                          <span className="text-[10px]" style={{ color: '#708499', fontFamily: fontFamily.mono }}>
                            {att.recent_email_count} recent emails
                          </span>
                        )}
                      </div>
                      {att.email_context?.last_topic && (
                        <p className="text-xs" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>
                          Last discussed: {att.email_context.last_topic}
                        </p>
                      )}
                      {att.crm_signals && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <TrendingUp className="w-3 h-3" style={{ color: '#22C55E' }} />
                          <span className="text-[10px]" style={{ color: '#86EFAC', fontFamily: fontFamily.mono }}>
                            {att.crm_signals.deal_status || att.crm_signals.stage || 'Active'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Meeting alerts */}
                  {meeting.alerts && meeting.alerts.length > 0 && (
                    <div className="space-y-1">
                      {meeting.alerts.map((alert, ai) => (
                        <div key={ai} className="flex items-center gap-2 text-xs">
                          <AlertTriangle className="w-3 h-3" style={{ color: '#F59E0B' }} />
                          <span style={{ color: '#FCD34D', fontFamily: fontFamily.body }}>{alert}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MeetingPrepCard;
