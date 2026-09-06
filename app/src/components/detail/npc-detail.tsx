import React from 'react';
import { View } from 'react-native';

import { RefList } from '@/components/ref-list';
import { KeyValue, Paragraph, Section, StatTable } from '@/components/ui';
import type { Ref, Stat } from '@/db/types';
import { useT } from '@/state/app-state';

import { OtherFields } from './common';

interface NpcDetail {
  id: number;
  titleDesc?: string | null;
  stats?: Stat[];
  expReward?: number; apReward?: number; dpReward?: number;
  dropList?: Ref[]; startQuests?: Ref[]; endQuests?: Ref[]; maps?: Ref[];
  [key: string]: unknown;
}
const KNOWN = new Set(['titleDesc', 'stats', 'expReward', 'apReward', 'dpReward', 'dropList', 'startQuests', 'endQuests', 'maps']);

export function NpcDetailView({ data, id }: { data: NpcDetail; id: number }) {
  const t = useT();
  const rewards = [[t.f.exp, data.expReward], [t.f.ap, data.apReward], [t.f.dp, data.dpReward]].filter(([, v]) => typeof v === 'number' && v > 0) as [string, number][];
  return (
    <View>
      {data.titleDesc ? <Section><Paragraph text={data.titleDesc} /></Section> : null}
      {data.stats?.length ? <Section title={t.f.stats}><StatTable stats={data.stats} /></Section> : null}
      {rewards.length ? <Section title={t.f.rewards}>{rewards.map(([k, v]) => <KeyValue key={k} label={k} value={v.toLocaleString()} />)}</Section> : null}
      <RefList title={t.f.maps} kind="map" refs={data.maps} mapContext={{ kind: 'npc', id }} />
      <RefList title={t.f.dropList} kind="item" refs={data.dropList} trailing={(r) => (typeof r.count === 'number' && r.count > 1 ? `×${r.count}` : undefined)} />
      <RefList title={t.f.startQuests} kind="quest" refs={data.startQuests} />
      <RefList title={t.f.endQuests} kind="quest" refs={data.endQuests} />
      <OtherFields data={data} known={KNOWN} title={t.f.other} />
    </View>
  );
}
