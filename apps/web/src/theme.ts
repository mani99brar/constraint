/**
 * Theme tokens (PRD U1, U5): one light and one dark set, applied as CSS custom properties that
 * follow the system colour scheme. `styles.css` uses only these variables for colour.
 */

export const TOKEN_NAMES = [
  'bg',
  'table',
  'surface',
  'surface-2',
  'text',
  'muted',
  'border',
  'primary',
  'on-primary',
  'own',
  'own-rim',
  'on-own',
  'enemy',
  'enemy-rim',
  'on-enemy',
  'forest',
  'water',
  'mountain',
  'desert',
  'forest-ink',
  'water-ink',
  'mountain-ink',
  'desert-ink',
  'sun',
  'moon',
  'star',
  'wave',
  'frame',
  'frame-edge',
  'on-frame',
  'chip',
  'legal',
  'recent',
  'focus',
  'refusal',
  'win',
  'slot',
  'toast',
  'on-toast',
  'toast-alert',
  'on-toast-alert',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type Theme = Readonly<Record<TokenName, string>>;

/** A soft garden palette: sage table, wooden frame, pale terrain tiles with darker ink for the scenes. */
export const LIGHT: Theme = {
  bg: '#e4e8dc',
  table: '#d5dcc8',
  surface: '#fbfaf5',
  'surface-2': '#eef0e6',
  text: '#1f2a1f',
  muted: '#465242',
  border: '#7d8a73',
  primary: '#2f6b3a',
  'on-primary': '#ffffff',
  own: '#2c5aa0',
  'own-rim': '#173a6e',
  'on-own': '#ffffff',
  enemy: '#a63b2b',
  'enemy-rim': '#6b2015',
  'on-enemy': '#ffffff',
  forest: '#bfdca8',
  water: '#b0d4ea',
  mountain: '#d6d0de',
  desert: '#f0dca2',
  'forest-ink': '#3f7a3a',
  'water-ink': '#2f6f9f',
  'mountain-ink': '#6a6180',
  'desert-ink': '#b07f2a',
  sun: '#c2410c',
  moon: '#4338ca',
  star: '#a16207',
  wave: '#0f766e',
  frame: '#7a5a3a',
  'frame-edge': '#4f3a24',
  'on-frame': '#fff8ec',
  chip: '#fbfaf5',
  legal: '#d97706',
  recent: '#7c3aed',
  focus: '#0f172a',
  refusal: '#9f1239',
  win: '#0e7490',
  slot: '#d9c7a3',
  toast: '#1f2a1f',
  'on-toast': '#fbfaf5',
  'toast-alert': '#8c1d2c',
  'on-toast-alert': '#ffffff',
};

export const DARK: Theme = {
  bg: '#121712',
  table: '#1a221a',
  surface: '#1f271f',
  'surface-2': '#29332a',
  text: '#e9efe4',
  muted: '#b5c0ad',
  border: '#5d6b57',
  primary: '#9fd3a5',
  'on-primary': '#0d1a0f',
  own: '#8fb4ff',
  'own-rim': '#d6e3ff',
  'on-own': '#0b1426',
  enemy: '#ff9f8f',
  'enemy-rim': '#ffd9d2',
  'on-enemy': '#2a0b06',
  forest: '#26432c',
  water: '#1d3b53',
  mountain: '#3b3647',
  desert: '#4d3f1c',
  'forest-ink': '#7fc77a',
  'water-ink': '#79b8e6',
  'mountain-ink': '#b6aacb',
  'desert-ink': '#e2b45c',
  sun: '#fdba74',
  moon: '#a5b4fc',
  star: '#fcd34d',
  wave: '#5eead4',
  frame: '#3b2c1e',
  'frame-edge': '#21180f',
  'on-frame': '#f3e6d3',
  chip: '#1f271f',
  legal: '#fbbf24',
  recent: '#c4b5fd',
  focus: '#f8fafc',
  refusal: '#fda4af',
  win: '#67e8f9',
  slot: '#2e241a',
  toast: '#e9efe4',
  'on-toast': '#121712',
  'toast-alert': '#fda4af',
  'on-toast-alert': '#2a0710',
};

/** Every text colour drawn on a background colour, as [text, background]; each must reach 4.5:1. */
export const TEXT_PAIRS: readonly (readonly [TokenName, TokenName])[] = [
  ['text', 'bg'],
  ['text', 'table'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['text', 'chip'],
  ['muted', 'bg'],
  ['muted', 'table'],
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
  ['on-frame', 'frame'],
  ['refusal', 'surface'],
  ['refusal', 'bg'],
  ['on-toast', 'toast'],
  ['on-toast-alert', 'toast-alert'],
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
