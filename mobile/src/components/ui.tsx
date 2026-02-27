/**
 * BIQc Mobile — Reusable Components
 */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../theme';

// ═══ CARD ═══
export const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[styles.card, style]}>{children}</View>
);

// ═══ METRIC CARD ═══
export const MetricCard = ({ label, value, color, suffix }: { label: string; value: string | number; color?: string; suffix?: string }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={[styles.metricValue, { color: color || theme.colors.text }]}>{value}</Text>
      {suffix && <Text style={styles.metricSuffix}>{suffix}</Text>}
    </View>
  </View>
);

// ═══ STATUS BADGE ═══
export const StatusBadge = ({ status, color }: { status: string; color: string }) => (
  <View style={[styles.badge, { backgroundColor: color + '15' }]}>
    <Text style={[styles.badgeText, { color }]}>{status}</Text>
  </View>
);

// ═══ SECTION HEADER ═══
export const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
  </View>
);

// ═══ BUTTON ═══
export const Button = ({ title, onPress, loading, variant = 'primary', style }: {
  title: string; onPress: () => void; loading?: boolean; variant?: 'primary' | 'secondary' | 'ghost'; style?: any;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.7}
    style={[styles.button, variant === 'primary' && styles.buttonPrimary, variant === 'ghost' && styles.buttonGhost, style]}
  >
    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.buttonText, variant === 'ghost' && { color: theme.colors.textMuted }]}>{title}</Text>}
  </TouchableOpacity>
);

// ═══ LOADING SCREEN ═══
export const LoadingScreen = ({ message }: { message?: string }) => (
  <View style={styles.loadingScreen}>
    <ActivityIndicator size="large" color={theme.colors.brand} />
    {message && <Text style={styles.loadingText}>{message}</Text>}
  </View>
);

// ═══ EMPTY STATE ═══
export const EmptyState = ({ icon, title, subtitle, actionLabel, onAction }: {
  icon?: React.ReactNode; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void;
}) => (
  <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
    {icon}
    <Text style={[styles.sectionTitle, { marginTop: 12, textAlign: 'center' }]}>{title}</Text>
    {subtitle && <Text style={[styles.sectionSubtitle, { textAlign: 'center', marginTop: 4 }]}>{subtitle}</Text>}
    {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} style={{ marginTop: 16 }} />}
  </Card>
);

// ═══ RISK GAUGE ═══
export const RiskGauge = ({ value, label, thresholds = [0.33, 0.66] }: { value: number; label: string; thresholds?: number[] }) => {
  const color = value >= thresholds[1] ? theme.colors.danger : value >= thresholds[0] ? theme.colors.warning : theme.colors.success;
  const width = Math.min(value * 100, 100);
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color, fontSize: 28 }]}>{(value * 100).toFixed(0)}%</Text>
      <View style={[styles.gaugeTrack, { backgroundColor: color + '20' }]}>
        <View style={[styles.gaugeFill, { width: `${width}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  metricCard: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    flex: 1,
  },
  metricLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: theme.fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  metricSuffix: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 2,
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  badgeText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.fonts.head,
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  button: {
    height: 44,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.brand,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 14,
    color: '#fff',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
  gaugeTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  gaugeFill: {
    height: 4,
    borderRadius: 2,
  },
});
