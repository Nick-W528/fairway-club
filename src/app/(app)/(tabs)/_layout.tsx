import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import type { IconName } from '@/components/ui';
import { haptic } from '@/lib/feedback';
import { fonts, useTheme } from '@/theme';

function icon(name: IconName, active: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? active : name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const { colors: c, mode } = useTheme();
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.tap() }}
      screenOptions={{
        tabBarActiveTintColor: mode === 'dark' ? c.accent : c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.border },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 24 },
        sceneStyle: { backgroundColor: c.background },
      }}>
      <Tabs.Screen name="index" options={{ headerShown: false, title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="tee-times" options={{ title: 'Tee times', tabBarIcon: icon('time-outline', 'time') }} />
      <Tabs.Screen name="competitions" options={{ title: 'Competitions', tabBarLabel: 'Comps', tabBarIcon: icon('trophy-outline', 'trophy') }} />
      <Tabs.Screen name="bar-card" options={{ title: 'Bar card', tabBarLabel: 'Card', tabBarIcon: icon('card-outline', 'card') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('menu-outline', 'menu') }} />
    </Tabs>
  );
}
