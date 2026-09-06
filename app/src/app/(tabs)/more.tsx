import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EntityRow } from '@/components/entity-row';
import { Chip, Empty, KeyValue, Section } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { DATA_LANGS } from '@/db/bundles.generated';
import { getEntity, getMeta } from '@/db/queries';
import type { EntitySummary } from '@/db/types';
import { DATA_LANG_NAMES, UI_LANG_NAMES, UI_LANGS } from '@/i18n/strings';
import { useApp } from '@/state/app-state';

function useResolved(list: { kind: EntitySummary['kind']; id: number }[], version: number) {
  const [rows, setRows] = useState<EntitySummary[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all(list.map((b) => getEntity(b.kind, b.id))).then((r) => { if (alive) setRows(r.filter((x): x is EntitySummary => !!x)); });
    return () => { alive = false; };
  }, [list, version]);
  return rows;
}

export default function MoreScreen() {
  const { t, uiLang, setUiLang, dataLang, setDataLang, bookmarks, history, dataVersion } = useApp();
  const recent = useMemo(() => history.slice(0, 20), [history]);
  const bm = useResolved(bookmarks, dataVersion);
  const hist = useResolved(recent, dataVersion);
  const [meta, setMeta] = useState<Record<string, string>>({});
  useEffect(() => { getMeta().then(setMeta).catch(() => {}); }, [dataVersion]);
  let counts: Record<string, { summaries: number }> = {};
  try { counts = JSON.parse(meta.counts ?? '{}'); } catch { /* ignore */ }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
      <Section title={t.bookmarks} flush>
        {bm.length ? bm.map((e) => <EntityRow key={`${e.kind}:${e.id}`} entity={e} showKind />) : <Empty text={t.noBookmarks} />}
      </Section>
      {hist.length ? (
        <Section title={t.history} flush>
          {hist.map((e) => <EntityRow key={`${e.kind}:${e.id}`} entity={e} showKind />)}
        </Section>
      ) : null}
      <Section title={t.settings}>
        <Text style={styles.label}>{t.uiLanguage}</Text>
        <View style={styles.chips}>{UI_LANGS.map((l) => <Chip key={l} label={UI_LANG_NAMES[l]} active={uiLang === l} onPress={() => setUiLang(l)} />)}</View>
        <Text style={[styles.label, { marginTop: Spacing.md }]}>{t.dataLanguage}</Text>
        <View style={styles.chips}>{DATA_LANGS.map((l) => <Chip key={l} label={DATA_LANG_NAMES[l] ?? l} active={dataLang === l} onPress={() => setDataLang(l)} />)}</View>
      </Section>
      <Section title={t.about}>
        <Text style={styles.about}>{t.aboutText}</Text>
        <KeyValue label={t.dataBuiltAt} value={meta.built_at ? meta.built_at.slice(0, 10) : undefined} />
        {Object.entries(counts).map(([k, v]) => <KeyValue key={k} label={t.kinds[k] ?? k} value={v.summaries?.toLocaleString()} />)}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  label: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  about: { color: Colors.text, fontSize: 14, lineHeight: 20, marginBottom: Spacing.sm },
});
