import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { EntityRow } from '@/components/entity-row';
import { Chip, Empty } from '@/components/ui';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getImageUri } from '@/db/images';
import { getMap, getMapEntities, getSpawns } from '@/db/queries';
import type { EntitySummary, MapInfo, SpawnPoint } from '@/db/types';
import { useApp } from '@/state/app-state';

const MIRRORED_MAP = 110010000; // Sanctum is stored mirrored on the source site

/** Game coordinates -> pixel coordinates in the map image (same formula as the source site). */
function toPixel(map: MapInfo, p: SpawnPoint): { px: number; py: number } {
  const w = map.width ?? 3072; const h = map.height ?? 3072;
  let px = p[1] - (map.offsetX ?? 0);
  let py = p[0] - (map.offsetY ?? 0);
  if (map.id === MIRRORED_MAP) { px = w - px; py = h - py; }
  return { px, py };
}

export default function MapScreen() {
  const params = useLocalSearchParams<{ id: string; kind?: 'npc' | 'harvest'; entityId?: string }>();
  const mapId = Number(params.id);
  const { t, dataVersion } = useApp();
  const { width: screenW } = useWindowDimensions();
  const [map, setMap] = useState<MapInfo | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [kind, setKind] = useState<'npc' | 'harvest'>(params.kind ?? 'npc');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<EntitySummary[]>([]);
  const [selected, setSelected] = useState<number | null>(params.entityId ? Number(params.entityId) : null);
  const [spawnsState, setSpawns] = useState<SpawnPoint[]>([]);
  const spawns = useMemo(() => (selected === null ? [] : spawnsState), [selected, spawnsState]);

  useEffect(() => {
    getMap(mapId).then(async (m) => {
      setMap(m);
      setUri(await getImageUri(m?.image ?? m?.preview ?? null));
    }).catch(() => {});
  }, [mapId, dataVersion]);

  useEffect(() => {
    const timer = setTimeout(() => { getMapEntities(mapId, kind, query).then(setList).catch(() => setList([])); }, 200);
    return () => clearTimeout(timer);
  }, [mapId, kind, query, dataVersion]);

  useEffect(() => {
    if (selected === null) return;
    let alive = true;
    getSpawns(mapId, kind, selected).then((s) => { if (alive) setSpawns(s); }).catch(() => { if (alive) setSpawns([]); });
    return () => { alive = false; };
  }, [mapId, kind, selected, dataVersion]);

  // --- pinch / pan zoom
  const scale = useSharedValue(1); const savedScale = useSharedValue(1);
  const tx = useSharedValue(0); const ty = useSharedValue(0);
  const savedTx = useSharedValue(0); const savedTy = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.min(8, Math.max(1, savedScale.value * e.scale)); })
    .onEnd(() => { savedScale.value = scale.value; });
  const pan = Gesture.Pan().minPointers(1).maxPointers(2)
    .onUpdate((e) => { tx.value = savedTx.value + e.translationX; ty.value = savedTy.value + e.translationY; })
    .onEnd(() => { savedTx.value = tx.value; savedTy.value = ty.value; });
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    scale.value = 1; savedScale.value = 1; tx.value = 0; ty.value = 0; savedTx.value = 0; savedTy.value = 0;
  });
  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  const size = screenW;
  const aspect = map?.width && map?.height ? map.height / map.width : 1;
  const markers = useMemo(() => {
    if (!map) return [];
    const w = map.width ?? 3072; const h = map.height ?? 3072;
    return spawns.map((p) => { const { px, py } = toPixel(map, p); return { x: (px / w) * size, y: (py / h) * (size * aspect) }; })
      .filter((m) => m.x >= 0 && m.y >= 0 && m.x <= size && m.y <= size * aspect);
  }, [spawns, map, size, aspect]);

  const selectedEntity = list.find((e) => e.id === selected);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: map?.name ?? t.tabMaps }} />
      <View style={[styles.mapWrap, { height: size * aspect }]}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ width: size, height: size * aspect }, animStyle]}>
            {uri ? <Image source={{ uri }} style={{ width: size, height: size * aspect }} contentFit="contain" /> : null}
            {markers.map((m, i) => (
              <View key={i} style={[styles.marker, { left: m.x - 5, top: m.y - 5 }]} />
            ))}
          </Animated.View>
        </GestureDetector>
      </View>
      <View style={styles.toolbar}>
        <Chip label={t.npcsOnMap} active={kind === 'npc'} onPress={() => { setKind('npc'); setSelected(null); }} />
        <Chip label={t.harvestOnMap} active={kind === 'harvest'} onPress={() => { setKind('harvest'); setSelected(null); }} />
      </View>
      {selected !== null ? (
        <View style={styles.selectedBar}>
          <Text style={styles.selectedText} numberOfLines={1}>
            {selectedEntity?.name ?? `#${selected}`} — {t.spawnsOnMap}: {spawns.length || t.noSpawnData}
          </Text>
          <Pressable onPress={() => setSelected(null)} hitSlop={8}><Ionicons name="close" size={18} color={Colors.textSecondary} /></Pressable>
        </View>
      ) : null}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder={t.filterByName} placeholderTextColor={Colors.textMuted} autoCorrect={false} />
      </View>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {list.length === 0 ? <Empty text={t.noResults} /> : list.map((e) => (
          <View key={e.id} style={[styles.listRow, selected === e.id && styles.listRowActive]}>
            <Pressable onPress={() => setSelected(selected === e.id ? null : e.id)} style={styles.pin} hitSlop={6}>
              <Ionicons name={selected === e.id ? 'location' : 'location-outline'} size={22} color={selected === e.id ? Colors.accent : Colors.textMuted} />
            </Pressable>
            <View style={{ flex: 1 }}><EntityRow entity={e} /></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  mapWrap: { overflow: 'hidden', backgroundColor: '#000' },
  marker: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger, borderWidth: 1.5, borderColor: '#fff' },
  toolbar: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, paddingBottom: Spacing.sm },
  selectedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginHorizontal: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm },
  selectedText: { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '600', flex: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, marginVertical: Spacing.sm, paddingHorizontal: Spacing.md, height: 38, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  input: { flex: 1, color: Colors.text, fontSize: FontSize.sm, paddingVertical: 0 },
  listRow: { flexDirection: 'row', alignItems: 'center' },
  listRowActive: { backgroundColor: Colors.surface },
  pin: { paddingLeft: Spacing.md },
});
