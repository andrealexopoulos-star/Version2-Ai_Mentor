/**
 * BIQc Mobile — Market Screen
 * Thin client: Fetches from /api/cognition/market only.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Card, SectionHeader, LoadingScreen, EmptyState } from '../components/ui';
import api from '../lib/api';

export default function MarketScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [market, setMarket] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [pressure, setPressure] = useState<any>(null);
  const [freshness, setFreshness] = useState<any>(null);
  const [watchtower, setWatchtower] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [marketRes, snapRes, pressureRes, freshnessRes, watchtowerRes] = await Promise.allSettled([
        api.get('/cognition/market'),
        api.get('/snapshot/latest'),
        api.get('/intelligence/pressure'),
        api.get('/intelligence/freshness'),
        api.get('/intelligence/watchtower'),
      ]);
      if (marketRes.status === 'fulfilled' && marketRes.value.data?.status !== 'MIGRATION_REQUIRED') {
        setMarket(marketRes.value.data);
      }
      if (snapRes.status === 'fulfilled') setSnapshot(snapRes.value.data?.cognitive);
      if (pressureRes.status === 'fulfilled') setPressure(pressureRes.value.data);
      if (freshnessRes.status === 'fulfilled') setFreshness(freshnessRes.value.data);
      if (watchtowerRes.status === 'fulfilled') setWatchtower(watchtowerRes.value.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) return <LoadingScreen message="Loading market intelligence..." />;

  const c = snapshot || {};
  const competitors = c.competitive_landscape?.competitors || [];
  const positioning = c.market_intelligence?.market_position || c.market_intelligence?.positioning;
  const digitalScore = c.digital_footprint?.score;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Market Intelligence</Text>

      {/* Digital Footprint Score */}
      {digitalScore != null && (
        <Card>
          <View style={styles.scoreRow}>
            <View>
              <Text style={styles.scoreLabel}>Digital Footprint</Text>
              <Text style={styles.scoreSubLabel}>visibility score</Text>
            </View>
            <Text style={[styles.scoreValue, { color: digitalScore > 60 ? theme.colors.success : theme.colors.warning }]}>{digitalScore}/100</Text>
          </View>
        </Card>
      )}

      {(pressure?.pressures || freshness?.freshness) && (
        <Card>
          <SectionHeader title="Evidence Health" subtitle="Pressure + freshness from live BIQc sources" />
          {pressure?.pressures && Object.entries(pressure.pressures).slice(0, 3).map(([domain, value]: any) => (
            <Text key={domain} style={styles.bodyText}>{domain}: {value.level} pressure · {value.events_14d} signals</Text>
          ))}
          {freshness?.freshness && Object.entries(freshness.freshness).filter(([, value]: any) => value.status !== 'no_data').slice(0, 2).map(([domain, value]: any) => (
            <Text key={domain} style={[styles.bodyText, { marginTop: 6 }]}>{domain}: {value.status} evidence</Text>
          ))}
        </Card>
      )}

      {/* Market Position */}
      {positioning && (
        <Card>
          <SectionHeader title="Market Position" />
          <Text style={styles.bodyText}>{typeof positioning === 'string' ? positioning : JSON.stringify(positioning)}</Text>
        </Card>
      )}

      {/* Cognition Market Data */}
      {market && market.signals && (
        <Card>
          <SectionHeader title="Market Signals" subtitle="From cognition engine" />
          {(Array.isArray(market.signals) ? market.signals : []).slice(0, 5).map((signal: any, i: number) => (
            <View key={i} style={styles.signalItem}>
              <View style={[styles.severityDot, { backgroundColor: signal.severity === 'high' ? theme.colors.danger : signal.severity === 'medium' ? theme.colors.warning : theme.colors.success }]} />
              <Text style={styles.signalText}>{signal.title || signal.message || JSON.stringify(signal)}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Competitors */}
      {competitors.length > 0 && (
        <Card>
          <SectionHeader title="Competitive Landscape" />
          {competitors.slice(0, 5).map((comp: any, i: number) => (
            <View key={i} style={styles.competitorItem}>
              <Text style={styles.competitorName}>{comp.name || comp}</Text>
              {comp.threat_level && (
                <Text style={[styles.threatBadge, { color: comp.threat_level === 'high' ? theme.colors.danger : theme.colors.warning }]}>
                  {comp.threat_level}
                </Text>
              )}
            </View>
          ))}
        </Card>
      )}

      {watchtower?.events?.length > 0 && (
        <Card>
          <SectionHeader title="External Signals" subtitle="Latest market-facing watchtower events" />
          {watchtower.events.slice(0, 3).map((event: any, i: number) => (
            <View key={`${event.id || i}`} style={styles.signalItem}>
              <View style={[styles.severityDot, { backgroundColor: event.severity === 'high' ? theme.colors.danger : event.severity === 'medium' ? theme.colors.warning : theme.colors.success }]} />
              <Text style={styles.signalText}>{event.title || event.signal || 'External market signal'}</Text>
            </View>
          ))}
        </Card>
      )}

      {!snapshot && !market && (
        <EmptyState
          icon={<Ionicons name="compass-outline" size={32} color={theme.colors.textMuted} />}
          title="No market data yet"
          subtitle="Complete calibration to unlock market intelligence."
        />
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  title: { fontFamily: theme.fonts.head, fontSize: 28, color: theme.colors.text, fontWeight: '600', marginBottom: 20 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { fontSize: 16, color: theme.colors.text, fontWeight: '600' },
  scoreSubLabel: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  scoreValue: { fontFamily: theme.fonts.mono, fontSize: 28, fontWeight: '700' },
  bodyText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },
  signalItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  severityDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  signalText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },
  competitorItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  competitorName: { fontSize: 14, color: theme.colors.text },
  threatBadge: { fontFamily: theme.fonts.mono, fontSize: 10, textTransform: 'uppercase' },
});
