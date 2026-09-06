import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RefList } from '@/components/ref-list';
import { Bullets, KeyValue, Paragraph, Section, StatTable } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { Ref, Stat } from '@/db/types';
import { useT } from '@/state/app-state';

import { formatMinutes, OtherFields } from './common';

interface ItemDetail {
  descLong?: string;
  restrictions?: string[];
  types?: string[];
  minLevelRestrictions?: string;
  maxLevelRestrictions?: string;
  baseStats?: Stat[];
  bonusStats?: Stat[];
  hideBonusStats?: Stat[];
  chargeBonus1?: Stat[];
  chargeBonus2?: Stat[];
  randomStats?: { prob: number; stats: Stat[] }[];
  manastoneCount?: number;
  manastoneBonusCount?: number;
  specialManastoneCount?: number;
  maxEnchant?: number;
  maxEnchantBonus?: number;
  expireTime?: number;
  titleExpireTime?: number;
  useDelay?: number;
  castDelay?: number;
  chargeWay?: number;
  disasemblyType?: number;
  buyInfo?: { type?: number; kinah?: number | null; ap?: number | null; item?: Ref | null; itemCount?: number | null };
  itemSet?: { itemCount?: number; statList?: { count: number; stats: Stat[] }[]; itemList?: Ref[] };
  tradeIn?: { abyssPoint?: number; items?: Ref[] };
  getNpcDrop?: Ref[]; getNpcBuy?: Ref[]; getNpcTradeIn?: Ref[]; useQuest?: Ref[]; getQuestReward?: Ref[];
  getItemCraft?: Ref[]; useCraft?: Ref[]; getItemDisassembly?: Ref[]; useItemTrade?: Ref[]; getHarvest?: Ref[];
  [key: string]: unknown;
}

const KNOWN = new Set(['descLong', 'restrictions', 'types', 'minLevelRestrictions', 'maxLevelRestrictions', 'baseStats', 'bonusStats', 'hideBonusStats', 'chargeBonus1', 'chargeBonus2', 'randomStats', 'manastoneCount', 'manastoneBonusCount', 'specialManastoneCount', 'maxEnchant', 'maxEnchantBonus', 'expireTime', 'titleExpireTime', 'useDelay', 'castDelay', 'chargeWay', 'disasemblyType', 'buyInfo', 'itemSet', 'tradeIn', 'getNpcDrop', 'getNpcBuy', 'getNpcTradeIn', 'useQuest', 'getQuestReward', 'getItemCraft', 'useCraft', 'getItemDisassembly', 'useItemTrade', 'getHarvest']);

const countOf = (r: Ref) => (typeof r.count === 'number' && r.count > 1 ? `×${r.count.toLocaleString()}` : undefined);

export function ItemDetailView({ data }: { data: ItemDetail }) {
  const t = useT();
  const props: [string, unknown][] = [
    [t.f.manastones, data.manastoneCount ? `${data.manastoneCount}${data.manastoneBonusCount ? ` (+${data.manastoneBonusCount})` : ''}` : undefined],
    [t.f.specialManastones, data.specialManastoneCount || undefined],
    [t.f.maxEnchant, data.maxEnchant ? `${data.maxEnchant}${data.maxEnchantBonus ? ` (+${data.maxEnchantBonus})` : ''}` : undefined],
    [t.f.expireTime, formatMinutes(data.expireTime, t)],
    [t.f.useDelay, data.useDelay ? `${data.useDelay / 1000} ${t.f.sec}` : undefined],
  ];
  const buy = data.buyInfo;
  const hasBuy = buy && ((buy.kinah ?? 0) > 0 || (buy.ap ?? 0) > 0 || buy.item);
  return (
    <View>
      {(data.descLong || data.restrictions?.length || data.types?.length || data.minLevelRestrictions || data.maxLevelRestrictions) ? (
        <Section title={t.f.description}>
          <Paragraph text={data.descLong} />
          <Bullets items={[data.minLevelRestrictions, data.maxLevelRestrictions].filter((x): x is string => !!x)} color={Colors.textSecondary} />
          <Bullets items={data.types} color={Colors.success} />
          <Bullets items={data.restrictions} color={Colors.danger} />
        </Section>
      ) : null}
      {data.baseStats?.length ? <Section title={t.f.baseStats}><StatTable stats={data.baseStats} /></Section> : null}
      {data.bonusStats?.length ? <Section title={t.f.bonusStats}><StatTable stats={data.bonusStats} positiveColor /></Section> : null}
      {data.hideBonusStats?.length ? <Section title={t.f.hideBonusStats}><StatTable stats={data.hideBonusStats} positiveColor /></Section> : null}
      {data.chargeBonus1?.length ? <Section title={t.f.chargeBonus1}><StatTable stats={data.chargeBonus1} positiveColor /></Section> : null}
      {data.chargeBonus2?.length ? <Section title={t.f.chargeBonus2}><StatTable stats={data.chargeBonus2} positiveColor /></Section> : null}
      {props.some(([, v]) => v !== undefined) || hasBuy ? (
        <Section title={t.f.other}>
          {props.map(([k, v]) => <KeyValue key={k} label={k} value={v as string} />)}
          {hasBuy ? (
            <>
              {buy!.kinah ? <KeyValue label={`${t.f.buyInfo} (${t.f.kinah})`} value={buy!.kinah.toLocaleString()} /> : null}
              {buy!.ap ? <KeyValue label={`${t.f.buyInfo} (${t.f.ap})`} value={buy!.ap.toLocaleString()} /> : null}
            </>
          ) : null}
        </Section>
      ) : null}
      {hasBuy && buy!.item ? <RefList title={t.f.buyInfo} kind="item" refs={[{ ...buy!.item, count: buy!.itemCount ?? undefined }]} trailing={countOf} /> : null}
      {data.randomStats?.length ? (
        <Section title={t.f.randomStats}>
          {data.randomStats.map((g, i) => (
            <View key={i} style={styles.group}>
              <Text style={styles.groupTitle}>{t.f.chance}: {(g.prob / 100).toFixed(2)}%</Text>
              <StatTable stats={g.stats} positiveColor />
            </View>
          ))}
        </Section>
      ) : null}
      {data.itemSet ? (
        <>
          {data.itemSet.statList?.length ? (
            <Section title={t.f.setBonus}>
              {data.itemSet.statList.map((s, i) => (
                <View key={i} style={styles.group}>
                  <Text style={styles.groupTitle}>{s.count} / {data.itemSet!.itemCount ?? s.count}</Text>
                  <StatTable stats={s.stats} positiveColor />
                </View>
              ))}
            </Section>
          ) : null}
          <RefList title={t.f.itemSet} kind="item" refs={data.itemSet.itemList} />
        </>
      ) : null}
      {data.tradeIn?.items?.length ? <RefList title={`${t.f.tradeIn}${data.tradeIn.abyssPoint ? ` (+${data.tradeIn.abyssPoint} ${t.f.ap})` : ''}`} kind="item" refs={data.tradeIn.items} trailing={countOf} /> : null}
      <RefList title={t.f.getNpcDrop} kind="npc" refs={data.getNpcDrop} />
      <RefList title={t.f.getNpcBuy} kind="npc" refs={data.getNpcBuy} />
      <RefList title={t.f.getNpcTradeIn} kind="npc" refs={data.getNpcTradeIn} />
      <RefList title={t.f.getHarvest} kind="harvest" refs={data.getHarvest} />
      <RefList title={t.f.getItemCraft} kind="item" refs={data.getItemCraft} />
      <RefList title={t.f.useCraft} kind="item" refs={data.useCraft} />
      <RefList title={t.f.getItemDisassembly} kind="item" refs={data.getItemDisassembly} />
      <RefList title={t.f.useItemTrade} kind="item" refs={data.useItemTrade} />
      <RefList title={t.f.useQuest} kind="quest" refs={data.useQuest} />
      <RefList title={t.f.getQuestReward} kind="quest" refs={data.getQuestReward} />
      <OtherFields data={data} known={KNOWN} title={t.f.other} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  groupTitle: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '700', marginBottom: 2 },
});
