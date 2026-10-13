/**
 * Theme tokens (PRD U1, U5): three colour themes, each with a light and a dark set, applied as CSS
 * custom properties under `:root[data-palette=…]` that follow the system colour scheme. Within a theme the
 * ground, the wooden frame, the tiles, the plates, the buttons and both players come from one family.
 * `styles.css` uses only these variables for colour.
 */

import { MIDNIGHT_AURORA, NEON_FROST, NIGHT_CIRCUIT, SYNTH_HORIZON } from './neonThemes';

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
  'well',
  'shine',
  'shade',
  'chip',
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

/** The colour themes (PRD U5, E3), Walnut and parchment first, the default. */
export const PALETTES = [
  { id: 'night-circuit', label: 'Night Circuit', name: 'Night Circuit, tube neon on black glass', family: 'neon' },
  { id: 'neon-frost', label: 'Neon Frost', name: 'Neon on frosted violet glass', family: 'neon' },
  { id: 'synth-horizon', label: 'Synth Horizon', name: 'Synth Horizon, a neon sunset', family: 'neon' },
  { id: 'midnight-aurora', label: 'Midnight Aurora', name: 'Midnight Aurora, a dark sky with one aqua light', family: 'neon' },
  { id: 'walnut', label: 'Walnut', name: 'Walnut and parchment' },
  { id: 'seaglass', label: 'Sea glass', name: 'Sea glass and stone' },
  { id: 'clear', label: 'Clear', name: 'Clear, high contrast' },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];
export const PALETTE_IDS: readonly PaletteId[] = PALETTES.map((palette) => palette.id);
export const DEFAULT_PALETTE: PaletteId = 'night-circuit';

/** Whether a theme is in the neon family: dark under both system schemes, with the illustrated art set. */
export function isNeon(id: PaletteId): boolean {
  return id === 'night-circuit' || id === 'neon-frost' || id === 'synth-horizon' || id === 'midnight-aurora';
}

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && (PALETTE_IDS as readonly string[]).includes(value);
}

/** Walnut and parchment, light: a parchment ground, a walnut frame and buttons, ink-brown text, indigo and terracotta players. */
const WALNUT_LIGHT: Theme = {
  bg: '#f3ebdd',
  ground: '#f3ebdd',
  'ground-glow': '#faf5eb',
  'ground-edge': '#e8dcc7',
  surface: '#fcf8f0',
  'surface-2': '#f3eadb',
  'surface-3': '#e9dcc6',
  text: '#2b2118',
  muted: '#59473a',
  border: '#9a8468',
  primary: '#6b4a30',
  'on-primary': '#fdf6e8',
  p1: '#34509a',
  'p1-rim': '#1f3570',
  'on-p1': '#ffffff',
  p2: '#a8482f',
  'p2-rim': '#6e2c1a',
  'on-p2': '#ffffff',
  face: '#f6e4c8',
  'face-ink': '#2b2118',
  cheek: '#e8957e',
  tear: '#34509a',
  forest: '#c6d9a8',
  water: '#bad4de',
  mountain: '#d8cfd2',
  desert: '#efdaa6',
  'forest-ink': '#4a6e34',
  'water-ink': '#3a6a82',
  'mountain-ink': '#6e6272',
  'desert-ink': '#a5782c',
  sun: '#b5521e',
  moon: '#4a4791',
  star: '#8e6510',
  wave: '#2f6e6a',
  frame: '#7a5638',
  'frame-edge': '#4e3522',
  'frame-grain': '#6a4a2f',
  'frame-sheen': '#86603f',
  'on-frame': '#fff6e6',
  well: '#e8dcc7',
  shine: '#ffffff',
  shade: '#2b2118',
  chip: '#fcf8f0',
  focus: '#2b2118',
  refusal: '#8a2432',
  win: '#7a5a10',
  slot: '#d9c9ad',
  grey: '#808080',
  toast: '#2b2118',
  'on-toast': '#fcf8f0',
  'toast-alert': '#8a2432',
  'on-toast-alert': '#ffffff',
};

/** Walnut and parchment, dark: a warm charcoal ground with cream text, a dark walnut frame and well, light indigo and terracotta players. */
const WALNUT_DARK: Theme = {
  bg: '#1e1a16',
  ground: '#1e1a16',
  'ground-glow': '#2a241e',
  'ground-edge': '#14110e',
  surface: '#2a241e',
  'surface-2': '#322b24',
  'surface-3': '#3b332b',
  text: '#f2e8d8',
  muted: '#cbbba4',
  border: '#73624f',
  primary: '#dcb98f',
  'on-primary': '#1e1a16',
  p1: '#9db2f0',
  'p1-rim': '#d5dffa',
  'on-p1': '#121a30',
  p2: '#f0a07f',
  'p2-rim': '#fad5c5',
  'on-p2': '#2a120a',
  face: '#ead3b0',
  'face-ink': '#2b2118',
  cheek: '#d9826e',
  tear: '#9db2f0',
  forest: '#2f4027',
  water: '#253a4a',
  mountain: '#3b3540',
  desert: '#4b3e23',
  'forest-ink': '#93c27a',
  'water-ink': '#86b8d6',
  'mountain-ink': '#b8aabf',
  'desert-ink': '#ddb065',
  sun: '#f2a36b',
  moon: '#afaaf0',
  star: '#ebc35a',
  wave: '#7ccfc4',
  frame: '#4a3523',
  'frame-edge': '#2a1d12',
  'frame-grain': '#3e2c1d',
  'frame-sheen': '#5a422d',
  'on-frame': '#f6ead8',
  well: '#251f19',
  shine: '#fff4e2',
  shade: '#060504',
  chip: '#2a241e',
  focus: '#f6ead8',
  refusal: '#f2a7a0',
  win: '#e8c26a',
  slot: '#18140f',
  grey: '#808080',
  toast: '#f2e8d8',
  'on-toast': '#1e1a16',
  'toast-alert': '#f2a7a0',
  'on-toast-alert': '#2a0a08',
};

/** Sea glass and stone, light: a pale stone ground, a driftwood frame, deep teal buttons, teal-navy and burnt-ochre players. */
const SEAGLASS_LIGHT: Theme = {
  bg: '#eef0ec',
  ground: '#eef0ec',
  'ground-glow': '#f8f9f6',
  'ground-edge': '#dde2dc',
  surface: '#fafbf9',
  'surface-2': '#edf1ee',
  'surface-3': '#dfe6e2',
  text: '#17201f',
  muted: '#43504d',
  border: '#7f8f8a',
  primary: '#1f5f5b',
  'on-primary': '#f2faf8',
  p1: '#2e4a8a',
  'p1-rim': '#1b2f5e',
  'on-p1': '#ffffff',
  p2: '#9e5e0e',
  'p2-rim': '#663b05',
  'on-p2': '#ffffff',
  face: '#f3e2c9',
  'face-ink': '#1f2524',
  cheek: '#e59b86',
  tear: '#2e4a8a',
  forest: '#c0d7b9',
  water: '#b4d6d8',
  mountain: '#d3d5dc',
  desert: '#e8dfc0',
  'forest-ink': '#3f6b48',
  'water-ink': '#2f6970',
  'mountain-ink': '#5e6478',
  'desert-ink': '#8e7434',
  sun: '#b4532a',
  moon: '#46508e',
  star: '#866a16',
  wave: '#1f6b66',
  frame: '#76695a',
  'frame-edge': '#4f463a',
  'frame-grain': '#685c4d',
  'frame-sheen': '#7c6e5d',
  'on-frame': '#fbfaf6',
  well: '#e9ede8',
  shine: '#ffffff',
  shade: '#17201f',
  chip: '#fafbf9',
  focus: '#17201f',
  refusal: '#8f2d3a',
  win: '#1f5f5b',
  slot: '#d2dad5',
  grey: '#808080',
  toast: '#17201f',
  'on-toast': '#fafbf9',
  'toast-alert': '#8f2d3a',
  'on-toast-alert': '#ffffff',
};

/** Sea glass and stone, dark: a teal-ink ground, a dark driftwood frame, light teal-navy and amber players. */
const SEAGLASS_DARK: Theme = {
  bg: '#14201f',
  ground: '#14201f',
  'ground-glow': '#1d2c2a',
  'ground-edge': '#0c1514',
  surface: '#1c2a28',
  'surface-2': '#233331',
  'surface-3': '#2b3c3a',
  text: '#e6f0ee',
  muted: '#afc2be',
  border: '#55706b',
  primary: '#86cfc6',
  'on-primary': '#0c1e1c',
  p1: '#93aeef',
  'p1-rim': '#d0dcfa',
  'on-p1': '#0e1830',
  p2: '#e8a956',
  'p2-rim': '#f7d9ae',
  'on-p2': '#2a1904',
  face: '#ead3b0',
  'face-ink': '#1f2524',
  cheek: '#d9826e',
  tear: '#93aeef',
  forest: '#253c2e',
  water: '#1d3a3e',
  mountain: '#34373f',
  desert: '#443b23',
  'forest-ink': '#8cc59a',
  'water-ink': '#7cc4cc',
  'mountain-ink': '#b0b4c6',
  'desert-ink': '#d6b868',
  sun: '#f0a27a',
  moon: '#a9b2ee',
  star: '#e3c565',
  wave: '#6fd6cb',
  frame: '#4a4236',
  'frame-edge': '#2c271f',
  'frame-grain': '#3f382e',
  'frame-sheen': '#574e40',
  'on-frame': '#f2eee6',
  well: '#1a2826',
  shine: '#f2fffc',
  shade: '#030706',
  chip: '#1c2a28',
  focus: '#f2faf8',
  refusal: '#f3a6b0',
  win: '#86cfc6',
  slot: '#101a19',
  grey: '#808080',
  toast: '#e6f0ee',
  'on-toast': '#14201f',
  'toast-alert': '#f3a6b0',
  'on-toast-alert': '#2a0a10',
};

/** Clear, light: a near-white ground and well, black text, a charcoal frame, strong blue and burnt-orange players. */
const CLEAR_LIGHT: Theme = {
  bg: '#f4f4f4',
  ground: '#f4f4f4',
  'ground-glow': '#fbfbfb',
  'ground-edge': '#e6e6e6',
  surface: '#ffffff',
  'surface-2': '#ececec',
  'surface-3': '#dedede',
  text: '#000000',
  muted: '#333333',
  border: '#4a4a4a',
  primary: '#1a1a1a',
  'on-primary': '#ffffff',
  p1: '#0b47c2',
  'p1-rim': '#062a75',
  'on-p1': '#ffffff',
  p2: '#a83c00',
  'p2-rim': '#5c2000',
  'on-p2': '#ffffff',
  face: '#f6e4c8',
  'face-ink': '#000000',
  cheek: '#ef8f78',
  tear: '#0b47c2',
  forest: '#bfe3aa',
  water: '#aad6f2',
  mountain: '#dad4e6',
  desert: '#f5de98',
  'forest-ink': '#2d6a27',
  'water-ink': '#1b5e91',
  'mountain-ink': '#574a78',
  'desert-ink': '#8a5f10',
  sun: '#b8360a',
  moon: '#3730a3',
  star: '#7a5200',
  wave: '#0b6b62',
  frame: '#3e3530',
  'frame-edge': '#1f1a17',
  'frame-grain': '#352d29',
  'frame-sheen': '#4a403a',
  'on-frame': '#ffffff',
  well: '#fafafa',
  shine: '#ffffff',
  shade: '#000000',
  chip: '#ffffff',
  focus: '#000000',
  refusal: '#9f1239',
  win: '#000000',
  slot: '#e2e2e2',
  grey: '#808080',
  toast: '#000000',
  'on-toast': '#ffffff',
  'toast-alert': '#9f1239',
  'on-toast-alert': '#ffffff',
};

/** Clear, dark: a near-black ground and well, white text, a charcoal frame, bright blue and orange players. */
const CLEAR_DARK: Theme = {
  bg: '#000000',
  ground: '#000000',
  'ground-glow': '#111111',
  'ground-edge': '#000000',
  surface: '#141414',
  'surface-2': '#1e1e1e',
  'surface-3': '#282828',
  text: '#ffffff',
  muted: '#d4d4d4',
  border: '#9a9a9a',
  primary: '#ffffff',
  'on-primary': '#000000',
  p1: '#8fb8ff',
  'p1-rim': '#dce8ff',
  'on-p1': '#000000',
  p2: '#ffb27a',
  'p2-rim': '#ffe0c8',
  'on-p2': '#000000',
  face: '#ead3b0',
  'face-ink': '#000000',
  cheek: '#d9826e',
  tear: '#8fb8ff',
  forest: '#1f3d1a',
  water: '#10334d',
  mountain: '#302a40',
  desert: '#46380f',
  'forest-ink': '#9be08a',
  'water-ink': '#7cc4f5',
  'mountain-ink': '#c7b8f0',
  'desert-ink': '#f2c75c',
  sun: '#ffa36e',
  moon: '#b4b0ff',
  star: '#ffd54a',
  wave: '#5eead4',
  frame: '#3a322c',
  'frame-edge': '#1e1a17',
  'frame-grain': '#302924',
  'frame-sheen': '#463c35',
  'on-frame': '#ffffff',
  well: '#0a0a0a',
  shine: '#ffffff',
  shade: '#000000',
  chip: '#141414',
  focus: '#ffffff',
  refusal: '#ffa3b5',
  win: '#ffffff',
  slot: '#050505',
  grey: '#808080',
  toast: '#ffffff',
  'on-toast': '#000000',
  'toast-alert': '#ffa3b5',
  'on-toast-alert': '#000000',
};

export type Variant = 'light' | 'dark';

/** Every theme's light and dark set. */
export const THEMES: Readonly<Record<PaletteId, Readonly<Record<Variant, Theme>>>> = {
  'night-circuit': { light: NIGHT_CIRCUIT, dark: NIGHT_CIRCUIT },
  'neon-frost': { light: NEON_FROST, dark: NEON_FROST },
  'synth-horizon': { light: SYNTH_HORIZON, dark: SYNTH_HORIZON },
  'midnight-aurora': { light: MIDNIGHT_AURORA, dark: MIDNIGHT_AURORA },
  walnut: { light: WALNUT_LIGHT, dark: WALNUT_DARK },
  seaglass: { light: SEAGLASS_LIGHT, dark: SEAGLASS_DARK },
  clear: { light: CLEAR_LIGHT, dark: CLEAR_DARK },
};

/** The default theme's sets. */
export const LIGHT: Theme = WALNUT_LIGHT;
export const DARK: Theme = WALNUT_DARK;

/**
 * The text-bearing materials (PRD U1, U5): each surface's gradient stops, all theme tokens, and every
 * text colour drawn on it. Text must reach 4.5:1 against every stop, so every pair is in TEXT_PAIRS.
 * The ground, the tiles and the tokens carry no text of their own (a tile's name sits on its solid plate,
 * the `chip`); their shading is free of this list.
 */
export const MATERIALS: readonly { readonly name: string; readonly selectors: readonly string[]; readonly stops: readonly TokenName[]; readonly text: readonly TokenName[] }[] = [
  // The wood of the board frame (its A–D and 1–4 labels) and of the home screen's wordmark plaque.
  { name: 'wood', selectors: ['.board-frame', '.wordmark'], stops: ['frame', 'frame-grain', 'frame-sheen'], text: ['on-frame'] },
  // Cards, lit nameplates, buttons, the Match card, the scoreboard's scores (in each player's colour), the end card and the dialogs.
  { name: 'card', selectors: ['.material-card', 'button', '.seat.lit', '.match-card'], stops: ['surface', 'surface-2'], text: ['text', 'muted', 'primary', 'refusal', 'p1', 'p2'] },
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
  // Each player's score in its own colour on the scoreboard's card.
  ['p1', 'surface'],
  ['p1', 'surface-2'],
  ['p2', 'surface'],
  ['p2', 'surface-2'],
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

/**
 * The move ring (PRD R2, WCAG 1.4.11): each player's colour, as the ring round a playable tile, against
 * the board's well between the tiles; each must reach 3:1.
 */
export const RING_PAIRS: readonly (readonly [TokenName, TokenName])[] = [
  ['p1', 'well'],
  ['p2', 'well'],
];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgbOf(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`);
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)];
}

/** Relative luminance of a `#rrggbb` colour (WCAG 2). */
export function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** CIELAB (D65) of an sRGB colour given as 0–255 channels. */
export function labOfRgb(r: number, g: number, b: number): [number, number, number] {
  const [lr, lg, lb] = [r, g, b].map(channel) as [number, number, number];
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.950_47;
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.088_83;
  const f = (t: number) => (t > 216 / 24_389 ? Math.cbrt(t) : (24_389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIELAB of a `#rrggbb` colour. */
export function labOf(hex: string): [number, number, number] {
  return labOfRgb(...rgbOf(hex));
}

/** The CIE76 colour difference ΔE*ab of two `#rrggbb` colours. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = labOf(a);
  const [l2, a2, b2] = labOf(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** The hue angle of a colour in CIELAB, in degrees from 0 to 360. */
export function hueAngle(hex: string): number {
  const [, a, b] = labOf(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

function declarations(theme: Theme): string {
  return TOKEN_NAMES.map((name) => `--${name}: ${theme[name]};`).join(' ');
}

/** The selector of a theme's tokens; the default also covers a root with no or an unknown data-palette. */
export function paletteSelector(id: PaletteId): string {
  return id === DEFAULT_PALETTE ? `:root, :root[data-palette='${id}']` : `:root[data-palette='${id}']`;
}

/**
 * The style sheet that defines the tokens: each theme's light set under its data-palette, and its dark
 * set under the system dark scheme with the very same selectors, so the dark set wins by order alone.
 * A root without a data-palette attribute, or with an unknown one, gets the default theme.
 */
export function themeStyleSheet(): string {
  const block = (variant: Variant) => PALETTES.map(({ id }) => `${paletteSelector(id)} { color-scheme: ${isNeon(id) ? 'dark' : variant}; ${declarations(THEMES[id][variant])} }`).join('\n');
  return [block('light'), `@media (prefers-color-scheme: dark) {\n${block('dark')}\n}`].join('\n');
}
