import { Link } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import { EntityImage } from '@/components/entity-image';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getMaps } from '@/db/queries';
import type { MapInfo } from '@/db/types';
import { useApp } from '@/state/app-state';

export default function MapsScreen() {
  const { dataVersion } = useApp();
  const [maps, setMaps] = useState<MapInfo[]>([]);
  useEffect(() => { getMaps().then(setMaps).catch(() => {}); }, [dataVersion]);
  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={maps}
      numColumns={2}
      columnWrapperStyle={{ gap: Spacing.md }}
      keyExtractor={(m) => String(m.id)}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/map/[id]', params: { id: String(item.id) } }} asChild>
          <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
            <EntityImage path={item.preview} size={150} rounded />
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            {item.type ? <Text style={styles.type}>{item.type}</Text> : null}
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: { flex: 1, alignItems: 'center', gap: Spacing.xs, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  name: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600', textAlign: 'center' },
  type: { color: Colors.textSecondary, fontSize: FontSize.xs },
});
