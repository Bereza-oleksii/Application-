import { Link } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, QualityColors, Radius, Spacing } from '@/constants/theme';
import type { EntitySummary } from '@/db/types';
import { useT } from '@/state/app-state';

import { EntityImage } from './entity-image';

interface Props {
  entity: EntitySummary;
  /** Extra text shown on the right (e.g. drop count). */
  trailing?: string;
  showKind?: boolean;
}

export function qualityColor(q: number | null | undefined) {
  return q === null || q === undefined ? Colors.text : QualityColors[q] ?? Colors.text;
}

export function EntityRow({ entity, trailing, showKind }: Props) {
  const t = useT();
  const subtitle = [
    showKind ? t.kindOne[entity.kind] : null,
    entity.level ? `${t.lvl} ${entity.level}` : null,
    entity.kind === 'harvest' && entity.sub?.skillName ? `${String(entity.sub.skillName)} ${String(entity.sub.skillLevel ?? '')}` : null,
    entity.tags.length ? entity.tags.slice(-2).join(' · ') : null,
  ].filter(Boolean).join('  ·  ');
  return (
    <Link href={{ pathname: '/entity/[kind]/[id]', params: { kind: entity.kind, id: String(entity.id) } }} asChild>
      <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <EntityImage path={entity.image} quality={entity.quality} size={44} />
        <View style={styles.body}>
          <Text style={[styles.name, { color: qualityColor(entity.quality) }]} numberOfLines={2}>{entity.name}</Text>
          {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pressed: { backgroundColor: Colors.surface },
  body: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.md, fontWeight: '600' },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  trailing: { fontSize: FontSize.sm, color: Colors.textSecondary, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
});
