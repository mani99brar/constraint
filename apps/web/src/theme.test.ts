import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  DARK,
  DEFAULT_PALETTE,
  deltaE,
  hueAngle,
  isNeon,
  isPaletteId,
  labOf,
  LIGHT,
  MATERIALS,
  PALETTE_IDS,
  PALETTES,
  paletteSelector,
  RING_PAIRS,
  TEXT_PAIRS,
  themeStyleSheet,
  THEMES,
  TOKEN_NAMES,
  type Theme,
} from './theme';

const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selectors: match[1]!.split(',').map((part) => part.trim()), body: match[2]! }));

/** Every theme and variant, as [name, tokens]. */
const SETS: readonly (readonly [string, Theme])[] = PALETTE_IDS.flatMap((id) => (['light', 'dark'] as const).map((variant) => [`${id} ${variant}`, THEMES[id][variant]] as const));

/** The neon family is dark under both system schemes and has its own checks; the classic themes keep theirs. */
const NEON_IDS = PALETTE_IDS.filter((id) => isNeon(id));
const CLASSIC_IDS = PALETTE_IDS.filter((id) => !isNeon(id));

const OLD_COLOURS = ['#2c5a60', '#a63b2b', '#d97706'];

describe('colour themes (PRD U5)', () => {
  it('computes WCAG contrast ratios and CIELAB colour differences', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    // Reference values: white is L* 100, black L* 0, and sRGB red is about (53.2, 80.1, 67.2).
    expect(labOf('#ffffff')[0]).toBeCloseTo(100, 1);
    expect(labOf('#000000')[0]).toBeCloseTo(0, 5);
    const [l, a, b] = labOf('#ff0000');
    expect(l).toBeCloseTo(53.24, 0);
    expect(a).toBeCloseTo(80.09, 0);
    expect(b).toBeCloseTo(67.2, 0);
    expect(deltaE('#ffffff', '#000000')).toBeCloseTo(100, 1);
  });

  it('offers the neon family first, Night Circuit the default, then the three classic themes, each with a light and a dark set of every token', () => {
    expect(PALETTE_IDS).toEqual(['night-circuit', 'neon-frost', 'synth-horizon', 'midnight-aurora', 'walnut', 'seaglass', 'clear']);
    expect(DEFAULT_PALETTE).toBe('night-circuit');
    expect(PALETTES.map((palette) => palette.label)).toEqual(['Night Circuit', 'Neon Frost', 'Synth Horizon', 'Midnight Aurora', 'Walnut', 'Sea glass', 'Clear']);
    expect(LIGHT).toBe(THEMES.walnut.light);
    expect(DARK).toBe(THEMES.walnut.dark);
    for (const [name, theme] of SETS) {
      expect(Object.keys(theme).sort(), name).toEqual([...TOKEN_NAMES].sort());
      for (const token of TOKEN_NAMES) expect(theme[token], `${name} --${token}`).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(isPaletteId('seaglass')).toBe(true);
    expect(isPaletteId('teal')).toBe(false);
    expect(isPaletteId(undefined)).toBe(false);
  });

  it('keeps the seed families: walnut buttons and ink-brown text on parchment, a deep teal on stone, a near-white or near-black clear ground', () => {
    expect(THEMES.walnut.light.primary).toBe('#6b4a30');
    expect(THEMES.walnut.light.text).toBe('#2b2118');
    expect(THEMES.walnut.light.ground).toBe('#f3ebdd');
    expect(THEMES.walnut.light.p1).toBe('#34509a');
    expect(THEMES.walnut.dark.ground).toBe('#1e1a16');
    expect(THEMES.walnut.dark.p1).toBe('#9db2f0');
    expect(THEMES.walnut.dark.p2).toBe('#f0a07f');
    expect(THEMES.seaglass.light.ground).toBe('#eef0ec');
    expect(THEMES.seaglass.light.primary).toBe('#1f5f5b');
    expect(THEMES.seaglass.light.p1).toBe('#2e4a8a');
    expect(THEMES.seaglass.dark.ground).toBe('#14201f');
    expect(labOf(THEMES.clear.light.ground)[0]).toBeGreaterThan(95);
    expect(labOf(THEMES.clear.dark.ground)[0]).toBeLessThan(5);
    // Terracotta and amber stay in their families in the classic themes: warm, orange-red hues.
    for (const [name, theme] of SETS.filter(([name]) => CLASSIC_IDS.some((id) => name.startsWith(`${id} `)))) {
      expect(hueAngle(theme.p2), name).toBeGreaterThan(25);
      expect(hueAngle(theme.p2), name).toBeLessThan(85);
    }
  });

  it('uses none of the old teal buttons, brick-red Player 2 or mustard last take in any theme', () => {
    for (const [name, theme] of SETS) for (const old of OLD_COLOURS) expect(Object.values(theme), name).not.toContain(old);
    expect(css.toLowerCase()).not.toMatch(/#2c5a60|#a63b2b|#d97706/);
    expect(TOKEN_NAMES).not.toContain('legal' as never);
    expect(TOKEN_NAMES).not.toContain('recent' as never);
  });

  it.each(SETS)('meets 4.5:1 for every text colour pair in %s', (_name, theme) => {
    for (const [text, background] of TEXT_PAIRS) {
      const ratio = contrastRatio(theme[text], theme[background]);
      expect(ratio, `${text} on ${background}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(SETS)('meets 4.5:1 for every text colour against every gradient stop of a text-bearing material in %s', (_name, theme) => {
    for (const material of MATERIALS) {
      for (const stop of material.stops) {
        for (const text of material.text) {
          expect(TEXT_PAIRS, `${text} on ${stop} (${material.name}) is listed`).toContainEqual([text, stop]);
          const ratio = contrastRatio(theme[text], theme[stop]);
          expect(ratio, `${text} on ${stop} (${material.name}): ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it.each(SETS)('rings a playable tile in each player’s colour at 3:1 against the board’s well, not the frame’s wood, in %s', (_name, theme) => {
    expect(RING_PAIRS).toEqual([
      ['p1', 'well'],
      ['p2', 'well'],
    ]);
    for (const [ring, well] of RING_PAIRS) {
      const ratio = contrastRatio(theme[ring], theme[well]);
      expect(ratio, `${ring} on ${well}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(SETS)('keeps both players and the ground distinguishable, the players apart in hue as well as lightness, by ΔE*ab of 25 or more, in %s', (_name, theme) => {
    expect(deltaE(theme.p1, theme.p2)).toBeGreaterThanOrEqual(25);
    expect(deltaE(theme.p1, theme.ground)).toBeGreaterThanOrEqual(25);
    expect(deltaE(theme.p2, theme.ground)).toBeGreaterThanOrEqual(25);
    expect(deltaE(theme.p1, theme.well)).toBeGreaterThanOrEqual(25);
    expect(deltaE(theme.p2, theme.well)).toBeGreaterThanOrEqual(25);
    // Apart in hue too, not only lighter or darker: at least 60° round the CIELAB hue circle.
    const hues = Math.abs(hueAngle(theme.p1) - hueAngle(theme.p2));
    expect(Math.min(hues, 360 - hues)).toBeGreaterThanOrEqual(60);
    // Player 2's colour stays apart from the wood and the desert tiles; the tokens stand off their slot.
    for (const other of [theme.frame, theme['frame-grain'], theme['frame-sheen'], theme.desert]) expect(deltaE(theme.p2, other)).toBeGreaterThanOrEqual(15);
    for (const player of [theme.p1, theme.p2]) expect(deltaE(player, theme.slot)).toBeGreaterThanOrEqual(25);
  });

  it.each(SETS)('keeps the four terrains, both sides and the board marks distinct in %s', (_name, theme) => {
    expect(new Set([theme.forest, theme.water, theme.mountain, theme.desert]).size).toBe(4);
    expect(new Set([theme.p1, theme.p2, theme.win]).size).toBe(3);
  });

  it('makes every neon theme dark under both schemes, with a dark well, a glowing player pair and a frame of its own', () => {
    for (const id of NEON_IDS) {
      const { light, dark } = THEMES[id];
      expect(light, id).toBe(dark);
      expect(labOf(dark.ground)[0], id).toBeLessThan(10);
      expect(labOf(dark.well)[0], id).toBeLessThan(10);
      expect(labOf(dark.p1)[0], id).toBeGreaterThan(70);
      expect(labOf(dark.p2)[0], id).toBeGreaterThan(55);
    }
  });

  it('puts the light well in the pale tone of its ground, the wood on the frame only, and a dark well under the dark sets', () => {
    for (const id of CLASSIC_IDS) {
      const { light, dark } = THEMES[id];
      expect(labOf(light.well)[0], id).toBeGreaterThan(85);
      expect(deltaE(light.well, light.ground), id).toBeLessThan(10);
      expect(labOf(dark.well)[0], id).toBeLessThan(20);
      expect(deltaE(light.well, light.frame), id).toBeGreaterThan(30);
    }
    expect(THEMES.walnut.light.well).toBe('#e8dcc7');
  });

  it('defines every token of every theme under its data-palette, the dark sets under the system scheme with the same selectors, and the default on a bare root', () => {
    const sheet = themeStyleSheet();
    const [light, dark] = sheet.split('@media (prefers-color-scheme: dark)') as [string, string];
    expect(dark).toBeDefined();
    for (const id of PALETTE_IDS) {
      const selector = paletteSelector(id);
      const scheme = isNeon(id) ? 'dark' : 'light';
      for (const name of TOKEN_NAMES) {
        expect(light).toContain(`--${name}: ${THEMES[id].light[name]};`);
        expect(dark).toContain(`--${name}: ${THEMES[id].dark[name]};`);
      }
      // The very same selector in both blocks, so the dark set wins by order and never loses by specificity.
      expect(light).toContain(`${selector} { color-scheme: ${scheme};`);
      expect(dark).toContain(`${selector} { color-scheme: dark;`);
    }
    // A root with no data-palette, or an unknown one, still gets the default theme's tokens.
    expect(paletteSelector('night-circuit')).toBe(":root, :root[data-palette='night-circuit']");
    expect(light.indexOf(":root, :root[data-palette='night-circuit']")).toBeLessThan(light.indexOf(":root[data-palette='seaglass']"));
  });

  it('paints each text-bearing material with gradient stops from its own tokens only, over a solid token colour', () => {
    for (const material of MATERIALS) {
      for (const selector of material.selectors) {
        const painted = rules.filter((rule) => rule.selectors.includes(selector) && /background-image\s*:/.test(rule.body));
        expect(painted.length, `${selector} has a gradient`).toBeGreaterThan(0);
        for (const rule of painted) {
          const image = /background-image\s*:\s*([^;]+)/.exec(rule.body)![1]!;
          if (image.trim() === 'none') continue;
          expect(image, selector).not.toMatch(/#|rgb|hsl|color-mix|transparent/);
          const used = [...image.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((match) => match[1]);
          expect(used.length, selector).toBeGreaterThan(0);
          for (const token of used) expect(material.stops, `${selector} uses --${token}`).toContain(token);
          const solid = /background-color\s*:\s*var\(--([a-z0-9-]+)\)/.exec(rule.body)?.[1];
          expect(material.stops, `${selector} keeps a solid token colour under its gradient`).toContain(solid);
        }
      }
    }
  });
});
