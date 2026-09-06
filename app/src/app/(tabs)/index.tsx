import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EntityRow } from '@/components/entity-row';
import { Chip, Empty, Loading } from '@/components/ui';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { KINDS, type Kind } from '@/db/types';
import { useEntityList } from '@/hooks/use-entity-list';
import { useT } from '@/state/app-state';

export default function SearchScreen() {
  const t = useT();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind | undefined>(undefined);
  const params = useMemo(() => ({ query, kind }), [query, kind]);
  const { items, loading, loadMore } = useEntityList(params);
  const trimmed = query.trim();

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={t.searchPlaceholder}
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        <Chip label={t.all} active={!kind} onPress={() => setKind(undefined)} />
        {KINDS.map((k) => <Chip key={k} label={t.kinds[k]} active={kind === k} onPress={() => setKind(kind === k ? undefined : k)} />)}
      </ScrollView>
      {loading && items.length === 0 ? (
        <Loading text={t.loading} />
      ) : items.length === 0 ? (
        <Empty text={trimmed ? t.noResults : t.searchPlaceholder} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => `${e.kind}:${e.id}`}
          renderItem={({ item }) => <EntityRow entity={item} showKind={!kind} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={15}
          windowSize={7}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, margin: Spacing.lg, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, height: 44, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, color: Colors.text, fontSize: FontSize.md, paddingVertical: 0 },
  chips: { gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
});
