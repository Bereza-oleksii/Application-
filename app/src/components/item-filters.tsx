import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize, QualityColors, Radius, Spacing } from '@/constants/theme';
import { useT } from '@/state/app-state';

export interface ItemFilterState {
  /** Selected quality tiers (1..6). Empty = all. Tier 1 also covers quality 0 (junk). */
  quality: number[];
  /** Bitmask 1 = Elyos, 2 = Asmodian; 3 = both (no filter). */
  race: number;
  minLevel: string;
  maxLevel: string;
}

export const DEFAULT_ITEM_FILTERS: ItemFilterState = { quality: [], race: 3, minLevel: '', maxLevel: '' };
const TIERS = [1, 2, 3, 4, 5, 6];

/** Converts the UI state into search parameters. */
export function toSearchParams(f: ItemFilterState) {
  const quality = f.quality.length && f.quality.length < TIERS.length ? (f.quality.includes(1) ? [0, ...f.quality] : f.quality) : undefined;
  return {
    quality,
    race: f.race === 3 || f.race === 0 ? undefined : f.race,
    minLevel: f.minLevel ? Number(f.minLevel) : undefined,
    maxLevel: f.maxLevel ? Number(f.maxLevel) : undefined,
  };
}

export function isDefaultFilters(f: ItemFilterState) {
  return f.quality.length === 0 && f.race === 3 && !f.minLevel && !f.maxLevel;
}

function Check({ label, color, active, onPress }: { label: string; color?: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.check, pressed && { opacity: 0.7 }]} hitSlop={4}>
      <View style={[styles.box, active && styles.boxActive]}>{active ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={[styles.checkLabel, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

/** Quality / race / level filters for items, mirroring the source site's filter bar. */
export function ItemFilters({ value, onChange }: { value: ItemFilterState; onChange: (v: ItemFilterState) => void }) {
  const t = useT();
  const toggleQuality = (q: number) => {
    const set = new Set(value.quality.length ? value.quality : TIERS);
    if (set.has(q)) set.delete(q); else set.add(q);
    const next = TIERS.filter((x) => set.has(x));
    onChange({ ...value, quality: next.length === TIERS.length ? [] : next });
  };
  const qualityActive = (q: number) => value.quality.length === 0 || value.quality.includes(q);
  const toggleRace = (bit: number) => onChange({ ...value, race: value.race ^ bit });
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {TIERS.map((q) => <Check key={q} label={t.qualityNames[q]} color={QualityColors[q]} active={qualityActive(q)} onPress={() => toggleQuality(q)} />)}
      </View>
      <View style={styles.row}>
        <Check label={t.elyos} color={Colors.elyos} active={(value.race & 1) !== 0} onPress={() => toggleRace(1)} />
        <Check label={t.asmodian} color={Colors.asmodian} active={(value.race & 2) !== 0} onPress={() => toggleRace(2)} />
        <View style={styles.levels}>
          <Text style={styles.lvlLabel}>{t.lvl}</Text>
          <TextInput style={styles.lvlInput} value={value.minLevel} onChangeText={(v) => onChange({ ...value, minLevel: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor={Colors.textMuted} />
          <Text style={styles.lvlLabel}>–</Text>
          <TextInput style={styles.lvlInput} value={value.maxLevel} onChangeText={(v) => onChange({ ...value, maxLevel: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={2} placeholder="99" placeholderTextColor={Colors.textMuted} />
        </View>
        {!isDefaultFilters(value) ? (
          <Pressable onPress={() => onChange(DEFAULT_ITEM_FILTERS)} hitSlop={6}><Text style={styles.reset}>{t.reset}</Text></Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.md, rowGap: Spacing.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  boxActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tick: { color: Colors.accentText, fontSize: 11, fontWeight: '800', lineHeight: 13 },
  checkLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  levels: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  lvlLabel: { color: Colors.textMuted, fontSize: FontSize.xs },
  lvlInput: { width: 36, height: 30, color: Colors.text, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: 0, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  reset: { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '600' },
});
