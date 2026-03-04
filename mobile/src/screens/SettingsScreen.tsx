/**
 * BIQc Mobile — Settings Screen
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Card, SectionHeader, StatusBadge } from '../components/ui';
import api, { auth } from '../lib/api';

export default function SettingsScreen({ onLogout }: { onLogout?: () => void; navigation?: any }) {
  const [user, setUser] = useState<any>(null);
  const [spine, setSpine] = useState<any>(null);

  useEffect(() => {
    auth.getUser().then(setUser);
    api.get('/spine/status').then(r => setSpine(r.data)).catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await auth.logout();
        if (onLogout) onLogout();
      }},
    ]);
  };

  const menuItems = [
    { icon: 'person-outline', label: 'Business Profile' },
    { icon: 'link-outline', label: 'Integrations' },
    { icon: 'shield-checkmark-outline', label: 'Data Health' },
    { icon: 'document-text-outline', label: 'Knowledge Base' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SectionHeader title="Settings" />

      {/* Profile Card */}
      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.email || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.full_name || user?.email || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          </View>
          <StatusBadge status={user?.subscription_tier || 'free'} color={theme.colors.brand} />
        </View>
      </Card>

      {/* Spine Status */}
      {spine && (
        <Card>
          <View style={styles.spineRow}>
            <Ionicons name="hardware-chip-outline" size={18} color={spine.spine_enabled ? theme.colors.success : theme.colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.spineLabel}>Intelligence Spine</Text>
              <Text style={styles.spineDetail}>
                {spine.spine_enabled ? `Active — ${spine.event_count || 0} events, ${spine.snapshot_count || 0} snapshots` : 'Disabled'}
              </Text>
            </View>
            <View style={[styles.spineDot, { backgroundColor: spine.spine_enabled ? theme.colors.success : theme.colors.textMuted }]} />
          </View>
        </Card>
      )}

      {/* Menu Items */}
      <Card>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={item.label} style={[styles.menuItem, i < menuItems.length - 1 && styles.menuItemBorder]} activeOpacity={0.7}
            onPress={() => Haptics.selectionAsync()}>
            <Ionicons name={item.icon as any} size={18} color={theme.colors.textSecondary} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ))}
      </Card>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>BIQc Mobile v1.0.0</Text>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brand + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, color: theme.colors.brand, fontWeight: '700' },
  profileName: { fontSize: 15, color: theme.colors.text, fontWeight: '600' },
  profileEmail: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  spineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spineLabel: { fontSize: 13, color: theme.colors.text, fontWeight: '600' },
  spineDetail: { fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },
  spineDot: { width: 8, height: 8, borderRadius: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  menuLabel: { fontSize: 14, color: theme.colors.text, flex: 1 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, padding: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.danger + '30' },
  logoutText: { fontSize: 14, color: theme.colors.danger, fontWeight: '600' },
  version: { fontSize: 10, color: theme.colors.textMuted, textAlign: 'center', marginTop: 16 },
});
