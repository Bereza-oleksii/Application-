import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HarvestDetailView, SkillDetailView, TitleDetailView } from '@/components/detail/misc-detail';
import { ItemDetailView } from '@/components/detail/item-detail';
import { NpcDetailView } from '@/components/detail/npc-detail';
import { QuestDetailView } from '@/components/detail/quest-detail';
import { EntityImage } from '@/components/entity-image';
import { qualityColor } from '@/components/entity-row';
import { Badge, Empty, Loading } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { getDetail, getEntity } from '@/db/queries';
import type { EntitySummary, Kind } from '@/db/types';
import { useApp } from '@/state/app-state';

export default function EntityScreen() {
  const params = useLocalSearchParams<{ kind: Kind; id: string }>();
  const kind = params.kind;
  const id = Number(params.id);
  const { t, isBookmarked, toggleBookmark, recordVisit, dataVersion } = useApp();
  const key = `${kind}:${id}:${dataVersion}`;
  const [loaded, setLoaded] = useState<{ key: string; summary: EntitySummary | null; detail: Record<string, unknown> | null }>({ key: '', summary: null, detail: null });

  useEffect(() => {
    let alive = true;
    Promise.all([getEntity(kind, id), getDetail(kind, id)]).then(([s, d]) => {
      if (!alive) return;
      setLoaded({ key, summary: s, detail: d });
      if (s) recordVisit(kind, id).catch(() => {});
    }).catch(() => { if (alive) setLoaded({ key, summary: null, detail: null }); });
    return () => { alive = false; };
  }, [kind, id, key, recordVisit]);

  const isLoading = loaded.key !== key;
  const summary = isLoading ? null : loaded.summary;
  const detail: Record<string, unknown> | null | undefined = isLoading ? undefined : loaded.detail;

  const bookmarked = isBookmarked(kind, id);
  const name = summary?.name ?? (detail?.desc as string | undefined) ?? '';
  const quality = summary?.quality ?? (typeof detail?.quality === 'number' ? (detail.quality as number) : null);
  const level = summary?.level ?? (typeof detail?.level === 'number' ? (detail.level as number) : null);
  const image = summary?.image ?? (detail?.image as string | undefined) ?? null;
  const tags = summary?.tags ?? ((detail?.tags as string[] | undefined) ?? []);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: t.kindOne[kind] ?? kind,
          headerRight: () => (
            <Pressable onPress={() => toggleBookmark(kind, id)} hitSlop={10} style={{ paddingHorizontal: Spacing.sm }}>
              <Ionicons name={bookmarked ? 'star' : 'star-outline'} size={22} color={Colors.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
        <View style={styles.header}>
          <EntityImage path={image} quality={quality} size={72} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.name, { color: qualityColor(quality) }]}>{name || (detail === undefined ? t.loading : `#${id}`)}</Text>
            <View style={styles.badges}>
              {level ? <Badge text={`${t.level} ${level}`} /> : null}
              {quality !== null && quality !== undefined && kind === 'item' ? <Badge text={t.qualityNames[quality] ?? String(quality)} color={qualityColor(quality)} /> : null}
              {tags.map((tag) => <Badge key={tag} text={tag} />)}
            </View>
            <Text style={styles.id}>ID {id}</Text>
          </View>
        </View>
        {detail === undefined ? <Loading text={t.loading} /> : detail === null ? <Empty text={t.noResults} /> : (
          kind === 'item' ? <ItemDetailView data={detail} /> :
          kind === 'npc' ? <NpcDetailView data={detail as never} id={id} /> :
          kind === 'quest' ? <QuestDetailView data={detail} /> :
          kind === 'skill' ? <SkillDetailView data={detail} /> :
          kind === 'title' ? <TitleDetailView data={detail} /> :
          <HarvestDetailView data={detail} id={id} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', gap: Spacing.lg, padding: Spacing.lg, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  name: { fontSize: FontSize.xl, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  id: { color: Colors.textMuted, fontSize: FontSize.xs },
});
