import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';

import { Colors } from '@/constants/theme';
import { useT } from '@/state/app-state';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Ionicons name={name} color={color as string} size={size} />;
}

export default function TabLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text, fontWeight: '600' },
        sceneStyle: { backgroundColor: Colors.background },
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
      }}>
      <Tabs.Screen name="index" options={{ title: t.tabSearch, tabBarIcon: (p) => <TabIcon name="search" {...p} /> }} />
      <Tabs.Screen name="browse" options={{ title: t.tabBrowse, tabBarIcon: (p) => <TabIcon name="grid" {...p} /> }} />
      <Tabs.Screen name="maps" options={{ title: t.tabMaps, tabBarIcon: (p) => <TabIcon name="map" {...p} /> }} />
      <Tabs.Screen name="more" options={{ title: t.tabMore, tabBarIcon: (p) => <TabIcon name="ellipsis-horizontal" {...p} /> }} />
    </Tabs>
  );
}
