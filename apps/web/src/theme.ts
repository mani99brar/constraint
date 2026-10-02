/**
 * Theme tokens (PRD U1, U4): one light and one dark set, applied as CSS custom properties that
 * follow the system colour scheme. `styles.css` uses only these variables for colour.
 */

export const TOKEN_NAMES = [
  'bg',
  'surface',
  'surface-2',
  'text',
  'muted',
  'border',
  'primary',
  'on-primary',
  'own',
  'on-own',
  'enemy',
  'on-enemy',
  'forest',
  'water',
  'mountain',
  'desert',
  'legal',
  'recent',
  'focus',
  'refusal',
  'trap',
  'on-trap',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type Theme = Readonly<Record<TokenName, string>>;

export const LIGHT: Theme = {
  bg: '#f4f1ea',
  surface: '#ffffff',
  'surface-2': '#e9e4d8',
  text: '#1d1d1f',
  muted: '#4f4d48',
  border: '#8a8478',
  primary: '#1e40af',
  'on-primary': '#ffffff',
  own: '#1d4ed8',
  'on-own': '#ffffff',
  enemy: '#b91c1c',
  'on-enemy': '#ffffff',
  forest: '#c7e3b2',
  water: '#bcd9f2',
  mountain: '#d9d3cb',
  desert: '#f1e0a6',
  legal: '#a16207',
  recent: '#7c3aed',
  focus: '#0f172a',
  refusal: '#9f1239',
  trap: '#7f1d1d',
  'on-trap': '#ffffff',
};

export const DARK: Theme = {
  bg: '#14151a',
  surface: '#1e2027',
  'surface-2': '#2a2d36',
  text: '#ecebe6',
  muted: '#b9b6ae',
  border: '#6b6a66',
  primary: '#9db8ff',
  'on-primary': '#0b1020',
  own: '#8fb0ff',
  'on-own': '#0b1020',
  enemy: '#ff9a9a',
  'on-enemy': '#220808',
  forest: '#1f3b25',
  water: '#18324d',
  mountain: '#3a3733',
  desert: '#4a3b17',
  legal: '#facc15',
  recent: '#c4b5fd',
  focus: '#f8fafc',
  refusal: '#fda4af',
  trap: '#fecaca',
  'on-trap': '#3b0a0a',
};

/** Every text colour drawn on a background colour, as [text, background]; each must reach 4.5:1. */
export const TEXT_PAIRS: readonly (readonly [TokenName, TokenName])[] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['on-primary', 'primary'],
  ['primary', 'surface'],
  ['on-own', 'own'],
  ['on-enemy', 'enemy'],
  ['text', 'forest'],
  ['text', 'water'],
  ['text', 'mountain'],
  ['text', 'desert'],
  ['refusal', 'surface'],
  ['refusal', 'bg'],
  ['on-trap', 'trap'],
];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#rrggbb` colour (WCAG 2). */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [match[1]!, match[2]!, match[3]!].map((part) => channel(parseInt(part, 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio of two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function declarations(theme: Theme): string {
  return TOKEN_NAMES.map((name) => `--${name}: ${theme[name]};`).join(' ');
}

/** The style sheet that defines the tokens: light by default, dark under the system dark scheme. */
export function themeStyleSheet(): string {
  return [
    `:root { color-scheme: light; ${declarations(LIGHT)} }`,
    `@media (prefers-color-scheme: dark) { :root { color-scheme: dark; ${declarations(DARK)} } }`,
  ].join('\n');
}
