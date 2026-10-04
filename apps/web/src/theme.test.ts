import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, DARK, LIGHT, MATERIALS, TEXT_PAIRS, themeStyleSheet, TOKEN_NAMES } from './theme';

const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selectors: match[1]!.split(',').map((part) => part.trim()), body: match[2]! }));

describe('theme tokens (PRD U5)', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ] as const)('meets 4.5:1 for every text colour pair in the %s set', (_name, theme) => {
    for (const [text, background] of TEXT_PAIRS) {
      const ratio = contrastRatio(theme[text], theme[background]);
      expect(ratio, `${text} on ${background}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the four terrains, both sides and the three board marks distinct in both sets', () => {
    for (const theme of [LIGHT, DARK]) {
      expect(new Set([theme.forest, theme.water, theme.mountain, theme.desert]).size).toBe(4);
      expect(theme.p1).not.toBe(theme.p2);
      expect(new Set([theme.legal, theme.recent, theme.win]).size).toBe(3);
    }
  });

  it('defines every token in both sets, light by default and dark under the system scheme', () => {
    const css = themeStyleSheet();
    for (const name of TOKEN_NAMES) {
      expect(css).toContain(`--${name}: ${LIGHT[name]};`);
      expect(css).toContain(`--${name}: ${DARK[name]};`);
    }
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ] as const)('meets 4.5:1 for every text colour against every gradient stop of a text-bearing material in the %s set', (_name, theme) => {
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
