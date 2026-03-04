/**
 * BIQc Mobile — App Entry Point
 * Auth-gated: Login → Tab Navigator
 */
import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import MarketScreen from './src/screens/MarketScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import { theme } from './src/theme';
import { auth } from './src/lib/api';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home: { active: 'grid', inactive: 'grid-outline' },
  Chat: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  Market: { active: 'compass', inactive: 'compass-outline' },
  Alerts: { active: 'notifications', inactive: 'notifications-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

function MainTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <View style={focused ? styles.activeTab : undefined}>
              <Ionicons
                name={(focused ? icons.active : icons.inactive) as any}
                size={focused ? 22 : 20}
                color={color}
              />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Overview' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen name="Market" component={MarketScreen} options={{ tabBarLabel: 'Market' }} />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ tabBarLabel: 'Alerts' }} />
      <Tab.Screen name="Settings" options={{ tabBarLabel: 'Settings' }}>
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    auth.isAuthenticated().then((ok) => {
      setAuthenticated(ok);
      setChecking(false);
    });
  }, []);

  const handleLogin = useCallback(() => setAuthenticated(true), []);
  const handleLogout = useCallback(async () => {
    await auth.logout();
    setAuthenticated(false);
  }, []);

  if (checking) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {authenticated ? (
        <NavigationContainer>
          <MainTabs onLogout={handleLogout} />
        </NavigationContainer>
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center', alignItems: 'center' },
  tabBar: {
    backgroundColor: theme.colors.bgCard,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: 85,
    paddingTop: 8,
    paddingBottom: 28,
  },
  tabLabel: { fontSize: 9, letterSpacing: 0.3 },
  activeTab: { backgroundColor: theme.colors.brandDim, borderRadius: 10, padding: 4 },
});
