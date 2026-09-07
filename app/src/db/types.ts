export type Kind = 'item' | 'npc' | 'quest' | 'skill' | 'title' | 'harvest';
export const KINDS: Kind[] = ['item', 'npc', 'quest', 'skill', 'title', 'harvest'];
export type RefKind = Kind | 'map';

export interface EntitySummary {
  kind: Kind;
  id: number;
  name: string;
  level: number | null;
  quality: number | null;
  image: string | null;
  tags: string[];
  sub: Record<string, unknown> | null;
  /** Items only: bitmask 1 = Elyos, 2 = Asmodian. */
  race: number | null;
}

export interface Category {
  kind: Kind;
  id: number;
  parentId: number | null;
  name: string;
  depth: number;
  /** Tag names from the root to this category (used to filter entities). */
  path: string[];
}

export interface MapInfo {
  id: number;
  code: string;
  name: string;
  type: string | null;
  preview: string | null;
  image: string | null;
  width: number | null;
  height: number | null;
  offsetX: number | null;
  offsetY: number | null;
}

export type SpawnPoint = [x: number, y: number, z: number];

/** A reference to another entity inside a detail JSON (desc/image are resolved from `entities`). */
export interface Ref {
  id: number;
  count?: number;
  quality?: number;
  [key: string]: unknown;
}

export interface Stat { name: string; value: string }

export interface SearchParams {
  query?: string;
  kind?: Kind;
  tags?: string[];
  minLevel?: number;
  maxLevel?: number;
  quality?: number[];
  /** Bitmask: 1 = Elyos, 2 = Asmodian. */
  race?: number;
  limit: number;
  offset: number;
}
