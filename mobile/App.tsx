/**
 * BIQc Mobile — App Entry Point (Expo Router)
 * Bottom tab navigation with 5 screens
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import MarketScreen from './src/screens/MarketScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { theme } from './src/theme';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home: { active: 'grid', inactive: 'grid-outline' },
  Chat: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  Market: { active: 'compass', inactive: 'compass-outline' },
  Alerts: { active: 'notifications', inactive: 'notifications-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: theme.colors.brand,
            tabBarInactiveTintColor: theme.colors.textMuted,
            tabBarLabelStyle: styles.tabLabel,
            tabBarIcon: ({ focused, color, size }) => {
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
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.bgCard,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: 85,
    paddingTop: 8,
    paddingBottom: 28,
  },
  tabLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  activeTab: {
    backgroundColor: theme.colors.brandDim,
    borderRadius: 10,
    padding: 4,
  },
});
