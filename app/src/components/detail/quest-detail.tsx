import React from 'react';
import { View } from 'react-native';

import { RefList } from '@/components/ref-list';
import { KeyValue, Section } from '@/components/ui';
import type { Ref } from '@/db/types';
import { useT } from '@/state/app-state';

import { OtherFields } from './common';

interface Reward {
  kinah?: number; exp?: number; abyssPoint?: number; gloryPoint?: number; extendInventory?: number; extendStigma?: number;
  title?: Ref | null; items?: Ref[] | null; randomItems?: Ref[] | null; selectableItems?: Ref[] | null;
}
interface ClassReward { classDesc?: string; items?: Ref[] }
interface QuestDetail {
  zoneName?: string; minLevel?: number; maxLevel?: number; maxRepeatCount?: number; cannotShare?: number;
  raceRestirct?: string; classRestrict?: string; genderRestrict?: string; abyssRank?: string | number; guildLevel?: number;
  repeatCycle?: string | string[]; combineSkillDesc?: string; combineSkillPoint?: number;
  repeatRewardCount?: number; rewards?: Reward[]; repeatReward?: Reward;
  classSelectableRewards?: ClassReward[]; repeatClassSelectableRewards?: ClassReward[];
  npcs?: Ref[]; startNpcs?: Ref[]; items?: Ref[];
  finishedQuestsCond?: Ref[]; acquiredQuestsCond?: Ref[]; unfinishedQuestsCond?: Ref[]; noacquiredQuestsCond?: Ref[];
  [key: string]: unknown;
}
const KNOWN = new Set(['zoneName', 'minLevel', 'maxLevel', 'maxRepeatCount', 'cannotShare', 'raceRestirct', 'classRestrict', 'genderRestrict', 'abyssRank', 'guildLevel',
  'repeatCycle', 'combineSkillDesc', 'combineSkillPoint', 'repeatRewardCount', 'rewards', 'repeatReward', 'classSelectableRewards', 'repeatClassSelectableRewards',
  'npcs', 'startNpcs', 'items', 'finishedQuestsCond', 'acquiredQuestsCond', 'unfinishedQuestsCond', 'noacquiredQuestsCond']);
const countOf = (r: Ref) => (typeof r.count === 'number' && r.count > 1 ? `×${r.count.toLocaleString()}` : undefined);

export function QuestDetailView({ data }: { data: QuestDetail }) {
  const t = useT();
  const lvl = data.minLevel ? `${data.minLevel}${data.maxLevel ? ` – ${data.maxLevel}` : '+'}` : undefined;
  const repeat = data.maxRepeatCount === 255 ? '∞' : data.maxRepeatCount && data.maxRepeatCount > 1 ? String(data.maxRepeatCount) : undefined;
  return (
    <View>
      <Section>
        <KeyValue label={t.f.zone} value={data.zoneName} />
        <KeyValue label={t.f.levelRange} value={lvl} />
        <KeyValue label={t.f.race} value={data.raceRestirct} />
        <KeyValue label={t.f.classRestrict} value={data.classRestrict} />
        <KeyValue label={t.f.genderRestrict} value={data.genderRestrict} />
        <KeyValue label={t.f.abyssRank} value={data.abyssRank} />
        <KeyValue label={t.f.guildLevel} value={data.guildLevel} />
        <KeyValue label={t.f.repeat} value={repeat} />
        <KeyValue label={t.f.repeatCycle} value={Array.isArray(data.repeatCycle) ? data.repeatCycle.join(', ') : data.repeatCycle} />
        <KeyValue label={t.f.combineSkill} value={data.combineSkillDesc ? `${data.combineSkillDesc}${data.combineSkillPoint ? ` ${data.combineSkillPoint}` : ''}` : undefined} />
        {data.cannotShare ? <KeyValue label={t.f.cannotShare} value={t.f.yes} /> : null}
      </Section>
      {[...(data.rewards ?? []), ...(data.repeatReward ? [{ ...data.repeatReward, __repeat: true }] : [])].map((r: Reward & { __repeat?: boolean }, i) => {
        const nums: [string, number | undefined][] = [[t.f.exp, r.exp], [t.f.kinah, r.kinah], [t.f.ap, r.abyssPoint], [t.f.gp, r.gloryPoint]];
        const hasNums = nums.some(([, v]) => v && v > 0);
        return (
          <View key={i}>
            {hasNums || r.extendInventory || r.extendStigma ? (
              <Section title={r.__repeat ? t.f.repeatReward : (data.rewards?.length ?? 0) > 1 ? `${t.f.rewards} ${i + 1}` : t.f.rewards}>
                {nums.map(([k, v]) => (v && v > 0 ? <KeyValue key={k} label={k} value={v.toLocaleString()} /> : null))}
                {r.extendInventory ? <KeyValue label="extendInventory" value={r.extendInventory} /> : null}
                {r.extendStigma ? <KeyValue label="extendStigma" value={r.extendStigma} /> : null}
              </Section>
            ) : null}
            {r.title ? <RefList title={t.f.title} kind="title" refs={[r.title]} /> : null}
            <RefList title={t.f.rewardItems} kind="item" refs={r.items ?? undefined} trailing={countOf} />
            <RefList title={t.f.randomItems} kind="item" refs={r.randomItems ?? undefined} trailing={countOf} />
            <RefList title={t.f.selectableItems} kind="item" refs={r.selectableItems ?? undefined} trailing={countOf} />
          </View>
        );
      })}
      {(data.classSelectableRewards ?? []).map((c, i) => <RefList key={`cls-${i}`} title={`${t.f.classSelectableRewards}: ${c.classDesc ?? ''}`} kind="item" refs={c.items} trailing={countOf} />)}
      {(data.repeatClassSelectableRewards ?? []).map((c, i) => <RefList key={`rcls-${i}`} title={`${t.f.repeatReward} · ${c.classDesc ?? ''}`} kind="item" refs={c.items} trailing={countOf} />)}
      <RefList title={t.f.startNpcs} kind="npc" refs={data.startNpcs} />
      <RefList title={t.f.npcs} kind="npc" refs={data.npcs} />
      <RefList title={t.f.items} kind="item" refs={data.items} />
      <RefList title={t.f.finishedQuestsCond} kind="quest" refs={data.finishedQuestsCond} />
      <RefList title={t.f.acquiredQuestsCond} kind="quest" refs={data.acquiredQuestsCond} />
      <RefList title={t.f.unfinishedQuestsCond} kind="quest" refs={data.unfinishedQuestsCond} />
      <RefList title={t.f.noacquiredQuestsCond} kind="quest" refs={data.noacquiredQuestsCond} />
      <OtherFields data={data} known={KNOWN} title={t.f.other} />
    </View>
  );
}
