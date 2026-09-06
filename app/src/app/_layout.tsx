import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Loading } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { AppStateProvider, useApp } from '@/state/app-state';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, everReady, error, progress, t } = useApp();
  useEffect(() => {
    if (ready || error) SplashScreen.hideAsync().catch(() => {});
  }, [ready, error]);
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Database error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (!ready && everReady) {
    // language switch: keep the navigator mounted, show a blocking overlay
    return (
      <View style={{ flex: 1 }}>
        {children}
        <View style={styles.overlay}>
          <Loading text={t.preparingDb} />
          {progress ? <Text style={styles.progress}>{progress}</Text> : null}
        </View>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.brand}>{t.appName}</Text>
        <Loading text={t.preparingDb} />
        <Text style={styles.hint}>{t.preparingHint}</Text>
        {progress ? <Text style={styles.progress}>{progress}</Text> : null}
      </View>
    );
  }
  return <>{children}</>;
}

function Navigator() {
  const { t } = useApp();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: Colors.background },
        headerBackTitle: '',
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="entity/[kind]/[id]" options={{ title: '' }} />
      <Stack.Screen name="category/[kind]" options={{ title: t.tabBrowse }} />
      <Stack.Screen name="map/[id]" options={{ title: t.tabMaps }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <StatusBar style="light" />
          <Gate>
            <Navigator />
          </Gate>
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(13,17,23,0.85)', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  brand: { color: Colors.accent, fontSize: FontSize.xl, fontWeight: '700', letterSpacing: 1 },
  hint: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', maxWidth: 320 },
  progress: { color: Colors.textMuted, fontSize: FontSize.xs },
  errorTitle: { color: Colors.danger, fontSize: FontSize.lg, fontWeight: '700' },
  errorText: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
});
