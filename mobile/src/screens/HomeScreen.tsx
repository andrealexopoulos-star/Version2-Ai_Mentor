/**
 * BIQc Mobile — Home Screen (Daily Brief)
 * Mobile-first command brief for SoundBoard users.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Card, SectionHeader, LoadingScreen, EmptyState } from '../components/ui';
import api, { auth } from '../lib/api';

export default function HomeScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [brief, setBrief] = useState<any>(null);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const storedUser = await auth.getUser();
      setUser(storedUser);
      const [userRes, briefRes, priorityRes, alertsRes, calendarRes] = await Promise.allSettled([
        api.get('/auth/check-profile'),
        api.get('/intelligence/brief'),
        api.get('/brain/priorities'),
        api.get('/notifications/alerts'),
        api.get('/outlook/calendar/events'),
      ]);

      if (userRes.status === 'fulfilled') setUser(userRes.value.data?.user || storedUser);
      if (briefRes.status === 'fulfilled') setBrief(briefRes.value.data);
      if (priorityRes.status === 'fulfilled') setPriorities(priorityRes.value.data?.concerns || []);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data?.notifications || []);
      if (calendarRes.status === 'fulfilled') {
        setCalendarEvents(Array.isArray(calendarRes.value.data) ? calendarRes.value.data : calendarRes.value.data?.events || []);
      }
    } catch {
      // keep UI graceful on mobile
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) return <LoadingScreen message="Loading your mobile brief..." />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const ownerName = user?.full_name?.split(' ')[0] || 'there';
  const topPriority = priorities[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.greeting}>Good {greeting}, {ownerName}.</Text>
      <Text style={styles.subtitle}>Your mobile BIQc brief — built for fast decisions and SoundBoard follow-through.</Text>

      <Card>
        <SectionHeader title="Daily Brief" subtitle={brief?.suppressed ? 'Attention protected' : 'Live intelligence summary'} />
        {brief?.suppressed ? (
          <Text style={styles.bodyText}>{brief.reason}</Text>
        ) : (
          <>
            <View style={styles.metricRow}>
              <View style={styles.metricPill}><Text style={styles.metricValue}>{brief?.summary?.actions_pending || 0}</Text><Text style={styles.metricLabel}>Actions pending</Text></View>
              <View style={styles.metricPill}><Text style={styles.metricValue}>{brief?.summary?.observations_new || 0}</Text><Text style={styles.metricLabel}>Observations</Text></View>
              <View style={styles.metricPill}><Text style={styles.metricValue}>{alerts.length}</Text><Text style={styles.metricLabel}>Alerts</Text></View>
            </View>
            <Text style={styles.bodyText}>{topPriority?.issue_brief || topPriority?.recommendation || 'Open SoundBoard and ask BIQc what matters most right now.'}</Text>
          </>
        )}
      </Card>

      <Card>
        <SectionHeader title="Top Priorities" subtitle="What BIQc wants you to handle next" />
        {priorities.length > 0 ? priorities.slice(0, 3).map((priority, index) => (
          <View key={`${priority.concern_id}-${index}`} style={styles.priorityRow}>
            <View style={styles.priorityDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.priorityTitle}>{priority.issue_brief || priority.name || priority.concern_id}</Text>
              <Text style={styles.priorityDetail}>{priority.action_brief || priority.recommendation || 'Open SoundBoard to turn this into an action plan.'}</Text>
            </View>
          </View>
        )) : <Text style={styles.bodyText}>No high-priority concern is active right now.</Text>}
      </Card>

      <Card>
        <SectionHeader title="Ask SoundBoard now" subtitle="Jump straight into the conversation with a useful prompt" />
        <View style={styles.promptRow}>
          {[
            'What needs my attention this week?',
            'How is my cash flow looking?',
            'What are my biggest risks right now?',
            'Which deals are at risk of stalling?',
          ].map((prompt) => (
            <TouchableOpacity
              key={prompt}
              style={styles.promptChip}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Chat', { prompt })}
            >
              <Text style={styles.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Execution Today" subtitle="Alerts and meetings in one glance" />
        <View style={styles.metricRow}>
          <View style={styles.metricPill}><Text style={styles.metricValue}>{alerts.length}</Text><Text style={styles.metricLabel}>Alerts</Text></View>
          <View style={styles.metricPill}><Text style={styles.metricValue}>{calendarEvents.length}</Text><Text style={styles.metricLabel}>Meetings</Text></View>
        </View>
        {calendarEvents.slice(0, 2).map((event, index) => (
          <View key={`${event.id || index}`} style={styles.calendarRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.priorityTitle}>{event.subject || 'Upcoming event'}</Text>
              <Text style={styles.priorityDetail}>{event.start ? new Date(event.start).toLocaleString() : 'Time unavailable'}</Text>
            </View>
          </View>
        ))}
      </Card>

      {!brief && !priorities.length && !alerts.length ? (
        <EmptyState
          icon={<Ionicons name="analytics-outline" size={32} color={theme.colors.textMuted} />}
          title="Connect your tools"
          subtitle="CRM, accounting, and email integrations unlock mobile BIQc intelligence."
        />
      ) : null}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  greeting: { fontFamily: theme.fonts.head, fontSize: 28, color: theme.colors.text, fontWeight: '600', marginBottom: 6 },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary, marginBottom: 20 },
  bodyText: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricPill: { flex: 1, padding: 12, backgroundColor: theme.colors.bg, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  metricValue: { fontFamily: theme.fonts.mono, fontSize: 22, color: theme.colors.brand, fontWeight: '700' },
  metricLabel: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted, textTransform: 'uppercase', marginTop: 4 },
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptChip: { backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  promptText: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  priorityRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  priorityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brand, marginTop: 6 },
  priorityTitle: { fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.text },
  priorityDetail: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 },
  calendarRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
});
