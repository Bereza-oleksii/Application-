import { Link } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '@/constants/theme';
import { getEntities, getMapsByIds } from '@/db/queries';
import type { EntitySummary, Kind, MapInfo, Ref, RefKind } from '@/db/types';
import { useT } from '@/state/app-state';

import { EntityRow } from './entity-row';
import { Section } from './ui';

const PAGE = 30;

interface Props {
  title: string;
  kind: RefKind;
  refs: Ref[] | undefined;
  /** Builds the trailing text from the ref's extra fields (count, quality…). */
  trailing?: (ref: Ref) => string | undefined;
  /** Optional context for map links (e.g. to preselect an NPC on the map screen). */
  mapContext?: { kind: 'npc' | 'harvest'; id: number };
}

/** Section listing referenced entities; names and icons are resolved from the entities table. */
export function RefList({ title, kind, refs, trailing, mapContext }: Props) {
  const t = useT();
  const [shown, setShown] = useState(PAGE);
  const [entities, setEntities] = useState<Map<number, EntitySummary>>(new Map());
  const [maps, setMaps] = useState<Map<number, MapInfo>>(new Map());
  const list = useMemo(() => (refs ?? []).filter((r) => r && typeof r.id === 'number'), [refs]);

  useEffect(() => {
    if (!list.length) return;
    const ids = list.slice(0, shown).map((r) => r.id);
    let alive = true;
    if (kind === 'map') {
      getMapsByIds(ids).then((m) => { if (alive) setMaps(m); });
    } else {
      getEntities(kind as Kind, ids).then((m) => { if (alive) setEntities(m); });
    }
    return () => { alive = false; };
  }, [list, shown, kind]);

  if (!list.length) return null;
  const visible = list.slice(0, shown);
  return (
    <Section title={`${title} (${list.length})`} flush>
      <View>
        {visible.map((r, i) => {
          if (kind === 'map') {
            const m = maps.get(r.id);
            return (
              <Link
                key={`${r.id}-${i}`}
                href={{ pathname: '/map/[id]', params: { id: String(r.id), ...(mapContext ? { kind: mapContext.kind, entityId: String(mapContext.id) } : {}) } }}
                asChild>
                <Pressable style={({ pressed }) => [styles.mapRow, pressed && { backgroundColor: Colors.surfaceAlt }]}>
                  <Text style={styles.mapName}>{m ? m.name : `#${r.id}`}</Text>
                  <Text style={styles.mapHint}>{mapContext ? t.showOnMap + ' ›' : '›'}</Text>
                </Pressable>
              </Link>
            );
          }
          const e = entities.get(r.id);
          const summary: EntitySummary = e ?? { kind: kind as Kind, id: r.id, name: `#${r.id}`, level: null, quality: typeof r.quality === 'number' ? r.quality : null, image: null, tags: [], sub: null, race: null };
          return <EntityRow key={`${r.id}-${i}`} entity={summary} trailing={trailing ? trailing(r) : undefined} />;
        })}
        {list.length > shown ? (
          <Pressable onPress={() => setShown((s) => s + PAGE * 2)} style={styles.more}>
            <Text style={styles.moreText}>{t.showAll} ({list.length - shown})</Text>
          </Pressable>
        ) : null}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  mapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  mapName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  mapHint: { color: Colors.accent, fontSize: FontSize.sm },
  more: { padding: Spacing.md, alignItems: 'center' },
  moreText: { color: Colors.accent, fontWeight: '600' },
});
