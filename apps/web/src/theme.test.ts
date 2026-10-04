import { describe, expect, it } from 'vitest';
import { contrastRatio, DARK, LIGHT, TEXT_PAIRS, themeStyleSheet, TOKEN_NAMES } from './theme';

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
});
