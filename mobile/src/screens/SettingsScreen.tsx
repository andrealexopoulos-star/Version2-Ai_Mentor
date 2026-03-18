/**
 * BIQc Mobile — Settings Screen
 * Thin client: Fetches from /api/auth/check-profile and /api/user/settings.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Card, LoadingScreen } from '../components/ui';
import api, { auth } from '../lib/api';

export default function SettingsScreen({ onLogout }: { onLogout: () => void }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const effectiveTier = (profile?.role === 'superadmin' || profile?.role === 'admin' || profile?.is_master_account)
    ? 'custom'
    : (profile?.subscription_tier || 'free');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/check-profile');
        setProfile(res.data?.user || res.data);
      } catch {} finally { setLoading(false); }
    };
    fetchProfile();
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await auth.logout();
          onLogout();
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading settings..." />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Settings</Text>

      {/* Profile Card */}
      <Card>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'User'}</Text>
            <Text style={styles.profileEmail}>{profile?.email || ''}</Text>
          </View>
        </View>
        {profile?.company_name && (
          <View style={styles.profileRow}>
            <Ionicons name="business-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.profileValue}>{profile.company_name}</Text>
          </View>
        )}
        {effectiveTier && (
          <View style={styles.profileRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.brand} />
            <Text style={[styles.profileValue, { color: theme.colors.brand }]}>{effectiveTier}</Text>
          </View>
        )}
      </Card>

      {/* Menu Items */}
      <Card>
        <MenuItem icon="notifications-outline" label="Notification Preferences" />
        <MenuItem icon="shield-outline" label="Security" />
        <MenuItem icon="help-circle-outline" label="Help & Support" />
        <MenuItem icon="document-text-outline" label="Terms & Conditions" />
        <MenuItem icon="lock-closed-outline" label="Privacy Policy" />
      </Card>

      {/* App Info */}
      <Card>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Environment</Text>
          <Text style={styles.infoValue}>Production</Text>
        </View>
      </Card>

      {/* Sign Out */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>BIQc — Australian-hosted. AES-256 encrypted.</Text>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function MenuItem({ icon, label }: { icon: string; label: string }) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}>
      <Ionicons name={icon as any} size={18} color={theme.colors.textSecondary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  title: { fontFamily: theme.fonts.head, fontSize: 28, color: theme.colors.text, fontWeight: '600', marginBottom: 20 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.brandDim, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: theme.colors.brand },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  profileEmail: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  profileValue: { fontSize: 14, color: theme.colors.textSecondary },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  menuLabel: { flex: 1, fontSize: 14, color: theme.colors.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  infoLabel: { fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted, textTransform: 'uppercase' },
  infoValue: { fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textSecondary },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.danger + '30', backgroundColor: theme.colors.danger + '08' },
  logoutText: { fontSize: 14, fontWeight: '600', color: theme.colors.danger },
  footer: { fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.textMuted, textAlign: 'center', marginTop: 24, letterSpacing: 0.5 },
});
