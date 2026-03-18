/**
 * BIQc Mobile — Login Screen
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { auth } from '../lib/api';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setError(`Too many failed attempts. Please wait ${Math.max(1, Math.ceil((lockoutUntil - Date.now()) / 1000))} seconds.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await auth.login(email.trim(), password);
      setFailedAttempts(0);
      setLockoutUntil(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onLogin();
    } catch (err: any) {
      const next = failedAttempts + 1;
      setFailedAttempts(next);
      if (next >= 3) {
        const lockSeconds = Math.min(30, next * 5);
        setLockoutUntil(Date.now() + lockSeconds * 1000);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.response?.data?.detail || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>B</Text>
          </View>
          <Text style={styles.title}>BIQc</Text>
          <Text style={styles.subtitle}>Sovereign Business Intelligence</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={[styles.loginButton, (loading || Boolean(lockoutUntil && Date.now() < lockoutUntil)) ? { opacity: 0.6 } : undefined]} onPress={handleLogin} disabled={loading || Boolean(lockoutUntil && Date.now() < lockoutUntil)} activeOpacity={0.8}>
            <Text style={styles.loginButtonText}>{loading ? 'Signing in...' : (lockoutUntil && Date.now() < lockoutUntil ? `Retry in ${Math.max(1, Math.ceil((lockoutUntil - Date.now()) / 1000))}s` : 'Sign In')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Australian-hosted. AES-256 encrypted.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 56, height: 56, borderRadius: 16, backgroundColor: theme.colors.brandDim, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoText: { fontFamily: theme.fonts.head, fontSize: 28, color: theme.colors.brand, fontWeight: '700' },
  title: { fontFamily: theme.fonts.head, fontSize: 32, color: theme.colors.text, fontWeight: '700' },
  subtitle: { fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textMuted, marginTop: 4, letterSpacing: 1 },
  form: { gap: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.bgInput, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, height: 48 },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, paddingHorizontal: 10 },
  eyeButton: { padding: 14 },
  error: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.danger, textAlign: 'center' },
  loginButton: { height: 48, backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  loginButtonText: { fontFamily: theme.fonts.bodySemiBold, fontSize: 15, color: '#fff' },
  footer: { fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.textMuted, textAlign: 'center', marginTop: 32, letterSpacing: 0.5 },
});
