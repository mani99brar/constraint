/**
 * Theme tokens (PRD U1, U5): one light and one dark set, applied as CSS custom properties that
 * follow the system colour scheme. `styles.css` uses only these variables for colour.
 */

export const TOKEN_NAMES = [
  'bg',
  'ground',
  'ground-glow',
  'ground-edge',
  'surface',
  'surface-2',
  'surface-3',
  'text',
  'muted',
  'border',
  'primary',
  'on-primary',
  'p1',
  'p1-rim',
  'on-p1',
  'p2',
  'p2-rim',
  'on-p2',
  'face',
  'face-ink',
  'cheek',
  'tear',
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
  'frame-grain',
  'frame-sheen',
  'on-frame',
  'shine',
  'shade',
  'chip',
  'legal',
  'recent',
  'focus',
  'refusal',
  'win',
  'slot',
  'grey',
  'toast',
  'on-toast',
  'toast-alert',
  'on-toast-alert',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type Theme = Readonly<Record<TokenName, string>>;

/** Warm paper: a quiet linen ground, a wooden frame, pale terrain tiles with darker ink for the scenes. */
export const LIGHT: Theme = {
  bg: '#efe9dd',
  ground: '#efe9dd',
  'ground-glow': '#faf7f0',
  'ground-edge': '#ddd4c3',
  surface: '#fdfbf7',
  'surface-2': '#f3eee5',
  'surface-3': '#e7e0d3',
  text: '#25221c',
  muted: '#544e40',
  border: '#8d8574',
  primary: '#2c5a60',
  'on-primary': '#ffffff',
  p1: '#2c5aa0',
  'p1-rim': '#173a6e',
  'on-p1': '#ffffff',
  p2: '#a63b2b',
  'p2-rim': '#6b2015',
  'on-p2': '#ffffff',
  face: '#f6e4c8',
  'face-ink': '#2b2118',
  cheek: '#f0a08c',
  tear: '#2f6f9f',
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
  frame: '#74553a',
  'frame-edge': '#4f3a24',
  'frame-grain': '#654830',
  'frame-sheen': '#82603f',
  'on-frame': '#fff8ec',
  shine: '#ffffff',
  shade: '#2b2118',
  chip: '#fdfbf7',
  legal: '#d97706',
  recent: '#efc979',
  focus: '#0f172a',
  refusal: '#9f1239',
  win: '#0e7490',
  slot: '#d6c9ae',
  grey: '#808080',
  toast: '#25221c',
  'on-toast': '#fdfbf7',
  'toast-alert': '#8c1d2c',
  'on-toast-alert': '#ffffff',
};

/** Slate ink: a desaturated blue-grey ground, a dark wooden frame and deep terrain tiles with light ink. */
export const DARK: Theme = {
  bg: '#1b1f24',
  ground: '#1b1f24',
  'ground-glow': '#272c33',
  'ground-edge': '#121519',
  surface: '#242a31',
  'surface-2': '#2c333b',
  'surface-3': '#353d46',
  text: '#e8ebee',
  muted: '#b6bec7',
  border: '#606a76',
  primary: '#9cc8cb',
  'on-primary': '#0d1a1c',
  p1: '#8fb4ff',
  'p1-rim': '#d6e3ff',
  'on-p1': '#0b1426',
  p2: '#ff9f8f',
  'p2-rim': '#ffd9d2',
  'on-p2': '#2a0b06',
  face: '#ead3b0',
  'face-ink': '#2b2118',
  cheek: '#d9826e',
  tear: '#79b8e6',
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
  'frame-grain': '#30241a',
  'frame-sheen': '#4a3827',
  'on-frame': '#f3e6d3',
  shine: '#fff6e8',
  shade: '#06080a',
  chip: '#242a31',
  legal: '#fbbf24',
  recent: '#6e5426',
  focus: '#f8fafc',
  refusal: '#fda4af',
  win: '#67e8f9',
  slot: '#2b2620',
  grey: '#808080',
  toast: '#e8ebee',
  'on-toast': '#1b1f24',
  'toast-alert': '#fda4af',
  'on-toast-alert': '#2a0710',
};

/**
 * The text-bearing materials (PRD U1, U5): each surface's gradient stops, all theme tokens, and every
 * text colour drawn on it. Text must reach 4.5:1 against every stop, so every pair is in TEXT_PAIRS.
 * The ground, the tiles and the tokens carry no text of their own (a tile's name sits on its solid plate,
 * the `chip`); their shading is free of this list.
 */
export const MATERIALS: readonly { readonly name: string; readonly selectors: readonly string[]; readonly stops: readonly TokenName[]; readonly text: readonly TokenName[] }[] = [
  // The wood of the board frame (its A–D and 1–4 labels) and of the home screen's wordmark plaque.
  { name: 'wood', selectors: ['.board-frame', '.wordmark'], stops: ['frame', 'frame-grain', 'frame-sheen'], text: ['on-frame'] },
  // Cards, lit nameplates, buttons, the Match card, the end card and the dialogs: a raised card.
  { name: 'card', selectors: ['.material-card', 'button', '.seat.lit'], stops: ['surface', 'surface-2'], text: ['text', 'muted', 'primary', 'refusal'] },
  // A dimmed nameplate, a shade darker.
  { name: 'dim plate', selectors: ['.seat', '.seat.dimmed'], stops: ['surface-2', 'surface-3'], text: ['text', 'muted'] },
];

/** Every text colour drawn on a background colour, as [text, background]; each must reach 4.5:1. */
export const TEXT_PAIRS: readonly (readonly [TokenName, TokenName])[] = [
  ['text', 'bg'],
  // The ground's solid colour and its glow and vignette stops: nothing is written on it, but text that
  // ever met it would still read.
  ['text', 'ground'],
  ['text', 'ground-glow'],
  ['text', 'ground-edge'],
  ['muted', 'ground'],
  ['muted', 'ground-glow'],
  ['muted', 'ground-edge'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  // A tile's name on its solid plate.
  ['text', 'chip'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['text', 'surface-3'],
  ['muted', 'surface-3'],
  ['primary', 'surface-2'],
  ['refusal', 'surface-2'],
  ['on-primary', 'primary'],
  ['primary', 'surface'],
  ['refusal', 'surface-3'],
  ['on-p1', 'p1'],
  ['on-p2', 'p2'],
  ['text', 'forest'],
  ['text', 'water'],
  ['text', 'mountain'],
  ['text', 'desert'],
  ['on-frame', 'frame'],
  ['on-frame', 'frame-grain'],
  ['on-frame', 'frame-sheen'],
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
