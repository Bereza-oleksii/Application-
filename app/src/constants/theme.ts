/** Visual constants. The palette follows the source site (dark background, gold accent). */
export const Colors = {
  background: '#0D1117',
  surface: '#161B22',
  surfaceAlt: '#1F2630',
  border: '#2A313C',
  text: '#E6EDF3',
  textSecondary: '#9AA4B2',
  textMuted: '#6B7480',
  accent: '#C9A84C',
  accentText: '#0D1117',
  danger: '#E5534B',
  success: '#3FB950',
  elyos: '#5AA9E6',
  asmodian: '#C56CF0',
} as const;

/** Aion item quality tiers -> colors used for names and borders. */
export const QualityColors: Record<number, string> = {
  0: '#8B949E', // junk
  1: '#E6EDF3', // common
  2: '#56D364', // superior
  3: '#58A6FF', // heroic
  4: '#F0883E', // fabled
  5: '#F2CC60', // eternal
  6: '#D2A8FF', // mythic
};

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 6, md: 10, lg: 14 } as const;
export const FontSize = { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28 } as const;
