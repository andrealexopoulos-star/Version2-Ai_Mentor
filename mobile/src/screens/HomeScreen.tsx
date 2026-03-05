/**
 * BIQc Mobile — Home Screen (Cognition Overview)
 * Thin client: Fetches from /api/cognition/overview only.
 * All intelligence computed by backend.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Card, StatusBadge, SectionHeader, LoadingScreen, EmptyState } from '../components/ui';
import api from '../lib/api';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  STABLE: { label: 'Stable', color: theme.colors.success },
  DRIFT: { label: 'Drifting', color: theme.colors.warning },
  COMPRESSION: { label: 'Under Pressure', color: theme.colors.brand },
  CRITICAL: { label: 'Critical', color: theme.colors.danger },
  on_track: { label: 'On Track', color: theme.colors.success },
};

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cognition, setCognition] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch user profile
      const [userRes, cognitionRes, snapRes] = await Promise.allSettled([
        api.get('/auth/check-profile'),
        api.get('/cognition/overview'),
        api.get('/snapshot/latest'),
      ]);

      if (userRes.status === 'fulfilled') setUser(userRes.value.data?.user);
      if (cognitionRes.status === 'fulfilled' && cognitionRes.value.data?.status !== 'MIGRATION_REQUIRED') {
        setCognition(cognitionRes.value.data);
      }
      if (snapRes.status === 'fulfilled') setSnapshot(snapRes.value.data?.cognitive);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) return <LoadingScreen message="Loading intelligence..." />;

  const c = snapshot || {};
  const stateStatus = typeof c.system_state === 'object' ? c.system_state?.status : c.system_state;
  const st = STATUS_MAP[stateStatus] || STATUS_MAP.STABLE;
  const interpretation = typeof c.system_state === 'object' ? c.system_state?.interpretation : null;
  const memo = c.executive_memo || c.memo || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const ownerName = user?.full_name?.split(' ')[0] || 'there';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <Text style={styles.greeting}>Good {greeting}, {ownerName}.</Text>

      {/* Status Banner */}
      <View style={[styles.statusBanner, { borderColor: st.color + '30' }]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
          <Text style={[styles.statusLabel, { color: st.color }]}>{snapshot ? st.label : 'Waiting for data'}</Text>
        </View>
        {interpretation && <Text style={styles.statusDetail}>{interpretation}</Text>}
      </View>

      {/* Cognition Indices (from backend) */}
      {cognition && cognition.indices && (
        <Card>
          <SectionHeader title="Instability Indices" subtitle="Backend-computed intelligence" />
          <View style={styles.indicesGrid}>
            {Object.entries(cognition.indices).map(([key, value]: [string, any]) => (
              <View key={key} style={styles.indexItem}>
                <Text style={styles.indexValue}>{typeof value === 'number' ? (value * 100).toFixed(0) + '%' : String(value)}</Text>
                <Text style={styles.indexLabel}>{key.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Executive Memo */}
      {memo ? (
        <Card>
          <View style={styles.memoHeader}>
            <Ionicons name="flash" size={14} color={theme.colors.brand} />
            <Text style={styles.memoTitle}>Executive Brief</Text>
          </View>
          <Text style={styles.memoText}>{memo.substring(0, 400)}{memo.length > 400 ? '...' : ''}</Text>
        </Card>
      ) : (
        <EmptyState
          icon={<Ionicons name="analytics-outline" size={32} color={theme.colors.textMuted} />}
          title="Connect your tools"
          subtitle="CRM, accounting, and email integrations unlock intelligence."
        />
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  greeting: { fontFamily: theme.fonts.head, fontSize: 28, color: theme.colors.text, fontWeight: '600', marginBottom: 20 },
  statusBanner: { borderRadius: theme.radius.lg, borderWidth: 1, padding: theme.spacing.lg, marginBottom: theme.spacing.md, backgroundColor: theme.colors.bgCard },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 16, fontWeight: '600', flex: 1 },
  statusDetail: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 8, lineHeight: 20 },
  indicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  indexItem: { width: '46%', backgroundColor: theme.colors.bg, borderRadius: theme.radius.md, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  indexValue: { fontFamily: theme.fonts.mono, fontSize: 20, fontWeight: '700', color: theme.colors.text },
  indexLabel: { fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.textMuted, textTransform: 'uppercase', marginTop: 4 },
  memoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  memoTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  memoText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },
});
