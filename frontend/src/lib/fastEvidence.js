/**
 * Track A — Fast Evidence Extraction
 * Lightweight signal detection from business artifacts
 * NON-PERSISTENT, PROVISIONAL INTELLIGENCE ONLY
 */

/**
 * Create deterministic insight ID
 */
const createInsightId = (type, subtype) => {
  return `track_a_${type}_${subtype}`;
};

/**
 * Hash string to 6-char identifier (for subject anonymization)
 */
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 6);
};

/**
 * Extract lightweight email evidence
 * Does NOT parse email bodies
 * Focuses on: subjects, thread patterns, response latency
 */
export const extractEmailEvidence = async (apiClient) => {
  try {
    const response = await apiClient.get('/email/priority-inbox');
    const analysis = response.data;
    
    if (!analysis || !analysis.high_priority) {
      return null;
    }
    
    const allEmails = [
      ...(analysis.high_priority || []),
      ...(analysis.medium_priority || []),
      ...(analysis.low_priority || [])
    ];
    
    if (allEmails.length === 0) return null;
    
    // LIGHT EVIDENCE ONLY
    const evidence = {
      totalThreads: allEmails.length,
      unresolvedCount: 0,
      recurringTopics: {},
      avgThreadAge: 0,
      hashedSubjects: [], // For trace only
      reopenedThreads: 0 // NEW: for reopened conversations detection
    };
    
    // Detect recurring subjects and reopened patterns
    const subjectKeywords = {};
    const threadPatterns = {};
    
    allEmails.forEach(email => {
      const subject = (email.subject || '').toLowerCase();
      const words = subject.split(' ').filter(w => w.length > 4);
      const hashedSubject = hashString(subject);
      
      // Store hashed subject for trace
      evidence.hashedSubjects.push(hashedSubject);
      
      words.forEach(word => {
        subjectKeywords[word] = (subjectKeywords[word] || 0) + 1;
      });
      
      // NEW: Track thread patterns for reopened detection
      // If subject starts with "Re:" it's a continuation
      if (subject.startsWith('re:')) {
        const baseSubject = subject.replace(/^re:\s*/i, '').trim();
        const baseHash = hashString(baseSubject);
        threadPatterns[baseHash] = (threadPatterns[baseHash] || 0) + 1;
      }
      
      // Detect unresolved (simple heuristic: no "Re:" or "FW:")
      if (!subject.startsWith('re:') && !subject.startsWith('fw:')) {
        evidence.unresolvedCount++;
      }
    });
    
    // NEW: Count reopened threads (threads with 3+ messages, indicating continuation)
    evidence.reopenedThreads = Object.values(threadPatterns).filter(count => count >= 3).length;
    
    // Find recurring topics (keywords appearing 3+ times)
    evidence.recurringTopics = Object.entries(subjectKeywords)
      .filter(([word, count]) => count >= 3)
      .reduce((acc, [word, count]) => {
        acc[word] = count;
        return acc;
      }, {});
    
    return evidence;
    
  } catch (error) {
    console.error('Email evidence extraction failed:', error);
    return null;
  }
};

/**
 * Extract lightweight calendar evidence
 * Focuses on: meeting density, fragmentation, recurring patterns, decision deferral
 */
export const extractCalendarEvidence = async (apiClient) => {
  try {
    const response = await apiClient.get('/outlook/calendar/events');
    const events = response.data?.value || response.data?.events || [];
    
    if (events.length === 0) return null;
    
    // LIGHT EVIDENCE ONLY
    const evidence = {
      totalMeetings: events.length,
      avgDuration: 0,
      fragmentationScore: 0,
      recurringCount: 0,
      meetingCycles: 0 // NEW: for decision deferral detection
    };
    
    // Calculate average duration
    const durations = events.map(e => {
      if (!e.start_time || !e.end_time) return 0;
      const start = new Date(e.start_time);
      const end = new Date(e.end_time);
      return (end - start) / (1000 * 60); // minutes
    }).filter(d => d > 0);
    
    if (durations.length > 0) {
      evidence.avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }
    
    // Detect recurring meetings (simple: same subject appears multiple times)
    const subjects = {};
    events.forEach(e => {
      const subject = (e.subject || '').toLowerCase();
      const hashedSubject = hashString(subject);
      subjects[hashedSubject] = (subjects[hashedSubject] || 0) + 1;
    });
    
    evidence.recurringCount = Object.values(subjects).filter(count => count >= 2).length;
    
    // NEW: Detect meeting cycles (same topic recurring 3+ times)
    evidence.meetingCycles = Object.values(subjects).filter(count => count >= 3).length;
    
    // Simple fragmentation: ratio of meetings to days
    const daysSpan = 21; // default range
    evidence.fragmentationScore = events.length / daysSpan;
    
    return evidence;
    
  } catch (error) {
    console.error('Calendar evidence extraction failed:', error);
    return null;
  }
};

/**
 * Extract lightweight CRM evidence  
 * Focuses on: deal velocity, stage time, activity recency
 */
export const extractCRMEvidence = async (apiClient) => {
  try {
    const response = await apiClient.get('/integrations/crm/deals');
    const deals = response.data?.results || [];
    
    if (deals.length === 0) return null;
    
    // LIGHT EVIDENCE ONLY
    const evidence = {
      totalDeals: deals.length,
      stalledCount: 0,
      activeCount: 0
    };
    
    const now = new Date();
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    deals.forEach(deal => {
      const lastActivity = deal.last_activity_at ? new Date(deal.last_activity_at) : null;
      
      // Stalled: no activity in 7+ days
      if (!lastActivity || lastActivity < oneWeekAgo) {
        evidence.stalledCount++;
      } else {
        evidence.activeCount++;
      }
    });
    
    return evidence;
    
  } catch (error) {
    console.error('CRM evidence extraction failed:', error);
    return null;
  }
};

/**
 * Generate provisional insight from evidence
 * OBSERVATIONAL ONLY — no conclusions, no advice
 * Each insight includes evidence_trace for developer verification
 * REFINEMENT: Requires 2+ reinforcing signals for higher confidence
 */
export const generateFastInsight = (emailEvidence, calendarEvidence, crmEvidence, focusArea) => {
  const insights = [];
  const now = new Date();
  const timeWindow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Count reinforcing signals for confidence weighting
  let reinforcingSignals = 0;
  
  // EMAIL INSIGHTS
  if (emailEvidence) {
    const recurringTopicCount = Object.keys(emailEvidence.recurringTopics).length;
    
    // EXISTING: Recurring unresolved topics
    if (recurringTopicCount >= 2 && emailEvidence.unresolvedCount > 5) {
      reinforcingSignals++;
      const topTopics = Object.entries(emailEvidence.recurringTopics)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([word]) => word);
      
      insights.push({
        text: `Certain topics keep surfacing—${topTopics.join(', ')}—but conversations around them don't seem to conclude quickly.`,
        evidence_trace: {
          insight_id: createInsightId('email', 'recurring_unresolved'),
          source_types: ['email'],
          evidence_counters: {
            total_threads: emailEvidence.totalThreads,
            recurring_topic_count: recurringTopicCount,
            unresolved_count: emailEvidence.unresolvedCount
          },
          evidence_window: timeWindow,
          confidence_bucket: recurringTopicCount >= 3 ? 'medium' : 'low',
          hashed_subjects_sample: emailEvidence.hashedSubjects.slice(0, 5)
        }
      });
    }
    
    // EXISTING: Thread accumulation (REFINED: requires unresolved ratio AND absolute count)
    if (emailEvidence.unresolvedCount > emailEvidence.totalThreads * 0.6 && emailEvidence.unresolvedCount > 8) {
      reinforcingSignals++;
      insights.push({
        text: "More threads are being initiated than resolved. Things are accumulating rather than closing.",
        evidence_trace: {
          insight_id: createInsightId('email', 'accumulation'),
          source_types: ['email'],
          evidence_counters: {
            total_threads: emailEvidence.totalThreads,
            unresolved_count: emailEvidence.unresolvedCount,
            unresolved_ratio: Math.round((emailEvidence.unresolvedCount / emailEvidence.totalThreads) * 100)
          },
          evidence_window: timeWindow,
          confidence_bucket: emailEvidence.unresolvedCount > 10 ? 'medium' : 'low'
        }
      });
    }
    
    // NEW INSIGHT 1: Reopened conversations
    if (emailEvidence.reopenedThreads >= 3) {
      reinforcingSignals++;
      insights.push({
        text: "Some conversations are resurfacing after going quiet, rather than reaching a clear close.",
        evidence_trace: {
          insight_id: createInsightId('email', 'reopened_conversations'),
          source_types: ['email'],
          evidence_counters: {
            total_threads: emailEvidence.totalThreads,
            reopened_threads_count: emailEvidence.reopenedThreads,
            average_gap_bucket: 'multi-day' // Simplified bucket
          },
          evidence_window: timeWindow,
          confidence_bucket: emailEvidence.reopenedThreads >= 5 ? 'medium' : 'low'
        }
      });
    }
  }
  
  // CALENDAR INSIGHTS (REFINED: require minimum meeting count)
  if (calendarEvidence) {
    if (calendarEvidence.fragmentationScore > 2 && calendarEvidence.totalMeetings > 10) {
      reinforcingSignals++;
      insights.push({
        text: "Time is fragmented. Meetings are happening frequently with little breathing room between them.",
        evidence_trace: {
          insight_id: createInsightId('calendar', 'fragmentation'),
          source_types: ['calendar'],
          evidence_counters: {
            total_meetings: calendarEvidence.totalMeetings,
            fragmentation_score: Math.round(calendarEvidence.fragmentationScore * 10) / 10,
            recurring_count: calendarEvidence.recurringCount
          },
          evidence_window: timeWindow,
          confidence_bucket: calendarEvidence.fragmentationScore > 3 ? 'medium' : 'low'
        }
      });
    }
    
    if (calendarEvidence.avgDuration > 90 && calendarEvidence.totalMeetings > 5) {
      reinforcingSignals++;
      insights.push({
        text: "Meetings tend to run long. Time spent discussing appears disproportionate to decisions emerging.",
        evidence_trace: {
          insight_id: createInsightId('calendar', 'duration'),
          source_types: ['calendar'],
          evidence_counters: {
            total_meetings: calendarEvidence.totalMeetings,
            avg_duration_minutes: calendarEvidence.avgDuration
          },
          evidence_window: timeWindow,
          confidence_bucket: calendarEvidence.avgDuration > 120 ? 'medium' : 'low'
        }
      });
    }
  }
  
  // NEW INSIGHT 2: Decision deferral pattern (EMAIL + CALENDAR cross-signal)
  if (emailEvidence && calendarEvidence && emailEvidence.reopenedThreads >= 2 && calendarEvidence.meetingCycles >= 1) {
    reinforcingSignals++;
    insights.push({
      text: "Time is being spent revisiting topics rather than narrowing them toward decisions.",
      evidence_trace: {
        insight_id: createInsightId('cross', 'decision_deferral_pattern'),
        source_types: ['email', 'calendar'],
        evidence_counters: {
          meeting_cycles_count: calendarEvidence.meetingCycles,
          reopened_threads: emailEvidence.reopenedThreads,
          continuation_after_meetings: true
        },
        evidence_window: timeWindow,
        confidence_bucket: (calendarEvidence.meetingCycles >= 2 && emailEvidence.reopenedThreads >= 3) ? 'medium' : 'low'
      }
    });
  }
  
  // CRM INSIGHTS (REFINED: require minimum deal count)
  if (crmEvidence && crmEvidence.totalDeals > 5) {
    const stalledRatio = crmEvidence.stalledCount / crmEvidence.totalDeals;
    
    if (stalledRatio > 0.5) {
      reinforcingSignals++;
      insights.push({
        text: "Most deals in the pipeline haven't moved recently. Activity seems concentrated on a few, while others sit idle.",
        evidence_trace: {
          insight_id: createInsightId('crm', 'stalled_deals'),
          source_types: ['crm'],
          evidence_counters: {
            total_deals: crmEvidence.totalDeals,
            stalled_count: crmEvidence.stalledCount,
            active_count: crmEvidence.activeCount,
            stalled_ratio_pct: Math.round(stalledRatio * 100)
          },
          evidence_window: timeWindow,
          confidence_bucket: crmEvidence.totalDeals > 10 ? 'medium' : 'low'
        }
      });
    }
  }
  
  // CONFIDENCE REFINEMENT: Filter insights to those with higher confidence when multiple signals present
  // If 2+ reinforcing signals, prioritize medium confidence insights
  let filteredInsights = insights;
  if (reinforcingSignals >= 2) {
    const mediumConfidence = insights.filter(i => i.evidence_trace.confidence_bucket === 'medium');
    if (mediumConfidence.length > 0) {
      filteredInsights = mediumConfidence;
    }
  }
  
  // Developer trace logging (dev mode only)
  if (process.env.NODE_ENV !== 'production' && filteredInsights.length > 0) {
    /* console.debug('[TRACK A] Evidence Trace:', {
      generated_at: now.toISOString(),
      reinforcing_signals: reinforcingSignals,
      total_insights_generated: insights.length,
      insights_after_filtering: filteredInsights.length,
      insights: filteredInsights.map(i => ({
        text_preview: i.text.substring(0, 50) + '...',
        trace: i.evidence_trace
      }))
    }); */
  }
  
  // Return first 1-2 insights only (restrained)
  return filteredInsights.slice(0, 2);
};
