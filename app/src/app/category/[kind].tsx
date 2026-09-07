import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EntityRow } from '@/components/entity-row';
import { DEFAULT_ITEM_FILTERS, ItemFilters, toSearchParams } from '@/components/item-filters';
import { Empty, Loading } from '@/components/ui';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getCategories } from '@/db/queries';
import type { Category, Kind } from '@/db/types';
import { useEntityList } from '@/hooks/use-entity-list';
import { useApp } from '@/state/app-state';

/**
 * Category browser: shows child categories of `parent` and the entities that carry
 * every tag on the category path. Works for kinds without categories too (titles, harvest).
 */
export default function CategoryScreen() {
  const { kind, parent, title } = useLocalSearchParams<{ kind: Kind; parent?: string; title?: string }>();
  const router = useRouter();
  const { t, dataVersion } = useApp();
  const [cats, setCats] = useState<Category[]>([]);
  const [minLevel, setMinLevel] = useState('');
  const [maxLevel, setMaxLevel] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_ITEM_FILTERS);
  const parentId = parent ? Number(parent) : 0;

  useEffect(() => { getCategories(kind).then(setCats).catch(() => setCats([])); }, [kind, dataVersion]);

  const current = cats.find((c) => c.id === parentId);
  const children = cats.filter((c) => c.parentId === parentId && c.depth > 0);
  const tagsKey = (current?.path ?? []).join('|');
  const params = useMemo(() => ({
    kind, tags: tagsKey ? tagsKey.split('|') : [], query,
    ...(kind === 'item' ? toSearchParams(filters) : {
      minLevel: minLevel ? Number(minLevel) : undefined,
      maxLevel: maxLevel ? Number(maxLevel) : undefined,
    }),
  }), [kind, tagsKey, query, minLevel, maxLevel, filters]);
  const { items, loading, loadMore } = useEntityList(params);

  const header = (
    <View>
      {children.length ? (
        <View style={styles.catWrap}>
          {children.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push({ pathname: '/category/[kind]', params: { kind, parent: String(c.id), title: c.name } })}
              style={({ pressed }) => [styles.cat, pressed && { backgroundColor: Colors.surfaceAlt }]}>
              <Text style={styles.catText}>{c.name}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.filters}>
        <View style={[styles.inputWrap, { flex: 1 }]}>
          <Ionicons name="search" size={14} color={Colors.textMuted} />
          <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder={t.filterByName} placeholderTextColor={Colors.textMuted} autoCorrect={false} />
        </View>
        {kind !== 'title' && kind !== 'item' ? (
          <>
            <View style={styles.inputWrap}>
              <Text style={styles.lvlLabel}>{t.lvl} {t.minLevel}</Text>
              <TextInput style={[styles.input, styles.lvlInput]} value={minLevel} onChangeText={setMinLevel} keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.lvlLabel}>{t.maxLevel}</Text>
              <TextInput style={[styles.input, styles.lvlInput]} value={maxLevel} onChangeText={setMaxLevel} keyboardType="number-pad" maxLength={2} />
            </View>
          </>
        ) : null}
      </View>
      {kind === 'item' ? <ItemFilters value={filters} onChange={setFilters} /> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: title || t.kinds[kind] }} />
      <FlatList
        data={items}
        keyExtractor={(e) => `${e.kind}:${e.id}`}
        renderItem={({ item }) => <EntityRow entity={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <Loading text={t.loading} /> : <Empty text={t.noResults} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        windowSize={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  catWrap: { padding: Spacing.lg, gap: Spacing.sm },
  cat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  catText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  filters: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  input: { flex: 1, color: Colors.text, fontSize: FontSize.sm, paddingVertical: 0 },
  lvlLabel: { color: Colors.textMuted, fontSize: FontSize.xs },
  lvlInput: { width: 28, textAlign: 'center' },
});
