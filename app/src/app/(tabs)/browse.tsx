import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { countByKind } from '@/db/queries';
import { KINDS, type Kind } from '@/db/types';
import { useApp } from '@/state/app-state';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const ICONS: Record<Kind, IconName> = { item: 'cube', npc: 'people', quest: 'book', skill: 'flash', title: 'ribbon', harvest: 'leaf' };

export default function BrowseScreen() {
  const { t, dataVersion } = useApp();
  const [counts, setCounts] = useState<Partial<Record<Kind, number>>>({});
  useEffect(() => { countByKind().then(setCounts).catch(() => {}); }, [dataVersion]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {KINDS.map((k) => (
        <Link key={k} href={{ pathname: '/category/[kind]', params: { kind: k } }} asChild>
          <Pressable style={({ pressed }) => [styles.card, pressed && { backgroundColor: Colors.surfaceAlt }]}>
            <View style={styles.iconWrap}><Ionicons name={ICONS[k]} size={24} color={Colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t.kinds[k]}</Text>
              <Text style={styles.sub}>{counts[k] !== undefined ? `${counts[k]!.toLocaleString()} ${t.records}` : ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  iconWrap: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.sm },
});
