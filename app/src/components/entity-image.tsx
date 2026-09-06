import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, QualityColors, Radius } from '@/constants/theme';
import { getImageUri } from '@/db/images';

interface Props {
  path: string | null | undefined;
  size?: number;
  quality?: number | null;
  rounded?: boolean;
}

/** Renders an image stored in assets.db (as a data: URI) with a quality-colored border. */
export function EntityImage({ path, size = 44, quality, rounded = true }: Props) {
  const [loaded, setLoaded] = useState<{ path: string | null | undefined; uri: string | null }>({ path: undefined, uri: null });
  useEffect(() => {
    let alive = true;
    getImageUri(path).then((u) => { if (alive) setLoaded({ path, uri: u }); });
    return () => { alive = false; };
  }, [path]);
  const uri = loaded.path === path ? loaded.uri : null;
  const border = quality !== undefined && quality !== null ? QualityColors[quality] ?? Colors.border : Colors.border;
  return (
    <View style={[styles.frame, { width: size, height: size, borderColor: border, borderRadius: rounded ? Radius.sm : 0 }]}>
      {uri ? <Image source={{ uri }} style={{ width: size - 4, height: size - 4 }} contentFit="contain" transition={80} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1.5,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
