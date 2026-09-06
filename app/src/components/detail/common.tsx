import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Bullets, KeyValue, Section } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { Strings } from '@/i18n/strings';

export function formatMinutes(mins: number | undefined | null, t: Strings): string | undefined {
  if (!mins || mins <= 0) return undefined;
  const d = Math.floor(mins / 1440); const h = Math.floor((mins % 1440) / 60); const m = mins % 60;
  return [d ? `${d} ${t.f.days}` : '', h ? `${h} ${t.f.hours}` : '', m ? `${m} ${t.f.min}` : ''].filter(Boolean).join(' ');
}

export function formatMillis(ms: number | undefined | null, t: Strings): string | undefined {
  if (!ms || ms <= 0) return undefined;
  const s = ms / 1000;
  if (s < 60) return `${Number.isInteger(s) ? s : s.toFixed(1)} ${t.f.sec}`;
  const m = Math.floor(s / 60); const rs = Math.round(s % 60);
  if (m < 60) return rs ? `${m} ${t.f.min} ${rs} ${t.f.sec}` : `${m} ${t.f.min}`;
  const h = Math.floor(m / 60); const rm = m % 60;
  return rm ? `${h} ${t.f.hours} ${rm} ${t.f.min}` : `${h} ${t.f.hours}`;
}

const HIDDEN = new Set(['image', 'desc', 'tags', 'id', 'itemId', 'level', 'quality']);

/** Renders whatever fields a detail JSON still has that no dedicated renderer consumed. */
export function OtherFields({ data, known, title }: { data: Record<string, unknown>; known: Set<string>; title: string }) {
  const rest = Object.entries(data).filter(([k, v]) => !known.has(k) && !HIDDEN.has(k) && v !== null && v !== undefined && v !== 0 && v !== '' && !(Array.isArray(v) && v.length === 0));
  if (!rest.length) return null;
  return (
    <Section title={title}>
      {rest.map(([k, v]) => {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return <KeyValue key={k} label={k} value={String(v)} />;
        if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return (
          <View key={k}><Text style={styles.subLabel}>{k}</Text><Bullets items={v as string[]} /></View>
        );
        return (
          <View key={k}>
            <Text style={styles.subLabel}>{k}</Text>
            <Text style={styles.json}>{JSON.stringify(v, null, 1).replace(/[{}[\]"]/g, '').replace(/\n\s*\n/g, '\n').trim()}</Text>
          </View>
        );
      })}
    </Section>
  );
}

const styles = StyleSheet.create({
  subLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: Spacing.xs },
  json: { color: Colors.text, fontSize: FontSize.xs, lineHeight: 16 },
});
