import type { Theme } from './theme';

/**
 * The neon family: four dark themes that share one art set (illustrated scenes, emblem bubbles, glowing
 * tokens) and differ in their tokens and a few family rules in styles.css. Each is dark under both
 * system schemes, so a theme means the same look whatever the device's setting.
 */
interface NeonSpec {
  readonly ground: string;
  readonly glow: string;
  readonly edge: string;
  readonly surface: readonly [string, string, string];
  readonly text: string;
  readonly muted: string;
  readonly border: string;
  readonly primary: string;
  readonly onPrimary: string;
  readonly p1: readonly [string, string, string];
  readonly p2: readonly [string, string, string];
  readonly tiles: readonly [string, string, string, string];
  readonly inks: readonly [string, string, string, string];
  readonly frame: readonly [string, string, string, string];
  readonly well: string;
  readonly chip: string;
  readonly win: string;
}

function neon(s: NeonSpec): Theme {
  return {
    bg: s.ground,
    ground: s.ground,
    'ground-glow': s.glow,
    'ground-edge': s.edge,
    surface: s.surface[0],
    'surface-2': s.surface[1],
    'surface-3': s.surface[2],
    text: s.text,
    muted: s.muted,
    border: s.border,
    primary: s.primary,
    'on-primary': s.onPrimary,
    p1: s.p1[0],
    'p1-rim': s.p1[1],
    'on-p1': s.p1[2],
    p2: s.p2[0],
    'p2-rim': s.p2[1],
    'on-p2': s.p2[2],
    face: '#f6d9b8',
    'face-ink': '#1a1432',
    cheek: '#e8957e',
    tear: s.p1[0],
    forest: s.tiles[0],
    water: s.tiles[1],
    mountain: s.tiles[2],
    desert: s.tiles[3],
    'forest-ink': s.inks[0],
    'water-ink': s.inks[1],
    'mountain-ink': s.inks[2],
    'desert-ink': s.inks[3],
    sun: '#ffd35a',
    moon: '#d4ccff',
    star: '#ffe27a',
    wave: '#72f0e2',
    frame: s.frame[0],
    'frame-edge': s.frame[1],
    'frame-grain': s.frame[2],
    'frame-sheen': s.frame[3],
    'on-frame': s.text,
    well: s.well,
    shine: '#ffffff',
    shade: '#000000',
    chip: s.chip,
    focus: '#ffffff',
    refusal: '#ff9bb0',
    win: s.win,
    slot: '#05030c',
    grey: '#8a86a8',
    toast: '#eef0ff',
    'on-toast': '#0a0716',
    'toast-alert': '#ff9bb0',
    'on-toast-alert': '#1a0010',
  };
}

export const NIGHT_CIRCUIT = neon({
  ground: '#0a0716', glow: '#2a1060', edge: '#05030c',
  surface: ['#1b1536', '#150f2c', '#100a22'], text: '#eef0ff', muted: '#b9b4dc', border: '#5a48b0',
  primary: '#19e3ff', onPrimary: '#001318',
  p1: ['#19e3ff', '#7ff1ff', '#001318'], p2: ['#ff3df2', '#ffa0f8', '#1a0018'],
  tiles: ['#0d2a2a', '#0d1d3c', '#1c1640', '#2b1a14'], inks: ['#38ff9c', '#4aa8ff', '#b69cff', '#ffb23d'],
  frame: ['#0e0a20', '#19e3ff', '#120c28', '#1a1236'], well: '#090614', chip: '#0a0716', win: '#7dffb0',
});

export const NEON_FROST = neon({
  ground: '#0b0720', glow: '#4b25a8', edge: '#05030f',
  surface: ['#241a48', '#1c1438', '#150f2c'], text: '#f2f0ff', muted: '#c2bde6', border: '#7a68d0',
  primary: '#19e3ff', onPrimary: '#001318',
  p1: ['#19e3ff', '#7ff1ff', '#001318'], p2: ['#ff3df2', '#ffa0f8', '#1a0018'],
  tiles: ['#12332f', '#12234a', '#241d52', '#33211a'], inks: ['#38ff9c', '#58b0ff', '#c0a8ff', '#ffb94d'],
  frame: ['#150f30', '#7a68d0', '#1a1238', '#241a48'], well: '#0a0620', chip: '#0b0720', win: '#7dffb0',
});

export const SYNTH_HORIZON = neon({
  ground: '#12062e', glow: '#4a0f6e', edge: '#07021a',
  surface: ['#241048', '#1a0b3a', '#13082c'], text: '#fbeaff', muted: '#d2b9e6', border: '#ff4fd8',
  primary: '#ff4fd8', onPrimary: '#1e0018',
  p1: ['#2de2ff', '#86f0ff', '#00141a'], p2: ['#ff9a3d', '#ffc08a', '#1c0e00'],
  tiles: ['#0e2a30', '#0f2048', '#221450', '#2e1a2a'], inks: ['#2dffb0', '#38b6ff', '#b58cff', '#ffb13d'],
  frame: ['#0e0422', '#ff4fd8', '#140730', '#1e0a42'], well: '#0a0420', chip: '#12062e', win: '#b6ff5c',
});

export const MIDNIGHT_AURORA = neon({
  ground: '#04060c', glow: '#0d2a33', edge: '#020306',
  surface: ['#0e1824', '#0b1420', '#08101a'], text: '#e8f4f2', muted: '#a9c4c0', border: '#2f7a72',
  primary: '#7cf3e0', onPrimary: '#04201c',
  p1: ['#7cf3e0', '#b4fff3', '#04201c'], p2: ['#c3a6ff', '#e0d0ff', '#150a30'],
  tiles: ['#0b2320', '#0b1f33', '#161a38', '#241f12'], inks: ['#5fe0b0', '#6fb4f0', '#a6a8f0', '#e0c070'],
  frame: ['#070d16', '#7cf3e0', '#0a121c', '#101c28'], well: '#060b12', chip: '#04060c', win: '#ffe9a8',
});
