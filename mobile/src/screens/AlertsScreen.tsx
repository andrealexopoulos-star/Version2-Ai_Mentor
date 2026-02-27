/**
 * BIQc Mobile — Alerts Screen
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Card, SectionHeader, LoadingScreen, EmptyState, StatusBadge } from '../components/ui';
import api from '../lib/api';

export default function AlertsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [silence, setSilence] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [evRes, silRes] = await Promise.allSettled([
        api.get('/spine/events'),
        api.get('/intelligence/silence'),
      ]);
      if (evRes.status === 'fulfilled') setEvents(evRes.value.data?.events || []);
      if (silRes.status === 'fulfilled') setSilence(silRes.value.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) return <LoadingScreen message="Loading alerts..." />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      showsVerticalScrollIndicator={false}>

      <SectionHeader title="Intelligence Alerts" subtitle="Spine events and silence detection" />

      {/* Silence Warning */}
      {silence && silence.silence_level !== 'active' && (
        <Card style={{ borderColor: theme.colors.warning + '40' }}>
          <View style={styles.silenceRow}>
            <Ionicons name="alert-circle" size={18} color={theme.colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.silenceTitle}>Activity Warning</Text>
              <Text style={styles.silenceText}>
                {silence.days_silent > 7 ? `No platform activity for ${Math.round(silence.days_silent)} days.` : `${silence.unactioned_high || 0} high-priority signals need attention.`}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Events */}
      {events.length > 0 ? (
        events.slice(0, 20).map((ev: any) => {
          const color = ev.event_type?.includes('ANOMALY') ? theme.colors.danger : ev.event_type?.includes('FORECAST') ? theme.colors.info : theme.colors.success;
          return (
            <View key={ev.id} style={styles.eventRow}>
              <View style={[styles.eventDot, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventType}>{ev.event_type}</Text>
                {ev.model_name && <Text style={styles.eventModel}>{ev.model_name}</Text>}
              </View>
              <Text style={styles.eventTime}>
                {ev.created_at ? new Date(ev.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }) : ''}
              </Text>
            </View>
          );
        })
      ) : (
        <EmptyState
          icon={<Ionicons name="notifications-off-outline" size={32} color={theme.colors.textMuted} />}
          title="No alerts"
          subtitle="Enable the Intelligence Spine to start receiving alerts."
        />
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  silenceRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  silenceTitle: { fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.warning },
  silenceText: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  eventDot: { width: 6, height: 6, borderRadius: 3 },
  eventType: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text },
  eventModel: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },
  eventTime: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted },
});
