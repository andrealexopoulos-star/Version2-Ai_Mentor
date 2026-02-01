/**
 * Track A — Fast Evidence Extraction
 * Lightweight signal detection from business artifacts
 * NON-PERSISTENT, PROVISIONAL INTELLIGENCE ONLY
 */

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
      avgThreadAge: 0
    };
    
    // Detect recurring subjects (simple keyword matching)
    const subjectKeywords = {};
    allEmails.forEach(email => {
      const subject = (email.subject || '').toLowerCase();
      const words = subject.split(' ').filter(w => w.length > 4);
      
      words.forEach(word => {
        subjectKeywords[word] = (subjectKeywords[word] || 0) + 1;
      });
      
      // Detect unresolved (simple heuristic: no "Re:" or "FW:")
      if (!subject.startsWith('re:') && !subject.startsWith('fw:')) {
        evidence.unresolvedCount++;
      }
    });
    
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
 * Focuses on: meeting density, fragmentation, recurring patterns
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
      recurringCount: 0
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
      subjects[subject] = (subjects[subject] || 0) + 1;
    });
    
    evidence.recurringCount = Object.values(subjects).filter(count => count >= 2).length;
    
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
 */
export const generateFastInsight = (emailEvidence, calendarEvidence, crmEvidence, focusArea) => {
  const insights = [];
  
  // EMAIL INSIGHTS
  if (emailEvidence) {
    const recurringTopicCount = Object.keys(emailEvidence.recurringTopics).length;
    
    if (recurringTopicCount >= 2) {
      const topTopics = Object.entries(emailEvidence.recurringTopics)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([word]) => word);
      
      insights.push(`Certain topics keep surfacing—${topTopics.join(', ')}—but conversations around them don't seem to conclude quickly.`);
    }
    
    if (emailEvidence.unresolvedCount > emailEvidence.totalThreads * 0.6) {
      insights.push("More threads are being initiated than resolved. Things are accumulating rather than closing.");
    }
  }
  
  // CALENDAR INSIGHTS
  if (calendarEvidence) {
    if (calendarEvidence.fragmentationScore > 2) {
      insights.push("Time is fragmented. Meetings are happening frequently with little breathing room between them.");
    }
    
    if (calendarEvidence.avgDuration > 90) {
      insights.push("Meetings tend to run long. Time spent discussing appears disproportionate to decisions emerging.");
    }
  }
  
  // CRM INSIGHTS
  if (crmEvidence && crmEvidence.totalDeals > 0) {
    const stalledRatio = crmEvidence.stalledCount / crmEvidence.totalDeals;
    
    if (stalledRatio > 0.5) {
      insights.push("Most deals in the pipeline haven't moved recently. Activity seems concentrated on a few, while others sit idle.");
    }
  }
  
  // Return first 1-2 insights only (restrained)
  return insights.slice(0, 2);
};
