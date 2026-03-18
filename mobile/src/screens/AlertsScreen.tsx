/**
 * BIQc Mobile — Alerts Screen
 * Thin client: Fetches from /api/notifications/alerts.
 * All alert logic computed by backend.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Card, LoadingScreen, EmptyState } from '../components/ui';
import api from '../lib/api';

const SEVERITY_MAP: Record<string, { color: string; icon: string }> = {
  high: { color: theme.colors.danger, icon: 'alert-circle' },
  medium: { color: theme.colors.warning, icon: 'warning' },
  low: { color: theme.colors.info, icon: 'information-circle' },
  critical: { color: theme.colors.danger, icon: 'alert-circle' },
};

export default function AlertsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const alertsRes = await api.get('/notifications/alerts');
      setAlerts(alertsRes.data?.notifications || []);
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Alerts</Text>
      <Text style={styles.subtitle}>{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</Text>

      {alerts.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="checkmark-circle-outline" size={32} color={theme.colors.success} />}
          title="All clear"
          subtitle="No active BIQc alerts right now. Daily brief and push notifications will keep you updated."
        />
      ) : (
        alerts.map((alert) => {
          const sev = SEVERITY_MAP[alert.severity] || SEVERITY_MAP.low;
          return (
            <TouchableOpacity key={alert.id} activeOpacity={0.7}>
              <View style={[styles.alertCard, { borderLeftColor: sev.color }]}>
                <View style={styles.alertHeader}>
                  <Ionicons name={sev.icon as any} size={16} color={sev.color} />
                  <Text style={[styles.alertSeverity, { color: sev.color }]}>{alert.severity}</Text>
                  {alert.domain && <Text style={styles.alertDomain}>{alert.domain}</Text>}
                </View>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                {alert.recommendation && <Text style={styles.alertRec}>{alert.recommendation}</Text>}
                {alert.created_at && (
                  <Text style={styles.alertTime}>{new Date(alert.created_at).toLocaleDateString()}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  title: { fontFamily: theme.fonts.head, fontSize: 28, color: theme.colors.text, fontWeight: '600' },
  subtitle: { fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted, marginTop: 4, marginBottom: 20, textTransform: 'uppercase', letterSpacing: 0.5 },
  alertCard: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 3, padding: 16, marginBottom: 12 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  alertSeverity: { fontFamily: theme.fonts.mono, fontSize: 10, textTransform: 'uppercase', fontWeight: '700' },
  alertDomain: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted, marginLeft: 'auto', textTransform: 'uppercase' },
  alertTitle: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  alertRec: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 18, fontStyle: 'italic' },
  alertTime: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted, marginTop: 8 },
});
