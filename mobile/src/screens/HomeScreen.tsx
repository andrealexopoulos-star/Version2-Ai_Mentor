/**
 * BIQc Mobile — Home Screen (Advisor/Overview)
 * ChatGPT-grade: clean, minimal, data-driven
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Card, MetricCard, StatusBadge, SectionHeader, LoadingScreen, EmptyState, RiskGauge } from '../components/ui';
import api from '../lib/api';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  STABLE: { label: 'On Track', color: theme.colors.success },
  DRIFT: { label: 'Slipping', color: theme.colors.warning },
  COMPRESSION: { label: 'Under Pressure', color: theme.colors.brand },
  CRITICAL: { label: 'At Risk', color: theme.colors.danger },
};

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [riskBaseline, setRiskBaseline] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [snapRes, riskRes] = await Promise.allSettled([
        api.get('/snapshot/latest'),
        api.post('/spine/risk-baseline'),
      ]);
      if (snapRes.status === 'fulfilled') setSnapshot(snapRes.value.data?.cognitive);
      if (riskRes.status === 'fulfilled' && riskRes.value.data?.status === 'computed') setRiskBaseline(riskRes.value.data);
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
  const goalProb = c.market_intelligence?.probability_of_goal_achievement;
  const memo = c.executive_memo || c.memo || '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: st.color + '08', borderColor: st.color + '25' }]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
          <Text style={[styles.statusLabel, { color: st.color }]}>{snapshot ? st.label : 'Waiting for data'}</Text>
          <StatusBadge status={stateStatus || 'STABLE'} color={st.color} />
        </View>
        {interpretation && <Text style={styles.statusDetail}>{interpretation}</Text>}
      </View>

      {/* Risk Baseline */}
      {riskBaseline && (
        <Card>
          <SectionHeader title="Risk Baseline" subtitle="Deterministic 4-index composite" />
          <View style={styles.metricsRow}>
            <RiskGauge value={riskBaseline.indices?.revenue_volatility_index || 0} label="Revenue" />
            <View style={{ width: 8 }} />
            <RiskGauge value={riskBaseline.indices?.engagement_decay_score || 0} label="Engage" />
          </View>
          <View style={[styles.metricsRow, { marginTop: 8 }]}>
            <RiskGauge value={riskBaseline.indices?.cash_deviation_ratio || 0} label="Cash" />
            <View style={{ width: 8 }} />
            <RiskGauge value={riskBaseline.indices?.anomaly_density_score || 0} label="Anomaly" />
          </View>
          <View style={[styles.compositeBar, { marginTop: 16 }]}>
            <Text style={styles.compositeLabel}>Composite Risk</Text>
            <View style={styles.compositeRight}>
              <Text style={[styles.compositeScore, { color: riskBaseline.composite?.risk_band === 'HIGH' ? theme.colors.danger : riskBaseline.composite?.risk_band === 'MODERATE' ? theme.colors.warning : theme.colors.success }]}>
                {((riskBaseline.composite?.risk_score || 0) * 100).toFixed(0)}%
              </Text>
              <StatusBadge status={riskBaseline.composite?.risk_band || 'LOW'} color={riskBaseline.composite?.risk_band === 'HIGH' ? theme.colors.danger : riskBaseline.composite?.risk_band === 'MODERATE' ? theme.colors.warning : theme.colors.success} />
            </View>
          </View>
        </Card>
      )}

      {/* Goal Achievement */}
      {goalProb != null && (
        <Card>
          <View style={styles.goalRow}>
            <View>
              <Text style={styles.goalLabel}>Goal Achievement</Text>
              <Text style={styles.goalSubLabel}>probability at current pace</Text>
            </View>
            <Text style={[styles.goalValue, { color: goalProb > 60 ? theme.colors.success : theme.colors.warning }]}>{goalProb}%</Text>
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
          <Text style={styles.memoText}>{memo.substring(0, 300)}{memo.length > 300 ? '...' : ''}</Text>
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
  statusBanner: { borderRadius: theme.radius.lg, borderWidth: 1, padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 16, fontFamily: theme.fonts.head, fontWeight: '600', flex: 1 },
  statusDetail: { fontSize: 13, fontFamily: theme.fonts.body, color: theme.colors.textSecondary, marginTop: 8, lineHeight: 20 },
  metricsRow: { flexDirection: 'row' },
  compositeBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.bg, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  compositeLabel: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted, textTransform: 'uppercase' },
  compositeRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compositeScore: { fontFamily: theme.fonts.mono, fontSize: 24, fontWeight: '700' },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalLabel: { fontFamily: theme.fonts.head, fontSize: 16, color: theme.colors.text },
  goalSubLabel: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  goalValue: { fontFamily: theme.fonts.mono, fontSize: 32, fontWeight: '700' },
  memoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  memoTitle: { fontFamily: theme.fonts.head, fontSize: 14, fontWeight: '600', color: theme.colors.text },
  memoText: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },
});
