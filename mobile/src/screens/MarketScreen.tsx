/**
 * BIQc Mobile — Market Screen
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Card, MetricCard, SectionHeader, LoadingScreen, StatusBadge, EmptyState } from '../components/ui';
import api from '../lib/api';

export default function MarketScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [pressure, setPressure] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [snapRes, pressRes] = await Promise.allSettled([
        api.get('/snapshot/latest'),
        api.get('/intelligence/pressure'),
      ]);
      if (snapRes.status === 'fulfilled') setSnapshot(snapRes.value.data?.cognitive);
      if (pressRes.status === 'fulfilled') setPressure(pressRes.value.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) return <LoadingScreen message="Loading market signals..." />;

  const c = snapshot || {};
  const mi = c.market_intelligence || {};
  const ap = c.action_plan || {};
  const moves = ap.top_3_marketing_moves || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      showsVerticalScrollIndicator={false}>

      <SectionHeader title="Market Intelligence" subtitle="Positioning, pressure, and action priorities" />

      {/* Key Metrics */}
      <View style={styles.metricsRow}>
        <MetricCard label="Position" value={mi.positioning_verdict || '—'} color={mi.positioning_verdict === 'STABLE' ? theme.colors.success : theme.colors.warning} />
        <View style={{ width: 8 }} />
        <MetricCard label="Goal Prob" value={mi.probability_of_goal_achievement ? `${mi.probability_of_goal_achievement}%` : '—'} color={theme.colors.info} />
      </View>

      {/* Action Priorities */}
      {moves.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <SectionHeader title="Focus Actions" />
          {moves.map((m: any, i: number) => (
            <View key={i} style={styles.moveItem}>
              <Text style={styles.moveNumber}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.moveTitle}>{m.move}</Text>
                <Text style={styles.moveRationale}>{m.rationale}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Pressure */}
      {pressure?.pressures && (
        <Card>
          <SectionHeader title="Demand Pressure" />
          {Object.entries(pressure.pressures as Record<string, any>).map(([domain, p]) => {
            const color = p.level === 'critical' ? theme.colors.danger : p.level === 'elevated' ? theme.colors.brand : p.level === 'moderate' ? theme.colors.warning : theme.colors.success;
            return (
              <View key={domain} style={styles.pressureRow}>
                <Text style={styles.pressureDomain}>{domain}</Text>
                <StatusBadge status={p.level} color={color} />
                <Text style={styles.pressureEvents}>{p.events_14d} signals</Text>
              </View>
            );
          })}
        </Card>
      )}

      {!snapshot && (
        <EmptyState
          icon={<Ionicons name="compass-outline" size={32} color={theme.colors.textMuted} />}
          title="Complete calibration"
          subtitle="Market intelligence requires business calibration and integrations."
        />
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  metricsRow: { flexDirection: 'row', marginBottom: 4 },
  moveItem: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  moveNumber: { fontFamily: theme.fonts.mono, fontSize: 13, color: theme.colors.brand, fontWeight: '700', marginTop: 2 },
  moveTitle: { fontFamily: theme.fonts.head, fontSize: 14, color: theme.colors.text, fontWeight: '600' },
  moveRationale: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, lineHeight: 18 },
  pressureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  pressureDomain: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, flex: 1, textTransform: 'capitalize' },
  pressureEvents: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted },
});
