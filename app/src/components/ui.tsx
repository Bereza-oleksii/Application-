import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { Stat } from '@/db/types';

/** Titled card. `flush` removes the inner padding so list rows can span the full card width. */
export function Section({ title, children, style, flush }: { title?: string; children: React.ReactNode; style?: ViewStyle; flush?: boolean }) {
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={[styles.card, flush && styles.cardFlush]}>{children}</View>
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{String(value)}</Text>
    </View>
  );
}

export function StatTable({ stats, positiveColor }: { stats: Stat[] | undefined; positiveColor?: boolean }) {
  if (!stats || !stats.length) return null;
  return (
    <View>
      {stats.map((s, i) => (
        <View key={`${s.name}-${i}`} style={styles.kv}>
          <Text style={styles.kvLabel}>{s.name}</Text>
          <Text style={[styles.kvValue, positiveColor && String(s.value).startsWith('+') && { color: Colors.success }]}>{s.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function Paragraph({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <Text style={styles.paragraph}>{text}</Text>;
}

export function Bullets({ items, color }: { items: string[] | undefined; color?: string }) {
  if (!items || !items.length) return null;
  return (
    <View style={{ gap: 2 }}>
      {items.map((s, i) => <Text key={i} style={[styles.paragraph, color ? { color } : null]}>{s}</Text>)}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Loading({ text }: { text?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={Colors.accent} />
      {text ? <Text style={styles.muted}>{text}</Text> : null}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

export function Badge({ text, color }: { text: string; color?: string }) {
  return (
    <View style={[styles.badge, color ? { borderColor: color } : null]}>
      <Text style={[styles.badgeText, color ? { color } : null]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  sectionTitle: { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.xs },
  cardFlush: { padding: 0, gap: 0, overflow: 'hidden' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 3 },
  kvLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1 },
  kvValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  paragraph: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 20 },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  chipTextActive: { color: Colors.accentText },
  center: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  muted: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
  badge: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
});
