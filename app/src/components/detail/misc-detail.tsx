import React from 'react';
import { View } from 'react-native';

import { RefList } from '@/components/ref-list';
import { KeyValue, Paragraph, Section, StatTable } from '@/components/ui';
import type { Ref, Stat } from '@/db/types';
import { useT } from '@/state/app-state';

import { formatMillis, OtherFields } from './common';

interface SkillDetail {
  descLong?: string; levelRestriction?: string; target?: string; cooldown?: number; castTime?: number;
  autoLearns?: { playerClass: string; level: number }[];
  getItems?: Ref[];
  [key: string]: unknown;
}
const SKILL_KNOWN = new Set(['descLong', 'levelRestriction', 'target', 'cooldown', 'castTime', 'autoLearns', 'getItems']);

export function SkillDetailView({ data }: { data: SkillDetail }) {
  const t = useT();
  return (
    <View>
      {data.descLong ? <Section title={t.f.description}><Paragraph text={data.descLong} /></Section> : null}
      <Section>
        <KeyValue label={t.f.levelRestriction} value={data.levelRestriction} />
        <KeyValue label={t.f.target} value={data.target} />
        <KeyValue label={t.f.castTime} value={data.castTime ? formatMillis(data.castTime, t) : undefined} />
        <KeyValue label={t.f.cooldown} value={data.cooldown ? formatMillis(data.cooldown, t) : undefined} />
      </Section>
      {data.autoLearns?.length ? (
        <Section title={t.f.autoLearns}>
          {data.autoLearns.map((a, i) => <KeyValue key={i} label={a.playerClass} value={`${t.lvl} ${a.level}`} />)}
        </Section>
      ) : null}
      <RefList title={t.f.getItems} kind="item" refs={data.getItems} />
      <OtherFields data={data} known={SKILL_KNOWN} title={t.f.other} />
    </View>
  );
}

interface TitleDetail { titleDesc?: string; stats?: Stat[]; quests?: Ref[]; [key: string]: unknown }
const TITLE_KNOWN = new Set(['titleDesc', 'stats', 'quests']);

export function TitleDetailView({ data }: { data: TitleDetail }) {
  const t = useT();
  return (
    <View>
      {data.titleDesc ? <Section title={t.f.description}><Paragraph text={data.titleDesc} /></Section> : null}
      {data.stats?.length ? <Section title={t.f.stats}><StatTable stats={data.stats} positiveColor /></Section> : null}
      <RefList title={t.f.quests} kind="quest" refs={data.quests} />
      <OtherFields data={data} known={TITLE_KNOWN} title={t.f.other} />
    </View>
  );
}

interface HarvestDetail { skillName?: string; skillLevel?: number; items?: Ref[]; maps?: Ref[]; requiredItem?: Ref; extraItems?: Ref[]; [key: string]: unknown }
const HARVEST_KNOWN = new Set(['skillName', 'skillLevel', 'items', 'maps', 'requiredItem', 'extraItems']);

export function HarvestDetailView({ data, id }: { data: HarvestDetail; id: number }) {
  const t = useT();
  return (
    <View>
      <Section>
        <KeyValue label={t.f.skill} value={data.skillName ? `${data.skillName} ${data.skillLevel ?? ''}` : undefined} />
      </Section>
      <RefList title={t.f.maps} kind="map" refs={data.maps} mapContext={{ kind: 'harvest', id }} />
      <RefList title={t.f.items} kind="item" refs={data.items} />
      <RefList title={t.f.extraItems} kind="item" refs={data.extraItems} />
      {data.requiredItem ? <RefList title={t.f.requiredItem} kind="item" refs={[data.requiredItem]} /> : null}
      <OtherFields data={data} known={HARVEST_KNOWN} title={t.f.other} />
    </View>
  );
}
